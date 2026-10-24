<?php

declare(strict_types=1);

function admin_tabs(): array
{
    return [
        'overview' => 'Overview', 'activity' => 'Activity', 'settings' => 'Settings',
        'users' => 'Users', 'locations' => 'Locations', 'nodes' => 'Nodes',
        'server' => 'Server', 'databases' => 'Database Hosts', 'mounts' => 'Mounts',
        'eggs' => 'Eggs', 'tags' => 'Tags', 'extensions' => 'Extensions', 'api-keys' => 'API Keys',
    ];
}

function render_admin(array $data, array $user, array $servers, string $tab, string $return): void
{
    ?>
    <section class="admin-hero card"><div><p class="eyebrow">Admin Control Center</p><h1>BT Panel Game</h1><p>Servers, infrastructure, access and panel configuration.</p></div><span class="role-pill"><?= e($user['role']) ?></span></section>
    <nav class="admin-tabs" aria-label="Admin sections">
        <?php foreach (admin_tabs() as $id => $label): ?><a class="<?= $tab === $id ? 'active' : '' ?>" href="<?= page_link('admin', $id) ?>"><?= e($label) ?></a><?php endforeach; ?>
    </nav>
    <div class="admin-content">
    <?php
    switch ($tab) {
        case 'overview': render_admin_overview($data, $servers); break;
        case 'activity': render_admin_activity($data); break;
        case 'settings': render_admin_settings($data['settings'], $return); break;
        case 'users': render_admin_users($data, $user, $return); break;
        case 'locations': render_admin_locations($servers); break;
        case 'nodes': render_admin_nodes($servers); break;
        case 'server': render_server_manager($data, $user, $servers, $return); break;
        case 'databases': render_admin_databases(); break;
        case 'mounts': render_admin_mounts($servers); break;
        case 'eggs': render_admin_eggs($servers); break;
        case 'tags': render_admin_tags($servers); break;
        case 'extensions': render_admin_extensions(); break;
        case 'api-keys': render_admin_api_keys($data, $return); break;
    }
    ?>
    </div>
    <?php
}

function admin_heading(string $title, string $description): void
{
    echo '<section class="page-heading compact"><div><p class="eyebrow">BT Panel Game</p><h1>' . e($title) . '</h1><p>' . e($description) . '</p></div></section>';
}

function render_admin_overview(array $data, array $servers): void
{
    $running = count(array_filter($servers, static fn (array $server): bool => $server['status'] === 'running'));
    admin_heading('Administration Overview', 'Live fleet resources and primary port allocations.');
    ?>
    <div class="metrics">
        <?php metric_card('Servers', count($servers), $running . ' running'); ?>
        <?php metric_card('Users', count($data['users']), 'Registered PHP web accounts'); ?>
        <?php metric_card('Nodes', count(panel_nodes()), 'Catalog deployment nodes'); ?>
        <?php metric_card('API keys', count($data['api_keys']), 'Persistent credentials'); ?>
    </div>
    <section class="card"><div class="section-title"><div><p class="eyebrow">Network</p><h2>Port allocations</h2></div><a href="<?= page_link('admin', 'server') ?>">Manage servers →</a></div><div class="table-wrap"><table><thead><tr><th>Server</th><th>Template</th><th>Node</th><th>Endpoint</th><th>Status</th></tr></thead><tbody>
    <?php foreach ($servers as $server): ?><tr><td><?= e($server['name']) ?></td><td><?= e(panel_template($server['template'])['name']) ?></td><td><?= e($server['node']) ?></td><td><code><?= e($server['ip'] . ':' . $server['port']) ?></code></td><td><?= status_badge($server['status']) ?></td></tr><?php endforeach; ?>
    </tbody></table></div></section>
    <div class="quick-links"><a class="card" href="<?= page_link('admin', 'activity') ?>"><strong>Review activity</strong><span>Console, power and system events →</span></a><a class="card" href="<?= page_link('admin', 'nodes') ?>"><strong>Inspect nodes</strong><span>Locations and Wings ports →</span></a><a class="card" href="<?= page_link('admin', 'api-keys') ?>"><strong>Create an API key</strong><span>Authenticate your own tools →</span></a></div>
    <?php
}

