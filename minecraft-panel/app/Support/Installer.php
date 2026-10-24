<?php

declare(strict_types=1);

namespace Btp\Support;

use Btp\Http\HttpError;

/**
 * First-run installer: environment checks, database schema and the initial
 * administrator account. Writes `config.php` next to `config.example.php`.
 */
final class Installer
{
    /**
     * @return list<array{key:string,label:string,ok:bool,required:bool,detail:string}>
     */
    public static function requirements(): array
    {
        $cfg = btp_config();
        $dataDir = (string) $cfg['data_dir'];
        $logDir = (string) $cfg['log_dir'];
        $backupDir = (string) $cfg['backup_dir'];
        $configWritable = is_writable(BTP_ROOT);

        $java = (string) $cfg['java_bin'];
        $javaOk = \Btp\Minecraft\ProcessRunner::commandExists($java);
        $javaVersion = null;
        if ($javaOk) {
            $result = \Btp\Minecraft\ProcessRunner::run([$java, '-version'], null, 10);
            if (preg_match('/version "([^"]+)"/', $result['stderr'] . $result['stdout'], $m)) {
                $javaVersion = $m[1];
            }
        }
        $screenOk = \Btp\Minecraft\ProcessRunner::commandExists((string) $cfg['screen_bin']);
        $tmuxOk = \Btp\Minecraft\ProcessRunner::commandExists((string) $cfg['tmux_bin']);
        $tarOk = \Btp\Minecraft\ProcessRunner::commandExists('tar');
        $disabled = array_map('trim', explode(',', (string) ini_get('disable_functions')));

        return [
            [
                'key' => 'php',
                'label' => 'PHP 8.1+',
                'ok' => PHP_VERSION_ID >= 80100,
                'required' => true,
                'detail' => 'Running PHP ' . PHP_VERSION,
            ],
            [
                'key' => 'pdo_sqlite',
                'label' => 'PDO SQLite extension',
                'ok' => extension_loaded('pdo_sqlite'),
                'required' => true,
                'detail' => extension_loaded('pdo_sqlite') ? 'Available' : 'Enable the pdo_sqlite extension in BT Panel → PHP settings.',
            ],
            [
                'key' => 'proc_open',
                'label' => 'Process functions',
                'ok' => function_exists('proc_open') && !in_array('proc_open', $disabled, true),
                'required' => true,
                'detail' => function_exists('proc_open') ? 'proc_open available' : 'proc_open is disabled; enable it under disable_functions.',
            ],
            [
                'key' => 'config',
                'label' => 'Panel directory writable',
                'ok' => $configWritable,
                'required' => true,
                'detail' => $configWritable ? 'config.php can be created' : 'Give the PHP-FPM user write access to ' . BTP_ROOT,
            ],
            [
                'key' => 'storage',
                'label' => 'Storage writable',
                'ok' => self::writable($dataDir) && self::writable($logDir) && self::writable($backupDir),
                'required' => true,
                'detail' => 'data: ' . $dataDir,
            ],
            [
                'key' => 'java',
                'label' => 'Java runtime',
                'ok' => $javaOk,
                'required' => true,
                'detail' => $javaOk
                    ? 'Found ' . $java . ($javaVersion ? ' (Java ' . $javaVersion . ')' : '')
                    : 'Install a JDK (17+ for 1.18+, 21+ for 1.20.5+) and set java_bin in config.php.',
            ],
            [
                'key' => 'multiplexer',
                'label' => 'screen or tmux',
                'ok' => $screenOk || $tmuxOk,
                'required' => false,
                'detail' => $screenOk ? 'screen available' : ($tmuxOk ? 'tmux available' : 'Not found — the panel will fall back to setsid. RCON console still works.'),
            ],
            [
                'key' => 'tar',
                'label' => 'tar archiver',
                'ok' => $tarOk,
                'required' => false,
                'detail' => $tarOk ? 'Backups supported' : 'Not found — backups fall back to PharData or are unavailable.',
            ],
        ];
    }

