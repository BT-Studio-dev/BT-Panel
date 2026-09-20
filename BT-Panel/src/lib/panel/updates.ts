import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

/**
 * System Updates & Version Control (Admin sidebar → Updates).
 *
 * Everything here runs against REAL data — the local git checkout and the
 * public GitHub API for https://github.com/lie-kg1/BT-Panel. Anything that
 * cannot be done truthfully (e.g. a live process hot-replacing itself)
 * refuses honestly instead of faking a success, matching the panel's rules.
 */

const UPDATE_REPO_SLUG = "lie-kg1/BT-Panel";
const UPDATE_REPO_URL = `https://github.com/${UPDATE_REPO_SLUG}`;
const GITHUB_API = `https://api.github.com/repos/${UPDATE_REPO_SLUG}`;

const run = promisify(execFile);

/**
 * Minimal admin guard, local to this module on purpose: importing the panel
 * server's (non-RPC) helper would force the whole server.ts graph — including
 * Node-only modules — into the browser bundle.
 */
async function requireAdminUser(userId: string): Promise<void> {
  const sql = await getSql();
  const rows = await sql.query<{ role: string; status: string }>(
    `select role, status from profiles where user_id = $1`,
    [userId],
  );
  const profile = rows[0];
  if (!profile) throw new Error("Profile not found.");
  if (profile.status !== "active") throw new Error("This account is not active.");
  if (profile.role !== "owner" && profile.role !== "admin") {
    throw new Error("Administrator permission required.");
  }
}

async function cmd(
  bin: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ ok: true; out: string } | { ok: false; error: string }> {
  try {
    const { stdout, stderr } = await run(bin, args, { cwd, timeout: timeoutMs, maxBuffer: 512 * 1024 });
    return { ok: true, out: (stdout + (stderr ? `\n${stderr}` : "")).trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return { ok: false, error: message };
  }
}

async function gitRoot(): Promise<string | null> {
  const res = await cmd("git", ["rev-parse", "--show-toplevel"], process.cwd(), 5000);
  return res.ok && res.out ? res.out : null;
}

export type InstalledInfo = {
  version: string;
  branch: string;
  commit: string;
  commitDate: string;
  commitSubject: string;
  remote: string;
  gitAvailable: boolean;
};

export type ReleaseInfo =
  | {
      ok: true;
      tag: string;
      name: string;
      url: string;
      publishedAt: string;
      author: string;
      prerelease: boolean;
    }
  | { ok: false; reason: string };

export type UpdateStatus = "up-to-date" | "update-available" | "dev-build" | "unknown";

export type UpdateSnapshot = {
  repo: string;
  repoUrl: string;
  releasesUrl: string;
  installed: InstalledInfo;
  release: ReleaseInfo;
  status: UpdateStatus;
  statusNote: string;
  checkedAt: string;
};

// GitHub's unauthenticated rate limit is 60 requests/hour per IP — keep a
// short server-side cache, like the wallpaper catalog does.
let statusCache: { at: number; value: UpdateSnapshot } | null = null;
const STATUS_TTL = 10 * 60 * 1000;

async function loadInstalled(): Promise<InstalledInfo> {
  const info: InstalledInfo = {
    version: "",
    branch: "",
    commit: "",
    commitDate: "",
    commitSubject: "",
    remote: "",
    gitAvailable: false,
  };
  try {
    const raw = await readFile(new URL("../../package.json", import.meta.url), "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    info.version = typeof pkg.version === "string" ? pkg.version : "";
  } catch {
    /* no version field — reported below */
  }
  const root = await gitRoot();
  if (!root) return info;
  info.gitAvailable = true;
  const [branch, head, remote] = await Promise.all([
    cmd("git", ["-C", root, "rev-parse", "--abbrev-ref", "HEAD"], root, 5000),
    cmd("git", ["-C", root, "log", "-1", "--format=%h|%ci|%s"], root, 5000),
    cmd("git", ["-C", root, "remote", "get-url", "origin"], root, 5000),
  ]);
  if (branch.ok) info.branch = branch.out;
  if (remote.ok) info.remote = remote.out;
  if (head.ok) {
    const [sha, date, subject] = head.out.split("|");
    info.commit = (sha || "").trim();
    info.commitDate = (date || "").trim();
    info.commitSubject = (subject || "").trim();
  }
  return info;
}

async function loadLatestRelease(): Promise<ReleaseInfo> {
  try {
    const res = await fetch(`${GITHUB_API}/releases/latest`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "BT-Panel-Update-Check",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
    const data = (await res.json()) as {
      tag_name?: string;
      name?: string;
      html_url?: string;
      published_at?: string;
      prerelease?: boolean;
      author?: { login?: string };
    };
    if (!data.tag_name) throw new Error("Latest release response had no tag");
    return {
      ok: true,
      tag: data.tag_name,
      name: data.name || data.tag_name,
      url: data.html_url || `${UPDATE_REPO_URL}/releases/tag/${data.tag_name}`,
      publishedAt: data.published_at || "",
      author: data.author?.login || "",
      prerelease: Boolean(data.prerelease),
    };
  } catch (err) {
    const cause =
      err && typeof err === "object" && "cause" in err && err.cause instanceof Error
        ? ` — ${err.cause.message}`
        : "";
    return {
      ok: false,
      reason: (err instanceof Error ? err.message : "Could not reach GitHub") + cause,
    };
  }
}

async function snapshot(): Promise<UpdateSnapshot> {
  if (statusCache && Date.now() - statusCache.at < STATUS_TTL) return statusCache.value;
  const [installed, release] = await Promise.all([loadInstalled(), loadLatestRelease()]);
  let status: UpdateStatus = "unknown";
  let note = "";
  if (!installed.gitAvailable && !installed.version) {
    note = "No git metadata or version marker in this runtime.";
  }
  if (!release.ok) {
    status = "unknown";
    note = `Latest release could not be checked: ${release.reason}`;
  } else if (installed.version && installed.version === release.tag.replace(/^v/, "")) {
    status = "up-to-date";
    note = `Running the latest published release (${release.tag}).`;
  } else if (installed.version || installed.commit) {
    status = "dev-build";
    note = installed.commit
      ? `Running a git checkout (${installed.branch ? `${installed.branch} · ` : ""}${installed.commit}) — releases install via a fresh deploy, not a tag match.`
      : "Build version does not come from a release tag.";
  }
  const value: UpdateSnapshot = {
    repo: UPDATE_REPO_SLUG,
    repoUrl: UPDATE_REPO_URL,
    releasesUrl: `${UPDATE_REPO_URL}/releases`,
    installed,
    release,
    status,
    statusNote: note,
    checkedAt: new Date().toISOString(),
  };
  statusCache = { at: Date.now(), value };
  return value;
}

export const getUpdateStatus = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdminUser(context.userId);
    return snapshot();
  });

export const refreshUpdateStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireAdminUser(context.userId);
    statusCache = null;
    return snapshot();
  });

