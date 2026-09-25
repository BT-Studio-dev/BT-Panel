"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, LogIn, Sparkles, UserPlus } from "lucide-react";
import { applyTheme, getLocalModeOverride } from "@/lib/panel/theme";
import type { BootstrapPayload, ThemeSettings } from "@/lib/panel/types";
import { api, storeToken } from "@/lib/utils";
import { BrandMark, Spinner } from "@/components/panel/ui";
import { WallpaperLayer } from "@/components/panel/wallpaper-layer";

export function AuthShell({
  theme,
  panelName,
  panelLogo,
  title,
  subtitle,
  children,
}: {
  theme: ThemeSettings;
  panelName: string;
  panelLogo: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const local = getLocalModeOverride();
    if (local) applyTheme(theme, local);
  }, [theme]);

  const heading = title.replaceAll("{panel}", panelName || "BT Panel");

  return (
    <div className="relative min-h-dvh">
      <WallpaperLayer theme={theme} />
      <main className="relative z-10 flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <div className="glass view-enter w-full max-w-[380px] px-8 py-8 text-center">
          <div className="mb-5 flex flex-col items-center gap-3">
            <BrandMark className="size-12 drop-shadow-[0_0_18px_var(--accent-glow)]" src={panelLogo || undefined} />
            <div>
              <h1 className="text-[21px] font-extrabold tracking-tight text-ice">{heading}</h1>
              {subtitle ? <p className="mt-1 text-[12.5px] font-semibold text-steel">{subtitle}</p> : null}
            </div>
          </div>
          {children}
        </div>
        <p className="mt-6 text-center text-[11px] font-bold tracking-[0.14em] text-faint uppercase">
          Glassmorphism control panel for game &amp; app servers
        </p>
      </main>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder = "••••••••",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        className="panel-input pr-12"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        className="absolute top-1/2 right-3 -translate-y-1/2 text-steel transition-colors hover:text-ice"
        aria-label={show ? "Hide password" : "Show password"}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="mt-3 rounded-[10px] border border-danger/35 bg-danger/10 px-3 py-2 text-[12px] font-bold text-danger" role="alert">
      {message}
    </p>
  );
}

const labelCls = "mb-1.5 block text-[11px] font-bold tracking-wide text-steel";

/** Focus the first field — but only top-level: browsers refuse (and log an error for) autofocus inside cross-origin iframes such as embedded previews. */
function useTopLevelFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    let embedded = true;
    try {
      embedded = window.self !== window.top;
    } catch {
      embedded = true;
    }
    if (!embedded) ref.current?.focus();
  }, []);
  return ref;
}
const linkCls = "font-bold text-ice underline decoration-line-strong underline-offset-4 hover:decoration-current";

export type AuthResponse = { ok: boolean; token?: string; panel?: BootstrapPayload };

