/**
 * Client- and server-safe catalogs: live shader wallpapers, curated 4K
 * wallpapers, game/app server templates (with simulated daemon output),
 * and deployment nodes.
 */

// ── Live shaders ────────────────────────────────────────────────────────────
export type ShaderVariant = "waves" | "aurora" | "mesh" | "nebula";

export const SHADER_VARIANTS: { id: ShaderVariant; name: string; description: string }[] = [
  { id: "waves", name: "Flow Waves", description: "Slow layered waves washing in accent light" },
  { id: "aurora", name: "Aurora Veil", description: "Soft polar-light curtains drifting overhead" },
  { id: "mesh", name: "Plasma Mesh", description: "Three floating orbs of accent light" },
  { id: "nebula", name: "Nebula Drift", description: "Domain-warped cosmic dust with a starfield" },
];

const SHADER_PREFIX = "shader:";

export function shaderWallpaperValue(variant: ShaderVariant): string {
  return `${SHADER_PREFIX}${variant}`;
}

export function parseShaderWallpaper(url: string | undefined | null): ShaderVariant | null {
  if (!url || !url.startsWith(SHADER_PREFIX)) return null;
  const id = url.slice(SHADER_PREFIX.length);
  return SHADER_VARIANTS.some((v) => v.id === id) ? (id as ShaderVariant) : null;
}

// ── Curated wallpapers (HDQWalls, 3840×2160) ────────────────────────────────
export type WallpaperItem = {
  id: string;
  title: string;
  category: "space" | "cyber" | "nature";
  thumb: string;
  full: string;
  credit: string;
};

export const WALLPAPER_CATEGORIES: { id: "all" | WallpaperItem["category"]; name: string }[] = [
  { id: "all", name: "All Wallpapers" },
  { id: "space", name: "Space & Galaxy" },
  { id: "cyber", name: "Sci-Fi & Cyberpunk" },
  { id: "nature", name: "Nature & Landscapes" },
];

function hdqwalls(id: string) {
  return {
    thumb: `https://images.hdqwalls.com/wallpapers/bthumb/${id}.jpg`,
    full: `https://images.hdqwalls.com/download/${id}-3840x2160.jpg`,
  };
}

