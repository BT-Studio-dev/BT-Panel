"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLocalModeOverride } from "@/lib/panel/theme";
import type { BootstrapPayload, GoogleOauthSettings, ThemeSettings } from "@/lib/panel/types";
import { api, cachePanel, clearCachedPanel, clearStoredToken, getCachedPanel, getStoredToken, isSessionExpiredError } from "@/lib/utils";
import { PanelShell } from "@/components/panel/shell";
import {
  AuthShell,
  ForgotForm,
  LoginForm,
  RegisterForm,
  RegistrationClosed,
  ResetForm,
} from "./auth-forms";

export type DemoAccount = { label: string; username: string; password: string };

/**
 * Hosts the whole signed-out flow and, the moment sign-in (or sign-up)
 * succeeds, swaps the dashboard in **in the same document** — no navigation
 * and no loading screen in between. The payload is also cached so any later
 * load of "/" paints Servers instantly instead of showing an opening screen.
 */
export function AuthEntry({
  mode,
  theme,
  panelName,
  panelLogo,
  title,
  subtitle,
  allowRegistration = true,
  demos = [],
  registrationOpen = true,
  firstUser = false,
  resetToken = "",
  google,
  passwordResetEnabled = true,
}: {
  mode: "login" | "register" | "forgot" | "reset";
  theme: ThemeSettings;
  panelName: string;
  panelLogo: string;
  title: string;
  subtitle?: string;
  allowRegistration?: boolean;
  demos?: readonly DemoAccount[];
  registrationOpen?: boolean;
  firstUser?: boolean;
  resetToken?: string;
  google?: GoogleOauthSettings;
  passwordResetEnabled?: boolean;
}) {
  const [panel, setPanel] = useState<BootstrapPayload | null>(null);
  const authenticatedRef = useRef(false);

  const open = useCallback((data: BootstrapPayload) => {
    // A bootstrap request started before this login must never overwrite or
    // clear the newly authenticated session when it settles later.
    authenticatedRef.current = true;
    cachePanel(data);
    // Reflect "/" without asking the server for a new document.
    window.history.replaceState(null, "", "/");
    setPanel(data);
  }, []);

  // Returning with a still-valid session? Paint the cached dashboard at once
  // and let the network call refresh it underneath.
  useEffect(() => {
    if (!getStoredToken()) return;
    const cached = getCachedPanel<BootstrapPayload>();
    // Cached panel restoration is intentionally synchronized with this mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cached) setPanel(cached);
    let cancelled = false;
    api<BootstrapPayload>("/api/bootstrap")
      .then((data) => {
        if (cancelled || authenticatedRef.current) return;
        cachePanel(data);
        setPanel(data);
      })
      .catch((error: unknown) => {
        if (cancelled || authenticatedRef.current || !isSessionExpiredError(error)) return;
        clearStoredToken();
        clearCachedPanel();
        setPanel(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (panel) {
    return (
      <PanelShell
        initial={panel}
        initialView="servers"
        initialServerId={null}
        initialModeOverride={getLocalModeOverride()}
      />
    );
  }

  return (
    <AuthShell theme={theme} panelName={panelName} panelLogo={panelLogo} title={title} subtitle={subtitle}>
      {mode === "login" ? (
        <LoginForm
          allowRegistration={allowRegistration}
          demos={demos}
          google={{
            googleOauthEnabled: google?.googleOauthEnabled ?? false,
            googleClientId: google?.googleClientId ?? "",
            googleClientSecret: "",
            googleAllowedEmail: "",
          }}
          onAuthenticated={open}
        />
      ) : mode === "register" ? (
        registrationOpen || firstUser ? (
          <RegisterForm onAuthenticated={open} />
        ) : (
          <RegistrationClosed />
        )
      ) : mode === "forgot" ? (
        <ForgotForm panelName={panelName} enabled={passwordResetEnabled} />
      ) : (
        <ResetForm panelName={panelName} token={resetToken} />
      )}
    </AuthShell>
  );
}
