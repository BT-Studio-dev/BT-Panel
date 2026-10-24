# Pterodactyl 1.x integration

BT Panel's server-side adapter calls an existing Pterodactyl Panel API. It does not run Wings itself. Install and configure Pterodactyl and Wings separately before enabling this integration.

## Environment

Copy `.env.example` to `.env` and configure:

- `PTERODACTYL_URL`: the Pterodactyl origin only, for example `https://ptero.example.com`.
- `PTERODACTYL_APPLICATION_TOKEN`: an Application API token for the Pterodactyl 1.x panel. It is used for node/server inventory and provisioning.
- `PTERODACTYL_CLIENT_TOKEN`: a Client API token whose Pterodactyl user has access to the servers to be monitored or controlled.

Keep both tokens only on the BT Panel server. Never put them in a NEXT_PUBLIC variable, browser storage, a client component, or source control. The application token has elevated privileges: give it only to a trusted server-side BT Panel deployment. Use HTTPS for a remote Pterodactyl origin.

The Client API token's permissions remain in force. The application token's inventory does not grant the Client API token access to every listed server. Use a dedicated Pterodactyl user/API token with deliberate access to the server fleet, or extend the adapter with a suitable approved server-side permissions design.

Restart BT Panel after editing its environment file.

## Endpoints added to BT Panel

All of these routes require a BT Panel owner/admin session; they are not a replacement for Pterodactyl's own authorization.

| Method | BT Panel route | Token used | Purpose |
|---|---|---|---|
| GET | `/api/integrations/pterodactyl/status` | none upstream | Show configuration presence without exposing tokens |
| GET | `/api/integrations/pterodactyl/nodes?page=1&per_page=50` | Application | Paginated Pterodactyl nodes |
| GET | `/api/integrations/pterodactyl/servers?page=1&per_page=25` | Application | Paginated Pterodactyl server inventory |
| POST | `/api/integrations/pterodactyl/servers` | Application | Create a real Pterodactyl server |
| GET | `/api/integrations/pterodactyl/client-servers` | Client | Servers visible to the Client API token |
| GET | `/api/integrations/pterodactyl/servers/{identifier}/resources` | Client | Live resources for an authorized server |
| POST | `/api/integrations/pterodactyl/servers/{identifier}/power` | Client | Send start/stop/restart/kill signal |
| GET | `/api/integrations/pterodactyl/servers/{identifier}/allocations` | Client | List the server's real IP/port allocations |
| POST | `/api/integrations/pterodactyl/servers/{identifier}/allocations` | Client | Assign a port, set the primary allocation, or update notes |
| DELETE | `/api/integrations/pterodactyl/servers/{identifier}/allocations` | Client | Remove a non-primary allocation |
| GET | `/api/integrations/pterodactyl/servers/{identifier}/files?directory=/` | Client | List a remote directory |
| GET | `/api/integrations/pterodactyl/servers/{identifier}/files?file=/path` | Client | Read a remote text file (up to 1 MB) |
| POST | `/api/integrations/pterodactyl/servers/{identifier}/files` | Client | Write, copy, rename, create a folder, or delete remote files |

The adapter lives at `src/lib/server/pterodactyl.ts`. API route handlers are in `src/app/api/integrations/pterodactyl/`. Tokens are never returned by these routes.

## Wings nodes and connection ports

The **Nodes & Wings** workspace displays each node's FQDN, scheme, Wings daemon port, SFTP port, data directory, maintenance state, and allocated memory/disk. These values come from the Pterodactyl Application API; an **Active** badge means the node is not in maintenance mode, not that BT Panel has performed a separate Wings health check.

BT Panel does not install Wings, change its `config.yml`, or open firewall ports. Configure and secure the Wings daemon and SFTP ports in Pterodactyl/Wings itself. Game and application connection ports are separate node allocations.

The **Network & ports** tab for a client-accessible server can:

