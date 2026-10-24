<?php

declare(strict_types=1);

function page_link(string $section, ?string $tab = null): string
{
    return 'index.php?section=' . rawurlencode($section) . ($tab ? '&tab=' . rawurlencode($tab) : '');
}

function action_fields(string $action, string $return): string
{
    return csrf_field()
        . '<input type="hidden" name="action" value="' . e($action) . '">'
        . '<input type="hidden" name="return" value="' . e($return) . '">';
}

function status_badge(string $status): string
{
    return '<span class="status ' . e($status) . '"><span></span>' . e(ucfirst($status)) . '</span>';
}

function render_flash(?array $flash): void
{
    if (!$flash) return;
    $type = ($flash['type'] ?? 'success') === 'error' ? 'error' : 'success';
    echo '<div class="flash ' . $type . '" role="alert">' . e($flash['message'] ?? '') . '</div>';
}

function render_login(array $settings, ?array $flash): void
{
    ?>
    <!doctype html>
    <html lang="en">
    <head>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title><?= e($settings['panel_name']) ?> · Sign in</title>
        <link rel="stylesheet" href="assets/app.css">
    </head>
    <body class="auth" data-mode="<?= e($settings['mode']) ?>" data-card-theme="auto" data-card-glass="on" style="--accent:<?= e($settings['accent']) ?>">
        <main class="auth-shell">
            <section class="card auth-card">
                <div class="brand-mark">BT</div>
                <p class="eyebrow">PHP Web Edition</p>
                <h1><?= e($settings['panel_name']) ?></h1>
                <p class="muted">Sign in to manage your servers and control center.</p>
                <?php render_flash($flash); ?>
                <form method="post" action="index.php" class="stack">
                    <?= action_fields('login', '') ?>
                    <label>Username or email<input name="identifier" required autocomplete="username" value="admin"></label>
                    <label>Password<input type="password" name="password" required autocomplete="current-password" value="btpanel123"></label>
                    <button class="button primary" type="submit">Sign in</button>
                </form>
                <div class="demo-note"><strong>Demo</strong><span>admin</span><span>btpanel123</span></div>
            </section>
        </main>
    </body>
    </html>
    <?php
}

function render_app(array $data, array $user, string $section, string $tab, ?array $flash, ?array $newKey): void
{
    $settings = $data['settings'];
    $servers = visible_servers($data, $user);
    $return = $_SERVER['QUERY_STRING'] ?? '';
    $admin = is_admin($user);
    ?>
    <!doctype html>
    <html lang="en">
    <head>
        <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title><?= e($settings['panel_name']) ?></title>
        <link rel="stylesheet" href="assets/app.css">
        <script src="assets/app.js" defer></script>
    </head>
    <body data-mode="<?= e($settings['mode']) ?>" data-card-theme="<?= e($settings['card_theme']) ?>" data-card-glass="<?= $settings['card_glass'] ? 'on' : 'off' ?>" style="--accent:<?= e($settings['accent']) ?>">
        <div class="app-shell">
            <aside class="sidebar" id="sidebar">
                <a class="brand" href="<?= page_link('home') ?>"><span class="brand-mark">BT</span><span><strong><?= e($settings['panel_name']) ?></strong><small>PHP web control center</small></span></a>
                <nav class="main-nav" aria-label="Main navigation">
                    <a class="<?= $section === 'home' ? 'active' : '' ?>" href="<?= page_link('home') ?>">Overview</a>
                    <a class="<?= $section === 'servers' ? 'active' : '' ?>" href="<?= page_link('servers') ?>">Servers <span><?= count($servers) ?></span></a>
                    <?php if ($admin): ?><a class="<?= $section === 'admin' ? 'active' : '' ?>" href="<?= page_link('admin', 'overview') ?>">Admin Control Center</a><?php endif; ?>
                    <a class="<?= $section === 'account' ? 'active' : '' ?>" href="<?= page_link('account') ?>">My Account</a>
                </nav>
                <div class="sidebar-user">
                    <span class="avatar"><?= e(strtoupper(substr($user['username'], 0, 1))) ?></span>
                    <span><strong><?= e($user['username']) ?></strong><small><?= e($user['role']) ?></small></span>
                    <form method="post" action="index.php"><?= action_fields('logout', '') ?><button class="icon-button" title="Sign out" aria-label="Sign out">↪</button></form>
                </div>
            </aside>
            <div class="main-column">
                <header class="topbar">
                    <button class="icon-button menu-button" type="button" data-menu aria-label="Open navigation">☰</button>
                    <div><p class="eyebrow">BT Panel Game</p><strong><?= $section === 'admin' ? 'Admin Control Center' : e(ucfirst($section)) ?></strong></div>
                    <span class="runtime-badge">PHP <?= e(PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION) ?></span>
                </header>
                <main class="content">
                    <?php render_flash($flash); ?>
                    <?php if ($newKey): ?>
                        <section class="secret-card" role="alert">
                            <div><p class="eyebrow">One-time secret</p><h3>Copy <?= e($newKey['name']) ?> now</h3><p>The complete key will not be shown again.</p></div>
                            <div class="copy-row"><input readonly value="<?= e($newKey['secret']) ?>" aria-label="New API key"><button class="button primary" type="button" data-copy="<?= e($newKey['secret']) ?>">Copy</button></div>
                        </section>
                    <?php endif; ?>
                    <?php if ($section === 'home') render_home($data, $user, $servers); ?>
                    <?php if ($section === 'servers') render_server_manager($data, $user, $servers, $return); ?>
                    <?php if ($section === 'account') render_account($user, $return); ?>
                    <?php if ($section === 'admin' && $admin) render_admin($data, $user, $servers, $tab, $return); ?>
                </main>
            </div>
        </div>
    </body>
    </html>
    <?php
}

