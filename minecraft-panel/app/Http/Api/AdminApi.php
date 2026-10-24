<?php

declare(strict_types=1);

namespace Btp\Http\Api;

use Btp\Http\HttpError;
use Btp\Minecraft\BackendFactory;
use Btp\Minecraft\ProcessRunner;
use Btp\Minecraft\ServerManager;
use Btp\Support\Audit;
use Btp\Support\Auth;
use Btp\Support\GoogleAuth;
use Btp\Support\Mailer;
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
                    CASE WHEN u.google_id IS NULL THEN 0 ELSE 1 END AS google_linked,
                    (SELECT COUNT(*) FROM servers s WHERE s.owner_id = u.id) AS server_count
             FROM users u ORDER BY u.id',
        );
        foreach ($rows as &$row) {
            $row['id'] = (int) $row['id'];
            $row['server_count'] = (int) $row['server_count'];
            $row['google_linked'] = (bool) $row['google_linked'];
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
            // Invalidate outstanding reset links for this account.
            Db::run('UPDATE password_resets SET used_at = :now WHERE user_id = :id AND used_at IS NULL', [
                'now' => gmdate('c'),
                'id' => $id,
            ]);
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
        $changed = [];
        if (array_key_exists('panel_name', $body)) {
            $name = btp_str($body, 'panel_name', 'BT Minecraft Panel', 60) ?? 'BT Minecraft Panel';
            Db::setSetting('panel_name', $name);
            $changed[] = 'panel_name';
        }
        if (array_key_exists('default_memory_mb', $body)) {
            $memory = btp_int($body, 'default_memory_mb', 2048, 512, 65536);
            Db::setSetting('default_memory_mb', (string) $memory);
            $changed[] = 'default_memory_mb';
        }
        if (array_key_exists('allow_registration', $body)) {
            Db::setSetting('allow_registration', btp_bool($body, 'allow_registration') ? '1' : '0');
            $changed[] = 'allow_registration';
        }
        Audit::log('settings.update', null, implode(', ', $changed));
        btp_json(['saved' => true]);
    }

    /**
     * Save Google OAuth / mail credentials. Empty secret fields keep the value
     * already stored, so the form can be re-saved without re-typing secrets.
     */
    public function updateAuth(): never
    {
        Auth::requireAdmin();
        $body = btp_json_body();

        if (array_key_exists('google_client_id', $body)) {
            $clientId = btp_str($body, 'google_client_id', '', 255) ?? '';
            if ($clientId !== '' && !str_ends_with($clientId, '.apps.googleusercontent.com')) {
                throw new HttpError(422, 'Google client IDs end with .apps.googleusercontent.com');
            }
            Db::setSetting('google_client_id', $clientId);
        }
        $secret = btp_str($body, 'google_client_secret', '', 255) ?? '';
        if ($secret !== '') {
            Db::setSetting('google_client_secret', $secret);
        }
        if (array_key_exists('google_redirect_uri', $body)) {
            $redirect = btp_str($body, 'google_redirect_uri', '', 255) ?? '';
            if ($redirect !== '' && !preg_match('#^https?://[^\s]+$#', $redirect)) {
                throw new HttpError(422, 'The redirect URI must be an absolute http(s) URL.');
            }
            Db::setSetting('google_redirect_uri', $redirect);
        }
        if (array_key_exists('google_allowed_domains', $body)) {
            $domains = btp_str($body, 'google_allowed_domains', '', 400) ?? '';
            $clean = [];
            foreach (preg_split('/[,\s]+/', $domains) ?: [] as $domain) {
                $domain = strtolower(trim($domain));
                if ($domain === '') {
                    continue;
                }
                if (!preg_match('/^[a-z0-9.-]+\.[a-z]{2,}$/', $domain)) {
                    throw new HttpError(422, 'Invalid email domain: ' . $domain);
                }
                $clean[] = $domain;
            }
            Db::setSetting('google_allowed_domains', implode(',', array_unique($clean)));
        }
        if (array_key_exists('google_enabled', $body)) {
            Db::setSetting('google_enabled', btp_bool($body, 'google_enabled') ? '1' : '0');
        }

        if (array_key_exists('mail_transport', $body)) {
            $transport = btp_str($body, 'mail_transport', 'mail', 10) ?? 'mail';
            if (!in_array($transport, ['mail', 'smtp', 'log'], true)) {
                throw new HttpError(422, 'Unknown mail transport.');
            }
            Db::setSetting('mail_transport', $transport);
        }
        if (array_key_exists('mail_host', $body)) {
            Db::setSetting('mail_host', btp_str($body, 'mail_host', '', 190) ?? '');
        }
        if (array_key_exists('mail_port', $body)) {
            Db::setSetting('mail_port', (string) btp_int($body, 'mail_port', 587, 1, 65535));
        }
        if (array_key_exists('mail_encryption', $body)) {
            $encryption = btp_str($body, 'mail_encryption', 'tls', 10) ?? 'tls';
            if (!in_array($encryption, ['tls', 'ssl', 'none'], true)) {
                throw new HttpError(422, 'Unknown encryption mode.');
            }
            Db::setSetting('mail_encryption', $encryption);
        }
        if (array_key_exists('mail_username', $body)) {
            Db::setSetting('mail_username', btp_str($body, 'mail_username', '', 190) ?? '');
        }
        $mailPassword = (string) ($body['mail_password'] ?? '');
        if ($mailPassword !== '') {
            Db::setSetting('mail_password', $mailPassword);
        }
        if (array_key_exists('mail_from', $body)) {
            $from = btp_str($body, 'mail_from', '', 190) ?? '';
            if ($from !== '' && !filter_var($from, FILTER_VALIDATE_EMAIL)) {
                throw new HttpError(422, 'The sender address must be a valid email.');
            }
            Db::setSetting('mail_from', $from);
        }
        if (array_key_exists('mail_from_name', $body)) {
            Db::setSetting('mail_from_name', btp_str($body, 'mail_from_name', '', 120) ?? '');
        }

        Audit::log('settings.auth', null, 'google/mail configuration updated');
        $google = GoogleAuth::settings();
        btp_json([
            'saved' => true,
            'google_configured' => $google['configured'],
            'google_enabled' => $google['enabled'],
            'google_redirect_uri' => $google['redirect_uri'],
            'mail_from' => Mailer::config()['from'],
        ]);
    }

    /**
     * Send a test email so administrators can verify SMTP before relying on
     * password resets.
     */
    public function testMail(): never
    {
        $admin = Auth::requireAdmin();
        $body = btp_json_body();
        $to = btp_str($body, 'to', (string) $admin['email'], 190) ?? (string) $admin['email'];
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            throw new HttpError(422, 'Enter a valid recipient address.');
        }
        $panel = Db::setting('panel_name', (string) btp_config()['panel_name']);
        $html = sprintf(
            '<div style="font-family:system-ui,sans-serif"><h2>%s test message</h2>'
            . '<p>If you can read this, password reset emails will be delivered.</p>'
            . '<p style="color:#666;font-size:12px">Sent %s from %s</p></div>',
            btp_e($panel),
            btp_e(gmdate('Y-m-d H:i') . ' UTC'),
            btp_e(btp_absolute_url('')),
        );
        $ok = Mailer::send($to, $panel . ' test message', $html, 'Test message from ' . $panel);
        if (!$ok) {
            throw new HttpError(502, 'Mail failed: ' . (Mailer::lastError() ?? 'unknown error'));
        }
        Audit::log('settings.mail_test', null, 'to ' . $to);
        btp_json(['sent' => true, 'to' => $to, 'transport' => Mailer::config()['transport']]);
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
