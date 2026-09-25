"use client";

import type { ReactNode } from "react";
import { ArrowRight, Cpu, Globe, MemoryStick, Plus, Server, Users } from "lucide-react";
import { NODES, getTemplate } from "@/lib/panel/catalog";
import { sampleTelemetry } from "@/lib/panel/telemetry";
import { PANEL_VERSION } from "@/lib/panel/types";
import { formatMb } from "@/lib/utils";
import { usePanel } from "../context";
import { EmptyState, Meter, PresenceAvatar, Stat, StatusBadge, TemplateBadge, useNow } from "../ui";

export function HomeView() {
  const { profile, settings, userCount, isAdmin, setView, setSettingsTab, servers, openServer, team } = usePanel();
  const now = useNow(2000);
  const running = servers.filter((s) => s.status === "running");
  const totalMem = servers.reduce((sum, s) => sum + s.memoryMb, 0);
  const cpuLimit = running.reduce((sum, s) => sum + s.cpuLimit, 0);
  const samples = now ? running.map((s) => sampleTelemetry(s, now)) : [];
  const usedMem = samples.reduce((sum, t) => sum + t.memMb, 0);
  const cpuUsed = samples.reduce((sum, t) => sum + t.cpu, 0);
  const isOnline = (userId: string, online: boolean) => online || userId === profile.userId;
  const onlineTeam = team.filter((m) => isOnline(m.userId, m.online));

  return (
    <div className="grid gap-4">
      <div className="glass overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[16px] font-extrabold">{settings.welcomeTitle}</h2>
            {settings.panelSubtitle ? <p className="mt-0.5 text-[12px] font-semibold text-steel">{settings.panelSubtitle}</p> : null}
          </div>
          <span className="hidden items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-3 py-1 text-[11px] font-extrabold text-ok sm:inline-flex">
            <span className="status-dot running live-ping" />
            {running.length} {running.length === 1 ? "server" : "servers"} online
          </span>
        </div>
        <div className="px-5 py-5">
          <p className="text-[15px] font-semibold text-steel">
            {settings.welcomeMessage} Hello <strong className="text-ice">{profile.username}</strong>
            {settings.showRole ? (
              <>
                . You are signed in as {/^[aeiou]/i.test(profile.role) ? "an" : "a"}{" "}
                <span className="text-ice">{profile.role}</span>.
              </>
            ) : (
              "."
            )}
          </p>

          {isAdmin && settings.showAdminStats ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Stat label="Total Users" value={String(userCount)} accent />
              <button type="button" className="text-left" onClick={() => setSettingsTab("appearance")}>
                <Stat label="Appearance" value="Open Settings" link />
              </button>
              <button type="button" className="text-left" onClick={() => setView("users")}>
                <Stat label="User Management" value="Manage Users" link />
              </button>
            </div>
          ) : null}

          {settings.showVersion ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Stat label="Panel Version" value={PANEL_VERSION} mono />
              <Stat label="Access" value={isAdmin ? "Full administrator" : "Member workspace"} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Server className="size-4" />} label="Servers online" value={`${running.length} / ${servers.length}`} hint={`${servers.length - running.length} offline or transitioning`} />
        <MetricCard
          icon={<Cpu className="size-4" />}
          label="Fleet CPU"
          value={now ? `${Math.round(cpuUsed)}%` : "—"}
          hint={`of ${cpuLimit}% allocated to running servers`}
          meter={[cpuUsed, cpuLimit]}
        />
        <MetricCard
          icon={<MemoryStick className="size-4" />}
          label="Memory in use"
          value={now ? formatMb(usedMem) : "—"}
          hint={`of ${formatMb(totalMem)} allocated`}
          meter={[usedMem, totalMem]}
        />
        <MetricCard icon={<Users className="size-4" />} label="Team online" value={`${onlineTeam.length} / ${team.length}`} hint="Presence updates every few seconds" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="glass overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[16px] font-extrabold">Your servers</h2>
              <p className="mt-0.5 text-[12px] font-semibold text-steel">Live status across every node</p>
            </div>
            <button type="button" className="btn-ghost min-h-9 px-3 text-[12px]" onClick={() => setView("servers")}>
              View all <ArrowRight className="size-3.5" />
            </button>
          </div>
          {servers.length === 0 ? (
            <EmptyState
              icon={<Server className="size-5" />}
              title="No servers yet"
              body="Deploy a Minecraft, Rust, CS2 or app server from the Servers page."
              action={
                <button type="button" className="btn-accent" onClick={() => setView("servers")}>
                  <Plus className="size-4" /> Create Server
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-line">
              {servers.slice(0, 6).map((s) => {
                const tel = now ? sampleTelemetry(s, now) : null;
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-fill"
                    onClick={() => openServer(s.id)}
                  >
                    <TemplateBadge templateId={s.template} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-extrabold">{s.name}</div>
                      <div className="truncate font-mono text-[11px] text-steel">
                        {s.ip}:{s.port} · {getTemplate(s.template).name}
                      </div>
                    </div>
                    <div className="hidden w-36 md:block">
                      <div className="mb-1 flex justify-between text-[10.5px] font-bold text-steel">
                        <span>CPU</span>
                        <span className="font-mono font-medium">{tel ? `${Math.round(tel.cpu)}%` : "—"}</span>
                      </div>
                      <Meter value={tel?.cpu ?? 0} max={s.cpuLimit} />
                    </div>
                    <StatusBadge status={s.status} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="glass overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[16px] font-extrabold">Nodes &amp; presence</h2>
            <p className="mt-0.5 text-[12px] font-semibold text-steel">Where your servers run and who is around</p>
          </div>
          <div className="grid gap-2 p-4">
            {NODES.map((n) => {
              const onNode = servers.filter((s) => s.node === n.id);
              const up = onNode.filter((s) => s.status === "running").length;
              return (
                <div key={n.id} className="flex items-center gap-3 rounded-[12px] border border-line bg-fill px-3 py-2.5">
                  <span className="grid size-8 place-items-center rounded-[9px] border border-accent/35 bg-accent/12 text-accent">
                    <Globe className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-extrabold">
                      {n.name} <span className="ml-1 font-mono text-[10.5px] font-medium text-steel">{n.id}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-steel">
                      {n.region} · {onNode.length} {onNode.length === 1 ? "server" : "servers"}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] text-ok">{up} up</span>
                </div>
              );
            })}
          </div>
          <div className="border-t border-line px-4 py-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-extrabold tracking-[0.12em] text-steel uppercase">Team</span>
              <button type="button" className="text-[12px] font-bold text-accent hover:brightness-125" onClick={() => setView("team")}>
                View team
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {team.slice(0, 8).map((m) => (
                <div key={m.userId} className="flex items-center gap-2 rounded-[12px] border border-line bg-fill py-1 pr-3 pl-1">
                  <PresenceAvatar name={m.username} src={m.profilePic} size="sm" online={isOnline(m.userId, m.online)} />
                  <div>
                    <div className="text-[12px] font-extrabold">{m.username}</div>
                    <div className="text-[9.5px] font-bold tracking-[0.12em] text-steel uppercase">{m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  meter,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  meter?: [number, number];
}) {
  return (
    <div className="glass p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-[0.12em] text-steel uppercase">{label}</span>
        <span className="grid size-8 place-items-center rounded-[9px] border border-accent/35 bg-accent/12 text-accent">{icon}</span>
      </div>
      <div className="mt-2 text-[24px] font-extrabold tracking-tight">{value}</div>
      {meter ? <Meter value={meter[0]} max={meter[1]} className="mt-2" /> : null}
      <div className="mt-2 text-[11.5px] font-semibold text-steel">{hint}</div>
    </div>
  );
}
