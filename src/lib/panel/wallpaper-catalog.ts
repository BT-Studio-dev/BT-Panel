/**
 * Shared wallpaper-catalog contracts (client- AND server-safe — no node imports).
 *
 * Types + category list for the live 4kwallpapers.com catalog browser in
 * Settings → 4K Wallpapers. The actual scraping lives in
 * `wallpaper-source.server.ts`; the client only sees these types.
 */

export type WallpaperCatalogCategory = {
  id: string;
  name: string;
  /** Path on 4kwallpapers.com ("" for the "all" front page). */
  path: string;
  /** When set, this category has no fixed site page — resolved via site search. */
  q?: string;
};

export type WallpaperCatalogItem = {
  id: string;
  title: string;
  tags: string[];
  /** Small card image. */
  thumb: string;
  /** Larger preview. */
  preview: string;
  /** Largest served variant — applied as the panel wallpaper. */
  full: string;
};

export type WallpaperCatalogResult = {
  ok: boolean;
  category: string;
  page: number;
  query: string;
  hasNext: boolean;
  hasPrev: boolean;
  total: number;
  categories: WallpaperCatalogCategory[];
  wallpapers: WallpaperCatalogItem[];
  /** Set when the curated fallback list was served instead of the live site. */
  note?: string;
};

export const WALLPAPER_CATEGORIES: WallpaperCatalogCategory[] = [
  { id: "all", name: "All Wallpapers", path: "" },
  { id: "black-dark", name: "Black & Dark", path: "/dark/" },
  { id: "space", name: "Space & Galaxy", path: "/space/" },
  { id: "gaming", name: "Gaming", path: "/games/" },
  { id: "anime", name: "Anime & Manga", path: "/anime/" },
  { id: "abstract", name: "Abstract & Art", path: "/abstract/" },
  { id: "cars", name: "Cars & Supercars", path: "/cars/" },
  { id: "nature", name: "Nature & Landscapes", path: "/nature/" },
  { id: "sci-fi", name: "Sci-Fi & Cyberpunk", path: "/sci-fi/" },
  { id: "minimalism", name: "Minimalist", path: "/minimalism/" },
  { id: "movies", name: "Movies & TV", path: "/movies/" },
  // Categories without a fixed 4kwallpapers.com page — resolved via site search.
  { id: "minecraft", name: "Minecraft", path: "", q: "minecraft" },
  { id: "supercars", name: "Supercars", path: "", q: "supercar" },
  { id: "render-3d", name: "3D Render & CGI", path: "", q: "3d render" },
  { id: "dark-oled", name: "DARK OLED", path: "", q: "amoled" },
  { id: "midnight", name: "Dark Blue Midnight", path: "", q: "midnight blue" },
  { id: "animals", name: "Animals & Wildlife", path: "/animals/" },
  { id: "city", name: "Architecture & City", path: "/city/" },
  { id: "bikes", name: "Bikes & Motorcycles", path: "", q: "motorcycle" },
  { id: "celebrations", name: "Celebrations", path: "", q: "celebration" },
  { id: "fantasy", name: "Fantasy", path: "/fantasy/" },
  { id: "technology", name: "Technology & AI", path: "/technology/" },
];
