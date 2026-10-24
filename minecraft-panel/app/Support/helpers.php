<?php

declare(strict_types=1);

/**
 * Global helper functions. Loaded by bootstrap.php for every entry point.
 */

use Btp\Http\HttpError;

/**
 * HTML-escape a value for output.
 */
function btp_e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Build an absolute URL path for a panel asset or route.
 *
 * Works when the panel is served from a sub-directory (e.g. /mc-panel) as well
 * as from a dedicated virtual host.
 */
function btp_url(string $path = ''): string
{
    static $base = null;
    if ($base === null) {
        $override = (string) (getenv('BTP_BASE_PATH') ?: '');
        if ($override !== '') {
            $base = rtrim($override, '/');
        } else {
            $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
            $computed = rtrim(dirname($script), '/');
            $base = ($computed === '.' || $computed === '/') ? '' : $computed;
        }
    }
    return $base . '/' . ltrim($path, '/');
}

/**
 * Absolute URL including scheme and host, used in emails and OAuth callbacks.
 * Honours a reverse proxy via X-Forwarded-Proto only when explicitly trusted.
 */
function btp_absolute_url(string $path = ''): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    if (btp_env('BTP_TRUST_PROXY') === '1' && ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
        $https = true;
    }
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
    return ($https ? 'https://' : 'http://') . $host . btp_url($path);
}

/**
 * Send a one-shot flash message to the next page load.
 */
function btp_flash(string $message, string $type = 'ok'): void
{
    \Btp\Support\Session::flash(['type' => $type, 'message' => $message]);
}

/**
 * Human readable byte size.
 */
function btp_bytes(int|float|null $bytes, int $precision = 1): string
{
    $bytes = (float) ($bytes ?? 0);
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $index = 0;
    while (abs($bytes) >= 1024 && $index < count($units) - 1) {
        $bytes /= 1024;
        $index++;
    }
    return ($index === 0 ? (string) (int) $bytes : number_format($bytes, $precision)) . ' ' . $units[$index];
}

/**
 * Seconds into a compact uptime label (e.g. "3d 04h").
 */
function btp_duration(int $seconds): string
{
    $seconds = max(0, $seconds);
    $days = intdiv($seconds, 86400);
    $hours = intdiv($seconds % 86400, 3600);
    $minutes = intdiv($seconds % 3600, 60);
    if ($days > 0) {
        return sprintf('%dd %02dh', $days, $hours);
    }
    if ($hours > 0) {
        return sprintf('%dh %02dm', $hours, $minutes);
    }
    if ($minutes > 0) {
        return sprintf('%dm %02ds', $minutes, $seconds % 60);
    }
    return $seconds . 's';
}

/**
 * Random URL-safe token.
 */
function btp_token(int $bytes = 24): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

/**
 * Validate that a string looks like a UUID v4 used as a public record id.
 */
function btp_is_uuid(string $value): bool
{
    return (bool) preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $value);
}

/**
 * Slug used for directory names. Never trust user input for paths.
 */
function btp_slug(string $value, int $max = 32): string
{
    $value = strtolower(trim($value));
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    $value = trim($value, '-');
    if ($value === '') {
        $value = 'server';
    }
    return substr($value, 0, $max);
}

/**
 * Read a JSON request body as an associative array.
 *
 * @return array<string,mixed>
 */
function btp_json_body(): array
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }
    $raw = file_get_contents('php://input');
    // CLI route tests (tests/run-http.php) have no request stream.
    if (($raw === false || trim($raw) === '') && defined('BTP_JSON_BODY_OVERRIDE')) {
        $raw = (string) BTP_JSON_BODY_OVERRIDE;
    }
    if ($raw === false || trim($raw) === '') {
        $body = [];
        return $body;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new HttpError(400, 'Request body must be a JSON object.');
    }
    $body = $decoded;
    return $body;
}

/**
 * Pull a validated scalar from an array.
 */
function btp_str(array $data, string $key, ?string $default = null, int $max = 4096): ?string
{
    if (!array_key_exists($key, $data) || $data[$key] === null) {
        return $default;
    }
    if (!is_scalar($data[$key])) {
        throw new HttpError(422, sprintf('%s must be a string.', $key));
    }
    $value = trim((string) $data[$key]);
    if (mb_strlen($value) > $max) {
        throw new HttpError(422, sprintf('%s is too long.', $key));
    }
    return $value;
}

/**
 * Pull an integer from an array with bounds.
 */
function btp_int(array $data, string $key, int $default, int $min, int $max): int
{
    if (!array_key_exists($key, $data) || $data[$key] === null || $data[$key] === '') {
        return $default;
    }
    if (!is_numeric($data[$key])) {
        throw new HttpError(422, sprintf('%s must be a number.', $key));
    }
    $value = (int) $data[$key];
    if ($value < $min || $value > $max) {
        throw new HttpError(422, sprintf('%s must be between %d and %d.', $key, $min, $max));
    }
    return $value;
}

