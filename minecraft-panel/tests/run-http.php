<?php

declare(strict_types=1);

/**
 * Invoke one front-controller request without a web server.
 *
 *   php tests/run-http.php GET /login
 *   php tests/run-http.php GET /api/servers --guest          → 401 JSON
 *   php tests/run-http.php POST /api/servers --json '{"name":"Test","accept_eula":true}'
 *
 * Authenticated requests get a seeded session; `--csrf` adds the token so
 * write endpoints can be exercised. Output is the raw response body (CLI
 * cannot read response headers).
 */

use Btp\Http\Csrf;
use Btp\Http\Kernel;
use Btp\Minecraft\NohupBackend;
use Btp\Minecraft\ServerManager;
use Btp\Support\Auth;
use Btp\Support\Db;
use Btp\Support\Session;

$args = array_slice($argv ?? [], 1);
$flags = [];
$positional = [];
foreach ($args as $arg) {
    if (str_starts_with($arg, '--')) {
        $parts = explode('=', substr($arg, 2), 2);
        $flags[$parts[0]] = $parts[1] ?? true;
    } else {
        $positional[] = $arg;
    }
}

$method = strtoupper($positional[0] ?? 'GET');
$path = $positional[1] ?? '/';
$guest = isset($flags['guest']);
$jsonBody = is_string($flags['json'] ?? null) ? (string) $flags['json'] : null;

$tmp = sys_get_temp_dir() . '/btp-http-' . bin2hex(random_bytes(4));
foreach (['servers', 'backups', 'logs'] as $dir) {
    mkdir($tmp . '/' . $dir, 0775, true);
}
file_put_contents($tmp . '/config.php', "<?php\nreturn " . var_export([
    'installed' => true,
    'panel_name' => 'HTTP Test Panel',
    'timezone' => 'UTC',
    'data_dir' => $tmp . '/servers',
    'backup_dir' => $tmp . '/backups',
    'log_dir' => $tmp . '/logs',
    'db_path' => $tmp . '/panel.sqlite',
    'java_bin' => 'java',
    'screen_bin' => 'screen',
    'tmux_bin' => 'tmux',
    'process_backend' => 'nohup',
    'session_name' => 'btp_mc_session',
    'secure_cookies' => false,
    'default_memory_mb' => 2048,
    'default_java_flags' => '',
    'accent' => '#d00000',
], true) . ";\n");
putenv('BTP_CONFIG_FILE=' . $tmp . '/config.php');

if (getenv('BTP_TEST_REAL_PROC') !== '1') {
    require __DIR__ . '/fakes/ProcessRunner.php';
}
require dirname(__DIR__) . '/bootstrap.php';

Db::connection();
Db::install();

$admin = Auth::createUser('http@example.com', 'http-test-password', 'HTTP Admin', 'admin');
$token = bin2hex(random_bytes(32));
Db::insert('sessions', [
    'token_hash' => hash('sha256', $token),
    'user_id' => (int) $admin['id'],
    'created_at' => gmdate('c'),
    'expires_at' => gmdate('c', time() + 3600),
    'ip' => '127.0.0.1',
    'user_agent' => 'run-http',
]);

// Keep CSRF deterministic: start the session here and reuse its token.
Session::start();
$csrf = Csrf::token();

$_SERVER = array_merge($_SERVER, [
    'REQUEST_METHOD' => $method,
    'REQUEST_URI' => $path,
    'SCRIPT_NAME' => '/index.php',
    'HTTP_HOST' => 'localhost',
    'SERVER_NAME' => 'localhost',
    'REMOTE_ADDR' => '127.0.0.1',
    'HTTP_ACCEPT' => 'application/json',
]);
$_COOKIE = $guest ? [] : ['btp_mc_session' => $token];
$_GET = [];
$_POST = [];
if (isset($flags['csrf'])) {
    $_SERVER['HTTP_X_CSRF_TOKEN'] = $csrf;
}
if ($jsonBody !== null) {
    $_SERVER['HTTP_X_CSRF_TOKEN'] ??= $csrf;
}

// The front controller reads the JSON body from php://input, which is empty in
// CLI. The helper honours this override constant.
if ($jsonBody !== null && !defined('BTP_JSON_BODY_OVERRIDE')) {
    define('BTP_JSON_BODY_OVERRIDE', $jsonBody);
}

Kernel::run();
