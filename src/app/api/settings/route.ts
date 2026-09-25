import { NextResponse } from "next/server";
import { handle, readBody, requireAdmin } from "@/lib/server/auth";
import { updateSettings } from "@/lib/server/data";

export async function PUT(req: Request) {
  return handle(req, async () => {
    await requireAdmin();
    const settings = await updateSettings(await readBody(req));
    return NextResponse.json({ settings });
  });
}
