import { cache } from "react";
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { mediaFiles, panelSettings, passwordResetTokens, serverBackups, serverEvents, servers, sessions, users } from "@/db/schema";
import {
  CPU_OPTIONS,
  DISK_OPTIONS,
  MEMORY_OPTIONS,
  NODES,
  SERVER_TEMPLATES,
  consoleReply,
  getTemplate,
  parseShaderWallpaper,
} from "@/lib/panel/catalog";
import { parseMode } from "@/lib/panel/theme";
import {
  DEFAULT_SETTINGS,
  DEMO_ACCOUNTS,
  isAdminRole,
  type BackupDto,
  type BackupStatus,
  type BootstrapPayload,
  type PanelProfile,
  type PanelRole,
  type PanelSettings,
  type ServerDto,
  type ServerEventDto,
  type ServerStatus,
} from "@/lib/panel/types";
import { toHexColor } from "@/lib/utils";
import { HttpError, hashPassword, newId, newToken, sha256, verifyPassword } from "./core";

export type UserRow = typeof users.$inferSelect;
type ServerRow = typeof servers.$inferSelect;
type SettingsRow = typeof panelSettings.$inferSelect;
type SettingsInsert = typeof panelSettings.$inferInsert;
type EventLevel = ServerEventDto["level"];

// ── Schema self-heal (mirrors src/db/schema.ts, drizzle-compatible names) ──
const DDL = `
create table if not exists users (
  id text primary key,
  username text not null,
  email text not null,
  password_hash text not null,
  role text not null default 'member',
  status text not null default 'active',
  bio text not null default '',
  profile_pic text not null default '',
  last_seen timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  constraint users_username_unique unique (username),
  constraint users_email_unique unique (email)
);
create table if not exists sessions (
  id text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint sessions_user_id_users_id_fk foreign key (user_id) references users(id) on delete cascade
);
create index if not exists sessions_user_idx on sessions (user_id);
create table if not exists panel_settings (
  id integer primary key,
  theme_mode text not null default 'dark',
  wallpaper_url text not null default 'shader:waves',
  bg_blur integer not null default 0,
  bg_opacity integer not null default 100,
  accent_color text not null default '#d00000',
  glass_tint text not null default '#0a0c14',
  nav_text text not null default '#9da3b4',
  nav_text_active text not null default '#e7e9f0',
  glass_blur integer not null default 20,
  glass_saturate integer not null default 160,
  border_radius integer not null default 16,
  glass_opacity integer not null default 62,
  show_team boolean not null default true,
  panel_name text not null default 'BT Panel',
  panel_subtitle text not null default 'Command center',
  favicon_title text not null default 'BT Panel',
  panel_logo text not null default '',
  favicon_logo text not null default '',
  welcome_title text not null default 'Welcome',
  welcome_message text not null default 'Manage your panel from one place.',
  show_admin_stats boolean not null default true,
  show_version boolean not null default true,
  show_role boolean not null default true,
  show_header_user boolean not null default true,
  allow_registration boolean not null default true,
  tutorials_enabled boolean not null default true,
  show_demo_login boolean not null default true,
  password_reset_enabled boolean not null default true,
  smtp_host text not null default '',
  smtp_port integer not null default 587,
  smtp_secure boolean not null default false,
  smtp_user text not null default '',
  smtp_pass text not null default '',
  smtp_from text not null default 'BT Panel <no-reply@btpanel.local>',
  google_oauth_enabled boolean not null default false,
  google_client_id text not null default '',
  google_client_secret text not null default '',
  google_allowed_email text not null default '',
  updated_at timestamptz not null default now()
);
insert into panel_settings (id) values (1) on conflict (id) do nothing;
-- Column backfill for upgrades from older versions where the table
-- already exists from before the new columns were added.
alter table panel_settings add column if not exists password_reset_enabled boolean not null default true;
alter table panel_settings add column if not exists smtp_host text not null default '';
alter table panel_settings add column if not exists smtp_port integer not null default 587;
alter table panel_settings add column if not exists smtp_secure boolean not null default false;
alter table panel_settings add column if not exists smtp_user text not null default '';
alter table panel_settings add column if not exists smtp_pass text not null default '';
alter table panel_settings add column if not exists smtp_from text not null default 'BT Panel <no-reply@btpanel.local>';
alter table panel_settings add column if not exists google_oauth_enabled boolean not null default false;
alter table panel_settings add column if not exists google_client_id text not null default '';
alter table panel_settings add column if not exists google_client_secret text not null default '';
alter table panel_settings add column if not exists google_allowed_email text not null default '';
create table if not exists servers (
  id text primary key,
  name text not null,
  template text not null,
  status text not null default 'offline',
  status_changed_at timestamptz not null default now(),
  started_at timestamptz,
  node text not null default 'eu-fra-01',
  ip text not null default '10.0.0.10',
  port integer not null,
  cpu_limit integer not null default 200,
  memory_mb integer not null default 4096,
  disk_mb integer not null default 20480,
  owner_id text,
  created_at timestamptz not null default now(),
  constraint servers_owner_id_users_id_fk foreign key (owner_id) references users(id) on delete set null
);
create index if not exists servers_owner_idx on servers (owner_id);
create table if not exists server_events (
  id serial primary key,
  server_id text not null,
  level text not null default 'info',
  message text not null,
  created_at timestamptz not null default now(),
  constraint server_events_server_id_servers_id_fk foreign key (server_id) references servers(id) on delete cascade
);
create index if not exists server_events_server_idx on server_events (server_id, created_at);
create table if not exists server_backups (
  id text primary key,
  server_id text not null,
  name text not null,
  size_mb integer not null,
  status text not null default 'creating',
  created_by text,
  created_at timestamptz not null default now(),
  constraint server_backups_server_id_servers_id_fk foreign key (server_id) references servers(id) on delete cascade,
  constraint server_backups_created_by_users_id_fk foreign key (created_by) references users(id) on delete set null
);
create index if not exists server_backups_server_idx on server_backups (server_id, created_at);
create table if not exists media_files (
  id text primary key,
  name text not null,
  mime text not null,
  data text not null,
  created_by text,
  created_at timestamptz not null default now()
);
create table if not exists password_reset_tokens (
  id text primary key,
  user_id text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint password_reset_tokens_user_id_users_id_fk foreign key (user_id) references users(id) on delete cascade
);
create index if not exists password_reset_tokens_user_idx on password_reset_tokens (user_id);
`;

