import { useEffect } from "react";
import { hydrateSidebar, usePanelUi } from "@/lib/panel/store";
import { applyFavicon } from "@/lib/panel/theme";
import { Header } from "./header";
import { MusicPlayer } from "./music-player";
import { Sidebar } from "./sidebar";
import { SoundEffects } from "./sound-effects";
import { WallpaperLayer } from "./wallpaper-layer";
import { usePanel } from "./context";
import { AccountView } from "./views/account-view";
import { HomeView } from "./views/home-view";
import { MusicPanel, SettingsView } from "./views/settings-view";
import { TeamView } from "./views/team-view";
import { TutorialsView } from "./views/tutorials-view";
import { UpdatesView } from "./views/updates-view";
import { UsersView } from "./views/users-view";
import { OnboardingTour } from "./onboarding-tour";

export function PanelShell() {
  const { loading, error, profile, draft, settings } = usePanel();
  const view = usePanelUi((s) => s.view);

  useEffect(() => {
    hydrateSidebar();
  }, []);

  useEffect(() => {
    document.title = settings.faviconTitle || settings.panelName || "BT Panel";
    applyFavicon(settings.faviconLogo);
  }, [settings.faviconTitle, settings.panelName, settings.faviconLogo]);

  if (loading) {
    // No splash screen — keep the wallpaper visible while the panel loads.
    return (
      <div className="relative min-h-dvh">
        <WallpaperLayer theme={draft} />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="relative min-h-dvh">
        <WallpaperLayer theme={draft} />
        <div className="relative z-10 grid min-h-dvh place-items-center px-4">
          <div className="glass max-w-md px-8 py-6 text-center">
            <div className="text-[16px] font-extrabold">Could not open the panel</div>
            <p className="mt-2 text-[13px] font-semibold text-steel">{error || "Sign in again to continue."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh">
      <WallpaperLayer theme={draft} />
      <div className="relative z-10 flex min-h-dvh">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 pb-8 md:px-6">
            {view === "home" ? <HomeView /> : null}
            {view === "tutorials" ? <TutorialsView /> : null}
            {view === "team" ? <TeamView /> : null}
            {view === "music" ? <MusicPanel /> : null}
            {view === "settings" ? <SettingsView /> : null}
            {view === "users" ? <UsersView /> : null}
            {view === "updates" ? <UpdatesView /> : null}
            {view === "account" ? <AccountView /> : null}
          </main>
        </div>
      </div>
      <MusicPlayer />
      <SoundEffects />
      <OnboardingTour />
    </div>
  );
}
