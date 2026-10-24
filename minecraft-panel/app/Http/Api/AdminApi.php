<?php

declare(strict_types=1);

namespace Btp\Http\Api;

use Btp\Http\HttpError;
use Btp\Minecraft\BackendFactory;
use Btp\Minecraft\ProcessRunner;
use Btp\Minecraft\ServerManager;
use Btp\Support\Audit;
use Btp\Support\Auth;
use Btp\Support\Db;

/**
 * User administration, panel settings, activity log and account password.
 */
final class AdminApi
{
    /**
     * @return list<array<string,mixed>>
     */
    public function users(): never
    {
        Auth::requireAdmin();
        $rows = Db::all(
            'SELECT u.id, u.email, u.name, u.role, u.created_at, u.last_login_at,
                    (SELECT COUNT(*) FROM servers s WHERE s.owner_id = u.id) AS server_count
             FROM users u ORDER BY u.id',
        );
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['server_count'] = (int) $row['server_count'];
        }
        btp_json(['users' => $rows]);
    }

    public function createUser(): never
    {
        Auth::requireAdmin();
        $body = btp_json_body();
        $email = btp_str($body, 'email', '', 190) ?? '';
        $password = (string) ($body['password'] ?? '');
        $name = btp_str($body, 'name', '', 120) ?? '';
        $role = btp_str($body, 'role', 'member', 10) ?? 'member';
        $user = Auth::createUser($email, $password, $name, $role);
        Audit::log('user.create', null, $email . ' (' . $role . ')');
        btp_json(['user' => $user], 201);
    }

    public function updateUser(array $params): never
    {
        $admin = Auth::requireAdmin();
        $id = (int) $params['id'];
        $target = Db::one('SELECT * FROM users WHERE id = :id', ['id' => $id]);
        if ($target === null) {
            throw new HttpError(404, 'User not found.');
        }
        $body = btp_json_body();
        $changes = [];

        if (array_key_exists('role', $body)) {
            $role = btp_str($body, 'role', 'member', 10) ?? 'member';
            if (!in_array($role, ['admin', 'member'], true)) {
                throw new HttpError(422, 'Unknown role.');
            }
            if ($role === 'member' && $target['role'] === 'admin' && Auth::countAdmins() <= 1) {
                throw new HttpError(409, 'The panel needs at least one administrator.');
            }
            if ($id === (int) $admin['id'] && $role !== 'admin') {
                throw new HttpError(409, 'You cannot remove your own administrator role.');
            }
            $changes['role'] = $role;
        }
        if (array_key_exists('name', $body)) {
            $changes['name'] = btp_str($body, 'name', (string) $target['name'], 120) ?? '';
        }
        if (array_key_exists('password', $body)) {
            $password = (string) $body['password'];
            if (mb_strlen($password) < 10) {
                throw new HttpError(422, 'Password must be at least 10 characters.');
            }
            $changes['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
            Db::run('DELETE FROM sessions WHERE user_id = :id', ['id' => $id]);
        }
        if ($changes !== []) {
            Db::update('users', $changes, 'id = :id', ['id' => $id]);
            Audit::log('user.update', null, (string) $target['email'] . ' → ' . implode(', ', array_keys($changes)));
        }
        btp_json(['updated' => true]);
    }

    public function deleteUser(array $params): never
    {
        $admin = Auth::requireAdmin();
        $id = (int) $params['id'];
        if ($id === (int) $admin['id']) {
            throw new HttpError(409, 'You cannot delete your own account.');
        }
        $target = Db::one('SELECT * FROM users WHERE id = :id', ['id' => $id]);
        if ($target === null) {
            throw new HttpError(404, 'User not found.');
        }
        if ($target['role'] === 'admin' && Auth::countAdmins() <= 1) {
            throw new HttpError(409, 'The panel needs at least one administrator.');
        }
        $servers = Db::all('SELECT id FROM servers WHERE owner_id = :id', ['id' => $id]);
        foreach ($servers as $server) {
            Db::run('UPDATE servers SET owner_id = :admin WHERE id = :id', [
                'admin' => (int) $admin['id'],
                'id' => $server['id'],
            ]);
        }
        Db::run('DELETE FROM users WHERE id = :id', ['id' => $id]);
        Audit::log('user.delete', null, (string) $target['email']);
        btp_json(['deleted' => true, 'reassigned_servers' => count($servers)]);
    }

    /**
     * Panel settings plus read-only environment information.
     */
    public function settings(): never
    {
        Auth::requireAdmin();
        $config = btp_config();
        $manager = new ServerManager();
        btp_json([
            'settings' => [
                'panel_name' => Db::setting('panel_name', (string) $config['panel_name']),
                'default_memory_mb' => (int) Db::setting('default_memory_mb', (string) $config['default_memory_mb']),
                'timezone' => (string) $config['timezone'],
            ],
            'environment' => [
                'php' => PHP_VERSION,
                'backend' => BackendFactory::make()->name(),
                'java' => $manager->javaVersion(),
                'java_bin' => (string) $config['java_bin'],
                'process_backend' => BackendFactory::make()->name(),
                'screen' => ProcessRunner::commandExists((string) $config['screen_bin']),
                'tmux' => ProcessRunner::commandExists((string) $config['tmux_bin']),
                'tar' => ProcessRunner::commandExists('tar'),
                'data_dir' => (string) $config['data_dir'],
                'backup_dir' => (string) $config['backup_dir'],
                'free_disk' => (int) @disk_free_space((string) $config['data_dir']),
                'total_disk' => (int) @disk_total_space((string) $config['data_dir']),
                'secure_cookies' => (bool) $config['secure_cookies'],
                'installed_at' => Db::setting('installed_at'),
            ],
        ]);
    }

    public function updateSettings(): never
    {
        Auth::requireAdmin();
        $body = btp_json_body();
        if (array_key_exists('panel_name', $body)) {
            $name = btp_str($body, 'panel_name', 'BT Minecraft Panel', 60) ?? 'BT Minecraft Panel';
            Db::setSetting('panel_name', $name);
        }
        if (array_key_exists('default_memory_mb', $body)) {
            $memory = btp_int($body, 'default_memory_mb', 2048, 512, 65536);
            Db::setSetting('default_memory_mb', (string) $memory);
        }
        Audit::log('settings.update', null, implode(', ', array_keys($body)));
        btp_json(['saved' => true]);
    }

    public function activity(): never
    {
        Auth::requireAdmin();
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
        btp_json(['activity' => Audit::recent($limit)]);
    }

    public function changePassword(): never
    {
        $user = Auth::requireUser();
        $body = btp_json_body();
        $current = (string) ($body['current_password'] ?? '');
        $next = (string) ($body['new_password'] ?? '');
        if (mb_strlen($next) < 10) {
            throw new HttpError(422, 'The new password must be at least 10 characters.');
        }
        $row = Db::one('SELECT password_hash FROM users WHERE id = :id', ['id' => (int) $user['id']]);
        if ($row === null || !password_verify($current, (string) $row['password_hash'])) {
            throw new HttpError(403, 'Your current password is incorrect.');
        }
        Db::run('UPDATE users SET password_hash = :hash WHERE id = :id', [
            'hash' => password_hash($next, PASSWORD_DEFAULT),
            'id' => (int) $user['id'],
        ]);
        Db::run('DELETE FROM sessions WHERE user_id = :id AND token_hash != :keep', [
            'id' => (int) $user['id'],
            'keep' => hash('sha256', (string) ($_COOKIE[Auth::COOKIE] ?? '')),
        ]);
        Audit::log('account.password', null, (string) $user['email']);
        btp_json(['saved' => true]);
    }
}
