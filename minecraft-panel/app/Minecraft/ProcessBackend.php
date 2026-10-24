<?php

declare(strict_types=1);

namespace Btp\Minecraft;

/**
 * A detachable process supervisor used to keep a Minecraft server alive after
 * the PHP request ends. Status detection is done separately through a unique
 * JVM marker (`-Dbtp.server=<id>`), so every backend behaves the same.
 */
interface ProcessBackend
{
    public function name(): string;

    /**
     * Launch the server detached. `$argv` must already be a safe argv list.
     *
     * @param list<string> $argv
     */
    public function start(string $workDir, array $argv, string $logFile, string $session): void;

    /**
     * Terminate the supervisor session (the JVM is stopped separately).
     */
    public function stopSession(string $session): void;

    /**
     * Returns true when the backend can be used on this host.
     */
    public function available(): bool;

    /**
     * Command an operator can run in SSH to attach to the live console.
     */
    public function attachCommand(string $session): string;
}
