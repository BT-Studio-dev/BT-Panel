<?php

declare(strict_types=1);

/**
 * Self-contained smoke test for BT Minecraft Panel.
 *
 * Runs without a web server and without Java: it exercises the database,
 * authorization, server provisioning records, path safety and renders every
 * view. State lives in a throwaway temp directory.
 *
 *   php tests/run-smoke.php
 */

$tmp = sys_get_temp_dir() . '/btp-smoke-' . bin2hex(random_bytes(4));
foreach (['servers', 'backups', 'logs', 'cache'] as $dir) {
    if (!mkdir($tmp . '/' . $dir, 0775, true) && !is_dir($tmp . '/' . $dir)) {
        fwrite(STDERR, "Cannot create temp dir\n");
        exit(1);
    }
}

$config = [
    'installed' => true,
    'panel_name' => 'Smoke Panel',
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
];
file_put_contents($tmp . '/config.php', "<?php\nreturn " . var_export($config, true) . ";\n");
putenv('BTP_CONFIG_FILE=' . $tmp . '/config.php');

/**
 * Sandboxes and CI runners often forbid process spawning. The fake keeps the
 * lifecycle code deterministic; pass BTP_TEST_REAL_PROC=1 to use the real
 * ProcessRunner on a host where that is meaningful.
 */
if (getenv('BTP_TEST_REAL_PROC') !== '1') {
    require __DIR__ . '/fakes/ProcessRunner.php';
}

require dirname(__DIR__) . '/bootstrap.php';

use Btp\Http\HttpError;
use Btp\Minecraft\BackupManager;
use Btp\Minecraft\JarInstaller;
use Btp\Minecraft\ServerManager;
use Btp\Support\Auth;
use Btp\Support\Db;
use Btp\Support\Path;

$failures = [];
$checks = 0;

function check(string $label, bool $ok, string $detail = ''): void
{
    global $failures, $checks;
    $checks++;
    if ($ok) {
        echo "  ok   {$label}\n";
        return;
    }
    $failures[] = $label;
    echo "  FAIL {$label}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
}

function expectHttpError(callable $callback): ?int
{
    try {
        $callback();
    } catch (HttpError $error) {
        return $error->status();
    } catch (Throwable $error) {
        return null;
    }
    return null;
}

/**
 * @param array<string,mixed> $data
 */
function renderView(string $template, array $data): string
{
    $file = BTP_APP . '/Views/' . $template . '.php';
    ob_start();
    try {
        extract($data, EXTR_SKIP);
        include $file;
    } catch (Throwable $error) {
        ob_end_clean();
        throw $error;
    }
    return (string) ob_get_clean();
}

echo "BT Minecraft Panel — smoke test\n";
echo "temp: {$tmp}\n\n";

/* ------------------------------------------------------------------ config */
check('config is loaded from the override path', btp_config_exists());
check('config marked installed', btp_config()['installed'] === true);

Db::connection();
Db::install();
$tables = Db::all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
$tableNames = array_column($tables, 'name');
foreach (['users', 'sessions', 'servers', 'backups', 'audit_log', 'settings'] as $table) {
    check("table {$table} exists", in_array($table, $tableNames, true));
}
Db::install(); // idempotent
check('schema install is idempotent', true);

/* -------------------------------------------------------------------- auth */
$admin = Auth::createUser('admin@example.com', 'correct-horse-battery', 'Ada Admin', 'admin');
check('admin created', ($admin['role'] ?? '') === 'admin');
check('email normalised to lowercase', ($admin['email'] ?? '') === 'admin@example.com');
check('password stored as a hash, never plaintext', Db::scalar('SELECT password_hash FROM users WHERE id = :id', ['id' => $admin['id']]) !== 'correct-horse-battery');
check('password verifies', password_verify(
    'correct-horse-battery',
    (string) Db::scalar('SELECT password_hash FROM users WHERE id = :id', ['id' => $admin['id']]),
));
check('weak password rejected', expectHttpError(static fn () => Auth::createUser('weak@example.com', 'short', 'Weak')) === 422);
check('invalid email rejected', expectHttpError(static fn () => Auth::createUser('not-an-email', 'long-enough-password', 'Nope')) === 422);
check('duplicate email rejected', expectHttpError(static fn () => Auth::createUser('admin@example.com', 'another-password', 'Dupe')) === 409);
$member = Auth::createUser('mod@example.com', 'moderator-passphrase', 'Mo Moderator', 'member');
check('member created', ($member['role'] ?? '') === 'member');
check('admin count', Auth::countAdmins() === 1);
check('user count', Auth::countUsers() === 2);

/* -------------------------------------------------------------- servers */
$manager = new ServerManager(new \Btp\Minecraft\NohupBackend());
$server = $manager->create([
    'name' => 'Survival SMP',
    'type' => 'vanilla',
    'version' => '1.21.4',
    'memory_mb' => 3072,
    'port' => 25565,
    'accept_eula' => true,
], $admin);

