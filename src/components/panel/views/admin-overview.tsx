"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  Gamepad2,
  KeyRound,
  MemoryStick,
  Network,
  RefreshCw,
  Server as ServerIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import { NODES, SERVER_TEMPLATES, getTemplate } from "@/lib/panel/catalog";
import { PANEL_VERSION, type AdminActivityDto } from "@/lib/panel/types";
import { api, cn, formatJoined, formatMb, timeAgo } from "@/lib/utils";
import { usePanel } from "../context";
import { EmptyState, SectionCard, Spinner, StatusBadge, TemplateBadge, useNow } from "../ui";
import { AdminPageHeader, AdminStat } from "./admin-shared";

export function AdminOverviewView() {
  const { servers, userCount, openServer, setAdminSection, profile } = usePanel();
  const running = servers.filter((server) => server.status === "running").length;
  const transitioning = servers.filter((server) => server.status === "starting" || server.status === "stopping").length;
  const minecraft = servers.filter((server) => server.template === "minecraft").length;
  const memory = servers.reduce((total, server) => total + server.memoryMb, 0);
  const ports = [...servers].sort((a, b) => a.port - b.port);

  return (
    <div>
      <AdminPageHeader
        title="Administration Overview"
        description={`A live view of the BT Panel Game fleet, signed in as ${profile.username}.`}
        actions={<span className="pill-tab active">Panel {PANEL_VERSION}</span>}
      />

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <AdminStat icon={ServerIcon} label="Servers" value={servers.length} detail={`${transitioning} currently transitioning`} />
        <AdminStat icon={ActivityIcon} label="Running" value={running} detail={`${servers.length - running} not running`} tone="ok" />
        <AdminStat icon={Network} label="Nodes" value={NODES.length} detail="Configured deployment catalog" />
        <AdminStat icon={Users} label="Users" value={userCount} detail="Registered panel accounts" />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <SectionCard title="Fleet allocation" subtitle="Resources assigned across all managed servers" icon={<MemoryStick className="size-4" />}>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--control-radius)] border border-line bg-fill/50 p-3.5">
              <div className="text-[11px] font-bold text-steel">Memory allocated</div>
              <div className="mt-1.5 text-[20px] font-extrabold">{formatMb(memory)}</div>
            </div>
            <div className="rounded-[var(--control-radius)] border border-line bg-fill/50 p-3.5">
              <div className="text-[11px] font-bold text-steel">Game templates</div>
              <div className="mt-1.5 text-[20px] font-extrabold">{SERVER_TEMPLATES.filter((template) => template.category === "game").length}</div>
            </div>
            <div className="rounded-[var(--control-radius)] border border-line bg-fill/50 p-3.5">
              <div className="text-[11px] font-bold text-steel">Minecraft servers</div>
              <div className="mt-1.5 text-[20px] font-extrabold">{minecraft}</div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {servers.length ? (
              [...servers]
                .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
                .slice(0, 5)
                .map((server) => (
                  <button
                    key={server.id}
                    type="button"
                    onClick={() => openServer(server.id)}
                    className="flex w-full min-w-0 items-center gap-3 rounded-[var(--control-radius)] border border-line bg-fill/40 p-3 text-left transition-colors hover:border-accent/40 hover:bg-fill"
                  >
                    <TemplateBadge templateId={server.template} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-extrabold">{server.name}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-semibold text-steel">
                        {server.ip}:{server.port} · {server.ownerName ?? "Unassigned"}
                      </span>
                    </span>
                    <StatusBadge status={server.status} />
                    <ArrowUpRight className="size-4 shrink-0 text-steel" />
                  </button>
                ))
            ) : (
              <div className="rounded-[var(--control-radius)] border border-dashed border-line px-4 py-6 text-center text-[12px] font-semibold text-steel">
                No servers have been deployed yet.
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Control shortcuts" subtitle="Jump to common administration tasks" icon={<ShieldCheck className="size-4" />}>
          <div className="grid gap-2.5">
            {[
              { section: "server" as const, icon: Gamepad2, title: "Manage game servers", text: "Power, console, ports and resources" },
              { section: "activity" as const, icon: ActivityIcon, title: "Review activity", text: "Aggregated server and console events" },
              { section: "nodes" as const, icon: Network, title: "Inspect nodes", text: "Locations, allocations and Wings ports" },
              { section: "api-keys" as const, icon: KeyRound, title: "Create an API key", text: "Authenticated access for your own tools" },
            ].map((item) => (
              <button
                key={item.section}
                type="button"
                onClick={() => setAdminSection(item.section)}
                className="group flex items-center gap-3 rounded-[var(--control-radius)] border border-line bg-fill/40 p-3 text-left transition-colors hover:border-accent/40 hover:bg-fill"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-[var(--control-radius)] border border-accent/20 bg-accent/10 text-accent">
                  <item.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-extrabold">{item.title}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-steel">{item.text}</span>
                </span>
                <ArrowUpRight className="size-4 text-steel transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        className="mt-5"
        title="Port allocations"
        subtitle="Primary endpoints assigned by BT Panel"
        icon={<Network className="size-4" />}
        actions={<span className="text-[11px] font-bold text-steel">{ports.length} allocations</span>}
        bodyClassName="p-0"
      >
        {ports.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead className="border-b border-line text-[10px] tracking-[0.1em] text-steel uppercase">
                <tr><th className="px-5 py-3">Server</th><th className="px-5 py-3">Template</th><th className="px-5 py-3">Node</th><th className="px-5 py-3">Endpoint</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ports.map((server) => (
                  <tr key={server.id} className="cursor-pointer transition-colors hover:bg-fill/50" onClick={() => openServer(server.id)}>
                    <td className="px-5 py-3 text-[12.5px] font-extrabold">{server.name}</td>
                    <td className="px-5 py-3 text-[12px] font-semibold text-steel">{getTemplate(server.template).name}</td>
                    <td className="px-5 py-3 text-[12px] font-semibold text-steel">{server.node}</td>
                    <td className="px-5 py-3 font-mono text-[12px] font-bold">{server.ip}:{server.port}</td>
                    <td className="px-5 py-3"><StatusBadge status={server.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={<Network className="size-5" />} title="No port allocations" body="Create a server to assign its primary game or application port." />
        )}
      </SectionCard>
    </div>
  );
}

const LEVELS = ["all", "info", "warn", "error", "cmd", "system"] as const;

export function AdminActivityView() {
  const { openServer, searchQuery } = usePanel();
  const now = useNow(30_000);
  const [activity, setActivity] = useState<AdminActivityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const [error, setError] = useState("");

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    try {
      const result = await api<{ activity: AdminActivityDto[] }>("/api/admin/activity?limit=150");
      setActivity(result.activity);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(true), 0);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activity.filter((event) => {
      if (level !== "all" && event.level !== level) return false;
      return !q || `${event.serverName} ${event.message}`.toLowerCase().includes(q);
    });
  }, [activity, level, searchQuery]);

  return (
    <div>
      <AdminPageHeader
        title="Server Activity"
        description="Real console, power, backup and system events aggregated from every managed server."
        actions={
          <button type="button" className="btn-ghost" onClick={() => void load()} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} /> Refresh
          </button>
        }
      />
      <div className="glass overflow-hidden">
        <div className="flex border-b border-line p-4">
          <select className="panel-input sm:ml-auto sm:w-40" value={level} onChange={(event) => setLevel(event.target.value as (typeof LEVELS)[number])} aria-label="Filter activity level">
            {LEVELS.map((item) => <option key={item} value={item}>{item === "all" ? "All events" : item.toUpperCase()}</option>)}
          </select>
        </div>
        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-[13px] font-bold text-steel"><Spinner /> Loading activity…</div>
        ) : error && !activity.length ? (
          <EmptyState icon={<ActivityIcon className="size-5" />} title="Activity unavailable" body={error} />
        ) : filtered.length ? (
          <div className="divide-y divide-line">
            {filtered.map((event) => (
              <div key={event.id} className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-fill/40 sm:flex-row sm:items-center sm:px-5">
                <span className={cn("mt-1 size-2 shrink-0 rounded-full sm:mt-0", event.level === "error" ? "bg-danger" : event.level === "warn" ? "bg-warn" : event.level === "cmd" ? "bg-accent" : "bg-ok")} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <button type="button" className="text-[12.5px] font-extrabold hover:text-accent" onClick={() => openServer(event.serverId)}>{event.serverName}</button>
                    <span className="rounded-[var(--control-radius)] border border-line bg-fill px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-steel uppercase">{event.level}</span>
                  </div>
                  <p className="mt-1 font-mono text-[11.5px] leading-relaxed break-words text-steel">{event.message}</p>
                </div>
                <div className="shrink-0 pl-4 text-[11px] font-semibold text-faint sm:pl-0 sm:text-right" title={formatJoined(event.createdAt)}>
                  {now ? timeAgo(event.createdAt, now) : formatJoined(event.createdAt)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<ActivityIcon className="size-5" />} title={activity.length ? "No matching events" : "No activity yet"} body={activity.length ? "Change the search or event-level filter." : "Power actions and console commands will appear here."} />
        )}
        {error && activity.length ? <div className="border-t border-line px-4 py-2 text-[11px] font-semibold text-warn">{error}</div> : null}
      </div>
    </div>
  );
}
