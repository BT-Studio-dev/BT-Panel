import { useEffect, useRef } from "react";
import { usePanel } from "./context";

export function MusicPlayer() {
  const { settings, tracks } = usePanel();
  const ref = useRef<HTMLAudioElement>(null);
  const track = tracks.find((item) => item.id === settings.selectedTrackId) ?? tracks[0];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.loop = settings.loop;
    el.volume = settings.volume;
    if (!settings.enabled || !track) {
      el.pause();
      return;
    }
    if (el.src !== track.url) {
      el.src = track.url;
    }
    if (settings.autoplay || !el.paused) {
      void el.play().catch(() => undefined);
    }
  }, [settings.enabled, settings.autoplay, settings.loop, settings.volume, settings.selectedTrackId, track]);

  if (!settings.enabled || !track) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-30 hidden max-w-[240px] md:block">
      <div className="glass pointer-events-auto px-3 py-2">
        <div className="text-[10px] font-extrabold tracking-[0.14em] text-steel uppercase">Now playing</div>
        <div className="truncate text-[12px] font-extrabold">{track.name}</div>
        <audio ref={ref} className="mt-1 w-full" controls preload="none" />
      </div>
    </div>
  );
}
