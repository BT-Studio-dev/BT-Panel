/**
 * Seed the default `admin` user on first start (z.ai build).
 *
 * Runs once per process after the database is ready. If the `user` table is
 * empty, inserts:
 *   1. a `user` row  — email `admin@z.ai`, name `admin`
 *   2. an `account` row — `providerId='credential'` with the hashed password
 *      (Better Auth's own `hashPassword`, so the credentials validate against
 *      `auth.api.signInEmail`)
 *   3. a `profiles` row — username `admin`, role `owner`
 *
 * The `profiles` row is necessary because the login form (`src/routes/login.tsx`)
 * resolves a typed username to an email via `resolveLoginEmail` in
 * `src/lib/panel/server.ts`, which joins `profiles` (the only place that stores
 * the panel-visible username) to `user`. Without a seeded profile, the user
 * could still sign in by typing `admin@z.ai` in the username box, but typing
 * just `admin` would hit "Invalid username or password." before the first
 * session ever lands in `ensureProfile`. Pre-creating the profile removes
 * that catch-22 and makes `admin` / `admin` work as advertised.
 *
 * `ensureProfile` is idempotent (`on conflict (user_id) do update …`), so the
 * first real sign-in still works — it just refreshes `last_seen` instead of
 * creating a second profile row.
 *
 * Re-runs of this seed are no-ops once any user exists, so it is safe under
 * HMR and process restarts. Idempotency keys on `count(*)` against the
 * `user` table.
 *
 * NOTE: The seed user's password `admin` is 5 chars; `server.ts` lowers
 * Better Auth's `minPasswordLength` to 4 to permit it for sign-in (and future
 * sign-ups). Bump that floor back to 8 if you re-enable public registration.
 */
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import { ensureDbReady } from "../db";

/** The seeded admin credentials — surfaced for tests / docs / health checks. */
export const SEED_ADMIN_EMAIL = "admin@z.ai";
export const SEED_ADMIN_PASSWORD = "admin";
export const SEED_ADMIN_NAME = "admin";
/** Username shown in the panel UI and accepted by the login form. */
export const SEED_ADMIN_USERNAME = "admin";

const globalSeedRef = globalThis as typeof globalThis & {
  __zaiSeedAdminPromise__?: Promise<void>;
};

/**
 * Create the default admin user (and matching profile) if the database has no
 * users yet. Safe to call repeatedly; the work is memoized on `globalThis` so
 * HMR reloads of this module share one in-flight pass, and a failed pass
 * clears the slot so the next call retries.
 */
export function seedAdminUser(): Promise<void> {
  globalSeedRef.__zaiSeedAdminPromise__ ??= (async () => {
    // PGLite/Neon both must be ready before any query — `ensureDbReady` is a
    // no-op on Neon (pool is lazy) and opens+migrates PGLite on the preview
    // path. Calling it here keeps the seed self-contained: importers don't
    // need to remember to wait on the DB first.
    await ensureDbReady();
    const { getSql } = await import("../db");
    const sql = await getSql();

    const rows = await sql<{ n: number }>`select count(*)::int as n from "user"`;
    if ((rows[0]?.n ?? 0) > 0) {
      // Someone already lives here — leave the database untouched. This
      // covers both "admin already seeded" and "user signed up normally".
      return;
    }

    const hashed = await hashPassword(SEED_ADMIN_PASSWORD);
    const userId = randomUUID();
    const accountId = randomUUID();
    const now = new Date().toISOString();

    // Mirror what Better Auth's `signUpEmail` writes: one `user` row plus one
    // `account` row with `providerId='credential'` carrying the hashed
    // password. Inserting directly (rather than calling `auth.api.signUpEmail`)
    // avoids synthesizing a fake Request/Headers context and keeps the seed
    // independent of the auth instance's plugin wiring.
    await sql`
      insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${SEED_ADMIN_NAME}, ${SEED_ADMIN_EMAIL}, true, ${now}, ${now})
    `;
    await sql`
      insert into "account" (
        "id", "accountId", "providerId", "userId", "password",
        "createdAt", "updatedAt"
      )
      values (
        ${accountId}, ${SEED_ADMIN_EMAIL}, 'credential', ${userId}, ${hashed},
        ${now}, ${now}
      )
    `;

    // Pre-create the panel profile so the login form can resolve the username
    // `admin` -> email `admin@z.ai` via `resolveLoginEmail` BEFORE the user's
    // first session ever hits `ensureProfile`. Without this row the user is
    // forced to type their full email to sign in the first time. Role is
    // `owner` because the profiles table is empty (the `user`-count check
    // above guarantees that); subsequent sign-ups come in as `member` via
    // `ensureProfile`'s normal role assignment.
    await sql`
      insert into profiles (user_id, username, role, status, bio, profile_pic, last_seen, last_login_at)
      values (${userId}, ${SEED_ADMIN_USERNAME}, 'owner', 'active', '', '', now(), now())
      on conflict (user_id) do nothing
    `;

    // eslint-disable-next-line no-console
    console.log(
      `[seed] created default admin user — username=${SEED_ADMIN_USERNAME} email=${SEED_ADMIN_EMAIL} password=${SEED_ADMIN_PASSWORD}`,
    );
  })().catch((err) => {
    // Clear so the next caller retries; surface the failure loudly so a
    // silent broken seed doesn't lock users out of the live preview.
    globalSeedRef.__zaiSeedAdminPromise__ = undefined;
    console.error("[seed] failed to seed admin user:", err?.message || err);
    throw err;
  });
  return globalSeedRef.__zaiSeedAdminPromise__;
}
