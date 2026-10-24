"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Blocks,
  CheckCircle2,
  CircleAlert,
  Copy,
  Files,
  Link2,
  LoaderCircle,
  Network,
  RefreshCw,
  RotateCcw,
  Save,
} from "lucide-react";
import {
  parseMinecraftProperties,
  updateMinecraftProperties,
  validMinecraftInteger,
  validMinecraftPort,
} from "@/lib/panel/minecraft-properties";
import { api } from "@/lib/utils";
import { Switch } from "../ui";
import { copyText, textOf, type ApiItem, type ApiList } from "./pterodactyl-shared";

type MinecraftSettings = {
  motd: string;
  maxPlayers: string;
  gamemode: string;
  difficulty: string;
  viewDistance: string;
  simulationDistance: string;
  spawnProtection: string;
  serverPort: string;
  queryPort: string;
  rconPort: string;
  onlineMode: boolean;
  pvp: boolean;
  whiteList: boolean;
  enableQuery: boolean;
  enableRcon: boolean;
};

const DEFAULT_SETTINGS: MinecraftSettings = {
  motd: "A Minecraft Server",
  maxPlayers: "20",
  gamemode: "survival",
  difficulty: "easy",
  viewDistance: "10",
  simulationDistance: "10",
  spawnProtection: "16",
  serverPort: "25565",
  queryPort: "25565",
  rconPort: "25575",
  onlineMode: true,
  pvp: true,
  whiteList: false,
  enableQuery: false,
  enableRcon: false,
};

function readSettings(content: string): MinecraftSettings {
  const properties = parseMinecraftProperties(content);
  const bool = (key: string, fallback: boolean) => properties[key] === undefined ? fallback : properties[key] === "true";
  return {
    motd: properties.motd ?? DEFAULT_SETTINGS.motd,
    maxPlayers: properties["max-players"] ?? DEFAULT_SETTINGS.maxPlayers,
    gamemode: properties.gamemode ?? DEFAULT_SETTINGS.gamemode,
    difficulty: properties.difficulty ?? DEFAULT_SETTINGS.difficulty,
    viewDistance: properties["view-distance"] ?? DEFAULT_SETTINGS.viewDistance,
    simulationDistance: properties["simulation-distance"] ?? DEFAULT_SETTINGS.simulationDistance,
    spawnProtection: properties["spawn-protection"] ?? DEFAULT_SETTINGS.spawnProtection,
    serverPort: properties["server-port"] ?? DEFAULT_SETTINGS.serverPort,
    queryPort: properties["query.port"] ?? properties["server-port"] ?? DEFAULT_SETTINGS.queryPort,
    rconPort: properties["rcon.port"] ?? DEFAULT_SETTINGS.rconPort,
    onlineMode: bool("online-mode", DEFAULT_SETTINGS.onlineMode),
    pvp: bool("pvp", DEFAULT_SETTINGS.pvp),
    whiteList: bool("white-list", DEFAULT_SETTINGS.whiteList),
    enableQuery: bool("enable-query", DEFAULT_SETTINGS.enableQuery),
    enableRcon: bool("enable-rcon", DEFAULT_SETTINGS.enableRcon),
  };
}

function settingsUpdates(settings: MinecraftSettings): Record<string, string> {
  const updates: Record<string, string> = {
    "motd": settings.motd,
    "max-players": settings.maxPlayers,
    "gamemode": settings.gamemode,
    "difficulty": settings.difficulty,
    "view-distance": settings.viewDistance,
    "simulation-distance": settings.simulationDistance,
    "spawn-protection": settings.spawnProtection,
    "server-port": settings.serverPort,
    "online-mode": String(settings.onlineMode),
    "pvp": String(settings.pvp),
    "white-list": String(settings.whiteList),
    "enable-query": String(settings.enableQuery),
    "enable-rcon": String(settings.enableRcon),
  };
  // A disabled listener keeps its existing port; hidden fields must never
  // overwrite it while the administrator edits an unrelated setting.
  if (settings.enableQuery) updates["query.port"] = settings.queryPort;
  if (settings.enableRcon) updates["rcon.port"] = settings.rconPort;
  return updates;
}

