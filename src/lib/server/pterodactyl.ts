import { HttpError } from "./core";

const ACCEPT = "Application/vnd.pterodactyl.v1+json";
const MAX_TEXT_FILE_BYTES = 1024 * 1024;
type JsonObject = Record<string, unknown>;
type ApiMethod = "GET" | "POST" | "DELETE";

type ApiRequest = {
  method?: ApiMethod;
  body?: unknown;
  rawBody?: string;
  response?: "json" | "text";
};

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

async function callApi<T>(path: string, apiToken: string, init: ApiRequest = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: "Bearer " + apiToken, Accept: ACCEPT };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.rawBody !== undefined) headers["Content-Type"] = "text/plain; charset=utf-8";
  let response: Response;
  try {
    response = await fetch(origin() + path, {
      method: init.method ?? "GET",
      headers,
      body: init.rawBody ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
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
  if (init.response === "text") {
    const declaredSize = Number(response.headers.get("content-length") ?? "0");
    if (declaredSize > MAX_TEXT_FILE_BYTES) {
      throw new HttpError(413, "This file is larger than the 1 MB text-editor limit.");
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_TEXT_FILE_BYTES) {
      throw new HttpError(413, "This file is larger than the 1 MB text-editor limit.");
    }
    return text as T;
  }
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

function validateIdentifier(identifier: string) {
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(identifier)) throw new HttpError(400, "Invalid Pterodactyl server identifier.");
}

function clientPath(identifier: string, suffix: string): string {
  validateIdentifier(identifier);
  return "/api/client/servers/" + encodeURIComponent(identifier) + suffix;
}

function positiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function nonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validatePath(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 1024 || value.includes("\0")) {
    throw new HttpError(400, label + " must be an absolute path of at most 1024 characters.");
  }
  if (value.split("/").some((part) => part === "..")) {
    throw new HttpError(400, label + " cannot contain parent-directory segments.");
  }
  return value;
}

function validateFilename(value: unknown, label = "name"): string {
  if (typeof value !== "string" || !value.trim() || value.length > 255 || value === "." || value === ".." ||
      value.includes("/") || value.includes("\\") || value.includes("\0")) {
    throw new HttpError(400, label + " must be a valid filename of at most 255 characters.");
  }
  return value;
}

function validateAllocationId(value: unknown): number {
  if (!positiveInt(value)) throw new HttpError(400, "allocation must be a positive numeric allocation ID.");
  return value;
}

// ── Application API ─────────────────────────────────────────────────────────
export function listPterodactylNodes(page = 1, perPage = 50) {
  return callApi<unknown>("/api/application/nodes" + pagination(page, perPage), token("PTERODACTYL_APPLICATION_TOKEN"));
}

export function listPterodactylServers(page = 1, perPage = 25) {
  return callApi<unknown>("/api/application/servers" + pagination(page, perPage), token("PTERODACTYL_APPLICATION_TOKEN"));
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

// ── Client API: inventory, resources and power ─────────────────────────────
export function listPterodactylClientServers() {
  return callApi<unknown>("/api/client", token("PTERODACTYL_CLIENT_TOKEN"));
}

export function getPterodactylResources(identifier: string) {
  return callApi<unknown>(clientPath(identifier, "/resources"), token("PTERODACTYL_CLIENT_TOKEN"));
}

export async function powerPterodactylServer(identifier: string, action: unknown) {
  if (!["start", "stop", "restart", "kill"].includes(String(action))) {
    throw new HttpError(400, "action must be start, stop, restart or kill.");
  }
  return callApi<unknown>(clientPath(identifier, "/power"), token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "POST",
    body: { signal: action },
  });
}

// ── Client API: network allocations ────────────────────────────────────────
export function listPterodactylAllocations(identifier: string) {
  return callApi<unknown>(clientPath(identifier, "/network/allocations"), token("PTERODACTYL_CLIENT_TOKEN"));
}

export function createPterodactylAllocation(identifier: string) {
  return callApi<unknown>(clientPath(identifier, "/network/allocations"), token("PTERODACTYL_CLIENT_TOKEN"), { method: "POST" });
}

export function setPterodactylPrimaryAllocation(identifier: string, allocation: unknown) {
  const id = validateAllocationId(allocation);
  return callApi<unknown>(clientPath(identifier, "/network/allocations/" + id + "/primary"), token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "POST",
  });
}

