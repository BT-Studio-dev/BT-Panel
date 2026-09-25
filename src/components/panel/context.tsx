"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { applyFavicon, applyTheme, getLocalModeOverride, setLocalModeOverride } from "@/lib/panel/theme";
import {
  isAdminRole,
  pickTheme,
  type BootstrapPayload,
  type PanelProfile,
  type PanelSettings,
  type PanelView,
  type ServerDto,
  type SettingsTab,
  type ThemeMode,
  type ThemeSettings,
} from "@/lib/panel/types";
import { api, clearCachedPanel, clearStoredToken } from "@/lib/utils";

type MusicPrefs = { volume: number; loop: boolean; autoplay: boolean };

export type MusicState = MusicPrefs & {
  playing: boolean;
  current: number;
  duration: number;
  toggle: () => void;
  seek: (seconds: number) => void;
  setPrefs: (patch: Partial<MusicPrefs>) => void;
};

type PanelContextValue = {
  profile: PanelProfile;
  setProfile: (profile: PanelProfile) => void;
  settings: PanelSettings;
  draft: ThemeSettings;
  setDraft: (patch: Partial<ThemeSettings>) => void;
  persistTheme: (extra?: Partial<ThemeSettings>, opts?: { quiet?: boolean }) => Promise<boolean>;
  persistSettings: (patch: Partial<PanelSettings>, message?: string) => Promise<boolean>;
  mode: ThemeMode;
  toggleMode: () => void;
  clearModeOverride: () => void;
  team: PanelProfile[];
  setTeam: (team: PanelProfile[]) => void;
  servers: ServerDto[];
  setServers: (servers: ServerDto[]) => void;
  upsertServer: (server: ServerDto) => void;
  userCount: number;
  isAdmin: boolean;
  view: PanelView;
  setView: (view: PanelView) => void;
  settingsTab: SettingsTab;
  setSettingsTab: (tab: SettingsTab) => void;
  openServerId: string | null;
  openServer: (id: string | null) => void;
  sidebarCollapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  music: MusicState;
};

const PanelContext = createContext<PanelContextValue | null>(null);

export function usePanel(): PanelContextValue {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error("usePanel must be used inside <PanelProvider>");
  return ctx;
}

const COLLAPSED_KEY = "btpanel.sidebar-collapsed";
const MUSIC_KEY = "btpanel.music";

function syncUrl(view: PanelView, serverId: string | null) {
  const params = new URLSearchParams();
  if (view !== "home") params.set("view", view);
  if (view === "servers" && serverId) params.set("server", serverId);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `/?${qs}` : "/");
}

