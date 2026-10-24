<?php

declare(strict_types=1);

namespace Btp\Support;

/**
 * Minimal PDO/SQLite wrapper: connection handling, schema installation and
 * tiny query helpers. All statements are prepared; no string interpolation of
 * user values.
 */
final class Db
{
    private static ?\PDO $pdo = null;

    public static function connection(?string $path = null): \PDO
    {
        if (self::$pdo !== null && $path === null) {
            return self::$pdo;
        }
        $dbPath = $path ?? (string) btp_config()['db_path'];
        Path::ensureDir(dirname($dbPath));

        $pdo = new \PDO('sqlite:' . $dbPath, null, null, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::ATTR_TIMEOUT => 10,
        ]);
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA busy_timeout = 10000');

        if ($path === null) {
            self::$pdo = $pdo;
        }
        return $pdo;
    }

    public static function reset(): void
    {
        self::$pdo = null;
    }

    /**
     * @param array<string,mixed> $params
     */
    public static function run(string $sql, array $params = []): \PDOStatement
    {
        $statement = self::connection()->prepare($sql);
        $statement->execute($params);
        return $statement;
    }

    /**
     * @param array<string,mixed> $params
     * @return array<string,mixed>|null
     */
    public static function one(string $sql, array $params = []): ?array
    {
        $row = self::run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /**
     * @param array<string,mixed> $params
     * @return list<array<string,mixed>>
     */
    public static function all(string $sql, array $params = []): array
    {
        /** @var list<array<string,mixed>> $rows */
        $rows = self::run($sql, $params)->fetchAll();
        return $rows;
    }

    /**
     * @param array<string,mixed> $params
     */
    public static function scalar(string $sql, array $params = []): mixed
    {
        $value = self::run($sql, $params)->fetchColumn();
        return $value === false ? null : $value;
    }

    /**
     * @param array<string,mixed> $values
     */
    public static function insert(string $table, array $values): int
    {
        $columns = array_keys($values);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $table,
            implode(', ', $columns),
            implode(', ', array_map(static fn (string $c): string => ':' . $c, $columns)),
        );
        self::run($sql, $values);
        return (int) self::connection()->lastInsertId();
    }

    /**
     * @param array<string,mixed> $values
     */
    public static function update(string $table, array $values, string $where, array $params = []): void
    {
        $sets = implode(', ', array_map(static fn (string $c): string => $c . ' = :' . $c, array_keys($values)));
        self::run("UPDATE {$table} SET {$sets} WHERE {$where}", $values + $params);
    }

    public static function transaction(callable $callback): mixed
    {
        $pdo = self::connection();
        $pdo->beginTransaction();
        try {
            $result = $callback($pdo);
            $pdo->commit();
            return $result;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Create the schema. Idempotent, and shared by the installer and the CLI.
     */
    public static function install(?\PDO $pdo = null): void
    {
        $pdo ??= self::connection();
        $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT    NOT NULL UNIQUE,
            name          TEXT    NOT NULL DEFAULT '',
            password_hash TEXT    NOT NULL,
            role          TEXT    NOT NULL DEFAULT 'member',
            created_at    TEXT    NOT NULL,
            last_login_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sessions (
            token_hash  TEXT PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at  TEXT NOT NULL,
            expires_at  TEXT NOT NULL,
            ip          TEXT NOT NULL DEFAULT '',
            user_agent  TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS servers (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            directory     TEXT NOT NULL UNIQUE,
            type          TEXT NOT NULL DEFAULT 'vanilla',
            version       TEXT NOT NULL DEFAULT 'latest',
            port          INTEGER NOT NULL,
            rcon_port     INTEGER NOT NULL DEFAULT 0,
            rcon_password TEXT NOT NULL DEFAULT '',
            memory_mb     INTEGER NOT NULL DEFAULT 2048,
            java_flags    TEXT NOT NULL DEFAULT '',
            jar           TEXT NOT NULL DEFAULT 'server.jar',
            owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
            status        TEXT NOT NULL DEFAULT 'stopped',
            created_at    TEXT NOT NULL,
            updated_at    TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS server_users (
            server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
            user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (server_id, user_id)
        );

        CREATE TABLE IF NOT EXISTS backups (
            id         TEXT PRIMARY KEY,
            server_id  TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
            label      TEXT NOT NULL DEFAULT '',
            file       TEXT NOT NULL,
            size       INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit_log (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER,
            server_id  TEXT,
            action     TEXT NOT NULL,
            detail     TEXT NOT NULL DEFAULT '',
            ip         TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS login_attempts (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            email      TEXT NOT NULL,
            ip         TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS password_resets (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used_at    TEXT
        );

        CREATE TABLE IF NOT EXISTS rate_events (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            bucket     TEXT NOT NULL,
            key        TEXT NOT NULL,
            ip         TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_backups_server ON backups(server_id);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
        CREATE INDEX IF NOT EXISTS idx_attempts_email ON login_attempts(email, created_at);
        CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);
        CREATE INDEX IF NOT EXISTS idx_rate_lookup ON rate_events(bucket, key, created_at);
        SQL);

        // Lightweight forward migrations for databases created by older releases.
        self::ensureColumn($pdo, 'users', 'google_id', 'TEXT');
        self::ensureColumn($pdo, 'users', 'avatar_url', 'TEXT');
    }

    /**
     * Add a column when it does not exist yet. SQLite has no `ADD COLUMN IF NOT
     * EXISTS`, and we intentionally avoid a migration runner for a single-file
     * database.
     */
    public static function ensureColumn(\PDO $pdo, string $table, string $column, string $definition): void
    {
        $columns = $pdo->query('PRAGMA table_info(' . $table . ')')->fetchAll();
        foreach ($columns as $existing) {
            if (strcasecmp((string) $existing['name'], $column) === 0) {
                return;
            }
        }
        $pdo->exec(sprintf('ALTER TABLE %s ADD COLUMN %s %s', $table, $column, $definition));
    }

    public static function setting(string $key, string $default = ''): string
    {
        try {
            $value = self::scalar('SELECT value FROM settings WHERE key = :key', ['key' => $key]);
        } catch (\PDOException) {
            return $default;
        }
        return $value === null ? $default : (string) $value;
    }

    public static function setSetting(string $key, string $value): void
    {
        self::run(
            'INSERT INTO settings (key, value) VALUES (:key, :value)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value',
            ['key' => $key, 'value' => $value],
        );
    }
}