function render_admin_activity(array $data): void
{
    admin_heading('Server Activity', 'Persistent console, power and system events from the PHP datastore.');
    ?>
    <section class="card"><div class="section-title"><h2>Event stream</h2><input class="search" type="search" placeholder="Filter events…" data-search></div><div class="event-list large">
    <?php foreach (server_events($data) as $event): ?><div class="event" data-search-item="<?= e(strtolower(event_server_name($data, $event['server_id']) . ' ' . $event['message'])) ?>"><span class="event-dot <?= e($event['level']) ?>"></span><div><strong><?= e(event_server_name($data, $event['server_id'])) ?> <span class="level"><?= e($event['level']) ?></span></strong><p><?= e($event['message']) ?></p><small><?= e(time_ago($event['created_at'])) ?> · <?= e(date('M j, H:i:s', strtotime($event['created_at']))) ?></small></div></div><?php endforeach; ?>
    </div></section>
    <?php
}

function render_admin_settings(array $settings, string $return): void
{
    admin_heading('Settings Management', 'Configure branding, base mode, card glass and card surfaces.');
    ?>
    <section class="card"><div class="section-title"><div><p class="eyebrow">Appearance</p><h2>Panel settings</h2></div></div><form method="post" action="index.php" class="form-grid settings-form"><?= action_fields('save_settings', $return) ?>
        <label>Panel name<input name="panel_name" maxlength="40" required value="<?= e($settings['panel_name']) ?>"></label>
        <label>Base theme<select name="mode" data-setting-mode><option value="dark" <?= $settings['mode'] === 'dark' ? 'selected' : '' ?>>Dark</option><option value="light" <?= $settings['mode'] === 'light' ? 'selected' : '' ?>>Light</option></select></label>
        <label>Card theme<select name="card_theme" data-setting-card-theme><?php foreach (['auto' => 'Auto', 'hidden' => 'Hidden', 'off-white' => 'Off White', 'dark' => 'Dark'] as $id => $label): ?><option value="<?= $id ?>" <?= $settings['card_theme'] === $id ? 'selected' : '' ?>><?= $label ?></option><?php endforeach; ?></select></label>
        <label>Accent color<input type="color" name="accent" value="<?= e($settings['accent']) ?>"></label>
        <label class="toggle-row"><span><strong>Card Glass</strong><small>On enables backdrop blur; Off uses the surface without blur.</small></span><input type="checkbox" name="card_glass" data-setting-card-glass <?= $settings['card_glass'] ? 'checked' : '' ?>></label>
        <p class="form-note">Hidden removes only card surfaces, never their content. Sidebars and dialogs keep the base theme.</p>
        <div class="form-actions"><button class="button primary" type="submit">Save settings</button></div>
    </form></section>
    <?php
}

function render_admin_users(array $data, array $actor, string $return): void
{
    admin_heading('User Management', 'Create accounts, assign roles, suspend access, or remove users.');
    ?>
    <details class="card create-panel"><summary>Create a user</summary><form method="post" action="index.php" class="form-grid"><?= action_fields('create_user', $return) ?><label>Username<input name="username" required pattern="[a-zA-Z0-9_.-]{3,24}"></label><label>Email<input type="email" name="email" required></label><label>Password<input type="password" name="password" required minlength="8" maxlength="128"></label><label>Role<select name="role"><option value="member">Member</option><?php if ($actor['role'] === 'owner'): ?><option value="admin">Admin</option><?php endif; ?></select></label><div class="form-actions"><button class="button primary" type="submit">Create user</button></div></form></details>
    <section class="card"><div class="section-title"><h2>Accounts</h2><span><?= count($data['users']) ?> users</span></div><div class="table-wrap"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
    <?php foreach ($data['users'] as $user): $locked = $user['id'] === $actor['id'] || $user['role'] === 'owner' || ($user['role'] === 'admin' && $actor['role'] !== 'owner'); ?><tr><td><strong><?= e($user['username']) ?></strong></td><td><?= e($user['email']) ?></td><td><span class="role-pill"><?= e($user['role']) ?></span></td><td><?= e($user['status']) ?></td><td><?php if (!$locked): ?><div class="table-actions"><form method="post" action="index.php"><?= action_fields('toggle_user', $return) ?><input type="hidden" name="user_id" value="<?= e($user['id']) ?>"><button class="button small ghost" type="submit"><?= $user['status'] === 'active' ? 'Suspend' : 'Activate' ?></button></form><form method="post" action="index.php" data-confirm="Delete this user? Their servers will become unassigned."><?= action_fields('delete_user', $return) ?><input type="hidden" name="user_id" value="<?= e($user['id']) ?>"><button class="button small danger" type="submit">Delete</button></form></div><?php else: ?>—<?php endif; ?></td></tr><?php endforeach; ?>
    </tbody></table></div></section>
    <?php
}

