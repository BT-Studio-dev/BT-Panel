import { BookOpen, Image, Palette } from "lucide-react";

const STEPS: { title: string; body: string }[] = [
  {
    title: "1 · Set your branding",
    body: "Open Settings → General (Branding & Identity) to name the panel, set the browser tab title, and upload your own panel and favicon logos.",
  },
  {
    title: "2 · Pick a background",
    body: "Settings → 4K Wallpapers opens the Panel Background Engine: browse the live wallpaper catalog, upload an image, paste a video/image URL, and heart favorites for quick reuse.",
  },
  {
    title: "3 · Tune the glass",
    body: "Settings → Appearance controls wallpaper blur/opacity, accent and nav colors — plus the Glassmorphism Transparency & Blur sliders with auto-save.",
  },
  {
    title: "4 · Add your team",
    body: "User Management creates accounts and assigns roles (owner / admin / member). The Team view shows everyone with presence dots; restrict visibility with the Show Team toggle.",
  },
];

export function TutorialsView() {
  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight">
          <BookOpen className="size-5 text-[var(--accent)]" />
          Tutorials
        </h2>
        <p className="mt-1 text-[13px] font-semibold text-steel">
          Get the panel looking and running the way you want — four quick steps.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {STEPS.map((step) => (
          <div key={step.title} className="glass p-4">
            <div className="text-[14px] font-extrabold">{step.title}</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed font-semibold text-steel">{step.body}</p>
          </div>
        ))}
      </div>
      <div className="glass mt-3 p-4">
        <div className="flex items-center gap-2 text-[14px] font-extrabold">
          <Palette className="size-4 text-[var(--accent)]" />
          Music & sound
        </div>
        <p className="mt-1.5 text-[12.5px] leading-relaxed font-semibold text-steel">
          The Music tab manages the ambient player and click/hover sound effects, and Settings → Access toggles this
          page, public registration, and the onboarding tour for new accounts.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/30 px-3 py-2 text-[12px] font-semibold text-steel">
          <Image className="size-4 shrink-0 text-[var(--accent)]" />
          Wallpapers can also be applied as looping MP4/WEBM backgrounds via the Custom URL tab in the Background Engine.
        </div>
      </div>
    </div>
  );
}
