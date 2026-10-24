<?php

declare(strict_types=1);

namespace Btp\Http\Web;

use Btp\Http\HttpError;
use Btp\Minecraft\BackendFactory;
use Btp\Minecraft\JarInstaller;
use Btp\Minecraft\ServerManager;
use Btp\Support\Audit;
use Btp\Support\Auth;
use Btp\Support\Db;
use Btp\Support\Installer;

/**
 * Server-rendered pages. Each page ships its first render in HTML so the panel
 * is usable without JavaScript; app.js adds live status, console and dialogs.
 */
final class Pages
{
    /**
     * @param array<string,mixed> $data
     */
    private function render(string $view, array $data, int $status = 200): never
    {
        $user = Auth::user();
        $panelName = Db::setting('panel_name', (string) btp_config()['panel_name']);
        btp_view($view, array_merge([
            'user' => $user,
            'panelName' => $panelName ?: 'BT Minecraft Panel',
            'csrf' => \Btp\Http\Csrf::token(),
            'active' => '',
            'title' => '',
            'flash' => \Btp\Support\Session::get('flash'),
        ], $data), $status);
    }

    public function home(): never
    {
        btp_redirect(btp_url(Auth::user() ? 'dashboard' : 'login'));
    }

    public function login(): never
    {
        if (Auth::user() !== null) {
            btp_redirect(btp_url('dashboard'));
        }
        $this->render('login', ['title' => 'Sign in', 'active' => 'login']);
    }

    public function dashboard(): never
    {
        $user = Auth::requireUser();
        $manager = new ServerManager();
        $servers = $manager->listForUser($user);
        $rows = [];
        $running = 0;
        $memory = 0;
        foreach ($servers as $server) {
            $status = $manager->status($server, true);
            if ($status['state'] === 'running') {
                $running++;
                $memory += (int) $status['memory_bytes'];
            }
            $rows[] = ['server' => $server, 'status' => $status];
        }
        $stats = $manager->stats($user);
        $activity = Auth::isAdmin($user)
            ? Audit::recent(8)
            : array_slice(array_values(array_filter(
                Audit::recent(80),
                static fn (array $row): bool => (int) ($row['user_id'] ?? 0) === (int) $user['id'],
            )), 0, 8);

        $this->render('dashboard', [
            'title' => 'Dashboard',
            'active' => 'dashboard',
            'rows' => $rows,
            'stats' => $stats,
            'activity' => $activity,
        ]);
    }

    public function servers(): never
    {
        $user = Auth::requireUser();
        $manager = new ServerManager();
        $rows = [];
        foreach ($manager->listForUser($user) as $server) {
            $rows[] = ['server' => $server, 'status' => $manager->status($server)];
        }
        $this->render('servers', [
            'title' => 'Servers',
            'active' => 'servers',
            'rows' => $rows,
            'types' => JarInstaller::TYPES,
            'defaultMemory' => (int) Db::setting('default_memory_mb', (string) btp_config()['default_memory_mb']),
        ]);
    }

    public function server(array $params): never
    {
        $user = Auth::requireUser();
        $manager = new ServerManager();
        $server = $manager->findForUser($user, (string) $params['id']);
        $status = $manager->status($server, true);
        $this->render('server', [
            'title' => (string) $server['name'],
            'active' => 'servers',
            'crumbs' => Db::setting('panel_name', (string) btp_config()['panel_name']) . ' / Servers / ' . $server['name'],
            'server' => $server,
            'status' => $status,
            'backups' => (new \Btp\Minecraft\BackupManager($manager))->listForServer($server),
            'canManage' => Auth::isAdmin($user) || (int) $server['owner_id'] === (int) $user['id'],
            'backend' => BackendFactory::make()->name(),
            'javaVersion' => $manager->javaVersion(),
            'console' => $manager->consoleLines($server, 120),
            'consoleOffset' => $manager->consoleSize($server),
            'hasJar' => is_file($manager->dir($server) . '/' . basename((string) $server['jar'])),
            'serverHost' => (string) ($_SERVER['SERVER_NAME'] ?? 'localhost'),
        ]);
    }

    public function users(): never
    {
        $user = Auth::requireAdmin();
        $rows = Db::all(
            'SELECT u.id, u.email, u.name, u.role, u.created_at, u.last_login_at,
                    (SELECT COUNT(*) FROM servers s WHERE s.owner_id = u.id) AS server_count
             FROM users u ORDER BY u.id',
        );
        $this->render('users', [
            'title' => 'Users',
            'active' => 'users',
            'rows' => $rows,
            'me' => (int) $user['id'],
        ]);
    }

    public function settings(): never
    {
        Auth::requireAdmin();
        $config = btp_config();
        $manager = new ServerManager();
        $this->render('settings', [
            'title' => 'Settings',
            'active' => 'settings',
            'settings' => [
                'panel_name' => Db::setting('panel_name', (string) $config['panel_name']),
                'default_memory_mb' => (int) Db::setting('default_memory_mb', (string) $config['default_memory_mb']),
            ],
            'environment' => [
                'php' => PHP_VERSION,
                'java' => $manager->javaVersion(),
                'java_bin' => (string) $config['java_bin'],
                'backend' => BackendFactory::make()->name(),
                'data_dir' => (string) $config['data_dir'],
                'backup_dir' => (string) $config['backup_dir'],
                'log_dir' => (string) $config['log_dir'],
                'db_path' => (string) $config['db_path'],
                'timezone' => (string) $config['timezone'],
                'secure_cookies' => (bool) $config['secure_cookies'],
                'free_disk' => (int) @disk_free_space((string) $config['data_dir']),
                'total_disk' => (int) @disk_total_space((string) $config['data_dir']),
            ],
        ]);
    }

    public function activity(): never
    {
        Auth::requireAdmin();
        $this->render('activity', [
            'title' => 'Activity',
            'active' => 'activity',
            'rows' => Audit::recent(200),
        ]);
    }

    public function setup(): never
    {
        if (btp_config_exists()) {
            $existing = require BTP_CONFIG_FILE;
            if (is_array($existing) && ($existing['installed'] ?? false) === true) {
                btp_redirect(btp_url('login'));
            }
        }
        $this->render('setup', [
            'title' => 'Setup',
            'active' => 'setup',
            'requirements' => Installer::requirements(),
            'timezones' => ['UTC'],
            'defaultTimezone' => date_default_timezone_get(),
        ]);
    }

}