export function PterodactylMinecraft({ identifier, onOpenFiles }: { identifier: string; onOpenFiles: () => void }) {
  const [originalContent, setOriginalContent] = useState("");
  const [settings, setSettings] = useState<MinecraftSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<MinecraftSettings>(DEFAULT_SETTINGS);
  const [allocations, setAllocations] = useState<ApiItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [networkWarning, setNetworkWarning] = useState("");
  const base = `/api/integrations/pterodactyl/servers/${encodeURIComponent(identifier)}`;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    setNetworkWarning("");
    try {
      const [fileResult, allocationResult] = await Promise.allSettled([
        api<{ content: string }>(`${base}/files?file=${encodeURIComponent("/server.properties")}`),
        api<ApiList>(`${base}/allocations`),
      ]);
      if (fileResult.status === "rejected") {
        throw fileResult.reason instanceof Error ? fileResult.reason : new Error("Could not read /server.properties.");
      }
      const content = fileResult.value.content;
      const nextSettings = readSettings(content);
      setOriginalContent(content);
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      if (allocationResult.status === "fulfilled") {
        setAllocations(Array.isArray(allocationResult.value.data) ? allocationResult.value.data : []);
      } else {
        setAllocations([]);
        setNetworkWarning(allocationResult.reason instanceof Error ? allocationResult.reason.message : "Could not load the primary allocation.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the Minecraft configuration.");
    } finally {
      setLoading(false);
    }
  }, [base]);

  // Load the real server.properties and primary allocation when this tab mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  const updatedContent = useMemo(() => updateMinecraftProperties(originalContent, settingsUpdates(settings)), [originalContent, settings]);
  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const primary = allocations.find((item) => item.attributes?.is_default === true) ?? allocations[0] ?? null;
  const primaryAttributes = primary?.attributes ?? {};
  const primaryPort = textOf(primaryAttributes.port, "");
  const primaryHost = textOf(primaryAttributes.ip_alias || primaryAttributes.ip, "");
  const formattedHost = primaryHost.includes(":") && !primaryHost.startsWith("[") ? `[${primaryHost}]` : primaryHost;
  const primaryAddress = primaryHost && primaryPort ? `${formattedHost}:${primaryPort}` : "";
  const portMatches = Boolean(primaryPort && settings.serverPort === primaryPort);

  const patch = <K extends keyof MinecraftSettings>(key: K, value: MinecraftSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const validate = (): boolean => {
    if (!validMinecraftPort(settings.serverPort)) {
      toast.error("Server port must be a whole number from 1 to 65535.");
      return false;
    }
    if (settings.enableQuery && !validMinecraftPort(settings.queryPort)) {
      toast.error("Query port must be a whole number from 1 to 65535.");
      return false;
    }
    if (settings.enableRcon && !validMinecraftPort(settings.rconPort)) {
      toast.error("RCON port must be a whole number from 1 to 65535.");
      return false;
    }
    if (!validMinecraftInteger(settings.maxPlayers, 1, 1000000)) {
      toast.error("Max players must be a whole number from 1 to 1,000,000.");
      return false;
    }
    if (!validMinecraftInteger(settings.viewDistance, 3, 32) || !validMinecraftInteger(settings.simulationDistance, 3, 32)) {
      toast.error("View and simulation distance must be whole numbers from 3 to 32.");
      return false;
    }
    if (!validMinecraftInteger(settings.spawnProtection, 0, 1000000)) {
      toast.error("Spawn protection must be a non-negative whole number.");
      return false;
    }
    if (!settings.motd.trim()) {
      toast.error("MOTD cannot be empty.");
      return false;
    }
    return true;
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!validate()) return;
    setBusy("save");
    try {
      await api(`${base}/files`, {
        method: "POST",
        body: { action: "write", file: "/server.properties", content: updatedContent },
      });
      setOriginalContent(updatedContent);
      setSavedSettings(settings);
      toast.success("Minecraft configuration saved. Restart the server to apply the changes.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save server.properties.");
    } finally {
      setBusy("");
    }
  };

  const copyConfiguration = async () => {
    setBusy("copy-config");
    try {
      await api(`${base}/files`, { method: "POST", body: { action: "copy", location: "/server.properties" } });
      toast.success("A copy of server.properties was created in the server root");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy server.properties.");
    } finally {
      setBusy("");
    }
  };

  const copyAddress = async () => {
    if (!primaryAddress) return;
    setBusy("copy-address");
    try {
      await copyText(primaryAddress);
      toast.success("Minecraft connection address copied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not copy the connection address.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-extrabold"><Blocks className="size-4 text-accent" /> Minecraft Java Edition</h3>
          <p className="mt-1 text-xs font-semibold text-steel">Edit the live <code className="font-mono text-ice">/server.properties</code> without losing comments or other settings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="icon-btn" type="button" onClick={() => void refresh()} disabled={loading || Boolean(busy)} aria-label="Reload Minecraft configuration" title="Reload configuration"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></button>
          <button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={onOpenFiles} disabled={Boolean(busy)}><Files className="size-4" /> Raw files</button>
          <button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={() => void copyConfiguration()} disabled={loading || Boolean(error) || Boolean(busy)}>{busy === "copy-config" ? <LoaderCircle className="size-4 animate-spin" /> : <Copy className="size-4" />} Copy config</button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-warn/30 bg-warn/10 p-5">
          <div className="flex items-center gap-2 text-sm font-extrabold text-warn"><CircleAlert className="size-4" /> Minecraft configuration unavailable</div>
          <p className="mt-2 text-xs text-steel">{error}</p>
          <p className="mt-2 text-xs text-steel">This tool expects a Java Edition <code className="font-mono text-ice">server.properties</code> file in the server root. Other server types can use the full file manager instead.</p>
          <div className="mt-3 flex gap-2"><button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={() => void refresh()}>Try again</button><button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={onOpenFiles}>Open file manager</button></div>
        </div>
      ) : loading ? (
        <div className="grid min-h-56 place-items-center rounded-xl border border-line bg-sunken text-steel"><div className="flex items-center gap-2 text-sm font-bold"><LoaderCircle className="size-4 animate-spin" /> Reading Minecraft configuration…</div></div>
      ) : (
        <>
          <div className="rounded-xl border border-line bg-sunken p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-[0.1em] text-steel uppercase"><Link2 className="size-3.5 text-accent" /> Primary Minecraft address</div>
                <div className="mt-1.5 truncate font-mono text-[15px] font-extrabold" title={primaryAddress || "No allocation available"}>{primaryAddress || "No allocation available"}</div>
              </div>
              <button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={() => void copyAddress()} disabled={!primaryAddress || Boolean(busy)}>{busy === "copy-address" ? <LoaderCircle className="size-4 animate-spin" /> : <Copy className="size-3.5" />} Copy address</button>
            </div>
            {networkWarning ? <p className="mt-3 text-[11px] font-semibold text-warn">Allocation details unavailable: {networkWarning}</p> : null}
            {primaryPort && !portMatches ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warn/25 bg-warn/10 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-steel"><strong className="text-warn">Port mismatch:</strong> server-port is {settings.serverPort || "empty"}, but the primary allocation is {primaryPort}.</p>
                <button className="btn-ghost min-h-8 px-2.5 text-[11px]" type="button" onClick={() => patch("serverPort", primaryPort)} disabled={Boolean(busy)}><Network className="size-3.5" /> Use {primaryPort}</button>
              </div>
            ) : primaryPort ? <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-ok"><CheckCircle2 className="size-3.5" /> server-port matches the primary allocation.</div> : null}
          </div>

          <form onSubmit={(event) => void save(event)}>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <SettingsSection title="Gameplay" description="World defaults shown to players when they join." disabled={Boolean(busy)}>
                <TextSetting className="sm:col-span-2" label="MOTD" value={settings.motd} onChange={(value) => patch("motd", value)} maxLength={512} placeholder="A Minecraft Server" />
                <TextSetting label="Max players" type="number" min={1} max={1000000} value={settings.maxPlayers} onChange={(value) => patch("maxPlayers", value)} />
                <SelectSetting label="Game mode" value={settings.gamemode} onChange={(value) => patch("gamemode", value)} options={["survival", "creative", "adventure", "spectator"]} />
                <SelectSetting label="Difficulty" value={settings.difficulty} onChange={(value) => patch("difficulty", value)} options={["peaceful", "easy", "normal", "hard"]} />
                <TextSetting label="Spawn protection" type="number" min={0} max={1000000} value={settings.spawnProtection} onChange={(value) => patch("spawnProtection", value)} />
                <TextSetting label="View distance" type="number" min={3} max={32} value={settings.viewDistance} onChange={(value) => patch("viewDistance", value)} />
                <TextSetting label="Simulation distance" type="number" min={3} max={32} value={settings.simulationDistance} onChange={(value) => patch("simulationDistance", value)} />
                <div className="space-y-2 sm:col-span-2">
                  <BooleanSetting label="PvP" description="Allow players to damage one another." checked={settings.pvp} onChange={(value) => patch("pvp", value)} />
                  <BooleanSetting label="Whitelist" description="Only allow players listed in whitelist.json." checked={settings.whiteList} onChange={(value) => patch("whiteList", value)} />
                </div>
              </SettingsSection>

              <SettingsSection title="Network & access" description="Match public ports to allocations, then restart Minecraft." disabled={Boolean(busy)}>
                <TextSetting label="Server port" type="number" min={1} max={65535} value={settings.serverPort} onChange={(value) => patch("serverPort", value)} hint="Must match the primary allocation." />
                <div className="sm:col-span-2"><BooleanSetting label="Online mode" description="Verify Minecraft accounts with Mojang. Keep enabled on public servers." checked={settings.onlineMode} onChange={(value) => patch("onlineMode", value)} /></div>
                {!settings.onlineMode ? <div className="rounded-lg border border-danger/25 bg-danger/10 p-3 text-[11px] font-semibold text-danger sm:col-span-2">Offline mode allows unverified identities. Use it only behind a correctly configured, trusted proxy.</div> : null}
                <div className="rounded-xl border border-line bg-fill p-3 sm:col-span-2">
                  <BooleanSetting label="Game query" description="Enable the GameSpy4 query listener." checked={settings.enableQuery} onChange={(value) => patch("enableQuery", value)} />
                  {settings.enableQuery ? <div className="mt-3"><TextSetting label="Query port" type="number" min={1} max={65535} value={settings.queryPort} onChange={(value) => patch("queryPort", value)} /></div> : null}
                </div>
                <div className="rounded-xl border border-line bg-fill p-3 sm:col-span-2">
                  <BooleanSetting label="RCON" description="Enable remote console access. Restrict its port and use a strong password." checked={settings.enableRcon} onChange={(value) => patch("enableRcon", value)} />
                  {settings.enableRcon ? <><div className="mt-3"><TextSetting label="RCON port" type="number" min={1} max={65535} value={settings.rconPort} onChange={(value) => patch("rconPort", value)} /></div><p className="mt-2 text-[10px] font-semibold text-warn">RCON passwords are not displayed here. Do not expose RCON to untrusted networks.</p></> : null}
                </div>
              </SettingsSection>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-sunken p-3">
              <p className="max-w-xl text-[11px] font-semibold text-steel">{dirty ? "You have unsaved changes. " : "Configuration is unchanged. "}Restart Minecraft after saving; BT Panel does not restart it automatically.</p>
              <div className="flex gap-2">
                <button className="btn-ghost min-h-9 px-3 text-xs" type="button" onClick={() => setSettings(savedSettings)} disabled={!dirty || Boolean(busy)}><RotateCcw className="size-3.5" /> Reset</button>
                <button className="btn-accent min-h-9 px-3 text-xs" type="submit" disabled={!dirty || Boolean(busy)}>{busy === "save" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save configuration</button>
              </div>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

function SettingsSection({ title, description, children, disabled }: { title: string; description: string; children: ReactNode; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid gap-3 rounded-xl border border-line bg-sunken p-4 sm:grid-cols-2 disabled:opacity-70">
      <legend className="px-1 text-[13px] font-extrabold">{title}</legend>
      <p className="text-[11px] font-semibold text-steel sm:col-span-2">{description}</p>
      {children}
    </fieldset>
  );
}

function TextSetting({ label, value, onChange, hint, className, type = "text", ...props }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  className?: string;
  type?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  return <label className={`block text-[11px] font-bold text-steel ${className ?? ""}`}>{label}<input className="panel-input mt-1.5 min-h-10 text-xs" type={type} value={value} onChange={(event) => onChange(event.target.value)} {...props} />{hint ? <span className="mt-1 block text-[10px] font-semibold text-faint">{hint}</span> : null}</label>;
}

function SelectSetting({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="block text-[11px] font-bold text-steel">{label}<select className="panel-input mt-1.5 min-h-10 text-xs capitalize" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function BooleanSetting({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between gap-3 rounded-lg py-1"><div><div className="text-[11px] font-extrabold">{label}</div><p className="mt-0.5 text-[10px] font-semibold text-steel">{description}</p></div><Switch checked={checked} onChange={onChange} label={label} /></div>;
}
