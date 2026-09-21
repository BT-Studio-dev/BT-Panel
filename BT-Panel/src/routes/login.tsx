import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthShell } from "@/components/panel/auth-shell";
import { getPublicAppearance, resolveLoginEmail } from "@/lib/panel/server";
import { withTimeout } from "@/lib/panel/with-timeout";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);

  useEffect(() => {
    void getPublicAppearance()
      .then((a) => setRegistrationOpen(a.allowRegistration))
      .catch(() => setRegistrationOpen(true));
  }, []);

  // Note: preview auto sign-in lives in `/` (src/routes/index.tsx) — it fires
  // before this route is ever reached, so the login page stays a purely manual
  // form (needed after explicit Logout and in production).
  if (!isPending && user) return <Navigate to="/" />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const resolved = await withTimeout(resolveLoginEmail({ data: { identifier } }), 15000);
      if (!resolved) throw new Error("The server didn't respond in time — check the connection and try again.");
      const result = (await withTimeout(
        authClient.signIn.email({ email: resolved.email, password, callbackURL: "/" }),
        15000,
      )) as Awaited<ReturnType<typeof authClient.signIn.email>> | null;
      if (!result) throw new Error("Sign-in didn't respond in time — please try again.");
      if (result.error) throw new Error(result.error.message || "Invalid username or password.");
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid username or password.");
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign In to {panel}"
      subtitle="Enter your credentials to access your servers"
      footer={
        registrationOpen ? (
          <>
            Don&apos;t have an account?{" "}
            <Link to="/register" className="font-bold text-ice underline decoration-white/30 underline-offset-4 hover:decoration-white">
              Create Account
            </Link>
          </>
        ) : undefined
      }
    >
      <form onSubmit={onSubmit} className="text-left">
        <label className="mt-1 mb-1.5 block text-[11px] font-bold tracking-wide text-steel" htmlFor="user">
          Username or Email
        </label>
        <input
          id="user"
          className="panel-input"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="admin or admin@example.com"
          autoComplete="username"
          required
          autoFocus
        />
        <div className="mt-3.5 mb-1.5 flex items-center justify-between">
          <label className="block text-[11px] font-bold tracking-wide text-steel" htmlFor="pass">
            Password
          </label>
          <button
            type="button"
            className="text-[11px] font-bold text-[var(--accent)] hover:brightness-125"
            onClick={() => toast.info("Password resets are handled by your panel administrator (owner/admin).")}
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <input
            id="pass"
            className="panel-input pr-14"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-steel transition-colors hover:text-ice"
            aria-label={show ? "Hide password" : "Show password"}
            title={show ? "Hide password" : "Show password"}
            onClick={() => setShow((v) => !v)}
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {error ? <p className="mt-3 text-[13px] font-semibold text-danger">{error}</p> : null}
        <button type="submit" className="btn-accent mt-5 w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign In"}
        </button>
      </form>

      {authEnabled && GROK_PROVIDERS.length > 0 ? (
        <div className="mt-5">
          <div className="mb-3 flex items-center gap-3 text-[11px] font-bold tracking-wide text-steel uppercase">
            <span className="h-px flex-1 bg-white/10" />
            or
            <span className="h-px flex-1 bg-white/10" />
          </div>
          <div className="grid gap-2">
            {GROK_PROVIDERS.map((provider) => (
              <button
                key={provider.providerId}
                type="button"
                className="btn-ghost w-full"
                onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
              >
                Continue with {provider.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
