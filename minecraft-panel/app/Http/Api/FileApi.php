<?php

declare(strict_types=1);

namespace Btp\Http\Api;

use Btp\Http\HttpError;
use Btp\Support\Audit;
use Btp\Support\Path;

/**
 * Per-server file manager. Every path is resolved relative to the server
 * directory and validated with Path::assertInside().
 */
final class FileApi
{
    use ApiTrait;

    private const MAX_EDIT_BYTES = 1048576;   // 1 MB for the text editor
    private const MAX_UPLOAD_BYTES = 268435456; // 256 MB per upload
    private const BLOCKED_EXTENSIONS = ['php', 'php3', 'php4', 'php5', 'phtml', 'phar', 'pht', 'cgi', 'pl'];

    public function list(array $params): never
    {
        $server = $this->server($params['id']);
        $root = $this->servers()->dir($server);
        $relative = $this->relativePath($_GET['path'] ?? '');
        $entries = Path::listing($root, $relative);
        btp_json([
            'path' => $relative,
            'entries' => $entries,
            'usage_bytes' => Path::dirSize($root),
        ]);
    }

    public function content(array $params): never
    {
        $server = $this->server($params['id']);
        $root = $this->servers()->dir($server);
        $relative = $this->relativePath($_GET['path'] ?? '', true);
        $file = Path::assertInside($root, $relative);
        if (!is_file($file)) {
            throw new HttpError(404, 'File not found.');
        }
        if ((int) filesize($file) > self::MAX_EDIT_BYTES) {
            throw new HttpError(413, 'This file is larger than 1 MB. Use download instead.');
        }
        $contents = file_get_contents($file);
        if ($contents === false) {
            throw new HttpError(500, 'Unable to read the file.');
        }
        if (str_contains($contents, "\0")) {
            throw new HttpError(415, 'Binary files cannot be edited in the browser.');
        }
        btp_json([
            'path' => $relative,
            'name' => basename($file),
            'content' => $contents,
            'size' => (int) filesize($file),
            'modified' => (int) filemtime($file),
        ]);
    }

    public function save(array $params): never
    {
        $server = $this->server($params['id']);
        $root = $this->servers()->dir($server);
        $body = btp_json_body();
        $relative = $this->relativePath(btp_str($body, 'path', '', 1024) ?? '', true);
        $content = $body['content'] ?? null;
        if (!is_string($content)) {
            throw new HttpError(422, 'File content is required.');
        }
        if (strlen($content) > self::MAX_EDIT_BYTES) {
            throw new HttpError(413, 'File content is too large.');
        }
        $file = Path::assertInside($root, $relative);
        $this->assertNotBlocked($file);
        if (is_dir($file)) {
            throw new HttpError(409, 'That path is a directory.');
        }
        if (!@file_put_contents($file, $content, LOCK_EX)) {
            throw new HttpError(500, 'Unable to write the file. Check filesystem permissions.');
        }
        Audit::log('file.save', (string) $server['id'], $relative);
        btp_json(['saved' => true, 'size' => strlen($content)]);
    }

    public function mkdir(array $params): never
    {
        $server = $this->server($params['id']);
        $root = $this->servers()->dir($server);
        $relative = $this->relativePath(btp_str(btp_json_body(), 'path', '', 1024) ?? '', true);
        $target = Path::assertInside($root, $relative);
        if (file_exists($target)) {
            throw new HttpError(409, 'That entry already exists.');
        }
        Path::ensureDir($target);
        Audit::log('file.mkdir', (string) $server['id'], $relative);
        btp_json(['created' => $relative], 201);
    }

