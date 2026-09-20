import { createFileRoute } from "@tanstack/react-router";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PanelProvider } from "@/components/panel/context";
import { PanelShell } from "@/components/panel/shell";
import { WallpaperLayer } from "@/components/panel/wallpaper-layer";
import { DEFAULT_THEME } from "@/lib/panel/types";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();

  if (isPending) {
    // No splash screen — keep the wallpaper visible while the session resolves.
    return (
      <div className="relative min-h-dvh">
        <WallpaperLayer theme={DEFAULT_THEME} />
      </div>
    );
  }

  if (!user) return <RedirectToSignIn />;

  return (
    <PanelProvider>
      <PanelShell />
    </PanelProvider>
  );
}
