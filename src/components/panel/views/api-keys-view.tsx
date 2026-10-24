"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Plus, ShieldAlert, Trash } from "lucide-react";
import type { ApiKeyDto } from "@/lib/panel/types";
import { api, cn, formatJoined, timeAgo } from "@/lib/utils";
import { EmptyState, Field, Modal, Spinner, useNow } from "../ui";
import { AdminPageHeader, CatalogNote } from "./admin-shared";

type CreatedKey = { key: ApiKeyDto; secret: string };

export function ApiKeysView() {
  const now = useNow(30_000);
  const [keys, setKeys] = useState<ApiKeyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await api<{ keys: ApiKeyDto[] }>("/api/admin/api-keys");
      setKeys(result.keys);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function createKey(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<CreatedKey>("/api/admin/api-keys", {
        body: { name, expiresInDays },
      });
      setKeys((current) => [result.key, ...current]);
      setCreated(result);
      setCreateOpen(false);
      setName("");
      setExpiresInDays(0);
      setCopied(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create API key");
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(key: ApiKeyDto) {
    if (!window.confirm(`Revoke “${key.name}”? Applications using this key will immediately lose access.`)) return;
    setPendingId(key.id);
    try {
      await api(`/api/admin/api-keys/${encodeURIComponent(key.id)}`, { method: "DELETE" });
      setKeys((current) => current.filter((item) => item.id !== key.id));
      toast.success("API key revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke API key");
    } finally {
      setPendingId(null);
    }
  }

  async function copySecret() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.secret);
      setCopied(true);
      toast.success("API key copied");
    } catch {
      toast.error("Clipboard unavailable — select the key and copy it manually");
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="API Keys"
        description="Create persistent credentials for scripts and services using the native BT Panel API."
        actions={<button type="button" className="btn-accent" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Create API key</button>}
      />
      <CatalogNote>A key acts with the permissions of its creator. The plaintext secret is shown only once; BT Panel stores its SHA-256 hash. Use it as an Authorization: Bearer credential.</CatalogNote>

      <div className="glass overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div><h3 className="text-[14px] font-extrabold">Administrator credentials</h3><p className="mt-0.5 text-[11.5px] font-semibold text-steel">{keys.length} active and expired key records</p></div>
          <KeyRound className="size-5 text-accent" />
        </div>
        {loading ? (
          <div className="flex min-h-52 items-center justify-center gap-2 text-[13px] font-bold text-steel"><Spinner /> Loading API keys…</div>
        ) : error && !keys.length ? (
          <EmptyState icon={<KeyRound className="size-5" />} title="API keys unavailable" body={error} />
        ) : keys.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-left">
              <thead className="border-b border-line text-[10px] tracking-[0.1em] text-steel uppercase">
                <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Key</th><th className="px-5 py-3">Owner</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Last used</th><th className="px-5 py-3">Expiration</th><th className="px-5 py-3"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {keys.map((key) => {
                  const expired = now !== null && key.expiresAt !== null && Date.parse(key.expiresAt) <= now;
                  return (
                    <tr key={key.id} className="transition-colors hover:bg-fill/40">
                      <td className="px-5 py-3.5"><div className="text-[12.5px] font-extrabold">{key.name}</div>{expired ? <div className="mt-1 text-[9px] font-extrabold tracking-wider text-danger uppercase">Expired</div> : null}</td>
                      <td className="px-5 py-3.5"><code className="rounded-md border border-line bg-fill px-2 py-1 text-[11px] text-steel">{key.prefix}••••••••</code></td>
                      <td className="px-5 py-3.5 text-[12px] font-semibold text-steel">{key.ownerName ?? "Unknown"}</td>
                      <td className="px-5 py-3.5 text-[11.5px] font-semibold text-steel">{formatJoined(key.createdAt)}</td>
                      <td className="px-5 py-3.5 text-[11.5px] font-semibold text-steel">{now ? timeAgo(key.lastUsedAt, now) : key.lastUsedAt ? formatJoined(key.lastUsedAt) : "never"}</td>
                      <td className="px-5 py-3.5 text-[11.5px] font-semibold text-steel">{key.expiresAt ? formatJoined(key.expiresAt) : "Never"}</td>
                      <td className="px-5 py-3.5 text-right"><button type="button" className="icon-btn danger size-9" aria-label={`Revoke ${key.name}`} title="Revoke key" disabled={pendingId === key.id} onClick={() => void revokeKey(key)}>{pendingId === key.id ? <Spinner /> : <Trash className="size-4" />}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<KeyRound className="size-5" />}
            title="No API keys yet"
            body="Create a key to authenticate a script or service without sharing your password."
            action={<button type="button" className="btn-accent" onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Create your first key</button>}
          />
        )}
        {error && keys.length ? <div className="border-t border-line px-4 py-2 text-[11px] font-semibold text-warn">{error}</div> : null}
      </div>

      <div className="glass mt-4 p-5">
        <h3 className="flex items-center gap-2 text-[13px] font-extrabold"><ShieldAlert className="size-4 text-warn" /> Using a key safely</h3>
        <p className="mt-2 text-[12px] leading-relaxed font-semibold text-steel">Keep keys in server-side secret storage, never in browser code or Git. Send requests to this panel&apos;s HTTPS origin with the header below, and revoke a key immediately if it is exposed.</p>
        <code className="mt-3 block overflow-x-auto rounded-xl border border-line bg-black/25 p-3 text-[11.5px] whitespace-nowrap">Authorization: Bearer btp_your_secret_key</code>
      </div>

      <Modal open={createOpen} onClose={() => !busy && setCreateOpen(false)} title="Create API key" subtitle="The new credential will inherit your administrator permissions.">
        <form onSubmit={createKey} className="space-y-4">
          <Field label="Key name" hint="Use a recognizable name such as Deployment bot or Backup script.">
            <input className="panel-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Deployment bot" minLength={2} maxLength={60} required autoFocus />
          </Field>
          <Field label="Expiration" hint="Expired keys remain in this directory but can no longer authenticate.">
            <select className="panel-input" value={expiresInDays} onChange={(event) => setExpiresInDays(Number(event.target.value))}>
              <option value={0}>Never expires</option><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={365}>1 year</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4"><button type="button" className="btn-ghost" onClick={() => setCreateOpen(false)} disabled={busy}>Cancel</button><button type="submit" className="btn-accent" disabled={busy || name.trim().length < 2}>{busy ? <Spinner /> : <KeyRound className="size-4" />} Create key</button></div>
        </form>
      </Modal>

      <Modal open={created !== null} onClose={() => setCreated(null)} title="Copy your new API key" subtitle={created ? `${created.key.name} was created successfully.` : undefined}>
        {created ? (
          <div>
            <div className="rounded-xl border border-warn/25 bg-warn/10 p-3 text-[12px] leading-relaxed font-semibold text-warn">This is the only time the complete secret will be shown. Store it somewhere safe before closing this dialog.</div>
            <div className="mt-4 flex gap-2">
              <input className="panel-input min-w-0 flex-1 font-mono text-[12px]" readOnly value={created.secret} onFocus={(event) => event.target.select()} aria-label="New API key secret" />
              <button type="button" className={cn("btn-accent shrink-0 px-3", copied && "bg-ok")} onClick={() => void copySecret()} aria-label="Copy API key">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button>
            </div>
            <button type="button" className="btn-accent mt-5 w-full" onClick={() => setCreated(null)}>I have saved this key</button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