export type UpdateActionResult = { ok: boolean; title: string; lines: string[] };

async function collect(title: string, steps: [string, string, string[], string?][]): Promise<UpdateActionResult> {
  const lines: string[] = [];
  let ok = true;
  for (const [label, bin, args, cwd] of steps) {
    lines.push(`$ ${bin} ${args.join(" ")}`);
    const res = await cmd(bin, args, cwd ?? process.cwd(), 25_000);
    if (res.ok) {
      for (const line of res.out.split("\n")) if (line.trim()) lines.push(`  ${line}`);
      if (!res.out) lines.push(`  ${label} — done, no output.`);
    } else {
      ok = false;
      lines.push(`  ✖ ${res.error}`);
    }
  }
  return { ok, title, lines };
}

/** Real `git status`, branch info and a best-effort fetch against origin. */
export const runGitStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<UpdateActionResult> => {
    await requireAdminUser(context.userId);
    const root = await gitRoot();
    if (!root) {
      return { ok: false, title: "Check Git Status", lines: ["✖ Git runtime not available on this server."] };
    }
    return collect("Check Git Status", [
      ["status", "git", ["-C", root, "status", "-sb"]],
      ["head", "git", ["-C", root, "log", "-1", "--format=HEAD  %h  %ci%n%s"]],
      ["fetch", "git", ["-C", root, "fetch", "--prune", "origin"]],
      ["tracking", "git", ["-C", root, "rev-list", "--left-right", "--count", "HEAD...@{u}"]],
    ]);
  });

/** Replays pending SQL migrations against the live database (db:migrate). */
export const runSchemaSync = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<UpdateActionResult> => {
    await requireAdminUser(context.userId);
    return collect("Sync Dependencies & Schema", [
      ["migrations", "node", ["scripts/migrate.mjs"], process.cwd()],
    ]);
  });

/**
 * "Start Full Update": fetches the latest code for real, then honestly stops.
 * A running Node process cannot replace its own module graph, and this
 * sandbox is redeployed externally — so instead of pretending to reinstall we
 * fetch, report exactly how far behind HEAD is, and say what the next real
 * step is.
 */
export const startFullUpdate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<UpdateActionResult & { upToDate: boolean }> => {
    await requireAdminUser(context.userId);
    const root = await gitRoot();
    if (!root) {
      return { ok: false, upToDate: false, title: "Full Update", lines: ["✖ Git runtime not available on this server."] };
    }
    const lines: string[] = ["$ git fetch --prune origin"];
    const fetchRes = await cmd("git", ["-C", root, "fetch", "--prune", "origin"], root, 30_000);
    if (!fetchRes.ok) {
      return {
        ok: false,
        upToDate: false,
        title: "Full Update",
        lines: [...lines, `  ✖ ${fetchRes.error}`, "Update aborted — could not refresh remote refs."],
      };
    }
    for (const line of fetchRes.out.split("\n")) if (line.trim()) lines.push(`  ${line}`);
    const count = await cmd("git", ["-C", root, "rev-list", "--left-right", "--count", "HEAD...@{u}"], root, 5000);
    let upToDate = false;
    if (count.ok) {
      const [ahead = "0", behind = "0"] = count.out.trim().split(/\s+/);
      lines.push(`$ git rev-list --left-right --count HEAD...@{u}`, `  ahead ${ahead} · behind ${behind}`);
      upToDate = Number(behind) === 0;
      if (upToDate && Number(ahead) === 0) {
        lines.push("✔ Working tree is exactly in sync with the upstream branch.");
      } else if (upToDate) {
        lines.push(`✔ No upstream commits to apply — checkout is ${ahead} commit(s) ahead of origin.`);
    } else {
        lines.push(`↺ ${behind} upstream commit(s) available.`);
      }
    }
    lines.push(
      "",
      "Note: a running panel cannot swap its own code mid-request. To finish an",
      "update, pull/redeploy this checkout and restart the server process — the",
      "session preview redeploys from the working branch automatically.",
    );
    return { ok: true, upToDate, title: "Full Update", lines };
  });
