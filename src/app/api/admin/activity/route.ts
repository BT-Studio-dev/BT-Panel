import { NextResponse } from "next/server";
import { desc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { serverEvents, servers } from "@/db/schema";
import type { AdminActivityDto } from "@/lib/panel/types";
import { handle, requireAdmin } from "@/lib/server/auth";

export async function GET(req: Request) {
  return handle(req, async () => {
    await requireAdmin();
    const requested = Number(new URL(req.url).searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(requested) ? Math.min(200, Math.max(20, Math.floor(requested))) : 100;
    const rows = await db
      .select({ event: serverEvents, serverName: servers.name })
      .from(serverEvents)
      .innerJoin(servers, eq(serverEvents.serverId, servers.id))
      // Boot and shutdown lines can be scheduled in the future; activity only
      // includes events that have actually become visible in server consoles.
      .where(lte(serverEvents.createdAt, new Date()))
      .orderBy(desc(serverEvents.createdAt), desc(serverEvents.id))
      .limit(limit);
    const activity: AdminActivityDto[] = rows.map(({ event, serverName }) => ({
      id: event.id,
      serverId: event.serverId,
      serverName,
      level: event.level as AdminActivityDto["level"],
      message: event.message,
      createdAt: event.createdAt.toISOString(),
    }));
    return NextResponse.json({ activity });
  });
}
