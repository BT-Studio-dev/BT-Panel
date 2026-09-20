import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Copy,
  DatabaseZap,
  Download,
  ExternalLink,
  GitBranch,
  Github,
  MonitorCog,
  Rocket,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getUpdateStatus,
  refreshUpdateStatus,
  runGitStatus,
  runSchemaSync,
  startFullUpdate,
  type UpdateActionResult,
  type UpdateSnapshot,
} from "@/lib/panel/updates";

type Running = "check" | "git" | "schema" | "update" | null;

const STATUS_CHIP: Record<UpdateSnapshot["status"], { label: string; cls: string }> = {
  "up-to-date": { label: "● Up to Date", cls: "bg-ok/15 text-ok border-ok/25" },
  "update-available": { label: "● Update Available", cls: "bg-warn/15 text-warn border-warn/25" },
  "dev-build": { label: "● Dev Build", cls: "bg-[var(--accent)]/15 text-[var(--accent)] border-[var(--accent)]/25" },
  unknown: { label: "● Unknown", cls: "bg-white/10 text-steel border-white/15" },
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export function UpdatesView() {
  const [snapshot, setSnapshot] = useState<UpdateSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [running, setRunning] = useState<Running>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lines, setLines] = useState<string[]>([
    "BT-Panel update terminal — actions stream real command output here.",
    "Idle. Use the buttons below to inspect git state, replay migrations, or fetch upstream.",
    "",
  ]);
  const consoleRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (fresh: boolean) => {
    try {
      setLoadError("");
      const value = fresh ? await refreshUpdateStatus() : await getUpdateStatus();
      setSnapshot(value);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load update status.");
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (autoScroll) consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight });
  }, [lines, autoScroll]);

  const appendResult = (result: UpdateActionResult & { upToDate?: boolean }, command: string) => {
    const stamp = new Date().toLocaleTimeString();
    setLines((prev) => [
      ...prev,
      `┌─ ${result.title} — ${stamp}`,
      `» ${command}`,
      ...result.lines,
      result.ok ? "└─ ✔ Finished" : "└─ ✖ Failed",
      "",
    ]);
  };

  const runAction = async (kind: Running, command: string, fn: () => Promise<UpdateActionResult & { upToDate?: boolean }>) => {
    if (running) return;
    setRunning(kind);
    try {
      appendResult(await fn(), command);
    } catch (err) {
      appendResult(
        { ok: false, title: command, lines: [`✖ ${err instanceof Error ? err.message : "Action failed"}`] },
        command,
      );
    } finally {
      setRunning(null);
      void load(true).catch(() => {});
    }
  };

  const snapshotStatusCard = () => {
    const chip = snapshot ? STATUS_CHIP[snapshot.status] : STATUS_CHIP.unknown;
    return (
      <div className="glass p-4">
        <div className="flex items-center justify-between text-[11px] font-extrabold tracking-[0.14em] text-steel uppercase">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-[var(--accent)]" /> System Status
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-extrabold ${chip.cls}`}>{chip.label}</span>
        </div>
        <div className="mt-3 text-[15px] font-extrabold">
          {snapshot?.status === "up-to-date"
            ? "System is synchronized"
            : snapshot?.status === "dev-build"
              ? "Running a development build"
              : snapshot?.status === "update-available"
                ? "A newer release exists"
                : loadError
                  ? "Status check failed"
                  : "Checking…"}
        </div>
        <p className="mt-1 min-h-10 text-[12px] leading-relaxed font-semibold text-steel">
          {snapshot?.statusNote || loadError || "Fetching repository state…"}
        </p>
        <button
          type="button"
          className="btn-accent mt-2 w-full"
          disabled={running !== null}
          onClick={() =>
            runAction("update", "workflow: fetch origin → report upstream delta", () => startFullUpdate())
          }
        >
          {running === "update" ? "Running…" : "Start Full Update"}
        </button>
      </div>
    );
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-extrabold tracking-[0.18em] text-[var(--accent)] uppercase">
            System lifecycle
          </div>
          <h2 className="mt-1 text-[20px] font-extrabold tracking-tight">System Updates &amp; Version Control</h2>
          <p className="mt-0.5 text-[12.5px] font-semibold text-steel">
            Checking{" "}
            <a
              className="text-[var(--accent)] underline decoration-white/20 underline-offset-2"
              href={snapshot?.releasesUrl ?? "https://github.com/lie-kg1/BT-Panel/releases"}
              target="_blank"
              rel="noreferrer"
            >
              github.com/{snapshot?.repo ?? "lie-kg1/BT-Panel"}
            </a>{" "}
            with live terminal output
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost min-h-10 text-[12.5px]"
            disabled={running !== null}
            onClick={() => void load(true)}
          >
            <MonitorCog className="size-4" /> Check for Updates
          </button>
          <a
            className="btn-accent min-h-10 text-[12.5px]"
            href={snapshot?.releasesUrl ?? "https://github.com/lie-kg1/BT-Panel/releases"}
            target="_blank"
            rel="noreferrer"
          >
            <Github className="size-4" /> GitHub Releases
          </a>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="glass p-4">
          <div className="flex items-center justify-between text-[11px] font-extrabold tracking-[0.14em] text-steel uppercase">
            <span className="flex items-center gap-1.5">
              <TerminalSquare className="size-3.5 text-[var(--accent)]" /> Installed Version
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-extrabold text-steel">
              local
            </span>
          </div>
          <div className="mt-3 text-[22px] font-extrabold text-[var(--accent)]">
            {snapshot?.installed.version ? `v${snapshot.installed.version}` : "—"}
          </div>
          <div className="mt-1 space-y-0.5 text-[12px] font-semibold text-steel">
            <div className="flex items-center gap-1.5">
              <GitBranch className="size-3" />
              {snapshot?.installed.branch || "—"} · Commit {snapshot?.installed.commit || "—"}
            </div>
            {snapshot?.installed.commitSubject ? (
              <div className="truncate opacity-80">{snapshot.installed.commitSubject}</div>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold">
            <span className="text-steel">Runtime metadata</span>
            <span>{snapshot?.installed.gitAvailable ? "git OK" : "git unavailable"}</span>
          </div>
        </div>

        <div className="glass p-4">
          <div className="flex items-center justify-between text-[11px] font-extrabold tracking-[0.14em] text-steel uppercase">
            <span className="flex items-center gap-1.5">
              <Download className="size-3.5 text-[var(--accent)]" /> Latest GitHub Release
            </span>
            {snapshot?.release.ok ? (
              <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] font-extrabold text-[var(--accent)]">
                {snapshot.release.tag}
              </span>
            ) : null}
          </div>
          <div className="mt-3 text-[22px] font-extrabold text-[var(--accent)]">
            {snapshot?.release.ok ? snapshot.release.tag : "—"}
          </div>
          {snapshot?.release.ok ? (
            <div className="mt-1 space-y-0.5 text-[12px] font-semibold text-steel">
              <div className="truncate">{snapshot.release.name}</div>
              <div className="flex items-center justify-between">
                <span>Published: {fmtDate(snapshot.release.publishedAt)}</span>
                <span>By: {snapshot.release.author || "—"}</span>
              </div>
            </div>
          ) : (
            <p className="mt-1 flex items-start gap-1.5 text-[12px] font-semibold text-steel">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-warn" />
              {snapshot?.release.ok === false
                ? `Could not reach GitHub: ${snapshot.release.reason}`
                : "Checking releases…"}
            </p>
          )}
          {snapshot?.release.ok ? (
            <a
              className="btn-ghost mt-3 flex min-h-9 w-full text-[12px]"
              href={snapshot.release.url}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="size-3.5" /> View release notes
            </a>
          ) : null}
        </div>

        {snapshotStatusCard()}
      </div>

      <div className="glass overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-2.5">
          <div className="flex items-center gap-2 text-[12px] font-bold text-steel">
            <span className="flex gap-1.5">
              <i className="size-2.5 rounded-full bg-danger/80" />
              <i className="size-2.5 rounded-full bg-warn/80" />
              <i className="size-2.5 rounded-full bg-ok/80" />
            </span>
            <span className="font-mono">bash — bt-panel (live update terminal)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-full border px-2.5 py-1 text-[10.5px] font-extrabold ${
                autoScroll
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "border-white/15 bg-white/5 text-steel"
              }`}
              onClick={() => setAutoScroll((v) => !v)}
            >
              Auto-Scroll: {autoScroll ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-extrabold text-steel hover:text-ice"
              onClick={() => {
                void navigator.clipboard?.writeText(lines.join("\n"));
                toast.success("Logs copied");
              }}
            >
              <Copy className="mr-1 inline size-3" /> Copy Logs
            </button>
            <button
              type="button"
              className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10.5px] font-extrabold text-steel hover:text-ice"
              onClick={() => setLines([])}
            >
              <Trash2 className="mr-1 inline size-3" /> Clear
            </button>
          </div>
        </div>
        <div
          ref={consoleRef}
          className="scrollbar-thin max-h-80 min-h-52 overflow-y-auto bg-black/45 px-4 py-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-green-200/90"
        >
          {lines.join("\n") || " "}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-accent min-h-11"
          disabled={running !== null}
          onClick={() =>
            runAction("update", "workflow: fetch origin → report upstream delta", () => startFullUpdate())
          }
        >
          <Rocket className="size-4" /> {running === "update" ? "Updating…" : "Start Full Update"}
        </button>
        <button
          type="button"
          className="btn-ghost min-h-11"
          disabled={running !== null}
          onClick={() =>
            runAction("schema", "$ node scripts/migrate.mjs", () => runSchemaSync())
          }
        >
          <DatabaseZap className="size-4" /> {running === "schema" ? "Migrating…" : "Sync Dependencies & Schema"}
        </button>
        <button
          type="button"
          className="btn-ghost min-h-11"
          disabled={running !== null}
          onClick={() => runAction("git", "$ git status / log / fetch", () => runGitStatus())}
        >
          <CircleDashed className="size-4" /> {running === "git" ? "Checking…" : "Check Git Status"}
        </button>
      </div>
    </div>
  );
}
