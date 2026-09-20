import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  CloudUpload,
  Download,
  Eye,
  Film,
  Globe,
  Heart,
  Image as ImageIcon,
  Link2,
  MonitorCog,
  Moon,
  Play,
  RefreshCw,
  ShieldCheck,
  Sun,
  Trash2,
  Waves as WavesIcon,
} from "lucide-react";
import { SHADER_VARIANTS, parseShaderWallpaper, shaderWallpaperValue } from "@/lib/panel/shader-catalog";
import { ShaderBackground } from "../shader-background";
import { addMedia, addMusicTrack, deleteMedia, deleteMusicTrack, fetchWallpaperCatalog } from "@/lib/panel/server";
import { usePanelUi } from "@/lib/panel/store";
import { DEFAULT_THEME, type SettingsTab } from "@/lib/panel/types";
import { WALLPAPER_CATEGORIES, type WallpaperCatalogResult } from "@/lib/panel/wallpaper-catalog";
import { applyTheme } from "@/lib/panel/theme";
import { compressImageFile } from "@/lib/utils";
import { playSfx, setSfxEnabled, setSfxVolume, useSfxSettings } from "@/lib/panel/sfx";
import { usePanel } from "../context";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "appearance", label: "Appearance" },
  { id: "wallpapers", label: "4K Wallpapers" },
  { id: "music", label: "Music" },
  { id: "bars", label: "Bars" },
  { id: "access", label: "Access" },
];

export function SettingsView() {
  const { settingsTab, setSettingsTab } = usePanelUi();
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[22px] font-extrabold tracking-tight">Settings Management</h2>
        <p className="mt-1 text-[13px] font-semibold text-steel">
          Configure your panel, appearance, integrations, and runtime defaults.
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={[
              "min-h-11 rounded-full px-4 text-[13px] font-extrabold",
              settingsTab === tab.id ? "bg-[var(--accent)] text-white" : "bg-white/6 text-steel",
            ].join(" ")}
            onClick={() => setSettingsTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {settingsTab === "general" ? <GeneralPanel /> : null}
      {settingsTab === "appearance" ? <AppearancePanel /> : null}
      {settingsTab === "wallpapers" ? <WallpaperPanel /> : null}
      {settingsTab === "music" ? <MusicPanel /> : null}
      {settingsTab === "bars" ? <BarsPanel /> : null}
      {settingsTab === "access" ? <AccessPanel /> : null}
    </div>
  );
}

function GeneralPanel() {
  const { settings, persistGeneral } = usePanel();
  const [form, setForm] = useState({
    panelName: settings.panelName,
    panelSubtitle: settings.panelSubtitle,
    faviconTitle: settings.faviconTitle,
    panelLogo: settings.panelLogo,
    faviconLogo: settings.faviconLogo,
    welcomeTitle: settings.welcomeTitle,
    welcomeMessage: settings.welcomeMessage,
  });
  const [busy, setBusy] = useState(false);

  async function onLogoUpload(key: "panelLogo" | "faviconLogo", file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    try {
      const dataUrl = await compressImageFile(file, 256, 0.9);
      setForm((f) => ({ ...f, [key]: dataUrl }));
      toast.success("Image added — press Save to apply.");
    } catch {
      toast.error("Could not read that image.");
    }
  }

  return (
    <div className="glass p-5">
      <h3 className="text-[16px] font-extrabold">Branding &amp; Identity</h3>
      <p className="mt-1 text-[13px] font-semibold text-steel">
        Panel name, browser tab title, logos, and the Home welcome copy.
      </p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Panel Name">
          <input className="panel-input" value={form.panelName} onChange={(e) => setForm({ ...form, panelName: e.target.value })} />
        </Field>
        <Field label="Favicon Title Name">
          <input
            className="panel-input"
            value={form.faviconTitle}
            placeholder={form.panelName || "BT Panel"}
            onChange={(e) => setForm({ ...form, faviconTitle: e.target.value })}
          />
        </Field>
        <Field label="Panel Logo (URL or Upload)" className="md:col-span-2">
          <div className="flex items-center gap-2">
            {form.panelLogo ? <img src={form.panelLogo} alt="" className="size-9 shrink-0 rounded-[8px] border border-white/15 object-contain" /> : null}
            <input
              className="panel-input"
              value={form.panelLogo}
              placeholder="https://example.com/logo.png"
              onChange={(e) => setForm({ ...form, panelLogo: e.target.value })}
            />
            <label className="btn-accent shrink-0 cursor-pointer whitespace-nowrap">
              Upload Logo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void onLogoUpload("panelLogo", e.target.files?.[0])} />
            </label>
          </div>
        </Field>
        <Field label="Favicon Logo (URL or Upload)" className="md:col-span-2">
          <div className="flex items-center gap-2">
            {form.faviconLogo ? <img src={form.faviconLogo} alt="" className="size-9 shrink-0 rounded-[8px] border border-white/15 object-contain" /> : null}
            <input
              className="panel-input"
              value={form.faviconLogo}
              placeholder="https://example.com/favicon.png"
              onChange={(e) => setForm({ ...form, faviconLogo: e.target.value })}
            />
            <label className="btn-accent shrink-0 cursor-pointer whitespace-nowrap">
              Upload Favicon
              <input type="file" accept="image/*" className="hidden" onChange={(e) => void onLogoUpload("faviconLogo", e.target.files?.[0])} />
            </label>
          </div>
        </Field>
        <Field label="Subtitle">
          <input className="panel-input" value={form.panelSubtitle} onChange={(e) => setForm({ ...form, panelSubtitle: e.target.value })} />
        </Field>
        <Field label="Welcome heading">
          <input className="panel-input" value={form.welcomeTitle} onChange={(e) => setForm({ ...form, welcomeTitle: e.target.value })} />
        </Field>
        <Field label="Welcome message" className="md:col-span-2">
          <textarea
            className="panel-input min-h-[88px] resize-y"
            value={form.welcomeMessage}
            onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-5 rounded-[14px] border border-dashed border-white/15 p-4">
        <div className="text-[11px] font-extrabold tracking-[0.12em] text-steel uppercase">Live preview</div>
        <div className="mt-2 text-[18px] font-extrabold">{form.welcomeTitle}</div>
        <p className="mt-1 text-[13px] font-semibold text-steel">{form.welcomeMessage}</p>
      </div>
      <button
        type="button"
        className="btn-accent mt-5"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void persistGeneral(form).finally(() => setBusy(false));
        }}
      >
        {busy ? "Saving…" : "Save General"}
      </button>
    </div>
  );
}

