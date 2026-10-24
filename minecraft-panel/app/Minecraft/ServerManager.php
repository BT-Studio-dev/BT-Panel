<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;
use Btp\Support\Audit;
use Btp\Support\Auth;
use Btp\Support\Db;
use Btp\Support\Path;

/**
 * Server lifecycle: creation, configuration, start/stop, console and status.
 *
 * Each server is a directory under `data_dir` containing the jar, world and
 * server.properties. A running server is identified by a unique JVM marker
 * (`-Dbtp.server=<uuid>`), which makes status detection independent of the
 * supervisor backend.
 */
final class ServerManager
{
    public const STATES = ['running', 'stopped', 'starting', 'unknown'];

    public function __construct(private readonly ?ProcessBackend $backend = null)
    {
    }

    private function backend(): ProcessBackend
    {
        return $this->backend ?? BackendFactory::make();
    }

    /* ------------------------------------------------------------------ */
    /* Records                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * @return list<array<string,mixed>>
     */
    public function listForUser(array $user): array
    {
        $sql = 'SELECT s.*, u.email AS owner_email FROM servers s LEFT JOIN users u ON u.id = s.owner_id';
        $params = [];
        if (!Auth::isAdmin($user)) {
            $sql .= ' WHERE s.owner_id = :uid OR s.id IN (SELECT server_id FROM server_users WHERE user_id = :uid)';
            $params['uid'] = (int) $user['id'];
        }
        $sql .= ' ORDER BY s.name COLLATE NOCASE';
        return array_map([$this, 'hydrate'], Db::all($sql, $params));
    }

    /**
     * @return array<string,mixed>
     */
    public function find(string $id): array
    {
        if (!btp_is_uuid($id)) {
            throw new HttpError(404, 'Server not found.');
        }
        $row = Db::one('SELECT * FROM servers WHERE id = :id', ['id' => $id]);
        if ($row === null) {
            throw new HttpError(404, 'Server not found.');
        }
        return $this->hydrate($row);
    }

    /**
     * @return array<string,mixed>
     */
    public function findForUser(array $user, string $id): array
    {
        $server = $this->find($id);
        if (!Auth::canAccessServer($user, $id)) {
            throw new HttpError(403, 'You do not have access to this server.');
        }
        return $server;
    }

    /**
     * @param array<string,mixed> $row
     * @return array<string,mixed>
     */
    private function hydrate(array $row): array
    {
        foreach (['port', 'rcon_port', 'memory_mb', 'owner_id'] as $key) {
            $row[$key] = (int) $row[$key];
        }
        $row['directory'] = (string) $row['directory'];
        $row['session'] = $this->sessionName((string) $row['id']);
        $row['work_dir'] = $this->dir($row);
        $row['rcon_enabled'] = $row['rcon_port'] > 0 && (string) $row['rcon_password'] !== '';
        return $row;
    }

    public function sessionName(string $id): string
    {
        return 'btpmc-' . substr(str_replace('-', '', $id), 0, 12);
    }

    /**
     * @param array<string,mixed> $server
     */
    public function dir(array $server): string
    {
        $root = (string) btp_config()['data_dir'];
        $directory = (string) $server['directory'];
        if ($directory === '' || !preg_match('/^[a-z0-9][a-z0-9-]*$/', $directory)) {
            throw new HttpError(500, 'Server directory is not configured correctly.');
        }
        return $root . '/' . $directory;
    }

    /**
     * @param array<string,mixed> $server
     */
    public function logFile(array $server): string
    {
        return $this->dir($server) . '/logs/console.log';
    }

    /* ------------------------------------------------------------------ */
    /* Create / update / delete                                            */
    /* ------------------------------------------------------------------ */