    private static function writable(string $path): bool
    {
        if (!is_dir($path)) {
            @mkdir($path, 0775, true);
        }
        return is_dir($path) && is_writable($path);
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed> the created admin
     */
    public static function install(array $input): array
    {
        if (btp_config_exists()) {
            $existing = require BTP_CONFIG_FILE;
            if (is_array($existing) && ($existing['installed'] ?? false) === true) {
                throw new HttpError(409, 'The panel is already installed. Delete config.php to reinstall.');
            }
        }

        $requirements = self::requirements();
        foreach ($requirements as $requirement) {
            if ($requirement['required'] && !$requirement['ok']) {
                throw new HttpError(422, 'Requirement not met: ' . $requirement['label']);
            }
        }

        $panelName = btp_str($input, 'panel_name', 'BT Minecraft Panel', 60) ?: 'BT Minecraft Panel';
        $email = btp_str($input, 'email', '', 190) ?? '';
        $password = (string) ($input['password'] ?? '');
        $name = btp_str($input, 'name', 'Administrator', 120) ?: 'Administrator';
        $timezone = btp_str($input, 'timezone', 'UTC', 64) ?: 'UTC';
        $javaBin = btp_str($input, 'java_bin', 'java', 255) ?: 'java';
        $backend = btp_str($input, 'process_backend', 'auto', 16) ?: 'auto';
        if (!in_array($backend, ['auto', 'screen', 'tmux', 'nohup'], true)) {
            throw new HttpError(422, 'Unknown process backend.');
        }
        if (!in_array($timezone, timezone_identifiers_list(), true)) {
            $timezone = 'UTC';
        }

        $config = [
            'installed' => true,
            'panel_name' => $panelName,
            'timezone' => $timezone,
            'data_dir' => BTP_ROOT . '/storage/servers',
            'backup_dir' => BTP_ROOT . '/storage/backups',
            'log_dir' => BTP_ROOT . '/storage/logs',
            'db_path' => BTP_ROOT . '/storage/panel.sqlite',
            'java_bin' => $javaBin,
            'screen_bin' => 'screen',
            'tmux_bin' => 'tmux',
            'process_backend' => $backend,
            'session_name' => 'btp_mc_session',
            'secure_cookies' => false,
            'default_memory_mb' => 2048,
            'default_java_flags' => '',
            'accent' => '#d00000',
        ];

        foreach (['data_dir' => 'storage/servers', 'backup_dir' => 'storage/backups', 'log_dir' => 'storage/logs'] as $key => $relative) {
            Path::ensureDir(BTP_ROOT . '/' . $relative);
        }

        if (!@file_put_contents(BTP_CONFIG_FILE, self::renderConfig($config), LOCK_EX)) {
            throw new HttpError(500, 'Unable to write config.php. Check permissions on ' . BTP_ROOT);
        }
        @chmod(BTP_CONFIG_FILE, 0640);

        // Re-read configuration from the file we just wrote.
        Db::reset();
        date_default_timezone_set($timezone);
        Db::install();

        $admin = Auth::createUser($email, $password, $name, 'admin');
        Db::setSetting('installed_at', gmdate('c'));
        Db::setSetting('panel_name', $panelName);
        Audit::log('panel.install', null, $panelName, (int) $admin['id']);

        return $admin;
    }

    /**
     * @param array<string,mixed> $config
     */
    public static function renderConfig(array $config): string
    {
        $lines = ["<?php", '', 'declare(strict_types=1);', '', '// Generated by the BT Minecraft Panel installer on ' . gmdate('c'), 'return ['];
        foreach ($config as $key => $value) {
            $export = is_bool($value)
                ? ($value ? 'true' : 'false')
                : (is_int($value) ? (string) $value : var_export($value, true));
            $lines[] = sprintf("    %s => %s,", var_export($key, true), $export);
        }
        $lines[] = '];';
        $lines[] = '';
        return implode("\n", $lines);
    }
}
