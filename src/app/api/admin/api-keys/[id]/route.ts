import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { handle, requireAdmin } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/core";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const deleted = await db.delete(apiKeys).where(eq(apiKeys.id, id)).returning({ id: apiKeys.id });
    if (!deleted.length) throw new HttpError(404, "API key not found.");
    return NextResponse.json({ ok: true });
  });
}
