import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  type AccessSettings,
  type BarsSettings,
  type BootstrapPayload,
  type GeneralSettings,
  type MediaFile,
  type MusicPrefs,
  type MusicTrack,
  type PanelProfile,
  type PanelRole,
  type PanelSettings,
  type PanelStatus,
  type PublicAppearance,
  type ThemeSettings,
} from "./types";
import { getWallpapers } from "./wallpaper-source.server";
import type { WallpaperCatalogResult } from "./wallpaper-catalog";

const PRESENCE_MS = 5 * 60 * 1000;
const DISPOSABLE = new Set([
  "10minutemail.com",
  "20minutemail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "fakemail.net",
  "getnada.com",
  "guerrillamail.com",
  "inboxbear.com",
  "maildrop.cc",
  "mailinator.com",
  "moakt.com",
  "sharklasers.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com",
]);

type SettingsRow = {
  wallpaper_url: string;
  bg_blur: number;
  bg_opacity: number;
  accent_color: string;
  glass_tint: string;
  nav_text: string;
  nav_text_active: string;
  glass_blur: number;
  glass_saturate: number;
  border_radius: number;
  glass_opacity: number;
  show_team: boolean;
  panel_name: string;
  panel_subtitle: string;
  favicon_title: string;
  panel_logo: string;
  favicon_logo: string;
  welcome_title: string;
  welcome_message: string;
  show_admin_stats: boolean;
  show_version: boolean;
  show_role: boolean;
  show_header_user: boolean;
  allow_registration: boolean;
  tutorials_enabled: boolean;
  onboarding_tour: boolean;
  theme_mode: string;
  music_enabled: boolean;
  music_autoplay: boolean;
  music_loop: boolean;
  music_volume: number;
  music_selected_track_id: string;
};

type ProfileJoinRow = {
  user_id: string;
  username: string;
  role: string;
  status: string;
  bio: string;
  profile_pic: string;
  last_seen: string | null;
  last_login_at: string | null;
  created_at: string;
  email: string | null;
  image: string | null;
};

function unwrapData<T extends object>(input: T & { data?: T }): T {
  if (input && typeof input === "object" && "data" in input && input.data && typeof input.data === "object") {
    return input.data;
  }
  return input;
}

