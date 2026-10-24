<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;

final class TmuxBackend extends BackendBase
{
    public function name(): string
    {
        return 'tmux';
    }

    public function start(string $workDir, array $argv, string $logFile, string $session): void
    {
        $result = ProcessRunner::run(
            [$this->binary, 'new-session', '-d', '-s', $session, 'bash', '-c', $this->script($workDir, $argv, $logFile)],
            null,
            10,
        );
        if ($result['code'] !== 0) {
            throw new HttpError(500, 'tmux failed to start: ' . trim($result['stderr'] ?: $result['stdout']));
        }
    }

    public function stopSession(string $session): void
    {
        ProcessRunner::run([$this->binary, 'kill-session', '-t', $session], null, 5);
    }

    public function attachCommand(string $session): string
    {
        return sprintf('tmux attach -t %s', $session);
    }
}

/**
 * Fallback for hosts without screen/tmux. The JVM is started with setsid and
 * left running; the web console still works through RCON.
 */
