<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;
use Btp\Support\Audit;
use Btp\Support\Db;
use Btp\Support\Path;

/**
 * World/server backups stored as gzip-compressed tar archives outside the
 * server directory so an archive can never include itself.
 */
final class BackupManager
{
    public function __construct(private readonly ServerManager $servers)
    {
    }

    private function backupDir(): string
    {
        $dir = rtrim((string) btp_config()['backup_dir'], '/');
        Path::ensureDir($dir);
        return $dir;
    }

    /**
     * @param array<string,mixed> $server
     * @return array<string,mixed>
     */
    public function create(array $server, string $label): array
    {
        if ($this->servers->pid($server) !== null) {
            throw new HttpError(409, 'Stop the server before creating a consistent backup.');
        }
        $source = $this->servers->dir($server);
        if (!is_dir($source)) {
            throw new HttpError(404, 'Server directory not found.');
        }
        $label = mb_substr(trim($label), 0, 60);
        $id = $this->servers->uuid();
        $file = sprintf('%s-%s-%s.tar.gz', $server['directory'], gmdate('Ymd-His'), substr($id, 0, 6));
        $target = $this->backupDir() . '/' . $file;

        $this->archive($source, $target);

        if (!is_file($target)) {
            throw new HttpError(500, 'Backup archive was not created.');
        }
        $size = (int) filesize($target);
        Db::insert('backups', [
            'id' => $id,
            'server_id' => $server['id'],
            'label' => $label,
            'file' => $file,
            'size' => $size,
            'created_at' => gmdate('c'),
        ]);
        Audit::log('backup.create', (string) $server['id'], $file);
        return [
            'id' => $id,
            'label' => $label,
            'file' => $file,
            'size' => $size,
            'created_at' => gmdate('c'),
        ];
    }

    private function archive(string $source, string $target): void
    {
        if (ProcessRunner::commandExists('tar')) {
            $result = ProcessRunner::run(
                ['tar', '-czf', $target, '-C', dirname($source), basename($source)],
                null,
                900,
            );
            if ($result['code'] === 0 && is_file($target)) {
                return;
            }
            @unlink($target);
            throw new HttpError(500, 'tar failed: ' . mb_substr(trim($result['stderr']), 0, 300));
        }

        if (class_exists(\PharData::class)) {
            $tar = new \PharData($target . '.tar');
            $tar->buildFromDirectory($source);
            $tar->compress(\Phar::GZ);
            unset($tar);
            if (!is_file($target) && is_file($target . '.tar.gz')) {
                @rename($target . '.tar.gz', $target);
            }
            @unlink($target . '.tar');
            return;
        }

        throw new HttpError(500, 'Neither tar nor PharData is available on this host.');
    }

    /**
     * @param array<string,mixed> $server
     * @return list<array<string,mixed>>
     */
    public function listForServer(array $server): array
    {
        $rows = Db::all('SELECT * FROM backups WHERE server_id = :id ORDER BY created_at DESC', ['id' => $server['id']]);
        foreach ($rows as &$row) {
            $row['size'] = (int) $row['size'];
            $row['exists'] = is_file($this->backupDir() . '/' . basename((string) $row['file']));
        }
        return $rows;
    }

    /**
     * @param array<string,mixed> $server
     */
    public function path(array $server, string $backupId): string
    {
        if (!btp_is_uuid($backupId)) {
            throw new HttpError(404, 'Backup not found.');
        }
        $row = Db::one('SELECT * FROM backups WHERE id = :id AND server_id = :sid', [
            'id' => $backupId,
            'sid' => $server['id'],
        ]);
        if ($row === null) {
            throw new HttpError(404, 'Backup not found.');
        }
        $path = $this->backupDir() . '/' . basename((string) $row['file']);
        if (!is_file($path)) {
            throw new HttpError(404, 'Backup archive is missing on disk.');
        }
        return $path;
    }

    /**
     * @param array<string,mixed> $server
     * @return array{file:string,size:int,label:string}
     */
    public function info(array $server, string $backupId): array
    {
        if (!btp_is_uuid($backupId)) {
            throw new HttpError(404, 'Backup not found.');
        }
        $row = Db::one('SELECT * FROM backups WHERE id = :id AND server_id = :sid', [
            'id' => $backupId,
            'sid' => $server['id'],
        ]);
        if ($row === null) {
            throw new HttpError(404, 'Backup not found.');
        }
        return [
            'file' => (string) $row['file'],
            'size' => (int) $row['size'],
            'label' => (string) $row['label'],
        ];
    }

    /**
     * @param array<string,mixed> $server
     */
    public function delete(array $server, string $backupId): void
    {
        $path = $this->path($server, $backupId);
        @unlink($path);
        Db::run('DELETE FROM backups WHERE id = :id', ['id' => $backupId]);
        Audit::log('backup.delete', (string) $server['id'], basename($path));
    }

    /**
     * Restore an archive over the live server directory. The server must be
     * stopped; the current contents are moved aside first so a failed restore
     * can be rolled back.
     *
     * @param array<string,mixed> $server
     */
    public function restore(array $server, string $backupId): void
    {
        if ($this->servers->pid($server) !== null) {
            throw new HttpError(409, 'Stop the server before restoring a backup.');
        }
        $archive = $this->path($server, $backupId);
        $target = $this->servers->dir($server);
        $staging = dirname($target) . '/.restore-' . substr($backupId, 0, 8);
        $rollback = $target . '.old-' . time();

        Path::deleteTree($staging);
        Path::ensureDir($staging);

        if (!ProcessRunner::commandExists('tar')) {
            throw new HttpError(500, 'tar is required to restore backups on this host.');
        }
        $result = ProcessRunner::run(['tar', '-xzf', $archive, '-C', $staging], null, 900);
        if ($result['code'] !== 0) {
            Path::deleteTree($staging);
            throw new HttpError(500, 'Extracting the archive failed: ' . mb_substr(trim($result['stderr']), 0, 300));
        }

        // The archive contains a single top-level directory (the server dir).
        $entries = array_values(array_diff(scandir($staging) ?: [], ['.', '..']));
        $root = $staging;
        if (count($entries) === 1 && is_dir($staging . '/' . $entries[0])) {
            $root = $staging . '/' . $entries[0];
        }

        if (!@rename($target, $rollback)) {
            Path::deleteTree($staging);
            throw new HttpError(500, 'Unable to move the current server directory aside.');
        }
        if (!@rename($root, $target)) {
            @rename($rollback, $target);
            Path::deleteTree($staging);
            throw new HttpError(500, 'Unable to move the restored files into place.');
        }
        Path::deleteTree($staging);
        Path::deleteTree($rollback);

        // Re-assert panel-managed properties after a restore.
        $this->servers->ensureConfigFiles($this->servers->find((string) $server['id']));
        Audit::log('backup.restore', (string) $server['id'], basename($archive));
    }
}