const globalForSetup = globalThis as typeof globalThis & { __btpReady?: Promise<void> };

export function ensureDatabase(): Promise<void> {
  if (!globalForSetup.__btpReady) {
    globalForSetup.__btpReady = (async () => {
      await pool.query(DDL);
      await seedDemo();
    })().catch((err) => {
      globalForSetup.__btpReady = undefined;
      throw err;
    });
  }
  return globalForSetup.__btpReady;
}

// ── Daemon simulation constants ─────────────────────────────────────────────
const BOOT_MS = 4200;
const STOP_MS = 2600;
const RESTART_GAP_MS = 1800;
const BACKUP_MS = 5000;
const MAX_BACKUPS_PER_SERVER = 5;
const SYSTEM = "container@bt-panel~";
const LINES = {
  running: `${SYSTEM} Server marked as running...`,
  stopping: `${SYSTEM} Server marked as stopping...`,
  offline: `${SYSTEM} Server marked as offline...`,
  killed: `${SYSTEM} Server process killed (SIGKILL)`,
};
const DAY = 86_400_000;
const HOUR = 3_600_000;

function levelOf(message: string): EventLevel {
  return message.startsWith(SYSTEM) ? "system" : "info";
}

async function seedDemo() {
  // SEED_DEMO=false (a real server) skips the sample accounts and fleet so the
  // first account registered becomes the panel owner.
  if (process.env.SEED_DEMO === "false" || process.env.SEED_DEMO === "0") return;
  const res = await pool.query<{ n: number }>("select count(*)::int as n from users");
  if ((res.rows[0]?.n ?? 0) > 0) return;
  const now = Date.now();
  const [ownerDemo, memberDemo] = DEMO_ACCOUNTS;
  const ownerHash = await hashPassword(ownerDemo.password);
  const steveHash = await hashPassword(memberDemo.password);
  const lockedHash = await hashPassword(randomBytes(18).toString("hex"));
  await db
    .insert(users)
    .values([
      { id: ownerDemo.id, username: ownerDemo.username, email: "admin@btpanel.local", passwordHash: ownerHash, role: "owner", bio: "Panel owner — keeps every server humming.", createdAt: new Date(now - 64 * DAY) },
      { id: memberDemo.id, username: memberDemo.username, email: "steve@btpanel.local", passwordHash: steveHash, role: "member", bio: "Runs the Valheim realm and the building contests.", createdAt: new Date(now - 22 * DAY) },
      { id: "usr_nova", username: "nova", email: "nova@btpanel.local", passwordHash: lockedHash, role: "admin", bio: "Infrastructure & game ops.", lastSeen: new Date(now - 3 * HOUR), createdAt: new Date(now - 51 * DAY) },
      { id: "usr_kairo", username: "kairo", email: "kairo@btpanel.local", passwordHash: lockedHash, role: "member", bio: "Minecraft builder and redstone wizard.", lastSeen: new Date(now - 26 * HOUR), createdAt: new Date(now - 30 * DAY) },
      { id: "usr_lumen", username: "lumen", email: "lumen@btpanel.local", passwordHash: lockedHash, role: "member", bio: "Discord bot maintainer.", lastSeen: new Date(now - 6 * DAY), createdAt: new Date(now - 12 * DAY) },
    ])
    .onConflictDoNothing();

  const seeds = [
    { id: "srv_smp", name: "Survival SMP", template: "minecraft", up: 3 * DAY + 4 * HOUR, node: "eu-fra-01", ip: "10.20.0.11", port: 25565, cpuLimit: 400, memoryMb: 8192, diskMb: 51200, ownerId: "usr_admin" },
    { id: "srv_cs2", name: "CS2 Competitive", template: "cs2", up: 7 * HOUR, node: "us-nyc-02", ip: "10.40.0.21", port: 27015, cpuLimit: 200, memoryMb: 4096, diskMb: 51200, ownerId: "usr_nova" },
    { id: "srv_bot", name: "BT Discord Bot", template: "discord-bot", up: 12 * DAY, node: "eu-fra-01", ip: "10.20.0.14", port: 8080, cpuLimit: 100, memoryMb: 1024, diskMb: 10240, ownerId: "usr_admin" },
    { id: "srv_api", name: "Status API", template: "nodejs", up: 26 * HOUR, node: "us-nyc-02", ip: "10.40.0.22", port: 3000, cpuLimit: 100, memoryMb: 2048, diskMb: 10240, ownerId: "usr_admin" },
    { id: "srv_rust", name: "Rust Main", template: "rust", up: 0, node: "ap-sgp-01", ip: "10.60.0.31", port: 28015, cpuLimit: 400, memoryMb: 16384, diskMb: 102400, ownerId: "usr_admin" },
    { id: "srv_valheim", name: "Valheim Realm", template: "valheim", up: 0, node: "eu-fra-01", ip: "10.20.0.12", port: 2456, cpuLimit: 200, memoryMb: 4096, diskMb: 20480, ownerId: "usr_steve" },
  ];
  for (const [index, seed] of seeds.entries()) {
    const { up, ...rest } = seed;
    const startedAt = up ? new Date(now - up) : null;
    const changedAt = startedAt ?? new Date(now - 2 * DAY);
    const inserted = await db
      .insert(servers)
      .values({ ...rest, status: up ? "running" : "offline", statusChangedAt: changedAt, startedAt, createdAt: new Date(now - 40 * DAY + index * 60_000) })
      .onConflictDoNothing()
      .returning({ id: servers.id });
    if (!inserted.length) continue;
    const t = getTemplate(seed.template);
    const lines = startedAt ? [...t.bootLog, LINES.running] : [LINES.stopping, ...t.stopLog, LINES.offline];
    const origin = changedAt.getTime() - (startedAt ? BOOT_MS : 0);
    await db.insert(serverEvents).values(
      lines.map((message, i) => ({ serverId: seed.id, level: levelOf(message), message, createdAt: new Date(origin + i * 600) })),
    );
  }
}

