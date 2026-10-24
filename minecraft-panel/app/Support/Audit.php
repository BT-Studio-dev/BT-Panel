<?php

declare(strict_types=1);

namespace Btp\Support;

/**
 * Append-only activity log. Every mutating action goes through here so admins
 * can see who started, stopped, edited or deleted what.
 */
final class Audit
{
    public static function log(string $action, ?string $serverId = null, string $detail = '', ?int $userId = null): void
    {
        try {
            Db::insert('audit_log', [
                'user_id' => $userId ?? (Auth::user()['id'] ?? null),
                'server_id' => $serverId,
                'action' => mb_substr($action, 0, 60),
                'detail' => mb_substr($detail, 0, 500),
                'ip' => btp_client_ip(),
                'created_at' => gmdate('c'),
            ]);
        } catch (\Throwable) {
            // Auditing must never break the request path.
        }
    }

    /**
     * @return list<array<string,mixed>>
     */
    public static function recent(int $limit = 100): array
    {
        return Db::all(
            'SELECT a.*, u.email AS user_email, s.name AS server_name
             FROM audit_log a
             LEFT JOIN users u ON u.id = a.user_id
             LEFT JOIN servers s ON s.id = a.server_id
             ORDER BY a.id DESC LIMIT ' . max(1, min(500, $limit)),
        );
    }
}