    /**
     * @param array<string,mixed> $input
     * @param array<string,mixed> $actor
     * @return array<string,mixed>
     */
    public function create(array $input, array $actor): array
    {
        $name = btp_str($input, 'name', '', 64) ?? '';
        if ($name === '' || mb_strlen($name) < 2) {
            throw new HttpError(422, 'Server name must be at least 2 characters.');
        }
        $type = btp_str($input, 'type', 'vanilla', 16) ?? 'vanilla';
        if (!in_array($type, JarInstaller::TYPES, true)) {
            throw new HttpError(422, 'Choose vanilla, paper, purpur or custom.');
        }
        $version = btp_str($input, 'version', 'latest', 32) ?? 'latest';
        $memory = btp_int($input, 'memory_mb', (int) btp_config()['default_memory_mb'], 512, 65536);
        $requestedPort = btp_int($input, 'port', 25565, 1024, 65535);

        if (!btp_bool($input, 'accept_eula')) {
            throw new HttpError(422, 'You must accept the Minecraft EULA to create a server.');
        }

        $id = $this->uuid();
        $directory = $this->uniqueDirectory($name);
        $port = $this->allocatePort($requestedPort, 'port');
        $rconPort = $this->allocatePort(max(25575, $port + 10), 'rcon_port', $port);

        $now = gmdate('c');
        Db::insert('servers', [
            'id' => $id,
            'name' => $name,
            'directory' => $directory,
            'type' => $type,
            'version' => $version,
            'port' => $port,
            'rcon_port' => $rconPort,
            'rcon_password' => btp_token(18),
            'memory_mb' => $memory,
            'java_flags' => btp_str($input, 'java_flags', '', 400) ?? '',
            'jar' => 'server.jar',
            'owner_id' => (int) $actor['id'],
            'status' => 'stopped',
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $server = $this->find($id);
        Path::ensureDir($this->dir($server) . '/logs');
        $this->writeConfigFiles($server, $name);

        Audit::log('server.create', $id, sprintf('%s (%s, port %d)', $name, $type, $port));
        return $server;
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public function update(array $server, array $input): array
    {
        $id = (string) $server['id'];
        $changes = [];

        if (array_key_exists('name', $input)) {
            $name = btp_str($input, 'name', '', 64) ?? '';
            if (mb_strlen($name) < 2) {
                throw new HttpError(422, 'Server name must be at least 2 characters.');
            }
            $changes['name'] = $name;
        }
        if (array_key_exists('memory_mb', $input)) {
            $changes['memory_mb'] = btp_int($input, 'memory_mb', $server['memory_mb'], 512, 65536);
        }
        if (array_key_exists('java_flags', $input)) {
            $changes['java_flags'] = btp_str($input, 'java_flags', '', 400) ?? '';
        }
        if (array_key_exists('port', $input)) {
            $port = btp_int($input, 'port', $server['port'], 1024, 65535);
            if ($port !== $server['port']) {
                $this->assertStopped($server, 'change the port');
                $changes['port'] = $this->allocatePort($port, 'port');
            }
        }
        if (array_key_exists('version', $input)) {
            $changes['version'] = btp_str($input, 'version', 'latest', 32) ?? 'latest';
        }
        if (array_key_exists('type', $input)) {
            $type = btp_str($input, 'type', 'vanilla', 16) ?? 'vanilla';
            if (!in_array($type, JarInstaller::TYPES, true)) {
                throw new HttpError(422, 'Unknown server type.');
            }
            $changes['type'] = $type;
        }
        if (array_key_exists('rcon_password', $input)) {
            $password = btp_str($input, 'rcon_password', '', 64) ?? '';
            if ($password !== '' && mb_strlen($password) < 8) {
                throw new HttpError(422, 'RCON password must be at least 8 characters.');
            }
            $changes['rcon_password'] = $password === '' ? btp_token(18) : $password;
        }

        if ($changes === []) {
            return $server;
        }
        $changes['updated_at'] = gmdate('c');
        Db::update('servers', $changes, 'id = :id', ['id' => $id]);
        $updated = $this->find($id);

        // Keep server.properties in step with managed settings.
        $this->syncProperties($updated, $changes);
        Audit::log('server.update', $id, implode(', ', array_keys($changes)));
        return $updated;
    }

    public function delete(array $server): void
    {
        $id = (string) $server['id'];
        try {
            $this->kill($server);
        } catch (\Throwable) {
            // Best effort: a dead server must still be removable.
        }
        $dir = $this->dir($server);
        Path::deleteTree($dir);

        $backups = Db::all('SELECT file FROM backups WHERE server_id = :id', ['id' => $id]);
        foreach ($backups as $backup) {
            $path = rtrim((string) btp_config()['backup_dir'], '/') . '/' . basename((string) $backup['file']);
            if (is_file($path)) {
                @unlink($path);
            }
        }
        Db::run('DELETE FROM backups WHERE server_id = :id', ['id' => $id]);
        Db::run('DELETE FROM servers WHERE id = :id', ['id' => $id]);
        Audit::log('server.delete', $id, (string) $server['name']);
    }

    /* ------------------------------------------------------------------ */
    /* Status                                                              */
    /* ------------------------------------------------------------------ */

    /**
     * @param array<string,mixed> $server
     * @return array<string,mixed>
     */
    public function status(array $server, bool $withPlayers = false): array
    {
        $pid = $this->pid($server);
        $running = $pid !== null;
        $status = [
            'state' => $running ? 'running' : 'stopped',
            'pid' => $pid,
            'uptime' => 0,
            'memory_bytes' => 0,
            'players' => null,
            'players_max' => null,
            'players_online' => null,
            'rcon_reachable' => false,
            'backend' => $this->backend()->name(),
            'attach_command' => $running ? $this->backend()->attachCommand($server['session']) : null,
            'console_available' => $running && $server['rcon_enabled'],
        ];

        if ($running) {
            $status['uptime'] = $this->uptime($pid);
            $status['memory_bytes'] = $this->memoryUsage($pid);
            if ($withPlayers && $server['rcon_enabled']) {
                try {
                    $reply = Rcon::execute('127.0.0.1', (int) $server['rcon_port'], (string) $server['rcon_password'], 'list', 2.0);
                    $status['rcon_reachable'] = true;
                    if (preg_match('/There are (\d+) of a max(?: of)? (\d+) players online(?::\s*(.*))?/i', $reply, $m)) {
                        $status['players_online'] = (int) $m[1];
                        $status['players_max'] = (int) $m[2];
                        $list = array_values(array_filter(array_map('trim', explode(',', (string) ($m[3] ?? '')))));
                        $status['players'] = $list;
                    } else {
                        $status['players'] = [];
                    }
                } catch (\Throwable) {
                    $status['rcon_reachable'] = false;
                }
            }
        }

        return $status;
    }

    /**
     * @param array<string,mixed> $server
     */
    public function pid(array $server): ?int
    {
        $marker = 'btp.server=' . $server['id'];
        $output = ProcessRunner::capture(['pgrep', '-f', '--', $marker], 5);
        if ($output === null || $output === '') {
            return null;
        }
        foreach (preg_split('/\s+/', $output) ?: [] as $candidate) {
            $pid = (int) $candidate;
            if ($pid <= 0) {
                continue;
            }
            // Confirm the marker is in this process' command line (guards
            // against pgrep matching unrelated command lines).
            $cmdline = @file_get_contents('/proc/' . $pid . '/cmdline');
            if (is_string($cmdline) && str_contains($cmdline, $marker)) {
                return $pid;
            }
        }
        return null;
    }

    private function uptime(int $pid): int
    {
        $value = ProcessRunner::capture(['ps', '-o', 'etimes=', '-p', (string) $pid], 5);
        return $value !== null ? max(0, (int) trim($value)) : 0;
    }

    private function memoryUsage(int $pid): int
    {
        $status = @file_get_contents('/proc/' . $pid . '/status');
        if (is_string($status) && preg_match('/^VmRSS:\s+(\d+) kB/m', $status, $m)) {
            return (int) $m[1] * 1024;
        }
        $value = ProcessRunner::capture(['ps', '-o', 'rss=', '-p', (string) $pid], 5);
        return $value !== null ? (int) trim($value) * 1024 : 0;
    }

    /* ------------------------------------------------------------------ */
    /* Lifecycle                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * @param array<string,mixed> $server
     * @return array<string,mixed>
     */
    public function start(array $server): array
    {
        if ($this->pid($server) !== null) {
            throw new HttpError(409, 'Server is already running.');
        }
        $dir = $this->dir($server);
        $jar = $dir . '/' . basename((string) $server['jar']);
        if (!is_file($jar)) {
            throw new HttpError(409, 'Server files are not installed yet. Run "Install server files" first.');
        }
        if (!$this->isPortFree((int) $server['port'])) {
            throw new HttpError(409, sprintf('Port %d is already in use on this host.', $server['port']));
        }

        $this->ensureConfigFiles($server);
        $backend = $this->backend();
        $session = (string) $server['session'];
        $backend->stopSession($session); // clear a stale session with the same name

        $java = $this->resolveJava();
        $logFile = $this->logFile($server);
        Path::ensureDir(dirname($logFile));
        $this->rotateLog($logFile);

        $argv = $this->buildJavaCommand($server, $java, $jar);
        $backend->start($dir, $argv, $logFile, $session);

        // Give the JVM a moment; a crash-on-startup should surface immediately.
        $pid = null;
        for ($i = 0; $i < 12; $i++) {
            usleep(250000);
            $pid = $this->pid($server);
            if ($pid !== null) {
                break;
            }
        }
        if ($pid === null) {
            $tail = implode("\n", array_slice($this->consoleLines($server, 12), 0));
            $backend->stopSession($session);
            throw new HttpError(500, "The server exited immediately.\n" . ($tail !== '' ? $tail : 'No output was captured.'));
        }

        Db::run('UPDATE servers SET status = :status, updated_at = :now WHERE id = :id', [
            'status' => 'running',
            'now' => gmdate('c'),
            'id' => $server['id'],
        ]);
        Audit::log('server.start', (string) $server['id'], 'pid ' . $pid);
        return $this->status($this->find((string) $server['id']), true);
    }

    /**
     * Graceful stop: console `stop` → SIGTERM → SIGKILL.
     *
     * @param array<string,mixed> $server
     * @return array<string,mixed>
     */
    public function stop(array $server, int $graceSeconds = 30): array
    {
        $pid = $this->pid($server);
        if ($pid === null) {
            $this->backend()->stopSession((string) $server['session']);
            Db::run('UPDATE servers SET status = :status, updated_at = :now WHERE id = :id', [
                'status' => 'stopped',
                'now' => gmdate('c'),
                'id' => $server['id'],
            ]);
            return $this->status($this->find((string) $server['id']));
        }

        $graceful = false;
        if ($server['rcon_enabled']) {
            try {
                Rcon::execute('127.0.0.1', (int) $server['rcon_port'], (string) $server['rcon_password'], 'stop', 3.0);
                $graceful = true;
            } catch (\Throwable) {
                $graceful = false;
            }
        }

        $deadline = time() + ($graceful ? $graceSeconds : 15);
        while (time() < $deadline) {
            usleep(400000);
            if ($this->pid($server) === null) {
                break;
            }
        }

        if ($this->pid($server) !== null) {
            $this->signal($pid, 15); // SIGTERM: lets the JVM run shutdown hooks.
            $deadline = time() + 10;
            while (time() < $deadline && $this->pid($server) !== null) {
                usleep(300000);
            }
        }

        if ($this->pid($server) !== null) {
            $this->signal($pid, 9);
            usleep(400000);
        }

        $this->backend()->stopSession((string) $server['session']);
        Db::run('UPDATE servers SET status = :status, updated_at = :now WHERE id = :id', [
            'status' => 'stopped',
            'now' => gmdate('c'),
            'id' => $server['id'],
        ]);
        Audit::log('server.stop', (string) $server['id'], $graceful ? 'graceful' : 'signal');
        return $this->status($this->find((string) $server['id']));
    }

    /**
     * @param array<string,mixed> $server
     */
    public function restart(array $server): array
    {
        if ($this->pid($server) !== null) {
            $this->stop($server);
        }
        return $this->start($this->find((string) $server['id']));
    }

    /**
     * @param array<string,mixed> $server
     */
    public function kill(array $server): array
    {
        $pid = $this->pid($server);
        if ($pid !== null) {
            $this->signal($pid, 9);
            for ($i = 0; $i < 20; $i++) {
                usleep(200000);
                if ($this->pid($server) === null) {
                    break;
                }
            }
        }
        $this->backend()->stopSession((string) $server['session']);
        Db::run('UPDATE servers SET status = :status, updated_at = :now WHERE id = :id', [
            'status' => 'stopped',
            'now' => gmdate('c'),
            'id' => $server['id'],
        ]);
        Audit::log('server.kill', (string) $server['id'], 'SIGKILL');
        return $this->status($this->find((string) $server['id']));
    }

    private function signal(int $pid, int $signal): void
    {
        if (function_exists('posix_kill')) {
            @posix_kill($pid, $signal);
            return;
        }
        ProcessRunner::run(['kill', '-' . $signal, (string) $pid], null, 5);
    }

    /**
     * @param array<string,mixed> $server
     */
    private function assertStopped(array $server, string $action): void
    {
        if ($this->pid($server) !== null) {
            throw new HttpError(409, sprintf('Stop the server before you %s.', $action));
        }
    }

    /* ------------------------------------------------------------------ */
    /* Console                                                             */
    /* ------------------------------------------------------------------ */

    /**
     * Send a command to the live console via RCON.
     *
     * @param array<string,mixed> $server
     */
    public function command(array $server, string $command): string
    {
        $command = trim($command);
        if ($command === '') {
            throw new HttpError(422, 'Command cannot be empty.');
        }
        if (mb_strlen($command) > 512) {
            throw new HttpError(422, 'Command is too long.');
        }
        if (str_contains($command, "\n") || str_contains($command, "\r")) {
            throw new HttpError(422, 'Only single-line commands are allowed.');
        }
        if ($this->pid($server) === null) {
            throw new HttpError(409, 'The server is not running.');
        }
        if (!$server['rcon_enabled']) {
            throw new HttpError(409, 'RCON is disabled for this server. Enable it in settings and restart.');
        }
        $reply = Rcon::execute('127.0.0.1', (int) $server['rcon_port'], (string) $server['rcon_password'], $command, 6.0);
        Audit::log('server.command', (string) $server['id'], $command);
        return $reply;
    }

    /**
     * Last N lines of the console log, newest last.
     *
     * @param array<string,mixed> $server
     * @return list<string>
     */
    public function consoleLines(array $server, int $lines = 200): array
    {
        $file = $this->logFile($server);
        if (!is_file($file)) {
            return [];
        }
        $lines = max(1, min(2000, $lines));
        $tail = ProcessRunner::capture(['tail', '-n', (string) $lines, $file], 5);
        if ($tail === null) {
            // Pure-PHP fallback: read the last 256 KB.
            $handle = fopen($file, 'rb');
            if ($handle === false) {
                return [];
            }
            $size = (int) filesize($file);
            fseek($handle, max(0, $size - 262144));
            $tail = (string) stream_get_contents($handle);
            fclose($handle);
        }
        $result = preg_split("/\r?\n/", (string) $tail) ?: [];
        return array_values(array_map(
            static fn (string $line): string => preg_replace('/\x1b\[[0-9;]*m/', '', $line) ?? $line,
            $result,
        ));
    }

    /**
     * Byte offset helper so the browser only transfers new console output.
     *
     * @param array<string,mixed> $server
     */
    public function consoleSize(array $server): int
    {
        $file = $this->logFile($server);
        return is_file($file) ? (int) filesize($file) : 0;
    }

    /**
     * @param array<string,mixed> $server
     */
    public function consoleSince(array $server, int $offset): array
    {
        $file = $this->logFile($server);
        if (!is_file($file)) {
            return ['offset' => 0, 'data' => ''];
        }
        $size = (int) filesize($file);
        $offset = max(0, min($offset, $size));
        if ($offset === $size) {
            return ['offset' => $size, 'data' => ''];
        }
        if ($size - $offset > 262144) {
            $offset = $size - 262144; // never return more than 256 KB at once
        }
        $handle = fopen($file, 'rb');
        if ($handle === false) {
            return ['offset' => $offset, 'data' => ''];
        }
        fseek($handle, $offset);
        $data = (string) stream_get_contents($handle);
        fclose($handle);
        return ['offset' => $size, 'data' => $data];
    }

    /* ------------------------------------------------------------------ */
    /* Files & configuration                                               */
    /* ------------------------------------------------------------------ */

    /**
     * @param array<string,mixed> $server
     */
    public function ensureConfigFiles(array $server): void
    {
        $dir = $this->dir($server);
        Path::ensureDir($dir . '/logs');
        $eula = $dir . '/eula.txt';
        if (!is_file($eula)) {
            file_put_contents($eula, "# Accepted through BT Minecraft Panel\neula=true\n");
        }
        $properties = $dir . '/server.properties';
        if (!is_file($properties)) {
            $this->writeConfigFiles($server, (string) $server['name']);
            return;
        }
        // Always keep the managed ports and RCON credentials authoritative.
        $this->setProperties($properties, [
            'server-port' => (string) $server['port'],
            'enable-rcon' => 'true',
            'rcon.port' => (string) $server['rcon_port'],
            'rcon.password' => (string) $server['rcon_password'],
        ]);
    }

    /**
     * @param array<string,mixed> $server
     */
    public function writeConfigFiles(array $server, string $motd): void
    {
        $dir = $this->dir($server);
        Path::ensureDir($dir . '/logs');
        $eula = $dir . '/eula.txt';
        file_put_contents($eula, "# Accepted through BT Minecraft Panel on " . gmdate('c') . "\neula=true\n");

        $safeMotd = preg_replace('/[\r\n]+/', ' ', $motd) ?? 'Minecraft';
        $properties = $dir . '/server.properties';
        if (!is_file($properties)) {
            $template = <<<PROPS
            # Minecraft server properties — managed by BT Minecraft Panel.
            # Values written here are the server defaults; in-game changes are preserved
            # except for the port, RCON port and RCON password, which the panel owns.
            server-port={$server['port']}
            server-ip=
            enable-rcon=true
            rcon.port={$server['rcon_port']}
            rcon.password={$server['rcon_password']}
            broadcast-rcon-to-ops=true
            motd={$safeMotd}
            max-players=20
            online-mode=true
            difficulty=easy
            gamemode=survival
            pvp=true
            view-distance=10
            simulation-distance=10
            spawn-protection=16
            white-list=false
            enforce-whitelist=false
            enable-command-block=true
            PROPS;
            file_put_contents($properties, str_replace('            ', '', $template));
        } else {
            $this->setProperties($properties, [
                'server-port' => (string) $server['port'],
                'enable-rcon' => 'true',
                'rcon.port' => (string) $server['rcon_port'],
                'rcon.password' => (string) $server['rcon_password'],
            ]);
        }
    }

    /**
     * Rewrite selected keys in a properties file, preserving the rest.
     *
     * @param array<string,string> $values
     */
    public function setProperties(string $file, array $values): void
    {
        $lines = is_file($file) ? (file($file, FILE_IGNORE_NEW_LINES) ?: []) : [];
        $seen = [];
        foreach ($lines as $index => $line) {
            if (!preg_match('/^\s*([^#=:\s]+)\s*[=:]/', $line, $m)) {
                continue;
            }
            $key = $m[1];
            if (array_key_exists($key, $values)) {
                $lines[$index] = $key . '=' . preg_replace('/[\r\n]+/', '', $values[$key]);
                $seen[$key] = true;
            }
        }
        foreach ($values as $key => $value) {
            if (!isset($seen[$key])) {
                $lines[] = $key . '=' . preg_replace('/[\r\n]+/', '', $value);
            }
        }
        file_put_contents($file, implode("\n", $lines) . "\n");
    }

    /**
     * @param array<string,mixed> $server
     * @param array<string,mixed> $changes
     */
    private function syncProperties(array $server, array $changes): void
    {
        $properties = $this->dir($server) . '/server.properties';
        if (!is_file($properties)) {
            return;
        }
        $values = [];
        if (isset($changes['port'])) {
            $values['server-port'] = (string) $server['port'];
        }
        if (isset($changes['rcon_password'])) {
            $values['rcon.password'] = (string) $server['rcon_password'];
        }
        if ($values !== []) {
            $this->setProperties($properties, $values);
        }
    }

    /* ------------------------------------------------------------------ */
    /* Java & process helpers                                              */
    /* ------------------------------------------------------------------ */

    public function resolveJava(): string
    {
        $configured = (string) (btp_config()['java_bin'] ?? 'java');
        if (!ProcessRunner::commandExists($configured)) {
            throw new HttpError(500, sprintf(
                'Java was not found ("%s"). Install a JDK (17+ for Minecraft 1.18+, 21+ for 1.20.5+) and set the absolute path in config.php.',
                $configured,
            ));
        }
        return $configured;
    }

    /**
     * @param array<string,mixed> $server
     * @return list<string>
     */
    private function buildJavaCommand(array $server, string $java, string $jar): array
    {
        $memory = (int) $server['memory_mb'];
        $argv = [
            $java,
            '-Xms' . $memory . 'M',
            '-Xmx' . $memory . 'M',
            '-XX:+UseG1GC',
            '-Dbtp.server=' . $server['id'],
            '-Dbtp.server.name=' . preg_replace('/[^A-Za-z0-9]+/', '-', (string) $server['name']),
        ];
        $extra = trim((string) btp_config()['default_java_flags'] . ' ' . (string) $server['java_flags']);
        if ($extra !== '') {
            foreach (preg_split('/\s+/', $extra) ?: [] as $flag) {
                if ($flag === '') {
                    continue;
                }
                if (!preg_match('#^[A-Za-z0-9_.\-=:+/]+$#', $flag)) {
                    throw new HttpError(422, 'Invalid JVM flag: ' . $flag);
                }
                $argv[] = $flag;
            }
        }
        $argv[] = '-jar';
        $argv[] = $jar;
        $argv[] = 'nogui';
        return $argv;
    }

    public function isPortFree(int $port): bool
    {
        $socket = @stream_socket_server('tcp://0.0.0.0:' . $port, $errno, $errstr);
        if (is_resource($socket)) {
            fclose($socket);
            return true;
        }
        return false;
    }

    private function allocatePort(int $preferred, string $column, ?int $avoid = null): int
    {
        for ($port = $preferred; $port <= 65535 && $port < $preferred + 100; $port++) {
            if ($avoid !== null && $port === $avoid) {
                continue;
            }
            $inUse = Db::scalar(
                sprintf('SELECT 1 FROM servers WHERE %s = :port', $column),
                ['port' => $port],
            ) !== null;
            if (!$inUse && $this->isPortFree($port)) {
                return $port;
            }
        }
        throw new HttpError(409, 'No free port available near ' . $preferred . '. Choose a different port.');
    }

    public function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }

    private function uniqueDirectory(string $name): string
    {
        $base = btp_slug($name, 24);
        for ($i = 0; $i < 25; $i++) {
            $candidate = $base . '-' . strtolower(bin2hex(random_bytes(2)));
            $exists = Db::scalar('SELECT 1 FROM servers WHERE directory = :dir', ['dir' => $candidate]) !== null;
            if (!$exists && !is_dir((string) btp_config()['data_dir'] . '/' . $candidate)) {
                return $candidate;
            }
        }
        throw new HttpError(500, 'Unable to allocate a server directory.');
    }

    private function rotateLog(string $file): void
    {
        if (!is_file($file)) {
            return;
        }
        if (filesize($file) > 20 * 1024 * 1024) {
            @rename($file, $file . '.1');
        }
    }

    /**
     * Panel-wide summary for the dashboard.
     *
     * @return array<string,mixed>
     */
    public function stats(array $user): array
    {
        $servers = $this->listForUser($user);
        $running = 0;
        $memory = 0;
        $disk = 0;
        foreach ($servers as $server) {
            $status = $this->status($server);
            if ($status['state'] === 'running') {
                $running++;
                $memory += (int) $status['memory_bytes'];
            }
            $disk += Path::dirSize($this->dir($server));
        }
        $cfg = btp_config();
        return [
            'servers' => count($servers),
            'running' => $running,
            'memory_bytes' => $memory,
            'disk_bytes' => $disk,
            'backups' => (int) Db::scalar(
                Auth::isAdmin($user)
                    ? 'SELECT COUNT(*) FROM backups'
                    : 'SELECT COUNT(*) FROM backups b JOIN servers s ON s.id = b.server_id WHERE s.owner_id = :uid',
                Auth::isAdmin($user) ? [] : ['uid' => (int) $user['id']],
            ),
            'java' => $this->javaVersion(),
            'backend' => $this->backend()->name(),
            'free_disk_bytes' => (int) @disk_free_space((string) $cfg['data_dir']),
            'users' => Auth::isAdmin($user) ? Auth::countUsers() : null,
        ];
    }

    public function javaVersion(): ?string
    {
        try {
            $java = $this->resolveJava();
        } catch (\Throwable) {
            return null;
        }
        $result = ProcessRunner::run([$java, '-version'], null, 10);
        $output = trim($result['stderr'] . "\n" . $result['stdout']);
        if (preg_match('/version "([^"]+)"/', $output, $m)) {
            return $m[1];
        }
        return $output !== '' ? mb_substr($output, 0, 120) : null;
    }
}
