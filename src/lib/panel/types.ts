export type PanelRole = "owner" | "admin" | "member";
export type PanelStatus = "active" | "suspended";
export type PanelView = "home" | "tutorials" | "team" | "music" | "settings" | "users" | "updates" | "account";
export type SettingsTab = "general" | "appearance" | "wallpapers" | "music" | "bars" | "access";
export type PresenceFilter = "all" | "online" | "offline";

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
  /** Browser tab title (falls back to panelName when empty). */
  faviconTitle: string;
  /** Sidebar/login logo — URL, /path or data:image (empty = built-in mark). */
  panelLogo: string;
  /** Browser tab icon — URL, /path or data:image (empty = /favicon.svg). */
  faviconLogo: string;
};

export type BarsSettings = {
  showAdminStats: boolean;
  showVersion: boolean;
  showRole: boolean;
  showHeaderUser: boolean;
};

export type AccessSettings = {
  /** Public visitors may create accounts from /register. */
  allowRegistration: boolean;
  /** Show the Tutorials page + sidebar entry. */
  tutorialsEnabled: boolean;
  /** Auto-start the onboarding walkthrough on first login. */
  onboardingTour: boolean;
};

export type MusicPrefs = {
  enabled: boolean;
  autoplay: boolean;
  loop: boolean;
  volume: number;
  selectedTrackId: string;
};

export type PanelSettings = ThemeSettings & GeneralSettings & BarsSettings & MusicPrefs & AccessSettings;

export type MusicTrack = {
  id: string;
  name: string;
  url: string;
  source: "external" | "upload" | "bundled";
  createdAt: string;
};

export type MediaFile = {
  id: string;
  name: string;
  url: string;
  kind: "image" | "video";
  createdAt: string;
};

export type PanelProfile = {
  userId: string;
  username: string;
  email: string;
  image: string | null;
  role: PanelRole;
  status: PanelStatus;
  bio: string;
  profilePic: string;
  lastSeen: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  online: boolean;
};

export type PublicAppearance = {
  theme: ThemeSettings;
  general: GeneralSettings;
  /** Login page needs this to hide the sign-up link (and register to refuse). */
  allowRegistration: boolean;
};

export type BootstrapPayload = {
  profile: PanelProfile;
  settings: PanelSettings;
  tracks: MusicTrack[];
  media: MediaFile[];
  team: PanelProfile[];
  userCount: number;
};

export const DEFAULT_THEME: ThemeSettings = {
  mode: "dark",
  // No bundled wallpaper ships with the repo — clean dark gradient base.
  wallpaperUrl: "",
  bgBlur: 0,
  bgOpacity: 100,
  accentColor: "#d00000",
  glassTint: "#0a0c14",
  navText: "#9da3b4",
  navTextActive: "#e7e9f0",
  glassBlur: 20,
  glassSaturate: 160,
  borderRadius: 16,
  glassOpacity: 62,
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

export const DEFAULT_MUSIC: MusicPrefs = {
  enabled: false,
  autoplay: false,
  loop: true,
  volume: 0.35,
  selectedTrackId: "bt-ambient",
};

export const DEFAULT_ACCESS: AccessSettings = {
  allowRegistration: true,
  tutorialsEnabled: true,
  onboardingTour: false,
};

export const DEFAULT_SETTINGS: PanelSettings = {
  ...DEFAULT_THEME,
  ...DEFAULT_GENERAL,
  ...DEFAULT_BARS,
  ...DEFAULT_MUSIC,
  ...DEFAULT_ACCESS,
};

export const PANEL_VERSION = "v2.1.1";

export function isAdminRole(role: PanelRole | string | undefined): boolean {
  return role === "owner" || role === "admin";
}
