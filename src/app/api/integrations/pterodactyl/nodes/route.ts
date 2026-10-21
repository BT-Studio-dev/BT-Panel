import { NextResponse } from "next/server";
import { handle, requireAdmin } from "@/lib/server/auth";
import { listPterodactylNodes } from "@/lib/server/pterodactyl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(req, async () => {
    await requireAdmin();
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const perPage = Number(url.searchParams.get("per_page") ?? "50");
    return NextResponse.json(await listPterodactylNodes(page, perPage));
  });
}
