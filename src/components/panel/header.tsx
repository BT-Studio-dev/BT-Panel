import { ChevronDown, LogOut, Menu, Moon, Sun, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/lib/auth/client";
import { usePanelUi } from "@/lib/panel/store";
import { applyTheme, effectiveThemeMode, setLocalModeOverride } from "@/lib/panel/theme";
import type { PanelView } from "@/lib/panel/types";
import { PresenceAvatar } from "./avatar";
import { usePanel } from "./context";

const TITLES: Record<PanelView, string> = {
  home: "Home",
  tutorials: "Tutorials",
  team: "Team",
  music: "Music",
  settings: "Admin Settings",
  users: "User Management",
  updates: "System Updates",
  account: "My Account",
};

export function Header() {
  const { profile, settings } = usePanel();
  const { view, setView, setMobileOpen } = usePanelUi();
  const [open, setOpen] = useState(false);
  // Rerender tick for the sun/moon icon: the mode itself lives in localStorage
  // + a data attribute, so flipping it doesn't naturally re-render this header.
  const [, setModeTick] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!profile) return null;

  const mode = effectiveThemeMode(settings);
  // Sun/moon flips light <-> the admin's dark base (dark or OLED #000000).
  const darkBase = settings.mode === "light" ? "dark" : settings.mode;
  const target = mode === "light" ? darkBase : "light";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-[10px] border border-white/10 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </button>
        <h1 className="truncate text-[18px] font-extrabold tracking-tight">{TITLES[view]}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-[10px] border border-white/10 bg-black/25 text-steel transition-colors hover:border-white/25 hover:text-ice"
          onClick={() => {
            setLocalModeOverride(target);
            applyTheme(settings);
            setModeTick((t) => t + 1);
          }}
          aria-label={mode === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={mode === "light" ? `Switch to ${darkBase === "oled" ? "OLED black" : "dark"} theme` : "Switch to light theme"}
        >
          {mode === "light" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
        </button>
      {settings.showHeaderUser ? (
        <div className="relative" ref={ref}>
          <button
            type="button"
            className="flex items-center gap-2 rounded-[12px] border border-white/10 bg-black/25 py-1.5 pr-2 pl-1.5"
            onClick={() => setOpen((v) => !v)}
          >
            <PresenceAvatar name={profile.username} src={profile.profilePic || profile.image} size="sm" />
            <div className="hidden text-left sm:block">
              <div className="text-[13px] leading-tight font-extrabold">{profile.username}</div>
              <div className="text-[10px] font-bold tracking-[0.12em] text-steel uppercase">{profile.role}</div>
            </div>
            <ChevronDown className="size-3.5 text-steel" />
          </button>
          {open ? (
            <div className="glass absolute top-[calc(100%+8px)] right-0 z-20 min-w-[180px] overflow-hidden p-1.5">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold hover:bg-white/6"
                onClick={() => {
                  setView("account");
                  setOpen(false);
                }}
              >
                <UserRound className="size-3.5" />
                My Profile
              </button>
              <div className="my-1 h-px bg-white/10" />
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold text-danger hover:bg-white/6"
                onClick={() => void signOut("/login")}
              >
                <LogOut className="size-3.5" />
                Logout
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      </div>
    </header>
  );
}
