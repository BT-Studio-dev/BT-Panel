import { useEffect, useState } from "react";
import { usePanel } from "./context";

/**
 * Onboarding spotlight walkthrough (Settings → Access: "Auto-Start Onboarding Tour").
 *
 * - Auto-opens once per user (browser-localStorage flag) when the admin enables
 *   the tour toggle — so "newly registered users on first login" see it.
 * - The Access card's "Test Tour" button dispatches `btpanel:start-tour`,
 *   which restarts the walkthrough at step 1 regardless of the done-flag.
 */
const STEPS: { title: string; body: string }[] = [
  {
    title: "Welcome aboard 👋",
    body: "This quick tour shows you around the panel. It takes about twenty seconds — you can skip it any time.",
  },
  {
    title: "Navigate from the sidebar",
    body: "Home is your overview, Team lists members, Music runs the ambient player, and My Account holds your profile. Admins also see Admin Settings and User Management here.",
  },
  {
    title: "Make it yours",
    body: "Settings → 4K Wallpapers opens the Panel Background Engine — browse the live catalog, heart favorites, upload media, or paste a custom image/video URL.",
  },
  {
    title: "Tune the look",
    body: "Settings → Appearance changes accent colors, glass tint, and the Transparency & Blur sliders (with auto-save). Settings → General sets your panel name, logos, and favicon.",
  },
];

export function OnboardingTour() {
  const { profile, settings } = usePanel();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const doneKey = profile ? `btpanel.tour-done.${profile.userId}` : null;

  // Auto-start for users who haven't finished it (admin toggle must be on).
  useEffect(() => {
    if (!profile || !doneKey || !settings.onboardingTour) return;
    let seen = false;
    try {
      seen = Boolean(window.localStorage.getItem(doneKey));
    } catch {
      /* storage unavailable */
    }
    if (seen) return;
    const t = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(t);
  }, [profile, doneKey, settings.onboardingTour]);

  // Manual restart from the Access settings card.
  useEffect(() => {
    const start = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("btpanel:start-tour", start);
    return () => window.removeEventListener("btpanel:start-tour", start);
  }, []);

  if (!open || !profile) return null;

  const finish = () => {
    setOpen(false);
    if (doneKey) {
      try {
        window.localStorage.setItem(doneKey, "1");
      } catch {
        /* storage unavailable */
      }
    }
  };

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const last = step >= STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 px-4" role="dialog" aria-modal="true">
      <div className="glass glass-strong w-full max-w-md p-6">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-extrabold tracking-[0.14em] text-steel uppercase">
            Onboarding tour · {step + 1}/{STEPS.length}
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={[
                  "size-1.5 rounded-full",
                  i === step ? "bg-[var(--accent)]" : i < step ? "bg-ice/60" : "bg-white/20",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
        <h3 className="mt-4 text-[18px] font-extrabold tracking-tight">{current.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed font-semibold text-steel">{current.body}</p>
        <div className="mt-5 flex items-center justify-between">
          <button type="button" className="text-[12px] font-bold text-steel hover:text-ice" onClick={finish}>
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 ? (
              <button type="button" className="btn-ghost min-h-10" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </button>
            ) : null}
            <button
              type="button"
              className="btn-accent min-h-10"
              onClick={() => (last ? finish() : setStep((s) => s + 1))}
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
