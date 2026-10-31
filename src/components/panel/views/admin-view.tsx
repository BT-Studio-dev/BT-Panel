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

export const ADMIN_SECTIONS: { id: AdminSection; label: string; icon: LucideIcon }[] = [
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
  const { adminSection, setAdminSection, isAdmin } = usePanel();

  if (!isAdmin) {
    return <div className="glass"><EmptyState icon={<ShieldAlert className="size-5" />} title="Administrator access required" body="The BT Panel Game Control Center is only available to administrators." /></div>;
  }

  return (
    <div className="view-enter">
      <div className="grid items-start gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav
          className="glass grid grid-cols-2 items-start gap-1 p-2.5 min-[560px]:grid-cols-3 lg:grid-cols-4 xl:sticky xl:top-5 xl:grid-cols-1"
          aria-label="Admin Control Center sections"
        >
          {ADMIN_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setAdminSection(section.id)}
              className={cn(
                "flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-[var(--control-radius)] border border-transparent px-3 text-left text-[12.5px] leading-tight font-bold text-steel transition-colors hover:bg-fill hover:text-ice",
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
