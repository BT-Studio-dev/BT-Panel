# Ubuntu deployment

This guide deploys BT Panel as a Node.js/Next.js service with PostgreSQL and a reverse proxy. It does **not** install Pterodactyl/Wings. Use [PTERODACTYL-INTEGRATION.md](./PTERODACTYL-INTEGRATION.md) to connect an already-configured Pterodactyl 1.x installation.

Example assumptions: Ubuntu 24.04 LTS, Node.js 22, application port 3000, domain `panel.example.com`. Run commands as an account with sudo access. Replace the example domain and passwords.

## 1. Install system packages

```bash
sudo apt update
sudo apt install -y ca-certificates curl git build-essential openssl \
  postgresql postgresql-contrib nginx certbot python3-certbot-nginx ufw
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
sudo bash /tmp/nodesource_setup.sh
sudo apt install -y nodejs
node --version
npm --version
```

## 2. Create a database and service account

```bash
DB_PASS="$(openssl rand -hex 24)"
sudo -u postgres psql <<SQL
CREATE ROLE btpanel LOGIN PASSWORD '${DB_PASS}';
CREATE DATABASE btpanel OWNER btpanel;
SQL

sudo useradd --system --user-group --home-dir /opt/bt-panel \
  --shell /usr/sbin/nologin btpanel
sudo git clone https://github.com/BT-Studio-dev/BT-Panel.git /opt/bt-panel
sudo chown -R btpanel:btpanel /opt/bt-panel
```

Save the generated `DB_PASS` in the root shell until the environment file has been created. Do not expose PostgreSQL port 5432 publicly.

## 3. Configure environment

```bash
sudo tee /opt/bt-panel/.env >/dev/null <<EOF
DATABASE_URL=postgresql://btpanel:${DB_PASS}@127.0.0.1:5432/btpanel
SEED_DEMO=false
COOKIE_SECURE=true
PORT=3000
PUBLIC_BASE_URL=https://panel.example.com
PTERODACTYL_URL=https://pterodactyl.example.com
PTERODACTYL_APPLICATION_TOKEN=
PTERODACTYL_CLIENT_TOKEN=
EOF
sudo chown btpanel:btpanel /opt/bt-panel/.env
sudo chmod 600 /opt/bt-panel/.env
```

The Pterodactyl variables are optional until you configure the integration. Never commit real secrets. See [.env.example](../.env.example).

## 4. Install and build

The current source snapshot does not include `package-lock.json`. Therefore, use `npm install` (not `npm ci`) unless/until a lockfile has been generated and committed.

```bash
sudo -u btpanel env NODE_OPTIONS=--max-old-space-size=2048 \
  bash -c 'cd /opt/bt-panel && npm install --no-audit --no-fund'
sudo -u btpanel env NODE_OPTIONS=--max-old-space-size=2048 \
  bash -c 'cd /opt/bt-panel && npm run build'
```

## 5. Create the systemd service

Create `/etc/systemd/system/bt-panel.service`:

```ini
[Unit]
Description=BT Panel
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=btpanel
Group=btpanel
WorkingDirectory=/opt/bt-panel
EnvironmentFile=/opt/bt-panel/.env
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/bt-panel/node_modules/next/dist/bin/next start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=full
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Activate it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bt-panel
sudo systemctl status bt-panel --no-pager
sudo journalctl -u bt-panel -n 100 --no-pager
```

## 6A. Nginx reverse proxy (choose this OR Apache)

Configure DNS first. Create `/etc/nginx/sites-available/bt-panel`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name panel.example.com;
    client_max_body_size 16m;

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Then enable the site and TLS:

```bash
sudo ln -s /etc/nginx/sites-available/bt-panel /etc/nginx/sites-enabled/bt-panel
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d panel.example.com --redirect
```

## 6B. Apache reverse proxy (alternative)

Do not enable Nginx and Apache on the same IP/ports simultaneously. Install Apache and proxy modules:

```bash
sudo apt install -y apache2 certbot python3-certbot-apache
sudo a2enmod proxy proxy_http headers ssl rewrite
```

Create `/etc/apache2/sites-available/bt-panel.conf`:

```apache
<VirtualHost *:80>
    ServerName panel.example.com
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    ErrorLog ${APACHE_LOG_DIR}/bt-panel-error.log
    CustomLog ${APACHE_LOG_DIR}/bt-panel-access.log combined
</VirtualHost>
```

Enable the site and HTTPS:

```bash
sudo a2ensite bt-panel
sudo apache2ctl configtest
sudo systemctl reload apache2
sudo certbot --apache -d panel.example.com --redirect
```

## 7. Firewall and verification

Keep SSH open before enabling UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full' # If Apache instead: use 'WWW Full'
sudo ufw enable
sudo ufw status
sudo systemctl status bt-panel --no-pager
curl -i http://127.0.0.1:3000/api/health
curl -i https://panel.example.com/api/health
```

The health endpoint should return HTTP 200 and `{"ok":true}` if the database is reachable. A failed database connection returns 500. Then open `https://panel.example.com/register` and create the owner account. With `SEED_DEMO=false`, the first registration is the owner.

## 8. Updates and backups

Back up the DB and preserve the environment file before changing code. For an install made by cloning directly into `/opt/bt-panel`:

```bash
cd /opt/bt-panel
sudo -u btpanel git pull
sudo -u btpanel npm install --no-audit --no-fund
sudo -u btpanel npm run build
sudo systemctl restart bt-panel
sudo -u postgres pg_dump btpanel | sudo tee "/root/bt-panel-$(date +%F).sql" >/dev/null
```

The bundled `deploy/setup-debian.sh` currently rsyncs source while excluding `.git`, which does not match the README's later `git pull` update workflow; review the deployment method before relying on that updater. Also keep a committed npm lockfile for reproducible future installs.