export const WALLPAPERS: WallpaperItem[] = [
  { id: "cosmic-nebula", title: "Cosmic Nebula", category: "space", credit: "HDQWalls", ...hdqwalls("space-art-nebula-8k-jy") },
  { id: "cloud-planet", title: "Planet in the Clouds", category: "space", credit: "HDQWalls", ...hdqwalls("planet-in-the-clouds-yj") },
  { id: "event-horizon", title: "Event Horizon", category: "space", credit: "HDQWalls", ...hdqwalls("black-hole-ai-43") },
  {
    id: "cosmic-rings",
    title: "Beyond the Rings",
    category: "space",
    credit: "HDQWalls",
    ...hdqwalls("beyond-the-rings-cosmic-odyssey-q9"),
  },
  { id: "neon-geometry", title: "Neon Geometry", category: "cyber", credit: "HDQWalls", ...hdqwalls("abstract-x-neon-shape-qw") },
  {
    id: "dual-neon-rings",
    title: "Dual Neon Rings",
    category: "cyber",
    credit: "HDQWalls",
    ...hdqwalls("neon-dual-rings-futuristic-abstract-glow-cn"),
  },
  { id: "crimson-sphere", title: "Crimson Sphere", category: "cyber", credit: "HDQWalls", ...hdqwalls("crimson-black-sphere-yj") },
  {
    id: "ribbon-light",
    title: "Midnight Ribbon",
    category: "cyber",
    credit: "HDQWalls",
    ...hdqwalls("dark-blue-black-abstract-with-warm-ribbon-light-6z"),
  },
  {
    id: "sunset-valley",
    title: "Sunset Valley",
    category: "nature",
    credit: "HDQWalls",
    ...hdqwalls("beautiful-landscape-sunset-5k-yu"),
  },
  {
    id: "iceland-falls",
    title: "Iceland Falls",
    category: "nature",
    credit: "HDQWalls",
    ...hdqwalls("seljalandsfoss-waterfall-iceland-jc"),
  },
  { id: "moraine-lake", title: "Moraine Lake", category: "nature", credit: "HDQWalls", ...hdqwalls("moraine-lake-canada-ek") },
  {
    id: "alpine-reflection",
    title: "Alpine Reflection",
    category: "nature",
    credit: "HDQWalls",
    ...hdqwalls("swiss-alps-lake-reflection-rx"),
  },
  { id: "digital-starfield", title: "Digital Starfield", category: "space", credit: "HDQWalls", ...hdqwalls("space-galaxy-universe-digital-art-stars-ht") },
  { id: "galactic-stars", title: "Galactic Stars", category: "space", credit: "HDQWalls", ...hdqwalls("space-galaxy-stars-8k-1q") },
  { id: "lunar-art", title: "Lunar Art", category: "space", credit: "HDQWalls", ...hdqwalls("art-space-moon-hk") },
  { id: "andromeda", title: "Andromeda", category: "space", credit: "HDQWalls", ...hdqwalls("the-andromeda-galaxy-j6") },
  { id: "andromeda-glow", title: "Andromeda Glow", category: "space", credit: "HDQWalls", ...hdqwalls("andromeda-galaxy-5k-gb") },
  { id: "starlight", title: "Starlight", category: "space", credit: "HDQWalls", ...hdqwalls("galaxy-stars-4k-7j") },
  { id: "nebula-exposure", title: "Nebula Exposure", category: "space", credit: "HDQWalls", ...hdqwalls("nebula-space-long-exposure-3d") },
  { id: "red-cosmos", title: "Red Cosmos", category: "space", credit: "HDQWalls", ...hdqwalls("red-nebula-astrononmy-5k-ol") },
  { id: "sunset-twist", title: "Sunset Twist", category: "cyber", credit: "HDQWalls", ...hdqwalls("sunset-twist-abstract-3d-4c") },
  { id: "sharp-abstract", title: "Sharp Abstract", category: "cyber", credit: "HDQWalls", ...hdqwalls("abstract-sharp-things-jm") },
  { id: "rainbow-tunnel", title: "Rainbow Tunnel", category: "cyber", credit: "HDQWalls", ...hdqwalls("the-spiky-rainbow-orb-tunnel-0o") },
  { id: "geometric-flow", title: "Geometric Flow", category: "cyber", credit: "HDQWalls", ...hdqwalls("geometric-flow-aq") },
  { id: "color-spiral", title: "Color Spiral", category: "cyber", credit: "HDQWalls", ...hdqwalls("colorful-spiral-abstract-lq") },
  { id: "chromatic-chaos", title: "Chromatic Chaos", category: "cyber", credit: "HDQWalls", ...hdqwalls("chromatic-chaos-eu") },
  { id: "shadow-sphere", title: "Shadow Sphere", category: "cyber", credit: "HDQWalls", ...hdqwalls("shadow-sphere-abstract-5k-wq") },
  { id: "red-fractal", title: "Red Fractal", category: "cyber", credit: "HDQWalls", ...hdqwalls("red-fractal-shape-object-abstract-5k-ny") },
  { id: "red-cliff", title: "Red Cliff", category: "nature", credit: "HDQWalls", ...hdqwalls("shrine-pass-road-red-cliff-united-states-bs") },
  { id: "lofoten", title: "Lofoten", category: "nature", credit: "HDQWalls", ...hdqwalls("lofoten-norwegen-nu") },
  { id: "forest-sunbeams", title: "Forest Sunbeams", category: "nature", credit: "HDQWalls", ...hdqwalls("autumn-forest-sunbeams-an") },
  { id: "yucca-dunes", title: "Yucca Dunes", category: "nature", credit: "HDQWalls", ...hdqwalls("the-full-sunset-over-the-pink-sky-and-yucca-dunes-ck") },
  { id: "fairy-glen", title: "Fairy Glen", category: "nature", credit: "HDQWalls", ...hdqwalls("fairy-glen-sunrise-valley-ls") },
  { id: "golden-mountain", title: "Golden Mountain", category: "nature", credit: "HDQWalls", ...hdqwalls("golden-mountain-glow-2t") },
  { id: "green-night", title: "Green Night", category: "nature", credit: "HDQWalls", ...hdqwalls("green-landscape-and-night-qg") },
  { id: "skogafoss", title: "Skogafoss Rainbow", category: "nature", credit: "HDQWalls", ...hdqwalls("skogafoss-waterfall-iceland-waterfall-with-rainbow-av") },
];