function validHex(value: unknown, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

function cleanText(value: unknown, fallback: string, max: number): string {
  const text = String(value ?? "")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
  return text || fallback;
}

function sanitizeUrl(value: unknown, max = 2000): string {
  const candidate = String(value || "").trim().slice(0, max);
  if (!candidate) return "";
  if (candidate.startsWith("/") || candidate.startsWith("data:image/") || candidate.startsWith("data:video/")) {
    return candidate;
  }
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function validUsername(value: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(value);
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isDisposable(email: string): boolean {
  const domain = email.split("@").pop() || "";
  return [...DISPOSABLE].some((d) => domain === d || domain.endsWith(`.${d}`));
}

function slugUsername(raw: string, fallback: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 32);
  if (validUsername(cleaned)) return cleaned;
  const fb = fallback.replace(/[^a-zA-Z0-9]/g, "").slice(0, 18);
  return `user_${fb || "member"}`.slice(0, 32);
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  const t = new Date(lastSeen).getTime();
  return Number.isFinite(t) && Date.now() - t <= PRESENCE_MS;
}

function mapSettings(row: SettingsRow | undefined): PanelSettings {
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    wallpaperUrl: row.wallpaper_url || DEFAULT_SETTINGS.wallpaperUrl,
    bgBlur: Number(row.bg_blur),
    bgOpacity: Number(row.bg_opacity),
    accentColor: validHex(row.accent_color, DEFAULT_SETTINGS.accentColor),
    glassTint: validHex(row.glass_tint, DEFAULT_SETTINGS.glassTint),
    navText: validHex(row.nav_text, DEFAULT_SETTINGS.navText),
    navTextActive: validHex(row.nav_text_active, DEFAULT_SETTINGS.navTextActive),
    glassBlur: Number.isFinite(Number(row.glass_blur)) ? Number(row.glass_blur) : DEFAULT_SETTINGS.glassBlur,
    glassSaturate: Number.isFinite(Number(row.glass_saturate)) ? Number(row.glass_saturate) : DEFAULT_SETTINGS.glassSaturate,
    borderRadius: Number.isFinite(Number(row.border_radius)) ? Number(row.border_radius) : DEFAULT_SETTINGS.borderRadius,
    glassOpacity: Number.isFinite(Number(row.glass_opacity)) ? Number(row.glass_opacity) : DEFAULT_SETTINGS.glassOpacity,
    showTeam: Boolean(row.show_team),
    panelName: row.panel_name,
    panelSubtitle: row.panel_subtitle,
    faviconTitle: row.favicon_title,
    panelLogo: row.panel_logo || "",
    faviconLogo: row.favicon_logo || "",
    welcomeTitle: row.welcome_title,
    welcomeMessage: row.welcome_message,
    showAdminStats: Boolean(row.show_admin_stats),
    showVersion: Boolean(row.show_version),
    showRole: Boolean(row.show_role),
    showHeaderUser: Boolean(row.show_header_user),
    allowRegistration: Boolean(row.allow_registration),
    tutorialsEnabled: Boolean(row.tutorials_enabled),
    onboardingTour: Boolean(row.onboarding_tour),
    mode: validThemeMode(row.theme_mode),
    enabled: Boolean(row.music_enabled),
    autoplay: Boolean(row.music_autoplay),
    loop: Boolean(row.music_loop),
    volume: Number(row.music_volume),
    selectedTrackId: row.music_selected_track_id || "",
  };
}

function mapProfile(row: ProfileJoinRow, includeEmail: boolean): PanelProfile {
  return {
    userId: row.user_id,
    username: row.username,
    email: includeEmail ? row.email || "" : "",
    image: row.image,
    role: (row.role as PanelRole) || "member",
    status: (row.status as PanelStatus) || "active",
    bio: row.bio || "",
    profilePic: row.profile_pic || "",
    lastSeen: row.last_seen,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    online: isOnline(row.last_seen),
  };
}

async function loadSettings(): Promise<PanelSettings> {
  const sql = await getSql();
  const rows = await sql<SettingsRow>`select * from panel_settings where id = 1`;
  return mapSettings(rows[0]);
}

async function loadTracks(): Promise<MusicTrack[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    url: string;
    source: string;
    created_at: string;
  }>`select id, name, url, source, created_at from music_tracks order by created_at desc`;
  const bundledTrack: MusicTrack = {
    id: "bt-ambient",
    name: "BT Ambient",
    url: "/audio/bt-ambient-loop.wav",
    source: "bundled",
    createdAt: "2026-09-15T00:00:00.000Z",
  };
  return [
    bundledTrack,
    ...rows
      .filter((row) => row.id !== bundledTrack.id)
      .map((row) => ({
        id: row.id,
        name: row.name,
        url: row.url,
        source: row.source === "upload" ? "upload" as const : "external" as const,
        createdAt: row.created_at,
      })),
  ];
}

async function loadMedia(): Promise<MediaFile[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    name: string;
    url: string;
    kind: string;
    created_at: string;
  }>`select id, name, url, kind, created_at from media_files order by created_at desc`;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    kind: row.kind === "video" ? "video" : "image",
    createdAt: row.created_at,
  }));
}

const PROFILE_SELECT = `
  p.user_id, p.username, p.role, p.status, p.bio, p.profile_pic,
  p.last_seen, p.last_login_at, p.created_at, u.email, u.image
`;

async function loadTeam(includeEmail: boolean): Promise<PanelProfile[]> {
  const sql = await getSql();
  const rows = await sql.query<ProfileJoinRow>(
    `select ${PROFILE_SELECT}
     from profiles p
     left join "user" u on u.id = p.user_id
     order by p.created_at asc`,
  );
  return rows.map((row) => mapProfile(row, includeEmail));
}

