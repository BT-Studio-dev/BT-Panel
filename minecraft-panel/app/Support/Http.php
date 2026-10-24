<?php

declare(strict_types=1);

namespace Btp\Support;

use Btp\Http\HttpError;

/**
 * Outbound HTTP for jar/metadata downloads. HTTPS only, with timeouts, size
 * limits and no credential leakage.
 */
final class Http
{
    private const MAX_JSON_BYTES = 8388608;

    /**
     * @return array<string,mixed>
     */
    public static function json(string $url, int $timeout = 20): array
    {
        self::assertHttps($url);
        $body = self::get($url, $timeout, self::MAX_JSON_BYTES);
        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new HttpError(502, 'Upstream returned an unexpected response.');
        }
        return $decoded;
    }

    public static function get(string $url, int $timeout = 20, int $maxBytes = self::MAX_JSON_BYTES): string
    {
        self::assertHttps($url);

        if (function_exists('curl_init')) {
            $buffer = '';
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => false,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS => 3,
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_TIMEOUT => $timeout,
                CURLOPT_USERAGENT => 'BT-Minecraft-Panel/1.0',
                CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
                CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
                CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$buffer, $maxBytes): int {
                    $buffer .= $chunk;
                    return strlen($buffer) > $maxBytes ? 0 : strlen($chunk);
                },
            ]);
            $ok = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $error = curl_error($ch);
            curl_close($ch);
            if ($ok === false || $status >= 400) {
                throw new HttpError(502, 'Download failed' . ($error !== '' ? ': ' . $error : ' (HTTP ' . $status . ')'));
            }
            return $buffer;
        }

        $context = stream_context_create([
            'http' => [
                'timeout' => $timeout,
                'follow_location' => 1,
                'max_redirects' => 3,
                'user_agent' => 'BT-Minecraft-Panel/1.0',
                'ignore_errors' => true,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents($url, false, $context, 0, $maxBytes);
        if ($body === false) {
            throw new HttpError(502, 'Download failed: unable to reach the upstream host.');
        }
        return $body;
    }

    /**
     * Stream a URL to disk without loading it into memory.
     */
    public static function download(string $url, string $destination, int $maxBytes = 268435456, int $timeout = 300): int
    {
        self::assertHttps($url);
        Path::ensureDir(dirname($destination));
        $tmp = $destination . '.part';
        $handle = @fopen($tmp, 'wb');
        if ($handle === false) {
            throw new HttpError(500, 'Unable to write the downloaded file.');
        }

        try {
            if (function_exists('curl_init')) {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_FILE => $handle,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_MAXREDIRS => 3,
                    CURLOPT_CONNECTTIMEOUT => 15,
                    CURLOPT_TIMEOUT => $timeout,
                    CURLOPT_USERAGENT => 'BT-Minecraft-Panel/1.0',
                    CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
                    CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
                    CURLOPT_NOPROGRESS => false,
                    CURLOPT_PROGRESSFUNCTION => static function ($resource, float $downloadSize) use ($maxBytes): int {
                        return ($downloadSize > $maxBytes) ? 1 : 0;
                    },
                ]);
                $ok = curl_exec($ch);
                $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
                $error = curl_error($ch);
                curl_close($ch);
                if ($ok === false || $status >= 400) {
                    throw new HttpError(502, 'Download failed' . ($error !== '' ? ': ' . $error : ' (HTTP ' . $status . ')'));
                }
            } else {
                $context = stream_context_create([
                    'http' => [
                        'timeout' => $timeout,
                        'follow_location' => 1,
                        'max_redirects' => 3,
                        'user_agent' => 'BT-Minecraft-Panel/1.0',
                    ],
                ]);
                $source = @fopen($url, 'rb', false, $context);
                if ($source === false) {
                    throw new HttpError(502, 'Download failed: unable to reach the upstream host.');
                }
                $copied = stream_copy_to_stream($source, $handle, $maxBytes + 1);
                fclose($source);
                if ($copied === false || $copied > $maxBytes) {
                    throw new HttpError(502, 'Download exceeded the size limit.');
                }
            }
        } finally {
            fclose($handle);
        }

        $size = (int) @filesize($tmp);
        if ($size <= 0) {
            @unlink($tmp);
            throw new HttpError(502, 'Downloaded file was empty.');
        }
        if (!@rename($tmp, $destination)) {
            @unlink($tmp);
            throw new HttpError(500, 'Unable to move the downloaded file into place.');
        }
        return $size;
    }

    private static function assertHttps(string $url): void
    {
        $parts = parse_url($url);
        if (($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])) {
            throw new HttpError(400, 'Only HTTPS downloads are allowed.');
        }
    }
}
