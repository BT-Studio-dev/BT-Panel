"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Clock,
  Copy,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Play,
  Plus,
  RotateCw,
  Search,
  Send,
  Server as ServerIcon,
  Skull,
  Square,
  Terminal,
  Trash,
} from "lucide-react";
import { CPU_OPTIONS, DISK_OPTIONS, MEMORY_OPTIONS, NODES, SERVER_TEMPLATES, getTemplate } from "@/lib/panel/catalog";
import { formatRate, sampleTelemetry } from "@/lib/panel/telemetry";
import type { PowerAction, ServerDto, ServerEventDto } from "@/lib/panel/types";
import { api, cn, formatDuration, formatJoined, formatMb } from "@/lib/utils";
import { usePanel } from "../context";
import { EmptyState, Field, Meter, Modal, Spinner, StatusBadge, TemplateBadge, useNow } from "../ui";

type Filter = "all" | "running" | "offline";
type ServerSnapshot = { server: ServerDto; events: ServerEventDto[] };

const ACTION_LABEL: Record<PowerAction, string> = { start: "Start", stop: "Stop", restart: "Restart", kill: "Kill" };

function uptimeLabel(server: ServerDto, now: number | null): string {
  if (server.status === "running") {
    return server.startedAt && now ? `Up ${formatDuration(now - Date.parse(server.startedAt))}` : "Running";
  }
  if (server.status === "starting") return "Booting…";
  if (server.status === "stopping") return "Shutting down…";
  return "Offline";
}

export function ServersView() {
  const { openServerId } = usePanel();
  return openServerId ? <ServerDetail key={openServerId} id={openServerId} /> : <ServerList />;
}