- assign an available allocation from the server's node;
- copy a connection address in `host:port` form;
- make a non-primary allocation primary;
- edit allocation notes; and
- remove a non-primary allocation.

Assigning a port can fail when the node has no free allocations or the Client API user lacks allocation permissions. Add free allocations in the Pterodactyl admin area first. These operations change the real remote server.

Allocation requests use a small BT Panel action body:

```json
{ "action": "create" }
```

```json
{ "action": "primary", "allocation": 17 }
```

```json
{ "action": "notes", "allocation": 17, "notes": "Query port" }
```

To remove allocation `17`, send a DELETE request with `{ "allocation": 17 }`. All routes still require an admin session and the normal BT Panel CSRF header.

## Remote file management

The **Files** tab lists the live filesystem visible through Pterodactyl. It supports directory navigation, creating files/folders, editing UTF-8 text files up to 1 MB, copying a file within its current directory, renaming items, and confirmed deletion. Pterodactyl/Wings remains responsible for filesystem isolation and permissions.

File mutations use `POST /api/integrations/pterodactyl/servers/{identifier}/files` with one of these action bodies:

```json
{ "action": "write", "file": "/config/example.yml", "content": "enabled: true\n" }
```

```json
{ "action": "copy", "location": "/config/example.yml" }
```

```json
{ "action": "create-folder", "root": "/config", "name": "archive" }
```

```json
{ "action": "rename", "root": "/config", "files": [{ "from": "example.yml", "to": "production.yml" }] }
```

```json
{ "action": "delete", "root": "/config", "files": ["production.yml"] }
```

Paths must be absolute, cannot contain parent-directory (`..`) segments, and are limited to 1024 characters. Individual filenames are limited to 255 characters. Write/content bodies are limited to 1 MB. Delete is permanent and may recursively remove a folder through Wings; the UI requires confirmation.

## Minecraft Java Edition configuration

The **Minecraft** tab reads and writes the real `/server.properties` through the same authenticated file API. It provides fields for MOTD, player limits, game mode, difficulty, view/simulation distance, spawn protection, PvP, whitelist, online mode, server port, GameSpy query, and RCON. Unknown properties, comments, existing key order, and line endings are preserved; missing exposed keys are appended only when the administrator saves.

The connection card shows the primary Pterodactyl allocation and can copy its `host:port` address. If `server-port` differs from the primary allocation, the UI shows a warning and offers to apply the allocated port to the form. Saving does not modify allocations and does not restart Minecraft: review the change, save, then use **Overview → Restart** when ready.

**Copy config** invokes the real Pterodactyl file-copy operation for `/server.properties`, creating a copy in the server root. It does not overwrite the active configuration. The Minecraft form deliberately does not display or edit the RCON password; use the full file editor for sensitive advanced settings and restrict RCON access to trusted networks.

This tool expects a Java Edition `server.properties` file in the server root. It does not generate a missing file, install Minecraft, select an egg, or manage Bedrock/plugin-specific configuration.

## Create a real server

`POST /api/integrations/pterodactyl/servers` accepts the Pterodactyl 1.x Application API create-server body. You must supply IDs that exist in your own Pterodactyl installation. This is a destructive/capacity-allocating action and is restricted to BT Panel admins.

Example request body:

```json
{
  "name": "Minecraft test",
  "user": 1,
  "egg": 1,
  "docker_image": "ghcr.io/pterodactyl/yolks:java_21",
  "startup": "java -Xms128M -XX:MaxRAMPercentage=95.0 -jar {{SERVER_JARFILE}}",
  "environment": {
    "SERVER_JARFILE": "server.jar",
    "MINECRAFT_VERSION": "latest"
  },
  "limits": {
    "memory": 4096,
    "swap": 0,
    "disk": 20480,
    "io": 500,
    "cpu": 200
  },
  "feature_limits": {
    "databases": 0,
    "allocations": 0,
    "backups": 1
  },
  "allocation": {
    "default": 17
  }
}
```

