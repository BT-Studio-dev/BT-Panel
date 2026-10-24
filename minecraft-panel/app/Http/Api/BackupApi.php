<?php

declare(strict_types=1);

namespace Btp\Http\Api;

use Btp\Http\HttpError;

/**
 * Backup listing, creation, download and restore.
 */
final class BackupApi
{
    use ApiTrait;

    public function index(array $params): never
    {
        $server = $this->server($params['id']);
        btp_json(['backups' => $this->backups()->listForServer($server)]);
    }

    public function create(array $params): never
    {
        $server = $this->server($params['id']);
        $this->canManage($server);
        $backup = $this->backups()->create($server, btp_str(btp_json_body(), 'label', '', 60) ?? '');
        btp_json(['backup' => $backup], 201);
    }

    public function download(array $params): never
    {
        $server = $this->server($params['id']);
        $path = $this->backups()->path($server, (string) $params['backupId']);
        header('Content-Type: application/gzip');
        header('Content-Disposition: attachment; filename="' . basename($path) . '"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new HttpError(500, 'Unable to open the archive.');
        }
        while (!feof($handle)) {
            echo fread($handle, 262144);
            flush();
        }
        fclose($handle);
        exit;
    }

    public function restore(array $params): never
    {
        $server = $this->server($params['id']);
        $this->canManage($server);
        $this->backups()->restore($server, (string) $params['backupId']);
        btp_json(['restored' => true, 'message' => 'Backup restored. Start the server when ready.']);
    }

    public function delete(array $params): never
    {
        $server = $this->server($params['id']);
        $this->canManage($server);
        $this->backups()->delete($server, (string) $params['backupId']);
        btp_json(['deleted' => true]);
    }
}
