"use client";

import { useMemo, useState } from "react";
import { ExternalLink, Gamepad2, Layers, MonitorPlay, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pages shipped with the bundled static preview of the standalone PHP panel.
 * `path` is relative to the panel base URL so the same component works for the
 * bundled preview and for a real deployment.
 */
const PAGES = [
  { id: "overview", label: "Overview", path: "index.html" },
  { id: "servers", label: "Servers", path: "servers.html" },
  { id: "server", label: "Server detail", path: "server.html" },
  { id: "users", label: "Users", path: "users.html" },
  { id: "settings", label: "Settings", path: "settings.html" },
  { id: "activity", label: "Activity", path: "activity.html" },
  { id: "login", label: "Sign in", path: "login.html" },
  { id: "register", label: "Register", path: "register.html" },
  { id: "forgot", label: "Forgot password", path: "forgot.html" },
  { id: "reset", label: "Reset password", path: "reset.html" },
] as const;

type PageId = (typeof PAGES)[number]["id"];

/**
 * Base URL of the Minecraft panel.
 *
 * The repository ships a static design preview under /minecraft-panel, which is
 * what this view shows by default. On a real deployment, point
 * NEXT_PUBLIC_MINECRAFT_PANEL_URL at the PHP panel's own origin (for example
 * https://mc.example.com) so the module embeds the live panel instead.
 */
const PANEL_BASE = (process.env.NEXT_PUBLIC_MINECRAFT_PANEL_URL || "/minecraft-panel/").replace(/\/?$/, "/");
const IS_BUNDLED = PANEL_BASE === "/minecraft-panel/";

export function MinecraftView() {
  const [page, setPage] = useState<PageId>("overview");
  const [reloadKey, setReloadKey] = useState(0);

  const current = useMemo(() => PAGES.find((entry) => entry.id === page) ?? PAGES[0], [page]);
  const src = useMemo(() => `${PANEL_BASE}${current.path}?embed=1&r=${reloadKey}`, [current, reloadKey]);
  const standalone = `${PANEL_BASE}${current.path}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gamepad2 className="size-5 text-accent" />
            <h2 className="text-[22px] font-extrabold tracking-tight">Minecraft Panel</h2>
            <span className="rounded-full border border-ok/30 bg-ok/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-ok">
              PHP module
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[13px] font-semibold text-steel">
            Standalone Minecraft server manager for the BT Panel host — Java process per server, console over RCON,
            file manager, backups, per-server access, plus login, registration, Google sign-in and password reset.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" type="button" onClick={() => setReloadKey((n) => n + 1)}>
            <RefreshCw className="size-4" /> Reload
          </button>
          <a className="btn-accent" href={standalone} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" /> Open standalone
          </a>
        </div>
      </div>

      <div className="glass overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-3 py-2.5">
          <span className="mr-1 hidden items-center gap-1.5 text-[10px] font-extrabold tracking-[0.16em] text-faint uppercase sm:flex">
            <Layers className="size-3.5" /> Pages
          </span>
          {PAGES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setPage(entry.id)}
              aria-pressed={entry.id === page}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors",
                entry.id === page
                  ? "border-accent/60 bg-accent/15 text-ice"
                  : "border-line bg-fill text-steel hover:text-ice",
              )}
            >
              {entry.label}
            </button>
          ))}
          <span className="ml-auto hidden font-mono text-[10.5px] text-faint sm:block">
            {IS_BUNDLED ? "static design preview" : PANEL_BASE.replace(/^https?:\/\//, "")}
          </span>
        </div>

        <iframe
          key={src}
          src={src}
          title={`Minecraft panel — ${current.label}`}
          className="block h-[72vh] min-h-[520px] w-full bg-ink"
          referrerPolicy="no-referrer"
        />
      </div>

      <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-[12px] font-semibold text-steel">
        <span className="inline-flex items-center gap-1.5">
          <MonitorPlay className="size-4 shrink-0" />
          {IS_BUNDLED ? (
            <>
              Bundled static preview — forms are inert. Set{" "}
              <code className="rounded bg-fill px-1.5 py-0.5 font-mono text-[11px]">NEXT_PUBLIC_MINECRAFT_PANEL_URL</code>{" "}
              to the PHP panel&apos;s origin to embed the live panel.
            </>
          ) : (
            <>Embedding the live panel at {PANEL_BASE}</>
          )}
        </span>
        <span className="ml-auto">
          Install guide:{" "}
          <code className="rounded bg-fill px-1.5 py-0.5 font-mono text-[11px]">minecraft-panel/docs/BT-PANEL-DEPLOY.md</code>
        </span>
      </div>
    </div>
  );
}
