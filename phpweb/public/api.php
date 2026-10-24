<?php

declare(strict_types=1);

define('PHPWEB_API', true);
require_once dirname(__DIR__) . '/src/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function api_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}

function api_error(string $message, int $status = 400): never
{
    api_response(['error' => $message], $status);
}

function api_user(Store $store): array
{
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+(btp_[a-f0-9]{48})$/i', $authorization, $matches)) {
        api_error('Provide a valid Authorization: Bearer API key.', 401);
    }
    $hash = hash('sha256', $matches[1]);
    $data = $store->read();
    $matched = null;
    foreach ($data['api_keys'] as $key) {
        if (hash_equals($key['token_hash'], $hash)) {
            $matched = $key;
            break;
        }
    }
    if (!$matched || ($matched['expires_at'] && strtotime($matched['expires_at']) <= time())) {
        api_error('API key is invalid, revoked, or expired.', 401);
    }
    $user = find_user($data, $matched['user_id']);
    if (!$user || $user['status'] !== 'active') {
        api_error('The API key owner is unavailable or suspended.', 401);
    }
    if (!$matched['last_used_at'] || time() - strtotime($matched['last_used_at']) > 60) {
        $store->update(static function (array $next) use ($matched): array {
            foreach ($next['api_keys'] as &$key) {
                if ($key['id'] === $matched['id']) $key['last_used_at'] = gmdate(DATE_ATOM);
            }
            unset($key);
            return $next;
        });
    }
    return $user;
}

function api_admin(array $user): void
{
    if (!is_admin($user)) api_error('Administrator permission required.', 403);
}

function api_key_dto(array $key, array $data): array
{
    $owner = find_user($data, $key['user_id']);
    unset($key['token_hash'], $key['user_id']);
    $key['owner_name'] = $owner['username'] ?? 'Unknown';
    return $key;
}

try {
    $user = api_user($store);
    $data = $store->read();
    $method = strtoupper($_SERVER['REQUEST_METHOD']);
    $resource = (string) ($_GET['resource'] ?? 'overview');
    $servers = visible_servers($data, $user);

    if ($method === 'GET' && $resource === 'servers') {
        api_response(['servers' => $servers]);
    }
    if ($method === 'GET' && $resource === 'overview') {
        api_response([
            'servers' => count($servers),
            'running' => count(array_filter($servers, static fn (array $server): bool => $server['status'] === 'running')),
            'users' => is_admin($user) ? count($data['users']) : null,
            'panel' => $data['settings']['panel_name'],
        ]);
    }
    if ($method === 'GET' && $resource === 'activity') {
        $ids = array_map(static fn (array $server): string => $server['id'], $servers);
        $events = array_values(array_filter(server_events($data), static fn (array $event): bool => in_array($event['server_id'], $ids, true)));
        api_response(['activity' => array_slice($events, 0, 150)]);
    }
    if ($method === 'GET' && $resource === 'nodes') {
        api_response(['nodes' => panel_nodes()]);
    }
    if ($method === 'GET' && $resource === 'templates') {
        api_response(['templates' => panel_templates()]);
    }
    if ($method === 'GET' && $resource === 'settings') {
        api_response(['settings' => $data['settings']]);
    }
    if ($method === 'GET' && $resource === 'api-keys') {
        api_admin($user);
        api_response(['keys' => array_map(static fn (array $key): array => api_key_dto($key, $data), $data['api_keys'])]);
    }

    $body = [];
    if (in_array($method, ['POST', 'DELETE'], true)) {
        $raw = file_get_contents('php://input') ?: '';
        if ($raw !== '') {
            $body = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($body)) api_error('JSON body must be an object.');
        }
    }

    if ($method === 'POST' && $resource === 'power') {
        $id = (string) ($body['server_id'] ?? '');
        $power = (string) ($body['action'] ?? '');
        $server = find_server($data, $id);
        if (!$server || !can_manage_server($user, $server)) api_error('Server not found or permission denied.', 404);
        if (!in_array($power, ['start', 'stop', 'restart', 'kill'], true)) api_error('Unknown power action.');
        $updated = $store->update(static function (array $next) use ($id, $power): array {
            foreach ($next['servers'] as &$server) {
                if ($server['id'] !== $id) continue;
                $server['status'] = in_array($power, ['start', 'restart'], true) ? 'running' : 'offline';
                $server['started_at'] = $server['status'] === 'running' ? gmdate(DATE_ATOM) : null;
                add_event($next, $id, 'system', 'API power action: ' . $power . '.');
            }
            unset($server);
            return $next;
        });
        api_response(['server' => find_server($updated, $id)]);
    }

    if ($method === 'POST' && $resource === 'api-keys') {
        api_admin($user);
        $name = trim((string) ($body['name'] ?? ''));
        $days = (int) ($body['expires_in_days'] ?? 0);
        if (strlen($name) < 2 || strlen($name) > 60) api_error('Key name must be 2–60 characters.');
        if (!in_array($days, [0, 7, 30, 90, 365], true)) api_error('Unsupported expiration.');
        $secret = 'btp_' . bin2hex(random_bytes(24));
        $updated = $store->update(static function (array $next) use ($user, $name, $days, $secret): array {
            $next['api_keys'][] = [
                'id' => new_id('key'), 'user_id' => $user['id'], 'name' => $name,
                'prefix' => substr($secret, 0, 12), 'token_hash' => hash('sha256', $secret),
                'created_at' => gmdate(DATE_ATOM), 'last_used_at' => null,
                'expires_at' => $days ? gmdate(DATE_ATOM, time() + $days * 86400) : null,
            ];
            return $next;
        });
        $key = end($updated['api_keys']);
        api_response(['key' => api_key_dto($key, $updated), 'secret' => $secret], 201);
    }

    if ($method === 'DELETE' && $resource === 'api-keys') {
        api_admin($user);
        $id = (string) ($body['id'] ?? $_GET['id'] ?? '');
        $store->update(static function (array $next) use ($id): array {
            $next['api_keys'] = array_values(array_filter($next['api_keys'], static fn (array $key): bool => $key['id'] !== $id));
            return $next;
        });
        api_response(['ok' => true]);
    }

    api_error('API resource not found.', 404);
} catch (JsonException $error) {
    api_error('Invalid JSON request.');
} catch (Throwable $error) {
    error_log('[bt-panel-phpweb] ' . $error->getMessage());
    api_error('Internal server error.', 500);
}
