import { NextResponse } from "next/server";
import { handle, jsonError, readBody } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/core";
import { ensureDatabase, resetPasswordWithToken } from "@/lib/server/data";

/**
 * POST /api/auth/reset — finish a password reset.
 *
 * Body: { token: string, password: string }
 *  - `token` is the plaintext token from the URL (we sha256 it server-side).
 *  - `password` is the new password (8–128 chars).
 *
 * On success the token is single-use, the password is rotated, and every
 * existing session for that user is dropped (forcing sign-in again).
 */
export async function POST(req: Request) {
  return handle(req, async () => {
    await ensureDatabase();
    const body = await readBody(req);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!token) throw new HttpError(400, "Missing reset token.");
    if (password.length < 8 || password.length > 128) {
      throw new HttpError(400, "New password must be at least 8 characters.");
    }
    await resetPasswordWithToken(token, password);
    return NextResponse.json({ ok: true, message: "Your password has been updated. You can now sign in." });
  });
}
