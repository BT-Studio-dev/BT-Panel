import { hexToRgb, toHexColor } from "@/lib/utils";
import { DEFAULT_THEME, type ThemeMode, type ThemeSettings } from "./types";

/**
 * Personal header-toggle override (sun/moon button). Any signed-in user can
 * flip the scheme for THEMSELVES without Admin Settings; empty = follow the
 * panel-wide Base Theme set in Settings → Appearance.
 */
export const THEME_MODE_OVERRIDE_KEY = "btpanel.theme-mode-override";

export function getLocalModeOverride(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(THEME_MODE_OVERRIDE_KEY);
    return value === "light" || value === "dark" || value === "oled" ? value : null;
  } catch {
    return null;
  }
}

export function setLocalModeOverride(mode: ThemeMode | null) {
  if (typeof window === "undefined") return;
  try {
    if (mode) window.localStorage.setItem(THEME_MODE_OVERRIDE_KEY, mode);
    else window.localStorage.removeItem(THEME_MODE_OVERRIDE_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function effectiveThemeMode(theme: Pick<ThemeSettings, "mode">): ThemeMode {
  return getLocalModeOverride() ?? (theme.mode ?? DEFAULT_THEME.mode);
}

// Light scheme replaces the admin-picked glass tint / nav colors: dark glass
// tokens would look wrong on a white canvas, so the light palette is fixed.
const LIGHT = { tint: "250 251 254", nav: "#4e5669", navActive: "#13162a" } as const;

export function applyTheme(theme: ThemeSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const mode = effectiveThemeMode(theme);
  root.dataset.themeMode = mode;
  const wallpaper = theme.wallpaperUrl
    ? `url("${theme.wallpaperUrl.replace(/"/g, '\\"')}")`
    : "none";
  const tint = toHexColor(theme.glassTint, DEFAULT_THEME.glassTint);
  const accent = toHexColor(theme.accentColor, DEFAULT_THEME.accentColor);
  root.style.setProperty("--wallpaper-url", wallpaper);
  root.style.setProperty("--bg-blur", `${theme.bgBlur || 0}px`);
  root.style.setProperty(
    "--bg-opacity",
    String((Number.isFinite(theme.bgOpacity) ? theme.bgOpacity : 100) / 100),
  );
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-glow", `color-mix(in srgb, ${accent} 34%, transparent)`);
  root.style.setProperty("--glass-tint", mode === "light" ? LIGHT.tint : hexToRgb(tint));
  root.style.setProperty(
    "--nav-text",
    mode === "light" ? LIGHT.nav : toHexColor(theme.navText, DEFAULT_THEME.navText),
  );
  root.style.setProperty(
    "--nav-text-active",
    mode === "light" ? LIGHT.navActive : toHexColor(theme.navTextActive, DEFAULT_THEME.navTextActive),
  );
  root.style.setProperty("--glass-blur", `${theme.glassBlur || 0}px`);
  root.style.setProperty("--glass-saturate", `${theme.glassSaturate || 160}%`);
  root.style.setProperty("--panel-radius", `${theme.borderRadius || 16}px`);
  const opacity = Number.isFinite(theme.glassOpacity) ? theme.glassOpacity : DEFAULT_THEME.glassOpacity;
  root.style.setProperty("--glass-opacity", String(Math.min(100, Math.max(0, opacity)) / 100));
}

/**
 * Point the browser tab icon at a custom favicon (URL, /path or data:image).
 * Empty string restores the built-in /favicon.svg. The <link rel="icon"> in
 * the root head is reused (id attribute untouched), only href/type change.
 */
export function applyFavicon(faviconUrl: string) {
  if (typeof document === "undefined") return;
  const href = faviconUrl.trim() || "/favicon.svg";
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (href.endsWith(".svg")) link.setAttribute("type", "image/svg+xml");
  else if (href.startsWith("data:")) link.setAttribute("type", href.slice(5, href.indexOf(";")) || "image/png");
  else link.removeAttribute("type");
  link.href = href;
}
