<?php

declare(strict_types=1);

namespace Btp\Support;

use Btp\Http\HttpError;

/**
 * Password reset tokens. Only a SHA-256 hash of the token is stored, so a copy
 * of the database cannot be used to take over accounts.
 */
final class PasswordReset
{
    private const TTL_MINUTES = 60;

    /**
     * Start a reset. The response is intentionally identical whether or not the
     * address exists, to avoid account enumeration.
     */
    public static function request(string $email): void
    {
        $email = mb_strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpError(422, 'Enter a valid email address.');
        }
        RateLimiter::hit('password-reset', $email, 5, 900);

        $user = Db::one('SELECT id, email, name FROM users WHERE email = :email', ['email' => $email]);
        if ($user === null) {
            // Spend a comparable amount of time and return quietly.
            usleep(random_int(120000, 260000));
            return;
        }

        $token = bin2hex(random_bytes(32));
        $now = gmdate('c');
        Db::run('UPDATE password_resets SET used_at = :now WHERE user_id = :id AND used_at IS NULL', [
            'now' => $now,
            'id' => (int) $user['id'],
        ]);
        Db::insert('password_resets', [
            'user_id' => (int) $user['id'],
            'token_hash' => hash('sha256', $token),
            'created_at' => $now,
            'expires_at' => gmdate('c', time() + self::TTL_MINUTES * 60),
        ]);

        $link = btp_absolute_url('reset?token=' . urlencode($token));
        $panel = Db::setting('panel_name', (string) btp_config()['panel_name']);
        $name = (string) ($user['name'] !== '' ? $user['name'] : $user['email']);
        $html = sprintf(
            '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111;line-height:1.55">'
            . '<h2 style="margin:0 0 12px">Reset your %s password</h2>'
            . '<p>Hi %s,</p>'
            . '<p>Someone asked to reset the password for your panel account. This link is valid for %d minutes and can be used once.</p>'
            . '<p style="margin:22px 0"><a href="%s" style="background:#d00000;color:#fff;padding:11px 18px;border-radius:10px;text-decoration:none;font-weight:700">Choose a new password</a></p>'
            . '<p style="font-size:13px;color:#666">If you did not request this, you can ignore the email — your password stays unchanged.</p>'
            . '<p style="font-size:12px;color:#888;word-break:break-all">%s</p></div>',
            btp_e($panel),
            btp_e($name),
            self::TTL_MINUTES,
            btp_e($link),
            btp_e($link),
        );
        $text = sprintf(
            "Reset your %s password\n\nHi %s,\n\nOpen this link within %d minutes to choose a new password:\n%s\n\nIf you did not request this, ignore this email.\n",
            $panel,
            $name,
            self::TTL_MINUTES,
            $link,
        );

        $sent = Mailer::send((string) $user['email'], 'Reset your ' . $panel . ' password', $html, $text);
        Audit::log('auth.reset.request', null, $email . ($sent ? '' : ' (mail failed: ' . (Mailer::lastError() ?? 'unknown') . ')'), (int) $user['id']);
    }

    /**
     * Resolve a raw token to its user, or null when invalid/expired/used.
     *
     * @return array<string,mixed>|null
     */
    public static function verify(string $token): ?array
    {
        if (!preg_match('/^[a-f0-9]{64}$/i', $token)) {
            return null;
        }
        $row = Db::one(
            'SELECT r.id AS reset_id, r.expires_at, r.used_at, u.*
             FROM password_resets r JOIN users u ON u.id = r.user_id
             WHERE r.token_hash = :hash LIMIT 1',
            ['hash' => hash('sha256', $token)],
        );
        if ($row === null) {
            return null;
        }
        if ($row['used_at'] !== null || strtotime((string) $row['expires_at']) < time()) {
            return null;
        }
        return $row;
    }

    /**
     * Consume a token and set the new password. The user is signed in on
     * success; every other session is revoked.
     *
     * @return array<string,mixed> the user
     */
    public static function consume(string $token, string $password, string $confirmation): array
    {
        $row = self::verify($token);
        if ($row === null) {
            throw new HttpError(422, 'This reset link is invalid or has expired. Request a new one.');
        }
        if ($password !== $confirmation) {
            throw new HttpError(422, 'The two passwords do not match.');
        }
        if (mb_strlen($password) < 10) {
            throw new HttpError(422, 'Password must be at least 10 characters.');
        }

        RateLimiter::hit('password-reset-consume', (string) $row['email'], 10, 900);
        Db::run('UPDATE password_resets SET used_at = :now WHERE id = :id', [
            'now' => gmdate('c'),
            'id' => (int) $row['reset_id'],
        ]);
        Auth::setPassword((int) $row['id'], $password);
        Auth::startSession((int) $row['id']);
        RateLimiter::clear('password-reset', (string) $row['email']);
        Audit::log('auth.reset.complete', null, (string) $row['email'], (int) $row['id']);

        return $row;
    }

    public static function cleanup(): void
    {
        Db::run('DELETE FROM password_resets WHERE expires_at < :cutoff', [
            'cutoff' => gmdate('c', time() - 86400),
        ]);
    }
}
