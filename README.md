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


## Documentation

- [Ubuntu deployment guide](docs/UBUNTU-DEPLOYMENT.md)
- [Pterodactyl 1.x integration](docs/PTERODACTYL-INTEGRATION.md)
- [Frontend modules and customization](docs/BT-PANEL-MODULES.md)
- [Environment variable example](.env.example)

## Pterodactyl integration

BT Panel now includes an optional server-side adapter for an existing Pterodactyl 1.x installation. Configure `PTERODACTYL_URL`, `PTERODACTYL_APPLICATION_TOKEN` and `PTERODACTYL_CLIENT_TOKEN` on the server to enable the Integrations screen. Never commit API keys or expose them to browser code.

Important: the legacy BT Panel server fleet, power transitions, console output, telemetry and backup metadata are still simulated. The Pterodactyl integration has separate endpoints for upstream nodes, client-accessible servers, real resource lookups, power actions and provisioning. Read the integration documentation before using the provisioning form because it creates a real remote server.
