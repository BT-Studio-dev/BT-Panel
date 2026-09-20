import {
  BookOpen,
  Home,
  LogOut,
  Menu,
  Music2,
  RefreshCw,
  Settings,
  UserRound,
  Users,
} from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { usePanelUi } from "@/lib/panel/store";
import type { PanelView } from "@/lib/panel/types";
import { BrandMark } from "./brand-mark";
import { PresenceAvatar } from "./avatar";
import { usePanel } from "./context";

const NAV: { id: PanelView; label: string; icon: typeof Home; admin?: boolean }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "tutorials", label: "Tutorials", icon: BookOpen },
  { id: "team", label: "Team", icon: Users },
  { id: "music", label: "Music", icon: Music2 },
  { id: "settings", label: "Admin Settings", icon: Settings, admin: true },
  { id: "users", label: "User Management", icon: Users, admin: true },
  { id: "updates", label: "Updates", icon: RefreshCw, admin: true },
  { id: "account", label: "My Account", icon: UserRound },
];

export function Sidebar() {
  const { profile, settings, isAdmin } = usePanel();
  const { view, setView, sidebarCollapsed, toggleCollapsed, mobileOpen, setMobileOpen } = usePanelUi();

  if (!profile) return null;

  const items = NAV.filter((item) => {
    if (item.id === "team" && !settings.showTeam) return false;
    if (item.id === "tutorials" && !settings.tutorialsEnabled) return false;
    if (item.admin && !isAdmin) return false;
    return true;
  });

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
          "glass glass-strong fixed inset-y-0 left-0 z-40 flex flex-col border-r p-4 transition-[width,transform] duration-200 md:static md:translate-x-0",
          sidebarCollapsed ? "w-[78px]" : "w-[260px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className={cn("flex min-w-0 items-center gap-2", sidebarCollapsed && "hidden md:hidden")}>
            <BrandMark className="size-8 shrink-0" src={settings.panelLogo || undefined} />
            <div className="min-w-0">
              <div className="truncate text-[15px] font-extrabold tracking-tight">{settings.panelName}</div>
              {settings.panelSubtitle ? (
                <div className="truncate text-[10px] font-bold tracking-[0.14em] text-steel uppercase">
                  {settings.panelSubtitle}
                </div>
              ) : null}
            </div>
          </div>
          {sidebarCollapsed ? (
            <BrandMark className="mx-auto size-8" src={settings.panelLogo || undefined} />
          ) : null}
          <button
            type="button"
            className="hidden size-8 shrink-0 items-center justify-center rounded-[9px] border border-white/15 bg-black/40 text-steel md:inline-flex"
            onClick={toggleCollapsed}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="size-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto scrollbar-thin">
          <SectionLabel collapsed={sidebarCollapsed}>Dashboard</SectionLabel>
          {items
            .filter((item) => !item.admin && item.id !== "account")
            .map((item) => (
              <NavButton
                key={item.id}
                item={item}
                active={view === item.id}
                collapsed={sidebarCollapsed}
                onClick={() => setView(item.id)}
              />
            ))}
          {isAdmin ? (
            <>
              <SectionLabel collapsed={sidebarCollapsed}>
                Admin
                <span className="ml-2 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-white">
                  ADMIN
                </span>
              </SectionLabel>
              {items
                .filter((item) => item.admin)
                .map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={view === item.id}
                    collapsed={sidebarCollapsed}
                    onClick={() => setView(item.id)}
                  />
                ))}
            </>
          ) : null}
          <SectionLabel collapsed={sidebarCollapsed}>Account</SectionLabel>
          <NavButton
            item={NAV.find((item) => item.id === "account")!}
            active={view === "account"}
            collapsed={sidebarCollapsed}
            onClick={() => setView("account")}
          />
        </nav>

        <div className="mt-3 border-t border-white/10 pt-3">
          <div className={cn("mb-2 flex items-center gap-2 rounded-[12px] p-1.5", sidebarCollapsed && "justify-center")}>
            <PresenceAvatar name={profile.username} src={profile.profilePic || profile.image} size="sm" />
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <div className="truncate text-[13px] font-extrabold">{profile.username}</div>
                <div className="text-[10px] font-bold tracking-[0.14em] text-steel uppercase">{profile.role}</div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className={cn(
              "nav-item text-danger",
              sidebarCollapsed && "justify-center px-2.5",
            )}
            onClick={() => void signOut("/login")}
          >
            <LogOut className="size-4 shrink-0" />
            {!sidebarCollapsed ? <span>Logout</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (collapsed) return <div className="h-3" />;
  return (
    <div className="flex items-center px-2.5 pt-4 pb-2 text-[10px] font-extrabold tracking-[0.14em] text-white/50 uppercase">
      {children}
    </div>
  );
}

function NavButton({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={cn("nav-item", active && "active", collapsed && "justify-center px-2.5")}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </button>
  );
}
