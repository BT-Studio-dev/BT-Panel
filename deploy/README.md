# Deploying BT Panel on a Linux Debian VPS

Runs the panel as a normal Node service behind nginx, with PostgreSQL on the
same machine. Tested against Debian 12 (bookworm) and 13 (trixie).

## Requirements

| | Minimum | Comfortable |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB (+1 GB swap) | 2 GB |
| Disk | 10 GB | 20 GB |
| OS | Debian 12/13 x86-64 or ARM64 | |
| Network | a domain name (A record → VPS IP) for HTTPS | |

## One-shot install

```bash
# 1. Get the source onto the VPS (any of these)
git clone https://github.com/BT-Studio-dev/BT-Panel.git /opt/src && cd /opt/src
#   …or upload it:  scp -r ./BT-Panel root@YOUR_VPS:/opt/src

# 2. Install everything and start the panel
sudo bash deploy/setup-debian.sh panel.yourdomain.com
```

The script installs Node.js 22, PostgreSQL, nginx and certbot; creates the
`btpanel` database and a system user; builds the app into `/opt/bt-panel`;
enables `bt-panel.service`; proxies it through nginx and (when DNS already
points at the VPS) issues a Let's Encrypt certificate.

Then open **https://panel.yourdomain.com/register** — the first account you
create becomes the panel owner.

## No domain yet?

Run the script with the VPS hostname or `localhost` and open
`http://YOUR_VPS_IP`. Sign-in still works over plain HTTP on an IP address.
Add HTTPS later:

```bash
certbot --nginx -d panel.yourdomain.com --redirect
```

## Configuration (`/opt/bt-panel/.env`)

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (written by the installer) |
| `SEED_DEMO` | `false` on a real server: no sample accounts/fleet, so the first registered account becomes owner. `true` seeds `admin / btpanel123` and `steve / steve12345` plus six sample servers. |
| `COOKIE_SECURE` | `true` behind HTTPS (auto-detected from the request otherwise) |
| `PORT` | port the app listens on (nginx proxies to `127.0.0.1:3000`) |

Restart after changing it: `sudo systemctl restart bt-panel`

## Day-to-day

```bash
journalctl -u bt-panel -f                 # live logs
systemctl restart bt-panel                # restart
nano /opt/bt-panel/.env                   # config

# update to a newer version
cd /opt/bt-panel && sudo -u btpanel git pull \
  && sudo -u btpanel npm ci && sudo -u btpanel npm run build \
  && sudo systemctl restart bt-panel

# nightly database backup (add to cron)
sudo -u postgres pg_dump btpanel > /root/bt-panel-$(date +%F).sql
```

## Firewall (optional)

```bash
apt install ufw
ufw allow OpenSSH          # keep your SSH port open first!
ufw allow 'Nginx Full'
ufw enable
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `502 Bad Gateway` | `systemctl status bt-panel` and `journalctl -u bt-panel -n 50` |
| Build runs out of memory | add 2 GB swap, or build with `NODE_OPTIONS=--max-old-space-size=1536` |
| Sign-in loops back to the login page | you are on HTTPS but cookies are not `Secure` — set `COOKIE_SECURE=true` and restart |
| Tables missing | nothing to do: the app creates its schema on first request. `npx drizzle-kit push` also works from `/opt/bt-panel` |
| Port 3000 already in use | change `PORT` in `.env` and the `proxy_pass` line in `/etc/nginx/sites-available/bt-panel.conf` |

## What is real and what is simulated

Accounts, roles, presence, settings, branding, wallpapers, music and the
server fleet are all stored in PostgreSQL and survive restarts. The **game and
app servers themselves are simulated** — power commands, console output and
CPU/memory graphs stand in for a daemon such as Pterodactyl Wings. Point the
power/console endpoints at a real daemon to manage actual game servers.