export function LoginForm({
  allowRegistration,
  demos,
  onAuthenticated,
}: {
  onAuthenticated: (panel: BootstrapPayload) => void;
  allowRegistration: boolean;
  demos: readonly { label: string; username: string; password: string }[];
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const firstField = useTopLevelFocus<HTMLInputElement>();


  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api<AuthResponse>("/api/auth/login", { body: { identifier, password } });
      storeToken(res.token);
      // Hand the dashboard straight over — no page navigation, so the panel
      // can never be left hanging between sign-in and home.
      onAuthenticated(res.panel ?? (await api<BootstrapPayload>("/api/bootstrap")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid username or password.");
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="text-left">
        <label className={`mt-1 ${labelCls}`} htmlFor="user">
          Username or Email
        </label>
        <input
          id="user"
          ref={firstField}
          className="panel-input"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="admin or admin@example.com"
          autoComplete="username"
          required
        />
        <div className="mt-3.5 mb-1.5 flex items-center justify-between">
          <label className="block text-[11px] font-bold tracking-wide text-steel" htmlFor="pass">
            Password
          </label>
          <button
            type="button"
            className="text-[11px] font-bold text-accent hover:brightness-125"
            onClick={() => setHint("Password resets are handled by your panel administrator (owner/admin).")}
          >
            Forgot password?
          </button>
        </div>
        <PasswordInput id="pass" value={password} onChange={setPassword} autoComplete="current-password" />
        {hint ? <p className="mt-2 text-[11.5px] font-semibold text-steel">{hint}</p> : null}
        <ErrorNote message={error} />
        <button type="submit" className="btn-accent mt-5 w-full" disabled={busy}>
          {busy ? <Spinner /> : <LogIn className="size-4" />} Sign In
        </button>
      </form>
      {demos.length ? (
        <div className="mt-4 rounded-[12px] border border-accent/35 bg-accent/10 px-3 py-3 text-left">
          <div className="flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.12em] text-accent uppercase">
            <Sparkles className="size-3.5" /> Demo access
          </div>
          <div className="mt-1.5 grid gap-1.5">
            {demos.map((account) => (
              <button
                key={account.username}
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-[9px] border border-line bg-fill px-2.5 py-1.5 text-left transition-colors hover:border-accent/50"
                onClick={() => {
                  setIdentifier(account.username);
                  setPassword(account.password);
                  setError("");
                }}
              >
                <span className="font-mono text-[12.5px] text-ice">
                  {account.username} / {account.password}
                </span>
                <span className="shrink-0 text-[10px] font-extrabold tracking-[0.12em] text-steel uppercase">
                  {account.label} · fill
                </span>
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-steel">Click a row to fill in its credentials.</p>
        </div>
      ) : null}
      {allowRegistration ? (
        <div className="mt-5 border-t border-line pt-4 text-[12.5px] font-semibold text-steel">
          Don&apos;t have an account?{" "}
          <Link href="/register" className={linkCls}>
            Create Account
          </Link>
        </div>
      ) : null}
    </>
  );
}

export function RegisterForm({ onAuthenticated }: { onAuthenticated: (panel: BootstrapPayload) => void }) {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
  const firstField = useTopLevelFocus<HTMLInputElement>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const res = await api<AuthResponse>("/api/auth/register", {
        body: { username: form.username, email: form.email, password: form.password },
      });
      storeToken(res.token);
      onAuthenticated(res.panel ?? (await api<BootstrapPayload>("/api/bootstrap")));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="grid gap-3.5 text-left">
        <div>
          <label className={labelCls} htmlFor="reg-user">
            Username
          </label>
          <input
            id="reg-user"
            ref={firstField}
            className="panel-input"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="steve"
            autoComplete="username"
            maxLength={24}
            required
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
            className="panel-input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="reg-pass">
            Password
          </label>
          <PasswordInput id="reg-pass" value={form.password} onChange={(v) => setForm({ ...form, password: v })} autoComplete="new-password" placeholder="8+ characters" />
        </div>
        <div>
          <label className={labelCls} htmlFor="reg-confirm">
            Confirm password
          </label>
          <PasswordInput id="reg-confirm" value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })} autoComplete="new-password" />
        </div>
        <ErrorNote message={error} />
        <button type="submit" className="btn-accent mt-2 w-full" disabled={busy}>
          {busy ? <Spinner /> : <UserPlus className="size-4" />} Create Account
        </button>
      </form>
      <div className="mt-5 border-t border-line pt-4 text-[12.5px] font-semibold text-steel">
        Already have an account?{" "}
        <Link href="/login" className={linkCls}>
          Sign In
        </Link>
      </div>
    </>
  );
}

export function RegistrationClosed() {
  return (
    <>
      <p className="text-[13px] font-semibold text-steel">
        Registration is closed on this panel. Ask an administrator to create an account for you.
      </p>
      <div className="mt-5 border-t border-line pt-4 text-[12.5px] font-semibold text-steel">
        <Link href="/login" className={linkCls}>
          Back to Sign In
        </Link>
      </div>
    </>
  );
}
