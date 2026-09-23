import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

type ApiItem<T> = { attributes?: T };
type ApiResponse<T> = { data?: ApiItem<T>[] };
type ServerAttributes = {
  identifier: string;
  uuid: string;
  name: string;
  node: string;
  description?: string | null;
  status?: string | null;
  is_suspended?: boolean;
  is_installing?: boolean;
  is_transferring?: boolean;
  limits?: { memory?: number; disk?: number; cpu?: number };
};
type ResourceAttributes = {
  current_state?: string;
  is_suspended?: boolean;
  resources?: {
    memory_bytes?: number;
    cpu_absolute?: number;
    disk_bytes?: number;
    network_rx_bytes?: number;
    network_tx_bytes?: number;
  };
};
type WsAttributes = { token?: string; socket?: string };

export type PterodactylServer = {
  identifier: string;
  uuid: string;
  name: string;
  node: string;
  description: string;
  status: string | null;
  suspended: boolean;
  installing: boolean;
  transferring: boolean;
  limits: { memory: number; disk: number; cpu: number };
  resources: {
    state: string | null;
    memoryBytes: number;
    cpuPercent: number;
    diskBytes: number;
    networkRxBytes: number;
    networkTxBytes: number;
  } | null;
};

function config() {
  const url = String(process.env.PTERODACTYL_URL || "").trim().replace(/\/$/, "");
  const key = String(process.env.PTERODACTYL_CLIENT_API_KEY || "").trim();
  if (!url || !key) throw new Error("Pterodactyl is not configured.");
  return { url, key };
}

async function requireAdmin(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ role: string; status: string }>`select role, status from profiles where user_id = ${userId} limit 1`;
  const profile = rows[0];
  if (!profile || profile.status !== "active") throw new Error("Account is not active.");
  if (profile.role !== "owner" && profile.role !== "admin") throw new Error("Administrator permission required.");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/api/client${path}`, {
    ...init,
    headers: {
      Accept: "Application/vnd.pterodactyl.v1+json",
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    redirect: "error",
  });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const detail = body && typeof body === "object" && "errors" in body
      ? ((body as { errors?: Array<{ detail?: string }> }).errors?.[0]?.detail || "")
      : "";
    throw new Error(detail || `Pterodactyl API returned ${response.status}.`);
  }
  return body as T;
}

function mapServer(a: ServerAttributes, r: ResourceAttributes | null): PterodactylServer {
  return {
    identifier: a.identifier,
    uuid: a.uuid,
    name: a.name,
    node: a.node,
    description: a.description || "",
    status: a.status ?? null,
    suspended: Boolean(a.is_suspended),
    installing: Boolean(a.is_installing),
    transferring: Boolean(a.is_transferring),
    limits: {
      memory: Number(a.limits?.memory || 0),
      disk: Number(a.limits?.disk || 0),
      cpu: Number(a.limits?.cpu || 0),
    },
    resources: r ? {
      state: r.current_state ?? null,
      memoryBytes: Number(r.resources?.memory_bytes || 0),
      cpuPercent: Number(r.resources?.cpu_absolute || 0),
      diskBytes: Number(r.resources?.disk_bytes || 0),
      networkRxBytes: Number(r.resources?.network_rx_bytes || 0),
      networkTxBytes: Number(r.resources?.network_tx_bytes || 0),
    } : null,
  };
}

export const getPterodactylServers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<PterodactylServer[]> => {
    await requireAdmin(context.userId);
    const body = await request<ApiResponse<ServerAttributes>>("/?per_page=50");
    const servers = (body.data || [])
      .map((x) => x.attributes)
      .filter((x): x is ServerAttributes => Boolean(x?.identifier));

    return Promise.all(servers.map(async (server) => {
      try {
        const resource = await request<{ attributes?: ResourceAttributes }>(
          `/servers/${encodeURIComponent(server.identifier)}/resources`,
        );
        return mapServer(server, resource.attributes || null);
      } catch {
        return mapServer(server, null);
      }
    }));
  });

export const pterodactylPower = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const input = data as { identifier?: string; signal?: string };
    const identifier = String(input.identifier || "").trim();
    const signal = String(input.signal || "").trim();
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(identifier)) throw new Error("Invalid server identifier.");
    if (!["start", "stop", "restart", "kill"].includes(signal)) throw new Error("Invalid power action.");
    await request(`/servers/${encodeURIComponent(identifier)}/power`, {
      method: "POST",
      body: JSON.stringify({ signal }),
    });
    return { ok: true as const };
  });

export const pterodactylCommand = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const input = data as { identifier?: string; command?: string };
    const identifier = String(input.identifier || "").trim();
    const command = String(input.command || "").trim().slice(0, 2048);
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(identifier)) throw new Error("Invalid server identifier.");
    if (!command) throw new Error("Command cannot be empty.");
    await request(`/servers/${encodeURIComponent(identifier)}/command`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
    return { ok: true as const };
  });

export const getPterodactylWebsocket = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const input = data as { identifier?: string };
    const identifier = String(input.identifier || "").trim();
    if (!/^[a-zA-Z0-9-]{1,64}$/.test(identifier)) throw new Error("Invalid server identifier.");
    const body = await request<{ data?: ApiItem<WsAttributes> }>(
      `/servers/${encodeURIComponent(identifier)}/websocket`,
    );
    const attributes = body.data?.attributes;
    if (!attributes?.token || !attributes.socket) throw new Error("Pterodactyl did not return WebSocket credentials.");
    return { token: attributes.token, socket: attributes.socket };
  });