// ── Settings ────────────────────────────────────────────────────────────────
function rowToSettings(row: SettingsRow): PanelSettings {
  return {
    mode: parseMode(row.themeMode) ?? "dark",
    wallpaperUrl: row.wallpaperUrl,
    bgBlur: row.bgBlur,
    bgOpacity: row.bgOpacity,
    accentColor: row.accentColor,
    glassTint: row.glassTint,
    navText: row.navText,
    navTextActive: row.navTextActive,
    glassBlur: row.glassBlur,
    glassSaturate: row.glassSaturate,
    borderRadius: row.borderRadius,
    glassOpacity: row.glassOpacity,
    showTeam: row.showTeam,
    panelName: row.panelName,
    panelSubtitle: row.panelSubtitle,
    welcomeTitle: row.welcomeTitle,
    welcomeMessage: row.welcomeMessage,
    faviconTitle: row.faviconTitle,
    panelLogo: row.panelLogo,
    faviconLogo: row.faviconLogo,
    showAdminStats: row.showAdminStats,
    showVersion: row.showVersion,
    showRole: row.showRole,
    showHeaderUser: row.showHeaderUser,
    allowRegistration: row.allowRegistration,
    showDemoLogin: row.showDemoLogin,
    passwordResetEnabled: row.passwordResetEnabled,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecure: row.smtpSecure,
    smtpUser: row.smtpUser,
    smtpPass: row.smtpPass,
    smtpFrom: row.smtpFrom,
    googleOauthEnabled: row.googleOauthEnabled,
    googleClientId: row.googleClientId,
    googleClientSecret: row.googleClientSecret,
    googleAllowedEmail: row.googleAllowedEmail,
  };
}

export const getSettings = cache(async (): Promise<PanelSettings> => {
  await ensureDatabase();
  const rows = await db.select().from(panelSettings).where(eq(panelSettings.id, 1)).limit(1);
  return rows[0] ? rowToSettings(rows[0]) : DEFAULT_SETTINGS;
});

const intIn = (v: unknown, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(Math.min(max, Math.max(min, v))) : undefined;
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
const color = (v: unknown) =>
  typeof v === "string" && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v.trim()) ? toHexColor(v, "#000000") : undefined;

function imageRef(v: unknown, maxLength: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (s === "") return "";
  if (/^data:image\/(png|jpe?g|webp|gif|svg\+xml);base64,/i.test(s)) {
    if (s.length > maxLength) throw new HttpError(413, "That logo is too large — try a smaller image.");
    return s;
  }
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return s.slice(0, 2048);
  throw new HttpError(400, "Logos must be an uploaded image, an http(s) URL or a /path.");
}

