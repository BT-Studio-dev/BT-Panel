import { redirect } from "next/navigation";

/**
 * Short, memorable entry point for the Minecraft module.
 * The panel shell owns authentication, so the view itself lives at /?view=minecraft.
 */
export default function MinecraftPage() {
  redirect("/?view=minecraft");
}
