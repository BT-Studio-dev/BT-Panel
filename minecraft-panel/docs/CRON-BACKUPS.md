# Scheduled backups with BT Panel cron

The panel writes archives to `storage/backups/`. Schedule them from
**BT Panel → Cron (计划任务)** or plain `cron`, as the same user PHP-FPM runs as
(`www` on BT Panel / `www-data` on Debian).

## Recommended: stop → backup → start

Minecraft writes the world continuously. Copying a live directory can produce a
torn region file, so the panel refuses to back up a running server. The
`backup` command therefore only succeeds when the server is stopped.

Two safe patterns:

### 1. Maintenance window (simple, consistent)

```bash
#!/bin/sh
set -eu
cd /www/wwwroot/mc.example.com/minecraft-panel

sudo -u www php bin/btp stop survival-smp
sudo -u www php bin/btp backup survival-smp
sudo -u www php bin/btp start survival-smp
```

BT Panel cron task, once per night:

```
0 4 * * * /www/wwwroot/mc.example.com/minecraft-panel/bin/nightly-backup.sh >/dev/null 2>&1
```

Tie it to a restart announcement first (from the panel console):

```
say Server restarting for the nightly backup in 60 seconds
```

### 2. Copy while running, archive afterwards

If you cannot stop the server, take a filesystem snapshot (ZFS/btrfs/LVM) or
`rsync` the world to a staging folder, then back up the copy with an external
tool. The panel's archive step intentionally requires a stopped server.

## Retention

`btp backup --all` keeps every archive. Add a small retention step to your cron
script, for example keep 14 days:

```bash
find /www/wwwroot/mc.example.com/minecraft-panel/storage/backups -name '*.tar.gz' -mtime +14 -delete
```

Backups are owned by the PHP-FPM user; do not run cleanup as root without
matching ownership or future backups may fail.

## Off-site copies

`storage/backups` is outside the web root and is not served by nginx. Copy it
with BT Panel's site backup, `rsync`, or an object-storage CLI:

```bash
rsync -a --delete storage/backups/ backup-host:/srv/minecraft-backups/
```

Do not add `storage/` or `config.php` to git.
