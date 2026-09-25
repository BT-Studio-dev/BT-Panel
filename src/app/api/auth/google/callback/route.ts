import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import {
  clearAttempts,
  clientKey,
  createSession,
  recordAttempt,
  setSessionCookie,
  assertNotLimited,
} from "@/lib/server/auth";
import { HttpError, hashPassword, newId, newToken, sha256, verifyPassword } from "@/lib/server/core";
import { ensureDatabase, getSettings, markLogin } from "@/lib/server/data";

/**
 * GET /api/auth/google/callback — finish the "Sign in with Google" flow.
 *
 * Google's consent screen redirects here with `code` + `state`. We:
 *  1. Verify the state cookie matches the URL state (CSRF defence).
 *  2. Exchange `code` for tokens at `oauth2.googleapis.com/token`.
 *  3. Fetch `https://openidconnect.googleapis.com/v1/userinfo`.
 *  4. Optionally enforce `googleAllowedEmail` whitelist.
 *  5. Find a matching user by email — if it doesn't exist, just-in-time
 *     create a member account using a random unguessable password (so
 *     they can never be signed in via the password form unless they
 *     reset it).
 *  6. Issue the same session cookie the password flow uses, redirect to
 *     `/`, and return the freshly-bootstrapped panel payload via a
 *     short-lived cookie consumed by the client.
 */
export async function GET(req: Request) {
  await ensureDatabase();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  if (errorParam) {
    return NextResponse.redirect(new URL(`/login?google_error=${encodeURIComponent(errorParam)}`, url));
  }
  if (!code || !state) throw new HttpError(400, "Missing OAuth code or state.");
  const stateCookie = readCookie(req, "btp_google_state");
  if (!stateCookie || stateCookie !== state) {
    throw new HttpError(400, "OAuth state mismatch — please retry sign-in.");
  }

  const settings = await getSettings();
  if (!settings.googleOauthEnabled || !settings.googleClientId || !settings.googleClientSecret) {
    throw new HttpError(503, "Google sign-in isn't configured.");
  }
  const redirectUri = `${url.protocol}//${url.host}/api/auth/google/callback`;

  const tokens = await exchangeCode({
    code,
    clientId: settings.googleClientId,
    clientSecret: settings.googleClientSecret,
    redirectUri,
  });
  const profile = await fetchUserInfo(tokens.access_token);
  const email = (profile.email ?? "").toLowerCase().trim();
  if (!email || !profile.email_verified) {
    throw new HttpError(403, "Your Google account doesn't expose a verified email — sign-in is blocked.");
  }
  const whitelist = (settings.googleAllowedEmail ?? "").trim().toLowerCase();
  if (whitelist && whitelist !== email) {
    throw new HttpError(403, "This Google account is not on the allowed list for this panel.");
  }

  // Rate-limit per IP/email like a normal login.
  const key = `login:${clientKey(req)}:google:${email}`;
  assertNotLimited(key, 8);

  // Find or create the matching user.
  const existing = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  let user = existing[0];
  if (!user) {
    // JIT create. Use email local-part as username (with a numeric suffix if
    // it clashes), and a random password nobody can ever guess.
    const local = email.split("@")[0].replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 22) || "user";
    const username = await pickUsername(local);
    const randomPassword = newToken() + newToken();
    const inserted = await db
      .insert(users)
      .values({
        id: newId("usr"),
        username,
        email,
        passwordHash: await hashPassword(randomPassword),
        role: "member",
        bio: `Signed in with Google (${profile.name ?? email}).`,
      })
      .returning();
    user = inserted[0];
  }
  if (user.status !== "active") {
    throw new HttpError(403, "This account is suspended — contact your panel administrator.");
  }

  clearAttempts(key);
  await markLogin(user.id);
  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.redirect(new URL("/", url));
  setSessionCookie(res, req, token, expiresAt);
  // The start route set this on /api/auth/google only — clear it.
  res.cookies.set("btp_google_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/api/auth/google",
    maxAge: 0,
  });
  return res;
}

async function pickUsername(local: string): Promise<string> {
  const base = local.toLowerCase();
  const rows = await db
    .select({ username: users.username })
    .from(users)
    .where(sql`lower(${users.username}) = ${base} or lower(${users.username}) like ${base + "%"}`);
  if (!rows.length) return base;
  let i = 1;
  while (rows.some((r) => r.username.toLowerCase() === `${base}${i}`)) i += 1;
  return `${base}${i}`;
}

async function exchangeCode({
  code,
  clientId,
  clientSecret,
  redirectUri,
}: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new HttpError(502, `Google token exchange failed: ${res.status} ${body.slice(0, 160)}`);
  }
  return (await res.json()) as { access_token: string; id_token?: string; token_type: string };
}

async function fetchUserInfo(accessToken: string) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(502, "Failed to read Google user profile.");
  return (await res.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
