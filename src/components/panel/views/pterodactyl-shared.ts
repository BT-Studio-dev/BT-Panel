export type ApiItem = { attributes?: Record<string, unknown> };
export type ApiList = { data?: ApiItem[] };

export type ResourceView = {
  attributes?: {
    current_state?: string;
    is_suspended?: boolean;
    resources?: {
      cpu_absolute?: number;
      memory_bytes?: number;
      disk_bytes?: number;
      network_rx_bytes?: number;
      network_tx_bytes?: number;
      uptime?: number;
    };
  };
};

export function objectOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function textOf(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export function numberOf(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatBytes(value: unknown, precision = 1): string {
  const bytes = optionalNumber(value);
  if (bytes === null) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 100 || Number.isInteger(size) ? 0 : precision)} ${units[unit]}`;
}

export function formatMegabytes(value: unknown): string {
  const mb = optionalNumber(value);
  if (mb === null) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb >= 10240 || mb % 1024 === 0 ? 0 : 1)} GB` : `${Math.round(mb)} MB`;
}

export function formatFileDate(value: unknown): string {
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
}

export function joinRemotePath(directory: string, name: string): string {
  return directory === "/" ? `/${name}` : `${directory.replace(/\/$/, "")}/${name}`;
}

export async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard access is unavailable.");
}