function metric_card(string $label, int|string $value, string $detail): void
{
    echo '<div class="card metric"><span>' . e($label) . '</span><strong>' . e($value) . '</strong><small>' . e($detail) . '</small></div>';
}

function render_home(array $data, array $user, array $servers): void
{
    $running = count(array_filter($servers, static fn (array $server): bool => $server['status'] === 'running'));
    $memory = array_sum(array_map(static fn (array $server): int => (int) $server['memory'], $servers));
    $serverIds = array_map(static fn (array $server): string => $server['id'], $servers);
    $homeEvents = array_values(array_filter(
        server_events($data),
        static fn (array $event): bool => in_array($event['server_id'], $serverIds, true),
    ));
    ?>
    <section class="page-heading"><div><p class="eyebrow">Dashboard</p><h1>Welcome, <?= e($user['username']) ?></h1><p>Game servers, ports and application runtimes in one PHP web panel.</p></div><a class="button primary" href="<?= page_link('servers') ?>">Manage servers</a></section>
    <div class="metrics">
        <?php metric_card('Servers', count($servers), $running . ' currently running'); ?>
        <?php metric_card('Running', $running, count($servers) - $running . ' offline'); ?>
        <?php metric_card('Memory', format_mb((int) $memory), 'Allocated to your fleet'); ?>
        <?php metric_card('Templates', count(panel_templates()), 'Games and applications'); ?>
    </div>
    <div class="grid two">
        <section class="card"><div class="section-title"><div><p class="eyebrow">Fleet</p><h2>Server endpoints</h2></div><a href="<?= page_link('servers') ?>">View all →</a></div>
            <div class="list">
            <?php foreach (array_slice($servers, 0, 5) as $server): $template = panel_template($server['template']); ?>
                <div class="list-row"><span class="template-dot" style="--template:<?= e($template['color']) ?>"></span><div><strong><?= e($server['name']) ?></strong><small><?= e($template['name']) ?> · <?= e($server['node']) ?></small></div><code><?= e($server['ip'] . ':' . $server['port']) ?></code><?= status_badge($server['status']) ?></div>
            <?php endforeach; ?>
            <?php if (!$servers): ?><p class="empty">No servers yet. Create your first Minecraft or app server.</p><?php endif; ?>
            </div>
        </section>
        <section class="card"><div class="section-title"><div><p class="eyebrow">Activity</p><h2>Latest events</h2></div></div>
            <div class="event-list">
            <?php foreach (array_slice($homeEvents, 0, 6) as $event): ?>
                <div class="event"><span class="event-dot <?= e($event['level']) ?>"></span><div><strong><?= e(event_server_name($data, $event['server_id'])) ?></strong><p><?= e($event['message']) ?></p><small><?= e(time_ago($event['created_at'])) ?></small></div></div>
            <?php endforeach; ?>
            </div>
        </section>
    </div>
    <?php
}