The IDs above are examples only. Match the egg's required environment variables, Docker image, startup command, limits, and a free allocation from your Pterodactyl panel. Review the official [Pterodactyl 1.x create-server reference](https://docs.pterodactyl.io/v1/api/application-servers/post-create-server) before provisioning in production.

## Node.js: list nodes

```js
const base = process.env.BT_PANEL_URL;
const btPanelToken = process.env.BT_PANEL_SESSION_TOKEN; // Keep private.
const response = await fetch(new URL("/api/integrations/pterodactyl/nodes", base), {
  headers: { Authorization: `Bearer ${btPanelToken}`, Accept: "application/json" },
});
if (!response.ok) throw new Error(`BT Panel API failed: ${response.status}`);
const nodes = await response.json();
console.log(nodes.data.map(({ attributes }) => ({
  id: attributes.id,
  name: attributes.name,
  memoryMb: attributes.memory,
  diskMb: attributes.disk,
})));
```

The BT Panel API requires an authenticated BT Panel owner/admin session. The integration is not a public API: do not hard-code a session token or share it in examples, issue reports, or browser bundles.

## Python: resources and power actions

```python
import os
import requests

base = os.environ["BT_PANEL_URL"].rstrip("/")
bt_session = os.environ["BT_PANEL_SESSION_TOKEN"]
server_identifier = os.environ["PTERO_SERVER_IDENTIFIER"]

session = requests.Session()
session.headers.update({
    "Authorization": f"Bearer {bt_session}",
    "Accept": "application/json",
    "Content-Type": "application/json",
    "x-btp-csrf": "1",
})

def check(response):
    response.raise_for_status()
    return response.json() if response.content else None

resources = check(session.get(
    f"{base}/api/integrations/pterodactyl/servers/{server_identifier}/resources",
    timeout=20,
))
print(resources)

# A real server power action. Use a valid identifier visible to the configured
# Pterodactyl Client API token. This is not the simulated BT Panel power route.
check(session.post(
    f"{base}/api/integrations/pterodactyl/servers/{server_identifier}/power",
    json={"action": "start"},
    timeout=20,
))
```

These examples expect a valid BT Panel session token. The backend then uses its configured Pterodactyl tokens to call the upstream API. Never pass Pterodactyl API keys from the browser.

## Troubleshooting

- **503 integration not configured:** set `PTERODACTYL_URL` and the token needed for that operation, then restart BT Panel.
- **502 rejected token/permissions:** create a token for the correct Pterodactyl API type and grant the necessary permissions.
- **Client-server resources/power denied:** the Client API token's owner must be allowed to access that server.
- **Node list empty or fails:** check that the Application API key can read nodes, and use a Pterodactyl 1.x URL.
- **TLS errors:** use a valid TLS certificate. Remote plain-HTTP Pterodactyl URLs are intentionally rejected.
- **Provisioning validation errors:** use real numeric user, egg and allocation IDs, and supply the environment variables required by the selected egg.

## Current limitations

- The integration targets the Pterodactyl **1.x** API schema; it is not a Pterodactyl 2.0 API adapter.
- Application API node inventory and Client API-accessible servers remain separate upstream collections. A server visible in the Application API is not necessarily controllable with the configured Client API token.
- Existing local BT Panel server records, power states, telemetry and backup records are not automatically imported or converted into real Pterodactyl servers.
- Real resources, power, allocation, and file operations require a functioning remote panel and an appropriately scoped Client API token. BT Panel does not bypass Pterodactyl user permissions.
- The built-in editor is intended for text files up to 1 MB; it is not a binary upload/download or archive manager.
- The integration reads Wings node connection settings but does not change Wings configuration, verify daemon health, or manage host firewall rules.
- Create-server requests allocate infrastructure on the remote panel. Use the UI only when you intend to create an actual server.