function render_admin_locations(array $servers): void
{
    admin_heading('Locations', 'Deployment regions derived from the active node catalog.');
    echo '<div class="catalog-grid">';
    foreach (panel_nodes() as $id => $node) {
        $count = count(array_filter($servers, static fn (array $server): bool => $server['node'] === $id));
        echo '<section class="card catalog-card"><p class="eyebrow">' . e($node['region']) . ' region</p><h2>' . e($node['location']) . '</h2><div class="catalog-stats"><span><strong>1</strong>Node</span><span><strong>' . $count . '</strong>Servers</span></div><code>' . e($id) . '</code></section>';
    }
    echo '</div>';
}

function render_admin_nodes(array $servers): void
{
    admin_heading('Nodes & Wings', 'Catalog daemon, SFTP and allocation settings. No live external daemon health is claimed.');
    echo '<div class="grid two">';
    foreach (panel_nodes() as $id => $node) {
        $nodeServers = array_values(array_filter($servers, static fn (array $server): bool => $server['node'] === $id));
        echo '<section class="card"><div class="section-title"><div><p class="eyebrow">' . e($node['location']) . '</p><h2>' . e($node['name']) . '</h2></div><span class="role-pill">Configured</span></div><dl class="details"><div><dt>Wings daemon</dt><dd><code>0.0.0.0:' . $node['daemon_port'] . '</code></dd></div><div><dt>SFTP</dt><dd><code>0.0.0.0:' . $node['sftp_port'] . '</code></dd></div><div><dt>Allocation subnet</dt><dd><code>' . e($node['subnet']) . '0/24</code></dd></div><div><dt>Primary ports</dt><dd><code>' . e(implode(', ', array_map(static fn (array $server): int => $server['port'], $nodeServers)) ?: 'Unallocated') . '</code></dd></div></dl><p class="form-note">Health not probed · ' . count($nodeServers) . ' deployed servers</p></section>';
    }
    echo '</div>';
}

function render_admin_databases(): void
{
    admin_heading('Database Hosts', 'Safe metadata for the self-contained PHP web datastore.');
    ?>
    <div class="grid two"><section class="card"><div class="section-title"><div><p class="eyebrow">Primary datastore</p><h2>Local JSON</h2></div><?= status_badge('running') ?></div><dl class="details"><div><dt>Driver</dt><dd>Locked JSON file</dd></div><div><dt>Location</dt><dd><code>storage/panel.json</code></dd></div><div><dt>Public access</dt><dd>Outside web root</dd></div><div><dt>Credentials</dt><dd>Not applicable</dd></div></dl></section><section class="card empty">No external database hosts are configured for the PHP web edition.</section></div>
    <?php
}

function render_admin_mounts(array $servers): void
{
    admin_heading('Mounts', 'Logical template storage destinations; no external volume attachment is claimed.');
    echo '<div class="catalog-grid">';
    foreach (panel_templates() as $id => $template) {
        $used = count(array_filter($servers, static fn (array $server): bool => $server['template'] === $id));
        echo '<section class="card catalog-card"><h2>' . e($template['name']) . ' storage</h2><p>' . $used . ' attached servers</p><dl class="details"><div><dt>Source</dt><dd><code>server-storage</code></dd></div><div><dt>Target</dt><dd><code>' . e($template['mount']) . '</code></dd></div><div><dt>Access</dt><dd>read / write</dd></div></dl></section>';
    }
    echo '</div>';
}

function render_admin_eggs(array $servers): void
{
    admin_heading('Eggs', 'Deployable game and application definitions, including Minecraft Paper.');
    echo '<div class="catalog-grid">';
    foreach (panel_templates() as $id => $template) {
        $used = count(array_filter($servers, static fn (array $server): bool => $server['template'] === $id));
        echo '<section class="card catalog-card"><span class="role-pill">' . e($template['category']) . '</span><h2>' . e($template['name']) . '</h2><p>' . e($template['description']) . '</p><code class="image-name">' . e($template['image']) . '</code><div class="catalog-stats"><span><strong>' . $template['port'] . '</strong>Default port</span><span><strong>' . $used . '</strong>Deployed</span></div></section>';
    }
    echo '</div>';
}

