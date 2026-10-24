"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  File,
  FileCode2,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/utils";
import { Modal } from "../ui";
import {
  formatBytes,
  formatFileDate,
  joinRemotePath,
  numberOf,
  textOf,
  type ApiItem,
  type ApiList,
} from "./pterodactyl-shared";

type EditorState = { path: string; name: string; content: string; isNew: boolean };
type NameDialog = "file" | "folder" | null;

export function PterodactylFiles({ identifier }: { identifier: string }) {
  const [directory, setDirectory] = useState("/");
  const [items, setItems] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [nameDialog, setNameDialog] = useState<NameDialog>(null);
  const [name, setName] = useState("");
  const [renameTarget, setRenameTarget] = useState<ApiItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ApiItem | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const endpoint = `/api/integrations/pterodactyl/servers/${encodeURIComponent(identifier)}/files`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<ApiList>(`${endpoint}?directory=${encodeURIComponent(directory)}`);
      setItems(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this directory.");
    } finally {
      setLoading(false);
    }
  }, [directory, endpoint]);

  // Directory changes intentionally trigger a new upstream file listing.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const sortedItems = useMemo(() => [...items].sort((left, right) => {
    const a = left.attributes ?? {};
    const b = right.attributes ?? {};
    const folderDifference = Number(a.is_file === true) - Number(b.is_file === true);
    if (folderDifference) return folderDifference;
    return textOf(a.name, "").localeCompare(textOf(b.name, ""));
  }), [items]);

  const crumbs = directory.split("/").filter(Boolean);
  const existingName = (candidate: string, except?: string) => items.some((item) => {
    const current = textOf(item.attributes?.name, "");
    return current === candidate && current !== except;
  });

  const openFile = async (item: ApiItem) => {
    const a = item.attributes ?? {};
    const fileName = textOf(a.name, "");
    if (!fileName) return;
    if (numberOf(a.size) > 1024 * 1024) {
      toast.error("The text editor supports files up to 1 MB.");
      return;
    }
    setBusy(`open-${fileName}`);
    try {
      const path = joinRemotePath(directory, fileName);
      const result = await api<{ content: string }>(`${endpoint}?file=${encodeURIComponent(path)}`);
      setEditor({ path, name: fileName, content: result.content, isNew: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open this file.");
    } finally {
      setBusy("");
    }
  };

  const submitNew = async (event: FormEvent) => {
    event.preventDefault();
    const candidate = name.trim();
    if (!candidate || !nameDialog) return;
    if (existingName(candidate)) {
      toast.error("An item with that name already exists in this directory.");
      return;
    }
    if (nameDialog === "file") {
      setEditor({ path: joinRemotePath(directory, candidate), name: candidate, content: "", isNew: true });
      setNameDialog(null);
      setName("");
      return;
    }
    setBusy("create-folder");
    try {
      await api(endpoint, { method: "POST", body: { action: "create-folder", root: directory, name: candidate } });
      toast.success(`Folder “${candidate}” created`);
      setNameDialog(null);
      setName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create the folder.");
    } finally {
      setBusy("");
    }
  };

  const saveFile = async () => {
    if (!editor) return;
    setBusy("save-file");
    try {
      await api(endpoint, { method: "POST", body: { action: "write", file: editor.path, content: editor.content } });
      toast.success(editor.isNew ? `File “${editor.name}” created` : `File “${editor.name}” saved`);
      setEditor(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this file.");
    } finally {
      setBusy("");
    }
  };

  const copyFile = async (item: ApiItem) => {
    const fileName = textOf(item.attributes?.name, "");
    if (!fileName) return;
    setBusy(`copy-${fileName}`);
    try {
      await api(endpoint, {
        method: "POST",
        body: { action: "copy", location: joinRemotePath(directory, fileName) },
      });
      toast.success(`Copy of “${fileName}” created`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy this file.");
    } finally {
      setBusy("");
    }
  };

  const renameItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!renameTarget) return;
    const from = textOf(renameTarget.attributes?.name, "");
    const to = renameValue.trim();
    if (!from || !to) return;
    if (existingName(to, from)) {
      toast.error("An item with that name already exists in this directory.");
      return;
    }
    setBusy(`rename-${from}`);
    try {
      await api(endpoint, { method: "POST", body: { action: "rename", root: directory, files: [{ from, to }] } });
      toast.success(`Renamed “${from}” to “${to}”`);
      setRenameTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not rename this item.");
    } finally {
      setBusy("");
    }
  };

  const deleteItem = async () => {
    const itemName = textOf(deleteTarget?.attributes?.name, "");
    if (!itemName) return;
    setBusy(`delete-${itemName}`);
    try {
      await api(endpoint, { method: "POST", body: { action: "delete", root: directory, files: [itemName] } });
      toast.success(`“${itemName}” deleted`);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete this item.");
    } finally {
      setBusy("");
    }
  };

  const goToParent = () => {
    if (directory === "/") return;
    setDirectory("/" + crumbs.slice(0, -1).join("/"));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-extrabold"><Folder className="size-4 text-accent" /> File manager</h3>
          <p className="mt-1 text-xs font-semibold text-steel">Browse the live server filesystem. Text files up to 1 MB can be edited here.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="icon-btn" type="button" onClick={() => void refresh()} disabled={loading || Boolean(busy)} aria-label="Refresh directory" title="Refresh directory">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={() => { setName(""); setNameDialog("folder"); }} disabled={Boolean(busy)}><FolderPlus className="size-4" /> New folder</button>
          <button className="btn-accent min-h-9 px-3 text-xs" type="button" onClick={() => { setName(""); setNameDialog("file"); }} disabled={Boolean(busy)}><FilePlus2 className="size-4" /> New file</button>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-line bg-sunken px-2 py-2">
        <button className="icon-btn mr-1 size-8 shrink-0" type="button" onClick={goToParent} disabled={directory === "/" || Boolean(busy)} aria-label="Parent directory" title="Parent directory"><ArrowUp className="size-4" /></button>
        <button className="shrink-0 rounded-md px-2 py-1 font-mono text-xs font-bold text-accent hover:bg-fill" type="button" onClick={() => setDirectory("/")}>root</button>
        {crumbs.map((crumb, index) => {
          const path = "/" + crumbs.slice(0, index + 1).join("/");
          const current = index === crumbs.length - 1;
          return (
            <span className="flex shrink-0 items-center gap-1" key={path}>
              <ChevronRight className="size-3 text-faint" />
              <button className={`rounded-md px-1.5 py-1 font-mono text-xs ${current ? "font-bold text-ice" : "text-steel hover:bg-fill hover:text-ice"}`} type="button" onClick={() => setDirectory(path)} disabled={current}>{crumb}</button>
            </span>
          );
        })}
        <span className="ml-auto shrink-0 pl-3 text-[10px] font-bold text-faint">{items.length} {items.length === 1 ? "item" : "items"}</span>
      </div>

      {error ? (
        <div className="rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm">
          <div className="font-extrabold text-warn">Directory unavailable</div>
          <p className="mt-1 text-steel">{error}</p>
          <div className="mt-3 flex gap-2"><button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={() => void refresh()}>Try again</button>{directory !== "/" ? <button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={() => setDirectory("/")}>Back to root</button> : null}</div>
        </div>
      ) : loading && items.length === 0 ? (
        <div className="grid min-h-52 place-items-center rounded-xl border border-line bg-sunken text-steel">
          <div className="flex items-center gap-2 text-sm font-bold"><LoaderCircle className="size-4 animate-spin" /> Reading directory…</div>
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-sunken p-10 text-center">
          <Folder className="mx-auto size-7 text-steel" />
          <div className="mt-3 text-sm font-extrabold">This directory is empty</div>
          <p className="mt-1 text-xs text-steel">Create a file or folder to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[minmax(220px,1fr)_90px_150px_auto] gap-3 border-b border-line bg-fill px-4 py-2.5 text-[10px] font-extrabold tracking-[0.1em] text-faint uppercase md:grid">
            <span>Name</span><span>Size</span><span>Modified (UTC)</span><span className="text-right">Actions</span>
          </div>
          {sortedItems.map((item, index) => {
            const a = item.attributes ?? {};
            const itemName = textOf(a.name, "Unnamed");
            const isFile = a.is_file === true;
            const extension = itemName.includes(".") ? itemName.split(".").pop()?.toLowerCase() : "";
            const ItemIcon = !isFile ? Folder : ["json", "js", "ts", "yml", "yaml", "properties", "cfg", "conf", "sh"].includes(extension ?? "") ? FileCode2 : extension ? FileText : File;
            return (
              <div key={`${itemName}-${index}`} className="grid gap-2 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-fill/60 md:grid-cols-[minmax(220px,1fr)_90px_150px_auto] md:items-center md:gap-3 md:px-4">
                <button className="flex min-w-0 items-center gap-3 rounded-lg text-left" type="button" onClick={() => isFile ? void openFile(item) : setDirectory(joinRemotePath(directory, itemName))} disabled={Boolean(busy)}>
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${isFile ? "border-line bg-fill text-steel" : "border-accent/25 bg-accent/10 text-accent"}`}>
                    {busy === `open-${itemName}` ? <LoaderCircle className="size-4 animate-spin" /> : <ItemIcon className="size-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-extrabold">{itemName}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-steel md:hidden">{isFile ? formatBytes(a.size) : "Folder"} · {formatFileDate(a.modified_at)}</span>
                    <span className="mt-0.5 hidden text-[10px] font-semibold text-faint md:block">{isFile ? textOf(a.mimetype, "File") : "Directory"}</span>
                  </span>
                </button>
                <div className="hidden font-mono text-[11px] font-semibold text-steel md:block">{isFile ? formatBytes(a.size) : "—"}</div>
                <div className="hidden text-[11px] font-semibold text-steel md:block">{formatFileDate(a.modified_at)}</div>
                <div className="flex items-center gap-1.5 pl-12 md:justify-end md:pl-0">
                  {isFile ? <button className="btn-ghost min-h-8 px-2.5 text-[11px]" type="button" onClick={() => void copyFile(item)} disabled={Boolean(busy)} title="Create a copy in this directory">{busy === `copy-${itemName}` ? <LoaderCircle className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />} Copy</button> : null}
                  <button className="icon-btn size-8" type="button" onClick={() => { setRenameTarget(item); setRenameValue(itemName); }} disabled={Boolean(busy)} aria-label={`Rename ${itemName}`} title="Rename"><Pencil className="size-3.5" /></button>
                  <button className="icon-btn danger size-8" type="button" onClick={() => setDeleteTarget(item)} disabled={Boolean(busy)} aria-label={`Delete ${itemName}`} title="Delete"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(nameDialog)} onClose={() => { if (!busy) setNameDialog(null); }} title={nameDialog === "file" ? "Create a new file" : "Create a new folder"} subtitle={`Inside ${directory}`}>
        <form onSubmit={(event) => void submitNew(event)}>
          <label className="text-xs font-bold text-steel">Name<input className="panel-input mt-1.5" value={name} onChange={(event) => setName(event.target.value)} maxLength={255} placeholder={nameDialog === "file" ? "server-notes.txt" : "config-backups"} autoFocus required /></label>
          <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" type="button" onClick={() => setNameDialog(null)}>Cancel</button><button className="btn-accent" type="submit" disabled={!name.trim() || Boolean(busy)}>{busy === "create-folder" ? <LoaderCircle className="size-4 animate-spin" /> : nameDialog === "file" ? <FilePlus2 className="size-4" /> : <FolderPlus className="size-4" />} {nameDialog === "file" ? "Open editor" : "Create folder"}</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(renameTarget)} onClose={() => { if (!busy) setRenameTarget(null); }} title="Rename item" subtitle={textOf(renameTarget?.attributes?.name, "")}>
        <form onSubmit={(event) => void renameItem(event)}>
          <label className="text-xs font-bold text-steel">New name<input className="panel-input mt-1.5" value={renameValue} onChange={(event) => setRenameValue(event.target.value)} maxLength={255} autoFocus required /></label>
          <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" type="button" onClick={() => setRenameTarget(null)}>Cancel</button><button className="btn-accent" type="submit" disabled={!renameValue.trim() || Boolean(busy)}>{busy.startsWith("rename-") ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Save name</button></div>
        </form>
      </Modal>

      <Modal open={Boolean(deleteTarget)} onClose={() => { if (!busy) setDeleteTarget(null); }} title="Delete permanently?" subtitle={deleteTarget?.attributes?.is_file === true ? "This file will be removed from the real server." : "This folder and its contents will be removed from the real server."}>
        <div className="rounded-xl border border-danger/25 bg-danger/10 p-3 font-mono text-xs font-bold text-danger">{joinRemotePath(directory, textOf(deleteTarget?.attributes?.name, ""))}</div>
        <div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(busy)}>Cancel</button><button className="btn-danger" type="button" onClick={() => void deleteItem()} disabled={Boolean(busy)}>{busy.startsWith("delete-") ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete permanently</button></div>
      </Modal>

      <Modal wide open={Boolean(editor)} onClose={() => { if (!busy) setEditor(null); }} title={editor?.isNew ? `New file: ${editor.name}` : editor?.name ?? "Edit file"} subtitle={editor?.path}>
        <textarea className="panel-input min-h-[46dvh] resize-y whitespace-pre font-mono text-xs leading-5" value={editor?.content ?? ""} onChange={(event) => setEditor((current) => current ? { ...current, content: event.target.value } : current)} spellCheck={false} aria-label="File contents" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11px] font-semibold text-faint">UTF-8 text · Maximum 1 MB</span>
          <div className="flex gap-2"><button className="btn-ghost" type="button" onClick={() => setEditor(null)} disabled={Boolean(busy)}>Cancel</button><button className="btn-accent" type="button" onClick={() => void saveFile()} disabled={Boolean(busy)}>{busy === "save-file" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save file</button></div>
        </div>
      </Modal>
    </section>
  );
}
