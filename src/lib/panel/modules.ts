import { PlugZap, type LucideIcon } from "lucide-react";
import type { PanelView } from "./types";

/**
 * Small, typed registry for panel modules.
 * To add a module: add its id to PanelView/PANEL_VIEWS, register its nav
 * metadata here, add a view renderer in shell.tsx, and add server-side routes.
 * The role declared here controls navigation visibility only; API routes must
 * independently enforce the same role with requireAdmin()/requireUser().
 */
export type PanelModuleDefinition = {
  id: PanelView;
  label: string;
  icon: LucideIcon;
  section: "admin";
  requiredRole: "admin";
  description: string;
};

export const PANEL_MODULES: PanelModuleDefinition[] = [
  {
    id: "integrations",
    label: "Integrations",
    icon: PlugZap,
    section: "admin",
    requiredRole: "admin",
    description: "Connect upstream server-management services.",
  },
];
