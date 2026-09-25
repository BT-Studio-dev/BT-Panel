export type PanelRole = "owner" | "admin" | "member";
export type PanelStatus = "active" | "suspended";
export type PanelView =
  | "home"
  | "servers"
  | "team"
  | "music"
  | "settings"
  | "users"
  | "updates"
  | "account";
export type SettingsTab = "general" | "appearance" | "wallpapers" | "bars" | "access";

/** Panel color-scheme: classic dark, OLED pure-black (#000000), or light. */
export type ThemeMode = "dark" | "light" | "oled";

export type ThemeSettings = {
  mode: ThemeMode;
  wallpaperUrl: string;
  bgBlur: number;
  bgOpacity: number;
  accentColor: string;
  glassTint: string;
  navText: string;
  navTextActive: string;
  glassBlur: number;
  glassSaturate: number;
  borderRadius: number;
  glassOpacity: number;
  showTeam: boolean;
};

export type GeneralSettings = {
  panelName: string;
  panelSubtitle: string;
  welcomeTitle: string;
  welcomeMessage: string;
  faviconTitle: string;
  panelLogo: string;
  faviconLogo: string;
};

export type BarsSettings = {
  showAdminStats: boolean;
  showVersion: boolean;
  showRole: boolean;
  showHeaderUser: boolean;
};

export type AccessSettings = {
  allowRegistration: boolean;
  showDemoLogin: boolean;
  passwordResetEnabled: boolean;
};

/** Outbound mail server used to deliver password reset links. */
export type SmtpSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
};

/** "Sign in with Google" — only active when `googleOauthEnabled` is true and
 *  both a client id and a client secret are configured. `googleAllowedEmail`
 *  is an optional whitelist that, when set, restricts the OAuth login to a
 *  single email address (typical for single-user panels). */
export type GoogleOauthSettings = {
  googleOauthEnabled: boolean;
  googleClientId: string;
  googleClientSecret: string;
  googleAllowedEmail: string;
};

export type PanelSettings = ThemeSettings &
  GeneralSettings &
  BarsSettings &
  AccessSettings &
  SmtpSettings &
  GoogleOauthSettings;

export type PanelProfile = {
  userId: string;
  username: string;
  email: string;
  role: PanelRole;
  status: PanelStatus;
  bio: string;
  profilePic: string;
  lastSeen: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  online: boolean;
};

export type ServerStatus = "running" | "offline" | "starting" | "stopping";
export type PowerAction = "start" | "stop" | "restart" | "kill";

export type ServerDto = {
  id: string;
  name: string;
  template: string;
  status: ServerStatus;
  /** ISO time the server reached "running" (uptime origin) — null when not running. */
  startedAt: string | null;
  node: string;
  ip: string;
  port: number;
  cpuLimit: number;
  memoryMb: number;
  diskMb: number;
  ownerId: string | null;
  ownerName: string | null;
  createdAt: string;
};

export type ServerEventDto = {
  id: number;
  level: "info" | "warn" | "error" | "cmd" | "system";
  message: string;
  createdAt: string;
};

export type BootstrapPayload = {
  profile: PanelProfile;
  settings: PanelSettings;
  team: PanelProfile[];
  servers: ServerDto[];
  userCount: number;
};

export const DEFAULT_THEME: ThemeSettings = {
  mode: "dark",
  wallpaperUrl: "shader:waves",
  bgBlur: 0,
  bgOpacity: 100,
  accentColor: "#d00000",
  glassTint: "#0a0c14",
  navText: "#9da3b4",
  navTextActive: "#e7e9f0",
  glassBlur: 32,
  glassSaturate: 180,
  borderRadius: 18,
  glassOpacity: 88,
  showTeam: true,
};

export const DEFAULT_GENERAL: GeneralSettings = {
  panelName: "BT Panel",
  panelSubtitle: "Command center",
  welcomeTitle: "Welcome",
  welcomeMessage: "Manage your panel from one place.",
  faviconTitle: "BT Panel",
  panelLogo: "",
  faviconLogo: "",
};

export const DEFAULT_BARS: BarsSettings = {
  showAdminStats: true,
  showVersion: true,
  showRole: true,
  showHeaderUser: true,
};

export const DEFAULT_ACCESS: AccessSettings = {
  allowRegistration: true,
  showDemoLogin: true,
  passwordResetEnabled: true,
};

export const DEFAULT_SMTP: SmtpSettings = {
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "BT Panel <no-reply@btpanel.local>",
};

export const DEFAULT_GOOGLE_OAUTH: GoogleOauthSettings = {
  googleOauthEnabled: false,
  googleClientId: "",
  googleClientSecret: "",
  googleAllowedEmail: "",
};

export const DEFAULT_SETTINGS: PanelSettings = {
  ...DEFAULT_THEME,
  ...DEFAULT_GENERAL,
  ...DEFAULT_BARS,
  ...DEFAULT_ACCESS,
  ...DEFAULT_SMTP,
  ...DEFAULT_GOOGLE_OAUTH,
};

export const THEME_KEYS = Object.keys(DEFAULT_THEME) as (keyof ThemeSettings)[];

export function pickTheme(settings: PanelSettings): ThemeSettings {
  const out = {} as Record<string, unknown>;
  for (const key of THEME_KEYS) out[key] = settings[key];
  return out as ThemeSettings;
}

export const PANEL_VERSION = "v2.1.1";
export const REPO_URL = "https://github.com/BT-Studio-dev/BT-Panel";

/** Demo accounts seeded on a fresh database (ids below match the seed). */
export const DEMO_ACCOUNTS = [
  { id: "usr_admin", label: "Owner", username: "admin", password: "btpanel123" },
  { id: "usr_steve", label: "Member", username: "steve", password: "steve12345" },
] as const;

export function isAdminRole(role: PanelRole | string | undefined): boolean {
  return role === "owner" || role === "admin";
}

export const PANEL_VIEWS: PanelView[] = [
  "home",
  "servers",
  "team",
  "music",
  "settings",
  "users",
  "updates",
  "account",
];
const ADMIN_VIEWS: PanelView[] = ["settings", "users", "updates"];

/** Validate a ?view= value; members asking for admin pages land on Home. */
export function resolveView(requested: unknown, role: PanelRole | string): PanelView {
  const view =
    typeof requested === "string" && (PANEL_VIEWS as string[]).includes(requested) ? (requested as PanelView) : "home";
  return ADMIN_VIEWS.includes(view) && !isAdminRole(role) ? "home" : view;
}
