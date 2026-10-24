<?php

declare(strict_types=1);

date_default_timezone_set('UTC');

if (!defined('PHPWEB_API')) {
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('btp_phpweb');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
} else {
    $_SESSION = [];
}

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');

require_once __DIR__ . '/Store.php';
require_once __DIR__ . '/catalog.php';

$store = new Store(dirname(__DIR__) . '/storage/panel.json');

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function new_id(string $prefix): string
{
    return $prefix . '_' . bin2hex(random_bytes(8));
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function verify_csrf(): void
{
    $token = $_POST['csrf'] ?? '';
    if (!is_string($token) || !hash_equals(csrf_token(), $token)) {
        throw new RuntimeException('Your form expired. Go back, reload, and try again.');
    }
}

function redirect(string $query = ''): never
{
    header('Location: index.php' . ($query !== '' ? '?' . $query : ''));
    exit;
}

function post_return_query(): string
{
    $return = $_POST['return'] ?? '';
    return is_string($return) && preg_match('/^[a-zA-Z0-9_=&-]*$/D', $return) ? $return : '';
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function consume_flash(): ?array
{
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return is_array($flash) ? $flash : null;
}

function find_user(array $data, string $id): ?array
{
    foreach ($data['users'] as $user) {
        if ($user['id'] === $id) {
            return $user;
        }
    }
    return null;
}

function public_user(array $user): array
{
    unset($user['password']);
    return $user;
}

function is_admin(array $user): bool
{
    return in_array($user['role'], ['owner', 'admin'], true);
}

function current_user(array $data): ?array
{
    $id = $_SESSION['user_id'] ?? '';
    if (!is_string($id) || $id === '') {
        return null;
    }
    $user = find_user($data, $id);
    return $user && $user['status'] === 'active' ? $user : null;
}

function require_admin(array $user): void
{
    if (!is_admin($user)) {
        throw new RuntimeException('Administrator permission required.');
    }
}

function visible_servers(array $data, array $user): array
{
    if (is_admin($user)) {
        return $data['servers'];
    }
    return array_values(array_filter(
        $data['servers'],
        static fn (array $server): bool => $server['owner_id'] === $user['id'],
    ));
}

function find_server(array $data, string $id): ?array
{
    foreach ($data['servers'] as $server) {
        if ($server['id'] === $id) {
            return $server;
        }
    }
    return null;
}

function can_manage_server(array $user, array $server): bool
{
    return is_admin($user) || $server['owner_id'] === $user['id'];
}

function add_event(array &$data, string $serverId, string $level, string $message): void
{
    $data['events'][] = [
        'id' => $data['next_event_id']++,
        'server_id' => $serverId,
        'level' => $level,
        'message' => $message,
        'created_at' => gmdate(DATE_ATOM),
    ];
    if (count($data['events']) > 500) {
        $data['events'] = array_slice($data['events'], -500);
    }
}

function format_mb(int $mb): string
{
    return $mb >= 1024 ? rtrim(rtrim(number_format($mb / 1024, 1), '0'), '.') . ' GB' : $mb . ' MB';
}

function time_ago(?string $iso): string
{
    if (!$iso) {
        return 'never';
    }
    $seconds = max(0, time() - strtotime($iso));
    if ($seconds < 45) return 'just now';
    if ($seconds < 3600) return floor($seconds / 60) . 'm ago';
    if ($seconds < 86400) return floor($seconds / 3600) . 'h ago';
    return floor($seconds / 86400) . 'd ago';
}

function server_events(array $data, ?string $serverId = null): array
{
    $events = array_values(array_filter(
        $data['events'],
        static fn (array $event): bool => $serverId === null || $event['server_id'] === $serverId,
    ));
    usort($events, static fn (array $a, array $b): int => $b['id'] <=> $a['id']);
    return $events;
}

function event_server_name(array $data, string $serverId): string
{
    return find_server($data, $serverId)['name'] ?? 'Removed server';
}
