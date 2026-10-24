"use client";

import { useEffect, useState } from "react";
import { getLocalModeOverride } from "@/lib/panel/theme";
import {
  resolveView,
  type BootstrapPayload,
  type PanelView,
  type ThemeMode,
  type ThemeSettings,
} from "@/lib/panel/types";
import { api, cachePanel, clearCachedPanel, clearStoredToken, getCachedPanel, getStoredToken, isSessionExpiredError } from "@/lib/utils";
import { PanelShell } from "./shell";
import { WallpaperLayer } from "./wallpaper-layer";

type Ready = { data: BootstrapPayload; view: PanelView; serverId: string | null; mode: ThemeMode | null };

const TIMEOUT_MS = 12_000;

function readReady(data: BootstrapPayload): Ready {
  const params = new URLSearchParams(window.location.search);
  const view = resolveView(params.get("view"), data.profile.role);
  return { data, view, serverId: view === "servers" ? params.get("server") : null, mode: getLocalModeOverride() };
}

function bail() {
  clearStoredToken();
  clearCachedPanel();
  window.location.replace("/login");
}

/**
 * Rendered by `/` when the server saw no session cookie (third-party cookies
 * are blocked in embedded previews, so the session lives in a Bearer token).
 *
 * There is deliberately NO loading screen here: the dashboard signed into
 * last is cached, so Servers paints immediately and the network call only
 * refreshes it in the background. Only a confirmed 401 removes the session;
 * slow or failed network requests preserve it and offer a retry instead.
 */
export function ClientGate({ theme }: { theme: ThemeSettings }) {
  const [ready, setReady] = useState<Ready | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!getStoredToken()) {
      window.location.replace("/login");
      return;
    }
    const cached = getCachedPanel<BootstrapPayload>();
    // Restore a cached dashboard without waiting for the network request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) setReady(readReady(cached));

    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled && !cached) setLoadError("The panel is taking longer than expected to respond.");
    }, TIMEOUT_MS);

    api<BootstrapPayload>("/api/bootstrap")
      .then((data) => {
        if (cancelled) return;
        window.clearTimeout(timer);
        setLoadError("");
        cachePanel(data);
        setReady(readReady(data));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        window.clearTimeout(timer);
        if (isSessionExpiredError(error)) {
          bail();
          return;
        }
        // Network, proxy, and server errors are not proof that a session is
        // invalid. Keep the token so the next scheduled refresh can succeed.
        if (!cached) setLoadError(error instanceof Error ? error.message : "Could not reach the panel.");
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  if (ready) {
    return (
      <PanelShell
        initial={ready.data}
        initialView={ready.view}
        initialServerId={ready.serverId}
        initialModeOverride={ready.mode}
      />
    );
  }

  // No cached dashboard to paint: keep the session saved while it is fetched.
  return (
    <div className="relative min-h-dvh" aria-busy={!loadError}>
      <WallpaperLayer theme={theme} />
      {loadError ? (
        <main className="relative z-10 grid min-h-dvh place-items-center p-4">
          <section className="glass glass-strong w-full max-w-sm p-6 text-center" role="alert">
            <h1 className="text-lg font-extrabold">Couldn’t refresh the panel</h1>
            <p className="mt-2 text-sm font-semibold text-steel">{loadError}</p>
            <p className="mt-2 text-xs font-semibold text-steel">Your sign-in is still saved. Check the connection and try again.</p>
            <button className="btn-accent mt-5 w-full" type="button" onClick={() => window.location.reload()}>Retry connection</button>
          </section>
        </main>
      ) : null}
    </div>
  );
}
