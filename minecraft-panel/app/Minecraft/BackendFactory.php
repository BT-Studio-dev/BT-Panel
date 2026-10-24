<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;

final class BackendFactory
{
    private static ?ProcessBackend $resolved = null;

    public static function make(?string $preference = null): ProcessBackend
    {
        $config = btp_config();
        $preference ??= (string) ($config['process_backend'] ?? 'auto');
        if (self::$resolved !== null) {
            return self::$resolved;
        }
        $screen = new ScreenBackend((string) ($config['screen_bin'] ?? 'screen'));
        $tmux = new TmuxBackend((string) ($config['tmux_bin'] ?? 'tmux'));
        $nohup = new NohupBackend();

        return self::$resolved = match ($preference) {
            'screen' => $screen,
            'tmux' => $tmux,
            'nohup' => $nohup,
            default => $screen->available() ? $screen : ($tmux->available() ? $tmux : $nohup),
        };
    }
}
