<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;

/**
 * Thin, injection-safe wrapper around proc_open.
 *
 * Commands are always passed as an argv array, so no user value is ever
 * concatenated into a shell string. When a shell is genuinely required the
 * caller must build the script itself and pass it as one array element to
 * `bash -c` (see ServerManager::start()).
 */
final class ProcessRunner
{
    /**
     * @param list<string> $command
     * @param array<string,string> $env
     * @return array{code:int,stdout:string,stderr:string,timed_out:bool}
     */
    public static function run(array $command, ?string $cwd = null, int $timeout = 15, array $env = []): array
    {
        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $fullEnv = $env === [] ? null : array_merge(self::baseEnv(), $env);

        $process = @proc_open($command, $descriptors, $pipes, $cwd, $fullEnv);
        if (!is_resource($process)) {
            throw new HttpError(500, 'Unable to run command: ' . ($command[0] ?? 'unknown'));
        }

        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);

        $stdout = '';
        $stderr = '';
        $start = microtime(true);
        $timedOut = false;

        while (true) {
            $read = [$pipes[1], $pipes[2]];
            $write = null;
            $except = null;
            $ready = @stream_select($read, $write, $except, 0, 200000);
            if ($ready > 0) {
                foreach ($read as $stream) {
                    $chunk = fread($stream, 65536);
                    if ($chunk === false || $chunk === '') {
                        continue;
                    }
                    if ($stream === $pipes[1]) {
                        $stdout .= $chunk;
                    } else {
                        $stderr .= $chunk;
                    }
                }
            }
            $status = proc_get_status($process);
            if (!$status['running']) {
                // Drain anything left in the buffers.
                $stdout .= (string) stream_get_contents($pipes[1]);
                $stderr .= (string) stream_get_contents($pipes[2]);
                fclose($pipes[1]);
                fclose($pipes[2]);
                proc_close($process);
                return [
                    'code' => (int) $status['exitcode'],
                    'stdout' => $stdout,
                    'stderr' => $stderr,
                    'timed_out' => false,
                ];
            }
            if ((microtime(true) - $start) > $timeout) {
                $timedOut = true;
                @proc_terminate($process, 9);
                break;
            }
        }

        fclose($pipes[1]);
        fclose($pipes[2]);
        proc_close($process);

        return ['code' => -1, 'stdout' => $stdout, 'stderr' => $stderr, 'timed_out' => $timedOut];
    }

    /**
     * Run a command and return trimmed stdout, or null on failure.
     *
     * @param list<string> $command
     */
    public static function capture(array $command, int $timeout = 10): ?string
    {
        try {
            $result = self::run($command, null, $timeout);
        } catch (\Throwable) {
            return null;
        }
        if ($result['code'] !== 0) {
            return null;
        }
        return trim($result['stdout']);
    }

    /** @var array<string,bool> */
    private static array $commandCache = [];

    public static function commandExists(string $binary): bool
    {
        if ($binary === '') {
            return false;
        }
        if (isset(self::$commandCache[$binary])) {
            return self::$commandCache[$binary];
        }
        return self::$commandCache[$binary] = self::detectCommand($binary);
    }

    private static function detectCommand(string $binary): bool
    {
        if (str_contains($binary, '/')) {
            return is_file($binary) && is_executable($binary);
        }
        if (!function_exists('proc_open')) {
            return false;
        }
        $path = self::capture(['which', $binary]);
        return $path !== null && $path !== '';
    }

    /**
     * @return array<string,string>
     */
    public static function baseEnv(): array
    {
        $env = [];
        foreach (['PATH', 'HOME', 'LANG', 'TMPDIR', 'USER', 'JAVA_HOME', 'LD_LIBRARY_PATH'] as $key) {
            $value = getenv($key);
            if ($value !== false) {
                $env[$key] = $value;
            }
        }
        $env['PATH'] ??= '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin';
        $env['HOME'] ??= '/tmp';
        $env['LANG'] ??= 'C.UTF-8';
        return $env;
    }
}
