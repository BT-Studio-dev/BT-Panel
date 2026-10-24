import { NextResponse } from "next/server";
import { handle, requireAdmin } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/core";

export async function GET(req: Request) {
  return handle(req, async () => {
    // Reaching the panel already required a working database session. Return
    // connection metadata only — never the username, password, or full URL.
    await requireAdmin();
    const connection = process.env.DATABASE_URL;
    if (!connection) throw new HttpError(503, "The panel database is not configured.");
    let url: URL;
    try {
      url = new URL(connection);
    } catch {
      throw new HttpError(503, "The panel database connection is invalid.");
    }
    return NextResponse.json({
      hosts: [
        {
          id: "primary",
          name: "Panel PostgreSQL",
          host: url.hostname || "local",
          port: Number(url.port) || 5432,
          database: decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres",
          driver: "PostgreSQL",
          primary: true,
          status: "online",
        },
      ],
    });
  });
}
