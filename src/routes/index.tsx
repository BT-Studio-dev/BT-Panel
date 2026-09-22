import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { PanelProvider } from "@/components/panel/context";
import { PanelShell } from "@/components/panel/shell";
import { WallpaperLayer } from "@/components/panel/wallpaper-layer";
import { getPreviewAutoLogin } from "@/lib/panel/server";
import { DEFAULT_THEME } from "@/lib/panel/types";
import { withTimeout } from "@/lib/panel/with-timeout";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { user, isPending } = useCurrentUserState();

  // Preview auto sign-in: sandbox/personal-dev previews wipe their sessions on
  // every environment restart. Instead of bouncing signed-out visitors to
  // /login, silently sign in with the seeded admin (creds are returned ONLY by
  // non-production builds — see `getPreviewAutoLogin`) behind the wallpaper,
  // then hard-navigate into the app. Open the link → dashboard, zero clicks.
  //
  // States: "idle" → decide once the session resolves; "working" → silent
  // sign-in in flight; "giveup" → production / failed / explicit sign-out →
  // normal RedirectToSignIn to the login form.
  const [auto, setAuto] = useState<"idle" | "working" | "giveup">("idle");
  useEffect(() => {
    if (isPending || user || auto !== "idle") return;
    // An explicit Logout in this (tab) session must land on the login form,
    // not be instantly undone by the auto sign-in.
    try {
      if (window.sessionStorage.getItem("btpanel.signed-out") === "1") {
        window.sessionStorage.removeItem("btpanel.signed-out");
        setAuto("giveup");
        return;
      }
    } catch {
      /* storage unavailable */
    }
    setAuto("working");
    let done = false;
    void withTimeout(getPreviewAutoLogin(), 10000)
      .then(async (creds) => {
        if (done) return;
        if (!creds) {
          // Production build (or auto sign-in disabled) → normal login form.
          setAuto("giveup");
          return;
        }
        const result = await withTimeout(
          authClient.signIn.email({
            email: creds.email,
            password: creds.password,
            callbackURL: "/",
          }),
          15000,
        );
        if (done) return;
        if (!result || result.error) {
          setAuto("giveup");
          return;
        }
        window.location.assign("/");
      })
      .catch(() => {
        if (!done) setAuto("giveup");
      });
    return () => {
      done = true;
    };
  }, [isPending, user, auto]);

  // No splash screen and NO status cards — keep the wallpaper visible while
  // the session resolves or the silent preview sign-in runs. Watchdog: if a
  // response is lost in transit (slow/lost relay), waiting forever would leave
  // a wallpaper-only page; recover SILENTLY by reloading every 20s of waiting
  // (the reload re-runs the same zero-UI boot — the user never sees a card).
  useEffect(() => {
    const waiting = isPending || auto === "working";
    if (!waiting) return;
    const t = window.setTimeout(() => {
      window.location.reload();
    }, 20000);
    return () => window.clearTimeout(t);
  }, [isPending, auto]);

  if (isPending || (!user && auto !== "giveup")) {
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
