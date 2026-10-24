<?php

declare(strict_types=1);

namespace Btp\Support;

/**
 * Append-only panel log with simple size-based rotation.
 */
final class Logger
{
    public static function error(\Throwable $error): void
    {
        self::write('error', sprintf(
            '%s: %s in %s:%d',
            $error::class,
            $error->getMessage(),
            $error->getFile(),
            $error->getLine(),
        ));
    }

    public static function info(string $message): void
    {
        self::write('info', $message);
    }

    private static function write(string $level, string $message): void
    {
        try {
            $dir = (string) (btp_config()['log_dir'] ?? (BTP_ROOT . '/storage/logs'));
            Path::ensureDir($dir, 0775);
            $file = $dir . '/panel.log';
            if (is_file($file) && filesize($file) > 5 * 1024 * 1024) {
                @rename($file, $file . '.1');
            }
            $line = sprintf("[%s] %s %s %s\n", gmdate('c'), strtoupper($level), btp_client_ip(), $message);
            @file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
        } catch (\Throwable) {
            // Logging must never throw.
        }
    }
}
