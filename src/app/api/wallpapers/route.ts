import { NextResponse } from "next/server";
import { WALLPAPERS, type WallpaperItem } from "@/lib/panel/catalog";

export const dynamic = "force-dynamic";

type Category = "all" | WallpaperItem["category"];
type WallpaperPage = {
  items: WallpaperItem[];
  page: number;
  hasMore: boolean;
  source: "hdqwalls" | "curated";
};

const SOURCES: Record<Category, string> = {
  all: "https://hdqwalls.com/3840x2160-resolution-wallpapers",
  space: "https://hdqwalls.com/category/digital-universe-wallpapers/3840x2160",
  cyber: "https://hdqwalls.com/category/abstract-wallpapers/3840x2160",
  nature: "https://hdqwalls.com/category/nature-wallpapers/3840x2160",
};

const PAGE_SIZE = 12;
const INITIAL_COUNT: Record<Category, number> = { all: 12, space: 4, cyber: 4, nature: 4 };

function titleFromId(id: string): string {
  return id
    .replace(/-[a-z0-9]{2}$/i, "")
    .split("-")
    .map((part) => {
      if (/^(?:\d+k|\d+d|ai)$/i.test(part)) return part.toUpperCase();
      return part ? part[0].toUpperCase() + part.slice(1) : part;
    })
    .join(" ");
}

function inferCategory(id: string): WallpaperItem["category"] {
  if (/space|galaxy|nebula|planet|moon|cosmic|andromeda|universe|star|astronomy/i.test(id)) return "space";
  if (/nature|landscape|forest|mountain|lake|waterfall|sunset|iceland|valley|fjord|alps|glen|beach|ocean/i.test(id)) {
    return "nature";
  }
  return "cyber";
}

function parseWallpapers(html: string, category: Category): WallpaperItem[] {
  const items: WallpaperItem[] = [];
  const seen = new Set<string>();
  const pattern = /(?:https?:)?\/\/images\.hdqwalls\.com\/wallpapers\/bthumb\/([a-z0-9-]+)\.jpg/gi;
  for (const match of html.matchAll(pattern)) {
    const id = match[1].toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({
      id,
      title: titleFromId(id),
      category: category === "all" ? inferCategory(id) : category,
      thumb: `https://images.hdqwalls.com/wallpapers/bthumb/${id}.jpg`,
      full: `https://images.hdqwalls.com/download/${id}-3840x2160.jpg`,
      credit: "HDQWalls",
    });
  }
  return items;
}

function curatedPage(page: number, category: Category): WallpaperPage {
  const source = category === "all" ? WALLPAPERS : WALLPAPERS.filter((item) => item.category === category);
  // The first curated entries are already rendered by the client. Fallback
  // pages therefore continue the collection instead of repeating its start.
  const start = INITIAL_COUNT[category] + (page - 1) * PAGE_SIZE;
  const items = source.slice(start, start + PAGE_SIZE);
  return { items, page, hasMore: start + PAGE_SIZE < source.length, source: "curated" };
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const requestedCategory = params.get("category");
  const category: Category =
    requestedCategory && Object.prototype.hasOwnProperty.call(SOURCES, requestedCategory)
      ? (requestedCategory as Category)
      : "all";
  const parsedPage = Number.parseInt(params.get("page") ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.min(10_000, Math.max(1, parsedPage)) : 1;

  try {
    const response = await fetch(page === 1 ? SOURCES[category] : `${SOURCES[category]}/page/${page}`, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; BT-Panel-Wallpapers/1.0)",
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 404) {
      return NextResponse.json({ items: [], page, hasMore: false, source: "hdqwalls" } satisfies WallpaperPage);
    }
    if (!response.ok) throw new Error(`HDQWalls returned ${response.status}`);
    const html = await response.text();
    const items = parseWallpapers(html, category);
    if (items.length === 0) {
      return NextResponse.json({ items: [], page, hasMore: false, source: "hdqwalls" } satisfies WallpaperPage);
    }
    const nextPath = new RegExp(`\\/page\\/${page + 1}(?:["'/?#]|$)`, "i");
    return NextResponse.json({
      items,
      page,
      hasMore: nextPath.test(html) || items.length >= 18,
      source: "hdqwalls",
    } satisfies WallpaperPage);
  } catch {
    // Network-restricted previews and temporary upstream failures still get
    // new, unique HDQWalls entries from the bundled collection.
    return NextResponse.json(curatedPage(page, category));
  }
}
