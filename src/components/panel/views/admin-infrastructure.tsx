"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Cable,
  Database,
  FolderGit2,
  Gamepad2,
  Globe2,
  HardDrive,
  Layers3,
  MapPin,
  Network,
  PackageOpen,
  Plug,
  RefreshCw,
  Server as ServerIcon,
  Tags as TagsIcon,
  Terminal,
} from "lucide-react";
import { NODES, SERVER_TEMPLATES } from "@/lib/panel/catalog";
import { PANEL_MODULES } from "@/lib/panel/modules";
import { api, cn, formatMb } from "@/lib/utils";
import { usePanel } from "../context";
import { EmptyState, SectionCard, Spinner, TemplateBadge } from "../ui";
import { AdminPageHeader, AdminStat, CatalogNote } from "./admin-shared";

export function AdminLocationsView() {
  const { servers } = usePanel();
  const locations = useMemo(
    () =>
      NODES.map((node) => ({
        ...node,
        servers: servers.filter((server) => server.node === node.id),
      })),
    [servers],
  );

  return (
    <div>
      <AdminPageHeader title="Locations" description="Deployment regions represented by the nodes available during server creation." />
      <CatalogNote>Locations are derived from the active node catalog, so this directory always matches the server deployment choices.</CatalogNote>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {locations.map((location) => (
          <div key={location.id} className="glass p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl border border-accent/25 bg-accent/10 text-accent"><MapPin className="size-5" /></span>
                <div><h3 className="text-[15px] font-extrabold">{location.location}</h3><p className="mt-0.5 text-[11px] font-bold text-steel">{location.region} region</p></div>
              </div>
              <span className="rounded-full border border-line bg-fill px-2 py-1 text-[9px] font-extrabold tracking-wider text-steel uppercase">Catalog</span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-fill/60 p-2.5 text-center"><div className="text-[18px] font-extrabold">1</div><div className="text-[10px] font-bold text-steel">Node</div></div>
              <div className="rounded-lg bg-fill/60 p-2.5 text-center"><div className="text-[18px] font-extrabold">{location.servers.length}</div><div className="text-[10px] font-bold text-steel">Servers</div></div>
              <div className="rounded-lg bg-fill/60 p-2.5 text-center"><div className="text-[18px] font-extrabold">{location.servers.filter((server) => server.status === "running").length}</div><div className="text-[10px] font-bold text-steel">Running</div></div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-[11px] font-semibold text-steel"><span>Node identifier</span><code className="text-ice">{location.id}</code></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminNodesView() {
  const { servers } = usePanel();
  const totalMemory = servers.reduce((sum, server) => sum + server.memoryMb, 0);
  return (
    <div>
      <AdminPageHeader title="Nodes & Wings" description="Node allocation, daemon ports and SFTP settings used by the game-server catalog." />
      <CatalogNote>Wings and SFTP ports are catalog configuration, not a live daemon health check. No external Wings connection is claimed by this panel.</CatalogNote>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <AdminStat icon={Network} label="Catalog nodes" value={NODES.length} detail={`${new Set(NODES.map((node) => node.location)).size} locations`} />
        <AdminStat icon={ServerIcon} label="Deployments" value={servers.length} detail={`${servers.filter((server) => server.status === "running").length} running`} tone="ok" />
        <AdminStat icon={HardDrive} label="Memory assigned" value={formatMb(totalMemory)} detail="Across configured nodes" />
      </div>
      <div className="grid gap-4 2xl:grid-cols-2">
        {NODES.map((node) => {
          const nodeServers = servers.filter((server) => server.node === node.id);
          return (
            <SectionCard
              key={node.id}
              title={node.name}
              subtitle={`${node.location} · ${node.id}`}
              icon={<ServerIcon className="size-4" />}
              actions={<span className="rounded-full border border-line bg-fill px-2.5 py-1 text-[9px] font-extrabold tracking-wider text-steel uppercase">Configured</span>}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-line bg-fill/40 p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-steel"><Cable className="size-3.5" /> Wings daemon</div><div className="mt-2 font-mono text-[14px] font-extrabold">0.0.0.0:{node.daemonPort}</div></div>
                <div className="rounded-xl border border-line bg-fill/40 p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-steel"><FolderGit2 className="size-3.5" /> SFTP</div><div className="mt-2 font-mono text-[14px] font-extrabold">0.0.0.0:{node.sftpPort}</div></div>
                <div className="rounded-xl border border-line bg-fill/40 p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-steel"><Network className="size-3.5" /> Allocation subnet</div><div className="mt-2 font-mono text-[14px] font-extrabold">{node.subnet}0/24</div></div>
                <div className="rounded-xl border border-line bg-fill/40 p-3"><div className="flex items-center gap-2 text-[11px] font-bold text-steel"><Gamepad2 className="size-3.5" /> Primary ports</div><div className="mt-2 font-mono text-[14px] font-extrabold">{nodeServers.length ? nodeServers.map((server) => server.port).join(", ") : "Unallocated"}</div></div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <span className="text-[11.5px] font-bold text-steel">{nodeServers.length} servers · {formatMb(nodeServers.reduce((sum, server) => sum + server.memoryMb, 0))} memory</span>
                <span className="text-[11px] font-semibold text-faint">Health not probed</span>
              </div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}

type DatabaseHost = {
  id: string;
  name: string;
  host: string;
  port: number;
  database: string;
  driver: string;
  primary: boolean;
  status: string;
};

export function AdminDatabaseHostsView() {
  const [hosts, setHosts] = useState<DatabaseHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api<{ hosts: DatabaseHost[] }>("/api/admin/database-hosts");
      setHosts(result.hosts);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load database hosts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div>
      <AdminPageHeader
        title="Database Hosts"
        description="Safe connection metadata for the database used by this BT Panel installation."
        actions={<button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}><RefreshCw className={cn("size-4", loading && "animate-spin")} /> Refresh</button>}
      />
      <CatalogNote>Host credentials and connection strings are intentionally never returned to the browser. The primary host is online when its authenticated metadata request succeeds.</CatalogNote>
      {loading && !hosts.length ? (
        <div className="glass flex min-h-48 items-center justify-center gap-2 text-[13px] font-bold text-steel"><Spinner /> Loading database hosts…</div>
      ) : error && !hosts.length ? (
        <div className="glass"><EmptyState icon={<Database className="size-5" />} title="Database metadata unavailable" body={error} /></div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {hosts.map((host) => (
            <SectionCard key={host.id} title={host.name} subtitle={host.primary ? "Primary panel datastore" : "Additional datastore"} icon={<Database className="size-4" />} actions={<span className="inline-flex items-center gap-1.5 rounded-full border border-ok/25 bg-ok/10 px-2.5 py-1 text-[10px] font-extrabold text-ok uppercase"><span className="size-1.5 rounded-full bg-ok" />{host.status}</span>}>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-fill/50 p-3"><dt className="text-[10px] font-bold tracking-wider text-steel uppercase">Host</dt><dd className="mt-1.5 font-mono text-[13px] font-bold break-all">{host.host}</dd></div>
                <div className="rounded-xl bg-fill/50 p-3"><dt className="text-[10px] font-bold tracking-wider text-steel uppercase">Port</dt><dd className="mt-1.5 font-mono text-[13px] font-bold">{host.port}</dd></div>
                <div className="rounded-xl bg-fill/50 p-3"><dt className="text-[10px] font-bold tracking-wider text-steel uppercase">Database</dt><dd className="mt-1.5 font-mono text-[13px] font-bold break-all">{host.database}</dd></div>
                <div className="rounded-xl bg-fill/50 p-3"><dt className="text-[10px] font-bold tracking-wider text-steel uppercase">Driver</dt><dd className="mt-1.5 text-[13px] font-bold">{host.driver}</dd></div>
              </dl>
            </SectionCard>
          ))}
          <div className="glass border-dashed"><EmptyState icon={<Plug className="size-5" />} title="No additional hosts" body="This installation uses its primary PostgreSQL database. No external game database hosts are configured." /></div>
        </div>
      )}
    </div>
  );
}

export function AdminMountsView() {
  const { servers } = usePanel();
  return (
    <div>
      <AdminPageHeader title="Mounts" description="Template storage destinations available to game and application servers." />
      <CatalogNote>These are logical template mounts, not external volumes attached by a daemon. Each entry is derived from the active server-template catalog.</CatalogNote>
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {SERVER_TEMPLATES.map((template) => {
          const target = template.id === "minecraft" ? "/data" : "/home/container";
          const used = servers.filter((server) => server.template === template.id).length;
          return (
            <div key={template.id} className="glass p-4">
              <div className="flex items-center gap-3"><TemplateBadge templateId={template.id} /><div className="min-w-0"><h3 className="truncate text-[14px] font-extrabold">{template.name} storage</h3><p className="mt-0.5 text-[11px] font-semibold text-steel">{used} attached {used === 1 ? "server" : "servers"}</p></div></div>
              <div className="mt-4 rounded-xl border border-line bg-black/20 p-3 font-mono text-[11.5px]">
                <div className="flex items-center justify-between gap-3"><span className="text-steel">source</span><span>server-storage</span></div>
                <div className="mt-2 flex items-center justify-between gap-3"><span className="text-steel">target</span><span className="break-all">{target}</span></div>
                <div className="mt-2 flex items-center justify-between gap-3"><span className="text-steel">access</span><span>read / write</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminEggsView() {
  const { servers, setAdminSection } = usePanel();
  return (
    <div>
      <AdminPageHeader
        title="Eggs"
        description="Deployable game and application definitions, including Minecraft Paper."
        actions={<button type="button" className="btn-accent" onClick={() => setAdminSection("server")}><Gamepad2 className="size-4" /> Manage servers</button>}
      />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {SERVER_TEMPLATES.map((template) => (
          <div key={template.id} className="glass flex flex-col p-4">
            <div className="flex items-start gap-3"><TemplateBadge templateId={template.id} size="lg" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[15px] font-extrabold">{template.name}</h3><span className="rounded-md border border-line bg-fill px-1.5 py-0.5 text-[9px] font-extrabold text-steel uppercase">{template.category}</span></div><p className="mt-1 text-[11px] font-semibold text-steel">{servers.filter((server) => server.template === template.id).length} deployed servers</p></div></div>
            <div className="my-4 rounded-xl border border-line bg-fill/40 p-3"><div className="text-[10px] font-bold tracking-wider text-steel uppercase">Container image</div><code className="mt-1.5 block text-[11px] leading-relaxed break-all">{template.image}</code></div>
            <div className="mt-auto grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-fill/50 p-2.5"><div className="text-[13px] font-extrabold">{template.defaultPort}</div><div className="mt-0.5 text-[9px] font-bold text-steel uppercase">Default port</div></div>
              <div className="rounded-lg bg-fill/50 p-2.5"><div className="text-[13px] font-extrabold">{template.maxPlayers || "—"}</div><div className="mt-0.5 text-[9px] font-bold text-steel uppercase">Player slots</div></div>
              <div className="rounded-lg bg-fill/50 p-2.5"><div className="text-[13px] font-extrabold">{template.bootLog.length}</div><div className="mt-0.5 text-[9px] font-bold text-steel uppercase">Boot stages</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminTagsView() {
  const { servers } = usePanel();
  const tags = [
    { name: "game", description: "Game server templates", color: "#5fb04a", templates: SERVER_TEMPLATES.filter((template) => template.category === "game") },
    { name: "application", description: "Application and bot runtimes", color: "#3b82f6", templates: SERVER_TEMPLATES.filter((template) => template.category === "app") },
    { name: "minecraft", description: "Minecraft and Paper deployments", color: "#22c55e", templates: SERVER_TEMPLATES.filter((template) => template.id === "minecraft") },
    { name: "steam", description: "SteamCMD-based game servers", color: "#f5a623", templates: SERVER_TEMPLATES.filter((template) => template.image.includes("steamcmd")) },
    { name: "container", description: "All container-image templates", color: "#8b5cf6", templates: SERVER_TEMPLATES },
  ];
  return (
    <div>
      <AdminPageHeader title="Tags" description="Catalog labels for grouping templates and understanding the current fleet." />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {tags.map((tag) => {
          const ids = new Set(tag.templates.map((template) => template.id));
          const count = servers.filter((server) => ids.has(server.template)).length;
          return (
            <SectionCard key={tag.name} title={<span className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: tag.color }} />#{tag.name}</span>} subtitle={tag.description} icon={<TagsIcon className="size-4" />}>
              <div className="flex items-end justify-between gap-3"><div><div className="text-[26px] font-extrabold">{count}</div><div className="text-[11px] font-bold text-steel">Matching servers</div></div><div className="text-right"><div className="text-[18px] font-extrabold">{tag.templates.length}</div><div className="text-[11px] font-bold text-steel">Templates</div></div></div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-3">{tag.templates.map((template) => <span key={template.id} className="rounded-md border border-line bg-fill px-2 py-1 text-[10px] font-bold text-steel">{template.name}</span>)}</div>
            </SectionCard>
          );
        })}
      </div>
    </div>
  );
}

const CORE_FEATURES = [
  { icon: Terminal, name: "Server Console", description: "Commands and real stored server event output" },
  { icon: Gamepad2, name: "Power Management", description: "Start, stop, restart and kill controls" },
  { icon: HardDrive, name: "Backup Snapshots", description: "On-demand server backup records and restore controls" },
  { icon: Globe2, name: "Theme Engine", description: "Live appearance, wallpaper and navigation customization" },
  { icon: Network, name: "Port Allocations", description: "Per-node primary endpoint assignment" },
  { icon: Box, name: "Template Catalog", description: "Minecraft, game and application deployment definitions" },
];

export function AdminExtensionsView() {
  return (
    <div>
      <AdminPageHeader title="Extensions" description="Built-in panel capabilities and optional modules registered in this installation." />
      <SectionCard title="Core capabilities" subtitle="Included with BT Panel Game" icon={<Layers3 className="size-4" />}>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {CORE_FEATURES.map((feature) => (
            <div key={feature.name} className="rounded-xl border border-line bg-fill/40 p-3.5">
              <div className="flex items-center justify-between gap-2"><feature.icon className="size-4 text-accent" /><span className="rounded-full border border-ok/20 bg-ok/10 px-2 py-0.5 text-[9px] font-extrabold text-ok uppercase">Built in</span></div>
              <h3 className="mt-3 text-[13px] font-extrabold">{feature.name}</h3><p className="mt-1 text-[11px] leading-relaxed font-semibold text-steel">{feature.description}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <div className="glass mt-4">
        {PANEL_MODULES.length ? (
          <div className="p-5 text-[13px] font-semibold">{PANEL_MODULES.length} optional modules registered.</div>
        ) : (
          <EmptyState icon={<PackageOpen className="size-5" />} title="No optional extensions installed" body="The optional module registry is empty. All features listed above are native BT Panel capabilities." />
        )}
      </div>
    </div>
  );
}
