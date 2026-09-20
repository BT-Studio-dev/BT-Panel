import { isVideoUrl } from "@/lib/utils";
import type { ThemeSettings } from "@/lib/panel/types";

export function WallpaperLayer({ theme }: { theme: ThemeSettings }) {
  const url = theme.wallpaperUrl;
  const video = Boolean(url) && isVideoUrl(url);
  return (
    <div className="bg-layer" aria-hidden="true">
      {video ? (
        <video className="bg-layer-video" src={url} autoPlay loop muted playsInline />
      ) : (
        <div className="bg-layer-image" />
      )}
      <div className="bg-vignette" />
    </div>
  );
}
