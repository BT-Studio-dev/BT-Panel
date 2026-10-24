<?php

declare(strict_types=1);

namespace Btp\Support;

/**
 * Native PHP session used for CSRF tokens and flash messages. Authentication
 * itself is a separate database-backed token so it can be revoked server side.
 */
final class Session
{
    private static bool $started = false;

    public static function start(): void
    {
        if (self::$started || session_status() === PHP_SESSION_ACTIVE) {
            self::$started = true;
            return;
        }
        if (headers_sent()) {
            return;
        }
        $config = btp_config();
        $path = rtrim((string) $config['log_dir'], '/') . '/sessions';
        Path::ensureDir($path, 0770);
        session_name('btp_mc_sid');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'httponly' => true,
            'secure' => (bool) $config['secure_cookies'],
            'samesite' => 'Lax',
        ]);
        session_save_path($path);
        session_start();
        self::$started = true;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        return $_SESSION[$key] ?? $default;
    }

    public static function put(string $key, mixed $value): void
    {
        self::start();
        $_SESSION[$key] = $value;
    }

    public static function forget(string $key): void
    {
        unset($_SESSION[$key]);
    }

    /**
     * Store a one-shot message for the next page load.
     *
     * @param array{type:string,message:string}|null $flash
     */
    public static function flash(array $flash): void
    {
        self::put('flash', $flash);
    }

    /**
     * Read and clear the one-shot message.
     *
     * @return array{type:string,message:string}|null
     */
    public static function pullFlash(): ?array
    {
        $flash = self::get('flash');
        if ($flash !== null) {
            self::forget('flash');
        }
        return is_array($flash) ? $flash : null;
    }

    public static function regenerate(): void
    {
        self::start();
        session_regenerate_id(true);
    }
}
