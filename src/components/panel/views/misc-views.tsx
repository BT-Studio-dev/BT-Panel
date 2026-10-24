"use client";

import { useState } from "react";
import { Mail, Pause, Play, Repeat, Users, Volume2 } from "lucide-react";
import type { PanelProfile } from "@/lib/panel/types";
import { cn, formatJoined, timeAgo } from "@/lib/utils";
import { usePanel } from "../context";
import { BrandMark, EmptyState, Modal, PresenceAvatar, Slider, ToggleRow, useNow } from "../ui";

// ── Team ────────────────────────────────────────────────────────────────────
type PresenceFilter = "all" | "online" | "offline";

export function TeamView() {
  const { team, profile, settings, isAdmin } = usePanel();
  const now = useNow(30000);
  const [filter, setFilter] = useState<PresenceFilter>("all");
  const [profileMember, setProfileMember] = useState<PanelProfile | null>(null);
  const isOnline = (m: PanelProfile) => m.online || m.userId === profile.userId;

  if (!settings.showTeam && !isAdmin) {
    return (
      <div className="glass">
        <EmptyState icon={<Users className="size-5" />} title="Team directory hidden" body="An administrator has hidden the team page on this panel." />
      </div>
    );
  }

  const list = team.filter((m) => (filter === "all" ? true : filter === "online" ? isOnline(m) : !isOnline(m)));

  return (
    <div className="glass overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[16px] font-extrabold">Team Members</h2>
          <p className="mt-0.5 text-[12px] font-semibold text-steel">
            {team.filter(isOnline).length} online · {team.length} total
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["all", "online", "offline"] as PresenceFilter[]).map((f) => (
            <button key={f} type="button" className={cn("pill-tab min-h-9 px-3.5 text-[12px] capitalize", filter === f && "active")} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.length === 0 ? (
          <p className="col-span-full px-2 py-8 text-center text-sm font-semibold text-steel">No members in this filter.</p>
        ) : (
          list.map((member) => {
            const online = isOnline(member);
            return (
              <div key={member.userId} className="glass-soft flex items-center gap-3 rounded-[14px] border border-line p-3">
                <PresenceAvatar name={member.username} src={member.profilePic} online={online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-extrabold">{member.username}</span>
                    {member.userId === profile.userId ? (
                      <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9.5px] font-extrabold text-accent">YOU</span>
                    ) : null}
                  </div>
                  <div className="text-[11px] font-bold tracking-[0.12em] text-steel uppercase">
                    {member.role}
                    {member.status === "suspended" ? " · suspended" : ""}
                  </div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-faint">
                    {online ? "Online now" : `Last seen ${now ? timeAgo(member.lastSeen, now) : "—"}`} · Joined {formatJoined(member.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost shrink-0 px-2.5 py-1 text-[11.5px] font-extrabold"
                  onClick={() => setProfileMember(member)}
                  aria-label={`View profile of ${member.username}`}
                >
                  View
                </button>
              </div>
            );
          })
        )}
      </div>
      <Modal
        open={!!profileMember}
        onClose={() => setProfileMember(null)}
        title={profileMember ? `${profileMember.username}'s profile` : ""}
        subtitle={profileMember ? (profileMember.online ? "Online now" : "Team member") : undefined}
        wide
      >
        {profileMember ? (
          <ProfileDetails member={profileMember} now={now} isYou={profileMember.userId === profile.userId} />
        ) : null}
      </Modal>
    </div>
  );
}

function ProfileDetails({ member, now, isYou }: { member: PanelProfile; now: number | null; isYou: boolean }) {
  const isOnline = member.online || isYou;
  return (
    <div className="grid gap-5 md:grid-cols-[180px_minmax(0,1fr)]">
      <div className="flex flex-col items-center text-center">
        <PresenceAvatar name={member.username} src={member.profilePic} size="lg" online={isOnline} />
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-white uppercase">{member.role}</span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-wide uppercase",
              member.status === "suspended" ? "bg-danger/15 text-danger" : "bg-ok/15 text-ok",
            )}
          >
            {member.status}
          </span>
        </div>
        {isYou ? (
          <span className="mt-2 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-extrabold text-accent">THIS IS YOU</span>
        ) : null}
      </div>

      <div className="grid gap-4">
        <section>
          <div className="text-[10.5px] font-extrabold tracking-[0.12em] text-steel uppercase">Username</div>
          <div className="mt-1 text-[16px] font-extrabold text-ice">{member.username}</div>
        </section>

        {member.email ? (
          <section>
            <div className="text-[10.5px] font-extrabold tracking-[0.12em] text-steel uppercase">Email</div>
            <div className="mt-1 flex items-center gap-2 break-all text-[13.5px] font-bold">
              <Mail className="size-3.5 shrink-0 text-steel" />
              <span>{member.email}</span>
            </div>
          </section>
        ) : null}

        <section>
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] font-extrabold tracking-[0.12em] text-steel uppercase">Bio</div>
            <span className="text-[10px] font-bold tracking-[0.12em] text-faint uppercase">
              {member.bio?.trim() ? `${member.bio.trim().length} chars` : "Empty"}
            </span>
          </div>
          <div
            className={cn(
              "mt-1 min-h-[64px] whitespace-pre-wrap rounded-[12px] border px-3 py-2.5 text-[13.5px] font-semibold leading-relaxed",
              member.bio?.trim()
                ? "border-line bg-fill text-ice"
                : "border-dashed border-line-strong bg-fill/40 italic text-faint",
            )}
          >
            {member.bio?.trim() || "No bio yet — this member hasn't written anything about themselves."}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-[12px] border border-line bg-fill px-3 py-2.5">
            <div className="text-[10px] font-extrabold tracking-[0.12em] text-steel uppercase">Last seen</div>
            <div className="mt-0.5 text-[13px] font-extrabold text-ice">
              {isOnline ? "Online now" : now ? timeAgo(member.lastSeen, now) : "—"}
            </div>
          </div>
          <div className="rounded-[12px] border border-line bg-fill px-3 py-2.5">
            <div className="text-[10px] font-extrabold tracking-[0.12em] text-steel uppercase">Joined</div>
            <div className="mt-0.5 text-[13px] font-extrabold text-ice">{formatJoined(member.createdAt)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Music ───────────────────────────────────────────────────────────────────
function mmss(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MusicView() {
  const { music } = usePanel();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="glass overflow-hidden">
        <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <div className="relative grid size-40 shrink-0 place-items-center self-center overflow-hidden rounded-[22px] border border-accent/40 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_srgb,var(--accent)_55%,transparent),transparent_60%),linear-gradient(135deg,#0b0d16,#1a0508)] shadow-[0_0_40px_var(--accent-glow)]">
            <BrandMark className={cn("size-16 transition-transform duration-700", music.playing && "scale-110")} />
            <div className={cn("eq absolute bottom-4 left-1/2 -translate-x-1/2", music.playing && "on")}>
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-extrabold tracking-[0.12em] text-steel uppercase">{music.playing ? "Now playing" : "Ready"}</div>
            <div className="mt-1 text-[24px] font-extrabold tracking-tight">BT Ambient Loop</div>
            <div className="text-[12.5px] font-semibold text-steel">Bundled track · plays across every view</div>
            <input
              type="range"
              className="range-input mt-5"
              min={0}
              max={Math.max(1, music.duration)}
              step={0.1}
              value={Math.min(music.current, music.duration || 0)}
              onChange={(e) => music.seek(Number(e.target.value))}
              aria-label="Seek"
            />
            <div className="mt-1 flex justify-between font-mono text-[11px] text-steel">
              <span>{mmss(music.current)}</span>
              <span>{mmss(music.duration)}</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                className="grid size-14 place-items-center rounded-full bg-accent text-white shadow-[0_6px_24px_var(--accent-glow)] transition-transform hover:scale-105"
                onClick={music.toggle}
                aria-label={music.playing ? "Pause" : "Play"}
              >
                {music.playing ? <Pause className="size-6" /> : <Play className="ml-0.5 size-6" />}
              </button>
              <button
                type="button"
                className={cn("icon-btn size-10", music.loop && "border-accent/50 text-accent")}
                onClick={() => music.setPrefs({ loop: !music.loop })}
                aria-label="Toggle loop"
                title={music.loop ? "Loop on" : "Loop off"}
              >
                <Repeat className="size-4" />
              </button>
              <div className="flex flex-1 items-center gap-2">
                <Volume2 className="size-4 shrink-0 text-steel" />
                <input
                  type="range"
                  className="range-input"
                  min={0}
                  max={100}
                  value={Math.round(music.volume * 100)}
                  onChange={(e) => music.setPrefs({ volume: Number(e.target.value) / 100 })}
                  aria-label="Volume"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="glass p-5">
        <h3 className="text-[16px] font-extrabold">Music studio</h3>
        <p className="mt-1 text-[12.5px] font-semibold text-steel">Preferences are saved in this browser.</p>
        <div className="mt-4 grid gap-2">
          <ToggleRow label="Autoplay" hint="Start the ambient loop on your first click in the panel" checked={music.autoplay} onChange={(v) => music.setPrefs({ autoplay: v })} />
          <ToggleRow label="Loop" hint="Repeat the track seamlessly" checked={music.loop} onChange={(v) => music.setPrefs({ loop: v })} />
          <div className="rounded-[12px] border border-line bg-fill px-4 py-3">
            <Slider label="Volume" value={Math.round(music.volume * 100)} max={100} suffix="%" onChange={(v) => music.setPrefs({ volume: v / 100 })} />
          </div>
        </div>
      </section>
    </div>
  );
}
