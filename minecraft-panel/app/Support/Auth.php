<?php

declare(strict_types=1);

namespace Btp\Support;

use Btp\Http\HttpError;

/**
 * Authentication and authorization.
 *
 * Sessions are opaque random tokens stored hashed in SQLite, delivered in an
 * HttpOnly cookie. Roles are `admin` (full control) and `member` (access only
 * to servers they own or were invited to).
 */
final class Auth
{
    public const COOKIE = 'btp_mc_session';
    private const TOKEN_TTL_DAYS = 14;
    private const MAX_ATTEMPTS = 8;
    private const ATTEMPT_WINDOW_MINUTES = 15;

    /** @var array<string,mixed>|null */
    private static ?array $cachedUser = null;
    private static bool $resolved = false;

    /** @return array<string,mixed>|null */
    public static function user(): ?array
    {
        if (self::$resolved) {
            return self::$cachedUser;
        }
        self::$resolved = true;

        $token = $_COOKIE[self::COOKIE] ?? '';
        if (!is_string($token) || strlen($token) < 32) {
            return null;
        }
        $hash = hash('sha256', $token);
        $row = Db::one(
            'SELECT u.id, u.email, u.name, u.role, u.created_at, s.expires_at
             FROM sessions s JOIN users u ON u.id = s.user_id
             WHERE s.token_hash = :hash',
            ['hash' => $hash],
        );
        if ($row === null) {
            return null;
        }
        if (strtotime((string) $row['expires_at']) < time()) {
            Db::run('DELETE FROM sessions WHERE token_hash = :hash', ['hash' => $hash]);
            return null;
        }
        self::$cachedUser = $row;
        return $row;
    }

    /** @return array<string,mixed> */
    public static function requireUser(): array
    {
        $user = self::user();
        if ($user === null) {
            throw new HttpError(401, 'Sign in to continue.');
        }
        return $user;
    }

    /** @return array<string,mixed> */
    public static function requireAdmin(): array
    {
        $user = self::requireUser();
        if (($user['role'] ?? '') !== 'admin') {
            throw new HttpError(403, 'Administrator access required.');
        }
        return $user;
    }

    public static function isAdmin(?array $user = null): bool
    {
        $user ??= self::user();
        return ($user['role'] ?? '') === 'admin';
    }

    /**
     * Throttle login attempts per email + IP.
     */
    public static function assertNotThrottled(string $email): void
    {
        Db::run(
            'DELETE FROM login_attempts WHERE created_at < :cutoff',
            ['cutoff' => gmdate('c', time() - 86400)],
        );
        $count = (int) Db::scalar(
            'SELECT COUNT(*) FROM login_attempts
             WHERE (email = :email OR ip = :ip) AND created_at > :cutoff',
            [
                'email' => mb_strtolower($email),
                'ip' => btp_client_ip(),
                'cutoff' => gmdate('c', time() - self::ATTEMPT_WINDOW_MINUTES * 60),
            ],
        );
        if ($count >= self::MAX_ATTEMPTS) {
            throw new HttpError(429, 'Too many sign-in attempts. Wait a few minutes and try again.');
        }
    }

    /**
     * @return array<string,mixed> the signed-in user
     */
    public static function attempt(string $email, string $password): array
    {
        $email = mb_strtolower(trim($email));
        if ($email === '' || $password === '') {
            throw new HttpError(422, 'Email and password are required.');
        }
        self::assertNotThrottled($email);

        $user = Db::one('SELECT * FROM users WHERE email = :email', ['email' => $email]);
        if ($user === null || !password_verify($password, (string) $user['password_hash'])) {
            Db::insert('login_attempts', [
                'email' => $email,
                'ip' => btp_client_ip(),
                'created_at' => gmdate('c'),
            ]);
            // Constant-ish response for unknown users.
            password_verify($password, '$2y$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
            throw new HttpError(401, 'Incorrect email or password.');
        }

        if (password_needs_rehash((string) $user['password_hash'], PASSWORD_DEFAULT)) {
            Db::run('UPDATE users SET password_hash = :hash WHERE id = :id', [
                'hash' => password_hash($password, PASSWORD_DEFAULT),
                'id' => $user['id'],
            ]);
        }

        Db::run('DELETE FROM login_attempts WHERE email = :email', ['email' => $email]);
        Db::run('UPDATE users SET last_login_at = :now WHERE id = :id', [
            'now' => gmdate('c'),
            'id' => $user['id'],
        ]);
        self::startSession((int) $user['id']);
        Audit::log('auth.login', null, $email, (int) $user['id']);
        return $user;
    }

    public static function startSession(int $userId): void
    {
        $token = bin2hex(random_bytes(32));
        $expires = gmdate('c', time() + self::TOKEN_TTL_DAYS * 86400);
        Db::insert('sessions', [
            'token_hash' => hash('sha256', $token),
            'user_id' => $userId,
            'created_at' => gmdate('c'),
            'expires_at' => $expires,
            'ip' => btp_client_ip(),
            'user_agent' => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        ]);
        setcookie(self::COOKIE, $token, [
            'expires' => time() + self::TOKEN_TTL_DAYS * 86400,
            'path' => '/',
            'httponly' => true,
            'secure' => (bool) btp_config()['secure_cookies'],
            'samesite' => 'Lax',
        ]);
        self::$cachedUser = null;
        self::$resolved = false;
    }

    public static function logout(): void
    {
        $token = $_COOKIE[self::COOKIE] ?? '';
        if (is_string($token) && $token !== '') {
            Db::run('DELETE FROM sessions WHERE token_hash = :hash', ['hash' => hash('sha256', $token)]);
        }
        setcookie(self::COOKIE, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'httponly' => true,
            'secure' => (bool) btp_config()['secure_cookies'],
            'samesite' => 'Lax',
        ]);
        self::$cachedUser = null;
        self::$resolved = false;
    }

    /**
     * @return array<string,mixed>
     */
    public static function createUser(string $email, string $password, string $name, string $role = 'member'): array
    {
        $email = mb_strtolower(trim($email));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpError(422, 'Enter a valid email address.');
        }
        if (mb_strlen($password) < 10) {
            throw new HttpError(422, 'Password must be at least 10 characters.');
        }
        if (!in_array($role, ['admin', 'member'], true)) {
            throw new HttpError(422, 'Unknown role.');
        }
        if (Db::one('SELECT id FROM users WHERE email = :email', ['email' => $email]) !== null) {
            throw new HttpError(409, 'An account with that email already exists.');
        }
        $id = Db::insert('users', [
            'email' => $email,
            'name' => mb_substr(trim($name) ?: $email, 0, 120),
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => $role,
            'created_at' => gmdate('c'),
        ]);
        $user = Db::one('SELECT id, email, name, role, created_at FROM users WHERE id = :id', ['id' => $id]);
        return $user ?? [];
    }

    /**
     * Servers the user may see: all for admins, owned/invited for members.
     *
     * @param array<string,mixed> $user
     */
    public static function canAccessServer(array $user, string $serverId): bool
    {
        if (self::isAdmin($user)) {
            return true;
        }
        return Db::one(
            'SELECT 1 FROM servers s
             LEFT JOIN server_users su ON su.server_id = s.id AND su.user_id = :uid
             WHERE s.id = :sid AND (s.owner_id = :uid OR su.user_id IS NOT NULL)',
            ['uid' => (int) $user['id'], 'sid' => $serverId],
        ) !== null;
    }

    public static function countAdmins(): int
    {
        return (int) Db::scalar("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    }

    public static function countUsers(): int
    {
        return (int) Db::scalar('SELECT COUNT(*) FROM users');
    }
}
