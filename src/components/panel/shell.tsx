"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import {
  BookOpen,
  ChevronDown,
  House,
  LogOut,
  Menu,
  Moon,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { BootstrapPayload, PanelView, ThemeMode } from "@/lib/panel/types";
import { cn } from "@/lib/utils";
import { PanelProvider, usePanel } from "./context";
import { BrandMark, PresenceAvatar } from "./ui";
import { WallpaperLayer } from "./wallpaper-layer";
import { HomeView } from "./views/home-view";
import { ServersView } from "./views/servers-view";
import { SettingsView } from "./views/settings-view";
import { UsersView } from "./views/users-view";
import { AccountView } from "./views/account-view";
import { MusicView, TeamView, TutorialsView, UpdatesView } from "./views/misc-views";

type NavItem = { id: PanelView; label: string; icon: LucideIcon; section: "dashboard" | "admin" | "account" };

const NAV: NavItem[] = [
  { id: "home", label: "Home", icon: House, section: "dashboard" },
  { id: "servers", label: "Servers", icon: Server, section: "dashboard" },
  { id: "tutorials", label: "Tutorials", icon: BookOpen, section: "dashboard" },
  { id: "team", label: "Team", icon: Users, section: "dashboard" },
  { id: "music", label: "Music", icon: Music2, section: "dashboard" },
  { id: "settings", label: "Admin Settings", icon: Settings, section: "admin" },
  { id: "users", label: "User Management", icon: ShieldCheck, section: "admin" },
  { id: "updates", label: "Updates", icon: RefreshCw, section: "admin" },
  { id: "account", label: "My Account", icon: UserRound, section: "account" },
];

const TITLES: Record<PanelView, string> = {
  home: "Home",
  servers: "Servers",
  tutorials: "Tutorials",
  team: "Team",
  music: "Music",
  settings: "Admin Settings",
  users: "User Management",
  updates: "System Updates",
  account: "My Account",
};

export function PanelShell({
  initial,
  initialView,
  initialServerId,
  initialModeOverride,
}: {
  initial: BootstrapPayload;
  initialView: PanelView;
  initialServerId: string | null;
  initialModeOverride: ThemeMode | null;
}) {
  return (
    <PanelProvider
      initial={initial}
      initialView={initialView}
      initialServerId={initialServerId}
      initialModeOverride={initialModeOverride}
    >
      <ShellInner />
    </PanelProvider>
  );
}

function ShellInner() {
  const { draft, view, mode } = usePanel();
  return (
    <div className="relative h-dvh overflow-hidden">
      <WallpaperLayer theme={draft} />
      <div className="relative z-10 flex h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 pb-10 md:px-6">
            <div key={view} className="view-enter mx-auto w-full max-w-[1600px]">
              {view === "home" ? <HomeView /> : null}
              {view === "servers" ? <ServersView /> : null}
              {view === "tutorials" ? <TutorialsView /> : null}
              {view === "team" ? <TeamView /> : null}
              {view === "music" ? <MusicView /> : null}
              {view === "settings" ? <SettingsView /> : null}
              {view === "users" ? <UsersView /> : null}
              {view === "updates" ? <UpdatesView /> : null}
              {view === "account" ? <AccountView /> : null}
            </div>
          </main>
        </div>
      </div>
      <MiniPlayer />
      <Toaster
        theme={mode === "light" ? "light" : "dark"}
        position="top-right"
        offset={{ top: 72, right: 20 }}
        toastOptions={{
          style: {
            background: "rgb(var(--glass-tint) / 0.92)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-primary)",
            backdropFilter: "blur(16px)",
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            borderRadius: "12px",
          },
        }}
      />
    </div>
  );
}

