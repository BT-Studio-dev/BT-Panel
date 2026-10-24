<?php

declare(strict_types=1);

namespace Btp\Http\Api;

use Btp\Minecraft\BackupManager;
use Btp\Minecraft\ServerManager;
use Btp\Support\Auth;

trait ApiTrait
{
    protected function servers(): ServerManager
    {
        return new ServerManager();
    }

    /**
     * Resolve a server the current user may act on.
     *
     * @return array<string,mixed>
     */
    protected function server(string $id): array
    {
        $user = Auth::requireUser();
        return $this->servers()->findForUser($user, $id);
    }

    protected function backups(): BackupManager
    {
        return new BackupManager($this->servers());
    }

    /**
     * @param array<string,mixed> $server
     */
    protected function canManage(array $server): void
    {
        $user = Auth::requireUser();
        if (Auth::isAdmin($user) || (int) $server['owner_id'] === (int) $user['id']) {
            return;
        }
        throw new \Btp\Http\HttpError(403, 'Only the server owner or an administrator can do that.');
    }
}
