# Deploying the Minecraft panel on BT Panel (aaPanel / BaoTa)

This panel is a plain PHP 8 application: no Node.js, no build step, no Composer
dependencies. It runs as a normal BT Panel **website** and manages Minecraft
servers directly on the same host.

## 1. Requirements

| Requirement | Notes |
|---|---|
| PHP **8.1+** (8.2/8.3 recommended) | `pdo_sqlite`, `mbstring`, `json`, `openssl`, `curl` (recommended) |
| `proc_open` enabled | Needed to start/stop JVMs, run `tar`, `pgrep`, `tail` |
| `screen` **or** `tmux` | Keeps processes alive after the PHP request ends (`apt install screen`) |
| `tar` | Backups. Falls back to PharData if unavailable |
| Java 17+ / 21+ | Minecraft 1.18+ needs 17+, 1.20.5+ needs 21+ |

Install the system packages on Debian/Ubuntu (BT Panel runs on Debian 11/12
usually):

```bash
sudo apt update
sudo apt install -y screen openjdk-21-jre-headless
java -version
```

## 2. Add the site

1. **BT Panel → Website → Add site**: domain `mc.example.com`, PHP version 8.2,
   no database required.
2. Copy `minecraft-panel/` to `/www/wwwroot/mc.example.com/`.
3. Set **Website directory → Running directory** to `/public`.
   The document root must be `public/`; `config.php`, `storage/` and `app/`
   must never be web-reachable.
4. Fix ownership:

```bash
cd /www/wwwroot/mc.example.com
chown -R www:www .
chmod -R 775 storage
chmod 640 config.php 2>/dev/null || true
```

5. Open `https://mc.example.com/` → the setup wizard checks PHP extensions,
   `proc_open`, Java, screen/tmux and storage permissions, then creates
   `config.php`, the SQLite database and your administrator account.

### PHP settings (BT Panel → Software store → PHP 8.2 → Settings)

* **disable_functions**: remove `proc_open`, `shell_exec`, `exec` (or at least
  `proc_open`). The panel reports this as a blocking requirement.
* **open_basedir**: must include the panel directory *and* `storage/`.
* Upload limits: `upload_max_filesize = 256M`, `post_max_size = 264M` if you
  want large jar/world uploads through the file manager.
* Recommended: `opcache.enable=1`, `expose_php=Off`.

### nginx rewrite (BT Panel does this for you)

BT Panel's site template already routes everything to `index.php` with
`try_files $uri $uri/ /index.php?$query_string;`. If you maintain a custom
config, the required block is:

```nginx
root /www/wwwroot/mc.example.com/public;
index index.php;

location / {
    try_files $uri $uri/ /index.php?$query_string;
}

location ~ \.php$ {
    include fastcgi_params;
    fastcgi_pass unix:/tmp/php-cgi-82.sock;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
}

location ~* ^/(app|storage|docs|tests|bin)/ {
    deny all;
}

location ~ /\.(?!well-known) {
    deny all;
}
```

Alternative if you cannot change the document root: keep the site root at the
project folder and add `location = / { return 302 /public/; }` — but pointing the
document root at `public/` is safer.

## 3. Firewall / ports

Open the Minecraft ports you actually use, in **both** places:

1. BT Panel → **Security (安全)** → add port `25565/tcp` (and each extra server
   port, e.g. `25566`).
2. Your cloud provider's firewall / security group.

RCON (default `25575`) only needs to be reachable from the panel itself
(`127.0.0.1`). **Do not expose RCON to the internet** — the panel talks to it
over loopback.

> **"Wings port" note:** Wings is the Pterodactyl daemon and listens on
> `8080`/`8443`. This panel does **not** use Wings: servers run as local JVMs on
> the BT Panel host, and the only ports involved are the Minecraft game ports and
> loopback RCON. If you also run Pterodactyl on the same machine, you can leave
> Wings untouched; it keeps its own ports and allocations. The two systems do not
> manage each other's servers.

## 3b. Accounts and email

