import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { getSql } from "@/lib/db";

async function registrationOpen(): Promise<boolean> {
  try {
    const sql = await getSql();
    const rows = await sql.query<{ allow_registration: boolean }>(
      "select allow_registration from panel_settings where id = 1",
      [],
    );
    const value = rows[0]?.allow_registration;
    return value === undefined ? true : Boolean(value);
  } catch {
    return true;
  }
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);

        if (
          url.pathname.startsWith("/api/auth/sign-up/") &&
          !(await registrationOpen())
        ) {
          return Response.json(
            {
              message:
                "Public registration is disabled by the administrator.",
            },
            { status: 403 },
          );
        }

        return await auth.handler(request);
      },
    },
  },
});
