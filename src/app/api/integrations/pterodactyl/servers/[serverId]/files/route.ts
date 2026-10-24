import { NextResponse } from "next/server";
import { handle, readBody, requireAdmin } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/core";
import {
  copyPterodactylFile,
  createPterodactylFolder,
  deletePterodactylFiles,
  getPterodactylFileContents,
  listPterodactylFiles,
  renamePterodactylFiles,
  writePterodactylFile,
} from "@/lib/server/pterodactyl";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ serverId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    await requireAdmin();
    const { serverId } = await ctx.params;
    const url = new URL(req.url);
    const file = url.searchParams.get("file");
    if (file !== null) {
      const content = await getPterodactylFileContents(serverId, file);
      return NextResponse.json({ content });
    }
    const directory = url.searchParams.get("directory") ?? "/";
    return NextResponse.json(await listPterodactylFiles(serverId, directory));
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return handle(req, async () => {
    await requireAdmin();
    const { serverId } = await ctx.params;
    const body = await readBody(req);
    switch (body.action) {
      case "write":
        await writePterodactylFile(serverId, body.file, body.content);
        return NextResponse.json({ ok: true });
      case "copy":
        await copyPterodactylFile(serverId, body.location);
        return NextResponse.json({ ok: true });
      case "create-folder":
        await createPterodactylFolder(serverId, body.root, body.name);
        return NextResponse.json({ ok: true }, { status: 201 });
      case "rename":
        await renamePterodactylFiles(serverId, body.root, body.files);
        return NextResponse.json({ ok: true });
      case "delete":
        await deletePterodactylFiles(serverId, body.root, body.files);
        return NextResponse.json({ ok: true });
      default:
        throw new HttpError(400, "action must be write, copy, create-folder, rename or delete.");
    }
  });
}