function Sidebar() {
  const { profile, settings, isAdmin, view, setView, servers, sidebarCollapsed, toggleCollapsed, mobileOpen, setMobileOpen, signOut } =
    usePanel();
  const collapsed = sidebarCollapsed && !mobileOpen;
  const running = servers.filter((s) => s.status === "running").length;

  const visible = NAV.filter((item) => {
    if (item.id === "team" && !settings.showTeam && !isAdmin) return false;
    if (item.id === "tutorials" && !settings.tutorialsEnabled) return false;
    if (item.section === "admin" && !isAdmin) return false;
    return true;
  });

  const renderItem = (item: NavItem) => (
    <NavButton
      key={item.id}
      item={item}
      active={view === item.id}
      collapsed={collapsed}
      onClick={() => setView(item.id)}
      badge={item.id === "servers" && servers.length > 0 ? `${running}/${servers.length}` : undefined}
    />
  );

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "glass glass-strong fixed inset-y-0 left-0 z-40 flex flex-col rounded-l-none border-y-0 border-l-0 p-4 transition-[width,transform] duration-200 md:static md:translate-x-0",
          collapsed ? "w-[78px]" : "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className={cn("mb-4 flex items-center gap-2", collapsed ? "flex-col" : "justify-between")}>
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandMark className="size-9 shrink-0 drop-shadow-[0_0_14px_var(--accent-glow)]" src={settings.panelLogo || undefined} />
            {!collapsed ? (
              <div className="min-w-0">
                <div className="truncate text-[15px] font-extrabold tracking-tight">{settings.panelName}</div>
                {settings.panelSubtitle ? (
                  <div className="truncate text-[10px] font-bold tracking-[0.14em] text-steel uppercase">
                    {settings.panelSubtitle}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="hidden size-8 shrink-0 items-center justify-center rounded-[9px] border border-line-strong bg-sunken text-steel transition-colors hover:text-ice md:inline-flex"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="size-4" />
          </button>
        </div>

        <nav className="scrollbar-thin flex flex-1 flex-col gap-0.5 overflow-y-auto">
          <SectionLabel collapsed={collapsed}>Dashboard</SectionLabel>
          {visible.filter((item) => item.section === "dashboard").map(renderItem)}
          {isAdmin ? (
            <>
              <SectionLabel collapsed={collapsed}>
                Admin
                <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white">
                  ADMIN
                </span>
              </SectionLabel>
              {visible.filter((item) => item.section === "admin").map(renderItem)}
            </>
          ) : null}
          <SectionLabel collapsed={collapsed}>Account</SectionLabel>
          {visible.filter((item) => item.section === "account").map(renderItem)}
        </nav>

        <div className="mt-3 border-t border-line pt-3">
          <button
            type="button"
            className={cn(
              "mb-2 flex w-full items-center gap-2.5 rounded-[12px] p-1.5 text-left transition-colors hover:bg-fill",
              collapsed && "justify-center",
            )}
            onClick={() => setView("account")}
          >
            <PresenceAvatar name={profile.username} src={profile.profilePic} size="sm" online />
            {!collapsed ? (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-extrabold">{profile.username}</div>
                <div className="text-[10px] font-bold tracking-[0.14em] text-steel uppercase">{profile.role}</div>
              </div>
            ) : null}
          </button>
          <button
            type="button"
            className={cn("nav-item text-danger hover:text-danger", collapsed && "justify-center px-2.5")}
            onClick={() => void signOut()}
            title="Logout"
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed ? <span>Logout</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  if (collapsed) return <div className="mx-auto my-2.5 h-px w-8 bg-line" />;
  return (
    <div className="mt-4 mb-1.5 flex items-center px-2 text-[10px] font-extrabold tracking-[0.16em] text-faint uppercase first:mt-0">
      {children}
    </div>
  );
}

function NavButton({
  item,
  active,
  collapsed,
  onClick,
  badge,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badge?: string;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={cn("nav-item", active && "active", collapsed && "justify-center px-2.5")}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
      {!collapsed && badge ? (
        <span className="rounded-full border border-ok/30 bg-ok/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ok">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function Header() {
  const { profile, settings, view, setView, setMobileOpen, mode, toggleMode, draft, music, signOut } = usePanel();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const darkBase = draft.mode === "light" ? "dark" : draft.mode;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-[10px] border border-line bg-sunken md:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </button>
        <h1 className="truncate text-[18px] font-extrabold tracking-tight">{TITLES[view]}</h1>
      </div>
      <div className="flex items-center gap-2">
        {music.playing ? (
          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-[10px] border border-line bg-sunken px-3 text-[12px] font-bold text-steel sm:inline-flex"
            onClick={() => setView("music")}
            title="Now playing"
          >
            <span className="eq on">
              <span />
              <span />
              <span />
              <span />
            </span>
            Now playing
          </button>
        ) : null}
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-[10px] border border-line bg-sunken text-steel transition-colors hover:border-line-strong hover:text-ice"
          onClick={toggleMode}
          aria-label={mode === "light" ? "Switch to dark theme" : "Switch to light theme"}
          title={mode === "light" ? `Switch to ${darkBase === "oled" ? "OLED black" : "dark"} theme` : "Switch to light theme"}
        >
          {mode === "light" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
        </button>
        {settings.showHeaderUser ? (
          <div className="relative" ref={ref}>
            <button
              type="button"
              className="flex items-center gap-2 rounded-[12px] border border-line bg-sunken py-1.5 pr-2 pl-1.5"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              <PresenceAvatar name={profile.username} src={profile.profilePic} size="sm" />
              <div className="hidden text-left sm:block">
                <div className="text-[13px] leading-tight font-extrabold">{profile.username}</div>
                <div className="text-[10px] font-bold tracking-[0.12em] text-steel uppercase">{profile.role}</div>
              </div>
              <ChevronDown className={cn("size-3.5 text-steel transition-transform", open && "rotate-180")} />
            </button>
            {open ? (
              <div className="glass glass-strong view-enter absolute top-[calc(100%+8px)] right-0 z-30 min-w-[200px] overflow-hidden p-1.5">
                <div className="px-3 py-2">
                  <div className="truncate text-[13px] font-extrabold">{profile.username}</div>
                  <div className="truncate text-[11.5px] font-semibold text-steel">{profile.email}</div>
                </div>
                <div className="my-1 h-px bg-line" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold hover:bg-fill-strong"
                  onClick={() => {
                    setView("account");
                    setOpen(false);
                  }}
                >
                  <UserRound className="size-3.5" />
                  My Profile
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold hover:bg-fill-strong"
                  onClick={() => {
                    setView("servers");
                    setOpen(false);
                  }}
                >
                  <Server className="size-3.5" />
                  My Servers
                </button>
                <div className="my-1 h-px bg-line" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-bold text-danger hover:bg-fill-strong"
                  onClick={() => void signOut()}
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

function MiniPlayer() {
  const { music, view, setView } = usePanel();
  if (!music.playing || view === "music") return null;
  return (
    <div className="glass glass-strong view-enter fixed right-4 bottom-4 z-40 flex items-center gap-3 py-2 pr-2 pl-3">
      <span className="eq on">
        <span />
        <span />
        <span />
        <span />
      </span>
      <button type="button" className="text-left" onClick={() => setView("music")}>
        <div className="text-[12.5px] font-extrabold">BT Ambient Loop</div>
        <div className="text-[10.5px] font-bold tracking-[0.12em] text-steel uppercase">Now playing</div>
      </button>
      <button type="button" className="icon-btn" onClick={music.toggle} aria-label={music.playing ? "Pause" : "Play"}>
        {music.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
    </div>
  );
}
