<?php

declare(strict_types=1);

namespace Btp\Http;

use Btp\Http\Api\AdminApi;
use Btp\Http\Api\BackupApi;
use Btp\Http\Api\FileApi;
use Btp\Http\Api\ServerApi;
use Btp\Http\Web\Pages;
use Btp\Support\Audit;
use Btp\Support\Auth;
use Btp\Support\Db;
use Btp\Support\Installer;
use Btp\Support\Logger;
use Btp\Support\Session;

/**
 * Front-controller kernel: routing, CSRF, error rendering and dispatch.
 *
 * `public/index.php` is a three-line wrapper so tests can seed a database and
 * then call Kernel::run() in the same process, exactly like a real request.
 */
final class Kernel
{
    public static function run(): never
    {
        $base = self::basePath();

        set_exception_handler(static function (\Throwable $error) use ($base): void {
            self::handleException($error, $base);
        });

        set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
            if (!(error_reporting() & $severity)) {
                return false;
            }
            throw new \ErrorException($message, 0, $severity, $file, $line);
        });

        try {
            Session::start();
            Db::connection();
            // Create tables on an already-installed panel (idempotent upgrade path).
            if (btp_config()['installed']) {
                Db::install();
            }
        } catch (\Throwable $error) {
            if (!btp_config_exists()) {
                btp_redirect(btp_url('setup'));
            }
            self::handleException($error, $base);
        }

        $path = self::requestPath($base);
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        // The installer must be reachable before config.php exists.
        $installed = (bool) btp_config()['installed'];
        $isSetupPath = str_starts_with($path, '/setup');
        $isHealth = $path === '/api/health';
        if (!$installed && !$isSetupPath && !$isHealth) {
            btp_redirect(btp_url('setup'));
        }

        // CSRF for every state-changing request (including login and setup).
        if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            Csrf::verify();
        }

        self::routes($path, $method);
    }

    private static function routes(string $path, string $method): never
    {
        $router = new Router();

        /* ---------------------------------------------------------- pages */
        $pages = new Pages();
        $router->get('/', [$pages, 'home']);
        $router->get('/login', [$pages, 'login']);
        $router->get('/setup', [$pages, 'setup']);
        $router->get('/dashboard', [$pages, 'dashboard']);
        $router->get('/servers', [$pages, 'servers']);
        $router->get('/servers/{id}', [$pages, 'server']);
        $router->get('/users', [$pages, 'users']);
        $router->get('/settings', [$pages, 'settings']);
        $router->get('/activity', [$pages, 'activity']);

        /* ----------------------------------------------------------- auth */
        $router->post('/login', static function (): never {
            $user = Auth::attempt((string) ($_POST['email'] ?? ''), (string) ($_POST['password'] ?? ''));
            Session::regenerate();
            btp_redirect(btp_url('dashboard'));
        });

        $router->post('/logout', static function (): never {
            Audit::log('auth.logout', null, (string) (Auth::user()['email'] ?? ''));
            Auth::logout();
            btp_redirect(btp_url('login'));
        });

        $router->post('/setup', static function (): never {
            $admin = Installer::install($_POST);
            Auth::startSession((int) $admin['id']);
            Session::regenerate();
            btp_redirect(btp_url('dashboard'));
        });

        /* ------------------------------------------------------------ api */
        $servers = new ServerApi();
        $router->get('/api/health', static function (): never {
            btp_json([
                'status' => 'ok',
                'installed' => (bool) btp_config()['installed'],
                'time' => gmdate('c'),
            ]);
        });
        $router->get('/api/stats', [$servers, 'stats']);
        $router->get('/api/servers', [$servers, 'index']);
        $router->post('/api/servers', [$servers, 'create']);
        $router->get('/api/servers/{id}', [$servers, 'show']);
        $router->patch('/api/servers/{id}', [$servers, 'update']);
        $router->delete('/api/servers/{id}', [$servers, 'delete']);
        $router->post('/api/servers/{id}/power', [$servers, 'power']);
        $router->post('/api/servers/{id}/install', [$servers, 'install']);
        $router->get('/api/servers/{id}/console', [$servers, 'console']);
        $router->post('/api/servers/{id}/console', [$servers, 'command']);

        $files = new FileApi();
        $router->get('/api/servers/{id}/files', [$files, 'list']);
        $router->get('/api/servers/{id}/files/content', [$files, 'content']);
        $router->put('/api/servers/{id}/files/content', [$files, 'save']);
        $router->post('/api/servers/{id}/files/upload', [$files, 'upload']);
        $router->post('/api/servers/{id}/files/mkdir', [$files, 'mkdir']);
        $router->post('/api/servers/{id}/files/delete', [$files, 'delete']);
        $router->get('/api/servers/{id}/files/download', [$files, 'download']);

        $backups = new BackupApi();
        $router->get('/api/servers/{id}/backups', [$backups, 'index']);
        $router->post('/api/servers/{id}/backups', [$backups, 'create']);
        $router->get('/api/servers/{id}/backups/{backupId}/download', [$backups, 'download']);
        $router->post('/api/servers/{id}/backups/{backupId}/restore', [$backups, 'restore']);
        $router->delete('/api/servers/{id}/backups/{backupId}', [$backups, 'delete']);

        $admin = new AdminApi();
        $router->get('/api/users', [$admin, 'users']);
        $router->post('/api/users', [$admin, 'createUser']);
        $router->patch('/api/users/{id}', [$admin, 'updateUser']);
        $router->delete('/api/users/{id}', [$admin, 'deleteUser']);
        $router->get('/api/settings', [$admin, 'settings']);
        $router->patch('/api/settings', [$admin, 'updateSettings']);
        $router->get('/api/activity', [$admin, 'activity']);
        $router->post('/api/account/password', [$admin, 'changePassword']);

        /* -------------------------------------------------------- dispatch */
        $match = $router->match($method, $path);
        if ($match === null) {
            if ($router->hasPath($path)) {
                throw new HttpError(405, 'Method not allowed.');
            }
            throw new HttpError(404, 'Page not found.');
        }
        ($match['handler'])($match['params']);
    }

    /**
     * Request base path, e.g. "" or "/panel".
     */
    public static function basePath(): string
    {
        $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
        $base = rtrim(dirname($script), '/');
        return ($base === '.' || $base === '/') ? '' : $base;
    }

    public static function requestPath(string $base): string
    {
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = (string) (parse_url($uri, PHP_URL_PATH) ?: '/');
        if ($base !== '' && str_starts_with($path, $base)) {
            $path = substr($path, strlen($base));
        }
        $path = '/' . ltrim($path, '/');
        $path = rtrim($path, '/');
        if ($path === '') {
            $path = '/';
        }
        // Support hosts without rewrite rules: index.php?r=servers
        if ($path === '/' && isset($_GET['r']) && is_string($_GET['r'])) {
            $path = '/' . trim($_GET['r'], '/');
        }
        if ($path === '/index.php') {
            $path = '/';
        }
        return $path;
    }

    private static function handleException(\Throwable $error, string $base): never
    {
        if ($error instanceof HttpError && $error->status() === 401 && !btp_wants_json()) {
            btp_redirect(btp_url('login'));
        }

        $status = $error instanceof HttpError ? $error->status() : 500;
        $message = $error instanceof HttpError
            ? $error->getMessage()
            : 'Something went wrong. Check storage/logs/panel.log for details.';

        if (!($error instanceof HttpError)) {
            Logger::error($error);
        }

        if (btp_wants_json()) {
            btp_json(['error' => $message, 'status' => $status], $status);
        }

        $title = match (true) {
            $status === 401 => 'Sign in required',
            $status === 403 => 'Access denied',
            $status === 404 => 'Not found',
            $status === 419 => 'Session expired',
            $status >= 500 => 'Server error',
            default => 'Request failed',
        };
        btp_view('error', [
            'title' => $title,
            'status' => $status,
            'message' => $message,
            'csrf' => Csrf::token(),
            'panelName' => Db::setting('panel_name', (string) btp_config()['panel_name']),
            'user' => Auth::user(),
            'base' => $base,
        ], $status);
    }
}
