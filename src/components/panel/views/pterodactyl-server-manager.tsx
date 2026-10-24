"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Activity,
  Box,
  Blocks,
  Copy,
  Cpu,
  Files,
  HardDrive,
  LoaderCircle,
  MemoryStick,
  Network,
  OctagonX,
  Play,
  Power,
  RefreshCw,
  RotateCw,
  Server,
  Square,
} from "lucide-react";
import { api, formatDuration } from "@/lib/utils";
import { Meter, Modal } from "../ui";
import { PterodactylFiles } from "./pterodactyl-files";
import { PterodactylMinecraft } from "./pterodactyl-minecraft";
import { PterodactylNetwork } from "./pterodactyl-network";
import {
  copyText,
  formatBytes,
  formatMegabytes,
  numberOf,
  objectOf,
  optionalNumber,
  textOf,
  type ApiItem,
  type ResourceView,
} from "./pterodactyl-shared";

type ManagerTab = "overview" | "network" | "minecraft" | "files";
type PowerAction = "start" | "restart" | "stop" | "kill";

export function PterodactylServerManager({ server }: { server: ApiItem }) {
  const a = server.attributes ?? {};
  const identifier = textOf(a.identifier, "");
  const [tab, setTab] = useState<ManagerTab>("overview");
  const [resources, setResources] = useState<ResourceView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [powerAction, setPowerAction] = useState<PowerAction | "">("");
  const [confirmKill, setConfirmKill] = useState(false);
  const base = `/api/integrations/pterodactyl/servers/${encodeURIComponent(identifier)}`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<ResourceView>(`${base}/resources`);
      setResources(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load server resources.");
    } finally {
      setLoading(false);
    }
  }, [base]);

  // The manager is keyed by server identifier, so this loads the selected server.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const power = async (action: PowerAction) => {
    setPowerAction(action);
    try {
      await api(`${base}/power`, { method: "POST", body: { action } });
      toast.success(`${action[0].toUpperCase()}${action.slice(1)} signal sent to ${textOf(a.name, "server")}`);
      setConfirmKill(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Power action failed.");
    } finally {
      setPowerAction("");
    }
  };

  const state = resources?.attributes?.current_state ?? "unknown";
  const values = resources?.attributes?.resources;
  const limits = objectOf(a.limits);
  const features = objectOf(a.feature_limits);
  const memoryLimit = numberOf(limits.memory);
  const diskLimit = numberOf(limits.disk);
  const cpuLimit = numberOf(limits.cpu);
  const memoryUsed = optionalNumber(values?.memory_bytes);
  const diskUsed = optionalNumber(values?.disk_bytes);
  const cpuUsed = optionalNumber(values?.cpu_absolute);
  const uptime = optionalNumber(values?.uptime);

  const powerButtons: { action: PowerAction; label: string; icon: typeof Play; className: string }[] = [
    { action: "start", label: "Start", icon: Play, className: "btn-ghost border-ok/25 text-ok hover:bg-ok/10" },
    { action: "restart", label: "Restart", icon: RotateCw, className: "btn-ghost" },
    { action: "stop", label: "Stop", icon: Square, className: "btn-ghost" },
    { action: "kill", label: "Kill", icon: OctagonX, className: "btn-danger" },
  ];

  return (
    <>
      <div className="glass min-w-0 overflow-hidden">
        <div className="border-b border-line p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/12 text-accent"><Server className="size-5" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[17px] font-extrabold">{textOf(a.name, "Unnamed server")}</h3>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-[0.08em] uppercase ${state === "running" ? "border-ok/25 bg-ok/10 text-ok" : state === "starting" || state === "stopping" ? "border-warn/25 bg-warn/10 text-warn" : "border-line bg-fill text-steel"}`}>
                    <span className={`status-dot ${state}`} />{state}
                  </span>
                </div>
                <button className="mt-1 flex items-center gap-1.5 font-mono text-[11px] font-semibold text-steel hover:text-ice" type="button" onClick={() => void copyText(identifier).then(() => toast.success("Server identifier copied")).catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Copy failed"))} title="Copy server identifier">
                  {identifier}<Copy className="size-3" />
                </button>
              </div>
            </div>
            <button className="icon-btn" type="button" onClick={() => void refresh()} disabled={loading || Boolean(powerAction)} aria-label="Refresh server resources" title="Refresh resources">
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {powerButtons.map(({ action, label, icon: Icon, className }) => (
              <button key={action} className={`${className} min-h-9 px-2 text-xs`} type="button" onClick={() => action === "kill" ? setConfirmKill(true) : void power(action)} disabled={Boolean(powerAction) || loading && !resources}>
                {powerAction === action ? <LoaderCircle className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />}{label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-line bg-sunken px-3 py-2" role="tablist" aria-label="Server management">
          {([
            ["overview", "Overview", Activity],
            ["network", "Network & ports", Network],
            ["minecraft", "Minecraft", Blocks],
            ["files", "Files", Files],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-extrabold transition-colors ${tab === id ? "bg-accent text-white shadow-[0_3px_12px_var(--accent-glow)]" : "text-steel hover:bg-fill hover:text-ice"}`} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
              <Icon className="size-3.5" />{label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {tab === "overview" ? (
            <div className="space-y-5">
              {error ? <div className="rounded-xl border border-warn/30 bg-warn/10 p-3 text-xs"><span className="font-extrabold text-warn">Live resources unavailable.</span><span className="ml-1 text-steel">{error}</span></div> : null}
              {loading && !resources ? (
                <div className="grid min-h-48 place-items-center text-steel"><div className="flex items-center gap-2 text-sm font-bold"><LoaderCircle className="size-4 animate-spin" /> Reading live resources…</div></div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ResourceMeter icon={<Cpu className="size-4" />} label="CPU load" value={cpuUsed === null ? "—" : `${cpuUsed.toFixed(1)}%`} hint={`Limit ${cpuLimit || "Unlimited"}${cpuLimit ? "%" : ""}`} meter={cpuUsed !== null && cpuLimit > 0 ? [cpuUsed, cpuLimit] : undefined} />
                    <ResourceMeter icon={<MemoryStick className="size-4" />} label="Memory" value={formatBytes(memoryUsed)} hint={`${formatMegabytes(memoryLimit)} allocated`} meter={memoryUsed !== null && memoryLimit > 0 ? [memoryUsed / 1048576, memoryLimit] : undefined} />
                    <ResourceMeter icon={<HardDrive className="size-4" />} label="Disk" value={formatBytes(diskUsed)} hint={`${formatMegabytes(diskLimit)} allocated`} meter={diskUsed !== null && diskLimit > 0 ? [diskUsed / 1048576, diskLimit] : undefined} />
                    <ResourceMeter icon={<Network className="size-4" />} label="Network" value={`↓ ${formatBytes(values?.network_rx_bytes)}`} hint={`↑ ${formatBytes(values?.network_tx_bytes)} uploaded`} />
                  </div>
                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
                    <SmallStat label="Uptime" value={uptime !== null && uptime > 0 ? formatDuration(uptime) : "Offline"} />
                    <SmallStat label="Node" value={textOf(a.node)} />
                    <SmallStat label="Database limit" value={textOf(features.databases, "0")} />
                    <SmallStat label="Backup limit" value={textOf(features.backups, "0")} />
                  </div>
                </>
              )}
              <div className="flex items-start gap-3 rounded-xl border border-line bg-sunken p-3 text-[11px] font-semibold text-steel">
                <Box className="mt-0.5 size-4 shrink-0 text-accent" />
                <p>Resource readings and power signals come directly from Wings through the configured Pterodactyl Client API. No local telemetry is substituted.</p>
              </div>
            </div>
          ) : null}
          {tab === "network" ? <PterodactylNetwork identifier={identifier} /> : null}
          {tab === "minecraft" ? <PterodactylMinecraft identifier={identifier} onOpenFiles={() => setTab("files")} /> : null}
          {tab === "files" ? <PterodactylFiles identifier={identifier} /> : null}
        </div>
      </div>

      <Modal open={confirmKill} onClose={() => { if (!powerAction) setConfirmKill(false); }} title="Kill this server process?" subtitle="This forcefully terminates the process and can corrupt unsaved game or application data. Use Stop for a graceful shutdown.">
        <div className="flex justify-end gap-2"><button className="btn-ghost" type="button" onClick={() => setConfirmKill(false)} disabled={Boolean(powerAction)}>Cancel</button><button className="btn-danger" type="button" onClick={() => void power("kill")} disabled={Boolean(powerAction)}>{powerAction === "kill" ? <LoaderCircle className="size-4 animate-spin" /> : <Power className="size-4" />} Kill server</button></div>
      </Modal>
    </>
  );
}

function ResourceMeter({ icon, label, value, hint, meter }: { icon: ReactNode; label: string; value: string; hint: string; meter?: [number, number] }) {
  return (
    <div className="rounded-xl border border-line bg-sunken p-4">
      <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.1em] text-steel uppercase">{icon}{label}</span><span className="font-mono text-sm font-extrabold">{value}</span></div>
      {meter ? <Meter value={meter[0]} max={meter[1]} className="mt-3" /> : <div className="mt-3 h-1.5" />}
      <div className="mt-2 text-[11px] font-semibold text-faint">{hint}</div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 bg-sunken p-3"><div className="text-[9px] font-extrabold tracking-[0.1em] text-faint uppercase">{label}</div><div className="mt-1 truncate text-xs font-extrabold" title={value}>{value}</div></div>;
}
