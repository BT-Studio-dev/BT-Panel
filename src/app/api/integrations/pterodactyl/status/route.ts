import { NextResponse } from "next/server";
import { handle, requireAdmin } from "@/lib/server/auth";
import { pterodactylConfigStatus } from "@/lib/server/pterodactyl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(req, async () => {
    await requireAdmin();
    return NextResponse.json(pterodactylConfigStatus());
  });
}
