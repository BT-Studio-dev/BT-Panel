"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Activity,
  Boxes,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CloudCog,
  Copy,
  Globe2,
  HardDrive,
  LoaderCircle,
  MemoryStick,
  Network,
  Plus,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/utils";
import { EmptyState, Meter, Modal } from "../ui";
import { PterodactylServerManager } from "./pterodactyl-server-manager";
import {
  copyText,
  formatMegabytes,
  numberOf,
  objectOf,
  textOf,
  type ApiItem,
  type ApiList,
} from "./pterodactyl-shared";

type ConnectionStatus = {
  configured: boolean;
  applicationApiConfigured: boolean;
  clientApiConfigured: boolean;
  url: string | null;
  apiVersion: string;
};

type WorkspaceTab = "servers" | "nodes";

export function PterodactylView() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [nodes, setNodes] = useState<ApiItem[]>([]);
  const [servers, setServers] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodeError, setNodeError] = useState("");
  const [serverError, setServerError] = useState("");
  const [selected, setSelected] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>("servers");
  const [search, setSearch] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setNodeError("");
    setServerError("");
    try {
      const connection = await api<ConnectionStatus>("/api/integrations/pterodactyl/status");
      setStatus(connection);
      if (!connection.applicationApiConfigured && !connection.clientApiConfigured) {
        setNodes([]);
        setServers([]);
        setNodeError("Configure the Pterodactyl URL and API tokens on the BT Panel server.");
        setServerError("The Client API token is not configured.");
        return;
      }
      const [nodeResult, serverResult] = await Promise.allSettled([
        connection.applicationApiConfigured
          ? api<ApiList>("/api/integrations/pterodactyl/nodes?per_page=100")
          : Promise.reject(new Error("Application API token not configured.")),
        connection.clientApiConfigured
          ? api<ApiList>("/api/integrations/pterodactyl/client-servers")
          : Promise.reject(new Error("Client API token not configured.")),
      ]);
      if (nodeResult.status === "fulfilled") {
        setNodes(Array.isArray(nodeResult.value.data) ? nodeResult.value.data : []);
      } else {
        setNodes([]);
        setNodeError(nodeResult.reason instanceof Error ? nodeResult.reason.message : "Could not load nodes.");
      }
      if (serverResult.status === "fulfilled") {
        setServers(Array.isArray(serverResult.value.data) ? serverResult.value.data : []);
      } else {
        setServers([]);
        setServerError(serverResult.reason instanceof Error ? serverResult.reason.message : "Could not load client servers.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not check integration configuration.";
      setStatus(null);
      setNodeError(message);
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial data load belongs to this effect; refresh is intentionally asynchronous.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const createServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCreating(true);
    const form = new FormData(formElement);
    let environment: Record<string, string> = {};
    try {
      const parsed: unknown = JSON.parse(String(form.get("environment") || "{}"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
          Object.values(parsed).some((value) => typeof value !== "string")) {
        throw new Error("Environment must be a JSON object containing string values.");
      }
      environment = parsed as Record<string, string>;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid environment JSON.");
      setCreating(false);
      return;
    }

    const num = (key: string) => Number(form.get(key));
    const payload = {
      name: String(form.get("name") || "").trim(),
      user: num("user"),
      egg: num("egg"),
      docker_image: String(form.get("docker_image") || "").trim() || undefined,
      startup: String(form.get("startup") || "").trim() || undefined,
      environment,
      limits: { memory: num("memory"), swap: num("swap"), disk: num("disk"), io: num("io"), cpu: num("cpu") },
      feature_limits: { databases: num("databases"), allocations: num("allocations"), backups: num("backups") },
      allocation: { default: num("allocation") },
    };
    try {
      const result = await api<{ attributes?: { name?: string; identifier?: string } }>("/api/integrations/pterodactyl/servers", {
        method: "POST",
        body: payload,
      });
      const attributes = result.attributes ?? {};
      toast.success("Created Pterodactyl server: " + textOf(attributes.name, payload.name));
      setShowCreate(false);
      formElement.reset();
      if (attributes.identifier) setSelected(attributes.identifier);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Server provisioning failed.");
    } finally {
      setCreating(false);
    }
  };

  const filteredServers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return servers;
    return servers.filter((item) => {
      const a = item.attributes ?? {};
      return [a.name, a.node, a.identifier, a.uuid].some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [search, servers]);

  const selectedServer = servers.find((item) => textOf(item.attributes?.identifier, "") === selected) ?? null;
  const activeNodes = nodes.filter((item) => item.attributes?.maintenance_mode !== true).length;

  const copyValue = async (value: string, message: string) => {
    try {
      await copyText(value);
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy to the clipboard.");
    }
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[10px] font-extrabold tracking-[0.16em] text-accent uppercase">
            <span className="h-px w-5 bg-accent" /> Pterodactyl 1.x workspace
          </div>
          <h2 className="text-[25px] font-extrabold tracking-tight">Infrastructure</h2>
          <p className="mt-1 max-w-2xl text-[13px] font-semibold text-steel">Manage real game servers, Wings nodes, connection ports, and remote files from one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh
          </button>
          <button className="btn-accent" type="button" onClick={() => setShowCreate(true)} disabled={!status?.applicationApiConfigured || creating} title={!status?.applicationApiConfigured ? "Configure the Application API token first" : "Provision a real Pterodactyl server"}>
            <Plus className="size-4" /> Provision server
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={<Server className="size-4" />} label="Accessible servers" value={String(servers.length)} hint="Client API inventory" />
        <SummaryCard icon={<Boxes className="size-4" />} label="Deployment nodes" value={String(nodes.length)} hint={`${activeNodes} accepting deployments`} />
        <SummaryCard icon={<Network className="size-4" />} label="Wings endpoints" value={String(nodes.filter((item) => item.attributes?.daemon_listen !== undefined).length)} hint="Daemon & SFTP ports" />
        <SummaryCard icon={<CloudCog className="size-4" />} label="Panel API" value={status?.url ? new URL(status.url).hostname : "Not connected"} hint={status?.apiVersion ?? "Configuration required"} mono />
      </div>

      <div className="glass flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`relative size-2.5 shrink-0 rounded-full ${status?.applicationApiConfigured || status?.clientApiConfigured ? "bg-ok shadow-[0_0_10px_rgb(74_222_128/0.5)]" : "bg-warn"}`} />
          <div className="min-w-0">
            <div className="truncate text-xs font-extrabold">{status?.url ?? "Pterodactyl connection not configured"}</div>
            <div className="mt-0.5 text-[10px] font-semibold text-steel">Credentials stay on the BT Panel server and are never sent to browser code.</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold">
          <CredentialState label="Application API" configured={Boolean(status?.applicationApiConfigured)} />
          <CredentialState label="Client API" configured={Boolean(status?.clientApiConfigured)} />
        </div>
      </div>

      {(nodeError || serverError) ? (
        <div role="status" className="rounded-[var(--panel-radius)] border border-warn/30 bg-warn/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-extrabold text-warn"><CircleAlert className="size-4" /> Integration setup / API notice</div>
          <div className="mt-2 grid gap-1 text-xs text-steel">
            {nodeError ? <p><span className="font-bold text-ice">Nodes:</span> {nodeError}</p> : null}
            {serverError ? <p><span className="font-bold text-ice">Servers:</span> {serverError}</p> : null}
          </div>
          <p className="mt-2 text-xs text-steel">Set <code className="font-mono text-[11px] text-ice">PTERODACTYL_URL</code> and the required tokens in the server environment, restart BT Panel, then refresh. File, port, resource, and power access also requires the corresponding Pterodactyl user permissions.</p>
        </div>
      ) : null}

      <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-sunken p-1" role="tablist" aria-label="Infrastructure sections">
        <button className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-xs font-extrabold transition-colors ${tab === "servers" ? "bg-accent text-white shadow-[0_3px_12px_var(--accent-glow)]" : "text-steel hover:bg-fill hover:text-ice"}`} type="button" role="tab" aria-selected={tab === "servers"} onClick={() => setTab("servers")}><Server className="size-4" /> Servers <span className="opacity-65">{servers.length}</span></button>
        <button className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-xs font-extrabold transition-colors ${tab === "nodes" ? "bg-accent text-white shadow-[0_3px_12px_var(--accent-glow)]" : "text-steel hover:bg-fill hover:text-ice"}`} type="button" role="tab" aria-selected={tab === "nodes"} onClick={() => setTab("nodes")}><Boxes className="size-4" /> Nodes & Wings <span className="opacity-65">{nodes.length}</span></button>
      </div>

      {tab === "servers" ? (
        <div className="grid items-start gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
          <section className="glass overflow-hidden">
            <div className="border-b border-line p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-steel" />
                <input className="panel-input min-h-10 pl-9 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search servers…" aria-label="Search Pterodactyl servers" />
              </div>
            </div>
            <div className="scrollbar-thin max-h-[680px] overflow-y-auto p-2">
              {filteredServers.length === 0 ? (
                <EmptyState icon={<Server className="size-5" />} title={servers.length ? "No matching servers" : "No accessible servers"} body={servers.length ? "Try a different name, node, or identifier." : "Servers visible to the configured Pterodactyl Client API user will appear here."} />
              ) : (
                <div className="space-y-1">
                  {filteredServers.map((item, index) => {
                    const a = item.attributes ?? {};
                    const identifier = textOf(a.identifier, "");
                    const active = identifier === selected;
                    return (
                      <button key={identifier || textOf(a.uuid, String(index))} className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${active ? "border-accent/35 bg-accent/12" : "border-transparent hover:border-line hover:bg-fill"}`} type="button" onClick={() => setSelected(identifier)} disabled={!identifier}>
                        <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${active ? "border-accent/35 bg-accent/15 text-accent" : "border-line bg-sunken text-steel group-hover:text-ice"}`}><Server className="size-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-extrabold">{textOf(a.name, "Unnamed server")}</span>
                          <span className="mt-0.5 block truncate text-[10px] font-semibold text-steel">{textOf(a.node, "Unknown node")} · <span className="font-mono">{identifier || "No identifier"}</span></span>
                        </span>
                        <ChevronRight className={`size-4 shrink-0 ${active ? "text-accent" : "text-faint"}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="border-t border-line bg-sunken px-4 py-2.5 text-[10px] font-bold text-faint">Access follows the configured Client API user.</div>
          </section>

          {selectedServer ? <PterodactylServerManager key={selected} server={selectedServer} /> : (
            <section className="glass grid min-h-[360px] place-items-center p-6">
              <EmptyState icon={<Activity className="size-5" />} title="Select a server to manage" body="View live Wings resources, send power signals, assign connection ports, and manage files on the real remote server." />
            </section>
          )}
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><h3 className="text-[16px] font-extrabold">Nodes & Wings</h3><p className="mt-1 text-xs font-semibold text-steel">Node capacity and daemon connection settings returned by the Application API.</p></div>
            <span className="rounded-full border border-line bg-fill px-3 py-1 text-[10px] font-extrabold text-steel">{activeNodes} active · {nodes.length - activeNodes} maintenance</span>
          </div>
          {nodes.length === 0 ? (
            <div className="glass"><EmptyState icon={<Boxes className="size-5" />} title="No nodes to display" body="Check that the Application API token can list nodes, then refresh this workspace." /></div>
          ) : (
            <div className="grid items-start gap-4 2xl:grid-cols-2">
              {nodes.map((item, index) => <NodeCard key={textOf(item.attributes?.id, String(index))} item={item} onCopy={copyValue} />)}
            </div>
          )}
        </section>
      )}

      <Modal wide open={showCreate} onClose={() => { if (!creating) setShowCreate(false); }} title="Provision a real Pterodactyl server" subtitle="This allocates real capacity on your upstream panel. Use IDs that exist in your own installation.">
        <form className="space-y-4" onSubmit={createServer}>
          <div className="flex items-start gap-3 rounded-xl border border-warn/25 bg-warn/10 p-3 text-xs font-semibold text-steel"><CircleAlert className="mt-0.5 size-4 shrink-0 text-warn" /><p>The user, egg, Docker image, startup command, environment, and primary allocation must match the selected egg. Review carefully before creating.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ProvisionField label="Server name" name="name" required maxLength={191} />
            <ProvisionField label="Pterodactyl user ID" name="user" type="number" min={1} required />
            <ProvisionField label="Egg ID" name="egg" type="number" min={1} required />
            <ProvisionField label="Primary allocation ID" name="allocation" type="number" min={1} required />
            <ProvisionField label="Memory (MB)" name="memory" type="number" min={1} defaultValue="4096" required />
            <ProvisionField label="Swap (MB, -1 allowed)" name="swap" type="number" min={-1} defaultValue="0" required />
            <ProvisionField label="Disk (MB)" name="disk" type="number" min={1} defaultValue="20480" required />
            <ProvisionField label="CPU limit (%)" name="cpu" type="number" min={0} defaultValue="200" required />
            <ProvisionField label="I/O weight" name="io" type="number" min={10} max={1000} defaultValue="500" required />
            <ProvisionField label="Databases allowed" name="databases" type="number" min={0} defaultValue="0" required />
            <ProvisionField label="Allocations allowed" name="allocations" type="number" min={0} defaultValue="0" required />
            <ProvisionField label="Backups allowed" name="backups" type="number" min={0} defaultValue="1" required />
            <label className="text-xs font-bold text-steel sm:col-span-2 lg:col-span-3">Docker image (optional)<input className="panel-input mt-1.5" name="docker_image" placeholder="Use the egg’s default image" /></label>
            <label className="text-xs font-bold text-steel sm:col-span-2 lg:col-span-3">Startup command override (optional)<input className="panel-input mt-1.5" name="startup" placeholder="Use the egg’s default startup command" /></label>
            <label className="text-xs font-bold text-steel sm:col-span-2 lg:col-span-3">Egg environment JSON<textarea className="panel-input mt-1.5 min-h-24 font-mono text-xs" name="environment" defaultValue="{}" spellCheck={false} /></label>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button className="btn-ghost" type="button" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
            <button className="btn-accent" type="submit" disabled={creating}>{creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Create real server</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SummaryCard({ icon, label, value, hint, mono }: { icon: ReactNode; label: string; value: string; hint: string; mono?: boolean }) {
  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between gap-3"><span className="text-[10px] font-extrabold tracking-[0.11em] text-steel uppercase">{label}</span><span className="grid size-8 place-items-center rounded-lg border border-accent/25 bg-accent/10 text-accent">{icon}</span></div>
      <div className={`mt-1 truncate text-[22px] font-extrabold tracking-tight ${mono ? "font-mono text-[16px]" : ""}`} title={value}>{value}</div>
      <div className="mt-1 truncate text-[11px] font-semibold text-faint">{hint}</div>
    </div>
  );
}

function CredentialState({ label, configured }: { label: string; configured: boolean }) {
  return <span className={`flex items-center gap-1.5 ${configured ? "text-ok" : "text-warn"}`}>{configured ? <CheckCircle2 className="size-3.5" /> : <CircleAlert className="size-3.5" />}{label}<span className="font-semibold text-steel">{configured ? "configured" : "missing"}</span></span>;
}

function NodeCard({ item, onCopy }: { item: ApiItem; onCopy: (value: string, message: string) => Promise<void> }) {
  const a = item.attributes ?? {};
  const allocated = objectOf(a.allocated_resources);
  const maintenance = a.maintenance_mode === true;
  const scheme = textOf(a.scheme, "https");
  const fqdn = textOf(a.fqdn);
  const daemonPort = textOf(a.daemon_listen, "8080");
  const endpoint = `${scheme}://${fqdn}:${daemonPort}`;
  const memory = numberOf(a.memory);
  const disk = numberOf(a.disk);
  const allocatedMemory = numberOf(allocated.memory);
  const allocatedDisk = numberOf(allocated.disk);
  return (
    <article className="glass overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl border ${maintenance ? "border-warn/30 bg-warn/10 text-warn" : "border-ok/25 bg-ok/10 text-ok"}`}><Boxes className="size-5" /></span>
          <div className="min-w-0"><h4 className="truncate text-[15px] font-extrabold">{textOf(a.name, "Unnamed node")}</h4><p className="mt-0.5 truncate font-mono text-[11px] text-steel">{fqdn} · Location {textOf(a.location_id)}</p></div>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-extrabold tracking-[0.08em] uppercase ${maintenance ? "border-warn/25 bg-warn/10 text-warn" : "border-ok/25 bg-ok/10 text-ok"}`}>{maintenance ? <Wrench className="size-3" /> : <Check className="size-3" />}{maintenance ? "Maintenance" : "Active"}</span>
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.15fr]">
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-sunken p-3">
            <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.09em] text-steel uppercase"><Globe2 className="size-3.5 text-accent" /> Wings API</span><button className="icon-btn size-7" type="button" onClick={() => void onCopy(endpoint, "Wings endpoint copied")} aria-label="Copy Wings endpoint" title="Copy Wings endpoint"><Copy className="size-3" /></button></div>
            <div className="mt-2 truncate font-mono text-xs font-bold" title={endpoint}>{endpoint}</div>
            <div className="mt-2 text-[10px] font-semibold text-faint">Daemon port {daemonPort}{a.behind_proxy === true ? " · Behind proxy" : ""}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NodeMiniStat icon={<Network className="size-3.5" />} label="SFTP port" value={textOf(a.daemon_sftp, "2022")} />
            <NodeMiniStat icon={<ShieldCheck className="size-3.5" />} label="Visibility" value={a.public === false ? "Private" : "Public"} />
          </div>
          <div className="rounded-xl border border-line bg-sunken px-3 py-2.5"><div className="text-[9px] font-extrabold tracking-[0.09em] text-faint uppercase">Server data directory</div><div className="mt-1 truncate font-mono text-[11px] font-semibold text-steel" title={textOf(a.daemon_base)}>{textOf(a.daemon_base)}</div></div>
        </div>
        <div className="space-y-4 rounded-xl border border-line bg-sunken p-4">
          <CapacityRow icon={<MemoryStick className="size-4" />} label="Memory" allocated={allocatedMemory} total={memory} />
          <CapacityRow icon={<HardDrive className="size-4" />} label="Disk" allocated={allocatedDisk} total={disk} />
          <div className="grid grid-cols-2 gap-2 border-t border-line pt-3 text-[10px] font-semibold text-steel"><span>Memory overallocate <strong className="ml-1 text-ice">{textOf(a.memory_overallocate, "0")}%</strong></span><span>Disk overallocate <strong className="ml-1 text-ice">{textOf(a.disk_overallocate, "0")}%</strong></span></div>
        </div>
      </div>
    </article>
  );
}

function NodeMiniStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-sunken p-3"><div className="flex items-center gap-1.5 text-[9px] font-extrabold tracking-[0.08em] text-faint uppercase">{icon}{label}</div><div className="mt-1.5 font-mono text-sm font-extrabold">{value}</div></div>;
}

function CapacityRow({ icon, label, allocated, total }: { icon: ReactNode; label: string; allocated: number; total: number }) {
  return <div><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.08em] text-steel uppercase">{icon}{label}</span><span className="font-mono text-[11px] font-bold">{formatMegabytes(allocated)} <span className="text-faint">/ {formatMegabytes(total)}</span></span></div><Meter value={allocated} max={total} className="mt-2.5" /><div className="mt-1.5 text-right text-[9px] font-semibold text-faint">{total > 0 ? Math.round(allocated / total * 100) : 0}% allocated</div></div>;
}

function ProvisionField({ label, name, type = "text", ...props }: { label: string; name: string; type?: string; required?: boolean; min?: number; max?: number; maxLength?: number; defaultValue?: string }) {
  return <label className="text-xs font-bold text-steel">{label}<input className="panel-input mt-1.5" name={name} type={type} {...props} /></label>;
}