Sign-in, registration and Google OAuth are configured in the panel
(**Settings → Sign-in & email**), not in files. For Google, the authorized
redirect URI must be exactly:

```
https://<your panel domain>/auth/google/callback
```

For password reset mail either install a local MTA (`apt install sendmail` or use
BT Panel's mail server) or — better — add SMTP credentials for Gmail/SES/Mailgun
and press **Send test email**. Step-by-step instructions, including Google Cloud
Console setup and Gmail app passwords: [AUTH-SETUP.md](AUTH-SETUP.md).

If the site is behind a reverse proxy/CDN, set `BTP_TRUST_PROXY=1` in the
PHP-FPM environment so `X-Forwarded-Proto` is honoured when building reset links
and OAuth redirect URIs.

## 4. HTTPS

Enable **SSL → Let's Encrypt** in BT Panel for the site, then set
`'secure_cookies' => true` in `config.php`. The panel also forces
`HttpOnly`, `SameSite=Lax` session cookies and CSRF tokens on every write.

## 5. Process supervision

The panel starts each server inside a detached `screen`/`tmux` session (or
`setsid` as a fallback). BT Panel's PHP-FPM process does not need to stay alive.

Check a running server from SSH:

```bash
sudo -u www php bin/btp servers
sudo -u www php bin/btp doctor
screen -r btpmc-<first-12-chars-of-uuid>   # if the backend is screen
```

Attach commands are shown in the panel under **Server → Overview → SSH attach**.

Do **not** enable BT Panel's "Supervisor"/"PM2" manager for Minecraft servers:
the panel already detaches them and would otherwise start duplicates.

## 6. Backups

See [CRON-BACKUPS.md](CRON-BACKUPS.md). In short: stop the server, run
`php bin/btp backup <server>`, start it again, and schedule that with BT Panel
cron. Include `config.php`, `storage/panel.sqlite` and `storage/backups/` in your
BT Panel site backup.

## 7. Upgrading

1. Stop all servers from the panel (or `php bin/btp stop <server>`).
2. Back up `config.php` and `storage/`.
3. Deploy the new files over the old directory (keep `config.php`, `storage/`).
4. Reload the panel — the schema installer is idempotent and adds missing tables
   on first request.
5. Restart servers.

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Setup says `proc_open` disabled | Remove it from `disable_functions` and restart PHP-FPM. |
| "The server exited immediately" | Open the console tab or `storage/servers/<dir>/logs/console.log`. Usually a Java version mismatch or a corrupt jar. |
| Port already in use | Another server or process owns the port: change the port in Server → Settings (server must be stopped). |
| Console empty but server runs | RCON is disabled or the password differs from `server.properties`. The panel rewrites RCON settings on start; restart the server after changing them in game config. |
| 502 on `/api/...` writes | Check `storage/logs/panel.log`, then verify CSRF: reload the page (tokens live in the PHP session). |
| File manager "permission denied" | `storage/servers` must be writable by the PHP-FPM user (`www`). |
| Java not found | Set an absolute `java_bin` in `config.php` (BT Panel's PHP-FPM PATH can be minimal), e.g. `/usr/lib/jvm/java-21-openjdk-amd64/bin/java`. |

## 9. Security model

* Passwords: `password_hash()` (bcrypt), sessions are opaque tokens stored hashed
  in SQLite, revocable per user.
* Roles: `admin` (all servers, users, settings) and `member` (own servers only).
* Every write requires a CSRF token; cross-site `Origin`/`Referer` is rejected.
* File manager paths are confined to the server directory; traversal and script
  file extensions are rejected.
* `config.php`, `storage/`, `app/` are outside the document root.
* Audit log records every mutating action with user, IP and timestamp.
* Self-registration is switchable; self-service and Google accounts are always
  members. Password reset tokens are stored hashed, single-use and expire in
  60 minutes. Rate limiting covers login, registration, Google and reset.

Run the panel behind HTTPS, keep PHP and Java patched, and give only trusted
people an administrator account.
