<?php

declare(strict_types=1);

namespace Btp\Support;

use Btp\Http\HttpError;

/**
 * "Continue with Google" (Gmail) sign-in using the OAuth 2.0 authorization code
 * flow.
 *
 * Credentials are optional. When they are absent the buttons and routes report
 * "not configured" instead of failing. The client secret never leaves the
 * server: the code exchange and the profile lookup both happen here.
 */
final class GoogleAuth
{
    private const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
    private const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
    private const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/userinfo';

    /**
     * @return array{client_id:string,client_secret:string,redirect_uri:string,domains:list<string>,enabled:bool,configured:bool}
     */
    public static function settings(): array
    {
        $file = (array) (btp_config()['google'] ?? []);
        $clientId = Db::setting('google_client_id', (string) ($file['client_id'] ?? ''));
        $clientSecret = Db::setting('google_client_secret', (string) ($file['client_secret'] ?? ''));
        $redirect = Db::setting('google_redirect_uri', '');
        if ($redirect === '') {
            $redirect = btp_absolute_url('auth/google/callback');
        }
        $domains = array_values(array_filter(array_map(
            static fn (string $domain): string => strtolower(trim($domain)),
            explode(',', Db::setting('google_allowed_domains', (string) ($file['allowed_domains'] ?? ''))),
        )));
        $configured = $clientId !== '' && $clientSecret !== '';

        return [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => $redirect,
            'domains' => $domains,
            'configured' => $configured,
            // Admins can switch the button off without deleting the credentials.
            'enabled' => $configured && Db::setting('google_enabled', '1') === '1',
        ];
    }

    public static function enabled(): bool
    {
        return self::settings()['enabled'];
    }

    public static function startUrl(): string
    {
        $settings = self::settings();
        if (!$settings['enabled']) {
            throw new HttpError(503, 'Google sign-in is not configured. Ask an administrator.');
        }
        $state = bin2hex(random_bytes(24));
        Session::put('google_state', $state);
        Session::put('google_started_at', time());

        $query = http_build_query([
            'client_id' => $settings['client_id'],
            'redirect_uri' => $settings['redirect_uri'],
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'access_type' => 'online',
            'prompt' => 'select_account',
        ], '', '&', PHP_QUERY_RFC3986);

        return self::AUTH_ENDPOINT . '?' . $query;
    }

    /**
     * Validate the callback state. Single use, ten minute window.
     */
    public static function verifyState(string $state): void
    {
        $expected = Session::get('google_state');
        $started = (int) Session::get('google_started_at', 0);
        Session::forget('google_state');
        Session::forget('google_started_at');

        if (!is_string($expected) || $expected === '' || !hash_equals($expected, $state)) {
            throw new HttpError(400, 'The Google sign-in request expired. Try again.');
        }
        if ($started > 0 && (time() - $started) > 600) {
            throw new HttpError(400, 'The Google sign-in request expired. Try again.');
        }
    }

    /**
     * Exchange the authorization code and return a normalised profile.
     *
     * @return array{google_id:string,email:string,name:string,avatar:string,email_verified:bool,domain:string}
     */
    public static function profileFromCode(string $code): array
    {
        $settings = self::settings();
        if (!$settings['configured']) {
            throw new HttpError(503, 'Google sign-in is not configured.');
        }
        if ($code === '' || strlen($code) > 2048) {
            throw new HttpError(400, 'Google did not return an authorization code.');
        }

        $token = Http::postForm(self::TOKEN_ENDPOINT, [
            'code' => $code,
            'client_id' => $settings['client_id'],
            'client_secret' => $settings['client_secret'],
            'redirect_uri' => $settings['redirect_uri'],
            'grant_type' => 'authorization_code',
        ]);
        $accessToken = (string) ($token['access_token'] ?? '');
        if ($accessToken === '') {
            throw new HttpError(502, 'Google did not return an access token.');
        }

        $info = Http::getJsonWithToken(self::USERINFO_ENDPOINT, $accessToken);
        $email = strtolower(trim((string) ($info['email'] ?? '')));
        $sub = trim((string) ($info['sub'] ?? ''));
        if ($sub === '' || $email === '') {
            throw new HttpError(502, 'Google did not return an account identifier.');
        }

        return [
            'google_id' => $sub,
            'email' => $email,
            'name' => trim((string) ($info['name'] ?? '')),
            'avatar' => (string) ($info['picture'] ?? ''),
            'email_verified' => ($info['email_verified'] ?? false) === true,
            'domain' => str_contains($email, '@') ? substr($email, strrpos($email, '@') + 1) : '',
        ];
    }

    /**
     * Enforce the optional domain allowlist (e.g. only gmail.com, or only your
     * company domain).
     *
     * @param list<string> $domains
     */
    public static function assertDomainAllowed(string $email, array $domains): void
    {
        if ($domains === []) {
            return;
        }
        $domain = str_contains($email, '@') ? strtolower(substr($email, strrpos($email, '@') + 1)) : '';
        if (!in_array($domain, $domains, true)) {
            throw new HttpError(403, sprintf(
                'Sign-in is limited to these email domains: %s.',
                implode(', ', $domains),
            ));
        }
    }
}
