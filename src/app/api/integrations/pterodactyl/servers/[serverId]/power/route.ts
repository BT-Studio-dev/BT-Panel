import { NextResponse } from "next/server";
import { handle, readBody, requireAdmin } from "@/lib/server/auth";
import { powerPterodactylServer } from "@/lib/server/pterodactyl";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ serverId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    await requireAdmin();
    const { serverId } = await ctx.params;
    const body = await readBody(req);
    await powerPterodactylServer(serverId, body.action);
    return NextResponse.json({ ok: true, action: body.action });
  });
}
