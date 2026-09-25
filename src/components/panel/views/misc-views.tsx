"use client";

import { useState } from "react";
import {
  BookOpen,
  ExternalLink,
  GitBranch,
  Image as ImageIcon,
  Music2,
  Palette,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  Rocket,
  Server,
  SlidersHorizontal,
  Users,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { PANEL_VERSION, REPO_URL, type PanelProfile, type PanelView, type SettingsTab } from "@/lib/panel/types";
import { cn, formatJoined, timeAgo } from "@/lib/utils";
import { usePanel } from "../context";
import { BrandMark, EmptyState, PresenceAvatar, Slider, Spinner, ToggleRow, useNow } from "../ui";

// ── Team ────────────────────────────────────────────────────────────────────
type PresenceFilter = "all" | "online" | "offline";

export function TeamView() {
  const { team, profile, settings, isAdmin } = usePanel();
  const now = useNow(30000);
  const [filter, setFilter] = useState<PresenceFilter>("all");
  const isOnline = (m: PanelProfile) => m.online || m.userId === profile.userId;

  if (!settings.showTeam && !isAdmin) {
    return (
      <div className="glass">
        <EmptyState icon={<Users className="size-5" />} title="Team directory hidden" body="An administrator has hidden the team page on this panel." />
      </div>
    );
  }

  const list = team.filter((m) => (filter === "all" ? true : filter === "online" ? isOnline(m) : !isOnline(m)));

  return (
    <div className="glass overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[16px] font-extrabold">Team Members</h2>
          <p className="mt-0.5 text-[12px] font-semibold text-steel">
            {team.filter(isOnline).length} online · {team.length} total
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["all", "online", "offline"] as PresenceFilter[]).map((f) => (
            <button key={f} type="button" className={cn("pill-tab min-h-9 px-3.5 text-[12px] capitalize", filter === f && "active")} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.length === 0 ? (
          <p className="col-span-full px-2 py-8 text-center text-sm font-semibold text-steel">No members in this filter.</p>
        ) : (
          list.map((member) => {
            const online = isOnline(member);
            return (
              <div key={member.userId} className="glass-soft flex items-center gap-3 rounded-[14px] border border-line p-3">
                <PresenceAvatar name={member.username} src={member.profilePic} online={online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-extrabold">{member.username}</span>
                    {member.userId === profile.userId ? (
                      <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9.5px] font-extrabold text-accent">YOU</span>
                    ) : null}
                  </div>
                  <div className="text-[11px] font-bold tracking-[0.12em] text-steel uppercase">
                    {member.role}
                    {member.status === "suspended" ? " · suspended" : ""}
                  </div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-faint">
                    {online ? "Online now" : `Last seen ${now ? timeAgo(member.lastSeen, now) : "—"}`} · Joined {formatJoined(member.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Tutorials ───────────────────────────────────────────────────────────────
type Step = { icon: LucideIcon; title: string; body: string; cta: string; go: { view: PanelView; tab?: SettingsTab }; admin?: boolean };

const STEPS: Step[] = [
  { icon: Palette, title: "1 · Set your branding", body: "Admin Settings → General names the panel, sets the browser tab title and uploads your own panel and favicon logos.", cta: "Open General", go: { view: "settings", tab: "general" }, admin: true },
  { icon: ImageIcon, title: "2 · Pick a background", body: "Admin Settings → 4K Wallpapers opens the Panel Background Engine: curated wallpapers, live WebGL shaders, uploads and custom URLs.", cta: "Open wallpapers", go: { view: "settings", tab: "wallpapers" }, admin: true },
  { icon: SlidersHorizontal, title: "3 · Tune the glass", body: "Admin Settings → Appearance controls wallpaper blur/opacity, accent and nav colors — plus the Glassmorphism Transparency & Blur bars with auto-save.", cta: "Open appearance", go: { view: "settings", tab: "appearance" }, admin: true },
  { icon: Server, title: "4 · Deploy a server", body: "Servers → Create Server picks a game or app template (Minecraft, Rust, CS2, Node.js…), a node and resource limits. Start it and watch the console boot live.", cta: "Open servers", go: { view: "servers" } },
  { icon: Users, title: "5 · Add your team", body: "User Management creates accounts and assigns roles (owner / admin / member). The Team view shows everyone with live presence dots.", cta: "Open team", go: { view: "team" } },
  { icon: Music2, title: "6 · Set the mood", body: "The Music page plays the bundled ambient loop across every view — toggle autoplay and loop, and it remembers your volume.", cta: "Open music", go: { view: "music" } },
];

export function TutorialsView() {
  const { isAdmin, setView, setSettingsTab } = usePanel();
  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight">
          <BookOpen className="size-5 text-accent" />
          Tutorials
        </h2>
        <p className="mt-1 text-[13px] font-semibold text-steel">Get the panel looking and running the way you want — six quick steps.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {STEPS.map((step) => {
          const locked = step.admin && !isAdmin;
          return (
            <div key={step.title} className="glass flex flex-col p-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-[10px] border border-accent/35 bg-accent/12 text-accent">
                  <step.icon className="size-4" />
                </span>
                <div className="text-[14px] font-extrabold">{step.title}</div>
              </div>
              <p className="mt-2 flex-1 text-[12.5px] leading-relaxed font-semibold text-steel">{step.body}</p>
              <button
                type="button"
                className="btn-ghost mt-3 min-h-9 w-fit px-3 text-[12px]"
                disabled={locked}
                title={locked ? "Administrators only" : undefined}
                onClick={() => (step.go.tab ? setSettingsTab(step.go.tab) : setView(step.go.view))}
              >
                {locked ? "Admins only" : step.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Updates ─────────────────────────────────────────────────────────────────
type Commit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name: string; date: string } | null };
};

const BUILD_NOTES = [
  "Glassmorphism shell with collapsible sidebar and Dark / OLED / Light base themes",
  "Panel Background Engine — live WebGL shaders, curated 4K wallpapers, uploads and custom URLs",
  "Servers workspace — templates, power controls, live console and telemetry",
  "Owner / admin / member roles, presence dots and user management",
  "Branding controls, home indicator bars and the ambient music player",
];

export function UpdatesView() {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; commits: Commit[]; error?: string }>({
    status: "idle",
    commits: [],
  });

  async function check() {
    setState((s) => ({ ...s, status: "loading" }));
    try {
      const res = await fetch("https://api.github.com/repos/BT-Studio-dev/BT-Panel/commits?per_page=6", {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);
      setState({ status: "done", commits: (await res.json()) as Commit[] });
    } catch (err) {
      setState({ status: "error", commits: [], error: err instanceof Error ? err.message : "Network error" });
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="glass p-5">
        <div className="flex items-center gap-3">
          <BrandMark className="size-12 drop-shadow-[0_0_18px_var(--accent-glow)]" />
          <div>
            <div className="text-[11px] font-extrabold tracking-[0.12em] text-steel uppercase">Installed version</div>
            <div className="font-mono text-[24px] font-semibold">{PANEL_VERSION}</div>
          </div>
          <span className="ml-auto rounded-full border border-ok/30 bg-ok/10 px-2.5 py-1 text-[10.5px] font-extrabold tracking-wide text-ok uppercase">Stable</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            ["Runtime", "Next.js 16"],
            ["UI", "React 19"],
            ["Database", "PostgreSQL"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-[10px] border border-line bg-fill px-2 py-2.5">
              <div className="text-[9.5px] font-extrabold tracking-[0.12em] text-steel uppercase">{k}</div>
              <div className="mt-0.5 text-[12.5px] font-extrabold">{v}</div>
            </div>
          ))}
        </div>
        <h3 className="mt-6 flex items-center gap-2 text-[14px] font-extrabold">
          <Rocket className="size-4 text-accent" /> What&apos;s in this build
        </h3>
        <ul className="mt-3 grid gap-2">
          {BUILD_NOTES.map((note) => (
            <li key={note} className="flex gap-2.5 text-[12.5px] font-semibold text-steel">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent-glow)]" />
              {note}
            </li>
          ))}
        </ul>
      </section>

      <section className="glass p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-[16px] font-extrabold">
              <GitBranch className="size-4 text-accent" /> Upstream repository
            </h3>
            <p className="mt-0.5 text-[12px] font-semibold text-steel">Latest commits on BT-Studio-dev/BT-Panel, fetched live from GitHub.</p>
          </div>
          <div className="flex gap-2">
            <a className="btn-ghost min-h-10" href={REPO_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" /> GitHub
            </a>
            <button type="button" className="btn-accent min-h-10" onClick={() => void check()} disabled={state.status === "loading"}>
              {state.status === "loading" ? <Spinner /> : <RefreshCw className="size-4" />} Check for updates
            </button>
          </div>
        </div>
        <div className="mt-4">
          {state.status === "idle" ? (
            <p className="rounded-[12px] border border-dashed border-line-strong px-4 py-8 text-center text-[12.5px] font-semibold text-steel">
              Press “Check for updates” to load the most recent upstream activity.
            </p>
          ) : null}
          {state.status === "error" ? (
            <p className="rounded-[12px] border border-danger/30 bg-danger/10 px-4 py-4 text-[12.5px] font-bold text-danger">
              Could not reach GitHub ({state.error}). The API allows 60 unauthenticated requests per hour — try again later.
            </p>
          ) : null}
          {state.status === "done" ? (
            <ol className="grid gap-2">
              {state.commits.map((c) => (
                <li key={c.sha} className="flex items-start gap-3 rounded-[12px] border border-line bg-fill px-3 py-2.5">
                  <GitBranch className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-extrabold">{c.commit.message.split("\n")[0]}</div>
                    <div className="text-[11px] font-semibold text-steel">
                      {c.commit.author?.name ?? "unknown"} · {formatJoined(c.commit.author?.date)}
                    </div>
                  </div>
                  <a href={c.html_url} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-accent hover:underline">
                    {c.sha.slice(0, 7)}
                  </a>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </section>
    </div>
  );
}

// ── Music ───────────────────────────────────────────────────────────────────
function mmss(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MusicView() {
  const { music } = usePanel();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="glass overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <div className="relative grid size-40 shrink-0 place-items-center self-center overflow-hidden rounded-[22px] border border-accent/40 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--accent)_55%,transparent),transparent_60%),linear-gradient(135deg,#0b0d16,#1a0508)] shadow-[0_0_40px_var(--accent-glow)]">
            <BrandMark className={cn("size-16 transition-transform duration-700", music.playing && "scale-110")} />
            <div className={cn("eq absolute bottom-4 left-1/2 -translate-x-1/2", music.playing && "on")}>
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold tracking-[0.12em] text-steel uppercase">{music.playing ? "Now playing" : "Ready"}</div>
            <div className="mt-1 text-[24px] font-extrabold tracking-tight">BT Ambient Loop</div>
            <div className="text-[12.5px] font-semibold text-steel">Bundled track · plays across every view</div>
            <input
              type="range"
              className="range-input mt-5"
              min={0}
              max={Math.max(1, music.duration)}
              step={0.1}
              value={Math.min(music.current, music.duration || 0)}
              onChange={(e) => music.seek(Number(e.target.value))}
              aria-label="Seek"
            />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-steel">
              <span>{mmss(music.current)}</span>
              <span>{mmss(music.duration)}</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                className="grid size-14 place-items-center rounded-full bg-accent text-white shadow-[0_6px_24px_var(--accent-glow)] transition-transform hover:scale-105"
                onClick={music.toggle}
                aria-label={music.playing ? "Pause" : "Play"}
              >
                {music.playing ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
              </button>
              <button
                type="button"
                className={cn("icon-btn size-10", music.loop && "border-accent/50 text-accent")}
                onClick={() => music.setPrefs({ loop: !music.loop })}
                aria-label="Toggle loop"
                title={music.loop ? "Loop on" : "Loop off"}
              >
                <Repeat className="size-4" />
              </button>
              <div className="flex flex-1 items-center gap-2">
                <Volume2 className="size-4 shrink-0 text-steel" />
                <input
                  type="range"
                  className="range-input"
                  min={0}
                  max={100}
                  value={Math.round(music.volume * 100)}
                  onChange={(e) => music.setPrefs({ volume: Number(e.target.value) / 100 })}
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="glass p-5">
        <h3 className="text-[16px] font-extrabold">Music studio</h3>
        <p className="mt-1 text-[12.5px] font-semibold text-steel">Preferences are saved in this browser.</p>
        <div className="mt-4 grid gap-2">
          <ToggleRow label="Autoplay" hint="Start the ambient loop on your first click in the panel" checked={music.autoplay} onChange={(v) => music.setPrefs({ autoplay: v })} />
          <ToggleRow label="Loop" hint="Repeat the track seamlessly" checked={music.loop} onChange={(v) => music.setPrefs({ loop: v })} />
          <div className="rounded-[12px] border border-line bg-fill px-4 py-3">
            <Slider label="Volume" value={Math.round(music.volume * 100)} max={100} suffix="%" onChange={(v) => music.setPrefs({ volume: v / 100 })} />
          </div>
        </div>
      </section>
    </div>
  );
}