function AppearancePanel() {
  const { draft, setDraft, persistTheme, media, setMedia } = usePanel();
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const persistRef = useRef(persistTheme);
  persistRef.current = persistTheme;
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(saveTimer.current), []);

  // Sliders preview live via setDraft; with auto-save on, persist quietly
  // (debounced) so dragging a slider doesn't spam requests or toasts.
  function onGlassChange(patch: Parameters<typeof setDraft>[0]) {
    setDraft(patch);
    if (!autoSave) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persistRef.current({ silent: true }).catch(() => undefined);
    }, 700);
  }

  async function onUpload(file?: File) {
    if (!file) return;
    try {
      const isVideo = file.type.startsWith("video/");
      if (isVideo) {
        toast.error("Video backgrounds need a direct HTTPS URL in this hosted panel.");
        return;
      }
      const dataUrl = await compressImageFile(file, 1600, 0.8);
      const next = await addMedia({ data: { name: file.name, url: dataUrl, kind: "image" } });
      setMedia(next);
      setDraft({ wallpaperUrl: dataUrl });
      toast.success("Background uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className="glass p-5">
      <h3 className="text-[16px] font-extrabold">Panel Appearance & Glassmorphism</h3>
      <p className="mt-1 text-[13px] font-semibold text-steel">
        Customize background, glassmorphism blur, transparency, and panel colors.
      </p>
      <div className="mt-4">
        <div className="text-[13px] font-extrabold">Base Theme</div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            { id: "dark" as const, label: "Dark", hint: "classic night palette", icon: Moon },
            { id: "oled" as const, label: "OLED Black", hint: "pure #000000", icon: MonitorCog },
            { id: "light" as const, label: "Light", hint: "bright day palette", icon: Sun },
          ].map((option) => {
            const active = draft.mode === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={[
                  "flex items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 ring-2 ring-[var(--accent-glow)]"
                    : "border-white/10 bg-white/4 hover:border-white/25",
                ].join(" ")}
                onClick={() => setDraft({ mode: option.id })}
              >
                <option.icon className={`size-4.5 shrink-0 ${active ? "text-[var(--accent)]" : "text-steel"}`} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold">{option.label}</span>
                  <span className="block truncate text-[10.5px] font-semibold text-steel">{option.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] font-semibold text-steel">
          Panel-wide palette for everyone. Any user can still flip themselves dark↔light with the header sun/moon button.
        </p>
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(280px,1.05fr)]">
        <div>
          <div className="text-[13px] font-extrabold">Background Media</div>
          <label
            className="mt-3 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed border-white/20 bg-black/20 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onUpload(e.dataTransfer.files[0]);
            }}
          >
            <span className="text-[14px] font-extrabold">Click or drag to upload</span>
            <span className="mt-1 text-[12px] font-semibold text-steel">PNG or JPEG, compressed for the panel</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void onUpload(e.target.files?.[0])} />
          </label>
          {media.length > 0 ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {media.map((file) => (
                <div key={file.id} className="relative">
                  <button type="button" className="wallpaper-tile w-full" onClick={() => setDraft({ wallpaperUrl: file.url })}>
                    {file.kind === "image" ? <img src={file.url} alt="" /> : <div className="grid size-full place-items-center text-[11px]">Video</div>}
                  </button>
                  <button
                    type="button"
                    className="absolute top-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold"
                    onClick={() => {
                      void deleteMedia({ data: { id: file.id } })
                        .then(setMedia)
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-4">
            <div className="text-[12px] font-bold text-steel">External Image / Video URL</div>
            <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
              <input className="panel-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://images.unsplash.com/..." />
              <button
                type="button"
                className="btn-accent shrink-0"
                onClick={() => {
                  if (!url.trim()) return;
                  setDraft({ wallpaperUrl: url.trim() });
                  toast.success("Background URL applied");
                }}
              >
                Apply URL
              </button>
            </div>
          </div>
          <label className="mt-5 flex items-center justify-between gap-3 rounded-[12px] border border-white/10 px-3 py-3">
            <span className="text-[13px] font-bold">Show Team</span>
            <input
              type="checkbox"
              checked={draft.showTeam}
              onChange={(e) => setDraft({ showTeam: e.target.checked })}
            />
          </label>
        </div>
        <div className="grid gap-4">
          <Slider label="Background Blur" value={draft.bgBlur} max={100} suffix="px" onChange={(v) => setDraft({ bgBlur: v })} />
          <Slider label="Background Opacity" value={draft.bgOpacity} max={100} suffix="%" onChange={(v) => setDraft({ bgOpacity: v })} />
          <Color label="Accent Color" value={draft.accentColor} onChange={(v) => setDraft({ accentColor: v })} />
          <Color label="Glass Tint" value={draft.glassTint} hint="Base color for glassmorphism panels" onChange={(v) => setDraft({ glassTint: v })} />
          <Slider label="Glass Opacity" value={draft.glassOpacity} max={100} suffix="%" hint="0% = fully transparent, 100% = full tint" onChange={(v) => setDraft({ glassOpacity: v })} />
          <Color label="Nav Text" value={draft.navText} hint="Sidebar inactive item text" onChange={(v) => setDraft({ navText: v })} />
          <Color label="Nav Text Active" value={draft.navTextActive} hint="Sidebar active item text" onChange={(v) => setDraft({ navTextActive: v })} />
          <Slider label="Glass Blur" value={draft.glassBlur} max={40} suffix="px" onChange={(v) => setDraft({ glassBlur: v })} />
          <Slider label="Border Radius" value={draft.borderRadius} max={24} suffix="px" onChange={(v) => setDraft({ borderRadius: v })} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-accent"
              disabled={saving}
              onClick={() => {
                setSaving(true);
                void persistTheme().finally(() => setSaving(false));
              }}
            >
              {saving ? "Saving…" : "Save Theme"}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setDraft(DEFAULT_THEME);
                applyTheme(DEFAULT_THEME);
              }}
            >
              Reset to Default
            </button>
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-[14px] border border-white/12 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-[14px] font-extrabold">Glassmorphism, Transparency &amp; Blur Sliders</h4>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-bold">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Auto-save changes
          </label>
        </div>
        <GlassSlider
          label="Card Transparency Bar"
          value={draft.glassOpacity}
          min={0}
          max={100}
          unit="%"
          ticks={["0% (Solid Dark)", "50% (Balanced Glass)", "100% (Ultra Clear)"]}
          onChange={(v) => onGlassChange({ glassOpacity: v })}
        />
        <GlassSlider
          label="Backdrop Blur Bar"
          value={draft.glassBlur}
          min={0}
          max={40}
          unit="px"
          ticks={["0px (No Blur)", "20px (Frost Glass)", "40px (Heavy Cyber Blur)"]}
          onChange={(v) => onGlassChange({ glassBlur: v })}
        />
        {!autoSave ? (
          <button
            type="button"
            className="btn-accent mt-4"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              void persistTheme().finally(() => setSaving(false));
            }}
          >
            {saving ? "Saving…" : "Save Appearance"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function GlassSlider({
  label,
  value,
  min,
  max,
  unit,
  ticks,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  ticks: [string, string, string];
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12.5px] font-bold">
          <span className="text-ice">{label}:</span>{" "}
          <span className="text-[var(--accent)]">
            {min}
            {unit}
          </span>{" "}
          <span className="text-[var(--accent)] opacity-60">|----------------</span>{" "}
          <span className="text-[var(--accent)]">
            {max}
            {unit}
          </span>
        </div>
        <span className="rounded-md border border-white/15 bg-black/40 px-2 py-0.5 text-[12px] font-extrabold text-[var(--accent)]">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        className="range-input mt-2"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-steel">
        <span>{ticks[0]}</span>
        <span className="text-center">{ticks[1]}</span>
        <span className="text-right">{ticks[2]}</span>
      </div>
    </div>
  );
}

const WALLPAPER_FAV_KEY = "btpanel.wallpaper-favorites";

type WallpaperFavorite = { id: string; title: string; thumb: string; full: string };

function loadWallpaperFavorites(): WallpaperFavorite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WALLPAPER_FAV_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is WallpaperFavorite =>
        Boolean(x) && typeof (x as WallpaperFavorite).id === "string" && typeof (x as WallpaperFavorite).full === "string",
    );
  } catch {
    return [];
  }
}

function detectMediaType(url: string): string {
  const u = url.trim();
  if (!u) return "—";
  if (/^shader:/i.test(u)) return "Live Shader";
  if (/^data:video\//i.test(u) || /\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(u)) return "Video";
  if (/^data:image\//i.test(u) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(u)) return "Image";
  return "Image (assumed)";
}

type EngineMode = "catalog" | "upload" | "url" | "favorites" | "shaders";

const MODE_TABS: { id: EngineMode; label: (favCount: number) => string }[] = [
  { id: "catalog", label: () => "4K Wallpapers" },
  { id: "upload", label: () => "Upload Media" },
  { id: "url", label: () => "Custom URL" },
  { id: "favorites", label: (n) => `Favorites ( ${n} )` },
  { id: "shaders", label: () => "Live Shaders" },
];

function WallpaperPanel() {
  const { draft, setDraft, persistTheme, media, setMedia } = usePanel();
  const [mode, setMode] = useState<EngineMode>("catalog");
  const [favorites, setFavorites] = useState<WallpaperFavorite[]>(() => loadWallpaperFavorites());
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [customUrl, setCustomUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<{
    loading: boolean;
    result: WallpaperCatalogResult | null;
    error: string;
  }>({ loading: true, result: null, error: "" });

  // Persist favorites (browser-local so they survive the panel's in-memory DB resets).
  useEffect(() => {
    try {
      window.localStorage.setItem(WALLPAPER_FAV_KEY, JSON.stringify(favorites));
    } catch {
      /* storage unavailable */
    }
  }, [favorites]);

  // Debounce the search box so typing doesn't fire a scrape per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 450);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery]);

  const [fetchTick, setFetchTick] = useState(0);
  useEffect(() => {
    if (mode !== "catalog") return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    const fetchPromise = fetchWallpaperCatalog({ data: { category, page, query: debouncedQuery } });
    // Watchdog: if the RPC call ever hangs (dropped response over a preview
    // relay / dead socket), resolve to the honest "unavailable" state instead
    // of leaving the spinner up forever. Never fabricate entries.
    const watchdog = new Promise<"timeout">((resolve) => {
      window.setTimeout(() => resolve("timeout"), 25000);
    });
    void Promise.race([fetchPromise.then(() => "ok" as const), watchdog]).then((verdict) => {
      if (!cancelled && verdict === "timeout") {
        setState({
          loading: false,
          result: null,
          error: "The wallpaper catalog request did not respond in time — check the server connection and try again.",
        });
      }
    });
    fetchPromise
      .then((result) => {
        if (!cancelled) setState({ loading: false, result, error: "" });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            loading: false,
            result: null,
            error: err instanceof Error ? err.message : "Failed to load wallpapers.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, category, page, debouncedQuery, fetchTick]);

  const result = state.result;
  const categories = result?.categories?.length ? result.categories : WALLPAPER_CATEGORIES;
  const favoriteIds = new Set(favorites.map((f) => f.id));

  function toggleFavorite(item: WallpaperFavorite) {
    setFavorites((current) =>
      current.some((f) => f.id === item.id) ? current.filter((f) => f.id !== item.id) : [...current, item],
    );
  }

  function previewWallpaper(url: string, title: string) {
    setDraft({ wallpaperUrl: url });
    toast.success(`Previewing ${title} — Apply to keep it`);
  }

  function applyWallpaper(url: string, title: string) {
    setDraft({ wallpaperUrl: url });
    void persistTheme().catch(() => undefined);
    toast.success(`Applied ${title}`);
  }

  async function onImageUpload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (JPG, PNG, WEBP, GIF).");
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await compressImageFile(file, 1600, 0.8);
      const next = await addMedia({ data: { name: file.name, url: dataUrl, kind: "image" } });
      setMedia(next);
      setDraft({ wallpaperUrl: dataUrl });
      toast.success(`${file.name} uploaded and applied`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function onVideoUpload() {
    // Videos as data URLs don't fit the panel's embedded settings row — be honest.
    toast.error("Video files are too large for the embedded panel store — host the file and paste it under Custom URL.");
    setMode("url");
  }

  const modeIcon = {
    catalog: Globe,
    upload: CloudUpload,
    url: Link2,
    favorites: Heart,
    shaders: WavesIcon,
  } as const;

  return (
    <div className="glass p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h3 className="flex items-center gap-2 text-[16px] font-extrabold">
            <ImageIcon className="size-4 text-[var(--accent)]" />
            Panel Background Engine
          </h3>
          <p className="mt-1 text-[13px] font-semibold text-steel">
            Select from 4KWallpapers.com, upload your own video/image, or add via URL.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MODE_TABS.map((tab) => {
            const Icon = modeIcon[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                className={[
                  "flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-extrabold whitespace-nowrap",
                  mode === tab.id ? "bg-[var(--accent)] text-white" : "bg-white/6 text-steel",
                ].join(" ")}
                onClick={() => setMode(tab.id)}
              >
                <Icon className="size-3.5" />
                {tab.label(favorites.length)}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "catalog" ? (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              className="panel-input"
              placeholder="Search 4K wallpapers (e.g. Minecraft, Cyberpunk, Nature, Space)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setDebouncedQuery(query.trim());
              }}
            />
            <button type="button" className="btn-accent shrink-0" onClick={() => setDebouncedQuery(query.trim())}>
              Search
            </button>
            <select
              className="panel-input shrink-0 sm:w-48"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="scrollbar-thin mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {categories.slice(0, 7).map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={[
                  "min-h-10 shrink-0 rounded-full px-3 text-[12px] font-extrabold whitespace-nowrap",
                  category === cat.id ? "bg-[var(--accent)] text-white" : "bg-white/6 text-steel",
                ].join(" ")}
                onClick={() => {
                  setCategory(cat.id);
                  setPage(1);
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
          {result?.note ? <p className="mt-3 text-[12px] font-semibold text-warn">{result.note}</p> : null}
          {state.error ? <p className="mt-3 text-[13px] font-semibold text-danger">{state.error}</p> : null}
          {state.error ? (
            <button type="button" className="btn-ghost mt-2 inline-flex items-center gap-1.5" onClick={() => setFetchTick((t) => t + 1)}>
              <RefreshCw className="size-3.5" />
              Retry
            </button>
          ) : null}
          <div className="relative mt-4 min-h-[180px]">
            {state.loading ? (
              <div className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-black/30 text-[13px] font-bold text-steel">
                Loading wallpapers…
              </div>
            ) : null}
            {result && result.wallpapers.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {result.wallpapers.map((item) => {
                  const isFav = favoriteIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className="wallpaper-tile"
                      role="button"
                      tabIndex={0}
                      onClick={() => applyWallpaper(item.full, item.title)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") applyWallpaper(item.full, item.title);
                      }}
                    >
                      <img src={item.thumb} alt={item.title} loading="lazy" />
                      <span className="absolute top-1.5 right-1.5 flex gap-1">
                        <span
                          role="button"
                          tabIndex={-1}
                          className={[
                            "grid size-7 place-items-center rounded-md border border-white/15 bg-black/55",
                            isFav ? "text-danger" : "text-steel hover:text-ice",
                          ].join(" ")}
                          title={isFav ? "Remove from favorites" : "Save to favorites"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite({ id: item.id, title: item.title, thumb: item.thumb, full: item.full });
                          }}
                        >
                          <Heart className={isFav ? "size-3.5 fill-current" : "size-3.5"} />
                        </span>
                        <a
                          href={item.full}
                          target="_blank"
                          rel="noreferrer"
                          className="grid size-7 place-items-center rounded-md border border-white/15 bg-black/55 text-steel hover:text-ice"
                          title="Open full size"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download className="size-3.5" />
                        </a>
                      </span>
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 text-left text-[12px] font-extrabold">
                        {item.title}
                      </span>
                      <span className="absolute right-1.5 bottom-1.5 rounded-sm bg-[var(--accent)] px-1 text-[9px] font-extrabold text-white">
                        4K
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
            {result && !state.loading && result.wallpapers.length === 0 ? (
              <p className="py-8 text-center text-[13px] font-semibold text-steel">
                {result.note ? "Live catalog unavailable right now." : "No wallpapers found — try another search or category."}
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className="btn-ghost"
              disabled={state.loading || !(result?.hasPrev ?? page > 1)}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="rounded-md border border-white/15 bg-black/40 px-3 py-1 text-[12px] font-bold text-steel">
              Page {result?.page ?? page}
            </span>
            <button
              type="button"
              className="btn-ghost"
              disabled={state.loading || !result?.hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}

      {mode === "upload" ? (
        <div className="mt-4">
          <label
            className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-[16px] border border-dashed border-white/20 bg-black/20 p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onImageUpload(e.dataTransfer.files[0]);
            }}
          >
            <span className="grid size-14 place-items-center rounded-2xl border border-white/15 bg-black/40 text-[var(--accent)]">
              <CloudUpload className="size-6" />
            </span>
            <span className="mt-3 text-[15px] font-extrabold">Upload Custom Background Media</span>
            <span className="mt-1 max-w-md text-[12px] font-semibold text-steel">
              Supports high-resolution images (JPG, PNG, WEBP, GIF) — videos are applied via Custom URL (MP4, WEBM).
            </span>
            <span className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="btn-accent">
                <ImageIcon className="size-4" />
                {uploading ? "Uploading…" : "Choose Image File"}
              </span>
              <span className="btn-ghost">
                <Film className="size-4" />
                Choose Video File (.mp4, .webm)
              </span>
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => void onImageUpload(e.target.files?.[0])} />
          </label>
          <button type="button" className="mt-2 text-[12px] font-bold text-steel underline-offset-4 hover:underline" onClick={onVideoUpload}>
            Have a video file? Host it and use Custom URL →
          </button>
          {media.length > 0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {media.map((file) => (
                <div key={file.id} className="relative">
                  <button type="button" className="wallpaper-tile w-full" onClick={() => applyWallpaper(file.url, file.name)}>
                    {file.kind === "image" ? <img src={file.url} alt="" /> : <div className="grid size-full place-items-center text-[11px]">Video</div>}
                  </button>
                  <button
                    type="button"
                    className="absolute top-1 right-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-bold"
                    onClick={() => {
                      void deleteMedia({ data: { id: file.id } })
                        .then(setMedia)
                        .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "url" ? (
        <div className="mt-4 rounded-[14px] border border-white/10 bg-black/20 p-4">
          <div className="text-[13px] font-extrabold">Direct Media URL (Image or Video)</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="panel-input"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="https://example.com/wallpaper.jpg or https://example.com/motion-loop.mp4"
            />
            <button
              type="button"
              className="btn-ghost shrink-0"
              disabled={!customUrl.trim()}
              onClick={() => previewWallpaper(customUrl.trim(), "custom URL")}
            >
              <Eye className="size-4" /> Test &amp; Live Preview
            </button>
            <button
              type="button"
              className="btn-accent shrink-0"
              disabled={!customUrl.trim()}
              onClick={() => applyWallpaper(customUrl.trim(), "custom URL")}
            >
              <Check className="size-4" /> Apply
            </button>
          </div>
          <div className="mt-2 text-[12px] font-semibold text-steel">
            Detected type: <span className="text-ice">{detectMediaType(customUrl)}</span>
            <span className="mx-2">·</span>Works with MP4, WEBM, JPG, PNG, WEBP URLs
          </div>
        </div>
      ) : null}

      {mode === "favorites" ? (
        <div className="mt-4">
          {favorites.length === 0 ? (
            <div className="grid min-h-[180px] place-items-center rounded-[16px] border border-white/10 bg-black/20 p-6 text-center">
              <div>
                <Heart className="mx-auto size-8 text-danger/70" />
                <div className="mt-3 text-[14px] font-extrabold">No favorite wallpapers saved yet.</div>
                <p className="mt-1 text-[12px] font-semibold text-steel">
                  Click the heart icon on any wallpaper in the 4K browser to save it here!
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {favorites.map((fav) => (
                <div key={fav.id}>
                  <div className="wallpaper-tile">
                    <img src={fav.thumb} alt={fav.title} loading="lazy" />
                    <span className="absolute top-1.5 right-1.5 flex gap-1">
                      <span
                        role="button"
                        tabIndex={-1}
                        className="grid size-7 place-items-center rounded-md border border-white/15 bg-black/55 text-danger"
                        title="Remove from favorites"
                        onClick={() => toggleFavorite(fav)}
                      >
                        <Trash2 className="size-3.5" />
                      </span>
                      <a
                        href={fav.full}
                        target="_blank"
                        rel="noreferrer"
                        className="grid size-7 place-items-center rounded-md border border-white/15 bg-black/55 text-steel hover:text-ice"
                        title="Open full size"
                      >
                        <Download className="size-3.5" />
                      </a>
                    </span>
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 text-left text-[12px] font-extrabold">
                      {fav.title}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="btn-ghost min-h-9 flex-1 text-[11px]" onClick={() => previewWallpaper(fav.full, fav.title)}>
                      <Eye className="size-3.5" /> Live Preview
                    </button>
                    <button type="button" className="btn-accent min-h-9 flex-1 text-[11px]" onClick={() => applyWallpaper(fav.full, fav.title)}>
                      <Check className="size-3.5" /> Apply
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {mode === "shaders" ? (
        <div className="mt-4">
          <p className="text-[12.5px] font-semibold text-steel">
            Animated WebGL backgrounds rendered live in your panel, tinted by the current Accent Color — no image
            files, always sharp. Preview flips the whole panel instantly.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <button
                type="button"
                className={[
                  "relative grid aspect-[16/10] w-full place-items-center overflow-hidden rounded-[12px] border bg-black/40",
                  !draft.wallpaperUrl ? "border-[var(--accent)]/70 ring-2 ring-[var(--accent-glow)]" : "border-white/10 hover:border-white/30",
                ].join(" ")}
                onClick={() => previewWallpaper("", "no background")}
              >
                <span className="text-[12px] font-extrabold text-steel">Off / Default Gradient</span>
              </button>
              <div className="mt-2 flex gap-2">
                <button type="button" className="btn-ghost min-h-9 flex-1 text-[11px]" onClick={() => previewWallpaper("", "no background")}>
                  <Eye className="size-3.5" /> Live Preview
                </button>
                <button
                  type="button"
                  className="btn-accent min-h-9 flex-1 text-[11px]"
                  onClick={() => applyWallpaper("", "the default background")}
                >
                  <Check className="size-3.5" /> Apply
                </button>
              </div>
            </div>
            {SHADER_VARIANTS.map((variant) => {
              const value = shaderWallpaperValue(variant.id);
              const active = parseShaderWallpaper(draft.wallpaperUrl) === variant.id;
              return (
                <div key={variant.id}>
                  <div
                    className={[
                      "relative aspect-[16/10] w-full overflow-hidden rounded-[12px] border",
                      active ? "border-[var(--accent)]/70 ring-2 ring-[var(--accent-glow)]" : "border-white/10",
                    ].join(" ")}
                  >
                    <ShaderBackground variant={variant.id} />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-2 text-left">
                      <span className="block text-[12px] font-extrabold">{variant.name}</span>
                      <span className="block text-[10px] font-semibold text-steel">{variant.description}</span>
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost min-h-9 flex-1 text-[11px]"
                      onClick={() => previewWallpaper(value, variant.name)}
                    >
                      <Eye className="size-3.5" /> Live Preview
                    </button>
                    <button
                      type="button"
                      className="btn-accent min-h-9 flex-1 text-[11px]"
                      onClick={() => applyWallpaper(value, variant.name)}
                    >
                      <Check className="size-3.5" /> Apply
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MusicPanel() {
  const { settings, tracks, setTracks, setSettings, persistMusic } = usePanel();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const sfx = useSfxSettings();

  return (
    <div className="glass p-5">
      <h3 className="text-[16px] font-extrabold">Music studio</h3>
      <p className="mt-1 text-[13px] font-semibold text-steel">
        Ambient music and subtle interface feedback for buttons, navigation, and alerts.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Toggle label="Enabled" checked={settings.enabled} onChange={(enabled) => void persistMusic({ enabled })} />
        <Toggle label="Autoplay" checked={settings.autoplay} onChange={(autoplay) => void persistMusic({ autoplay })} />
        <Toggle label="Loop" checked={settings.loop} onChange={(loop) => void persistMusic({ loop })} />
        <Slider
          label="Volume"
          value={Math.round(settings.volume * 100)}
          max={100}
          suffix="%"
          onChange={(v) => setSettings({ ...settings, volume: v / 100 })}
          onCommit={(v) => void persistMusic({ volume: v / 100 })}
        />
      </div>
      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="mb-3">
          <div className="text-[14px] font-extrabold">Interface sound effects</div>
          <div className="mt-1 text-[12px] font-semibold text-steel">
            Short WebAudio blips generated on-device (no audio files) for buttons, sidebar navigation, and
            success / danger actions. Stored locally per browser.
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="SFX enabled" checked={sfx.enabled} onChange={setSfxEnabled} />
          <Slider
            label="SFX volume"
            value={Math.round(sfx.volume * 100)}
            max={100}
            suffix="%"
            onChange={(value) => setSfxVolume(value / 100)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["click", "Test: Click"],
              ["navigate", "Test: Navigation"],
              ["success", "Test: Success"],
              ["danger", "Test: Danger"],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className="btn-ghost min-h-10 text-[12px]"
              data-sfx-ignore="true"
              onClick={() => playSfx(kind, true)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-[1fr_1.4fr_auto]">
        <input className="panel-input" placeholder="Track name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="panel-input" placeholder="https://example.com/track.mp3" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button
          type="button"
          className="btn-accent"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void addMusicTrack({ data: { name, url } })
              .then((result) => {
                setTracks(result.tracks);
                setSettings(result.settings);
                setName("");
                setUrl("");
                toast.success("Track added");
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"))
              .finally(() => setBusy(false));
          }}
        >
          Add URL
        </button>
      </div>
      <div className="mt-4 grid gap-2">
        {tracks.length === 0 ? (
          <p className="py-6 text-center text-[13px] font-semibold text-steel">No tracks yet. Add an MP3, WAV, or OGG URL.</p>
        ) : (
          tracks.map((track) => (
            <div key={track.id} className="flex flex-col gap-2 rounded-[12px] border border-white/10 px-3 py-3 sm:flex-row sm:items-center">
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => void persistMusic({ selectedTrackId: track.id, enabled: true })}
              >
                <div className="truncate text-[13px] font-extrabold">{track.name}</div>
                <div className="truncate text-[11px] font-semibold text-steel">
                  {track.source === "bundled" ? "Included ambient track" : track.url}
                </div>
              </button>
              <div className="flex gap-2">
                {settings.selectedTrackId === track.id ? (
                  <span className="grid min-h-10 place-items-center rounded-full bg-[var(--accent)] px-3 text-[11px] font-extrabold text-white">
                    Selected
                  </span>
                ) : (
                  <button type="button" className="btn-ghost min-h-10 text-[12px]" onClick={() => void persistMusic({ selectedTrackId: track.id })}>
                    Select
                  </button>
                )}
                {track.source !== "bundled" ? <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    void deleteMusicTrack({ data: { id: track.id } })
                      .then((result) => {
                        setTracks(result.tracks);
                        setSettings(result.settings);
                      })
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed"));
                  }}
                >
                  Delete
                </button> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function BarsPanel() {
  const { settings, persistBars } = usePanel();
  const [form, setForm] = useState({
    showAdminStats: settings.showAdminStats,
    showVersion: settings.showVersion,
    showRole: settings.showRole,
    showHeaderUser: settings.showHeaderUser,
  });

  return (
    <div className="glass p-5">
      <h3 className="text-[16px] font-extrabold">Home indicators</h3>
      <p className="mt-1 text-[13px] font-semibold text-steel">Choose which Home dashboard indicators are shown.</p>
      <div className="mt-5 grid gap-2">
        <Toggle label="Admin statistics" checked={form.showAdminStats} onChange={(showAdminStats) => setForm({ ...form, showAdminStats })} />
        <Toggle label="Panel version card" checked={form.showVersion} onChange={(showVersion) => setForm({ ...form, showVersion })} />
        <Toggle label="Signed-in role phrase" checked={form.showRole} onChange={(showRole) => setForm({ ...form, showRole })} />
        <Toggle label="Top-header account control" checked={form.showHeaderUser} onChange={(showHeaderUser) => setForm({ ...form, showHeaderUser })} />
      </div>
      <button type="button" className="btn-accent mt-5" onClick={() => void persistBars(form)}>
        Save Bars
      </button>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={["block text-[12px] font-bold text-steel", className].filter(Boolean).join(" ")}>
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function Slider({
  label,
  value,
  max,
  suffix,
  hint,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  suffix: string;
  hint?: string;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-[12px] font-bold text-steel">
        <span>{label}</span>
        <span className="font-mono text-ice">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        className="range-input mt-2"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit ? (e) => onCommit(Number((e.target as HTMLInputElement).value)) : undefined}
        onTouchEnd={onCommit ? (e) => onCommit(Number((e.target as HTMLInputElement).value)) : undefined}
      />
      {hint ? <div className="mt-1 text-[11px] font-semibold text-white/40">{hint}</div> : null}
    </label>
  );
}

function Color({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(value || "") ? value : "#0a0c14";
  return (
    <label className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[12px] font-bold text-steel">{label}</div>
        {hint ? <div className="text-[11px] font-semibold text-white/40">{hint}</div> : null}
      </div>
      <input
        type="color"
        value={safe}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-14 cursor-pointer rounded-md border border-white/10 bg-transparent"
      />
    </label>
  );
}

function AccessPanel() {
  const { settings, persistAccess } = usePanel();
  const [form, setForm] = useState({
    allowRegistration: settings.allowRegistration,
    tutorialsEnabled: settings.tutorialsEnabled,
    onboardingTour: settings.onboardingTour,
  });
  const [busy, setBusy] = useState(false);

  const rows: {
    key: keyof typeof form;
    title: string;
    description: string;
    badge: boolean;
  }[] = [
    {
      key: "allowRegistration",
      title: "Public User Self-Registration",
      description: "Allow visitors to register new user accounts from the sign up page",
      badge: false,
    },
    {
      key: "tutorialsEnabled",
      title: "Auto Tutorials Page",
      description: "Enable or disable the interactive Auto Tutorials page in the client portal",
      badge: true,
    },
    {
      key: "onboardingTour",
      title: "Auto-Start Onboarding Tour",
      description:
        "Automatically trigger the interactive spotlight walkthrough for newly registered users on first login",
      badge: true,
    },
  ];

  return (
    <div className="glass p-5">
      <h3 className="flex items-center gap-2 text-[16px] font-extrabold">
        <ShieldCheck className="size-4 text-[var(--accent)]" />
        Access &amp; Feature Toggles
      </h3>
      <div className="mt-4 divide-y divide-white/8 rounded-[14px] border border-white/10">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 px-4 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[14px] font-extrabold">
                {row.title}
                {row.badge ? (
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                      form[row.key] ? "bg-ok/20 text-ok" : "bg-white/10 text-steel",
                    ].join(" ")}
                  >
                    {form[row.key] ? "Active (ON)" : "Disabled"}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[12px] font-semibold text-steel">{row.description}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {row.key === "onboardingTour" ? (
                <button
                  type="button"
                  className="btn-accent flex min-h-9 items-center gap-1.5 rounded-[9px] px-3 text-[12px]"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("btpanel:start-tour"));
                    toast.success("Onboarding tour started");
                  }}
                >
                  <Play className="size-3.5" /> Test Tour
                </button>
              ) : null}
              <SwitchToggle checked={form[row.key]} onChange={(v) => setForm({ ...form, [row.key]: v })} />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn-accent mt-5"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void persistAccess(form).finally(() => setBusy(false));
        }}
      >
        {busy ? "Saving…" : "Save Access Settings"}
      </button>
    </div>
  );
}

function SwitchToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked ? "border-[var(--accent)] bg-[var(--accent)]" : "border-white/20 bg-white/10",
      ].join(" ")}
      onClick={() => onChange(!checked)}
    >
      <span
        className={[
          "absolute top-1/2 size-4.5 -translate-y-1/2 rounded-full bg-white shadow transition-[left]",
          checked ? "left-[22px]" : "left-[3px]",
        ].join(" ")}
      />
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-[12px] border border-white/10 px-3">
      <span className="text-[13px] font-bold">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
