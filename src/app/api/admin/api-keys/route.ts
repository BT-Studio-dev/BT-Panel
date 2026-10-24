import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, users } from "@/db/schema";
import type { ApiKeyDto } from "@/lib/panel/types";
import { handle, readBody, requireAdmin } from "@/lib/server/auth";
import { HttpError, newId, newToken, sha256 } from "@/lib/server/core";

function toDto(row: typeof apiKeys.$inferSelect, ownerName: string): ApiKeyDto {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    ownerName,
  };
}

export async function GET(req: Request) {
  return handle(req, async () => {
    await requireAdmin();
    const rows = await db
      .select({ key: apiKeys, ownerName: users.username })
      .from(apiKeys)
      .innerJoin(users, eq(apiKeys.userId, users.id))
      .orderBy(desc(apiKeys.createdAt));
    return NextResponse.json({ keys: rows.map((row) => toDto(row.key, row.ownerName)) });
  });
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const actor = await requireAdmin();
    const body = await readBody(req);
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
    if (name.length < 2) throw new HttpError(400, "Give the key a name with at least 2 characters.");

    const days = body.expiresInDays === undefined ? 0 : Number(body.expiresInDays);
    if (![0, 7, 30, 90, 365].includes(days)) {
      throw new HttpError(400, "Choose a supported expiration period.");
    }

    // The plaintext is returned only by this response. Authentication later
    // compares its SHA-256 digest, never a recoverable database value.
    const secret = `btp_${newToken()}`;
    const values = {
      id: newId("key"),
      userId: actor.id,
      name,
      prefix: secret.slice(0, 12),
      tokenHash: sha256(secret),
      expiresAt: days ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null,
    };
    const [row] = await db.insert(apiKeys).values(values).returning();
    return NextResponse.json({ key: toDto(row, actor.username), secret }, { status: 201 });
  });
}
