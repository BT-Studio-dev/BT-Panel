import { NextResponse } from "next/server";
import { handle, readBody, requireAdmin } from "@/lib/server/auth";
import { createPterodactylServer, listPterodactylServers } from "@/lib/server/pterodactyl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(req, async () => {
    await requireAdmin();
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const perPage = Number(url.searchParams.get("per_page") ?? "25");
    return NextResponse.json(await listPterodactylServers(page, perPage));
  });
}

export async function POST(req: Request) {
  return handle(req, async () => {
    await requireAdmin();
    const created = await createPterodactylServer(await readBody(req));
    return NextResponse.json(created, { status: 201 });
  });
}
