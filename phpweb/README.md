# BT Panel Game — PHP Web Edition

A standalone PHP 8.1+ implementation of the BT Panel Game interface. It uses PHP for routing, authentication, authorization, persistent mutations, and JSON APIs; HTML/CSS for the responsive interface; and vanilla JavaScript for progressive enhancements.

The existing Next.js application is unchanged. This edition is self-contained under `phpweb/` and uses its own locked JSON datastore rather than sharing the Next.js PostgreSQL data.

## Included

- Session sign-in with CSRF protection, rate limiting, secure cookie settings, and `password_hash()` / `password_verify()`.
- Overview, server/port allocation, power controls, console commands, Minecraft Paper, game templates, and application templates.
- Admin Control Center: Overview, Activity, Settings, Users, Locations, Nodes, Server, Database Hosts, Mounts, Eggs, Tags, Extensions, and API Keys.
- Persistent base theme, Card Glass On/Off, and Auto/Hidden/Off White/Dark card themes.
- User creation, roles, suspension, deletion, and account password changes.
- API keys with random one-time secrets, SHA-256 hashes at rest, expiration, usage timestamps, and revocation.
- Bearer JSON API for overview, servers, activity, nodes, templates, settings, power actions, and API-key management.
- File locking and atomic writes. Storage is outside the public web root.

## Run locally

Requirements: PHP 8.1 or newer with the standard session, JSON, and OpenSSL-related randomness support enabled. No Composer packages or database server are required.

```bash
cd phpweb
php -S 0.0.0.0:8000 -t public
```

Open `http://localhost:8000`.

Demo accounts:

- Owner: `admin` / `btpanel123`
- Member: `steve` / `steve12345`

Runtime data is created at `phpweb/storage/panel.json` and is ignored by Git. Delete that file only when you intentionally want to reset the standalone PHP demo.

## API example

Create a key in **Admin Control Center → API Keys**, copy its one-time secret, then call:

```bash
curl -H "Authorization: Bearer btp_your_secret" \
  http://localhost:8000/api.php?resource=servers
```

Power action:

```bash
curl -X POST \
  -H "Authorization: Bearer btp_your_secret" \
  -H "Content-Type: application/json" \
  -d '{"server_id":"srv_minecraft","action":"restart"}' \
  http://localhost:8000/api.php?resource=power
```

## Production notes

- Serve only `phpweb/public/` as the document root. Never expose `phpweb/storage/` or `phpweb/src/`.
- Use HTTPS so session cookies and API secrets are protected in transit.
- Ensure the PHP worker can write to `phpweb/storage/` with permissions restricted to that worker.
- Back up `panel.json` if the data matters. For multi-worker or multi-node deployments, replace the JSON store with a transactional database.
- Wings ports and mounts are catalog configuration. Server power, console output, and telemetry are simulations; connect the actions to a real daemon before managing actual infrastructure.
