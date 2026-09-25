import { getMedia } from "@/lib/server/data";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const media = await getMedia(id).catch(() => null);
  if (!media) return new Response("Not found", { status: 404 });
  const bytes = new Uint8Array(Buffer.from(media.data, "base64"));
  return new Response(bytes, {
    headers: { "Content-Type": media.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