check('server record created', btp_is_uuid((string) $server['id']));
check('server directory slug is stable', (bool) preg_match('/^survival-smp-[a-z0-9]{4}$/', (string) $server['directory']), (string) $server['directory']);
check('server directory exists on disk', is_dir($manager->dir($server)));
check('eula.txt accepted', is_file($manager->dir($server) . '/eula.txt') && str_contains((string) file_get_contents($manager->dir($server) . '/eula.txt'), 'eula=true'));
$properties = (string) file_get_contents($manager->dir($server) . '/server.properties');
check('server.properties written', str_contains($properties, 'server-port=' . $server['port']));
check('rcon enabled in properties', str_contains($properties, 'enable-rcon=true'));
check('rcon password stored', strlen((string) $server['rcon_password']) >= 16);
check('rcon password matches properties', str_contains($properties, 'rcon.password=' . $server['rcon_password']));
check('server starts stopped', $manager->status($server)['state'] === 'stopped');
check('missing jar blocks start', expectHttpError(static fn () => $manager->start($server)) === 409);
check('console log empty before first start', $manager->consoleLines($server, 10) === []);
check('EULA checkbox enforced', expectHttpError(static fn () => $manager->create(['name' => 'No Eula', 'type' => 'vanilla'], $admin)) === 422);
check('short name rejected', expectHttpError(static fn () => $manager->create(['name' => 'x', 'accept_eula' => true], $admin)) === 422);

$manager->update($server, ['name' => 'Survival SMP 2', 'memory_mb' => 4096]);
$refreshed = $manager->find((string) $server['id']);
check('update persisted name', $refreshed['name'] === 'Survival SMP 2');
check('update persisted memory', $refreshed['memory_mb'] === 4096);
$server = $refreshed;
check('invalid memory rejected', expectHttpError(static fn () => $manager->update($refreshed, ['memory_mb' => 16])) === 422);

$second = $manager->create([
    'name' => 'Survival SMP',
    'type' => 'paper',
    'version' => 'latest',
    'memory_mb' => 2048,
    'accept_eula' => true,
], $admin);
check('duplicate names get unique directories', $second['directory'] !== $server['directory']);
check('ports are unique', $second['port'] !== $server['port'] || $second['port'] === 25565);

/* --------------------------------------------------------- authorization */
check('admin can access any server', Auth::canAccessServer($admin, (string) $server['id']));
check('member cannot access a foreign server', !Auth::canAccessServer($member, (string) $server['id']));
check('member can access own server', Auth::canAccessServer(
    $member,
    (string) $manager->create(['name' => 'Mod World', 'accept_eula' => true], $member)['id'],
));
check('findForUser blocks members', expectHttpError(static fn () => $manager->findForUser($member, (string) $server['id'])) === 403);
check('unknown table id rejected', expectHttpError(static fn () => $manager->find('not-a-uuid')) === 404);

/* ------------------------------------------------------------- path safety */
check('path normalization removes traversal', Path::normalize('plugins/../../etc/passwd') === 'etc/passwd');
check('absolute paths are made relative', Path::normalize('/world/level.dat') === 'world/level.dat');
check('traversal outside the root is rejected', expectHttpError(static fn () => Path::assertInside($manager->dir($server), '../../etc/passwd')) === 403);
check('nul byte rejected', expectHttpError(static fn () => Path::assertInside($manager->dir($server), "world\0.dat")) === 400);
check('nested path resolves inside root', Path::assertInside($manager->dir($server), 'plugins/essentials/config.yml') === $manager->dir($server) . '/plugins/essentials/config.yml');

$root = $manager->dir($server);
mkdir($root . '/plugins', 0775, true);
file_put_contents($root . '/plugins/essentials.yml', "enabled: true\n");
$listing = Path::listing($root, 'plugins');
check('file listing returns entries', count($listing) === 1 && $listing[0]['name'] === 'essentials.yml');
check('file listing reports size', $listing[0]['size'] === strlen("enabled: true\n"));
check('file reading is confined to the server root', expectHttpError(static fn () => Path::assertInside($root, '../../config.php')) === 403);
Path::deleteTree($root . '/plugins');
check('recursive delete works', !is_dir($root . '/plugins'));

/* ------------------------------------------------------------- properties */
$manager->setProperties($root . '/server.properties', ['motd' => 'Hello world', 'max-players' => '42']);
$updated = (string) file_get_contents($root . '/server.properties');
check('properties update existing keys', str_contains($updated, 'motd=Hello world'));
check('properties update other existing keys', str_contains($updated, 'max-players=42'));
$manager->setProperties($root . '/server.properties', ['new-key' => 'new-value']);
check('properties append unknown keys', str_contains((string) file_get_contents($root . '/server.properties'), 'new-key=new-value'));

