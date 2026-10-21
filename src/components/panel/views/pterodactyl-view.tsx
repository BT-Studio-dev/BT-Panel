"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Activity, Boxes, CheckCircle2, CircleAlert, CloudCog, Database, LoaderCircle, Plus, RefreshCw, Server, Power } from "lucide-react";
import { api } from "@/lib/utils";

type ApiItem = { attributes?: Record<string, unknown> };
type ApiList = { data?: ApiItem[]; meta?: unknown };
type ConnectionStatus = {
  configured: boolean;
  applicationApiConfigured: boolean;
  clientApiConfigured: boolean;
  url: string | null;
  apiVersion: string;
};
type ResourceView = {
  attributes?: {
    current_state?: string;
    resources?: {
      cpu_absolute?: number;
      memory_bytes?: number;
      disk_bytes?: number;
      network_rx_bytes?: number;
      network_tx_bytes?: number;
    };
  };
};

const toMB = (n: unknown) => typeof n === "number" && Number.isFinite(n) ? (n / (1024 * 1024)).toFixed(0) + " MB" : "—";
const toGB = (n: unknown) => typeof n === "number" && Number.isFinite(n) ? (n / 1024).toFixed(1) + " GB" : "—";
const textOf = (x: unknown, fallback = "—") => typeof x === "string" || typeof x === "number" ? String(x) : fallback;

