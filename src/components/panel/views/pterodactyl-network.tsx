"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Copy,
  LoaderCircle,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/utils";
import { Modal } from "../ui";
import { copyText, textOf, type ApiItem, type ApiList } from "./pterodactyl-shared";

export function PterodactylNetwork({ identifier }: { identifier: string }) {
  const [allocations, setAllocations] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ApiItem | null>(null);
  const [notesTarget, setNotesTarget] = useState<ApiItem | null>(null);
  const [notes, setNotes] = useState("");
  const endpoint = `/api/integrations/pterodactyl/servers/${encodeURIComponent(identifier)}/allocations`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<ApiList>(endpoint);
      setAllocations(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load network allocations.");
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  // Initial upstream fetch; refresh owns the asynchronous loading state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const createAllocation = async () => {
    setBusy("create");
    try {
      await api(endpoint, { method: "POST", body: { action: "create" } });
      toast.success("A new port allocation was assigned");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign an allocation.");
    } finally {
      setBusy("");
    }
  };

  const setPrimary = async (id: number) => {
    setBusy(`primary-${id}`);
    try {
      await api(endpoint, { method: "POST", body: { action: "primary", allocation: id } });
      toast.success("Primary connection updated");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the primary allocation.");
    } finally {
      setBusy("");
    }
  };

  const saveNotes = async () => {
    const id = Number(notesTarget?.attributes?.id);
    if (!id) return;
    setBusy(`notes-${id}`);
    try {
      await api(endpoint, { method: "POST", body: { action: "notes", allocation: id, notes } });
      toast.success("Allocation notes saved");
      setNotesTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save allocation notes.");
    } finally {
      setBusy("");
    }
  };

  const removeAllocation = async () => {
    const id = Number(deleteTarget?.attributes?.id);
    if (!id) return;
    setBusy(`delete-${id}`);
    try {
      await api(endpoint, { method: "DELETE", body: { allocation: id } });
      toast.success("Port allocation removed");
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the allocation.");
    } finally {
      setBusy("");
    }
  };

  const copyAddress = async (id: number, address: string) => {
    setBusy(`copy-${id}`);
    try {
      await copyText(address);
      toast.success("Connection address copied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy the address.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-extrabold"><Network className="size-4 text-accent" /> Port allocations</h3>
          <p className="mt-1 text-xs font-semibold text-steel">Public connection addresses assigned to this server by Pterodactyl.</p>
        </div>
        <div className="flex gap-2">
          <button className="icon-btn" type="button" onClick={() => void refresh()} disabled={loading || Boolean(busy)} aria-label="Refresh allocations" title="Refresh allocations">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button className="btn-accent min-h-9 px-3 text-xs" type="button" onClick={() => void createAllocation()} disabled={Boolean(busy)}>
            {busy === "create" ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />} Assign port
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm">
          <div className="font-extrabold text-warn">Network information unavailable</div>
          <p className="mt-1 text-steel">{error}</p>
          <button className="btn-ghost mt-3 min-h-9 px-3 text-xs" type="button" onClick={() => void refresh()}>Try again</button>
        </div>
      ) : loading && allocations.length === 0 ? (
        <div className="grid min-h-44 place-items-center rounded-xl border border-line bg-sunken text-steel">
          <div className="flex items-center gap-2 text-sm font-bold"><LoaderCircle className="size-4 animate-spin" /> Loading allocations…</div>
        </div>
      ) : allocations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-sunken p-8 text-center">
          <Network className="mx-auto size-6 text-steel" />
          <div className="mt-3 text-sm font-extrabold">No port allocations</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-steel">Assign an available allocation from this server’s node. If none are available, add allocations to the node in Pterodactyl first.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[minmax(220px,1.3fr)_minmax(140px,1fr)_auto] gap-4 border-b border-line bg-fill px-4 py-2.5 text-[10px] font-extrabold tracking-[0.1em] text-faint uppercase md:grid">
            <span>Connection</span><span>Notes</span><span className="text-right">Actions</span>
          </div>
          {allocations.map((item, index) => {
            const a = item.attributes ?? {};
            const id = Number(a.id);
            const ip = typeof a.ip_alias === "string" && a.ip_alias ? a.ip_alias : textOf(a.ip, "Unknown IP");
            const port = textOf(a.port, "Unknown port");
            const address = `${ip}:${port}`;
            const primary = a.is_default === true;
            const itemBusy = busy.endsWith(`-${id}`);
            return (
              <div key={id || index} className="grid gap-3 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[minmax(220px,1.3fr)_minmax(140px,1fr)_auto] md:items-center md:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${primary ? "border-accent/35 bg-accent/12 text-accent" : "border-line bg-fill text-steel"}`}>
                    {primary ? <Star className="size-4 fill-current" /> : <Network className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-[13px] font-bold">{address}</span>
                      {primary ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-accent uppercase">Primary</span> : null}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-steel">{textOf(a.ip)} · Port {port}</div>
                  </div>
                </div>
                <div className="truncate text-xs font-semibold text-steel">{typeof a.notes === "string" && a.notes ? a.notes : "No notes"}</div>
                <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                  <button className="icon-btn size-8" type="button" onClick={() => void copyAddress(id, address)} disabled={Boolean(busy)} aria-label={`Copy ${address}`} title="Copy connection address">
                    {busy === `copy-${id}` ? <LoaderCircle className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                  </button>
                  {!primary ? (
                    <button className="btn-ghost min-h-8 px-2.5 text-[11px]" type="button" onClick={() => void setPrimary(id)} disabled={Boolean(busy)}>
                      {busy === `primary-${id}` ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Make primary
                    </button>
                  ) : null}
                  <button className="icon-btn size-8" type="button" onClick={() => { setNotesTarget(item); setNotes(typeof a.notes === "string" ? a.notes : ""); }} disabled={Boolean(busy)} aria-label="Edit allocation notes" title="Edit notes">
                    <Pencil className="size-3.5" />
                  </button>
                  {!primary ? (
                    <button className="icon-btn danger size-8" type="button" onClick={() => setDeleteTarget(item)} disabled={Boolean(busy)} aria-label={`Remove port ${port}`} title="Remove allocation">
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                  {itemBusy && !["copy", "primary"].some((action) => busy === `${action}-${id}`) ? <LoaderCircle className="size-3.5 animate-spin text-steel" /> : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] font-semibold text-faint">Adding or removing a port changes the real remote server. The primary allocation cannot be removed.</p>

      <Modal open={Boolean(deleteTarget)} onClose={() => { if (!busy) setDeleteTarget(null); }} title="Remove port allocation?" subtitle="Players or services using this address will no longer be able to connect through it.">
        <div className="flex justify-end gap-2">
          <button className="btn-ghost" type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(busy)}>Cancel</button>
          <button className="btn-danger" type="button" onClick={() => void removeAllocation()} disabled={Boolean(busy)}>
            {busy.startsWith("delete-") ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Remove allocation
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(notesTarget)} onClose={() => { if (!busy) setNotesTarget(null); }} title="Allocation notes" subtitle="Add an internal label for this connection address.">
        <textarea className="panel-input min-h-24 resize-y" value={notes} maxLength={191} onChange={(event) => setNotes(event.target.value)} placeholder="e.g. RCON or query port" autoFocus />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" type="button" onClick={() => setNotesTarget(null)} disabled={Boolean(busy)}>Cancel</button>
          <button className="btn-accent" type="button" onClick={() => void saveNotes()} disabled={Boolean(busy)}>
            {busy.startsWith("notes-") ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Save notes
          </button>
        </div>
      </Modal>
    </section>
  );
}