function wallpaperRef(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (s === "" || parseShaderWallpaper(s)) return s;
  if (/^https?:\/\//i.test(s) || s.startsWith("/")) return s.slice(0, 2048);
  throw new HttpError(400, "Wallpaper must be a live shader, an http(s) URL or an uploaded file.");
}

export async function updateSettings(input: Record<string, unknown>): Promise<PanelSettings> {
  const patch: Partial<SettingsInsert> = {};
  const put = <K extends keyof SettingsInsert>(key: K, value: SettingsInsert[K] | undefined) => {
    if (value !== undefined) patch[key] = value;
  };
  put("themeMode", parseMode(input.mode) ?? undefined);
  put("wallpaperUrl", wallpaperRef(input.wallpaperUrl));
  put("bgBlur", intIn(input.bgBlur, 0, 100));
  put("bgOpacity", intIn(input.bgOpacity, 0, 100));
  put("accentColor", color(input.accentColor));
  put("glassTint", color(input.glassTint));
  put("navText", color(input.navText));
  put("navTextActive", color(input.navTextActive));
  put("glassBlur", intIn(input.glassBlur, 0, 40));
  put("glassSaturate", intIn(input.glassSaturate, 100, 250));
  put("borderRadius", intIn(input.borderRadius, 0, 24));
  put("glassOpacity", intIn(input.glassOpacity, 0, 100));
  put("showTeam", bool(input.showTeam));
  const panelName = str(input.panelName, 40);
  if (panelName !== undefined && !panelName) throw new HttpError(400, "Panel name cannot be empty.");
  put("panelName", panelName);
  put("panelSubtitle", str(input.panelSubtitle, 60));
  put("faviconTitle", str(input.faviconTitle, 60));
  put("welcomeTitle", str(input.welcomeTitle, 80));
  put("welcomeMessage", str(input.welcomeMessage, 280));
  put("panelLogo", imageRef(input.panelLogo, 300_000));
  put("faviconLogo", imageRef(input.faviconLogo, 150_000));
  put("showAdminStats", bool(input.showAdminStats));
  put("showVersion", bool(input.showVersion));
  put("showRole", bool(input.showRole));
  put("showHeaderUser", bool(input.showHeaderUser));
  put("allowRegistration", bool(input.allowRegistration));
  put("showDemoLogin", bool(input.showDemoLogin));
  put("passwordResetEnabled", bool(input.passwordResetEnabled));
  put("smtpHost", str(input.smtpHost, 200));
  const port = intIn(input.smtpPort, 1, 65535);
  put("smtpPort", port);
  put("smtpSecure", bool(input.smtpSecure));
  put("smtpUser", str(input.smtpUser, 200));
  put("smtpPass", typeof input.smtpPass === "string" ? input.smtpPass.slice(0, 400) : undefined);
  const smtpFrom = str(input.smtpFrom, 200);
  put("smtpFrom", smtpFrom);
  put("googleOauthEnabled", bool(input.googleOauthEnabled));
  put("googleClientId", str(input.googleClientId, 240));
  put("googleClientSecret", typeof input.googleClientSecret === "string" ? input.googleClientSecret.slice(0, 400) : undefined);
  put("googleAllowedEmail", str(input.googleAllowedEmail, 200));
  if (Object.keys(patch).length === 0) throw new HttpError(400, "Nothing to update.");
  const rows = await db
    .update(panelSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(panelSettings.id, 1))
    .returning();
  return rowToSettings(rows[0]);
}

// ── Profiles & users ────────────────────────────────────────────────────────
const ONLINE_MS = 2 * 60 * 1000;
const ROLE_RANK: Record<string, number> = { owner: 0, admin: 1, member: 2 };
const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,24}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function toProfile(row: UserRow, includeEmail = true): PanelProfile {
  const role: PanelRole = row.role === "owner" || row.role === "admin" ? row.role : "member";
  return {
    userId: row.id,
    username: row.username,
    email: includeEmail ? row.email : "",
    role,
    status: row.status === "suspended" ? "suspended" : "active",
    bio: row.bio,
    profilePic: row.profilePic,
    lastSeen: row.lastSeen ? row.lastSeen.toISOString() : null,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    online: row.lastSeen ? Date.now() - row.lastSeen.getTime() < ONLINE_MS : false,
  };
}

export async function listTeam(includeEmail: boolean): Promise<PanelProfile[]> {
  const rows = await db.select().from(users).orderBy(users.createdAt);
  return rows
    .sort((a, b) => (ROLE_RANK[a.role] ?? 3) - (ROLE_RANK[b.role] ?? 3) || a.createdAt.getTime() - b.createdAt.getTime())
    .map((row) => toProfile(row, includeEmail));
}

export async function touchPresence(userId: string) {
  await db.update(users).set({ lastSeen: new Date() }).where(eq(users.id, userId));
}

