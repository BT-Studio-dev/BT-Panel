import { HttpError } from "./core";

const ACCEPT = "Application/vnd.pterodactyl.v1+json";
type JsonObject = Record<string, unknown>;

export type CreatePterodactylServerInput = {
  name: string;
  user: number;
  egg: number;
  docker_image?: string;
  startup?: string;
  environment?: Record<string, string>;
  limits: { memory: number; swap: number; disk: number; io: number; cpu: number };
  feature_limits: { databases: number; allocations?: number; backups: number };
  allocation: { default: number };
  deploy?: { locations?: number[]; dedicated_ip?: boolean; port_range?: string[] };
  start_on_completion?: boolean;
};

function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function origin(): string {
  const raw = process.env.PTERODACTYL_URL?.trim();
  if (!raw) throw new HttpError(503, "Set PTERODACTYL_URL to configure the Pterodactyl integration.");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new HttpError(503, "PTERODACTYL_URL must be a valid URL.");
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new HttpError(503, "PTERODACTYL_URL must contain only the panel origin (for example https://panel.example.com).");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    throw new HttpError(503, "Use HTTPS for PTERODACTYL_URL except for localhost development.");
  }
  return url.origin;
}

function token(name: "PTERODACTYL_APPLICATION_TOKEN" | "PTERODACTYL_CLIENT_TOKEN"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new HttpError(503, "Set " + name + " on the BT Panel server to enable this operation.");
  return value;
}

export function pterodactylConfigStatus() {
  let url: string | null = null;
  try {
    if (process.env.PTERODACTYL_URL) url = new URL(process.env.PTERODACTYL_URL).origin;
  } catch { /* report unconfigured rather than echoing invalid input */ }
  return {
    configured: Boolean(url && process.env.PTERODACTYL_APPLICATION_TOKEN?.trim()),
    applicationApiConfigured: Boolean(url && process.env.PTERODACTYL_APPLICATION_TOKEN?.trim()),
    clientApiConfigured: Boolean(url && process.env.PTERODACTYL_CLIENT_TOKEN?.trim()),
    url,
    apiVersion: "Pterodactyl 1.x",
  };
}

async function callApi<T>(path: string, apiToken: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: "Bearer " + apiToken, Accept: ACCEPT };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(origin() + path, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new HttpError(502, "Could not reach the configured Pterodactyl Panel API.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new HttpError(502, "Pterodactyl rejected the configured API token or its permissions.");
  }
  if (response.status === 404) throw new HttpError(404, "The requested Pterodactyl resource was not found.");
  if (!response.ok) throw new HttpError(502, "Pterodactyl API request failed with HTTP " + response.status + ".");
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch {
    throw new HttpError(502, "Pterodactyl returned an invalid JSON response.");
  }
}

function pagination(page: number, perPage: number): string {
  const p = Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1;
  const n = Number.isSafeInteger(perPage) && perPage > 0 ? Math.min(perPage, 100) : 50;
  return "?page=" + p + "&per_page=" + n;
}

export function listPterodactylNodes(page = 1, perPage = 50) {
  return callApi<unknown>("/api/application/nodes" + pagination(page, perPage), token("PTERODACTYL_APPLICATION_TOKEN"));
}

export function listPterodactylServers(page = 1, perPage = 25) {
  return callApi<unknown>("/api/application/servers" + pagination(page, perPage), token("PTERODACTYL_APPLICATION_TOKEN"));
}

export function listPterodactylClientServers() {
  return callApi<unknown>("/api/client", token("PTERODACTYL_CLIENT_TOKEN"));
}

function validateIdentifier(identifier: string) {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(identifier)) throw new HttpError(400, "Invalid Pterodactyl server identifier.");
}

export function getPterodactylResources(identifier: string) {
  validateIdentifier(identifier);
  return callApi<unknown>("/api/client/servers/" + encodeURIComponent(identifier) + "/resources", token("PTERODACTYL_CLIENT_TOKEN"));
}

export async function powerPterodactylServer(identifier: string, action: unknown) {
  validateIdentifier(identifier);
  if (!["start", "stop", "restart", "kill"].includes(String(action))) {
    throw new HttpError(400, "action must be start, stop, restart or kill.");
  }
  return callApi<unknown>("/api/client/servers/" + encodeURIComponent(identifier) + "/power", token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "POST",
    body: { signal: action },
  });
}

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
function nonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function validateCreatePterodactylServer(value: unknown): CreatePterodactylServerInput {
  if (!object(value)) throw new HttpError(400, "Body must be a JSON object.");
  if (typeof value.name !== "string" || !value.name.trim() || value.name.length > 191) {
    throw new HttpError(400, "name must be 1–191 characters.");
  }
  if (!positiveInt(value.user) || !positiveInt(value.egg)) {
    throw new HttpError(400, "user and egg must be positive Pterodactyl IDs.");
  }
  if (!object(value.limits) || !object(value.feature_limits) || !object(value.allocation)) {
    throw new HttpError(400, "limits, feature_limits and allocation are required objects.");
  }
  const l = value.limits;
  if (!positiveInt(l.memory) || !(l.swap === -1 || nonNegativeInt(l.swap)) ||
      !positiveInt(l.disk) || !positiveInt(l.io) || !nonNegativeInt(l.cpu)) {
    throw new HttpError(400, "limits requires valid memory, swap, disk, io and cpu values.");
  }
  const f = value.feature_limits;
  if (!nonNegativeInt(f.databases) || !nonNegativeInt(f.backups) ||
      (f.allocations !== undefined && !nonNegativeInt(f.allocations))) {
    throw new HttpError(400, "feature_limits requires non-negative databases and backups (and allocations if provided).");
  }
  if (!positiveInt(value.allocation.default)) {
    throw new HttpError(400, "allocation.default must be a valid allocation ID.");
  }
  if (value.environment !== undefined && !object(value.environment)) {
    throw new HttpError(400, "environment must be an object.");
  }
  return value as unknown as CreatePterodactylServerInput;
}

export function createPterodactylServer(value: unknown) {
  const payload = validateCreatePterodactylServer(value);
  return callApi<unknown>("/api/application/servers", token("PTERODACTYL_APPLICATION_TOKEN"), { method: "POST", body: payload });
}
