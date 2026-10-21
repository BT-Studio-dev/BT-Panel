import { NextResponse } from "next/server";
import { handle, requireAdmin } from "@/lib/server/auth";
import { getPterodactylResources } from "@/lib/server/pterodactyl";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ serverId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    await requireAdmin();
    const { serverId } = await ctx.params;
    return NextResponse.json(await getPterodactylResources(serverId));
  });
}
