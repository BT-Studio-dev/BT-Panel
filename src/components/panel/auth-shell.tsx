import { useLayoutEffect, useState, type ReactNode } from "react";
import { getPublicAppearance } from "@/lib/panel/server";
import { applyFavicon, applyTheme } from "@/lib/panel/theme";
import { DEFAULT_GENERAL, DEFAULT_THEME, type PublicAppearance } from "@/lib/panel/types";
import { WallpaperLayer } from "./wallpaper-layer";
import { BrandMark } from "./brand-mark";

export function AuthShell({
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  /** Heading text — "{panel}" is replaced with the configured panel name. */
  title: string;
  /** Steel subtitle line under the heading. */
  subtitle?: string;
  /** Header icon rendered in the rounded accent box; falls back to the brand mark. */
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [appearance, setAppearance] = useState<PublicAppearance>({
    theme: DEFAULT_THEME,
    general: DEFAULT_GENERAL,
    allowRegistration: true,
  });

  useLayoutEffect(() => {
    applyTheme(DEFAULT_THEME);
    let cancelled = false;
    void getPublicAppearance()
      .then((data) => {
        if (cancelled) return;
        setAppearance(data);
        applyTheme(data.theme);
        // Brand the tab too: custom favicon + title from panel settings.
        document.title = data.general.faviconTitle || data.general.panelName || "BT Panel";
        applyFavicon(data.general.faviconLogo);
      })
      .catch(() => {
        applyTheme(DEFAULT_THEME);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const panelName = appearance.general.panelName || "BT Panel";
  const heading = title.replaceAll("{panel}", panelName);

  return (
    <div className="relative min-h-dvh">
      <WallpaperLayer theme={appearance.theme} />
      <main className="relative z-10 flex min-h-dvh items-center justify-center px-4 py-10">
        <div className="glass w-full max-w-[360px] px-8 py-8 text-center">
          <div className="mb-5 flex flex-col items-center gap-3">
            {icon ? (
              <div className="grid size-12 place-items-center rounded-2xl border border-[var(--accent)]/50 bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-[var(--accent)] shadow-[0_0_22px_var(--accent-glow)]">
                {icon}
              </div>
            ) : (
              <BrandMark className="size-11 drop-shadow-[0_0_18px_var(--accent-glow)]" src={appearance.general.panelLogo || undefined} />
            )}
            <div>
              <h1 className="text-[21px] font-extrabold tracking-tight text-ice">{heading}</h1>
              {subtitle ? <p className="mt-1 text-[12.5px] font-semibold text-steel">{subtitle}</p> : null}
            </div>
          </div>
          {children}
          {footer ? <div className="mt-5 border-t border-white/10 pt-4 text-[12.5px] font-semibold text-steel">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
