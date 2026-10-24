<?php

declare(strict_types=1);

/**
 * BT Minecraft Panel bootstrap.
 *
 * Every public entry point (front controller, cron, CLI) requires this file.
 * It defines the autoloader, loads configuration and exposes shared helpers.
 *
 * PHP 8.1+ required.
 */

// Requiring the bootstrap twice (e.g. a front controller plus a test harness)
// must be harmless.
if (defined('BTP_ROOT')) {
    return;
}

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    echo 'BT Minecraft Panel requires PHP 8.1 or newer.';
    exit;
}

define('BTP_ROOT', __DIR__);
define('BTP_APP', __DIR__ . '/app');
define('BTP_PUBLIC', __DIR__ . '/public');
// Tests and container deployments can point at a different config file.
define('BTP_CONFIG_FILE', getenv('BTP_CONFIG_FILE') ?: __DIR__ . '/config.php');

spl_autoload_register(static function (string $class): void {
    $prefix = 'Btp\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $relative = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = BTP_APP . '/' . $relative . '.php';
    if (is_file($file)) {
        require $file;
    }
});

require BTP_APP . '/Support/helpers.php';
require BTP_APP . '/Support/icons.php';

/**
 * Configuration is loaded lazily so the setup wizard can run before config.php
 * exists.
 */
function btp_config_path(): string
{
    return BTP_CONFIG_FILE;
}

function btp_config_exists(): bool
{
    return is_file(BTP_CONFIG_FILE);
}

/**
 * @return array<string,mixed>
 */
function btp_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $example = require BTP_ROOT . '/config.example.php';
    $loaded = btp_config_exists() ? require BTP_CONFIG_FILE : [];
    if (!is_array($loaded)) {
        $loaded = [];
    }
    $config = array_merge($example, $loaded);

    // Environment variables win over the file so containers/CI can override.
    $env = static fn (string $key): ?string => ($v = getenv($key)) === false ? null : $v;
    $map = [
        'data_dir' => 'BTP_DATA_DIR',
        'backup_dir' => 'BTP_BACKUP_DIR',
        'log_dir' => 'BTP_LOG_DIR',
        'db_path' => 'BTP_DB_PATH',
        'java_bin' => 'BTP_JAVA_BIN',
        'screen_bin' => 'BTP_SCREEN_BIN',
        'tmux_bin' => 'BTP_TMUX_BIN',
        'process_backend' => 'BTP_PROCESS_BACKEND',
        'timezone' => 'BTP_TIMEZONE',
    ];
    foreach ($map as $key => $envKey) {
        $value = $env($envKey);
        if ($value !== null && $value !== '') {
            $config[$key] = $value;
        }
    }

    if ($env('BTP_COOKIE_SECURE') !== null) {
        $config['secure_cookies'] = $env('BTP_COOKIE_SECURE') === '1';
    }

    $config['installed'] = btp_config_exists() && ($config['installed'] ?? false) === true;

    date_default_timezone_set((string) ($config['timezone'] ?: 'UTC'));

    return $config;
}

function btp_env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    return ($value === false || $value === '') ? $default : $value;
}

/**
 * Absolute path resolved inside the configured data root. Always use this
 * helper before touching the filesystem: it rejects traversal attempts.
 */
function btp_data_path(string $relative = ''): string
{
    $root = rtrim((string) btp_config()['data_dir'], '/');
    if ($relative === '') {
        return $root;
    }
    $clean = \Btp\Support\Path::assertInside($root, $relative);
    return $clean;
}

// Never expose PHP notices in JSON/HTML responses; log them instead.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);
