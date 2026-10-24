import { NextResponse } from "next/server";
import { handle, readBody, requireAdmin } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/core";
import {
  createPterodactylAllocation,
  deletePterodactylAllocation,
  listPterodactylAllocations,
  setPterodactylPrimaryAllocation,
  updatePterodactylAllocationNotes,
} from "@/lib/server/pterodactyl";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ serverId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    await requireAdmin();
    const { serverId } = await ctx.params;
    return NextResponse.json(await listPterodactylAllocations(serverId));
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    await requireAdmin();
    const { serverId } = await ctx.params;
    const body = await readBody(req);
    switch (body.action) {
      case "create": {
        const created = await createPterodactylAllocation(serverId);
        return NextResponse.json(created, { status: 201 });
      }
      case "primary":
        await setPterodactylPrimaryAllocation(serverId, body.allocation);
        return NextResponse.json({ ok: true });
      case "notes":
        await updatePterodactylAllocationNotes(serverId, body.allocation, body.notes);
        return NextResponse.json({ ok: true });
      default:
        throw new HttpError(400, "action must be create, primary or notes.");
    }
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    await requireAdmin();
    const { serverId } = await ctx.params;
    const body = await readBody(req);
    await deletePterodactylAllocation(serverId, body.allocation);
    return NextResponse.json({ ok: true });
  });
}