export function PanelProvider({
  initial,
  initialView,
  initialServerId,
  initialModeOverride,
  children,
}: {
  initial: BootstrapPayload;
  initialView: PanelView;
  initialServerId: string | null;
  initialModeOverride: ThemeMode | null;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState(initial.profile);
  const [settings, setSettings] = useState(initial.settings);
  const [draft, setDraftState] = useState<ThemeSettings>(() => pickTheme(initial.settings));
  const [override, setOverride] = useState<ThemeMode | null>(initialModeOverride);
  const [team, setTeam] = useState(initial.team);
  const [servers, setServers] = useState(initial.servers);
  const [userCount, setUserCount] = useState(initial.userCount);
  const [view, setViewState] = useState<PanelView>(initialView);
  const [settingsTab, setSettingsTabState] = useState<SettingsTab>("appearance");
  const [openServerId, setOpenServerId] = useState<string | null>(initialServerId);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const isAdmin = isAdminRole(profile.role);
  const mode: ThemeMode = override ?? draft.mode;

  // ── Theme ──
  useEffect(() => {
    const local = getLocalModeOverride();
    if (local && local !== initialModeOverride) setOverride(local);
    try {
      setSidebarCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, [initialModeOverride]);

  useEffect(() => {
    applyTheme(draft, mode);
  }, [draft, mode]);

  useEffect(() => {
    document.title = settings.faviconTitle || settings.panelName || "BT Panel";
    applyFavicon(settings.faviconLogo);
  }, [settings.faviconTitle, settings.panelName, settings.faviconLogo]);

  const setDraft = useCallback((patch: Partial<ThemeSettings>) => {
    setDraftState((prev) => ({ ...prev, ...patch }));
  }, []);

  const persistTheme = useCallback(async (extra?: Partial<ThemeSettings>, opts?: { quiet?: boolean }) => {
    try {
      const res = await api<{ settings: PanelSettings }>("/api/settings", {
        method: "PUT",
        body: { ...draftRef.current, ...extra },
      });
      setSettings(res.settings);
      setDraftState(pickTheme(res.settings));
      if (!opts?.quiet) toast.success("Theme saved for everyone");
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save theme");
      return false;
    }
  }, []);

  const persistSettings = useCallback(async (patch: Partial<PanelSettings>, message = "Settings saved") => {
    try {
      const res = await api<{ settings: PanelSettings }>("/api/settings", { method: "PUT", body: patch });
      setSettings(res.settings);
      toast.success(message);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save settings");
      return false;
    }
  }, []);

  const toggleMode = useCallback(() => {
    const darkBase: ThemeMode = draftRef.current.mode === "light" ? "dark" : draftRef.current.mode;
    const target: ThemeMode = mode === "light" ? darkBase : "light";
    setLocalModeOverride(target);
    setOverride(target);
  }, [mode]);

  const clearModeOverride = useCallback(() => {
    setLocalModeOverride(null);
    setOverride(null);
  }, []);

  // ── Navigation ──
  const setView = useCallback((next: PanelView) => {
    setViewState(next);
    setMobileOpen(false);
    if (next !== "servers") setOpenServerId(null);
    syncUrl(next, null);
  }, []);

  const openServer = useCallback((id: string | null) => {
    setViewState("servers");
    setOpenServerId(id);
    setMobileOpen(false);
    syncUrl("servers", id);
  }, []);

  const setSettingsTab = useCallback((tab: SettingsTab) => {
    setSettingsTabState(tab);
    setViewState("settings");
    syncUrl("settings", null);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      try {
        window.localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !prev;
    });
  }, []);

  // ── Live data ──
  const refresh = useCallback(async () => {
    try {
      const data = await api<{ team: PanelProfile[]; servers: ServerDto[]; userCount: number }>("/api/panel");
      setTeam(data.team);
      setServers(data.servers);
      setUserCount(data.userCount);
      const me = data.team.find((m) => m.userId === initial.profile.userId);
      if (me) setProfile((prev) => ({ ...prev, online: true, lastSeen: me.lastSeen }));
    } catch (err) {
      if (err instanceof Error && /session has expired/i.test(err.message)) {
        clearStoredToken();
        clearCachedPanel();
        window.location.assign("/login");
      }
    }
  }, [initial.profile.userId]);

  const transitional = servers.some((s) => s.status === "starting" || s.status === "stopping");
  useEffect(() => {
    const id = window.setInterval(
      () => {
        if (!document.hidden) void refresh();
      },
      transitional ? 1500 : 15000,
    );
    return () => window.clearInterval(id);
  }, [refresh, transitional]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const upsertServer = useCallback((server: ServerDto) => {
    setServers((prev) => {
      const index = prev.findIndex((s) => s.id === server.id);
      if (index === -1) return [...prev, server];
      const next = prev.slice();
      next[index] = server;
      return next;
    });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    clearStoredToken();
    clearCachedPanel();
    window.location.assign("/login");
  }, []);

  // ── Ambient music player (persists across views) ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [prefs, setPrefsState] = useState<MusicPrefs>({ volume: 0.35, loop: true, autoplay: false });
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio("/audio/bt-ambient-loop.wav");
      audio.preload = "auto";
      audio.volume = prefsRef.current.volume;
      audio.loop = prefsRef.current.loop;
      audio.addEventListener("timeupdate", () => setCurrent(audio.currentTime));
      audio.addEventListener("loadedmetadata", () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0));
      audio.addEventListener("play", () => setPlaying(true));
      audio.addEventListener("pause", () => setPlaying(false));
      audio.addEventListener("ended", () => setPlaying(false));
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const toggle = useCallback(() => {
    const audio = ensureAudio();
    if (audio.paused) {
      audio.play().catch(() => toast.error("The browser blocked playback — click play again."));
    } else {
      audio.pause();
    }
  }, [ensureAudio]);

  const seek = useCallback(
    (seconds: number) => {
      const audio = ensureAudio();
      audio.currentTime = seconds;
    },
    [ensureAudio],
  );

  const setPrefs = useCallback((patch: Partial<MusicPrefs>) => {
    setPrefsState((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(MUSIC_KEY);
      if (raw) setPrefsState((prev) => ({ ...prev, ...(JSON.parse(raw) as Partial<MusicPrefs>) }));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(MUSIC_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    if (audioRef.current) {
      audioRef.current.volume = prefs.volume;
      audioRef.current.loop = prefs.loop;
    }
  }, [prefs]);

  useEffect(() => {
    if (!prefs.autoplay) return;
    const start = () => {
      const audio = ensureAudio();
      if (audio.paused) void audio.play().catch(() => undefined);
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, [prefs.autoplay, ensureAudio]);

  useEffect(() => () => audioRef.current?.pause(), []);

  const music = useMemo<MusicState>(
    () => ({ ...prefs, playing, current, duration, toggle, seek, setPrefs }),
    [prefs, playing, current, duration, toggle, seek, setPrefs],
  );

  const value: PanelContextValue = {
    profile,
    setProfile,
    settings,
    draft,
    setDraft,
    persistTheme,
    persistSettings,
    mode,
    toggleMode,
    clearModeOverride,
    team,
    setTeam,
    servers,
    setServers,
    upsertServer,
    userCount,
    isAdmin,
    view,
    setView,
    settingsTab,
    setSettingsTab,
    openServerId,
    openServer,
    sidebarCollapsed,
    toggleCollapsed,
    mobileOpen,
    setMobileOpen,
    refresh,
    signOut,
    music,
  };

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}