    public function delete(array $params): never
    {
        $server = $this->server($params['id']);
        $root = $this->servers()->dir($server);
        $body = btp_json_body();
        $relative = $this->relativePath(btp_str($body, 'path', '', 1024) ?? '', true);
        $target = Path::assertInside($root, $relative);
        if ($target === rtrim($root, '/')) {
            throw new HttpError(422, 'Refusing to delete the server root.');
        }
        if (!file_exists($target)) {
            throw new HttpError(404, 'Path not found.');
        }
        if (is_dir($target)) {
            if (!btp_bool($body, 'recursive')) {
                $remaining = array_diff(scandir($target) ?: [], ['.', '..']);
                if ($remaining !== []) {
                    throw new HttpError(409, 'Directory is not empty. Confirm a recursive delete.');
                }
                @rmdir($target);
            } else {
                Path::deleteTree($target);
            }
        } else {
            @unlink($target);
        }
        Audit::log('file.delete', (string) $server['id'], $relative);
        btp_json(['deleted' => true]);
    }

    public function upload(array $params): never
    {
        $server = $this->server($params['id']);
        $root = $this->servers()->dir($server);
        $directory = $this->relativePath($_POST['path'] ?? '');
        $targetDir = Path::assertInside($root, $directory);
        if (!is_dir($targetDir)) {
            throw new HttpError(404, 'Upload directory not found.');
        }
        $file = $_FILES['file'] ?? null;
        if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            throw new HttpError(422, 'No file was uploaded.');
        }
        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new HttpError(422, 'Upload failed with error code ' . (int) $file['error'] . '.');
        }
        if ((int) $file['size'] > self::MAX_UPLOAD_BYTES) {
            throw new HttpError(413, 'Uploads are limited to 256 MB.');
        }
        $name = basename((string) $file['name']);
        $name = preg_replace('/[^A-Za-z0-9._\- ]+/', '_', $name) ?: 'upload.bin';
        $target = $targetDir . '/' . $name;
        $this->assertNotBlocked($target);
        $this->assertWithinRoot($root, $target);
        if (!@move_uploaded_file((string) $file['tmp_name'], $target)) {
            // move_uploaded_file() fails under CLI/tests; fall back to rename.
            if (!@rename((string) $file['tmp_name'], $target) && !@copy((string) $file['tmp_name'], $target)) {
                throw new HttpError(500, 'Unable to store the uploaded file.');
            }
        }
        @chmod($target, 0644);
        Audit::log('file.upload', (string) $server['id'], ltrim($directory . '/' . $name, '/'));
        btp_json(['uploaded' => $name, 'size' => (int) filesize($target)], 201);
    }

    public function download(array $params): never
    {
        $server = $this->server($params['id']);
        $root = $this->servers()->dir($server);
        $relative = $this->relativePath($_GET['path'] ?? '', true);
        $file = Path::assertInside($root, $relative);
        if (!is_file($file)) {
            throw new HttpError(404, 'File not found.');
        }
        $size = (int) filesize($file);
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . addslashes(basename($file)) . '"');
        header('Content-Length: ' . $size);
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        $handle = fopen($file, 'rb');
        if ($handle === false) {
            throw new HttpError(500, 'Unable to read the file.');
        }
        while (!feof($handle)) {
            echo fread($handle, 262144);
            flush();
        }
        fclose($handle);
        exit;
    }

    private function relativePath(?string $value, bool $required = false): string
    {
        $value = is_string($value) ? trim(str_replace('\\', '/', $value)) : '';
        $value = ltrim($value, '/');
        if (str_contains($value, "\0")) {
            throw new HttpError(400, 'Invalid path.');
        }
        if ($required && $value === '') {
            throw new HttpError(422, 'A path is required.');
        }
        return Path::normalize($value);
    }

    private function assertNotBlocked(string $file): void
    {
        $extension = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if (in_array($extension, self::BLOCKED_EXTENSIONS, true)) {
            throw new HttpError(415, 'Script files cannot be managed from the panel.');
        }
    }

    private function assertWithinRoot(string $root, string $target): void
    {
        $real = realpath($target);
        $realRoot = realpath($root);
        if ($real !== false && $realRoot !== false && !str_starts_with($real, rtrim($realRoot, '/') . '/')) {
            throw new HttpError(403, 'Path escapes the server directory.');
        }
    }
}
