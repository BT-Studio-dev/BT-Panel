<?php

declare(strict_types=1);

/**
 * BT Minecraft Panel configuration.
 *
 * Copy this file to `config.php` in the same directory (the setup wizard does
 * this automatically) and adjust the paths for your BT Panel / aaPanel host.
 *
 * `config.php` is NEVER inside the public web root. Keep it that way: it is
 * not a secret store, but it does describe your filesystem layout.
 */
return [
    // Set to true by the installer. Leave false to be redirected to the setup wizard.
    'installed' => false,

    'panel_name' => 'BT Minecraft Panel',
    'timezone' => 'UTC',

    // Panel data lives outside `public/`. Make this directory writable by the
    // PHP-FPM user (usually `www` on BT Panel).
    'data_dir' => __DIR__ . '/storage/servers',
    'backup_dir' => __DIR__ . '/storage/backups',
    'log_dir' => __DIR__ . '/storage/logs',
    'db_path' => __DIR__ . '/storage/panel.sqlite',

    // Server binaries. Use absolute paths when `java` is not on the PHP
    // process PATH (BT Panel supervisors often run with a minimal PATH).
    'java_bin' => 'java',
    'screen_bin' => 'screen',
    'tmux_bin' => 'tmux',

    // auto | screen | tmux | nohup
    'process_backend' => 'auto',

    'session_name' => 'btp_mc_session',
    'secure_cookies' => false, // Set true when the panel is served over HTTPS.

    'default_memory_mb' => 2048,
    'default_java_flags' => '',

    // UI accent color, matching the BT Panel palette.
    'accent' => '#d00000',

    /**
     * Optional Google (Gmail) sign-in. These values act as defaults only: once an
     * administrator saves credentials under Settings → Sign-in & email, the
     * database values win, so you can leave this block empty.
     *
     * Authorized redirect URI: {your panel origin}/auth/google/callback
     */
    'google' => [
        'client_id' => '',
        'client_secret' => '',
        'allowed_domains' => '', // e.g. 'gmail.com,yourcompany.com'
    ],

    /**
     * Optional mail defaults for password reset emails. Also editable in
     * Settings. transport: smtp | mail | log.
     */
    'mail' => [
        'transport' => 'mail',
        'host' => '',
        'port' => 587,
        'username' => '',
        'password' => '',
        'encryption' => 'tls', // tls | ssl | none
        'from' => '',
        'from_name' => '',
    ],
];