export function updatePterodactylAllocationNotes(identifier: string, allocation: unknown, notes: unknown) {
  const id = validateAllocationId(allocation);
  if (typeof notes !== "string" || notes.length > 191) throw new HttpError(400, "notes must be a string of at most 191 characters.");
  return callApi<unknown>(clientPath(identifier, "/network/allocations/" + id), token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "POST",
    body: { notes },
  });
}

export function deletePterodactylAllocation(identifier: string, allocation: unknown) {
  const id = validateAllocationId(allocation);
  return callApi<unknown>(clientPath(identifier, "/network/allocations/" + id), token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "DELETE",
  });
}

// ── Client API: files ───────────────────────────────────────────────────────
export function listPterodactylFiles(identifier: string, directory: unknown) {
  const root = validatePath(directory, "directory");
  return callApi<unknown>(clientPath(identifier, "/files/list?directory=" + encodeURIComponent(root)), token("PTERODACTYL_CLIENT_TOKEN"));
}

export function getPterodactylFileContents(identifier: string, file: unknown) {
  const path = validatePath(file, "file");
  return callApi<string>(clientPath(identifier, "/files/contents?file=" + encodeURIComponent(path)), token("PTERODACTYL_CLIENT_TOKEN"), {
    response: "text",
  });
}

export function writePterodactylFile(identifier: string, file: unknown, content: unknown) {
  const path = validatePath(file, "file");
  if (typeof content !== "string") throw new HttpError(400, "content must be a string.");
  if (new TextEncoder().encode(content).byteLength > MAX_TEXT_FILE_BYTES) {
    throw new HttpError(413, "Text files cannot exceed the 1 MB editor limit.");
  }
  return callApi<unknown>(clientPath(identifier, "/files/write?file=" + encodeURIComponent(path)), token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "POST",
    rawBody: content,
  });
}

export function copyPterodactylFile(identifier: string, location: unknown) {
  const path = validatePath(location, "location");
  return callApi<unknown>(clientPath(identifier, "/files/copy"), token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "POST",
    body: { location: path },
  });
}

export function createPterodactylFolder(identifier: string, root: unknown, name: unknown) {
  const directory = validatePath(root, "root");
  const folder = validateFilename(name);
  return callApi<unknown>(clientPath(identifier, "/files/create-folder"), token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "POST",
    body: { root: directory, name: folder },
  });
}

export function renamePterodactylFiles(identifier: string, root: unknown, files: unknown) {
  const directory = validatePath(root, "root");
  if (!Array.isArray(files) || files.length < 1 || files.length > 100) {
    throw new HttpError(400, "files must contain between 1 and 100 rename operations.");
  }
  const operations = files.map((item) => {
    if (!object(item)) throw new HttpError(400, "Each rename operation must be an object.");
    return { from: validateFilename(item.from, "from"), to: validateFilename(item.to, "to") };
  });
  return callApi<unknown>(clientPath(identifier, "/files/rename"), token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "POST",
    body: { root: directory, files: operations },
  });
}

export function deletePterodactylFiles(identifier: string, root: unknown, files: unknown) {
  const directory = validatePath(root, "root");
  if (!Array.isArray(files) || files.length < 1 || files.length > 100) {
    throw new HttpError(400, "files must contain between 1 and 100 filenames.");
  }
  const names = files.map((name) => validateFilename(name, "Each filename"));
  return callApi<unknown>(clientPath(identifier, "/files/delete"), token("PTERODACTYL_CLIENT_TOKEN"), {
    method: "POST",
    body: { root: directory, files: names },
  });
}
