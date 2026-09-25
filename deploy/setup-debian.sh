#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# BT Panel — one-shot installer for a fresh Debian 12/13 VPS.
#
#   sudo bash deploy/setup-debian.sh panel.example.com
#
# Installs Node.js 22, PostgreSQL, nginx and certbot; creates the database and
# a system user; builds the panel and starts it under systemd behind nginx.
# Safe to re-run: every step skips work that is already done.
# ---------------------------------------------------------------------------
set -euo pipefail

DOMAIN="${1:-$(hostname -f 2>/dev/null || echo localhost)}"
APP_DIR=/opt/bt-panel
APP_USER=btpanel
DB_NAME=btpanel
DB_USER=btpanel
PORT="${PORT:-3000}"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

[[ $EUID -eq 0 ]] || { echo "Run as root:  sudo bash deploy/setup-debian.sh $DOMAIN"; exit 1; }
[[ -f "$SRC_DIR/src/app/page.tsx" ]] || { echo "Run this from the panel source (deploy/ inside the project)."; exit 1; }

export DEBIAN_FRONTEND=noninteractive

echo "==> [1/7] System packages"
apt-get update -y -qq
apt-get install -y -qq curl ca-certificates gnupg openssl git rsync postgresql nginx certbot python3-certbot-nginx

echo "==> [2/7] Node.js 22"
if ! command -v node >/dev/null 2>&1 || (( $(node -p 'process.versions.node.split(".")[0]') < 20 )); then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
echo "    node $(node -v), npm $(npm -v)"

echo "==> [3/7] System user and application files ($APP_DIR)"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
rsync -a --delete --exclude node_modules --exclude .next --exclude .env --exclude .git "$SRC_DIR/" "$APP_DIR/"

echo "==> [4/7] PostgreSQL database"
systemctl enable --now postgresql >/dev/null 2>&1 || service postgresql start
DB_PASS="$(openssl rand -hex 18)"
sudo -u postgres psql -tAc "select 1 from pg_roles where rolname='$DB_USER'" | grep -q 1 \
  || sudo -u postgres psql -qc "create user $DB_USER with password '$DB_PASS';"
sudo -u postgres psql -tAc "select 1 from pg_database where datname='$DB_NAME'" | grep -q 1 \
  || sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"

if [[ ! -f "$APP_DIR/.env" ]]; then
  cat > "$APP_DIR/.env" <<EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
SEED_DEMO=false
COOKIE_SECURE=true
PORT=$PORT
EOF
fi
chown "$APP_USER" "$APP_DIR/.env" && chmod 600 "$APP_DIR/.env"

echo "==> [5/7] Install and build (needs ~2 GB RAM; add swap on small VPS)"
cd "$APP_DIR"
if (( $(node -p 'process.memoryLimit < 2e9 ? 0 : 1') )); then :; fi
sudo -u "$APP_USER" npm ci --no-audit --no-fund
sudo -u "$APP_USER" NODE_OPTIONS=--max-old-space-size=1536 npm run build

echo "==> [6/7] systemd service"
cp "$SRC_DIR/deploy/bt-panel.service" /etc/systemd/system/bt-panel.service
systemctl daemon-reload
systemctl enable --now bt-panel

echo "==> [7/7] nginx + HTTPS for $DOMAIN"
sed "s/panel.example.com/$DOMAIN/g" "$SRC_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/bt-panel.conf
ln -sf /etc/nginx/sites-available/bt-panel.conf /etc/nginx/sites-enabled/bt-panel.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null 2>&1 && systemctl reload nginx

if [[ "$DOMAIN" != "localhost" ]] && getent hosts "$DOMAIN" >/dev/null 2>&1; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || \
    echo "    certbot failed - run it again once DNS points here: certbot --nginx -d $DOMAIN"
else
  echo "    (no DNS yet - run later for HTTPS: certbot --nginx -d $DOMAIN)"
fi

echo
echo "============================================================"
echo " BT Panel is live:  https://$DOMAIN"
echo "   app dir   : $APP_DIR"
echo "   service   : systemctl status bt-panel"
echo "   logs      : journalctl -u bt-panel -f"
echo "   config    : $APP_DIR/.env"
echo
echo " First visit: open /register - the first account becomes owner."
echo "============================================================"
