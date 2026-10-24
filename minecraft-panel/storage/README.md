# storage/

Runtime state for the Minecraft panel. **Nothing here belongs in git.**

| Path | Contents |
|---|---|
| `panel.sqlite` | Panel database: users, sessions, servers, backups, audit log |
| `servers/<slug>/` | One directory per Minecraft server (jar, world, plugins, logs) |
| `backups/` | `.tar.gz` archives created by the panel or `bin/btp backup` |
| `logs/` | `panel.log`, PHP sessions and installer logs |
| `cache/` | Scratch space |

Ownership must match the PHP-FPM user (usually `www` on BT Panel):

```bash
sudo chown -R www:www storage
chmod -R 775 storage
```

Back up `panel.sqlite` and this directory together; restoring only the database
without the server directories loses worlds.
