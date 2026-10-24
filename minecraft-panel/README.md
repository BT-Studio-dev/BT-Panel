# 🎮 BT Minecraft Panel

A Minecraft server management panel written in **PHP 8 + HTML/CSS/JavaScript**,
designed to be dropped into a [BT Panel / aaPanel](https://www.bt.cn) site. It
runs Minecraft servers directly on the panel host — no Pterodactyl, Wings or
Node.js required.

Static design preview: [`demo/dashboard.html`](demo/dashboard.html) (open it in a
browser — it needs no PHP).

## Features

| | |
|---|---|
| 🖥️ **Server lifecycle** | Start, stop, restart and force-kill JVMs; status, uptime and heap are read from `/proc`. |
| 💻 **Live console** | Streams `logs/console.log` with an offset cursor, sends commands over RCON, remembers command history. |
| 📦 **One-click installs** | Vanilla (Mojang), Paper and Purpur downloads with version resolution; custom jars via upload. |
| 🗂️ **File manager** | Browse, edit (≤1 MB), upload (≤256 MB), download, create folders and delete inside the server sandbox. |
| 🧰 **Backups** | `.tar.gz` archives outside the server directory, download/restore/delete, CLI + cron friendly. |
| 👥 **Users & roles** | `admin` / `member`, per-server ownership, password changes and session revocation. |
| 🧾 **Audit log** | Every start, stop, install, file write, backup and user change with user, IP and timestamp. |
| 🌗 **UI** | Dark/light theme, responsive, zero external assets — no CDN, no fonts to fetch, works offline. |
| 🔐 **Hardening** | CSRF tokens, origin checks, HttpOnly sessions, path-traversal guards, no secrets in the browser. |

## Requirements

* PHP **8.1+** with `pdo_sqlite`, `mbstring`, `json`
* `proc_open` enabled (BT Panel disables it by default)
* `screen` or `tmux` (falls back to `setsid`)
* `tar` for backups
* Java 17+ (21+ for Minecraft 1.20.5+)

## Quick start

```bash
git clone <this repository>
cd BT-Panel/minecraft-panel

# 1. make it writable by the PHP user (BT Panel uses `www`)
sudo chown -R www:www storage
chmod -R 775 storage

# 2. serve the public/ directory with your site
php -S 0.0.0.0:8080 -t public        # local smoke test

# 3. open http://localhost:8080 and finish the setup wizard
```

For production on BT Panel, see **[docs/BT-PANEL-DEPLOY.md](docs/BT-PANEL-DEPLOY.md)**
(document root = `public/`, `disable_functions`, firewall, HTTPS, troubleshooting).

## Project layout

```
minecraft-panel/
├── app/
│   ├── Http/            Kernel (routing), Api controllers, Web pages, Csrf
│   ├── Minecraft/       ServerManager, backends, RCON, JarInstaller, backups
│   ├── Support/         Db, Auth, Audit, Path, Http, Installer, helpers
│   └── Views/           PHP templates (layout partials + pages)
├── bin/btp              CLI: doctor, users, backups, install, start/stop
├── docs/                deployment + cron backup guides
├── public/              document root (index.php, assets, favicon)
├── storage/             SQLite DB, server dirs, backups, logs (not web-served)
├── tests/               smoke + HTTP route tests (no external PHP needed)
├── bootstrap.php        autoloader, config, helpers
└── config.example.php   copy to config.php (setup wizard does this)
```

## How it works

* **Processes** — each server is started as `java -Xms/-Xmx … -Dbtp.server=<uuid>
  -jar server.jar nogui` inside a detached `screen`/`tmux` session (or `setsid`).
  The unique JVM marker is how status is detected, so the panel stays correct
  even if it restarts.
* **Console** — stdout/stderr are appended to `logs/console.log`; the browser
  polls new bytes by offset. Commands go to the real server console over RCON
  (`enable-rcon=true`, password generated per server).
* **Data** — SQLite (`storage/panel.sqlite`) with prepared statements; every
  server gets an isolated directory under `storage/servers/`.
* **Files** — all user-supplied paths pass `Path::assertInside()`, which rejects
  traversal, absolute paths, NUL bytes and symlink escapes.

## CLI

Run as the PHP-FPM user so file ownership stays consistent:

```bash
sudo -u www php bin/btp doctor
sudo -u www php bin/btp servers
sudo -u www php bin/btp start survival-smp
sudo -u www php bin/btp backup --all
sudo -u www php bin/btp user:create admin@example.com --name "Ada" --role admin
sudo -u www php bin/btp user:passwd admin@example.com
```

## HTTP API

All endpoints return JSON, require an authenticated session and (for writes) the
`X-CSRF-Token` header. Tokens are never returned.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness + install state (public) |
| GET | `/api/stats` | Dashboard totals |
| GET/POST | `/api/servers` | List / create |
| GET/PATCH/DELETE | `/api/servers/{id}` | Read / update / delete (`X-Confirm-Name` required) |
| POST | `/api/servers/{id}/power` | `{"action":"start\|stop\|restart\|kill"}` |
| POST | `/api/servers/{id}/install` | Download/replace server software |
| GET/POST | `/api/servers/{id}/console` | Poll output (`?since=`) / send command |
| GET | `/api/servers/{id}/files?path=` | Directory listing |
| GET/PUT | `/api/servers/{id}/files/content` | Read / write a text file |
| POST | `/api/servers/{id}/files/upload` | Multipart upload |
| POST | `/api/servers/{id}/files/mkdir` · `/delete` | Create / delete entries |
| GET | `/api/servers/{id}/files/download?path=` | Download a file |
| GET/POST | `/api/servers/{id}/backups` | List / create archives |
| GET | `/api/servers/{id}/backups/{bid}/download` | Download archive |
| POST | `/api/servers/{id}/backups/{bid}/restore` | Restore archive |
| DELETE | `/api/servers/{id}/backups/{bid}` | Delete archive |
| GET/POST | `/api/users` | Admin: list / create users |
| PATCH/DELETE | `/api/users/{id}` | Admin: role, password, delete |
| GET/PATCH | `/api/settings` | Admin: panel settings + runtime info |
| GET | `/api/activity` | Admin: audit log |
| POST | `/api/account/password` | Change your own password |

## Tests

The smoke suite creates a throwaway SQLite database and needs no Java, network
or web server:

```bash
php tests/run-smoke.php        # 86 checks: db, auth, provisioning, paths, views
php tests/run-http.php get /login          # one front-controller request
php tests/run-http.php get /api/health
php tests/run-http.php post /api/servers   # expect a 419 CSRF rejection
```

`tests/fakes/ProcessRunner.php` is a test double used when the host forbids
process spawning; pass `BTP_TEST_REAL_PROC=1` on a normal host to exercise the
real implementation.

## Limitations

* Servers run as the PHP-FPM system user — the panel does not create Linux users
  per server, so one server cannot be isolated from another at OS level. Use
  separate BT Panel sites/hosts if you need hard multi-tenant isolation.
* Backups require a stopped server (live world folders are not consistent).
* Vanilla/Paper/Purpur are supported out of the box; Forge/Fabric/Modpacks need a
  manually uploaded `server.jar`.
* No plugin/mod browser: upload jars via the file manager.
* The panel intentionally manages **local** servers; it is not a Pterodactyl
  replacement and does not talk to Wings.

## License

Same license as the parent BT-Panel repository.
