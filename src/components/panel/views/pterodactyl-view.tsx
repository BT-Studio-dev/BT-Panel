import { useCallback, useEffect, useState } from "react";
import { HardDrive, MemoryStick, Power, RefreshCw, RotateCw, Send, Server, Square, Terminal, Zap } from "lucide-react";
import { toast } from "sonner";
import { getPterodactylServers, getPterodactylWebsocket, pterodactylCommand, pterodactylPower, type PterodactylServer } from "@/lib/pterodactyl/server";

function bytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = value, i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)} ${units[i]}`;
}

function stateOf(s: PterodactylServer) {
  if (s.suspended) return "Suspended";
  if (s.installing) return "Installing";
  if (s.transferring) return "Transferring";
  return s.resources?.state || s.status || "Offline";
}

export function PterodactylView() {
  const [servers, setServers] = useState<PterodactylServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<PterodactylServer | null>(null);
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [connecting, setConnecting] = useState(false);

  const load = useCallback(async (quiet = false) => {
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const result = await getPterodactylServers();
      setServers(result);
      setSelected((old) => result.find((s) => s.identifier === old?.identifier) || result[0] || null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load Pterodactyl.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(true), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function power(signal: "start" | "stop" | "restart" | "kill") {
    if (!selected) return;
    try {
      await pterodactylPower({ data: { identifier: selected.identifier, signal } });
      toast.success(`${signal} request sent`);
      setTimeout(() => void load(true), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Power action failed.");
    }
  }

  async function send() {
    if (!selected || !command.trim()) return;
    const value = command.trim();
    try {
      await pterodactylCommand({ data: { identifier: selected.identifier, command: value } });
      setLogs((x) => [...x.slice(-300), `> ${value}`]);
      setCommand("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Command failed.");
    }
  }

  async function connect() {
    if (!selected || connecting) return;
    setConnecting(true);
    try {
      const { socket, token } = await getPterodactylWebsocket({ data: { identifier: selected.identifier } });
      const ws = new WebSocket(socket);
      ws.onopen = () => {
        ws.send(JSON.stringify({ event: "auth", args: [token] }));
        ws.send(JSON.stringify({ event: "send logs", args: [] }));
        setLogs((x) => [...x.slice(-300), "[connected]"]);
      };
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { event?: string; args?: string[] };
          if (message.event === "console output" && message.args?.[0]) setLogs((x) => [...x.slice(-300), message.args![0]]);
          if (message.event === "status" && message.args?.[0]) setLogs((x) => [...x.slice(-300), `[status] ${message.args![0]}`]);
        } catch {}
      };
      ws.onclose = () => setLogs((x) => [...x.slice(-300), "[disconnected]"]);
      ws.onerror = () => toast.error("Console WebSocket connection failed.");
      (window as Window & { __btPteroWs?: WebSocket }).__btPteroWs?.close();
      (window as Window & { __btPteroWs?: WebSocket }).__btPteroWs = ws;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not connect to console.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div><h2 className="text-[16px] font-extrabold">Pterodactyl</h2><p className="text-[12px] font-semibold text-steel">Server management</p></div>
          <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-extrabold"><RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />Refresh</button>
        </div>
        <div className="p-4">
          {loading ? <div className="py-8 text-center text-sm text-steel">Loading servers…</div> : servers.length === 0 ? <div className="py-8 text-center text-sm text-steel">No Pterodactyl servers found.</div> : (
            <div className="grid gap-3 lg:grid-cols-2">
              {servers.map((server) => (
                <button key={server.identifier} type="button" onClick={() => setSelected(server)} className={`glass-soft rounded-xl border p-4 text-left ${selected?.identifier === server.identifier ? "border-[var(--accent)]" : "border-white/8"}`}>
                  <div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Server className="size-5 text-[var(--accent)]" /><div className="min-w-0"><div className="truncate font-extrabold">{server.name}</div><div className="truncate font-mono text-[10px] text-steel">{server.identifier} · {server.node}</div></div></div><span className="text-[10px] font-extrabold uppercase text-steel">{stateOf(server)}</span></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]"><Metric icon={<Zap className="size-3" />} label="CPU" value={server.resources ? `${server.resources.cpuPercent.toFixed(1)}%` : "—"} /><Metric icon={<MemoryStick className="size-3" />} label="RAM" value={server.resources ? bytes(server.resources.memoryBytes) : "—"} /><Metric icon={<HardDrive className="size-3" />} label="Disk" value={server.resources ? bytes(server.resources.diskBytes) : "—"} /></div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected ? <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="glass p-5">
          <div className="mb-4 flex items-center gap-3"><Server className="size-5 text-[var(--accent)]" /><div><div className="font-extrabold">{selected.name}</div><div className="text-[10px] text-steel">{stateOf(selected)}</div></div></div>
          <div className="flex flex-wrap gap-2">
            <PowerButton label="Start" icon={<Power className="size-4" />} onClick={() => void power("start")} />
            <PowerButton label="Stop" icon={<Square className="size-4" />} onClick={() => void power("stop")} />
            <PowerButton label="Restart" icon={<RotateCw className="size-4" />} onClick={() => void power("restart")} />
            <PowerButton label="Kill" danger icon={<Zap className="size-4" />} onClick={() => void power("kill")} />
          </div>
          <div className="mt-5 space-y-2 text-xs text-steel">
            <div className="flex justify-between"><span>CPU</span><b>{selected.resources ? `${selected.resources.cpuPercent.toFixed(1)}%` : "—"}</b></div>
            <div className="flex justify-between"><span>RAM</span><b>{selected.resources ? bytes(selected.resources.memoryBytes) : "—"}</b></div>
            <div className="flex justify-between"><span>Disk</span><b>{selected.resources ? bytes(selected.resources.diskBytes) : "—"}</b></div>
          </div>
        </div>
        <div className="glass flex min-h-[420px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3"><div className="flex items-center gap-2 font-extrabold"><Terminal className="size-4" />Console</div><button type="button" onClick={() => void connect()} disabled={connecting} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-extrabold">{connecting ? "Connecting…" : "Connect"}</button></div>
          <pre className="flex-1 overflow-auto bg-black/20 p-4 font-mono text-[11px] leading-5 text-white/80">{logs.length ? logs.join("\n") : "Connect to view console output."}</pre>
          <form className="flex gap-2 border-t border-white/10 p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}><input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Enter command…" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none" /><button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-extrabold"><Send className="size-4" />Send</button></form>
        </div>
      </div> : null}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2"><div className="flex items-center gap-1 text-[9px] font-extrabold text-steel uppercase">{icon}{label}</div><div className="mt-1 font-mono text-xs font-bold">{value}</div></div>;
}

function PowerButton({ label, icon, danger, onClick }: { label: string; icon: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-extrabold ${danger ? "border-red-400/30 text-red-300" : "border-white/10 bg-white/5"}`}>{icon}{label}</button>;
}
