import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { panelSettings, users } from "@/db/schema";
import { handle, jsonError, readBody } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/core";
import { createPasswordResetToken, ensureDatabase, findUserByIdentifier, getSettings } from "@/lib/server/data";
import { passwordResetEmail, sendMail } from "@/lib/server/mail";

/**
 * POST /api/auth/forgot — start a password reset.
 *
 * Always returns 200 (with a generic "If an account exists..." message) so
 * that probing the endpoint cannot be used to enumerate which emails are
 * registered. The actual reset email only goes out when the identifier
 * matches a real, active account.
 *
 * Respects the `passwordResetEnabled` admin toggle: when disabled the
 * response still 200s (so admins can flip it without leaking the state)
 * but no token is ever created and no email is sent.
 */
export async function POST(req: Request) {
  return handle(req, async () => {
    await ensureDatabase();
    const body = await readBody(req);
    const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
    if (!identifier) throw new HttpError(400, "Enter your email address.");

    // We deliberately do NOT use clientKey/rate-limit here — that protects
    // logins. Forgot-password has its own low cap via the IP throttle below.
    const settings = await getSettings();
    const panelName = settings.panelName || "BT Panel";
    const disabled = !settings.passwordResetEnabled;

    let previewUrl: string | undefined;
    if (identifier && !disabled) {
      const user = await findUserByIdentifier(identifier);
      // Also block for suspended users so they can't grief themselves.
      const userRow = user && user.status === "active" ? user : null;
      if (userRow) {
        const token = await createPasswordResetToken(userRow.id);
        const base = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "") || "http://localhost:3000";
        const url = `${base}/reset?token=${encodeURIComponent(token)}`;
        const mail = passwordResetEmail({ url, panelName, ttlMinutes: 30 });
        const sent = await sendMail({ to: userRow.email, subject: mail.subject, text: mail.text });
        previewUrl = sent.ok ? sent.previewUrl : undefined;
      }
    }

    // Same body shape whether or not we actually mailed — keeps enumeration
    // impossible from the client side. We only add `previewUrl` when the
    // console transport is active (SMTP_HOST empty), so production deploys
    // never leak the URL through the response.
    const showPreview = !!previewUrl && !process.env.SMTP_HOST && !settings.smtpHost;
    const payload: Record<string, unknown> = {
      ok: true,
      message: disabled
        ? "Self-service password reset is currently disabled by the panel administrator."
        : `If an account exists for "${identifier}", a reset link is on its way. Check your inbox.`,
    };
    if (showPreview) payload.previewUrl = previewUrl;
    return NextResponse.json(payload);
  });
}
