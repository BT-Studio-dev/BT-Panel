<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;

/**
 * Minimal Minecraft RCON client (Source RCON protocol).
 *
 * Packet layout: int32 length | int32 request id | int32 type | payload | \0\0
 * Types: 3 = login, 2 = command, 0 = response.
 */
final class Rcon
{
    private const TYPE_RESPONSE = 0;
    private const TYPE_COMMAND = 2;
    private const TYPE_AUTH = 3;
    private const MAX_PACKET = 4194304;

    /** @var resource|null */
    private $socket = null;
    private int $requestId = 0;

    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $password,
        private readonly float $timeout = 4.0,
    ) {
    }

    /**
     * Send one command and return the response text.
     */
    public static function execute(string $host, int $port, string $password, string $command, float $timeout = 4.0): string
    {
        $client = new self($host, $port, $password, $timeout);
        $client->connect();
        try {
            // Authentication packet; the server replies with the same id on success.
            $authId = $client->nextId();
            $client->write($authId, self::TYPE_AUTH, $password);
            $reply = $client->read();
            if ($reply === null) {
                throw new HttpError(502, 'RCON authentication timed out.');
            }
            if ($reply['id'] === -1 || $reply['type'] !== self::TYPE_RESPONSE) {
                throw new HttpError(502, 'RCON authentication failed. Check the RCON password.');
            }
            $client->write($client->nextId(), self::TYPE_COMMAND, $command);
            $response = $client->read();
            return $response['body'] ?? '';
        } finally {
            $client->close();
        }
    }

    public function connect(): void
    {
        if ($this->password === '') {
            throw new HttpError(409, 'RCON is not configured for this server.');
        }
        $target = sprintf('tcp://%s:%d', $this->host, $this->port);
        $socket = @stream_socket_client($target, $errno, $errstr, $this->timeout);
        if (!is_resource($socket)) {
            throw new HttpError(502, sprintf('Cannot reach RCON at %s (%s).', $target, $errstr ?: 'connection refused'));
        }
        stream_set_timeout($socket, (int) ceil($this->timeout));
        $this->socket = $socket;
    }

    public function close(): void
    {
        if (is_resource($this->socket)) {
            fclose($this->socket);
        }
        $this->socket = null;
    }

    private function nextId(): int
    {
        return ++$this->requestId;
    }

    private function write(int $id, int $type, string $body): void
    {
        if (!is_resource($this->socket)) {
            throw new HttpError(502, 'RCON socket is closed.');
        }
        $payload = pack('VV', $id, $type) . $body . "\x00\x00";
        $packet = pack('V', strlen($payload)) . $payload;
        $written = @fwrite($this->socket, $packet);
        if ($written === false || $written < strlen($packet)) {
            throw new HttpError(502, 'Failed to write to the RCON socket.');
        }
    }

    /**
     * @return array{id:int,type:int,body:string}|null
     */
    private function read(): ?array
    {
        if (!is_resource($this->socket)) {
            return null;
        }
        $sizeBytes = $this->readExact(4);
        if ($sizeBytes === null) {
            return null;
        }
        $size = unpack('V', $sizeBytes)[1] ?? 0;
        if ($size < 10 || $size > self::MAX_PACKET) {
            throw new HttpError(502, 'Malformed RCON response.');
        }
        $payload = $this->readExact($size);
        if ($payload === null) {
            return null;
        }
        $parts = unpack('Vid/Vtype', substr($payload, 0, 8));
        $body = substr($payload, 8);
        return [
            'id' => (int) ($parts['id'] ?? 0),
            'type' => (int) ($parts['type'] ?? 0),
            'body' => rtrim($body, "\x00"),
        ];
    }

    private function readExact(int $length): ?string
    {
        $buffer = '';
        while (strlen($buffer) < $length) {
            $chunk = @fread($this->socket, $length - strlen($buffer));
            if ($chunk === false || $chunk === '') {
                $meta = stream_get_meta_data($this->socket);
                if (!empty($meta['timed_out'])) {
                    return null;
                }
                if (feof($this->socket)) {
                    return null;
                }
                continue;
            }
            $buffer .= $chunk;
        }
        return $buffer;
    }

    /**
     * Best-effort reachability check used by the dashboard/health views.
     */
    public static function ping(string $host, int $port, string $password): bool
    {
        if ($port <= 0 || $password === '') {
            return false;
        }
        $socket = @stream_socket_client(sprintf('tcp://%s:%d', $host, $port), $errno, $errstr, 1.0);
        if (!is_resource($socket)) {
            return false;
        }
        fclose($socket);
        return true;
    }
}