export function PterodactylView() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [nodes, setNodes] = useState<ApiItem[]>([]);
  const [servers, setServers] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [nodeError, setNodeError] = useState("");
  const [serverError, setServerError] = useState("");
  const [selected, setSelected] = useState("");
  const [resources, setResources] = useState<Record<string, ResourceView>>({});
  const [resourceLoading, setResourceLoading] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setNodeError("");
    setServerError("");
    try {
      const s = await api<ConnectionStatus>("/api/integrations/pterodactyl/status");
      setStatus(s);
      if (!s.applicationApiConfigured && !s.clientApiConfigured) {
        setNodes([]);
        setServers([]);
        setNodeError("Configure the Pterodactyl URL and API tokens on the BT Panel server.");
        setServerError("The client API token is not configured.");
        return;
      }
      const [n, ss] = await Promise.allSettled([
        s.applicationApiConfigured ? api<ApiList>("/api/integrations/pterodactyl/nodes") : Promise.reject(new Error("Application API token not configured.")),
        s.clientApiConfigured ? api<ApiList>("/api/integrations/pterodactyl/client-servers") : Promise.reject(new Error("Client API token not configured.")),
      ]);
      if (n.status === "fulfilled") setNodes(Array.isArray(n.value.data) ? n.value.data : []);
      else { setNodes([]); setNodeError(n.reason instanceof Error ? n.reason.message : "Could not load nodes."); }
      if (ss.status === "fulfilled") setServers(Array.isArray(ss.value.data) ? ss.value.data : []);
      else { setServers([]); setServerError(ss.reason instanceof Error ? ss.reason.message : "Could not load client servers."); }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Could not check integration configuration.";
      setStatus(null);
      setNodeError(message);
      setServerError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadResources = async (identifier: string) => {
    if (!identifier) return;
    setSelected(identifier);
    setResourceLoading(identifier);
    try {
      const data = await api<ResourceView>("/api/integrations/pterodactyl/servers/" + encodeURIComponent(identifier) + "/resources");
      setResources((prev) => ({ ...prev, [identifier]: data }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load server resources.");
    } finally {
      setResourceLoading("");
    }
  };

  const power = async (identifier: string, action: "start" | "stop" | "restart" | "kill") => {
    try {
      await api("/api/integrations/pterodactyl/servers/" + encodeURIComponent(identifier) + "/power", {
        method: "POST", body: { action },
      });
      toast.success("Pterodactyl power action sent: " + action);
      await loadResources(identifier);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Power action failed.");
    }
  };

  const createServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCreating(true);
    const form = new FormData(formElement);
    let environment: Record<string, string> = {};
    try {
      const parsed: unknown = JSON.parse(String(form.get("environment") || "{}"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
          Object.values(parsed).some((v) => typeof v !== "string")) {
        throw new Error("Environment must be a JSON object containing string values.");
      }
      environment = parsed as Record<string, string>;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid environment JSON.");
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
        method: "POST", body: payload,
      });
      const attr = result.attributes ?? {};
      toast.success("Created Pterodactyl server: " + textOf(attr.name, payload.name));
      setShowCreate(false);
      formElement.reset();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Server provisioning failed.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CloudCog className="size-5 text-accent" />
            <h2 className="text-[22px] font-extrabold tracking-tight">Pterodactyl Integration</h2>
          </div>
          <p className="mt-1 max-w-3xl text-[13px] font-semibold text-steel">
            View configured nodes, access-authorized game servers, real resource readings and server power actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Refresh
          </button>
          <button className="btn-accent" type="button" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-4" /> Provision server
          </button>
        </div>
      </div>

      <div className="glass grid gap-3 p-4 md:grid-cols-3">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-fill p-2"><CloudCog className="size-5" /></span>
          <div className="min-w-0">
            <div className="text-xs font-bold text-steel">Panel API</div>
            <div className="mt-1 break-all text-sm font-extrabold">{status?.url ?? "Not configured"}</div>
            <div className="mt-1 text-xs text-steel">{status?.apiVersion ?? "Pterodactyl 1.x"}</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-fill p-2"><Database className="size-5" /></span>
          <div>
            <div className="text-xs font-bold text-steel">Application API token</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-extrabold">
              {status?.applicationApiConfigured ? <CheckCircle2 className="size-4 text-ok" /> : <CircleAlert className="size-4 text-warn" />}
              {status?.applicationApiConfigured ? "Configured" : "Missing"}
            </div>
            <div className="mt-1 text-xs text-steel">Used for node inventory and provisioning</div>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-fill p-2"><Activity className="size-5" /></span>
          <div>
            <div className="text-xs font-bold text-steel">Client API token</div>
            <div className="mt-1 flex items-center gap-2 text-sm font-extrabold">
              {status?.clientApiConfigured ? <CheckCircle2 className="size-4 text-ok" /> : <CircleAlert className="size-4 text-warn" />}
              {status?.clientApiConfigured ? "Configured" : "Missing"}
            </div>
            <div className="mt-1 text-xs text-steel">Resources and power actions, limited to its access</div>
          </div>
        </div>
      </div>

      {(nodeError || serverError) && (
        <div role="status" className="glass border border-warn/30 p-4 text-sm">
          <div className="font-extrabold">Integration setup / API warning</div>
          {nodeError ? <p className="mt-1 text-steel">Nodes: {nodeError}</p> : null}
          {serverError ? <p className="mt-1 text-steel">Servers: {serverError}</p> : null}
          <p className="mt-2 text-steel">Configure tokens in the BT Panel server's environment, restart the service, then refresh. Tokens are not entered into or exposed by this browser screen.</p>
        </div>
      )}

      {showCreate && (
        <form className="glass space-y-4 p-4" onSubmit={createServer}>
          <div>
            <h3 className="text-lg font-extrabold">Provision a real Pterodactyl server</h3>
            <p className="mt-1 text-xs text-steel">Use numeric user, egg and allocation IDs that exist in your Pterodactyl panel. This action creates a real server.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-bold text-steel">Server name<input className="panel-input mt-1" name="name" required maxLength={191} /></label>
            <label className="text-xs font-bold text-steel">Pterodactyl user ID<input className="panel-input mt-1" type="number" min="1" name="user" required /></label>
            <label className="text-xs font-bold text-steel">Egg ID<input className="panel-input mt-1" type="number" min="1" name="egg" required /></label>
            <label className="text-xs font-bold text-steel">Primary allocation ID<input className="panel-input mt-1" type="number" min="1" name="allocation" required /></label>
            <label className="text-xs font-bold text-steel">Memory (MB)<input className="panel-input mt-1" type="number" min="1" name="memory" defaultValue="4096" required /></label>
            <label className="text-xs font-bold text-steel">Swap (MB, -1 allowed)<input className="panel-input mt-1" type="number" min="-1" name="swap" defaultValue="0" required /></label>
            <label className="text-xs font-bold text-steel">Disk (MB)<input className="panel-input mt-1" type="number" min="1" name="disk" defaultValue="20480" required /></label>
            <label className="text-xs font-bold text-steel">CPU limit (%)<input className="panel-input mt-1" type="number" min="0" name="cpu" defaultValue="200" required /></label>
            <label className="text-xs font-bold text-steel">I/O weight<input className="panel-input mt-1" type="number" min="10" max="1000" name="io" defaultValue="500" required /></label>
            <label className="text-xs font-bold text-steel">Databases allowed<input className="panel-input mt-1" type="number" min="0" name="databases" defaultValue="0" required /></label>
            <label className="text-xs font-bold text-steel">Allocations allowed<input className="panel-input mt-1" type="number" min="0" name="allocations" defaultValue="0" required /></label>
            <label className="text-xs font-bold text-steel">Backups allowed<input className="panel-input mt-1" type="number" min="0" name="backups" defaultValue="1" required /></label>
            <label className="text-xs font-bold text-steel lg:col-span-3">Docker image (optional)<input className="panel-input mt-1" name="docker_image" placeholder="Use the egg's default image" /></label>
            <label className="text-xs font-bold text-steel lg:col-span-3">Startup command override (optional)<input className="panel-input mt-1" name="startup" placeholder="Use the egg's default startup command" /></label>
            <label className="text-xs font-bold text-steel lg:col-span-3">Egg environment JSON<textarea className="panel-input mt-1 min-h-24 font-mono" name="environment" defaultValue="{}" /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-accent" type="submit" disabled={creating}>{creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Create real server</button>
            <button className="btn-ghost" type="button" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
          </div>
        </form>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Boxes className="size-4 text-accent" />
          <h3 className="font-extrabold">Nodes</h3>
          <span className="rounded-full bg-fill px-2 py-0.5 text-xs text-steel">{nodes.length}</span>
        </div>
        {nodes.length === 0 ? (
          <div className="glass p-5 text-sm text-steel">No nodes to display. Check that the application token can list nodes.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {nodes.map((item, index) => {
              const a = item.attributes ?? {};
              const allocated = (a.allocated_resources && typeof a.allocated_resources === "object" ? a.allocated_resources : {}) as Record<string, unknown>;
              return (
                <article className="glass p-4" key={textOf(a.id, String(index))}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold">{textOf(a.name, "Unnamed node")}</div>
                      <div className="mt-1 text-xs text-steel">{textOf(a.fqdn)} · {textOf(a.location_id, "No location ID")}</div>
                    </div>
                    <span className={a.maintenance_mode ? "rounded-full bg-warn/15 px-2 py-1 text-xs text-warn" : "rounded-full bg-ok/15 px-2 py-1 text-xs text-ok"}>
                      {a.maintenance_mode ? "Maintenance" : "Active"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div><div className="text-xs text-steel">Memory capacity</div><div className="mt-1 font-bold">{toGB(a.memory)}</div><div className="text-xs text-steel">Allocated: {toGB(allocated.memory)}</div></div>
                    <div><div className="text-xs text-steel">Disk capacity</div><div className="mt-1 font-bold">{toGB(a.disk)}</div><div className="text-xs text-steel">Allocated: {toGB(allocated.disk)}</div></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Server className="size-4 text-accent" />
          <h3 className="font-extrabold">Client-accessible servers</h3>
          <span className="rounded-full bg-fill px-2 py-0.5 text-xs text-steel">{servers.length}</span>
        </div>
        <p className="text-xs text-steel">Power and resource access follows the permissions of the server-side Pterodactyl client API token. Application API inventory is kept separate from client server access.</p>
        {servers.length === 0 ? (
          <div className="glass p-5 text-sm text-steel">No client-accessible servers returned by Pterodactyl.</div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {servers.map((item, index) => {
              const a = item.attributes ?? {};
              const id = textOf(a.identifier, "");
              const res = resources[id]?.attributes;
              const values = res?.resources;
              const busy = resourceLoading === id;
              return (
                <article className="glass p-4" key={id || textOf(a.uuid, String(index))}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-extrabold">{textOf(a.name, "Unnamed server")}</div>
                      <div className="mt-1 text-xs text-steel">{textOf(a.node, "Node not supplied")} · {id || "No server identifier"}</div>
                    </div>
                    <button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={() => void loadResources(id)} disabled={busy || !id}>
                      {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Activity className="size-4" />} Resources
                    </button>
                  </div>
                  {res ? (
                    <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border border-line p-3 text-sm sm:grid-cols-4">
                      <div><div className="text-xs text-steel">State</div><div className="mt-1 font-bold">{textOf(res.current_state)}</div></div>
                      <div><div className="text-xs text-steel">CPU</div><div className="mt-1 font-bold">{typeof values?.cpu_absolute === "number" ? values.cpu_absolute.toFixed(1) + "%" : "—"}</div></div>
                      <div><div className="text-xs text-steel">Memory</div><div className="mt-1 font-bold">{toMB(values?.memory_bytes)}</div></div>
                      <div><div className="text-xs text-steel">Disk</div><div className="mt-1 font-bold">{toMB(values?.disk_bytes)}</div></div>
                      <div className="sm:col-span-4 text-xs text-steel">Network RX {toMB(values?.network_rx_bytes)} · TX {toMB(values?.network_tx_bytes)}</div>
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                    {(["start", "restart", "stop", "kill"] as const).map((action) => (
                      <button key={action} type="button" className={action === "kill" ? "btn-ghost min-h-9 border border-danger/40 px-3 text-xs text-danger" : "btn-ghost min-h-9 px-3 text-xs"} onClick={() => void power(id, action)} disabled={!id || Boolean(resourceLoading)}>
                        {action === "start" ? <Power className="size-3.5" /> : null}{action}
                      </button>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selected ? <p className="text-xs text-steel">Latest resource lookup: {selected}</p> : null}
    </div>
  );
}
