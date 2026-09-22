/**
 * Live shader wallpapers ("website background shaders") — client-safe catalog
 * shared by the picker, the wallpaper layer, and the server sanitizer.
 *
 * Selections persist as sentinel wallpaper URLs `shader:<variant>` so they
 * flow through the existing saveTheme/applyTheme pipeline untouched.
 */
export type ShaderVariant = "waves" | "aurora" | "mesh";

export const SHADER_VARIANTS: { id: ShaderVariant; name: string; description: string }[] = [
  {
    id: "waves",
    name: "Flow Waves",
    description: "Slow layered waves washing in accent light",
  },
  {
    id: "aurora",
    name: "Aurora Veil",
    description: "Soft polar-light curtains drifting overhead",
  },
  {
    id: "mesh",
    name: "Plasma Mesh",
    description: "Three floating orbs of accent light",
  },
];

const PREFIX = "shader:";

export function shaderWallpaperValue(variant: ShaderVariant): string {
  return `${PREFIX}${variant}`;
}

export function parseShaderWallpaper(url: string | undefined | null): ShaderVariant | null {
  if (!url || !url.startsWith(PREFIX)) return null;
  const id = url.slice(PREFIX.length);
  return id === "waves" || id === "aurora" || id === "mesh" ? id : null;
}
