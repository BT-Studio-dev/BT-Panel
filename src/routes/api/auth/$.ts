import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

/**
 * Public self-registration gate (Settings → Access & Feature Toggles).
 *
 * The login page hides the Create Account link and /register refuses, but the
 * enforcement belongs HERE: direct POSTs to Better Auth's sign-up endpoint get
 * a 403 while the toggle is off. Sign-in and every other auth call are
 * unaffected. Unreadable settings (e.g. mid-bootstrap) default to OPEN — the
 * admin flag is a convenience gate, not the security boundary for account
 * access (better-auth sessions are).
 */
async function registrationOpen(): Promise<boolean> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ allow_registration: boolean }>(
      `select allow_registration from panel_settings where id = 1`,
      [],
    );
    const flag = rows[0]?.allow_registration;
    return flag === undefined ? true : Boolean(flag);
  } catch {
    return true;
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: async ({ request }) => {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/auth/sign-up/") && !(await registrationOpen())) {
          return Response.json(
            { message: "Public registration is disabled by the administrator." },
            { status: 403 },
          );
        }
        return auth.handler(request);
      },
    },
  },
});
