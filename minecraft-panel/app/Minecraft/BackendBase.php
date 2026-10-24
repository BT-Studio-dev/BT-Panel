<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;

abstract class BackendBase implements ProcessBackend
{
    public function __construct(protected readonly string $binary)
    {
    }

    /**
     * @param list<string> $argv
     */
    protected function script(string $workDir, array $argv, string $logFile): string
    {
        $parts = array_map(static fn (string $part): string => escapeshellarg($part), $argv);
        // Every element is escaped individually and `exec` replaces bash so the
        // JVM is the session leader and receives signals directly.
        return sprintf(
            'cd %s || exit 1; exec %s >> %s 2>&1',
            escapeshellarg($workDir),
            implode(' ', $parts),
            escapeshellarg($logFile),
        );
    }

    public function attachCommand(string $session): string
    {
        return $this->binary . ' -r ' . $session;
    }

    public function available(): bool
    {
        return ProcessRunner::commandExists($this->binary);
    }
}