function render_server_manager(array $data, array $user, array $servers, string $return): void
{
    $templates = panel_templates();
    $nodes = panel_nodes();
    ?>
    <section class="page-heading"><div><p class="eyebrow">Server management</p><h1>Game & application servers</h1><p>Deploy Minecraft and other templates, allocate ports, control power, and use the console.</p></div><input class="search" type="search" placeholder="Search servers…" data-search></section>
    <details class="card create-panel">
        <summary>Create a server</summary>
        <form method="post" action="index.php" class="form-grid">
            <?= action_fields('create_server', $return) ?>
            <label>Server name<input name="name" required minlength="2" maxlength="60" placeholder="Minecraft Survival"></label>
            <label>Template<select name="template"><?php foreach ($templates as $id => $template): ?><option value="<?= e($id) ?>"><?= e($template['name']) ?></option><?php endforeach; ?></select></label>
            <label>Node<select name="node"><?php foreach ($nodes as $id => $node): ?><option value="<?= e($id) ?>"><?= e($node['location']) ?></option><?php endforeach; ?></select></label>
            <label>CPU<select name="cpu"><?php foreach ([100, 200, 400, 800] as $value): ?><option value="<?= $value ?>"><?= $value ?>%</option><?php endforeach; ?></select></label>
            <label>Memory<select name="memory"><?php foreach ([1024, 2048, 4096, 8192, 16384] as $value): ?><option value="<?= $value ?>" <?= $value === 4096 ? 'selected' : '' ?>><?= format_mb($value) ?></option><?php endforeach; ?></select></label>
            <label>Disk<select name="disk"><?php foreach ([10240, 20480, 51200, 102400] as $value): ?><option value="<?= $value ?>" <?= $value === 20480 ? 'selected' : '' ?>><?= format_mb($value) ?></option><?php endforeach; ?></select></label>
            <div class="form-actions"><button class="button primary" type="submit">Create server</button></div>
        </form>
    </details>
    <div class="server-grid">
    <?php foreach ($servers as $server): $template = panel_template($server['template']); $owner = $server['owner_id'] ? find_user($data, $server['owner_id']) : null; ?>
        <article class="card server-card" data-search-item="<?= e(strtolower($server['name'] . ' ' . $template['name'] . ' ' . $server['port'])) ?>">
            <div class="server-head"><span class="template-icon" style="--template:<?= e($template['color']) ?>"><?= $server['template'] === 'minecraft' ? '⛏' : '◆' ?></span><div><h2><?= e($server['name']) ?></h2><p><?= e($template['name']) ?> · <?= e($owner['username'] ?? 'Unassigned') ?></p></div><?= status_badge($server['status']) ?></div>
            <div class="endpoint"><span>Primary endpoint</span><code><?= e($server['ip'] . ':' . $server['port']) ?></code><button type="button" class="icon-button" data-copy="<?= e($server['ip'] . ':' . $server['port']) ?>" aria-label="Copy endpoint">⧉</button></div>
            <div class="resource-row"><span>CPU <strong><?= $server['cpu'] ?>%</strong></span><span>RAM <strong><?= format_mb($server['memory']) ?></strong></span><span>Disk <strong><?= format_mb($server['disk']) ?></strong></span></div>
            <div class="power-row">
                <?php foreach (['start' => 'Start', 'restart' => 'Restart', 'stop' => 'Stop', 'kill' => 'Kill'] as $power => $label): ?>
                    <form method="post" action="index.php" <?= $power === 'kill' ? 'data-confirm="Force-kill this server?"' : '' ?>><?= action_fields('power', $return) ?><input type="hidden" name="server_id" value="<?= e($server['id']) ?>"><input type="hidden" name="power" value="<?= $power ?>"><button class="button small <?= $power === 'kill' ? 'danger' : 'ghost' ?>" type="submit"><?= $label ?></button></form>
                <?php endforeach; ?>
            </div>
            <details class="console-panel"><summary>Console & activity</summary>
                <div class="console">
                    <?php foreach (array_slice(array_reverse(server_events($data, $server['id'])), -8) as $event): ?><div><span><?= e(date('H:i:s', strtotime($event['created_at']))) ?></span> <?= e($event['message']) ?></div><?php endforeach; ?>
                </div>
                <form method="post" action="index.php" class="console-form"><?= action_fields('command', $return) ?><input type="hidden" name="server_id" value="<?= e($server['id']) ?>"><input name="command" maxlength="200" placeholder="help" required><button class="button primary small" type="submit">Send</button></form>
            </details>
            <form method="post" action="index.php" data-confirm="Permanently delete this server and its events?"><?= action_fields('delete_server', $return) ?><input type="hidden" name="server_id" value="<?= e($server['id']) ?>"><button class="button text-danger" type="submit">Delete server</button></form>
        </article>
    <?php endforeach; ?>
    </div>
    <?php if (!$servers): ?><div class="card empty">No servers match this account yet.</div><?php endif; ?>
    <?php
}

function render_account(array $user, string $return): void
{
    ?>
    <section class="page-heading"><div><p class="eyebrow">Account</p><h1>My Account</h1><p>Update your email or change your password.</p></div></section>
    <div class="grid two">
        <section class="card"><div class="section-title"><h2>Profile</h2></div><div class="profile"><span class="avatar large"><?= e(strtoupper(substr($user['username'], 0, 1))) ?></span><div><h3><?= e($user['username']) ?></h3><p><?= e($user['role']) ?> · <?= e($user['status']) ?></p></div></div><dl class="details"><div><dt>User ID</dt><dd><code><?= e($user['id']) ?></code></dd></div><div><dt>Created</dt><dd><?= e(date('M j, Y', strtotime($user['created_at']))) ?></dd></div></dl></section>
        <section class="card"><div class="section-title"><h2>Account settings</h2></div><form method="post" action="index.php" class="stack"><?= action_fields('save_profile', $return) ?><label>Email<input type="email" name="email" required value="<?= e($user['email']) ?>"></label><label>Current password<input type="password" name="current_password" autocomplete="current-password" placeholder="Required only for a new password"></label><label>New password<input type="password" name="new_password" minlength="8" maxlength="128" autocomplete="new-password" placeholder="Leave blank to keep it"></label><button class="button primary" type="submit">Save account</button></form></section>
    </div>
    <?php
}
