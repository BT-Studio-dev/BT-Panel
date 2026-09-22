/**
 * Live wallpaper catalog scraped from 4kwallpapers.com (server-only).
 *
 * Ported from the user's CommonJS module to ESM/TypeScript. The site has no
 * API, so category/search pages are fetched as HTML and the wallpaper items
 * are extracted with regexes. Results are cached in-process for 10 minutes.
 * If the site is unreachable (offline sandbox, bot block, layout change) the
 * picker gets an honest empty state with a note — no fabricated wallpaper
 * entries.
 *
 * NEVER import this from client code (node https/http) — the client uses the
 * `fetchWallpaperCatalog` server function in `./server`.
 */
import http from "node:http";
import https from "node:https";
import {
  WALLPAPER_CATEGORIES,
  type WallpaperCatalogItem,
  type WallpaperCatalogResult,
} from "./wallpaper-catalog";

const cache = new Map<string, { time: number; data: WallpaperCatalogResult }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_REDIRECTS = 5;

function fetchHtml(url: string, redirects = 0): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 10000,
      },
      (res) => {
        const location = res.headers.location;
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && location) {
          res.resume(); // drain before following the redirect
          if (redirects >= MAX_REDIRECTS) {
            reject(new Error("Too many redirects"));
            return;
          }
          fetchHtml(new URL(location, url).toString(), redirects + 1)
            .then(resolve)
            .catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP error ${res.statusCode}`));
          return;
        }
        let html = "";
        res.on("data", (chunk: Buffer | string) => {
          html += chunk;
        });
        res.on("end", () => resolve(html));
      },
    );
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.on("error", reject);
  });
}

/** Exported (not just module-internal) so it can be unit-tested. */
export function parseWallpapersFromHtml(html: string): WallpaperCatalogItem[] {
  const wallpapers: WallpaperCatalogItem[] = [];
  // <p ... class="wallpapers__item" ...> ... </p>
  const itemRegex = /<p[^>]*class=["'][^"']*wallpapers__item[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(html)) !== null) {
    const block = match[1];

    const srcMatch = block.match(
      /src=["'](https:\/\/4kwallpapers\.com\/images\/walls\/thumbs\/(\d+)\.(jpg|png|webp))["']/i,
    );
    const contentUrlMatch = block.match(
      /href=["'](https:\/\/4kwallpapers\.com\/images\/walls\/thumbs_2t\/(\d+)\.(jpg|png|webp))["']/i,
    );
    const altMatch = block.match(/alt=["']([^"']+)["']/i);
    const keywordsMatch = block.match(/content=["']([^"']+)["']/i);

    let id = "";
    let ext = "jpg";
    let thumb = "";

    if (srcMatch) {
      thumb = srcMatch[1];
      id = srcMatch[2];
      ext = srcMatch[3];
    } else if (contentUrlMatch) {
      id = contentUrlMatch[2];
      ext = contentUrlMatch[3];
      thumb = `https://4kwallpapers.com/images/walls/thumbs/${id}.${ext}`;
    }

    if (id) {
      const title = (
        altMatch ? altMatch[1] : keywordsMatch ? keywordsMatch[1].split(",")[0] : `Wallpaper ${id}`
      ).trim();
      const tags = keywordsMatch ? keywordsMatch[1].split(",").map((s) => s.trim()) : [];

      wallpapers.push({
        id,
        title,
        tags,
        thumb,
        preview: `https://4kwallpapers.com/images/walls/thumbs_2t/${id}.${ext}`,
        full: `https://4kwallpapers.com/images/walls/thumbs_3t/${id}.${ext}`,
      });
    }
  }

  // Fallback regex if the schema layout differs
  if (wallpapers.length === 0) {
    const fallbackRegex =
      /https:\/\/4kwallpapers\.com\/images\/walls\/thumbs_2t\/(\d+)\.(jpg|png|webp)/gi;
    let fbMatch: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((fbMatch = fallbackRegex.exec(html)) !== null) {
      const id = fbMatch[1];
      const ext = fbMatch[2];
      if (!seen.has(id)) {
        seen.add(id);
        wallpapers.push({
          id,
          title: `Wallpaper ${id}`,
          tags: ["4K", "Ultra HD"],
          thumb: `https://4kwallpapers.com/images/walls/thumbs/${id}.${ext}`,
          preview: `https://4kwallpapers.com/images/walls/thumbs_2t/${id}.${ext}`,
          full: `https://4kwallpapers.com/images/walls/thumbs_3t/${id}.${ext}`,
        });
      }
    }
  }

  return wallpapers;
}

/** Failure envelope: honest empty state, the UI shows `note`. No fake items. */
function unreachableResult(
  category: string,
  page: number,
  query: string,
  errMsg: string,
): WallpaperCatalogResult {
  return {
    ok: true,
    category,
    page,
    query,
    hasNext: false,
    hasPrev: page > 1,
    total: 0,
    categories: WALLPAPER_CATEGORIES,
    wallpapers: [],
    note: `Live catalog unreachable: ${errMsg}. The server needs outbound internet access to 4kwallpapers.com — it works in any deployed environment with normal internet.`,
  };
}

export async function getWallpapers({
  category = "all",
  page = 1,
  query = "",
}: { category?: string; page?: number | string; query?: string } = {}): Promise<WallpaperCatalogResult> {
  const p = Math.max(1, Number.parseInt(String(page), 10) || 1);
  const cat = String(category || "all").toLowerCase();
  const q = String(query || "").trim();

  const cacheKey = `${cat}:${p}:${q}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  let url = "https://4kwallpapers.com/";

  // Categories either map to a fixed site path, or (newer engine categories
  // like Minecraft / DARK OLED) fall back to the site's own search.
  const catEntry = cat && cat !== "all" ? WALLPAPER_CATEGORIES.find((c) => c.id === cat) : undefined;
  const effectiveQuery = q || (catEntry?.q && !catEntry.path ? catEntry.q : "");
  const effectiveCatPath = !q && catEntry ? catEntry.path : "";

  if (effectiveQuery) {
    url = `https://4kwallpapers.com/search/?q=${encodeURIComponent(effectiveQuery)}${p > 1 ? `&page=${p}` : ""}`;
  } else if (effectiveCatPath) {
    url = `https://4kwallpapers.com${effectiveCatPath}${p > 1 ? `?page=${p}` : ""}`;
  } else if (cat && cat !== "all" && !catEntry) {
    // Unknown category id — treat it as a path anyway (legacy behaviour).
    url = `https://4kwallpapers.com/${cat}/${p > 1 ? `?page=${p}` : ""}`;
  } else {
    if (p > 1) url = `https://4kwallpapers.com/?page=${p}`;
  }

  try {
    const html = await fetchHtml(url);
    const items = parseWallpapersFromHtml(html);

    const hasNext =
      html.includes(`page=${p + 1}`) ||
      (p === 1 && (html.includes("?page=2") || html.includes("&page=2")));

    const result: WallpaperCatalogResult = {
      ok: true,
      category: cat,
      page: p,
      query: q,
      hasNext,
      hasPrev: p > 1,
      total: items.length,
      categories: WALLPAPER_CATEGORIES,
      wallpapers: items,
    };

    cache.set(cacheKey, { time: Date.now(), data: result });
    return result;
  } catch (err) {
    return unreachableResult(cat, p, q, err instanceof Error ? err.message : String(err));
  }
}
