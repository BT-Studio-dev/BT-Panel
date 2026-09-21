import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PanelProvider } from "@/components/panel/context";
import { PanelShell } from "@/components/panel/shell";
import { WallpaperLayer } from "@/components/panel/wallpaper-layer";
import { DEFAULT_THEME } from "@/lib/panel/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();
  // Watchdog: if the session check request is lost in transit (dead relay
  // socket), `isPending` would otherwise stay true forever and this route
  // would show ONLY the wallpaper — a blank dark page with no way out. After
  // 20s of pending, surface a small retry notice over the wallpaper (still no
  // splash screen; the wallpaper stays the background).
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!isPending) {
      setStalled(false);
      return;
    }
    const t = window.setTimeout(() => setStalled(true), 20000);
    return () => window.clearTimeout(t);
  }, [isPending]);

  if (isPending) {
    return (
      <div className="relative min-h-dvh">
        <WallpaperLayer theme={DEFAULT_THEME} />
        {stalled ? (
          <div className="absolute inset-0 z-20 grid place-items-center px-6">
            <div className="max-w-sm rounded-xl border border-white/10 bg-black/70 px-6 py-5 text-center backdrop-blur-md">
              <p className="text-[13px] font-bold text-ice">Still checking your session…</p>
              <p className="mt-1 text-[12px] font-semibold text-steel">
                The connection is slow or a request was lost. Refreshing usually fixes it.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <button
                  type="button"
                  className="btn-accent"
                  onClick={() => window.location.reload()}
                >
                  Refresh
                </button>
                <a href="/login" className="btn-ghost">
                  Sign in manually
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (!user) return <RedirectToSignIn />;

  return (
    <PanelProvider>
      <PanelShell />
    </PanelProvider>
  );
}