/**
 * Pull a boolean flag.
 */
function btp_bool(array $data, string $key, bool $default = false): bool
{
    if (!array_key_exists($key, $data)) {
        return $default;
    }
    return filter_var($data[$key], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
}

/**
 * Send a JSON response and stop. Always sets no-store for authenticated data.
 *
 * @param mixed $payload
 */
function btp_json(mixed $payload, int $status = 200): never
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, max-age=0');
        header('X-Content-Type-Options: nosniff');
    }
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PARTIAL_OUTPUT_ON_ERROR);
    exit;
}

/**
 * Redirect and stop.
 */
function btp_redirect(string $location, int $status = 302): never
{
    if (!headers_sent()) {
        header('Location: ' . $location, true, $status);
    }
    exit;
}

/**
 * Reject the request with an HTTP error.
 */
function btp_abort(int $status, string $message): never
{
    throw new HttpError($status, $message);
}

/**
 * Render a view from app/Views with the shared layout data.
 *
 * @param array<string,mixed> $data
 */
function btp_view(string $template, array $data = [], int $status = 200): never
{
    $file = BTP_APP . '/Views/' . str_replace('..', '', $template) . '.php';
    if (!is_file($file)) {
        http_response_code(500);
        echo 'Missing view: ' . btp_e($template);
        exit;
    }
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: text/html; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: same-origin');
    }
    extract($data, EXTR_SKIP);
    require $file;
    exit;
}

/**
 * True when the current request expects JSON (XHR / fetch / API path).
 */
function btp_wants_json(): bool
{
    $accept = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));
    $requestedWith = strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? ''));
    $path = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    return str_contains($accept, 'application/json')
        || $requestedWith === 'xmlhttprequest'
        || str_contains($path, '/api/');
}

/**
 * Request IP, respecting the reverse proxy only when configured.
 */
function btp_client_ip(): string
{
    if (btp_env('BTP_TRUST_PROXY') === '1') {
        $forwarded = (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
        if ($forwarded !== '') {
            $first = trim(explode(',', $forwarded)[0]);
            if (filter_var($first, FILTER_VALIDATE_IP)) {
                return $first;
            }
        }
    }
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

/**
 * JSON-decode a database text column defensively.
 *
 * @return array<string,mixed>
 */
function btp_json_decode(?string $value, array $fallback = []): array
{
    if ($value === null || $value === '') {
        return $fallback;
    }
    $decoded = json_decode($value, true);
    return is_array($decoded) ? $decoded : $fallback;
}

/**
 * Relative "time ago" label for timestamps stored as ISO-8601 UTC.
 */
function btp_ago(?string $iso): string
{
    if ($iso === null || $iso === '') {
        return 'never';
    }
    $time = strtotime($iso);
    if ($time === false) {
        return 'unknown';
    }
    $diff = time() - $time;
    if ($diff < 0) {
        return 'just now';
    }
    if ($diff < 60) {
        return $diff . 's ago';
    }
    if ($diff < 3600) {
        return intdiv($diff, 60) . 'm ago';
    }
    if ($diff < 86400) {
        return intdiv($diff, 3600) . 'h ago';
    }
    if ($diff < 2592000) {
        return intdiv($diff, 86400) . 'd ago';
    }
    return gmdate('Y-m-d', $time);
}

/**
 * Absolute local timestamp.
 */
function btp_datetime(?string $iso): string
{
    if ($iso === null || $iso === '') {
        return '—';
    }
    $time = strtotime($iso);
    return $time === false ? '—' : date('Y-m-d H:i', $time);
}

/**
 * Render one console line with a severity class. Server output is untrusted
 * text: always escaped.
 */
function btp_console_line(string $line): string
{
    $trimmed = rtrim($line);
    if ($trimmed === '') {
        return '';
    }
    $class = '';
    if (preg_match('/\/\s*(ERROR|SEVERE|FATAL)\b/i', $trimmed) === 1
        || preg_match('/Exception|Caused by:|Failed to start/i', $trimmed) === 1) {
        $class = 'error';
    } elseif (preg_match('/\/\s*(WARN|WARNING)\b/i', $trimmed) === 1) {
        $class = 'warn';
    } elseif (preg_match('/\/\s*INFO\b/i', $trimmed) === 1) {
        $class = 'info';
    }
    if (preg_match('/joined the game/i', $trimmed) === 1) {
        $class = 'join';
    }
    return '<div class="line ' . $class . '">' . btp_e($trimmed) . '</div>';
}
