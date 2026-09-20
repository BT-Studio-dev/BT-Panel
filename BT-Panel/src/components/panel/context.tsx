import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import {
  bootstrapPanel,
  pingPresence,
  saveAccess,
  saveBars,
  saveGeneral,
  saveMusicPrefs,
  saveTheme,
} from "@/lib/panel/server";
import { applyTheme, setLocalModeOverride } from "@/lib/panel/theme";
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
  type PanelSettings,
  type ThemeSettings,
} from "@/lib/panel/types";

type PanelContextValue = {
  loading: boolean;
  error: string | null;
  profile: PanelProfile | null;
  settings: PanelSettings;
  draft: ThemeSettings;
  tracks: MusicTrack[];
  media: MediaFile[];
  team: PanelProfile[];
  userCount: number;
  isAdmin: boolean;
  setDraft: (patch: Partial<ThemeSettings>) => void;
  setSettings: (settings: PanelSettings) => void;
  setTracks: (tracks: MusicTrack[]) => void;
  setMedia: (media: MediaFile[]) => void;
  setTeam: (team: PanelProfile[]) => void;
  setProfile: (profile: PanelProfile) => void;
  refresh: () => Promise<void>;
  persistTheme: (opts?: { silent?: boolean }) => Promise<void>;
  persistGeneral: (general: GeneralSettings) => Promise<void>;
  persistBars: (bars: BarsSettings) => Promise<void>;
  persistAccess: (access: AccessSettings) => Promise<void>;
  persistMusic: (prefs: Partial<MusicPrefs>) => Promise<void>;
};

const PanelContext = createContext<PanelContextValue | null>(null);

function payloadToState(payload: BootstrapPayload) {
  return {
    profile: payload.profile,
    settings: payload.settings,
    tracks: payload.tracks,
    media: payload.media,
    team: payload.team,
    userCount: payload.userCount,
  };
}

export function PanelProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PanelProfile | null>(null);
  const [settings, setSettings] = useState<PanelSettings>(DEFAULT_SETTINGS);
  const [draft, setDraftState] = useState<ThemeSettings>(DEFAULT_SETTINGS);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [team, setTeam] = useState<PanelProfile[]>([]);
  const [userCount, setUserCount] = useState(0);

  const applyPayload = useCallback((payload: BootstrapPayload) => {
    const next = payloadToState(payload);
    setProfile(next.profile);
    setSettings(next.settings);
    setDraftState(next.settings);
    setTracks(next.tracks);
    setMedia(next.media);
    setTeam(next.team);
    setUserCount(next.userCount);
    applyTheme(next.settings);
  }, []);

  const refresh = useCallback(async () => {
    const payload = await bootstrapPanel();
    applyPayload(payload);
  }, [applyPayload]);

  useEffect(() => {
    let cancelled = false;
    void bootstrapPanel()
      .then((payload) => {
        if (cancelled) return;
        applyPayload(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Could not load panel.";
        setError(message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applyPayload]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void pingPresence().catch(() => undefined);
    }, 30_000);
    void pingPresence().catch(() => undefined);
    return () => window.clearInterval(timer);
  }, []);

  const setDraft = useCallback((patch: Partial<ThemeSettings>) => {
    setDraftState((current) => {
      const next = { ...current, ...patch };
      applyTheme(next);
      return next;
    });
  }, []);

  const persistTheme = useCallback(async (opts?: { silent?: boolean }) => {
    // An explicit Save overrides the admin's own personal header toggle —
    // otherwise the freshly-saved base theme wouldn't be visible to them.
    if (!opts?.silent) setLocalModeOverride(null);
    const next = await saveTheme({ data: draft });
    setSettings(next);
    setDraftState(next);
    applyTheme(next);
    if (!opts?.silent) toast.success("Theme saved");
  }, [draft]);

  const persistGeneral = useCallback(async (general: GeneralSettings) => {
    const next = await saveGeneral({ data: general });
    setSettings(next);
    toast.success("General settings saved");
  }, []);

  const persistBars = useCallback(async (bars: BarsSettings) => {
    const next = await saveBars({ data: bars });
    setSettings(next);
    toast.success("Home indicators saved");
  }, []);

  const persistAccess = useCallback(async (access: AccessSettings) => {
    const next = await saveAccess({ data: access });
    setSettings(next);
    toast.success("Access settings saved");
  }, []);

  const persistMusic = useCallback(async (prefs: Partial<MusicPrefs>) => {
    const next = await saveMusicPrefs({ data: prefs });
    setSettings(next);
    toast.success("Music settings saved");
  }, []);

  const value = useMemo<PanelContextValue>(
    () => ({
      loading,
      error,
      profile,
      settings,
      draft,
      tracks,
      media,
      team,
      userCount,
      isAdmin: profile?.role === "owner" || profile?.role === "admin",
      setDraft,
      setSettings,
      setTracks,
      setMedia,
      setTeam,
      setProfile: (next) => setProfile(next),
      refresh,
      persistTheme,
      persistGeneral,
      persistBars,
      persistAccess,
      persistMusic,
    }),
    [
      loading,
      error,
      profile,
      settings,
      draft,
      tracks,
      media,
      team,
      userCount,
      setDraft,
      refresh,
      persistTheme,
      persistGeneral,
      persistBars,
      persistAccess,
      persistMusic,
    ],
  );

  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

export function usePanel() {
  const ctx = useContext(PanelContext);
  if (!ctx) throw new Error("usePanel must be used within PanelProvider");
  return ctx;
}
