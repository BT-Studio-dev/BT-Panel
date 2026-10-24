"use client";

import {
  Activity,
  Box,
  Database,
  FolderGit2,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Network,
  Puzzle,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminSection } from "@/lib/panel/types";
import { cn } from "@/lib/utils";
import { usePanel } from "../context";
import { EmptyState } from "../ui";
import { AdminActivityView, AdminOverviewView } from "./admin-overview";
import {
  AdminDatabaseHostsView,
  AdminEggsView,
  AdminExtensionsView,
  AdminLocationsView,
  AdminMountsView,
  AdminNodesView,
  AdminTagsView,
} from "./admin-infrastructure";
import { ApiKeysView } from "./api-keys-view";
import { ServersView } from "./servers-view";
import { SettingsView } from "./settings-view";
import { UsersView } from "./users-view";

const SECTIONS: { id: AdminSection; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "users", label: "Users", icon: Users },
  { id: "locations", label: "Locations", icon: MapPin },
  { id: "nodes", label: "Nodes", icon: Network },
  { id: "server", label: "Server", icon: Server },
  { id: "databases", label: "Database Hosts", icon: Database },
  { id: "mounts", label: "Mounts", icon: FolderGit2 },
  { id: "eggs", label: "Eggs", icon: Box },
  { id: "tags", label: "Tags", icon: Tags },
  { id: "extensions", label: "Extensions", icon: Puzzle },
  { id: "api-keys", label: "API Keys", icon: KeyRound },
];

function SectionContent({ section }: { section: AdminSection }) {
  switch (section) {
    case "overview": return <AdminOverviewView />;
    case "activity": return <AdminActivityView />;
    case "settings": return <SettingsView />;
    case "users": return <UsersView />;
    case "locations": return <AdminLocationsView />;
    case "nodes": return <AdminNodesView />;
    case "server": return <ServersView />;
    case "databases": return <AdminDatabaseHostsView />;
    case "mounts": return <AdminMountsView />;
    case "eggs": return <AdminEggsView />;
    case "tags": return <AdminTagsView />;
    case "extensions": return <AdminExtensionsView />;
    case "api-keys": return <ApiKeysView />;
  }
}

export function AdminView() {
  const { adminSection, setAdminSection, isAdmin, profile } = usePanel();

  if (!isAdmin) {
    return <div className="glass"><EmptyState icon={<ShieldAlert className="size-5" />} title="Administrator access required" body="The BT Panel Game Control Center is only available to administrators." /></div>;
  }

  return (
    <div className="view-enter">
      <div className="glass relative mb-4 overflow-hidden p-5 sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,var(--accent-glow),transparent_42%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-accent/35 bg-accent/15 text-accent shadow-[0_0_24px_var(--accent-glow)]"><ShieldCheck className="size-6" /></span>
            <div><div className="text-[10px] font-extrabold tracking-[0.18em] text-accent uppercase">Admin Control Center</div><h1 className="mt-0.5 text-[24px] font-extrabold tracking-tight">BT Panel Game</h1><p className="mt-1 text-[12px] font-semibold text-steel">Servers, infrastructure, access and panel configuration.</p></div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full border border-line bg-fill px-3 py-2 sm:self-auto"><span className="size-2 rounded-full bg-ok shadow-[0_0_8px_var(--color-ok)]" /><span className="text-[11px] font-extrabold">{profile.username}</span><span className="text-[10px] font-bold text-steel uppercase">{profile.role}</span></div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[210px_minmax(0,1fr)]">
        <nav className="glass scrollbar-thin flex gap-1 overflow-x-auto p-2 xl:sticky xl:top-4 xl:flex-col xl:overflow-visible" aria-label="Admin Control Center sections">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setAdminSection(section.id)}
              className={cn(
                "flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg border border-transparent px-3 text-left text-[12px] font-bold whitespace-nowrap text-steel transition-colors hover:bg-fill hover:text-ice xl:w-full",
                adminSection === section.id && "border-accent/25 bg-accent/12 text-accent",
              )}
              aria-current={adminSection === section.id ? "page" : undefined}
            >
              <section.icon className="size-4 shrink-0" />
              {section.label}
            </button>
          ))}
        </nav>
        <main className="min-w-0"><SectionContent section={adminSection} /></main>
      </div>
    </div>
  );
}
