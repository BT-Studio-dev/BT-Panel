<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;

final class NohupBackend extends BackendBase
{
    public function __construct()
    {
        parent::__construct('bash');
    }

    public function name(): string
    {
        return 'nohup';
    }

    public function available(): bool
    {
        return ProcessRunner::commandExists('bash') && ProcessRunner::commandExists('setsid');
    }

    public function start(string $workDir, array $argv, string $logFile, string $session): void
    {
        $script = $this->script($workDir, $argv, $logFile);
        $wrapped = sprintf('setsid %s < /dev/null > /dev/null 2>&1 & echo $!', $script);
        $result = ProcessRunner::run(['bash', '-c', $wrapped], null, 10);
        if ($result['code'] !== 0) {
            throw new HttpError(500, 'Failed to launch server process.');
        }
    }

    public function stopSession(string $session): void
    {
        // Nothing to stop: the JVM is stopped by pid.
    }

    public function attachCommand(string $session): string
    {
        return '(no attached console available — use RCON from the panel)';
    }
}
