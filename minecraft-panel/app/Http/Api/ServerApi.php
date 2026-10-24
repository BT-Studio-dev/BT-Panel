<?php

declare(strict_types=1);

namespace Btp\Http\Api;

use Btp\Http\HttpError;
use Btp\Minecraft\JarInstaller;
use Btp\Minecraft\ServerManager;
use Btp\Support\Audit;
use Btp\Support\Auth;
use Btp\Support\Db;

/**
 * JSON endpoints for server inventory, lifecycle, console and installs.
 */
final class ServerApi
{
    use ApiTrait;

    public function index(): never
    {
        $user = Auth::requireUser();
        $servers = array_map(function (array $server): array {
            return $this->payload($server, $this->servers()->status($server, true));
        }, $this->servers()->listForUser($user));
        btp_json(['servers' => $servers]);
    }

    public function show(array $params): never
    {
        $server = $this->server($params['id']);
        btp_json(['server' => $this->payload($server, $this->servers()->status($server, true))]);
    }

    public function create(): never
    {
        $user = Auth::requireUser();
        $server = $this->servers()->create(btp_json_body(), $user);
        btp_json([
            'server' => $this->payload($server, $this->servers()->status($server)),
            'message' => 'Server created. Install the server files to finish setup.',
        ], 201);
    }

    public function update(array $params): never
    {
        $server = $this->servers()->find($params['id']);
        $this->canManage($server);
        $updated = $this->servers()->update($server, btp_json_body());
        btp_json(['server' => $this->payload($updated, $this->servers()->status($updated, true))]);
    }

    public function delete(array $params): never
    {
        $server = $this->servers()->find($params['id']);
        $this->canManage($server);
        $confirmed = rawurldecode((string) ($_SERVER['HTTP_X_CONFIRM_NAME'] ?? ''));
        if (stripos($server['name'], trim($confirmed)) === false || trim($confirmed) === '') {
            throw new HttpError(428, 'Type the server name in the confirmation dialog to delete it.');
        }
        $this->servers()->delete($server);
        btp_json(['deleted' => true]);
    }

    public function power(array $params): never
    {
        $server = $this->server($params['id']);
        $action = btp_str(btp_json_body(), 'action', '', 16) ?? '';
        $manager = $this->servers();
        $status = match ($action) {
            'start' => $manager->start($server),
            'stop' => $manager->stop($server),
            'restart' => $manager->restart($server),
            'kill' => $manager->kill($server),
            default => throw new HttpError(422, 'Unknown power action.'),
        };
        btp_json(['status' => $status, 'action' => $action]);
    }

    public function install(array $params): never
    {
        $server = $this->server($params['id']);
        $this->canManage($server);
        if ($this->servers()->pid($server) !== null) {
            throw new HttpError(409, 'Stop the server before installing or updating server files.');
        }
        $installer = new JarInstaller();
        $result = $installer->install($server, $this->servers()->dir($server));
        $this->servers()->ensureConfigFiles($this->servers()->find((string) $server['id']));
        Audit::log('server.install', (string) $server['id'], $result['source'] . ' ' . $result['version']);
        btp_json([
            'install' => $result,
            'message' => sprintf('Installed %s %s (%s).', $server['type'], $result['version'], btp_bytes($result['bytes'])),
            'server' => $this->payload($this->servers()->find((string) $server['id']), $this->servers()->status($server)),
        ]);
    }

    public function console(array $params): never
    {
        $server = $this->server($params['id']);
        $since = isset($_GET['since']) ? max(0, (int) $_GET['since']) : 0;
        $chunk = $this->servers()->consoleSince($server, $since);
        btp_json([
            'offset' => $chunk['offset'],
            'data' => $chunk['data'],
            'status' => $this->servers()->status($server, true),
        ]);
    }

    public function command(array $params): never
    {
        $server = $this->server($params['id']);
        $command = btp_str(btp_json_body(), 'command', '', 512) ?? '';
        $reply = $this->servers()->command($server, $command);
        btp_json(['reply' => $reply]);
    }

    public function stats(): never
    {
        $user = Auth::requireUser();
        btp_json(['stats' => $this->servers()->stats($user)]);
    }

    /**
     * Shape sent to the browser: never includes the RCON password.
     *
     * @param array<string,mixed> $server
     * @param array<string,mixed> $status
     * @return array<string,mixed>
     */
    private function payload(array $server, array $status): array
    {
        return [
            'id' => $server['id'],
            'name' => $server['name'],
            'directory' => $server['directory'],
            'type' => $server['type'],
            'version' => $server['version'],
            'port' => $server['port'],
            'rcon_port' => $server['rcon_port'],
            'memory_mb' => $server['memory_mb'],
            'java_flags' => $server['java_flags'],
            'jar' => $server['jar'],
            'owner_id' => $server['owner_id'],
            'owner_email' => $server['owner_email'] ?? null,
            'created_at' => $server['created_at'],
            'updated_at' => $server['updated_at'],
            'status' => $status,
            'has_rcon_password' => (string) $server['rcon_password'] !== '',
        ];
    }
}
