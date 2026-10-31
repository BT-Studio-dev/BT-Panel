import { NextResponse } from "next/server";
import { WALLPAPERS, type WallpaperItem } from "@/lib/panel/catalog";

export const dynamic = "force-dynamic";

type Category = "all" | WallpaperItem["category"];
type WallpaperPage = {
  items: WallpaperItem[];
  page: number;
  hasMore: boolean;
  source: "bundled";
};

const PAGE_SIZE = 12;

function curatedPage(page: number, category: Category): WallpaperPage {
  const source = category === "all" ? WALLPAPERS : WALLPAPERS.filter((item) => item.category === category);
  const start = (page - 1) * PAGE_SIZE;
  const items = source.slice(start, start + PAGE_SIZE);
  return { items, page, hasMore: start + PAGE_SIZE < source.length, source: "bundled" };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const requestedCategory = params.get("category");
  const category: Category =
    requestedCategory === "space" || requestedCategory === "cyber" || requestedCategory === "nature"
      ? requestedCategory
      : "all";
  const parsedPage = Number.parseInt(params.get("page") ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.min(10_000, Math.max(1, parsedPage)) : 1;

  // Serve the bundled collection only. Local images keep thumbnails, previews,
  // and applied backgrounds available when external wallpaper hosts are blocked.
  return NextResponse.json(curatedPage(page, category));
}
