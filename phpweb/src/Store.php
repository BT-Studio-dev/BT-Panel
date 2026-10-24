<?php

declare(strict_types=1);

final class Store
{
    public function __construct(private readonly string $file)
    {
        $directory = dirname($this->file);
        if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) {
            throw new RuntimeException('Could not create the PHP web storage directory.');
        }
        if (!is_file($this->file)) {
            $this->update(static fn (array $data): array => $data);
        }
    }

    public function read(): array
    {
        $lock = $this->lock(LOCK_SH);
        try {
            $json = is_file($this->file) ? file_get_contents($this->file) : '';
            if ($json === false) {
                throw new RuntimeException('Could not read the PHP web datastore.');
            }
            return $this->decode($json);
        } finally {
            $this->unlock($lock);
        }
    }

    /** Apply a locked mutation and atomically replace the data file only after a complete write. */
    public function update(callable $mutator): array
    {
        $lock = $this->lock(LOCK_EX);
        $temporary = null;
        try {
            $json = is_file($this->file) ? file_get_contents($this->file) : '';
            if ($json === false) {
                throw new RuntimeException('Could not read the PHP web datastore.');
            }
            $data = $this->decode($json);
            $data = $mutator($data);
            if (!is_array($data)) {
                throw new RuntimeException('A datastore mutation must return an array.');
            }
            $encoded = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            $temporary = $this->file . '.tmp.' . bin2hex(random_bytes(5));
            if (file_put_contents($temporary, $encoded . "\n") === false || !rename($temporary, $this->file)) {
                throw new RuntimeException('Could not replace the PHP web datastore.');
            }
            $temporary = null;
            return $data;
        } finally {
            if ($temporary && is_file($temporary)) {
                unlink($temporary);
            }
            $this->unlock($lock);
        }
    }

    /** @return resource */
    private function lock(int $operation)
    {
        $handle = fopen($this->file . '.lock', 'c+b');
        if ($handle === false || !flock($handle, $operation)) {
            throw new RuntimeException('Could not lock the PHP web datastore.');
        }
        return $handle;
    }

    /** @param resource $handle */
    private function unlock($handle): void
    {
        flock($handle, LOCK_UN);
        fclose($handle);
    }

    private function decode(string $json): array
    {
        if (trim($json) === '') {
            return $this->defaultData();
        }
        $data = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($data)) {
            throw new RuntimeException('The PHP web datastore is invalid.');
        }
        return $data;
    }

    private function defaultData(): array
    {
        $now = gmdate(DATE_ATOM);
        $running = gmdate(DATE_ATOM, time() - 3600);
        return [
            'version' => 1,
            'users' => [
                [
                    'id' => 'usr_admin', 'username' => 'admin', 'email' => 'admin@btpanel.local',
                    'password' => password_hash('btpanel123', PASSWORD_DEFAULT),
                    'role' => 'owner', 'status' => 'active', 'created_at' => $now,
                ],
                [
                    'id' => 'usr_steve', 'username' => 'steve', 'email' => 'steve@btpanel.local',
                    'password' => password_hash('steve12345', PASSWORD_DEFAULT),
                    'role' => 'member', 'status' => 'active', 'created_at' => $now,
                ],
            ],
            'settings' => [
                'panel_name' => 'BT Panel Game',
                'mode' => 'dark',
                'accent' => '#d00000',
                'card_glass' => true,
                'card_theme' => 'auto',
            ],
            'servers' => [
                [
                    'id' => 'srv_minecraft', 'name' => 'Minecraft Survival', 'template' => 'minecraft',
                    'node' => 'eu-fra-01', 'ip' => '10.20.0.10', 'port' => 25565,
                    'status' => 'running', 'started_at' => $running, 'cpu' => 200,
                    'memory' => 4096, 'disk' => 20480, 'owner_id' => 'usr_admin', 'created_at' => $now,
                ],
                [
                    'id' => 'srv_rust', 'name' => 'Rust Community', 'template' => 'rust',
                    'node' => 'us-nyc-02', 'ip' => '10.40.0.10', 'port' => 28015,
                    'status' => 'offline', 'started_at' => null, 'cpu' => 400,
                    'memory' => 8192, 'disk' => 51200, 'owner_id' => 'usr_admin', 'created_at' => $now,
                ],
                [
                    'id' => 'srv_node', 'name' => 'Node API', 'template' => 'nodejs',
                    'node' => 'ap-sgp-01', 'ip' => '10.60.0.10', 'port' => 3000,
                    'status' => 'running', 'started_at' => $running, 'cpu' => 100,
                    'memory' => 1024, 'disk' => 10240, 'owner_id' => 'usr_steve', 'created_at' => $now,
                ],
            ],
            'events' => [
                ['id' => 1, 'server_id' => 'srv_minecraft', 'level' => 'system', 'message' => 'Minecraft Paper is ready on port 25565.', 'created_at' => $running],
                ['id' => 2, 'server_id' => 'srv_rust', 'level' => 'info', 'message' => 'Server is offline.', 'created_at' => $now],
                ['id' => 3, 'server_id' => 'srv_node', 'level' => 'info', 'message' => 'Application started on port 3000.', 'created_at' => $running],
            ],
            'api_keys' => [],
            'next_event_id' => 4,
        ];
    }
}