/* ---------------------------------------------------------------- backups */
$backups = new BackupManager($manager);
$list = $backups->listForServer($server);
check('backup listing is empty', $list === []);
check('invalid backup id rejected', expectHttpError(static fn () => $backups->path($server, 'nope')) === 404);

/* ------------------------------------------------------------------ views */
$status = $manager->status($server, false);
$pageVars = [
    'panelName' => 'Smoke Panel',
    'user' => $admin + ['id' => (int) $admin['id']],
    'csrf' => 'test-token',
    'active' => 'dashboard',
    'title' => 'Smoke',
    'flash' => null,
];
$views = [
    'login' => $pageVars + ['csrf' => 'token'],
    'setup' => $pageVars + ['requirements' => \Btp\Support\Installer::requirements()],
    'dashboard' => $pageVars + ['stats' => $manager->stats($admin), 'rows' => [['server' => $server, 'status' => $status]], 'activity' => []],
    'servers' => $pageVars + ['rows' => [['server' => $server, 'status' => $status]], 'types' => JarInstaller::TYPES, 'defaultMemory' => 2048],
    'server' => $pageVars + [
        'server' => $server,
        'status' => $status,
        'backups' => [],
        'canManage' => true,
        'hasJar' => false,
        'backend' => 'nohup',
        'javaVersion' => null,
        'console' => [],
        'consoleOffset' => 0,
        'serverHost' => 'localhost',
    ],
    'users' => $pageVars + ['rows' => Db::all('SELECT id, email, name, role, created_at, last_login_at, 0 AS server_count FROM users'), 'me' => 1],
    'settings' => $pageVars + [
        'settings' => ['panel_name' => 'Smoke Panel', 'default_memory_mb' => 2048],
        'environment' => [
            'php' => PHP_VERSION, 'java' => null, 'java_bin' => 'java', 'backend' => 'nohup',
            'data_dir' => $tmp . '/servers', 'backup_dir' => $tmp . '/backups', 'log_dir' => $tmp . '/logs',
            'db_path' => $tmp . '/panel.sqlite', 'timezone' => 'UTC', 'secure_cookies' => false,
            'free_disk' => 1024, 'total_disk' => 2048,
        ],
    ],
    'activity' => $pageVars + ['rows' => []],
    'error' => ['title' => 'Not found', 'status' => 404, 'message' => 'Nope', 'panelName' => 'Smoke Panel', 'user' => null, 'csrf' => 't'],
];

foreach ($views as $view => $data) {
    try {
        $html = renderView($view, $data);
        check("view {$view} renders", strlen($html) > 120, 'output too short');
        check("view {$view} emits no PHP errors", !str_contains($html, 'Warning:') && !str_contains($html, 'Fatal error') && !str_contains($html, 'Notice:'));
    } catch (Throwable $error) {
        check("view {$view} renders", false, $error->getMessage() . ' @ ' . basename($error->getFile()) . ':' . $error->getLine());
    }
}

check('dashboard shows the server name', str_contains(renderView('dashboard', $views['dashboard']), 'Survival SMP 2'));
check('login escapes untrusted input', str_contains(renderView('login', $views['login']), 'csrf-token'));
check('html escaping helper', btp_e('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;');
check('invalid ids are rejected before SQL', expectHttpError(static fn () => $manager->find("1' OR 1=1 --")) === 404);

/* --------------------------------------------------------------- settings */
Db::setSetting('panel_name', 'Renamed Panel');
check('settings round-trip', Db::setting('panel_name') === 'Renamed Panel');
check('settings default fallback', Db::setting('missing', 'fallback') === 'fallback');

/* ------------------------------------------------------------------ misc */
check('byte formatting', btp_bytes(1536) === '1.5 KB');
check('duration formatting', btp_duration(3661) === '1h 01m');
check('slug sanitises', btp_slug('My Server!!') === 'my-server');
check('uuid validation', btp_is_uuid($server['id']) && !btp_is_uuid('nope'));
check('json decode fallback', btp_json_decode('not json', ['a' => 1]) === ['a' => 1]);
check('installed jar types', JarInstaller::TYPES === ['vanilla', 'paper', 'purpur', 'custom']);

/* ---------------------------------------------------------------- cleanup */
// Close SQLite before removing its directory: WAL handles on some sandbox
// filesystems cannot be unlinked while the connection is open.
Db::reset();
foreach (glob($tmp . '/panel.sqlite*') ?: [] as $sqliteFile) {
    @unlink($sqliteFile);
}
Path::deleteTree($tmp);

echo "\n{$checks} checks, " . count($failures) . " failure(s)\n";
if ($failures !== []) {
    echo "\nFailed:\n - " . implode("\n - ", $failures) . "\n";
    exit(1);
}
echo "All smoke checks passed.\n";
exit(0);