async function loadProfile(userId: string): Promise<PanelProfile | null> {
  const sql = await getSql();
  const rows = await sql.query<ProfileJoinRow>(
    `select ${PROFILE_SELECT}
     from profiles p
     left join "user" u on u.id = p.user_id
     where p.user_id = $1`,
    [userId],
  );
  return rows[0] ? mapProfile(rows[0], true) : null;
}

async function uniqueUsername(base: string): Promise<string> {
  const sql = await getSql();
  let candidate = base;
  for (let i = 0; i < 40; i += 1) {
    const rows = await sql<{ n: number }>`select count(*)::int as n from profiles where lower(username) = ${candidate.toLowerCase()}`;
    if ((rows[0]?.n ?? 0) === 0) return candidate;
    const suffix = String(i + 2);
    candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`;
  }
  return `${base.slice(0, 20)}${Date.now().toString(36).slice(-8)}`;
}

async function ensureProfile(userId: string): Promise<PanelProfile> {
  const sql = await getSql();
  const existing = await loadProfile(userId);
  if (existing) {
    await sql`update profiles set last_seen = now(), last_login_at = coalesce(last_login_at, now()) where user_id = ${userId}`;
    return (await loadProfile(userId))!;
  }

  const users = await sql.query<{ name: string | null; email: string | null; image: string | null; createdAt: string }>(
    `select name, email, image, "createdAt" from "user" where id = $1`,
    [userId],
  );
  const authUser = users[0];
  const counts = await sql<{ n: number }>`select count(*)::int as n from profiles`;
  const role: PanelRole = (counts[0]?.n ?? 0) === 0 ? "owner" : "member";
  const email = authUser?.email || "";
  const base = slugUsername(authUser?.name || email.split("@")[0] || "member", userId);
  const username = await uniqueUsername(base);

  await sql`
    insert into profiles (user_id, username, role, status, bio, profile_pic, last_seen, last_login_at)
    values (${userId}, ${username}, ${role}, 'active', '', ${authUser?.image || ""}, now(), now())
    on conflict (user_id) do update set last_seen = now()
  `;
  const created = await loadProfile(userId);
  if (!created) throw new Error("Could not create profile.");
  return created;
}

async function requireActive(userId: string): Promise<PanelProfile> {
  const profile = await ensureProfile(userId);
  if (profile.status !== "active") {
    throw new Error("This account is not active.");
  }
  return profile;
}

// Keep this PRIVATE: exporting non-RPC helpers from a createServerFn module
// breaks the client-side RPC split (the browser bundle then keeps the whole
// module graph, including Node-only imports, and crashes). updates.ts carries
// its own minimal admin guard for the same reason.
async function requireAdmin(userId: string): Promise<PanelProfile> {
  const profile = await requireActive(userId);
  if (profile.role !== "owner" && profile.role !== "admin") {
    throw new Error("Administrator permission required.");
  }
  return profile;
}

export const getPublicAppearance = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicAppearance> => {
    const settings = await loadSettings();
    return {
      theme: {
        mode: settings.mode,
        wallpaperUrl: settings.wallpaperUrl,
        bgBlur: settings.bgBlur,
        bgOpacity: settings.bgOpacity,
        accentColor: settings.accentColor,
        glassTint: settings.glassTint,
        navText: settings.navText,
        navTextActive: settings.navTextActive,
        glassBlur: settings.glassBlur,
        glassSaturate: settings.glassSaturate,
        borderRadius: settings.borderRadius,
        glassOpacity: settings.glassOpacity,
        showTeam: settings.showTeam,
      },
      general: {
        panelName: settings.panelName,
        panelSubtitle: settings.panelSubtitle,
        faviconTitle: settings.faviconTitle,
        panelLogo: settings.panelLogo,
        faviconLogo: settings.faviconLogo,
        welcomeTitle: settings.welcomeTitle,
        welcomeMessage: settings.welcomeMessage,
      },
      allowRegistration: settings.allowRegistration,
    };
  },
);

/**
 * Live 4kwallpapers.com catalog for Settings → 4K Wallpapers. Server-scraped
 * (see `wallpaper-source.server.ts`), cached, with a curated fallback so the
 * picker never comes up empty.
 */
export const fetchWallpaperCatalog = createServerFn({ method: "GET" })
  .validator((input: { category?: string; page?: number | string; query?: string }) => ({
    category: String(input?.category || "all").toLowerCase().slice(0, 40),
    page: Math.max(1, Number.parseInt(String(input?.page ?? 1), 10) || 1),
    query: String(input?.query || "").trim().slice(0, 120),
  }))
  .middleware([authMiddleware])
  .handler(async ({ data }): Promise<WallpaperCatalogResult> => {
    return getWallpapers({ category: data.category, page: data.page, query: data.query });
  });

export const resolveLoginEmail = createServerFn({ method: "POST" })
  .validator((input: { identifier: string }) => ({
    identifier: String(input?.identifier || "").trim().toLowerCase(),
  }))
  .handler(async ({ data }): Promise<{ email: string }> => {
    const identifier = data.identifier;
    if (!identifier) throw new Error("Enter a username or email.");
    if (identifier.includes("@")) return { email: identifier };
    const sql = await getSql();
    const rows = await sql.query<{ email: string | null }>(
      `select u.email from profiles p
       left join "user" u on u.id = p.user_id
       where lower(p.username) = $1`,
      [identifier],
    );
    const email = rows[0]?.email;
    if (!email) throw new Error("Invalid username or password.");
    return { email };
  });

export const bootstrapPanel = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<BootstrapPayload> => {
    const profile = await requireActive(context.userId);
    const admin = profile.role === "owner" || profile.role === "admin";
    const [settings, tracks, media, team] = await Promise.all([
      loadSettings(),
      loadTracks(),
      admin ? loadMedia() : Promise.resolve([] as MediaFile[]),
      loadTeam(admin),
    ]);
    return {
      profile,
      settings,
      tracks,
      media,
      team,
      userCount: team.length,
    };
  });

export const pingPresence = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update profiles set last_seen = now() where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bio?: string; username?: string }) => ({
    bio: String(input?.bio ?? "").replace(/[<>]/g, "").slice(0, 280),
    username: String(input?.username ?? "").trim(),
  }))
  .handler(async ({ context, data }) => {
    await requireActive(context.userId);
    const sql = await getSql();
    if (data.username) {
      if (!validUsername(data.username)) {
        throw new Error("Username must be 3–32 characters using letters, numbers, dots, dashes, or underscores.");
      }
      const taken = await sql<{ n: number }>`
        select count(*)::int as n from profiles
        where lower(username) = ${data.username.toLowerCase()} and user_id <> ${context.userId}
      `;
      if ((taken[0]?.n ?? 0) > 0) throw new Error("That username is already in use.");
      await sql`update profiles set username = ${data.username}, bio = ${data.bio} where user_id = ${context.userId}`;
    } else {
      await sql`update profiles set bio = ${data.bio} where user_id = ${context.userId}`;
    }
    return loadProfile(context.userId);
  });

export const saveProfilePic = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { dataUrl: string }) => ({
    dataUrl: String(input?.dataUrl || ""),
  }))
  .handler(async ({ context, data }) => {
    await requireActive(context.userId);
    if (!data.dataUrl.startsWith("data:image/") || data.dataUrl.length > 900_000) {
      throw new Error("Upload a PNG or JPEG under 2MB.");
    }
    const sql = await getSql();
    await sql`update profiles set profile_pic = ${data.dataUrl} where user_id = ${context.userId}`;
    return loadProfile(context.userId);
  });

function validThemeMode(value: unknown): ThemeSettings["mode"] {
  return value === "light" || value === "oled" ? value : "dark";
}

function sanitizeTheme(input: Partial<ThemeSettings>): ThemeSettings {
  const d = DEFAULT_SETTINGS;
  return {
    mode: validThemeMode(input.mode ?? d.mode),
    wallpaperUrl: sanitizeUrl(input.wallpaperUrl) || d.wallpaperUrl,
    bgBlur: clampInt(input.bgBlur, 0, 100, d.bgBlur),
    bgOpacity: clampInt(input.bgOpacity, 0, 100, d.bgOpacity),
    accentColor: validHex(input.accentColor, d.accentColor),
    glassTint: validHex(input.glassTint, d.glassTint),
    navText: validHex(input.navText, d.navText),
    navTextActive: validHex(input.navTextActive, d.navTextActive),
    glassBlur: clampInt(input.glassBlur, 0, 40, d.glassBlur),
    glassSaturate: clampInt(input.glassSaturate, 100, 220, d.glassSaturate),
    borderRadius: clampInt(input.borderRadius, 0, 24, d.borderRadius),
    glassOpacity: clampInt(input.glassOpacity, 0, 100, d.glassOpacity),
    showTeam: asBool(input.showTeam, d.showTeam),
  };
}

export const saveTheme = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<ThemeSettings> & { data?: Partial<ThemeSettings> }) =>
    sanitizeTheme(unwrapData(input || {})),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`
      update panel_settings set
        theme_mode = ${data.mode},
        wallpaper_url = ${data.wallpaperUrl},
        bg_blur = ${data.bgBlur},
        bg_opacity = ${data.bgOpacity},
        accent_color = ${data.accentColor},
        glass_tint = ${data.glassTint},
        nav_text = ${data.navText},
        nav_text_active = ${data.navTextActive},
        glass_blur = ${data.glassBlur},
        glass_saturate = ${data.glassSaturate},
        border_radius = ${data.borderRadius},
        glass_opacity = ${data.glassOpacity},
        show_team = ${data.showTeam}
      where id = 1
    `;
    return loadSettings();
  });

export const saveGeneral = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<GeneralSettings> & { data?: Partial<GeneralSettings> }) => {
    const value = unwrapData(input || {});
    return {
      panelName: cleanText(value?.panelName, DEFAULT_SETTINGS.panelName, 48),
      panelSubtitle: cleanText(value?.panelSubtitle, " ", 120).trim(),
      faviconTitle: cleanText(value?.faviconTitle, DEFAULT_SETTINGS.faviconTitle, 80),
      // Logos are URLs, /paths or data:image uploads — sanitizeUrl keeps
      // exactly those and reduces anything else to "" (= built-in defaults).
      // Generous cap: uploaded logos arrive as data:image URLs (~tens of KB),
      // while the default 2000-char limit would silently truncate them.
      panelLogo: sanitizeUrl(value?.panelLogo, 400_000),
      faviconLogo: sanitizeUrl(value?.faviconLogo, 400_000),
      welcomeTitle: cleanText(value?.welcomeTitle, DEFAULT_SETTINGS.welcomeTitle, 80),
      welcomeMessage: cleanText(value?.welcomeMessage, DEFAULT_SETTINGS.welcomeMessage, 240),
    };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`
      update panel_settings set
        panel_name = ${data.panelName},
        panel_subtitle = ${data.panelSubtitle},
        favicon_title = ${data.faviconTitle},
        panel_logo = ${data.panelLogo},
        favicon_logo = ${data.faviconLogo},
        welcome_title = ${data.welcomeTitle},
        welcome_message = ${data.welcomeMessage}
      where id = 1
    `;
    return loadSettings();
  });

export const saveBars = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<BarsSettings> & { data?: Partial<BarsSettings> }) => {
    const value = unwrapData(input || {});
    return {
      showAdminStats: asBool(value?.showAdminStats, true),
      showVersion: asBool(value?.showVersion, true),
      showRole: asBool(value?.showRole, true),
      showHeaderUser: asBool(value?.showHeaderUser, true),
    };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`
      update panel_settings set
        show_admin_stats = ${data.showAdminStats},
        show_version = ${data.showVersion},
        show_role = ${data.showRole},
        show_header_user = ${data.showHeaderUser}
      where id = 1
    `;
    return loadSettings();
  });

export const saveAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<AccessSettings> & { data?: Partial<AccessSettings> }) => {
    const value = unwrapData(input || {});
    return {
      allowRegistration: asBool(value?.allowRegistration, DEFAULT_SETTINGS.allowRegistration),
      tutorialsEnabled: asBool(value?.tutorialsEnabled, DEFAULT_SETTINGS.tutorialsEnabled),
      onboardingTour: asBool(value?.onboardingTour, DEFAULT_SETTINGS.onboardingTour),
    };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`
      update panel_settings set
        allow_registration = ${data.allowRegistration},
        tutorials_enabled = ${data.tutorialsEnabled},
        onboarding_tour = ${data.onboardingTour}
      where id = 1
    `;
    return loadSettings();
  });

export const saveMusicPrefs = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: Partial<MusicPrefs> & { data?: Partial<MusicPrefs> }) => {
    const value = unwrapData(input || {});
    const vol = Number(value?.volume);
    const volume = Number.isFinite(vol) ? Math.min(1, Math.max(0, vol > 1 ? vol / 100 : vol)) : 0.35;
    return {
      enabled: asBool(value?.enabled, false),
      autoplay: asBool(value?.autoplay, false),
      loop: asBool(value?.loop, true),
      volume,
      selectedTrackId: String(value?.selectedTrackId || "").slice(0, 80),
    };
  })
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`
      update panel_settings set
        music_enabled = ${data.enabled},
        music_autoplay = ${data.autoplay},
        music_loop = ${data.loop},
        music_volume = ${data.volume},
        music_selected_track_id = ${data.selectedTrackId}
      where id = 1
    `;
    return loadSettings();
  });

export const addMusicTrack = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name?: string; url?: string }) => ({
    name: cleanText(input?.name, "Untitled track", 120),
    url: sanitizeUrl(input?.url, 1000),
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (!data.url || data.url.startsWith("data:")) {
      throw new Error("Enter a valid HTTP(S) audio URL.");
    }
    const sql = await getSql();
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    await sql`
      insert into music_tracks (id, name, url, source)
      values (${id}, ${data.name}, ${data.url}, 'external')
    `;
    const settings = await loadSettings();
    if (!settings.selectedTrackId) {
      await sql`update panel_settings set music_selected_track_id = ${id} where id = 1`;
    }
    return { tracks: await loadTracks(), settings: await loadSettings() };
  });

export const deleteMusicTrack = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input?.id || "") }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`delete from music_tracks where id = ${data.id}`;
    const settings = await loadSettings();
    if (settings.selectedTrackId === data.id) {
      const tracks = await loadTracks();
      await sql`update panel_settings set music_selected_track_id = ${tracks[0]?.id || ""} where id = 1`;
    }
    return { tracks: await loadTracks(), settings: await loadSettings() };
  });

export const addMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name?: string; url?: string; kind?: string }) => ({
    name: cleanText(input?.name, "Background", 80),
    url: String(input?.url || ""),
    kind: input?.kind === "video" ? "video" : "image",
  }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const url = sanitizeUrl(data.url);
    if (!url) throw new Error("Provide an image URL or upload.");
    if (url.startsWith("data:") && url.length > 900_000) {
      throw new Error("File is too large. Use a smaller image or an external URL.");
    }
    const sql = await getSql();
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    await sql`
      insert into media_files (id, name, url, kind, created_by)
      values (${id}, ${data.name}, ${url}, ${data.kind}, ${context.userId})
    `;
    return loadMedia();
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => ({ id: String(input?.id || "") }))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await getSql();
    await sql`delete from media_files where id = ${data.id}`;
    return loadMedia();
  });

export const createPanelUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { username?: string; email?: string; password?: string; role?: string }) => ({
    username: String(input?.username || "").trim(),
    email: String(input?.email || "").trim().toLowerCase(),
    password: String(input?.password || ""),
    role: String(input?.role || "member").toLowerCase(),
  }))
  .handler(async ({ context, data }) => {
    const actor = await requireAdmin(context.userId);
    if (!validUsername(data.username)) throw new Error("Enter a valid username.");
    if (!validEmail(data.email)) throw new Error("Enter a valid email address.");
    if (isDisposable(data.email)) throw new Error("Temporary or disposable email addresses are not allowed.");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (data.role !== "member" && data.role !== "admin") throw new Error("You cannot create that role.");
    if (data.role === "admin" && actor.role !== "owner") throw new Error("Only the owner can create admins.");

    const sql = await getSql();
    const takenName = await sql<{ n: number }>`select count(*)::int as n from profiles where lower(username) = ${data.username.toLowerCase()}`;
    if ((takenName[0]?.n ?? 0) > 0) throw new Error("That username is already in use.");

    const { auth } = await import("@/lib/auth/server");
    const created = await auth.api.signUpEmail({
      body: { email: data.email, password: data.password, name: data.username },
    });
    const newId = created?.user?.id;
    if (!newId) throw new Error("Could not create the account.");
    await sql`
      insert into profiles (user_id, username, role, status, bio, profile_pic, last_seen)
      values (${newId}, ${data.username}, ${data.role}, 'active', '', '', null)
      on conflict (user_id) do update set username = ${data.username}, role = ${data.role}
    `;
    return loadTeam(true);
  });

export const deletePanelUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string }) => ({ userId: String(input?.userId || "") }))
  .handler(async ({ context, data }) => {
    const actor = await requireAdmin(context.userId);
    if (data.userId === actor.userId) throw new Error("You cannot delete your own account.");
    const target = await loadProfile(data.userId);
    if (!target) throw new Error("User not found.");
    const allowed = actor.role === "owner" ? true : target.role === "member";
    if (!allowed) throw new Error("You cannot delete this account.");
    const sql = await getSql();
    await sql`delete from profiles where user_id = ${data.userId}`;
    await sql.query(`delete from "user" where id = $1`, [data.userId]);
    return loadTeam(true);
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; role: string }) => ({
    userId: String(input?.userId || ""),
    role: String(input?.role || ""),
  }))
  .handler(async ({ context, data }) => {
    const actor = await requireAdmin(context.userId);
    if (actor.role !== "owner") throw new Error("Only the owner can change roles.");
    if (data.userId === actor.userId) throw new Error("The owner role cannot be reassigned this way.");
    if (data.role !== "admin" && data.role !== "member") throw new Error("Invalid role.");
    const sql = await getSql();
    await sql`update profiles set role = ${data.role} where user_id = ${data.userId} and role <> 'owner'`;
    return loadTeam(true);
  });

export const setUserStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string; status: string }) => ({
    userId: String(input?.userId || ""),
    status: String(input?.status || ""),
  }))
  .handler(async ({ context, data }) => {
    const actor = await requireAdmin(context.userId);
    if (data.userId === actor.userId) throw new Error("You cannot suspend your own account.");
    if (data.status !== "active" && data.status !== "suspended") throw new Error("Invalid status.");
    const target = await loadProfile(data.userId);
    if (!target) throw new Error("User not found.");
    if (target.role === "owner") throw new Error("The owner cannot be suspended.");
    if (actor.role !== "owner" && target.role !== "member") throw new Error("You cannot change this account.");
    const sql = await getSql();
    await sql`update profiles set status = ${data.status} where user_id = ${data.userId}`;
    return loadTeam(true);
  });