// ── Server templates ────────────────────────────────────────────────────────
export type TemplateIcon = "pickaxe" | "flame" | "crosshair" | "swords" | "hexagon" | "bot" | "code";

export type ServerTemplate = {
  id: string;
  name: string;
  category: "game" | "app";
  icon: TemplateIcon;
  color: string;
  defaultPort: number;
  image: string;
  maxPlayers: number;
  bootLog: string[];
  stopLog: string[];
};

export const SERVER_TEMPLATES: ServerTemplate[] = [
  {
    id: "minecraft",
    name: "Minecraft (Paper)",
    category: "game",
    icon: "pickaxe",
    color: "#5fb04a",
    defaultPort: 25565,
    image: "docker.io/itzg/minecraft-server:java21",
    maxPlayers: 40,
    bootLog: [
      "container@bt-panel~ Server marked as starting...",
      "Starting minecraft server version 1.21.4",
      "Loading properties",
      "Default game type: SURVIVAL",
      "Starting Minecraft server on 0.0.0.0:25565",
      "Preparing level \"world\"",
      "Preparing spawn area: 83%",
      "Done (4.218s)! For help, type \"help\"",
    ],
    stopLog: ["Stopping the server", "Saving players", "Saving worlds", "ThreadedAnvilChunkStorage: All dimensions are saved"],
  },
  {
    id: "rust",
    name: "Rust",
    category: "game",
    icon: "flame",
    color: "#ce422b",
    defaultPort: 28015,
    image: "docker.io/cm2network/steamcmd:latest",
    maxPlayers: 100,
    bootLog: [
      "container@bt-panel~ Server marked as starting...",
      "Loading Prefab Bundle...",
      "Initializing 13721 entity links",
      "Spawning 5210 entities from map",
      "Oxide.Rust loaded — 18 plugins",
      "Server startup complete",
      "SteamServer Initialized",
    ],
    stopLog: ["Saving world to disk...", "Kicking 0 players", "Server shutdown complete"],
  },
  {
    id: "cs2",
    name: "Counter-Strike 2",
    category: "game",
    icon: "crosshair",
    color: "#f5a623",
    defaultPort: 27015,
    image: "docker.io/cm2network/steamcmd:latest",
    maxPlayers: 12,
    bootLog: [
      "container@bt-panel~ Server marked as starting...",
      "Loading map \"de_dust2\"",
      "Host activate: Loading (de_dust2)",
      "VAC secure mode is activated.",
      "GC Connection established for server version 1.40.2.1",
      "Server is hibernating — waiting for players",
    ],
    stopLog: ["Dropped all clients: server shutting down", "Shutting down SteamAPI", "Server stopped"],
  },
  {
    id: "valheim",
    name: "Valheim",
    category: "game",
    icon: "swords",
    color: "#4f8fba",
    defaultPort: 2456,
    image: "docker.io/cm2network/steamcmd:latest",
    maxPlayers: 10,
    bootLog: [
      "container@bt-panel~ Server marked as starting...",
      "Valheim version: l-0.219.16",
      "Loading world: Midgard",
      "Generating locations — 14,982 placed",
      "Game server connected",
    ],
    stopLog: ["World save writing", "World saved ( 214ms )", "Net scene destroyed"],
  },
  {
    id: "nodejs",
    name: "Node.js App",
    category: "app",
    icon: "hexagon",
    color: "#3fa037",
    defaultPort: 3000,
    image: "docker.io/library/node:22-bookworm-slim",
    maxPlayers: 0,
    bootLog: [
      "container@bt-panel~ Server marked as starting...",
      "> app@1.4.2 start",
      "> node dist/index.js",
      "Connected to PostgreSQL (pool size 10)",
      "Server listening on http://0.0.0.0:3000",
    ],
    stopLog: ["SIGTERM received — draining connections", "HTTP server closed", "Process exited with code 0"],
  },
  {
    id: "discord-bot",
    name: "Discord Bot",
    category: "app",
    icon: "bot",
    color: "#5865f2",
    defaultPort: 8080,
    image: "docker.io/library/node:22-bookworm-slim",
    maxPlayers: 0,
    bootLog: [
      "container@bt-panel~ Server marked as starting...",
      "Loading 24 slash commands",
      "Connecting to Discord gateway (shard 0/1)",
      "Ready! Logged in as BT-Bot#0420 — serving 37 guilds",
    ],
    stopLog: ["Destroying gateway connection", "Bot offline"],
  },
  {
    id: "python",
    name: "Python App",
    category: "app",
    icon: "code",
    color: "#3776ab",
    defaultPort: 8000,
    image: "docker.io/library/python:3.12-bookworm-slim",
    maxPlayers: 0,
    bootLog: [
      "container@bt-panel~ Server marked as starting...",
      "Installing requirements — already satisfied",
      "INFO:     Started server process [42]",
      "INFO:     Application startup complete.",
      "INFO:     Uvicorn running on http://0.0.0.0:8000",
    ],
    stopLog: ["INFO:     Shutting down", "INFO:     Finished server process [42]"],
  },
];

