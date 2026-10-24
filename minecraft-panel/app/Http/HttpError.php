<?php

declare(strict_types=1);

namespace Btp\Http;

use RuntimeException;

/**
 * An error that maps directly onto an HTTP response. Anything thrown that is
 * not an HttpError is treated as a 500 and logged without leaking details.
 */
final class HttpError extends RuntimeException
{
    public function __construct(
        private readonly int $status,
        string $message,
    ) {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }
}