export async function countUsers(): Promise<number> {
  const res = await pool.query<{ n: number }>("select count(*)::int as n from users");
  return res.rows[0]?.n ?? 0;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function findUserByIdentifier(identifier: string): Promise<UserRow | null> {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${id} or lower(${users.email}) = ${id}`)
    .limit(1);
  return rows[0] ?? null;
}

async function assertAvailable(username: string, email: string | null, exceptId?: string) {
  const rows = await db
    .select({ id: users.id, username: users.username, email: users.email })
    .from(users)
    .where(
      email
        ? sql`lower(${users.username}) = ${username.toLowerCase()} or lower(${users.email}) = ${email}`
        : sql`lower(${users.username}) = ${username.toLowerCase()}`,
    );
  const clash = rows.find((r) => r.id !== exceptId);
  if (clash) {
    throw new HttpError(409, email && clash.email.toLowerCase() === email ? "That email is already registered." : "That username is taken.");
  }
}

export async function createUser(input: { username: unknown; email: unknown; password: unknown; role: PanelRole }): Promise<UserRow> {
  const username = typeof input.username === "string" ? input.username.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (!USERNAME_RE.test(username)) throw new HttpError(400, "Username must be 3–24 characters: letters, numbers, dot, dash or underscore.");
  if (!EMAIL_RE.test(email) || email.length > 120) throw new HttpError(400, "Enter a valid email address.");
  if (password.length < 8 || password.length > 128) throw new HttpError(400, "Password must be at least 8 characters.");
  await assertAvailable(username, email);
  const inserted = await db
    .insert(users)
    .values({ id: newId("usr"), username, email, passwordHash: await hashPassword(password), role: input.role })
    .returning();
  return inserted[0];
}

function assertCanModify(actor: UserRow, target: UserRow | null): asserts target is UserRow {
  if (!target) throw new HttpError(404, "User not found.");
  if (target.role === "owner") throw new HttpError(403, "The owner account cannot be modified.");
  if (target.id === actor.id) throw new HttpError(403, "Use My Account to manage your own profile.");
  if (target.role === "admin" && actor.role !== "owner") throw new HttpError(403, "Only the owner can manage administrators.");
}

export async function adminUpdateUser(actor: UserRow, targetId: string, input: { role?: unknown; status?: unknown }) {
  const target = await getUserById(targetId);
  assertCanModify(actor, target);
  if (input.role !== undefined) {
    if (actor.role !== "owner") throw new HttpError(403, "Only the owner can change roles.");
    if (input.role !== "admin" && input.role !== "member") throw new HttpError(400, "Invalid role.");
    await db.update(users).set({ role: input.role }).where(eq(users.id, target.id));
  }
  if (input.status !== undefined) {
    if (input.status !== "active" && input.status !== "suspended") throw new HttpError(400, "Invalid status.");
    await db.update(users).set({ status: input.status }).where(eq(users.id, target.id));
    if (input.status === "suspended") await db.delete(sessions).where(eq(sessions.userId, target.id));
  }
}

export async function adminDeleteUser(actor: UserRow, targetId: string) {
  const target = await getUserById(targetId);
  assertCanModify(actor, target);
  await db.delete(users).where(eq(users.id, target.id));
}

export async function updateOwnProfile(user: UserRow, input: Record<string, unknown>): Promise<UserRow> {
  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.username !== undefined) {
    const username = typeof input.username === "string" ? input.username.trim() : "";
    if (!USERNAME_RE.test(username)) throw new HttpError(400, "Username must be 3–24 characters: letters, numbers, dot, dash or underscore.");
    if (username.toLowerCase() !== user.username.toLowerCase()) await assertAvailable(username, null, user.id);
    patch.username = username;
  }
  if (input.bio !== undefined) patch.bio = typeof input.bio === "string" ? input.bio.trim().slice(0, 280) : "";
  if (input.profilePic !== undefined) {
    const pic = typeof input.profilePic === "string" ? input.profilePic.trim() : "";
    if (pic && !/^data:image\/(png|jpe?g|webp);base64,/i.test(pic)) throw new HttpError(400, "Profile picture must be a PNG, JPEG or WebP image.");
    if (pic.length > 200_000) throw new HttpError(413, "Profile picture is too large.");
    patch.profilePic = pic;
  }
  if (Object.keys(patch).length === 0) throw new HttpError(400, "Nothing to update.");
  const rows = await db.update(users).set(patch).where(eq(users.id, user.id)).returning();
  return rows[0];
}

export async function changeOwnPassword(user: UserRow, current: unknown, next: unknown) {
  if (typeof current !== "string" || !(await verifyPassword(current, user.passwordHash))) {
    throw new HttpError(400, "Current password is incorrect.");
  }
  if (typeof next !== "string" || next.length < 8 || next.length > 128) {
    throw new HttpError(400, "New password must be at least 8 characters.");
  }
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  // A demo account changed its password: the printed hint would be stale.
  if (DEMO_ACCOUNTS.some((account) => account.id === user.id)) {
    await db.update(panelSettings).set({ showDemoLogin: false }).where(eq(panelSettings.id, 1));
  }
}

export async function markLogin(userId: string) {
  const now = new Date();
  await db.update(users).set({ lastLoginAt: now, lastSeen: now }).where(eq(users.id, userId));
}

// ── Servers ─────────────────────────────────────────────────────────────────
function effectiveStatus(row: ServerRow, now = Date.now()): ServerStatus {
  const elapsed = now - row.statusChangedAt.getTime();
  if (row.status === "starting") {
    if (elapsed < 0) return "stopping"; // restart: shutdown phase
    return elapsed >= BOOT_MS ? "running" : "starting";
  }
  if (row.status === "stopping") return elapsed >= STOP_MS ? "offline" : "stopping";
  return row.status === "running" ? "running" : "offline";
}

function toServerDto(row: ServerRow, ownerName: string | null): ServerDto {
  const now = Date.now();
  const status = effectiveStatus(row, now);
  return {
    id: row.id,
    name: row.name,
    template: row.template,
    status,
    startedAt:
      status === "running" && row.startedAt ? new Date(Math.min(row.startedAt.getTime(), now)).toISOString() : null,
    node: row.node,
    ip: row.ip,
    port: row.port,
    cpuLimit: row.cpuLimit,
    memoryMb: row.memoryMb,
    diskMb: row.diskMb,
    ownerId: row.ownerId,
    ownerName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listServers(viewer: UserRow): Promise<ServerDto[]> {
  const rows = await db
    .select({ server: servers, ownerName: users.username })
    .from(servers)
    .leftJoin(users, eq(servers.ownerId, users.id))
    .where(isAdminRole(viewer.role) ? undefined : eq(servers.ownerId, viewer.id))
    .orderBy(servers.createdAt);
  return rows.map((r) => toServerDto(r.server, r.ownerName));
}

export async function getManagedServer(viewer: UserRow, id: string) {
  const rows = await db
    .select({ server: servers, ownerName: users.username })
    .from(servers)
    .leftJoin(users, eq(servers.ownerId, users.id))
    .where(eq(servers.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || (!isAdminRole(viewer.role) && row.server.ownerId !== viewer.id)) {
    throw new HttpError(404, "Server not found.");
  }
  return { row: row.server, ownerName: row.ownerName };
}

export async function getServerWithEvents(viewer: UserRow, id: string) {
  const { row, ownerName } = await getManagedServer(viewer, id);
  return { server: toServerDto(row, ownerName), events: await listServerEvents(id) };
}

export async function createServer(viewer: UserRow, input: Record<string, unknown>): Promise<ServerDto> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 40) throw new HttpError(400, "Server name must be 2–40 characters.");
  const template = SERVER_TEMPLATES.find((t) => t.id === input.template);
  if (!template) throw new HttpError(400, "Pick a server template.");
  const node = NODES.find((n) => n.id === input.node) ?? NODES[0];
  const memoryMb = MEMORY_OPTIONS.includes(Number(input.memoryMb)) ? Number(input.memoryMb) : 4096;
  const cpuLimit = CPU_OPTIONS.includes(Number(input.cpuLimit)) ? Number(input.cpuLimit) : 200;
  const diskMb = DISK_OPTIONS.includes(Number(input.diskMb)) ? Number(input.diskMb) : 20480;
  if (!isAdminRole(viewer.role)) {
    const own = await db.select({ id: servers.id }).from(servers).where(eq(servers.ownerId, viewer.id));
    if (own.length >= 3) throw new HttpError(403, "Members can own up to 3 servers — ask an admin for more.");
  }
  const onNode = await db.select({ port: servers.port }).from(servers).where(eq(servers.node, node.id));
  const used = new Set(onNode.map((s) => s.port));
  let port = template.defaultPort;
  while (used.has(port)) port += 1;
  const ip = `${node.subnet}${10 + ((onNode.length + 1) % 240)}`;
  const id = newId("srv");
  const now = Date.now();
  const inserted = await db
    .insert(servers)
    .values({ id, name, template: template.id, status: "offline", statusChangedAt: new Date(now), node: node.id, ip, port, cpuLimit, memoryMb, diskMb, ownerId: viewer.id })
    .returning();
  await db.insert(serverEvents).values([
    { serverId: id, level: "system", message: `${SYSTEM} Pulling image ${template.image}`, createdAt: new Date(now) },
    { serverId: id, level: "system", message: `${SYSTEM} Installation completed — press Start to boot ${name}`, createdAt: new Date(now + 5) },
  ]);
  return toServerDto(inserted[0], viewer.username);
}

async function schedule(
  serverId: string,
  lines: { level?: EventLevel; message: string }[],
  startOffset: number,
  span: number,
  base: number,
) {
  if (!lines.length) return;
  const step = lines.length > 1 ? span / (lines.length - 1) : 0;
  await db.insert(serverEvents).values(
    lines.map((l, i) => ({
      serverId,
      level: l.level ?? levelOf(l.message),
      message: l.message,
      createdAt: new Date(base + startOffset + Math.round(i * step)),
    })),
  );
}

async function trimEvents(serverId: string) {
  await pool.query(
    `delete from server_events where server_id = $1 and id not in (select id from server_events where server_id = $1 order by id desc limit 300)`,
    [serverId],
  );
}

const asLines = (messages: string[]) => messages.map((message) => ({ message }));

export async function powerServer(viewer: UserRow, id: string, action: unknown): Promise<ServerDto> {
  const { row, ownerName } = await getManagedServer(viewer, id);
  const status = effectiveStatus(row);
  const now = Date.now();
  const t = getTemplate(row.template);
  const clearFuture = () =>
    db.delete(serverEvents).where(and(eq(serverEvents.serverId, id), gt(serverEvents.createdAt, new Date(now))));
  let patch: Partial<typeof servers.$inferInsert>;
  switch (action) {
    case "start":
      if (status !== "offline") throw new HttpError(409, "Server is already running.");
      await clearFuture();
      patch = { status: "starting", statusChangedAt: new Date(now), startedAt: new Date(now + BOOT_MS) };
      await schedule(id, [...asLines(t.bootLog), { message: LINES.running }], 0, BOOT_MS, now);
      break;
    case "stop":
      if (status !== "running" && status !== "starting") throw new HttpError(409, "Server is not running.");
      await clearFuture();
      patch = { status: "stopping", statusChangedAt: new Date(now), startedAt: null };
      await schedule(id, [{ message: LINES.stopping }, ...asLines(t.stopLog), { message: LINES.offline }], 0, STOP_MS, now);
      break;
    case "restart":
      if (status !== "running") throw new HttpError(409, "Only a running server can be restarted.");
      await clearFuture();
      patch = {
        status: "starting",
        statusChangedAt: new Date(now + RESTART_GAP_MS),
        startedAt: new Date(now + RESTART_GAP_MS + BOOT_MS),
      };
      await schedule(id, [{ message: LINES.stopping }, ...asLines(t.stopLog)], 0, RESTART_GAP_MS - 300, now);
      await schedule(id, [...asLines(t.bootLog), { message: LINES.running }], RESTART_GAP_MS, BOOT_MS, now);
      break;
    case "kill":
      if (status === "offline") throw new HttpError(409, "Server is already offline.");
      await clearFuture();
      patch = { status: "offline", statusChangedAt: new Date(now), startedAt: null };
      await schedule(id, [{ level: "error", message: LINES.killed }], 0, 0, now);
      break;
    default:
      throw new HttpError(400, "Unknown power action.");
  }
  const updated = await db.update(servers).set(patch).where(eq(servers.id, id)).returning();
  await trimEvents(id);
  return toServerDto(updated[0], ownerName);
}

export async function sendServerCommand(viewer: UserRow, id: string, command: unknown) {
  const { row } = await getManagedServer(viewer, id);
  const text = typeof command === "string" ? command.trim().slice(0, 200) : "";
  if (!text) throw new HttpError(400, "Type a command first.");
  if (effectiveStatus(row) !== "running") throw new HttpError(409, "Server is not running — start it to use the console.");
  const now = Date.now();
  if (text.toLowerCase() === "clear") {
    await db.delete(serverEvents).where(and(eq(serverEvents.serverId, id), lte(serverEvents.createdAt, new Date(now))));
    await db.insert(serverEvents).values({ serverId: id, level: "system", message: `${SYSTEM} Console cleared`, createdAt: new Date(now) });
    return;
  }
  const replies = consoleReply(row.template, text);
  // Stamped just before "now" so the reply is included in this request's
  // snapshot (the console only shows events whose time has already passed).
  await db.insert(serverEvents).values([
    { serverId: id, level: "cmd", message: text, createdAt: new Date(now - 20) },
    ...replies.map((r, i) => ({ serverId: id, level: r.level, message: r.message, createdAt: new Date(now - 19 + i) })),
  ]);
  await trimEvents(id);
}

export async function listServerEvents(serverId: string): Promise<ServerEventDto[]> {
  const rows = await db
    .select()
    .from(serverEvents)
    .where(and(eq(serverEvents.serverId, serverId), lte(serverEvents.createdAt, new Date())))
    .orderBy(desc(serverEvents.createdAt), desc(serverEvents.id))
    .limit(200);
  const levels: EventLevel[] = ["info", "warn", "error", "cmd", "system"];
  return rows.reverse().map((r) => ({
    id: r.id,
    level: levels.includes(r.level as EventLevel) ? (r.level as EventLevel) : "info",
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function renameServer(viewer: UserRow, id: string, name: unknown): Promise<ServerDto> {
  const { ownerName } = await getManagedServer(viewer, id);
  const next = typeof name === "string" ? name.trim() : "";
  if (next.length < 2 || next.length > 40) throw new HttpError(400, "Server name must be 2–40 characters.");
  const rows = await db.update(servers).set({ name: next }).where(eq(servers.id, id)).returning();
  return toServerDto(rows[0], ownerName);
}

export async function deleteServer(viewer: UserRow, id: string) {
  await getManagedServer(viewer, id);
  await db.delete(servers).where(eq(servers.id, id));
}

// ── Backups ─────────────────────────────────────────────────────────────────
// Same "lazy/pull" simulation as server power state: a backup lands as
// `creating` and is derived as `ready` once BACKUP_MS has elapsed, purely
// from the row's own createdAt — no queue or background job involved.
type BackupRow = typeof serverBackups.$inferSelect;

function effectiveBackupStatus(row: BackupRow, now = Date.now()): BackupStatus {
  return now - row.createdAt.getTime() >= BACKUP_MS ? "ready" : "creating";
}

function toBackupDto(row: BackupRow, createdByName: string | null): BackupDto {
  return {
    id: row.id,
    serverId: row.serverId,
    name: row.name,
    sizeMb: row.sizeMb,
    status: effectiveBackupStatus(row),
    createdBy: row.createdBy,
    createdByName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBackups(viewer: UserRow, serverId: string): Promise<BackupDto[]> {
  await getManagedServer(viewer, serverId);
  const rows = await db
    .select({ backup: serverBackups, createdByName: users.username })
    .from(serverBackups)
    .leftJoin(users, eq(serverBackups.createdBy, users.id))
    .where(eq(serverBackups.serverId, serverId))
    .orderBy(desc(serverBackups.createdAt));
  return rows.map((r) => toBackupDto(r.backup, r.createdByName));
}

export async function createBackup(viewer: UserRow, serverId: string, input: Record<string, unknown>): Promise<BackupDto> {
  const { row } = await getManagedServer(viewer, serverId);
  const existing = await db
    .select({ id: serverBackups.id })
    .from(serverBackups)
    .where(eq(serverBackups.serverId, serverId));
  if (existing.length >= MAX_BACKUPS_PER_SERVER) {
    throw new HttpError(403, `A server can keep at most ${MAX_BACKUPS_PER_SERVER} backups — delete one first.`);
  }
  const requested = typeof input.name === "string" ? input.name.trim() : "";
  const name = (requested || `Snapshot ${new Date().toLocaleString()}`).slice(0, 60);
  // Simulated archive size: a plausible slice of the server's provisioned disk.
  const sizeMb = Math.max(64, Math.round(row.diskMb * (0.35 + Math.random() * 0.35)));
  const id = newId("bak");
  const now = new Date();
  const inserted = await db
    .insert(serverBackups)
    .values({ id, serverId, name, sizeMb, status: "creating", createdBy: viewer.id, createdAt: now })
    .returning();
  await db.insert(serverEvents).values({
    serverId,
    level: "system",
    message: `${SYSTEM} Backup "${name}" started (~${sizeMb} MB)`,
    createdAt: now,
  });
  return toBackupDto(inserted[0], viewer.username);
}

export async function deleteBackup(viewer: UserRow, serverId: string, backupId: string): Promise<void> {
  await getManagedServer(viewer, serverId);
  const deleted = await db
    .delete(serverBackups)
    .where(and(eq(serverBackups.id, backupId), eq(serverBackups.serverId, serverId)))
    .returning({ id: serverBackups.id });
  if (!deleted.length) throw new HttpError(404, "Backup not found.");
}

/**
 * Restore a ready backup: the server must be fully offline (restoring a live
 * server would race the very state we're about to overwrite), then it goes
 * through the same boot-log simulation as a normal Start, prefixed with a
 * restore line so the console clearly shows what happened and why.
 */
export async function restoreBackup(viewer: UserRow, serverId: string, backupId: string): Promise<ServerDto> {
  const { row, ownerName } = await getManagedServer(viewer, serverId);
  if (effectiveStatus(row) !== "offline") {
    throw new HttpError(409, "Stop the server before restoring a backup.");
  }
  const backupRows = await db
    .select()
    .from(serverBackups)
    .where(and(eq(serverBackups.id, backupId), eq(serverBackups.serverId, serverId)))
    .limit(1);
  const backup = backupRows[0];
  if (!backup) throw new HttpError(404, "Backup not found.");
  if (effectiveBackupStatus(backup) !== "ready") throw new HttpError(409, "That backup is still being created.");

  const now = Date.now();
  const t = getTemplate(row.template);
  await db.delete(serverEvents).where(and(eq(serverEvents.serverId, serverId), gt(serverEvents.createdAt, new Date(now))));
  const patch = { status: "starting" as const, statusChangedAt: new Date(now), startedAt: new Date(now + BOOT_MS) };
  await schedule(
    serverId,
    [
      { level: "system" as const, message: `${SYSTEM} Restoring snapshot "${backup.name}" (${backup.sizeMb} MB)...` },
      ...asLines(t.bootLog),
      { message: LINES.running },
    ],
    0,
    BOOT_MS,
    now,
  );
  const updated = await db.update(servers).set(patch).where(eq(servers.id, serverId)).returning();
  await trimEvents(serverId);
  return toServerDto(updated[0], ownerName);
}

// ── Media (uploaded wallpapers) ─────────────────────────────────────────────
export async function saveMedia(user: UserRow, input: Record<string, unknown>) {
  const dataUrl = typeof input.dataUrl === "string" ? input.dataUrl : "";
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new HttpError(400, "Upload a PNG, JPEG, WebP or GIF image.");
  if (match[2].length > 6_000_000) throw new HttpError(413, "Image is too large (max ~4.5 MB).");
  const id = newId("med");
  const name = (typeof input.name === "string" && input.name.trim() ? input.name.trim() : "wallpaper").slice(0, 120);
  await db.insert(mediaFiles).values({ id, name, mime: match[1], data: match[2], createdBy: user.id });
  return { id, url: `/api/media/${id}` };
}

export async function getMedia(id: string) {
  await ensureDatabase();
  const rows = await db.select({ mime: mediaFiles.mime, data: mediaFiles.data }).from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1);
  return rows[0] ?? null;
}

// ── Password reset tokens ──────────────────────────────────────────────────
const RESET_TTL_MS = 30 * 60_000; // 30 minutes — a leaked mailbox self-heals quickly.

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = newToken();
  const id = sha256(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  await db.insert(passwordResetTokens).values({ id, userId, expiresAt });
  return token;
}

export type ConsumedReset = { userId: string } | { expired: true } | { used: true } | { invalid: true };

export async function consumePasswordResetToken(token: string): Promise<ConsumedReset> {
  const id = sha256(token);
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.id, id))
    .limit(1);
  const row = rows[0];
  if (!row) return { invalid: true };
  if (row.usedAt) return { used: true };
  if (row.expiresAt.getTime() < Date.now()) return { expired: true };
  return { userId: row.userId };
}

/** Atomically mark a token used and return true only if we won the race. */
async function markTokenUsedOnce(id: string): Promise<boolean> {
  const res = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.id, id), sql`${passwordResetTokens.usedAt} is null`))
    .returning({ id: passwordResetTokens.id });
  return res.length > 0;
}

export async function resetPasswordWithToken(token: string, next: unknown): Promise<void> {
  if (typeof next !== "string" || next.length < 8 || next.length > 128) {
    throw new HttpError(400, "New password must be at least 8 characters.");
  }
  const result = await consumePasswordResetToken(token);
  if ("invalid" in result) throw new HttpError(400, "That reset link is invalid — request a new one.");
  if ("expired" in result) throw new HttpError(400, "That reset link has expired — request a new one.");
  if ("used" in result) throw new HttpError(400, "That reset link was already used — request a new one.");
  const id = sha256(token);
  const won = await markTokenUsedOnce(id);
  if (!won) throw new HttpError(400, "That reset link was just used — request a new one.");
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, result.userId));
  // Any existing sessions become invalid once the password changes.
  await db.delete(sessions).where(eq(sessions.userId, result.userId));
  // A demo account changed its password: the printed hint would be stale.
  if (DEMO_ACCOUNTS.some((account) => account.id === result.userId)) {
    await db.update(panelSettings).set({ showDemoLogin: false }).where(eq(panelSettings.id, 1));
  }
}

/** Sweep expired/unused tokens so the table doesn't grow forever. */
export async function purgePasswordResetTokens(): Promise<void> {
  await pool.query(
    `delete from password_reset_tokens where expires_at < now() or used_at is not null and created_at < now() - interval '7 days'`,
  );
}

// ── Bootstrap ───────────────────────────────────────────────────────────────
export async function getBootstrap(user: UserRow): Promise<BootstrapPayload> {
  await touchPresence(user.id);
  const admin = isAdminRole(user.role);
  const [settings, team, serverList] = await Promise.all([getSettings(), listTeam(admin), listServers(user)]);
  return {
    profile: toProfile({ ...user, lastSeen: new Date() }),
    settings,
    team,
    servers: serverList,
    userCount: team.length,
  };
}

export async function getLiveState(user: UserRow) {
  await touchPresence(user.id);
  const [team, serverList] = await Promise.all([listTeam(isAdminRole(user.role)), listServers(user)]);
  return { team, servers: serverList, userCount: team.length };
}
