import { useEffect } from "react";
import { playSfx, type SfxKind } from "@/lib/panel/sfx";

export function SoundEffects() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(
        "button, a, [role='tab']",
      );
      if (!target || target.hasAttribute("disabled") || target.dataset.sfxIgnore === "true") return;
      const requested = target.dataset.sfxKind as SfxKind | undefined;
      const kind: SfxKind = requested
        ?? (target.classList.contains("btn-danger")
          ? "danger"
          : target.getAttribute("role") === "tab" || target.closest("nav")
            ? "navigate"
            : "click");
      playSfx(kind);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
