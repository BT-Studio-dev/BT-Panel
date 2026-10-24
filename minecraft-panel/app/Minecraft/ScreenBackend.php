<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;

final class ScreenBackend extends BackendBase
{
    public function name(): string
    {
        return 'screen';
    }

    public function start(string $workDir, array $argv, string $logFile, string $session): void
    {
        $result = ProcessRunner::run(
            [$this->binary, '-dmS', $session, 'bash', '-c', $this->script($workDir, $argv, $logFile)],
            null,
            10,
        );
        if ($result['code'] !== 0) {
            throw new HttpError(500, 'screen failed to start: ' . trim($result['stderr'] ?: $result['stdout']));
        }
    }

    public function stopSession(string $session): void
    {
        ProcessRunner::run([$this->binary, '-S', $session, '-X', 'quit'], null, 5);
    }

    public function attachCommand(string $session): string
    {
        return sprintf('screen -r %s', $session);
    }
}
