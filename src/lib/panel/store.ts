import { create } from "zustand";
import type { PanelView, PresenceFilter, SettingsTab } from "./types";

type PanelUiState = {
  view: PanelView;
  settingsTab: SettingsTab;
  sidebarCollapsed: boolean;
  mobileOpen: boolean;
  teamFilter: PresenceFilter;
  userFilter: PresenceFilter;
  setView: (view: PanelView) => void;
  setSettingsTab: (tab: SettingsTab) => void;
  toggleCollapsed: () => void;
  setMobileOpen: (open: boolean) => void;
  setTeamFilter: (filter: PresenceFilter) => void;
  setUserFilter: (filter: PresenceFilter) => void;
};

const collapsedKey = "zai.sidebar-collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(collapsedKey) === "1";
  } catch {
    return false;
  }
}

export const usePanelUi = create<PanelUiState>((set) => ({
  view: "home",
  settingsTab: "appearance",
  sidebarCollapsed: false,
  mobileOpen: false,
  teamFilter: "all",
  userFilter: "all",
  setView: (view) => set({ view, mobileOpen: false }),
  setSettingsTab: (settingsTab) => set({ settingsTab, view: "settings" }),
  toggleCollapsed: () =>
    set((state) => {
      const sidebarCollapsed = !state.sidebarCollapsed;
      try {
        window.localStorage.setItem(collapsedKey, sidebarCollapsed ? "1" : "0");
      } catch {
        /* ignore */
      }
      return { sidebarCollapsed };
    }),
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
  setTeamFilter: (teamFilter) => set({ teamFilter }),
  setUserFilter: (userFilter) => set({ userFilter }),
}));

export function hydrateSidebar() {
  usePanelUi.setState({ sidebarCollapsed: readCollapsed() });
}
