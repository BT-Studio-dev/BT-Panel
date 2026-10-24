<?php

declare(strict_types=1);

namespace Btp\Support;

/**
 * Outbound mail for password resets and admin test messages.
 *
 * Transports:
 *   smtp — direct socket client with STARTTLS/SSL and AUTH LOGIN
 *   mail — PHP mail() (works with BT Panel's default sendmail/postfix)
 *   log  — write the message to storage/logs/mail.log (development default)
 *
 * Credentials live in panel settings (SQLite, outside the web root) or in
 * config.php under 'mail'. They are never returned to the browser.
 */
final class Mailer
{
    private const TIMEOUT = 15;

    private static ?string $lastError = null;

    /**
     * @return array{transport:string,host:string,port:int,username:string,password:string,encryption:string,from:string,from_name:string}
     */
    public static function config(): array
    {
        $file = (array) (btp_config()['mail'] ?? []);
        $settings = [
            'transport' => Db::setting('mail_transport', (string) ($file['transport'] ?? 'mail')),
            'host' => Db::setting('mail_host', (string) ($file['host'] ?? '')),
            'port' => (int) Db::setting('mail_port', (string) ($file['port'] ?? '587')),
            'username' => Db::setting('mail_username', (string) ($file['username'] ?? '')),
            'password' => Db::setting('mail_password', (string) ($file['password'] ?? '')),
            'encryption' => Db::setting('mail_encryption', (string) ($file['encryption'] ?? 'tls')),
            'from' => Db::setting('mail_from', (string) ($file['from'] ?? '')),
            'from_name' => Db::setting('mail_from_name', (string) ($file['from_name'] ?? btp_config()['panel_name'] ?? 'BT Minecraft Panel')),
        ];

        if ($settings['from'] === '' || !filter_var($settings['from'], FILTER_VALIDATE_EMAIL)) {
            $host = (string) parse_url(btp_absolute_url(''), PHP_URL_HOST);
            $settings['from'] = 'panel@' . ($host !== '' ? $host : 'localhost');
        }
        if ($settings['transport'] === 'mail' && !function_exists('mail')) {
            $settings['transport'] = 'log';
        }

        return $settings;
    }

    public static function lastError(): ?string
    {
        return self::$lastError;
    }

    public static function send(string $to, string $subject, string $body, ?string $textBody = null): bool
    {
        self::$lastError = null;
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            self::$lastError = 'Invalid recipient address.';
            return false;
        }
        $config = self::config();
        $plain = $textBody ?? trim(strip_tags($body));
        $headers = [
            'From' => sprintf('%s <%s>', self::encodeHeader($config['from_name']), $config['from']),
            'Reply-To' => $config['from'],
            'MIME-Version' => '1.0',
            'Content-Type' => 'text/html; charset=UTF-8',
            'X-Mailer' => 'BT-Minecraft-Panel',
        ];
        $subject = self::encodeHeader($subject);

        try {
            $sent = match ($config['transport']) {
                'smtp' => self::sendSmtp($config, $to, $subject, $body, $plain, $headers),
                'log' => self::sendLog($config, $to, $subject, $body),
                default => self::sendPhpMail($config, $to, $subject, $body, $headers),
            };
        } catch (\Throwable $error) {
            self::$lastError = $error->getMessage();
            Logger::info('mail failed: ' . $error->getMessage());
            return false;
        }