// ── List ────────────────────────────────────────────────────────────────────
function ServerList() {
  const { servers, isAdmin } = usePanel();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const now = useNow(2000);

  const q = query.trim().toLowerCase();
  const list = servers.filter((s) => {
    if (filter === "running" && s.status !== "running") return false;
    if (filter === "offline" && s.status === "running") return false;
    if (!q) return true;
    return [s.name, getTemplate(s.template).name, s.ip, String(s.port), s.node, s.ownerName ?? ""].some((v) =>
      v.toLowerCase().includes(q),
    );
  });
  const running = servers.filter((s) => s.status === "running").length;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight">Server Fleet</h2>
          <p className="mt-1 text-[13px] font-semibold text-steel">
            {running} of {servers.length} running · {isAdmin ? "every server on the panel" : "servers you own"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-steel" />
            <input
              className="panel-input w-56 pl-9"
              placeholder="Search servers…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "running", "offline"] as Filter[]).map((f) => (
              <button key={f} type="button" className={cn("pill-tab capitalize", filter === f && "active")} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
          <button type="button" className="btn-accent" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Create Server
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="glass">
          <EmptyState
            icon={<ServerIcon className="size-5" />}
            title={servers.length ? "No servers match" : "No servers yet"}
            body={
              servers.length
                ? "Try a different search or filter."
                : "Deploy your first game or app server — it only takes a few seconds."
            }
            action={
              servers.length ? undefined : (
                <button type="button" className="btn-accent" onClick={() => setCreating(true)}>
                  <Plus className="size-4" /> Create Server
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((server) => (
            <ServerCard key={server.id} server={server} now={now} />
          ))}
        </div>
      )}
      <CreateServerModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function ServerCard({ server, now }: { server: ServerDto; now: number | null }) {
  const { openServer } = usePanel();
  const t = getTemplate(server.template);
  const tel = now ? sampleTelemetry(server, now) : null;
  const node = NODES.find((n) => n.id === server.node);
  return (
    <div className="glass flex flex-col p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong">
      <div className="flex items-start gap-3">
        <TemplateBadge templateId={server.template} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block max-w-full truncate text-left text-[15px] font-extrabold transition-colors hover:text-accent"
            onClick={() => openServer(server.id)}
          >
            {server.name}
          </button>
          <div className="truncate text-[11px] font-bold tracking-[0.1em] text-steel uppercase">{t.name}</div>
        </div>
        <StatusBadge status={server.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] font-semibold text-steel">
        <CopyAddress value={`${server.ip}:${server.port}`} />
        <span className="rounded-md border border-line bg-fill px-2 py-1">{node ? `${node.region} · ${node.name}` : server.node}</span>
        {server.ownerName ? <span className="truncate">@{server.ownerName}</span> : null}
      </div>
      <div className="mt-4 grid gap-2.5">
        <MeterRow
          icon={<Cpu className="size-3.5" />}
          label="CPU"
          value={tel ? `${tel.cpu.toFixed(0)}% / ${server.cpuLimit}%` : "—"}
          current={tel?.cpu ?? 0}
          max={server.cpuLimit}
        />
        <MeterRow
          icon={<MemoryStick className="size-3.5" />}
          label="Memory"
          value={tel ? `${formatMb(tel.memMb)} / ${formatMb(server.memoryMb)}` : "—"}
          current={tel?.memMb ?? 0}
          max={server.memoryMb}
        />
        <MeterRow
          icon={<HardDrive className="size-3.5" />}
          label="Disk"
          value={tel ? `${formatMb(tel.diskMb)} / ${formatMb(server.diskMb)}` : "—"}
          current={tel?.diskMb ?? 0}
          max={server.diskMb}
        />
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-steel">
          <Clock className="size-3.5 shrink-0" />
          <span className="truncate">{uptimeLabel(server, now)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <PowerButtons server={server} compact />
          <button type="button" className="btn-ghost min-h-9 px-3 text-[12px]" onClick={() => openServer(server.id)}>
            <Terminal className="size-3.5" /> Manage
          </button>
        </div>
      </div>
    </div>
  );
}

function MeterRow({ icon, label, value, current, max }: { icon: ReactNode; label: string; value: string; current: number; max: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11.5px] font-bold">
        <span className="flex items-center gap-1.5 text-steel">
          {icon}
          {label}
        </span>
        <span className="font-mono text-[11px] font-medium text-ice">{value}</span>
      </div>
      <Meter value={current} max={max} />
    </div>
  );
}

function CopyAddress({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-sunken px-2 py-1 font-mono text-[11.5px] text-ice transition-colors hover:border-line-strong"
      title="Copy address"
      onClick={() => {
        if (!navigator.clipboard) {
          toast.error("Clipboard unavailable in this context");
          return;
        }
        navigator.clipboard.writeText(value).then(
          () => toast.success(`Copied ${value}`),
          () => toast.error("Clipboard unavailable in this context"),
        );
      }}
    >
      {value}
      <Copy className="size-3 text-steel" />
    </button>
  );
}

function PowerButtons({
  server,
  compact,
  onResult,
}: {
  server: ServerDto;
  compact?: boolean;
  onResult?: (data: ServerSnapshot) => void;
}) {
  const { upsertServer } = usePanel();
  const [pending, setPending] = useState<PowerAction | null>(null);

  async function run(action: PowerAction) {
    if (action === "kill" && !window.confirm(`Force-kill ${server.name}? Unsaved data may be lost.`)) return;
    setPending(action);
    try {
      const data = await api<ServerSnapshot>(`/api/servers/${server.id}`, { body: { type: "power", action } });
      upsertServer(data.server);
      onResult?.(data);
      toast.success(`${ACTION_LABEL[action]} signal sent to ${server.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Power action failed");
    } finally {
      setPending(null);
    }
  }

  const canStart = server.status === "offline";
  const canRestart = server.status === "running";
  const canStop = server.status === "running" || server.status === "starting";
  const canKill = server.status !== "offline";
  const icon = (action: PowerAction, node: ReactNode) => (pending === action ? <Spinner /> : node);

  if (compact) {
    return (
      <>
        <button type="button" className="icon-btn ok" disabled={!canStart || !!pending} onClick={() => void run("start")} title="Start" aria-label="Start">
          {icon("start", <Play className="size-4" />)}
        </button>
        <button type="button" className="icon-btn warn" disabled={!canRestart || !!pending} onClick={() => void run("restart")} title="Restart" aria-label="Restart">
          {icon("restart", <RotateCw className="size-4" />)}
        </button>
        <button type="button" className="icon-btn danger" disabled={!canStop || !!pending} onClick={() => void run("stop")} title="Stop" aria-label="Stop">
          {icon("stop", <Square className="size-4" />)}
        </button>
      </>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn-accent" disabled={!canStart || !!pending} onClick={() => void run("start")}>
        {icon("start", <Play className="size-4" />)} Start
      </button>
      <button type="button" className="btn-ghost" disabled={!canRestart || !!pending} onClick={() => void run("restart")}>
        {icon("restart", <RotateCw className="size-4" />)} Restart
      </button>
      <button type="button" className="btn-ghost" disabled={!canStop || !!pending} onClick={() => void run("stop")}>
        {icon("stop", <Square className="size-4" />)} Stop
      </button>
      <button type="button" className="btn-danger min-h-11" disabled={!canKill || !!pending} onClick={() => void run("kill")}>
        {icon("kill", <Skull className="size-4" />)} Kill
      </button>
    </div>
  );
}

// ── Create ──────────────────────────────────────────────────────────────────
function CreateServerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { setServers, openServer } = usePanel();
  const [name, setName] = useState("");
  const [template, setTemplate] = useState(SERVER_TEMPLATES[0].id);
  const [node, setNode] = useState(NODES[0].id);
  const [memoryMb, setMemoryMb] = useState(4096);
  const [cpuLimit, setCpuLimit] = useState(200);
  const [diskMb, setDiskMb] = useState(20480);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ server: ServerDto; servers: ServerDto[] }>("/api/servers", {
        body: { name, template, node, memoryMb, cpuLimit, diskMb },
      });
      setServers(res.servers);
      toast.success(`${res.server.name} deployed — press Start to boot it`);
      setName("");
      onClose();
      openServer(res.server.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Server" subtitle="Pick a template, a node and resource limits." wide>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Server name">
          <input
            className="panel-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Creative World"
            maxLength={40}
            required
            autoFocus
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-[12px] font-bold text-steel">Template</span>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SERVER_TEMPLATES.map((t) => (
              <button
                type="button"
                key={t.id}
                className={cn("select-tile flex items-center gap-3 p-3 text-left", template === t.id && "active")}
                onClick={() => setTemplate(t.id)}
              >
                <TemplateBadge templateId={t.id} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-extrabold">{t.name}</span>
                  <span className="block text-[10.5px] font-bold tracking-[0.1em] text-steel uppercase">
                    {t.category} · port {t.defaultPort}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Node">
            <select className="panel-input" value={node} onChange={(e) => setNode(e.target.value)}>
              {NODES.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.region})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Memory">
            <select className="panel-input" value={memoryMb} onChange={(e) => setMemoryMb(Number(e.target.value))}>
              {MEMORY_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {formatMb(m)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="CPU limit">
            <select className="panel-input" value={cpuLimit} onChange={(e) => setCpuLimit(Number(e.target.value))}>
              {CPU_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}% · {c / 100} vCPU
                </option>
              ))}
            </select>
          </Field>
          <Field label="Disk">
            <select className="panel-input" value={diskMb} onChange={(e) => setDiskMb(Number(e.target.value))}>
              {DISK_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {formatMb(d)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-accent" disabled={busy || name.trim().length < 2}>
            {busy ? <Spinner /> : <Plus className="size-4" />} Deploy Server
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Detail ──────────────────────────────────────────────────────────────────
function ServerDetail({ id }: { id: string }) {
  const { servers, openServer, upsertServer, setServers } = usePanel();
  const [server, setServer] = useState<ServerDto | null>(() => servers.find((s) => s.id === id) ?? null);
  const [events, setEvents] = useState<ServerEventDto[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [history, setHistory] = useState<{ cpu: number[]; mem: number[] }>({ cpu: [], mem: [] });
  const now = useNow(1000);
  const serverRef = useRef(server);
  serverRef.current = server;

  const apply = useCallback(
    (data: ServerSnapshot) => {
      setServer(data.server);
      setEvents(data.events);
      upsertServer(data.server);
    },
    [upsertServer],
  );

  const load = useCallback(async () => {
    try {
      apply(await api<ServerSnapshot>(`/api/servers/${id}`));
    } catch (err) {
      if (err instanceof Error && /not found/i.test(err.message)) setMissing(true);
    }
  }, [id, apply]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const s = serverRef.current;
    if (!now || !s) return;
    setHistory((h) => {
      if (h.cpu.length === 0) {
        // Backfill: telemetry is deterministic, so the recent past is reproducible.
        const cpu: number[] = [];
        const mem: number[] = [];
        for (let i = 47; i >= 0; i--) {
          const tel = sampleTelemetry(s, now - i * 1000);
          cpu.push(tel.cpu / s.cpuLimit);
          mem.push(tel.memMb / s.memoryMb);
        }
        return { cpu, mem };
      }
      const tel = sampleTelemetry(s, now);
      return { cpu: [...h.cpu.slice(-47), tel.cpu / s.cpuLimit], mem: [...h.mem.slice(-47), tel.memMb / s.memoryMb] };
    });
  }, [now]);

  if (missing || !server) {
    return (
      <div className="glass">
        <EmptyState
          icon={<ServerIcon className="size-5" />}
          title={missing ? "Server not found" : "Loading server…"}
          body={missing ? "It may have been deleted, or you no longer have access." : "Connecting to the daemon."}
          action={
            <button type="button" className="btn-ghost" onClick={() => openServer(null)}>
              <ArrowLeft className="size-4" /> Back to servers
            </button>
          }
        />
      </div>
    );
  }

  const t = getTemplate(server.template);
  const tel = now ? sampleTelemetry(server, now) : null;
  const node = NODES.find((n) => n.id === server.node);

  return (
    <div className="grid gap-4">
      <button
        type="button"
        className="inline-flex w-fit items-center gap-2 text-[13px] font-bold text-steel transition-colors hover:text-ice"
        onClick={() => openServer(null)}
      >
        <ArrowLeft className="size-4" /> Back to servers
      </button>

      <div className="glass p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <TemplateBadge templateId={server.template} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-[22px] font-extrabold tracking-tight">{server.name}</h2>
                <StatusBadge status={server.status} />
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-steel">
                <span>{t.name}</span>
                <span className="opacity-50">•</span>
                <CopyAddress value={`${server.ip}:${server.port}`} />
                <span className="opacity-50">•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {uptimeLabel(server, now)}
                </span>
              </div>
            </div>
          </div>
          <PowerButtons server={server} onResult={apply} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Cpu className="size-4" />}
          label="CPU Load"
          value={tel ? `${tel.cpu.toFixed(1)}%` : "—"}
          sub={`of ${server.cpuLimit}% · ${server.cpuLimit / 100} vCPU`}
          spark={history.cpu}
        />
        <StatTile
          icon={<MemoryStick className="size-4" />}
          label="Memory"
          value={tel ? formatMb(tel.memMb) : "—"}
          sub={`of ${formatMb(server.memoryMb)}`}
          spark={history.mem}
        />
        <StatTile
          icon={<HardDrive className="size-4" />}
          label="Disk"
          value={tel ? formatMb(tel.diskMb) : "—"}
          sub={`of ${formatMb(server.diskMb)}`}
        >
          <Meter value={tel?.diskMb ?? 0} max={server.diskMb} className="mt-3" />
        </StatTile>
        <StatTile
          icon={<Network className="size-4" />}
          label="Network"
          value={tel ? `↓ ${formatRate(tel.netIn)}` : "—"}
          sub={tel ? `↑ ${formatRate(tel.netOut)} outbound` : "outbound"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ConsolePanel server={server} events={events} onUpdate={apply} image={t.image} />
        <div className="grid content-start gap-4">
          <section className="glass p-5">
            <h3 className="text-[14px] font-extrabold">Server details</h3>
            <dl className="mt-3 grid gap-2.5 text-[12.5px]">
              <DetailRow label="Node" value={node ? `${node.name} · ${node.id}` : server.node} />
              <DetailRow label="Address" value={`${server.ip}:${server.port}`} mono />
              <DetailRow label="Image" value={t.image} mono />
              <DetailRow label="Owner" value={server.ownerName ? `@${server.ownerName}` : "—"} />
              <DetailRow label="Created" value={formatJoined(server.createdAt)} />
              <DetailRow label="Server ID" value={server.id} mono />
            </dl>
          </section>
          <ServerSettingsCard
            server={server}
            onRenamed={(s) => {
              setServer(s);
              upsertServer(s);
            }}
            onDeleted={(list) => {
              setServers(list);
              openServer(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
  spark,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
  spark?: number[];
  children?: ReactNode;
}) {
  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-[0.12em] text-steel uppercase">{label}</span>
        <span className="grid size-8 place-items-center rounded-[9px] border border-accent/35 bg-accent/12 text-accent">{icon}</span>
      </div>
      <div className="mt-2 font-mono text-[20px] font-semibold tracking-tight">{value}</div>
      <div className="text-[11.5px] font-semibold text-steel">{sub}</div>
      {spark ? <Sparkline values={spark} className="mt-3 h-10 w-full" /> : null}
      {children}
    </div>
  );
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const gradientId = useId().replace(/:/g, "");
  const w = 200;
  const h = 40;
  if (values.length < 2) return <div className={className} />;
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - Math.min(1, Math.max(0, v)) * (h - 6)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#${gradientId})`} />
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 font-bold text-steel">{label}</dt>
      <dd className={cn("min-w-0 text-right font-semibold break-all", mono && "font-mono text-[11.5px] font-medium")}>{value}</dd>
    </div>
  );
}

function ConsolePanel({
  server,
  events,
  onUpdate,
  image,
}: {
  server: ServerDto;
  events: ServerEventDto[] | null;
  onUpdate: (data: ServerSnapshot) => void;
  image: string;
}) {
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const running = server.status === "running";

  useEffect(() => {
    const el = boxRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [events]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = command.trim();
    if (!text) return;
    setSending(true);
    try {
      const data = await api<ServerSnapshot>(`/api/servers/${server.id}`, { body: { type: "command", command: text } });
      onUpdate(data);
      setRecent((r) => [text, ...r.filter((c) => c !== text)].slice(0, 30));
      setCursor(-1);
      setCommand("");
      stick.current = true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Command failed");
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp" && recent.length) {
      event.preventDefault();
      const next = Math.min(cursor + 1, recent.length - 1);
      setCursor(next);
      setCommand(recent[next]);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = cursor - 1;
      setCursor(Math.max(-1, next));
      setCommand(next >= 0 ? recent[next] : "");
    }
  }

  return (
    <section className="glass flex min-w-0 flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal className="size-4 shrink-0 text-accent" />
          <h3 className="text-[14px] font-extrabold">Console</h3>
          <span className="truncate font-mono text-[11px] text-steel">{image}</span>
        </div>
        <span className={cn("inline-flex items-center gap-2 text-[11px] font-extrabold uppercase", running ? "text-ok" : "text-steel")}>
          <span className={cn("status-dot", server.status, running && "live-ping")} />
          {running ? "Live" : server.status}
        </span>
      </div>
      <div
        ref={boxRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
        className="console scrollbar-thin h-[420px] overflow-y-auto p-4"
      >
        {events === null ? (
          <div className="ts">Connecting to daemon…</div>
        ) : events.length === 0 ? (
          <div className="ts">No output yet.</div>
        ) : (
          events.map((e) => (
            <div key={e.id} className={cn("break-words whitespace-pre-wrap", `lvl-${e.level}`)}>
              <span className="ts">[{new Date(e.createdAt).toLocaleTimeString([], { hour12: false })}]</span>{" "}
              {e.level === "cmd" ? `> ${e.message}` : e.message}
            </div>
          ))
        )}
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 font-mono text-[13px] font-semibold text-accent">$</span>
          <input
            className="panel-input pl-8 font-mono text-[13px]"
            placeholder={running ? "Type a command… try: help" : "Start the server to use the console"}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={!running || sending}
            maxLength={200}
            aria-label="Console command"
          />
        </div>
        <button type="submit" className="btn-accent" disabled={!running || sending || !command.trim()}>
          {sending ? <Spinner /> : <Send className="size-4" />}
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </section>
  );
}

function ServerSettingsCard({
  server,
  onRenamed,
  onDeleted,
}: {
  server: ServerDto;
  onRenamed: (server: ServerDto) => void;
  onDeleted: (servers: ServerDto[]) => void;
}) {
  const [name, setName] = useState(server.name);
  const [busy, setBusy] = useState(false);

  async function rename(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ server: ServerDto }>(`/api/servers/${server.id}`, { method: "PATCH", body: { name } });
      onRenamed(res.server);
      toast.success("Server renamed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${server.name}? This permanently removes the server and its console history.`)) return;
    setBusy(true);
    try {
      const res = await api<{ servers: ServerDto[] }>(`/api/servers/${server.id}`, { method: "DELETE" });
      toast.success(`${server.name} deleted`);
      onDeleted(res.servers);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      setBusy(false);
    }
  }

  return (
    <section className="glass p-5">
      <h3 className="text-[14px] font-extrabold">Settings</h3>
      <form onSubmit={rename} className="mt-3 flex gap-2">
        <input className="panel-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Server name" />
        <button type="submit" className="btn-ghost shrink-0" disabled={busy || name.trim() === server.name || name.trim().length < 2}>
          Rename
        </button>
      </form>
      <div className="mt-4 rounded-[12px] border border-danger/30 bg-danger/8 p-3">
        <div className="text-[12.5px] font-extrabold text-danger">Danger zone</div>
        <p className="mt-0.5 text-[11.5px] font-semibold text-steel">Deleting a server wipes its files and console history.</p>
        <button type="button" className="btn-danger mt-2.5 w-full" disabled={busy} onClick={() => void remove()}>
          <Trash className="size-4" /> Delete server
        </button>
      </div>
    </section>
  );
}
