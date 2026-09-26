import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * BT Panel schema — accounts, sessions, the singleton panel settings row
 * (theme / branding / bars / access), game & app servers with a console
 * event log, on-demand backup snapshots, and uploaded wallpaper media.
 *
 * NOTE: `src/lib/server/data.ts` mirrors these tables with
 * `CREATE TABLE IF NOT EXISTS` so a fresh database self-heals at runtime.
 */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"),
  status: text("status").notNull().default("active"),
  bio: text("bio").notNull().default(""),
  profilePic: text("profile_pic").notNull().default(""),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const panelSettings = pgTable("panel_settings", {
  id: integer("id").primaryKey(),
  themeMode: text("theme_mode").notNull().default("dark"),
  wallpaperUrl: text("wallpaper_url").notNull().default("shader:waves"),
  bgBlur: integer("bg_blur").notNull().default(0),
  bgOpacity: integer("bg_opacity").notNull().default(100),
  accentColor: text("accent_color").notNull().default("#d00000"),
  glassTint: text("glass_tint").notNull().default("#0a0c14"),
  navText: text("nav_text").notNull().default("#9da3b4"),
  navTextActive: text("nav_text_active").notNull().default("#e7e9f0"),
  glassBlur: integer("glass_blur").notNull().default(20),
  glassSaturate: integer("glass_saturate").notNull().default(160),
  borderRadius: integer("border_radius").notNull().default(16),
  glassOpacity: integer("glass_opacity").notNull().default(62),
  showTeam: boolean("show_team").notNull().default(true),
  panelName: text("panel_name").notNull().default("BT Panel"),
  panelSubtitle: text("panel_subtitle").notNull().default("Command center"),
  faviconTitle: text("favicon_title").notNull().default("BT Panel"),
  panelLogo: text("panel_logo").notNull().default(""),
  faviconLogo: text("favicon_logo").notNull().default(""),
  welcomeTitle: text("welcome_title").notNull().default("Welcome"),
  welcomeMessage: text("welcome_message").notNull().default("Manage your panel from one place."),
  showAdminStats: boolean("show_admin_stats").notNull().default(true),
  showVersion: boolean("show_version").notNull().default(true),
  showRole: boolean("show_role").notNull().default(true),
  showHeaderUser: boolean("show_header_user").notNull().default(true),
  allowRegistration: boolean("allow_registration").notNull().default(true),
  tutorialsEnabled: boolean("tutorials_enabled").notNull().default(true),
  showDemoLogin: boolean("show_demo_login").notNull().default(true),
  passwordResetEnabled: boolean("password_reset_enabled").notNull().default(true),
  smtpHost: text("smtp_host").notNull().default(""),
  smtpPort: integer("smtp_port").notNull().default(587),
  smtpSecure: boolean("smtp_secure").notNull().default(false),
  smtpUser: text("smtp_user").notNull().default(""),
  smtpPass: text("smtp_pass").notNull().default(""),
  smtpFrom: text("smtp_from").notNull().default("BT Panel <no-reply@btpanel.local>"),
  googleOauthEnabled: boolean("google_oauth_enabled").notNull().default(false),
  googleClientId: text("google_client_id").notNull().default(""),
  googleClientSecret: text("google_client_secret").notNull().default(""),
  googleAllowedEmail: text("google_allowed_email").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const servers = pgTable(
  "servers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    template: text("template").notNull(),
    status: text("status").notNull().default("offline"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    node: text("node").notNull().default("eu-fra-01"),
    ip: text("ip").notNull().default("10.0.0.10"),
    port: integer("port").notNull(),
    cpuLimit: integer("cpu_limit").notNull().default(200),
    memoryMb: integer("memory_mb").notNull().default(4096),
    diskMb: integer("disk_mb").notNull().default(20480),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("servers_owner_idx").on(t.ownerId)],
);

export const serverEvents = pgTable(
  "server_events",
  {
    id: serial("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    level: text("level").notNull().default("info"),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("server_events_server_idx").on(t.serverId, t.createdAt)],
);

/**
 * On-demand backup snapshots for a server. Creation is simulated the same
 * way power actions are: a row lands as `creating` and `effectiveBackupStatus`
 * (src/lib/server/data.ts) derives `ready` once enough time has elapsed —
 * no real archive is ever written to disk.
 */
export const serverBackups = pgTable(
  "server_backups",
  {
    id: text("id").primaryKey(),
    serverId: text("server_id")
      .notNull()
      .references(() => servers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sizeMb: integer("size_mb").notNull(),
    status: text("status").notNull().default("creating"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("server_backups_server_idx").on(t.serverId, t.createdAt)],
);

export const mediaFiles = pgTable("media_files", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  data: text("data").notNull(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One-shot password reset tokens. The plaintext token never lives in the DB —
 * only its sha256 hash does. `usedAt` is stamped when consumed so a token can
 * only be used once; `expiresAt` is short (default 30 min) so a leaked
 * mailbox message self-heals quickly.
 */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_reset_tokens_user_idx").on(t.userId)],
);
