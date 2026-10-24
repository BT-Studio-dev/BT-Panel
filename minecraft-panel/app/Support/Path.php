<?php

declare(strict_types=1);

namespace Btp\Support;

use Btp\Http\HttpError;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use FilesystemIterator;

/**
 * Filesystem path safety.
 *
 * Every user supplied path must pass through `assertInside()` before it is
 * used. Paths are treated as untrusted input: `..`, absolute paths, NUL bytes
 * and symlinks that escape the root are rejected.
 */
final class Path
{
    public static function normalize(string $path): string
    {
        $path = str_replace('\\', '/', $path);
        if (str_contains($path, "\0")) {
            throw new HttpError(400, 'Invalid path.');
        }
        $parts = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                array_pop($parts);
                continue;
            }
            $parts[] = $segment;
        }
        return implode('/', $parts);
    }

    /**
     * Resolve a relative path inside a root directory and guarantee it cannot
     * escape. The returned path is absolute and normalised, but not required to
     * exist yet.
     */
    public static function assertInside(string $root, string $relative): string
    {
        $root = rtrim(str_replace('\\', '/', $root), '/');
        if ($root === '') {
            throw new HttpError(500, 'Data root is not configured.');
        }
        // Reject any attempt to climb above the root instead of silently
        // re-anchoring it: a caller asking for ../../etc is a bug or an attack.
        $depth = 0;
        foreach (explode('/', str_replace('\\', '/', $relative)) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                if ($depth === 0) {
                    throw new HttpError(403, 'Path escapes the server directory.');
                }
                $depth--;
                continue;
            }
            $depth++;
        }
        $relative = self::normalize($relative);
        $target = $relative === '' ? $root : $root . '/' . $relative;

        $realRoot = realpath($root);
        if ($realRoot === false) {
            // Root may be created lazily; fall back to the configured path.
            $realRoot = $root;
        }

        // When the target exists, compare canonical paths to block symlink escapes.
        $realTarget = realpath($target);
        if ($realTarget !== false) {
            if ($realTarget !== $realRoot && !str_starts_with($realTarget . '/', $realRoot . '/')) {
                throw new HttpError(403, 'Path escapes the server directory.');
            }
            return $realTarget;
        }

        // For paths that do not exist yet, canonicalise the deepest existing parent.
        $probe = $target;
        while ($probe !== $root && !file_exists($probe) && str_contains($probe, '/')) {
            $probe = dirname($probe);
        }
        $realProbe = realpath($probe);
        if ($realProbe !== false && $realProbe !== $realRoot && !str_starts_with($realProbe . '/', $realRoot . '/')) {
            throw new HttpError(403, 'Path escapes the server directory.');
        }

        return $target;
    }

    public static function exists(string $path): bool
    {
        return file_exists($path);
    }

    public static function ensureDir(string $path, int $mode = 0775): void
    {
        if (is_dir($path)) {
            return;
        }
        if (!@mkdir($path, $mode, true) && !is_dir($path)) {
            throw new HttpError(500, 'Unable to create directory: ' . basename($path));
        }
    }

    /**
     * Recursively delete a directory. Refuses to delete a filesystem root or a
     * path that is not at least two segments deep.
     */
    public static function deleteTree(string $path): void
    {
        $normalized = rtrim(str_replace('\\', '/', $path), '/');
        if ($normalized === '' || substr_count($normalized, '/') < 2) {
            throw new HttpError(400, 'Refusing to delete an unsafe path.');
        }
        if (is_link($normalized) || is_file($normalized)) {
            @unlink($normalized);
            return;
        }
        if (!is_dir($normalized)) {
            return;
        }
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($normalized, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $item) {
            /** @var \SplFileInfo $item */
            if ($item->isDir() && !$item->isLink()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }
        @rmdir($normalized);
    }

    /**
     * Total size of a directory tree in bytes (symlinks are not followed).
     */
    public static function dirSize(string $path): int
    {
        if (!is_dir($path)) {
            return is_file($path) ? (int) filesize($path) : 0;
        }
        $total = 0;
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($path, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY,
        );
        foreach ($iterator as $item) {
            /** @var \SplFileInfo $item */
            if ($item->isFile() && !$item->isLink()) {
                $total += (int) $item->getSize();
            }
        }
        return $total;
    }

    /**
     * Copy a directory tree, preserving structure but skipping symlinks.
     */
    public static function copyTree(string $source, string $destination): void
    {
        self::ensureDir($destination);
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST,
        );
        foreach ($iterator as $item) {
            /** @var \SplFileInfo $item */
            if ($item->isLink()) {
                continue;
            }
            $target = $destination . '/' . $iterator->getSubPathname();
            if ($item->isDir()) {
                self::ensureDir($target);
            } else {
                self::ensureDir(dirname($target));
                if (!@copy($item->getPathname(), $target)) {
                    throw new HttpError(500, 'Unable to copy ' . $item->getFilename() . '.');
                }
            }
        }
    }

    /**
     * Recursive size-aware listing used by the file manager.
     *
     * @return list<array{name:string,path:string,type:string,size:int,modified:int,extension:string}>
     */
    public static function listing(string $root, string $relative): array
    {
        $dir = self::assertInside($root, $relative);
        if (!is_dir($dir)) {
            throw new HttpError(404, 'Directory not found.');
        }
        $entries = [];
        foreach (scandir($dir) ?: [] as $name) {
            if ($name === '.' || $name === '..' || str_starts_with($name, '.btp-')) {
                continue;
            }
            $full = $dir . '/' . $name;
            $isDir = is_dir($full) && !is_link($full);
            $relativePath = ltrim(self::normalize($relative . '/' . $name), '/');
            $entries[] = [
                'name' => $name,
                'path' => $relativePath,
                'type' => $isDir ? 'dir' : 'file',
                'size' => $isDir ? self::dirSize($full) : (int) @filesize($full),
                'modified' => (int) @filemtime($full),
                'extension' => $isDir ? '' : strtolower(pathinfo($name, PATHINFO_EXTENSION)),
            ];
        }
        usort($entries, static function (array $a, array $b): int {
            if ($a['type'] !== $b['type']) {
                return $a['type'] === 'dir' ? -1 : 1;
            }
            return strcasecmp($a['name'], $b['name']);
        });
        return $entries;
    }

    /**
     * Copy a directory as a `.tar` archive without shelling out.
     */
    public static function tarDirectory(string $source, string $archivePath, string $prefix = ''): void
    {
        $tar = new \PharData($archivePath . '.tar');
        $tar->buildFromDirectory($source);
        $tar->compress(\Phar::GZ);
        unset($tar);
        @unlink($archivePath . '.tar');
        if (!is_file($archivePath)) {
            // Phar writes `<name>.tar.gz`; move it into place.
            $gzip = $archivePath . '.tar.gz';
            if (is_file($gzip)) {
                @rename($gzip, $archivePath);
            }
        }
    }
}
