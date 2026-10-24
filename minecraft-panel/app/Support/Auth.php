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
    public static function attempt(string $email, string $password, bool $remember = true): array
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
        self::startSession((int) $user['id'], $remember);
        Audit::log('auth.login', null, $email, (int) $user['id']);
        return $user;
    }

    public static function startSession(int $userId, bool $remember = true): void
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
        if (!headers_sent()) {
            setcookie(self::COOKIE, $token, [
                // Without "remember", the cookie dies with the browser session but
                // the server-side token still expires on schedule.
                'expires' => $remember ? time() + self::TOKEN_TTL_DAYS * 86400 : 0,
                'path' => '/',
                'httponly' => true,
                'secure' => (bool) btp_config()['secure_cookies'],
                'samesite' => 'Lax',
            ]);
        }
        self::$cachedUser = null;
        self::$resolved = false;
    }

    public static function logout(): void
    {
        $token = $_COOKIE[self::COOKIE] ?? '';
        if (is_string($token) && $token !== '') {
            Db::run('DELETE FROM sessions WHERE token_hash = :hash', ['hash' => hash('sha256', $token)]);
        }
        if (!headers_sent()) {
            setcookie(self::COOKIE, '', [
                'expires' => time() - 3600,
                'path' => '/',
                'httponly' => true,
                'secure' => (bool) btp_config()['secure_cookies'],
                'samesite' => 'Lax',
            ]);
        }
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


    /* ------------------------------------------------------------------ */
    /* Self-service registration                                           */
    /* ------------------------------------------------------------------ */

    public static function registrationOpen(): bool
    {
        return Db::setting('allow_registration', '1') === '1';
    }

    /**
     * Create a self-service account. Always gets the member role: only an
     * administrator can create another administrator.
     *
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    public static function register(array $input): array
    {
        if (!self::registrationOpen()) {
            throw new HttpError(403, 'Self-registration is disabled. Ask an administrator for an account.');
        }
        RateLimiter::hit('register', '', 5, 900);

        $email = btp_str($input, 'email', '', 190) ?? '';
        $password = (string) ($input['password'] ?? '');
        $confirmation = (string) ($input['password_confirm'] ?? '');
        $name = btp_str($input, 'name', '', 120) ?? '';

        if ($password !== $confirmation) {
            throw new HttpError(422, 'The two passwords do not match.');
        }
        if (Db::one('SELECT id FROM users WHERE email = :email', ['email' => mb_strtolower(trim($email))]) !== null) {
            throw new HttpError(409, 'An account with that email already exists. Sign in instead.');
        }

        $user = self::createUser($email, $password, $name, 'member');
        Audit::log('auth.register', null, (string) $user['email'], (int) $user['id']);
        return $user;
    }

    /**
     * Authenticate a Google profile: link an existing account by email, or
     * create one when registration is open.
     *
     * @param array{google_id:string,email:string,name:string,avatar:string,email_verified:bool} $profile
     * @return array<string,mixed>
     */
    public static function signInWithGoogle(array $profile): array
    {
        $email = mb_strtolower(trim($profile['email']));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new HttpError(422, 'Google did not return a usable email address.');
        }
        if (!$profile['email_verified']) {
            throw new HttpError(403, 'Your Google account email is not verified.');
        }

        $byGoogle = Db::one('SELECT * FROM users WHERE google_id = :gid', ['gid' => $profile['google_id']]);
        if ($byGoogle !== null) {
            self::touchGoogle($byGoogle, $profile);
            self::startSession((int) $byGoogle['id']);
            Audit::log('auth.google', null, $email, (int) $byGoogle['id']);
            return $byGoogle;
        }

        $byEmail = Db::one('SELECT * FROM users WHERE email = :email', ['email' => $email]);
        if ($byEmail !== null) {
            // A verified Google address is proof of ownership, so link it.
            Db::run(
                'UPDATE users SET google_id = :gid, avatar_url = :avatar WHERE id = :id',
                ['gid' => $profile['google_id'], 'avatar' => $profile['avatar'], 'id' => (int) $byEmail['id']],
            );
            self::startSession((int) $byEmail['id']);
            Audit::log('auth.google.link', null, $email, (int) $byEmail['id']);
            return Db::one('SELECT * FROM users WHERE id = :id', ['id' => (int) $byEmail['id']]) ?? $byEmail;
        }

        if (!self::registrationOpen()) {
            throw new HttpError(403, 'No panel account matches that Google address. Ask an administrator.');
        }
        RateLimiter::hit('google-signup', $email, 5, 900, false);

        // Google-only accounts get an unusable random password so password_hash
        // stays NOT NULL and password_verify() can never succeed.
        $id = Db::insert('users', [
            'email' => $email,
            'name' => mb_substr($profile['name'] !== '' ? $profile['name'] : $email, 0, 120),
            'password_hash' => password_hash(bin2hex(random_bytes(32)), PASSWORD_DEFAULT),
            'role' => 'member',
            'created_at' => gmdate('c'),
            'google_id' => $profile['google_id'],
            'avatar_url' => $profile['avatar'],
        ]);
        self::startSession($id);
        Audit::log('auth.google.register', null, $email, $id);

        return Db::one('SELECT * FROM users WHERE id = :id', ['id' => $id]) ?? [];
    }

    /**
     * @param array<string,mixed> $user
     * @param array{name:string,avatar:string} $profile
     */
    private static function touchGoogle(array $user, array $profile): void
    {
        if ($profile['avatar'] !== '' && ($user['avatar_url'] ?? '') !== $profile['avatar']) {
            Db::run('UPDATE users SET avatar_url = :avatar WHERE id = :id', [
                'avatar' => $profile['avatar'],
                'id' => (int) $user['id'],
            ]);
        }
    }

    /**
     * Set a password without knowing the old one (administrator or reset flow)
     * and revoke every other session.
     */
    public static function setPassword(int $userId, string $password, ?string $keepToken = null): void
    {
        if (mb_strlen($password) < 10) {
            throw new HttpError(422, 'Password must be at least 10 characters.');
        }
        Db::run('UPDATE users SET password_hash = :hash WHERE id = :id', [
            'hash' => password_hash($password, PASSWORD_DEFAULT),
            'id' => $userId,
        ]);
        Db::run('DELETE FROM sessions WHERE user_id = :id AND token_hash != :keep', [
            'id' => $userId,
            'keep' => hash('sha256', (string) ($keepToken ?? '')),
        ]);
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
