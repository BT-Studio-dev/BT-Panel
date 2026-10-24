<?php

declare(strict_types=1);

function panel_templates(): array
{
    return [
        'minecraft' => [
            'name' => 'Minecraft (Paper)', 'category' => 'game', 'port' => 25565,
            'image' => 'docker.io/itzg/minecraft-server:java21', 'players' => 40,
            'mount' => '/data', 'color' => '#5fb04a',
            'description' => 'Minecraft Paper 1.21 with a Java 21 container definition.',
        ],
        'rust' => [
            'name' => 'Rust', 'category' => 'game', 'port' => 28015,
            'image' => 'docker.io/cm2network/steamcmd:latest', 'players' => 100,
            'mount' => '/home/container', 'color' => '#ce422b',
            'description' => 'Rust dedicated server using the SteamCMD runtime.',
        ],
        'cs2' => [
            'name' => 'Counter-Strike 2', 'category' => 'game', 'port' => 27015,
            'image' => 'docker.io/cm2network/steamcmd:latest', 'players' => 12,
            'mount' => '/home/container', 'color' => '#f5a623',
            'description' => 'Counter-Strike 2 dedicated game-server definition.',
        ],
        'valheim' => [
            'name' => 'Valheim', 'category' => 'game', 'port' => 2456,
            'image' => 'docker.io/cm2network/steamcmd:latest', 'players' => 10,
            'mount' => '/home/container', 'color' => '#4f8fba',
            'description' => 'Valheim dedicated world with a SteamCMD image.',
        ],
        'nodejs' => [
            'name' => 'Node.js App', 'category' => 'app', 'port' => 3000,
            'image' => 'docker.io/library/node:22-bookworm-slim', 'players' => 0,
            'mount' => '/home/container', 'color' => '#83cd29',
            'description' => 'Node.js 22 application runtime.',
        ],
        'discord-bot' => [
            'name' => 'Discord Bot', 'category' => 'app', 'port' => 8080,
            'image' => 'docker.io/library/node:22-bookworm-slim', 'players' => 0,
            'mount' => '/home/container', 'color' => '#5865f2',
            'description' => 'Persistent Node.js Discord bot runtime.',
        ],
        'python' => [
            'name' => 'Python App', 'category' => 'app', 'port' => 8000,
            'image' => 'docker.io/library/python:3.12-bookworm-slim', 'players' => 0,
            'mount' => '/home/container', 'color' => '#3776ab',
            'description' => 'Python 3.12 web application and worker runtime.',
        ],
    ];
}

function panel_nodes(): array
{
    return [
        'eu-fra-01' => [
            'name' => 'Frankfurt', 'region' => 'EU', 'location' => 'Frankfurt, DE',
            'subnet' => '10.20.0.', 'daemon_port' => 8080, 'sftp_port' => 2022,
        ],
        'us-nyc-02' => [
            'name' => 'New York', 'region' => 'US', 'location' => 'New York, US',
            'subnet' => '10.40.0.', 'daemon_port' => 8080, 'sftp_port' => 2022,
        ],
        'ap-sgp-01' => [
            'name' => 'Singapore', 'region' => 'APAC', 'location' => 'Singapore, SG',
            'subnet' => '10.60.0.', 'daemon_port' => 8080, 'sftp_port' => 2022,
        ],
    ];
}

function panel_template(string $id): array
{
    $templates = panel_templates();
    return $templates[$id] ?? $templates['minecraft'];
}

function panel_core_extensions(): array
{
    return [
        ['name' => 'Server Console', 'description' => 'Persistent commands and server event output.'],
        ['name' => 'Power Management', 'description' => 'Start, stop, restart and kill controls.'],
        ['name' => 'Port Allocations', 'description' => 'Per-node primary endpoint assignment.'],
        ['name' => 'Template Catalog', 'description' => 'Minecraft, game and application definitions.'],
        ['name' => 'Theme Engine', 'description' => 'Base mode, card glass and card surface controls.'],
        ['name' => 'Native API', 'description' => 'Bearer-authenticated JSON endpoints for external tools.'],
    ];
}
