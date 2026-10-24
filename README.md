# 🎛️ BT-Panel

A modern control panel interface built with Next.js, TypeScript, Tailwind CSS, and Drizzle ORM.

## ✨ Features

- 🔐 **Authentication System**: Local authentication (login, register, password reset) and Google OAuth integration.
- 🖥️ **Server Management**: Manage, view, and route server instances.
- 👤 **User & Account Management**: Complete user profile settings and account control endpoints[cite: 1].
- 🖼️ **Media Uploads**: Built-in endpoints for managing and retrieving media assets[cite: 1].
- 🗄️ **Database Integration**: Managed schema and migrations powered by Drizzle ORM[cite: 1].
- 🚀 **Deployment Ready**: Pre-configured systemd service (`bt-panel.service`), Nginx setup, and Debian deployment scripts[cite: 1].

### 🛠️ Tech Stack

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)

## ⚡ Getting Started

### 📋 Prerequisites

- Node.js 22 (recommended for the current Next.js version)
- PostgreSQL or supported database driver

### ⚙️ Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/BT-Studio-dev/BT-Panel.git
   cd BT-Panel


### Minecraft module in the web panel

The Next.js panel embeds the Minecraft manager as its own nav entry
(**Minecraft**, or the shortcut `/minecraft` → `/?view=minecraft`):

* The static design preview is copied into `public/minecraft-panel/`, so it is
  served by the same deployment — no second web server. Regenerate it after
  changing `minecraft-panel/demo/` with `npm run sync:minecraft-preview`.
* Set `NEXT_PUBLIC_MINECRAFT_PANEL_URL=https://mc.example.com` to embed the live
  PHP panel instead; the module then loads the real panel in the frame.

## 🎮 Minecraft panel (PHP + HTML/CSS/JS)

`minecraft-panel/` is a self-contained Minecraft server manager you can drop
into a **BT Panel / aaPanel** site. It is plain PHP 8 with vanilla JavaScript —
no Node.js, no Composer, no build step — and it runs Minecraft servers directly
on the panel host (Java + `screen`/`tmux`, console over RCON).

- Server lifecycle: start / stop / restart / kill, live uptime and heap usage
- Live console with command history over RCON, offset-based log streaming
- One-click Vanilla, Paper and Purpur installs; custom jar upload
- Per-server file manager, `.tar.gz` backups with restore, audit log
- Admin/member roles, CSRF-protected JSON API, CLI (`bin/btp`) for cron backups

Static design preview (no PHP needed): [`minecraft-panel/demo/index.html`](minecraft-panel/demo/index.html)

Read [`minecraft-panel/README.md`](minecraft-panel/README.md) for the feature
list and API reference, and
[`minecraft-panel/docs/BT-PANEL-DEPLOY.md`](minecraft-panel/docs/BT-PANEL-DEPLOY.md)
for the BT Panel deployment steps (document root, `disable_functions`, ports,
firewall, HTTPS, troubleshooting).

> The Next.js application above and the PHP panel are independent. The panel
> does not use Wings/Pterodactyl: game ports and loopback RCON are the only
> ports involved.

## Documentation

- [Ubuntu deployment guide](docs/UBUNTU-DEPLOYMENT.md)
- [Pterodactyl 1.x integration](docs/PTERODACTYL-INTEGRATION.md)
- [Frontend modules and customization](docs/BT-PANEL-MODULES.md)
- [Environment variable example](.env.example)

## Pterodactyl integration

BT Panel now includes an optional server-side adapter for an existing Pterodactyl 1.x installation. Configure `PTERODACTYL_URL`, `PTERODACTYL_APPLICATION_TOKEN` and `PTERODACTYL_CLIENT_TOKEN` on the server to enable the Integrations screen. Never commit API keys or expose them to browser code.

Important: the legacy BT Panel server fleet, power transitions, console output, telemetry and backup metadata are still simulated. The Pterodactyl integration has separate endpoints for upstream nodes, client-accessible servers, real resource lookups, power actions and provisioning. Read the integration documentation before using the provisioning form because it creates a real remote server.
