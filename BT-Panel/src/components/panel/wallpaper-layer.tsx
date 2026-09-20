import { isVideoUrl } from "@/lib/utils";
import type { ThemeSettings } from "@/lib/panel/types";
import { parseShaderWallpaper } from "@/lib/panel/shader-catalog";
import { ShaderBackground } from "./shader-background";

export function WallpaperLayer({ theme }: { theme: ThemeSettings }) {
  const url = theme.wallpaperUrl;
  const shader = parseShaderWallpaper(url);
  const video = !shader && Boolean(url) && isVideoUrl(url);
  return (
    <div className="bg-layer" aria-hidden="true">
      {/* Always present: default gradient + (for plain image URLs) the image
          from --wallpaper-url. Stays as the fallback behind live shaders
          when WebGL is unavailable. */}
      {!video ? <div className="bg-layer-image" /> : null}
      {video ? <video className="bg-layer-video" src={url} autoPlay loop muted playsInline /> : null}
      {shader ? <ShaderBackground variant={shader} /> : null}
      <div className="bg-vignette" />
    </div>
  );
}
