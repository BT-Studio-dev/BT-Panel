<?php

declare(strict_types=1);

namespace Btp\Minecraft;

use Btp\Http\HttpError;
use Btp\Support\Db;
use Btp\Support\Http;
use Btp\Support\Path;

/**
 * Resolves and downloads server software for a server record.
 *
 * Only first-party HTTPS APIs are contacted (Mojang, PaperMC, PurpurMC). Any
 * other jar must be uploaded by an administrator through the file manager.
 */
final class JarInstaller
{
    public const TYPES = ['vanilla', 'paper', 'purpur', 'custom'];

    /**
     * @param array<string,mixed> $server
     * @return array{version:string,file:string,bytes:int,source:string}
     */
    public function install(array $server, string $serverDir): array
    {
        $type = (string) $server['type'];
        if ($type === 'custom') {
            throw new HttpError(422, 'Custom servers: upload a jar as server.jar in the file manager.');
        }
        if (!in_array($type, self::TYPES, true)) {
            throw new HttpError(422, 'Unknown server type.');
        }

        $requested = (string) $server['version'];
        $resolved = $this->resolve($type, $requested);

        $target = $serverDir . '/server.jar';
        $tmp = $target . '.download';
        Http::download($resolved['url'], $tmp, 268435456, 300);

        // Basic sanity check: jars are ZIP archives and start with "PK".
        $handle = fopen($tmp, 'rb');
        $magic = $handle ? fread($handle, 2) : '';
        if ($handle) {
            fclose($handle);
        }
        if ($magic !== 'PK') {
            @unlink($tmp);
            throw new HttpError(502, 'The downloaded file is not a valid jar archive.');
        }

        $backup = $serverDir . '/server.jar.previous';
        if (is_file($target)) {
            @copy($target, $backup);
        }
        if (!@rename($tmp, $target)) {
            @unlink($tmp);
            throw new HttpError(500, 'Unable to store the downloaded jar.');
        }
        @chmod($target, 0644);

        Db::run(
            'UPDATE servers SET jar = :jar, version = :version, updated_at = :now WHERE id = :id',
            [
                'jar' => 'server.jar',
                'version' => $resolved['version'],
                'now' => gmdate('c'),
                'id' => $server['id'],
            ],
        );

        return [
            'version' => $resolved['version'],
            'file' => 'server.jar',
            'bytes' => (int) filesize($target),
            'source' => $resolved['source'],
        ];
    }

    /**
     * @return array{url:string,version:string,source:string}
     */
    public function resolve(string $type, string $version): array
    {
        return match ($type) {
            'vanilla' => $this->resolveVanilla($version),
            'paper' => $this->resolvePaper($version),
            'purpur' => $this->resolvePurpur($version),
            default => throw new HttpError(422, 'Unsupported server type.'),
        };
    }

    /**
     * @return array{url:string,version:string,source:string}
     */
    private function resolveVanilla(string $version): array
    {
        $manifest = Http::json('https://launchermeta.mojang.com/mc/game/version_manifest_v2.json');
        $versions = $manifest['versions'] ?? [];
        if (!is_array($versions) || $versions === []) {
            throw new HttpError(502, 'Mojang version manifest is empty.');
        }

        $selected = null;
        if ($version === '' || $version === 'latest') {
            foreach ($versions as $entry) {
                if (($entry['type'] ?? '') === 'release') {
                    $selected = $entry;
                    break;
                }
            }
        } else {
            foreach ($versions as $entry) {
                if (($entry['id'] ?? '') === $version) {
                    $selected = $entry;
                    break;
                }
            }
        }
        if ($selected === null) {
            throw new HttpError(422, 'Minecraft version not found: ' . $version);
        }
        $details = Http::json((string) $selected['url']);
        $url = $details['downloads']['server']['url'] ?? null;
        if (!is_string($url)) {
            throw new HttpError(502, 'This Minecraft version has no server download.');
        }
        return ['url' => $url, 'version' => (string) $selected['id'], 'source' => 'Mojang'];
    }

    /**
     * @return array{url:string,version:string,source:string}
     */
    private function resolvePaper(string $version): array
    {
        $project = Http::json('https://api.papermc.io/v2/projects/paper');
        $versions = array_values(array_filter((array) ($project['versions'] ?? []), 'is_string'));
        if ($versions === []) {
            throw new HttpError(502, 'PaperMC returned no versions.');
        }
        $resolvedVersion = $this->pickVersion($versions, $version);
        $builds = Http::json(sprintf('https://api.papermc.io/v2/projects/paper/versions/%s/builds', rawurlencode($resolvedVersion)));
        $buildList = (array) ($builds['builds'] ?? []);
        if ($buildList === []) {
            throw new HttpError(502, 'PaperMC returned no builds for ' . $resolvedVersion);
        }
        $latest = end($buildList);
        $build = (int) ($latest['build'] ?? 0);
        $fileName = (string) ($latest['downloads']['application']['name'] ?? (
            sprintf('paper-%s-%d.jar', $resolvedVersion, $build)
        ));
        $url = sprintf(
            'https://api.papermc.io/v2/projects/paper/versions/%s/builds/%d/downloads/%s',
            rawurlencode($resolvedVersion),
            $build,
            rawurlencode($fileName),
        );
        return ['url' => $url, 'version' => $resolvedVersion, 'source' => 'PaperMC build ' . $build];
    }

    /**
     * @return array{url:string,version:string,source:string}
     */
    private function resolvePurpur(string $version): array
    {
        $project = Http::json('https://api.purpurmc.org/v2/purpur');
        $versions = array_values(array_filter((array) ($project['versions'] ?? []), 'is_string'));
        if ($versions === []) {
            throw new HttpError(502, 'PurpurMC returned no versions.');
        }
        $resolvedVersion = $this->pickVersion($versions, $version);
        $builds = Http::json(sprintf('https://api.purpurmc.org/v2/purpur/%s', rawurlencode($resolvedVersion)));
        $build = (string) ($builds['builds']['latest'] ?? 'latest');
        $url = sprintf(
            'https://api.purpurmc.org/v2/purpur/%s/%s/download',
            rawurlencode($resolvedVersion),
            rawurlencode($build),
        );
        return ['url' => $url, 'version' => $resolvedVersion, 'source' => 'PurpurMC build ' . $build];
    }

    /**
     * @param list<string> $versions ascending
     */
    private function pickVersion(array $versions, string $requested): string
    {
        if ($requested === '' || $requested === 'latest') {
            return (string) end($versions);
        }
        if (!in_array($requested, $versions, true)) {
            throw new HttpError(422, 'Version not available: ' . $requested);
        }
        return $requested;
    }
}
