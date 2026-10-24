<?php

declare(strict_types=1);

namespace Btp\Support;

use Btp\Http\HttpError;

/**
 * Fixed-window rate limiting for unauthenticated endpoints (registration,
 * password reset, Google sign-in). Backed by SQLite so it survives restarts and
 * is shared between PHP-FPM workers.
 */
final class RateLimiter
{
    /**
     * Record an attempt and throw 429 once the window is exhausted.
     *
     * @param string $bucket logical action, e.g. "register" or "reset"
     * @param string $key    normalised subject (email) — IP is always included
     */
    public static function hit(string $bucket, string $key, int $limit, int $windowSeconds, bool $countIp = true): void
    {
        $now = time();
        Db::run('DELETE FROM rate_events WHERE created_at < :cutoff', [
            'cutoff' => gmdate('c', $now - 86400),
        ]);

        $key = mb_strtolower($key);
        $ip = btp_client_ip();
        $params = [
            'bucket' => $bucket,
            'cutoff' => gmdate('c', $now - $windowSeconds),
        ];

        // Count events for this subject (email) or this IP. At least one clause
        // always applies so the query is never unbounded, and only parameters
        // that appear in the SQL are bound.
        $subject = [];
        if ($key !== '') {
            $subject[] = 'key = :key';
            $params['key'] = $key;
        }
        if ($countIp) {
            $subject[] = 'ip = :ip';
            $params['ip'] = $ip;
        }
        if ($subject === []) {
            $subject[] = 'key = :key';
            $params['key'] = $key;
        }

        $count = (int) Db::scalar(
            sprintf(
                'SELECT COUNT(*) FROM rate_events WHERE bucket = :bucket AND (%s) AND created_at > :cutoff',
                implode(' OR ', $subject),
            ),
            $params,
        );

        if ($count >= $limit) {
            throw new HttpError(429, 'Too many attempts. Wait a few minutes and try again.');
        }

        Db::insert('rate_events', [
            'bucket' => $bucket,
            'key' => $key,
            'ip' => $ip,
            'created_at' => gmdate('c'),
        ]);
    }

    public static function clear(string $bucket, string $key): void
    {
        Db::run('DELETE FROM rate_events WHERE bucket = :bucket AND key = :key', [
            'bucket' => $bucket,
            'key' => mb_strtolower($key),
        ]);
    }
}