export function getTemplate(id: string): ServerTemplate {
  return SERVER_TEMPLATES.find((t) => t.id === id) ?? SERVER_TEMPLATES[0];
}

export type PanelNode = {
  id: string;
  name: string;
  region: string;
  location: string;
  subnet: string;
  daemonPort: number;
  sftpPort: number;
};

export const NODES: PanelNode[] = [
  { id: "eu-fra-01", name: "Frankfurt", region: "EU", location: "Frankfurt, DE", subnet: "10.20.0.", daemonPort: 8080, sftpPort: 2022 },
  { id: "us-nyc-02", name: "New York", region: "US", location: "New York, US", subnet: "10.40.0.", daemonPort: 8080, sftpPort: 2022 },
  { id: "ap-sgp-01", name: "Singapore", region: "APAC", location: "Singapore, SG", subnet: "10.60.0.", daemonPort: 8080, sftpPort: 2022 },
];

export const MEMORY_OPTIONS = [1024, 2048, 4096, 8192, 16384];
export const CPU_OPTIONS = [100, 200, 400, 800];
export const DISK_OPTIONS = [10240, 20480, 51200, 102400];

/** Simulated daemon replies for console commands. */
export function consoleReply(templateId: string, raw: string): { level: "info" | "warn"; message: string }[] {
  const t = getTemplate(templateId);
  const command = raw.trim();
  const [head, ...rest] = command.split(/\s+/);
  const arg = rest.join(" ");
  switch (head.toLowerCase()) {
    case "help":
      return [
        { level: "info", message: "Available commands: help, list, say <msg>, status, tps, save-all, version, clear" },
      ];
    case "list":
      return [
        {
          level: "info",
          message:
            t.maxPlayers > 0
              ? `There are 0 of a max of ${t.maxPlayers} players online.`
              : "This is an application server — no player slots.",
        },
      ];
    case "say":
      return arg ? [{ level: "info", message: `[Server] ${arg}` }] : [{ level: "warn", message: "Usage: say <message>" }];
    case "status":
      return [{ level: "info", message: `${t.name} is healthy — image ${t.image}` }];
    case "tps":
      return [{ level: "info", message: "TPS from last 1m, 5m, 15m: 20.0, 20.0, 19.98" }];
    case "save-all":
      return [
        { level: "info", message: "Saving the game (this may take a moment!)" },
        { level: "info", message: "Saved the game" },
      ];
    case "version":
      return [{ level: "info", message: `${t.name} — BT Panel daemon v2.1.1` }];
    default:
      return [{ level: "warn", message: `Unknown command "${head}". Type "help" for help.` }];
  }
}