function render_admin_tags(array $servers): void
{
    admin_heading('Tags', 'Catalog labels for grouping templates and the current fleet.');
    $templates = panel_templates();
    $tags = [
        'game' => array_keys(array_filter($templates, static fn (array $template): bool => $template['category'] === 'game')),
        'application' => array_keys(array_filter($templates, static fn (array $template): bool => $template['category'] === 'app')),
        'minecraft' => ['minecraft'],
        'steam' => array_keys(array_filter($templates, static fn (array $template): bool => str_contains($template['image'], 'steamcmd'))),
        'container' => array_keys($templates),
    ];
    echo '<div class="catalog-grid">';
    foreach ($tags as $tag => $ids) {
        $count = count(array_filter($servers, static fn (array $server): bool => in_array($server['template'], $ids, true)));
        echo '<section class="card catalog-card"><p class="eyebrow">Template tag</p><h2>#' . e($tag) . '</h2><div class="catalog-stats"><span><strong>' . $count . '</strong>Servers</span><span><strong>' . count($ids) . '</strong>Templates</span></div><p>' . e(implode(', ', array_map(static fn (string $id): string => panel_template($id)['name'], $ids))) . '</p></section>';
    }
    echo '</div>';
}

function render_admin_extensions(): void
{
    admin_heading('Extensions', 'Built-in PHP web capabilities and optional module status.');
    echo '<div class="catalog-grid">';
    foreach (panel_core_extensions() as $extension) {
        echo '<section class="card catalog-card"><span class="role-pill">Built in</span><h2>' . e($extension['name']) . '</h2><p>' . e($extension['description']) . '</p></section>';
    }
    echo '</div><div class="card empty spaced">No optional PHP extensions are installed.</div>';
}

function render_admin_api_keys(array $data, string $return): void
{
    admin_heading('API Keys', 'Create persistent Bearer credentials for scripts and services.');
    ?>
    <details class="card create-panel"><summary>Create an API key</summary><form method="post" action="index.php" class="form-grid"><?= action_fields('create_api_key', $return) ?><label>Key name<input name="name" required minlength="2" maxlength="60" placeholder="Deployment bot"></label><label>Expiration<select name="expires_in_days"><option value="0">Never</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option></select></label><div class="form-actions"><button class="button primary" type="submit">Create key</button></div></form></details>
    <section class="card"><div class="section-title"><div><p class="eyebrow">Hashed at rest</p><h2>Administrator credentials</h2></div><span><?= count($data['api_keys']) ?> keys</span></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Key</th><th>Owner</th><th>Last used</th><th>Expires</th><th></th></tr></thead><tbody>
    <?php foreach ($data['api_keys'] as $key): $owner = find_user($data, $key['user_id']); $expired = $key['expires_at'] && strtotime($key['expires_at']) <= time(); ?><tr><td><strong><?= e($key['name']) ?></strong><?php if ($expired): ?><small class="text-danger">Expired</small><?php endif; ?></td><td><code><?= e($key['prefix']) ?>••••••••</code></td><td><?= e($owner['username'] ?? 'Unknown') ?></td><td><?= e(time_ago($key['last_used_at'])) ?></td><td><?= $key['expires_at'] ? e(date('M j, Y', strtotime($key['expires_at']))) : 'Never' ?></td><td><form method="post" action="index.php" data-confirm="Revoke this API key immediately?"><?= action_fields('revoke_api_key', $return) ?><input type="hidden" name="key_id" value="<?= e($key['id']) ?>"><button class="button small danger" type="submit">Revoke</button></form></td></tr><?php endforeach; ?>
    </tbody></table></div><?php if (!$data['api_keys']): ?><p class="empty">No API keys yet.</p><?php endif; ?></section>
    <section class="card spaced"><h2>Using a key</h2><p class="muted">Keep secrets in server-side storage. Send the key to this PHP web origin:</p><pre>Authorization: Bearer btp_your_secret_key

GET /api.php?resource=servers</pre></section>
    <?php
}
