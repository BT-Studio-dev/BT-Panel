#!/usr/bin/env node
/**
 * Copy the standalone PHP panel's static preview (minecraft-panel/demo) into
 * public/minecraft-panel so the Next.js app can embed it in the Minecraft
 * module without a second web server.
 *
 * Run after regenerating minecraft-panel/demo:
 *   node scripts/sync-minecraft-preview.mjs
 *   npm run sync:minecraft-preview
 *
 * Rewrites (nothing else in the pages is touched):
 *   ../public/assets/…   -> assets/…
 *   ../public/favicon.svg -> favicon.svg
 *   the design-preview banner gets a `demo-banner` class
 *   an inline script sets data-embed when the page is opened with ?embed=1
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "minecraft-panel", "demo");
const targetDir = join(root, "public", "minecraft-panel");

const EMBED_SCRIPT = `<script>
  (function () {
    var p = new URLSearchParams(location.search);
    if (p.get("embed") === "1") document.documentElement.dataset.embed = "1";
  })();
</script>
`;

/** CSS appended to the copied stylesheet so the embedded viewer stays clean. */
const EMBED_CSS = `
/* Embedded viewer inside the BT Panel website: hide preview chrome. */
[data-embed] .demo-banner {
  display: none;
}

[data-embed] .auth-aside {
  display: none;
}
`;

function main() {
  mkdirSync(join(targetDir, "assets"), { recursive: true });

  const pages = readdirSync(sourceDir).filter((name) => name.endsWith(".html"));
  for (const name of pages) {
    let html = readFileSync(join(sourceDir, name), "utf8");
    html = html.replaceAll("../public/assets/", "assets/");
    html = html.replaceAll("../public/favicon.svg", "favicon.svg");
    html = html.replace(
      /<div class="card" style="border-color:rgba\(208,0,0,\.4\);/,
      '<div class="card demo-banner" style="border-color:rgba(208,0,0,.4);',
    );
    // Guard against double insertion when the source already carries the script.
    if (!html.includes("document.documentElement.dataset.embed")) {
      html = html.replace("</body>", `${EMBED_SCRIPT}</body>`);
    }
    writeFileSync(join(targetDir, name), html);
  }

  copyFileSync(join(root, "minecraft-panel", "public", "assets", "app.css"), join(targetDir, "assets", "app.css"));
  copyFileSync(join(root, "minecraft-panel", "public", "favicon.svg"), join(targetDir, "favicon.svg"));

  const cssPath = join(targetDir, "assets", "app.css");
  const css = readFileSync(cssPath, "utf8");
  if (!css.includes("[data-embed] .demo-banner")) {
    writeFileSync(cssPath, css + EMBED_CSS);
  }

  console.log(`Synced ${pages.length} pages and assets into public/minecraft-panel`);
}

main();
