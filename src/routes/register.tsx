import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthShell } from "@/components/panel/auth-shell";
import { getPublicAppearance } from "@/lib/panel/server";

export const Route = createFileRoute("/register")({ component: Register });

function Register() {
  const { user, isPending } = useCurrentUserState();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // null = still loading; fail-open only on fetch error (server 403 is the real gate).
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  useEffect(() => {
    void getPublicAppearance()
      .then((a) => setRegistrationOpen(a.allowRegistration))
      .catch(() => setRegistrationOpen(true));
  }, []);

  if (!isPending && user) return <Navigate to="/" />;
  if (registrationOpen === null) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username.trim())) {
      setError("Username must be 3–32 characters using letters, numbers, dots, dashes, or underscores.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.signUp.email({
        email: email.trim().toLowerCase(),
        password,
        name: username.trim(),
        callbackURL: "/",
      });
      if (result.error) throw new Error(result.error.message || "Could not create account.");
      window.location.assign("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account.");
      setBusy(false);
    }
  }

  if (registrationOpen === false) {
    return (
      <AuthShell
        title="Registration Closed"
        subtitle="Self-registration is disabled on this panel"
        footer={
          <>
            Already have an account?{" "}
            <Link to="/login" className="font-bold text-ice underline decoration-white/30 underline-offset-4 hover:decoration-white">
              Sign In
            </Link>
          </>
        }
      >
        <div className="mt-3 rounded-[12px] border border-white/10 bg-white/5 p-4 text-left">
          <p className="text-[13px] leading-relaxed font-semibold text-steel">
            Public account creation is currently turned off by the panel administrator. If you need an account,
            please contact an owner or admin to create one for you.
          </p>
        </div>
        <Link to="/login" className="btn-accent mt-5 block w-full text-center">
          Back to Sign In
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create {panel} Account"
      subtitle="Join and start deploying game & app servers"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-ice underline decoration-white/30 underline-offset-4 hover:decoration-white">
            Sign In
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="text-left">
        <label className="mb-1.5 block text-[11px] font-bold tracking-wide text-steel" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          className="panel-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. shadow_player"
          autoComplete="username"
          required
          autoFocus
        />
        <label className="mt-3.5 mb-1.5 block text-[11px] font-bold tracking-wide text-steel" htmlFor="email">
          Email Address
        </label>
        <input
          id="email"
          className="panel-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <label className="mt-3.5 mb-1.5 block text-[11px] font-bold tracking-wide text-steel" htmlFor="pass">
          Password
        </label>
        <div className="relative">
          <input
            id="pass"
            className="panel-input pr-14"
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 4 characters"
            autoComplete="new-password"
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
        <label className="mt-3.5 mb-1.5 block text-[11px] font-bold tracking-wide text-steel" htmlFor="confirm">
          Confirm Password
        </label>
        <div className="relative">
          <input
            id="confirm"
            className="panel-input pr-14"
            type={showConfirm ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="absolute top-1/2 right-3 -translate-y-1/2 text-steel transition-colors hover:text-ice"
            aria-label={showConfirm ? "Hide password" : "Show password"}
            title={showConfirm ? "Hide password" : "Show password"}
            onClick={() => setShowConfirm((v) => !v)}
          >
            {showConfirm ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        {confirm && confirm !== password ? (
          <p className="mt-2 text-[12px] font-semibold text-danger">Passwords do not match.</p>
        ) : null}
        {error ? <p className="mt-3 text-[13px] font-semibold text-danger">{error}</p> : null}
        <button type="submit" className="btn-accent mt-5 w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
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
