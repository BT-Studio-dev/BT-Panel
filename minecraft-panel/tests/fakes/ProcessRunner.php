<?php

declare(strict_types=1);

namespace Btp\Minecraft;

/**
 * Test double for ProcessRunner.
 *
 * The smoke test runs in environments without process spawning (CI sandboxes,
 * php-wasm). Requiring this file before bootstrap.php means the autoloader
 * never loads the real implementation, so lifecycle code can be exercised
 * deterministically.
 */
final class ProcessRunner
{
    /** @var array<string,bool> */
    public static array $commands = ['screen' => true, 'tmux' => true, 'bash' => true, 'setsid' => true, 'tar' => true, 'pgrep' => true, 'ps' => true, 'tail' => true];

    /** @var list<array{command:list<string>,code:int,stdout:string,stderr:string}> */
    public static array $calls = [];

    /**
     * @param list<string> $command
     * @param array<string,string> $env
     * @return array{code:int,stdout:string,stderr:string,timed_out:bool}
     */
    public static function run(array $command, ?string $cwd = null, int $timeout = 15, array $env = []): array
    {
        self::$calls[] = ['command' => $command, 'code' => 0, 'stdout' => '', 'stderr' => ''];
        return ['code' => 0, 'stdout' => '', 'stderr' => '', 'timed_out' => false];
    }

    /**
     * @param list<string> $command
     */
    public static function capture(array $command, int $timeout = 10): ?string
    {
        self::$calls[] = ['command' => $command, 'code' => 0, 'stdout' => '', 'stderr' => ''];
        return null;
    }

    public static function commandExists(string $binary): bool
    {
        return self::$commands[$binary] ?? false;
    }

    /**
     * @return array<string,string>
     */
    public static function baseEnv(): array
    {
        return ['PATH' => '/usr/bin:/bin'];
    }
}
