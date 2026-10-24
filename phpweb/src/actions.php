<?php

declare(strict_types=1);

function finish_action(string $message, string $type = 'success'): never
{
    flash($type, $message);
    redirect(post_return_query());
}

function handle_web_action(Store $store): void
{
    verify_csrf();
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'login') {
        $now = time();
        $lockedUntil = (int) ($_SESSION['login_locked_until'] ?? 0);
        if ($lockedUntil > $now) {
            throw new RuntimeException('Too many attempts. Try again in ' . ($lockedUntil - $now) . ' seconds.');
        }
        $identifier = strtolower(trim((string) ($_POST['identifier'] ?? '')));
        $password = (string) ($_POST['password'] ?? '');
        $data = $store->read();
        $found = null;
        foreach ($data['users'] as $user) {
            if (strtolower($user['username']) === $identifier || strtolower($user['email']) === $identifier) {
                $found = $user;
                break;
            }
        }
        if (!$found || !password_verify($password, $found['password']) || $found['status'] !== 'active') {
            $attempts = (int) ($_SESSION['login_attempts'] ?? 0) + 1;
            $_SESSION['login_attempts'] = $attempts;
            if ($attempts >= 5) {
                $_SESSION['login_locked_until'] = $now + 30;
                $_SESSION['login_attempts'] = 0;
            }
            throw new RuntimeException('Invalid username or password, or the account is suspended.');
        }
        unset($_SESSION['login_attempts'], $_SESSION['login_locked_until']);
        session_regenerate_id(true);
        $_SESSION['user_id'] = $found['id'];
        redirect('section=home');
    }

    $data = $store->read();
    $user = current_user($data);
    if (!$user) {
        throw new RuntimeException('Sign in before using the panel.');
    }

    if ($action === 'logout') {
        $_SESSION = [];
        session_destroy();
        redirect();
    }

    if ($action === 'power') {
        $id = (string) $_POST['server_id'];
        $power = (string) $_POST['power'];
        $server = find_server($data, $id);
        if (!$server || !can_manage_server($user, $server)) {
            throw new RuntimeException('Server not found or permission denied.');
        }
        if (!in_array($power, ['start', 'stop', 'restart', 'kill'], true)) {
            throw new RuntimeException('Unknown power action.');
        }
        $store->update(static function (array $next) use ($id, $power): array {
            foreach ($next['servers'] as &$server) {
                if ($server['id'] !== $id) continue;
                if ($power === 'start' && $server['status'] === 'running') throw new RuntimeException('Server is already running.');
                if (in_array($power, ['stop', 'kill'], true) && $server['status'] === 'offline') throw new RuntimeException('Server is already offline.');
                $server['status'] = in_array($power, ['start', 'restart'], true) ? 'running' : 'offline';
                $server['started_at'] = $server['status'] === 'running' ? gmdate(DATE_ATOM) : null;
                add_event($next, $id, 'system', match ($power) {
                    'start' => 'Server started.',
                    'stop' => 'Server stopped.',
                    'restart' => 'Server restarted.',
                    'kill' => 'Server was force-killed.',
                });
                break;
            }
            unset($server);
            return $next;
        });
        finish_action('Power action applied: ' . $power . '.');
    }

    if ($action === 'create_server') {
        $name = trim((string) ($_POST['name'] ?? ''));
        $templateId = (string) ($_POST['template'] ?? 'minecraft');
        $nodeId = (string) ($_POST['node'] ?? 'eu-fra-01');
        $templates = panel_templates();
        $nodes = panel_nodes();
        if (strlen($name) < 2 || strlen($name) > 60) throw new RuntimeException('Server name must be 2–60 characters.');
        if (!isset($templates[$templateId], $nodes[$nodeId])) throw new RuntimeException('Choose a valid template and node.');
        $cpu = (int) ($_POST['cpu'] ?? 200);
        $memory = (int) ($_POST['memory'] ?? 4096);
        $disk = (int) ($_POST['disk'] ?? 20480);
        if (!in_array($cpu, [100, 200, 400, 800], true)) throw new RuntimeException('Invalid CPU limit.');
        if (!in_array($memory, [1024, 2048, 4096, 8192, 16384], true)) throw new RuntimeException('Invalid memory allocation.');
        if (!in_array($disk, [10240, 20480, 51200, 102400], true)) throw new RuntimeException('Invalid disk allocation.');
        $id = new_id('srv');
        $store->update(static function (array $next) use ($name, $templateId, $nodeId, $cpu, $memory, $disk, $user, $templates, $nodes, $id): array {
            $port = (int) $templates[$templateId]['port'];
            $usedPorts = array_map(static fn (array $server): int => (int) $server['port'], $next['servers']);
            while (in_array($port, $usedPorts, true) && $port < 65535) $port++;
            if (in_array($port, $usedPorts, true)) throw new RuntimeException('No primary port is available.');
            $nodeCount = count(array_filter($next['servers'], static fn (array $server): bool => $server['node'] === $nodeId));
            $next['servers'][] = [
                'id' => $id, 'name' => $name, 'template' => $templateId, 'node' => $nodeId,
                'ip' => $nodes[$nodeId]['subnet'] . (10 + ($nodeCount % 240)), 'port' => $port,
                'status' => 'offline', 'started_at' => null, 'cpu' => $cpu, 'memory' => $memory,
                'disk' => $disk, 'owner_id' => $user['id'], 'created_at' => gmdate(DATE_ATOM),
            ];
            add_event($next, $id, 'system', 'Server created with primary port ' . $port . '.');
            return $next;
        });
        finish_action($name . ' created.');
    }

    if ($action === 'delete_server') {
        $id = (string) $_POST['server_id'];
        $server = find_server($data, $id);
        if (!$server || !can_manage_server($user, $server)) throw new RuntimeException('Server not found or permission denied.');
        $store->update(static function (array $next) use ($id): array {
            $next['servers'] = array_values(array_filter($next['servers'], static fn (array $server): bool => $server['id'] !== $id));
            $next['events'] = array_values(array_filter($next['events'], static fn (array $event): bool => $event['server_id'] !== $id));
            return $next;
        });
        finish_action($server['name'] . ' deleted.', 'success');
    }

    if ($action === 'command') {
        $id = (string) $_POST['server_id'];
        $command = trim((string) ($_POST['command'] ?? ''));
        $server = find_server($data, $id);
        if (!$server || !can_manage_server($user, $server)) throw new RuntimeException('Server not found or permission denied.');
        if ($server['status'] !== 'running') throw new RuntimeException('Start the server before using its console.');
        if ($command === '' || strlen($command) > 200) throw new RuntimeException('Enter a command up to 200 characters.');
        $store->update(static function (array $next) use ($id, $command): array {
            add_event($next, $id, 'cmd', '> ' . $command);
            [$head] = explode(' ', strtolower($command), 2);
            [$level, $reply] = match ($head) {
                'help' => ['info', 'Commands: help, list, status, tps, save-all, version'],
                'list' => ['info', 'There are 0 players online.'],
                'status' => ['info', 'Server is healthy.'],
                'tps' => ['info', 'TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0'],
                'save-all' => ['info', 'World save completed.'],
                'version' => ['info', 'BT Panel PHP web daemon simulation v1.0'],
                default => ['warn', 'Unknown command. Type "help" for available commands.'],
            };
            add_event($next, $id, $level, $reply);
            return $next;
        });
        finish_action('Command sent.');
    }

    if ($action === 'save_settings') {
        require_admin($user);
        $name = trim((string) ($_POST['panel_name'] ?? ''));
        $mode = (string) ($_POST['mode'] ?? 'dark');
        $cardTheme = (string) ($_POST['card_theme'] ?? 'auto');
        $accent = strtolower((string) ($_POST['accent'] ?? '#d00000'));
        if ($name === '' || strlen($name) > 40) throw new RuntimeException('Panel name must be 1–40 characters.');
        if (!in_array($mode, ['dark', 'light'], true)) throw new RuntimeException('Invalid base theme.');
        if (!in_array($cardTheme, ['auto', 'hidden', 'off-white', 'dark'], true)) throw new RuntimeException('Invalid card theme.');
        if (!preg_match('/^#[0-9a-f]{6}$/', $accent)) throw new RuntimeException('Accent must be a six-digit hex color.');
        $glass = isset($_POST['card_glass']);
        $store->update(static function (array $next) use ($name, $mode, $cardTheme, $accent, $glass): array {
            $next['settings'] = array_merge($next['settings'], [
                'panel_name' => $name, 'mode' => $mode, 'card_theme' => $cardTheme,
                'accent' => $accent, 'card_glass' => $glass,
            ]);
            return $next;
        });
        finish_action('Appearance settings saved.');
    }

    if ($action === 'create_user') {
        require_admin($user);
        $username = trim((string) ($_POST['username'] ?? ''));
        $email = strtolower(trim((string) ($_POST['email'] ?? '')));
        $password = (string) ($_POST['password'] ?? '');
        $role = (string) ($_POST['role'] ?? 'member');
        if (!preg_match('/^[a-zA-Z0-9_.-]{3,24}$/', $username)) throw new RuntimeException('Username must be 3–24 letters, numbers, dots, dashes, or underscores.');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Enter a valid email address.');
        if (strlen($password) < 8 || strlen($password) > 128) throw new RuntimeException('Password must be 8–128 characters.');
        if (!in_array($role, ['member', 'admin'], true) || ($role === 'admin' && $user['role'] !== 'owner')) throw new RuntimeException('Invalid role or owner permission required.');
        $store->update(static function (array $next) use ($username, $email, $password, $role): array {
            foreach ($next['users'] as $existing) {
                if (strtolower($existing['username']) === strtolower($username) || strtolower($existing['email']) === $email) {
                    throw new RuntimeException('Username or email already exists.');
                }
            }
            $next['users'][] = [
                'id' => new_id('usr'), 'username' => $username, 'email' => $email,
                'password' => password_hash($password, PASSWORD_DEFAULT), 'role' => $role,
                'status' => 'active', 'created_at' => gmdate(DATE_ATOM),
            ];
            return $next;
        });
        finish_action($username . ' created.');
    }

    if (in_array($action, ['toggle_user', 'delete_user'], true)) {
        require_admin($user);
        $id = (string) $_POST['user_id'];
        $target = find_user($data, $id);
        if (!$target || $target['id'] === $user['id'] || $target['role'] === 'owner' || ($target['role'] === 'admin' && $user['role'] !== 'owner')) {
            throw new RuntimeException('This account cannot be changed by your role.');
        }
        $store->update(static function (array $next) use ($id, $action): array {
            if ($action === 'delete_user') {
                $next['users'] = array_values(array_filter($next['users'], static fn (array $user): bool => $user['id'] !== $id));
                $next['api_keys'] = array_values(array_filter($next['api_keys'], static fn (array $key): bool => $key['user_id'] !== $id));
                foreach ($next['servers'] as &$server) if ($server['owner_id'] === $id) $server['owner_id'] = null;
                unset($server);
            } else {
                foreach ($next['users'] as &$existing) {
                    if ($existing['id'] === $id) $existing['status'] = $existing['status'] === 'active' ? 'suspended' : 'active';
                }
                unset($existing);
            }
            return $next;
        });
        finish_action($action === 'delete_user' ? 'User deleted.' : 'User status updated.');
    }

    if ($action === 'save_profile') {
        $email = strtolower(trim((string) ($_POST['email'] ?? '')));
        $current = (string) ($_POST['current_password'] ?? '');
        $password = (string) ($_POST['new_password'] ?? '');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) throw new RuntimeException('Enter a valid email address.');
        if ($password !== '' && (strlen($password) < 8 || strlen($password) > 128)) throw new RuntimeException('New password must be 8–128 characters.');
        if ($password !== '' && !password_verify($current, $user['password'])) throw new RuntimeException('Current password is incorrect.');
        $store->update(static function (array $next) use ($user, $email, $password): array {
            foreach ($next['users'] as $existing) {
                if ($existing['id'] !== $user['id'] && strtolower($existing['email']) === $email) throw new RuntimeException('Email already exists.');
            }
            foreach ($next['users'] as &$existing) {
                if ($existing['id'] !== $user['id']) continue;
                $existing['email'] = $email;
                if ($password !== '') $existing['password'] = password_hash($password, PASSWORD_DEFAULT);
            }
            unset($existing);
            return $next;
        });
        finish_action('Account updated.');
    }

    if ($action === 'create_api_key') {
        require_admin($user);
        $name = trim((string) ($_POST['name'] ?? ''));
        $days = (int) ($_POST['expires_in_days'] ?? 0);
        if (strlen($name) < 2 || strlen($name) > 60) throw new RuntimeException('Key name must be 2–60 characters.');
        if (!in_array($days, [0, 7, 30, 90, 365], true)) throw new RuntimeException('Choose a supported expiration.');
        $secret = 'btp_' . bin2hex(random_bytes(24));
        $store->update(static function (array $next) use ($user, $name, $days, $secret): array {
            $next['api_keys'][] = [
                'id' => new_id('key'), 'user_id' => $user['id'], 'name' => $name,
                'prefix' => substr($secret, 0, 12), 'token_hash' => hash('sha256', $secret),
                'created_at' => gmdate(DATE_ATOM), 'last_used_at' => null,
                'expires_at' => $days ? gmdate(DATE_ATOM, time() + $days * 86400) : null,
            ];
            return $next;
        });
        $_SESSION['new_api_key'] = ['name' => $name, 'secret' => $secret];
        finish_action('API key created. Copy the one-time secret now.');
    }

    if ($action === 'revoke_api_key') {
        require_admin($user);
        $id = (string) $_POST['key_id'];
        $store->update(static function (array $next) use ($id): array {
            $next['api_keys'] = array_values(array_filter($next['api_keys'], static fn (array $key): bool => $key['id'] !== $id));
            return $next;
        });
        finish_action('API key revoked.');
    }

    throw new RuntimeException('Unknown panel action.');
}
