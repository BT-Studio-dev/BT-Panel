<?php

declare(strict_types=1);

namespace Btp\Http;

use Btp\Support\Session;

/**
 * Synchroniser-token CSRF protection for state-changing requests.
 *
 * The token is rendered into every page and echoed by `public/assets/app.js`
 * in the `X-CSRF-Token` header. Requests are additionally rejected when the
 * `Origin`/`Referer` host differs from the panel host.
 */
final class Csrf
{
    public const SESSION_KEY = '_csrf';
    public const HEADER = 'HTTP_X_CSRF_TOKEN';

    public static function token(): string
    {
        Session::start();
        $token = Session::get(self::SESSION_KEY);
        if (!is_string($token) || strlen($token) < 32) {
            $token = bin2hex(random_bytes(32));
            Session::put(self::SESSION_KEY, $token);
        }
        return $token;
    }

    public static function tokenFromRequest(): string
    {
        $header = (string) ($_SERVER[self::HEADER] ?? '');
        if ($header !== '') {
            return $header;
        }
        $post = $_POST['_csrf'] ?? '';
        return is_string($post) ? $post : '';
    }

    /**
     * Enforce the token for unsafe HTTP methods.
     */
    public static function verify(): void
    {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if (in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
            return;
        }
        self::verifyOrigin();
        $expected = Session::get(self::SESSION_KEY);
        $provided = self::tokenFromRequest();
        if (!is_string($expected) || $expected === '' || $provided === '' || !hash_equals($expected, $provided)) {
            throw new HttpError(419, 'Your session token expired. Reload the page and try again.');
        }
    }

    /**
     * Reject cross-site form posts when a browser sends Origin/Referer.
     */
    private static function verifyOrigin(): void
    {
        $host = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
        if ($host === '') {
            return;
        }
        foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $key) {
            $value = (string) ($_SERVER[$key] ?? '');
            if ($value === '' || $value === 'null') {
                if ($value === 'null') {
                    throw new HttpError(403, 'Cross-site request blocked.');
                }
                continue;
            }
            $originHost = strtolower((string) parse_url($value, PHP_URL_HOST));
            $originPort = parse_url($value, PHP_URL_PORT);
            $hostOnly = strtolower((string) parse_url('http://' . $host, PHP_URL_HOST));
            $hostPort = parse_url('http://' . $host, PHP_URL_PORT);
            if ($originHost !== $hostOnly || ($originPort !== null && $hostPort !== null && (int) $originPort !== (int) $hostPort)) {
                throw new HttpError(403, 'Cross-site request blocked.');
            }
        }
    }
}