        if (!$sent && self::$lastError === null) {
            self::$lastError = 'The mail transport rejected the message.';
        }
        return $sent;
    }

    /**
     * @param array<string,string> $headers
     */
    private static function sendPhpMail(array $config, string $to, string $subject, string $body, array $headers): bool
    {
        $headerLines = [];
        foreach ($headers as $name => $value) {
            $headerLines[] = $name . ': ' . $value;
        }
        $ok = @mail($to, $subject, $body, implode("\r\n", $headerLines), '-f' . $config['from']);
        if (!$ok) {
            self::$lastError = 'PHP mail() returned false. Configure SMTP in Settings.';
        }
        return (bool) $ok;
    }

    private static function sendLog(array $config, string $to, string $subject, string $body): bool
    {
        $dir = (string) btp_config()['log_dir'];
        Path::ensureDir($dir);
        $entry = sprintf(
            "[%s] to: %s\nfrom: %s\nsubject: %s\n\n%s\n%s\n",
            gmdate('c'),
            $to,
            $config['from'],
            $subject,
            trim(strip_tags($body)),
            str_repeat('-', 72),
        );
        if (@file_put_contents($dir . '/mail.log', $entry, FILE_APPEND | LOCK_EX) === false) {
            self::$lastError = 'Unable to write storage/logs/mail.log';
            return false;
        }
        return true;
    }

    /**
     * Minimal SMTP client: EHLO → STARTTLS → AUTH LOGIN → MAIL/RCPT/DATA.
     *
     * @param array<string,string> $headers
     */
    private static function sendSmtp(array $config, string $to, string $subject, string $html, string $plain, array $headers): bool
    {
        if ($config['host'] === '') {
            self::$lastError = 'SMTP host is not configured.';
            return false;
        }
        $encryption = strtolower($config['encryption']);
        $scheme = $encryption === 'ssl' ? 'ssl://' : 'tcp://';
        $socket = @stream_socket_client(
            $scheme . $config['host'] . ':' . $config['port'],
            $errno,
            $errstr,
            self::TIMEOUT,
            STREAM_CLIENT_CONNECT,
        );
        if (!is_resource($socket)) {
            self::$lastError = sprintf('Cannot reach %s:%d (%s)', $config['host'], $config['port'], $errstr ?: 'connection failed');
            return false;
        }
        stream_set_timeout($socket, self::TIMEOUT);
        $hostname = (string) (gethostname() ?: 'localhost');

        try {
            self::expect($socket, [220]);
            self::command($socket, 'EHLO ' . $hostname, [250]);

            if ($encryption === 'tls') {
                self::command($socket, 'STARTTLS', [220]);
                if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
                    self::$lastError = 'STARTTLS negotiation failed.';
                    return false;
                }
                self::command($socket, 'EHLO ' . $hostname, [250]);
            }

            if ($config['username'] !== '') {
                self::command($socket, 'AUTH LOGIN', [334]);
                self::command($socket, base64_encode($config['username']), [334]);
                self::command($socket, base64_encode($config['password']), [235]);
            }

            self::command($socket, 'MAIL FROM:<' . $config['from'] . '>', [250]);
            self::command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
            self::command($socket, 'DATA', [354]);

            $boundary = 'btp-' . bin2hex(random_bytes(8));
            $body = '';
            foreach ($headers as $name => $value) {
                $body .= $name . ': ' . $value . "\r\n";
            }
            $body .= 'To: <' . $to . ">\r\n";
            $body .= 'Subject: ' . $subject . "\r\n";
            $body .= "MIME-Version: 1.0\r\n";
            $body .= 'Content-Type: multipart/alternative; boundary="' . $boundary . '"' . "\r\n\r\n";
            $body .= '--' . $boundary . "\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" . $plain . "\r\n\r\n";
            $body .= '--' . $boundary . "\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" . $html . "\r\n\r\n";
            $body .= '--' . $boundary . "--\r\n";

            // Dot-stuffing per RFC 5321.
            $stuffed = preg_replace('/^\./m', '..', $body) ?? $body;
            fwrite($socket, $stuffed . "\r\n.\r\n");
            self::expect($socket, [250]);
            self::command($socket, 'QUIT', [221], false);
            return true;
        } finally {
            if (is_resource($socket)) {
                fclose($socket);
            }
        }
    }

    /**
     * @param resource $socket
     * @param list<int> $expected
     */
    private static function command($socket, string $line, array $expected, bool $mustSucceed = true): string
    {
        fwrite($socket, $line . "\r\n");
        return self::expect($socket, $expected, $mustSucceed);
    }

    /**
     * @param resource $socket
     * @param list<int> $expected
     */
    private static function expect($socket, array $expected, bool $mustSucceed = true): string
    {
        $response = '';
        while (($line = fgets($socket, 1024)) !== false) {
            $response .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') {
                break;
            }
        }
        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $expected, true) && $mustSucceed) {
            throw new \RuntimeException(sprintf('SMTP error (%d): %s', $code, trim($response)));
        }
        return $response;
    }

    private static function encodeHeader(string $value): string
    {
        $value = str_replace(["\r", "\n"], ' ', $value);
        return preg_match('/[^\x20-\x7E]/', $value) === 1
            ? '=?UTF-8?B?' . base64_encode($value) . '?='
            : $value;
    }
}
