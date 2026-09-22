import { ArrowUpRight } from "lucide-react";
import { PANEL_VERSION, isAdminRole } from "@/lib/panel/types";
import { usePanelUi } from "@/lib/panel/store";
import { usePanel } from "../context";

export function HomeView() {
  const { profile, settings, userCount, isAdmin } = usePanel();
  const setView = usePanelUi((s) => s.setView);
  if (!profile) return null;

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-[16px] font-extrabold">{settings.welcomeTitle}</h2>
          {settings.panelSubtitle ? (
            <p className="mt-0.5 text-[12px] font-semibold text-steel">{settings.panelSubtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="px-5 py-5">
        <p className="text-[15px] font-semibold text-steel">
          {settings.welcomeMessage} Hello{" "}
          <strong className="text-ice">{profile.username}</strong>
          {settings.showRole ? (
            <>
              . You are signed in as a <span className="text-ice">{profile.role}</span>.
            </>
          ) : (
            "."
          )}
        </p>

        {isAdmin && settings.showAdminStats ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Stat label="Total Users" value={String(userCount)} accent />
            <button type="button" className="text-left" onClick={() => setView("settings")}>
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
            {isAdminRole(profile.role) ? (
              <Stat label="Access" value="Full administrator" />
            ) : (
              <Stat label="Access" value="Member workspace" />
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  link,
  mono,
}: {
  label: string;
  value: string;
  accent?: boolean;
  link?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="glass-soft rounded-[calc(var(--panel-radius)-6px)] border border-white/8 px-4 py-4">
      <div className="text-[11px] font-extrabold tracking-[0.12em] text-steel uppercase">{label}</div>
      <div
        className={[
          "mt-1.5 flex items-center gap-1 text-[20px] font-extrabold",
          accent ? "text-[var(--accent)]" : "",
          link ? "text-[15px] text-ice" : "",
          mono ? "font-mono text-[16px]" : "",
        ].join(" ")}
      >
        {value}
        {link ? <ArrowUpRight className="size-4 text-steel" /> : null}
      </div>
    </div>
  );
}
