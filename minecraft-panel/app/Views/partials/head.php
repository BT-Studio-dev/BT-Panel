<?php
/**
 * Shared shell: document head, sidebar navigation and top bar.
 *
 * @var string $panelName
 * @var array<string,mixed>|null $user
 * @var string $active
 * @var string $title
 * @var string $csrf
 * @var array<string,mixed>|null $flash
 */
$navItems = [
    ['key' => 'dashboard', 'label' => 'Dashboard', 'href' => btp_url('dashboard'), 'icon' => 'grid', 'admin' => false],
    ['key' => 'servers', 'label' => 'Servers', 'href' => btp_url('servers'), 'icon' => 'server', 'admin' => false],
];
$adminItems = [
    ['key' => 'users', 'label' => 'Users', 'href' => btp_url('users'), 'icon' => 'users', 'admin' => true],
    ['key' => 'activity', 'label' => 'Activity', 'href' => btp_url('activity'), 'icon' => 'activity', 'admin' => true],
    ['key' => 'settings', 'label' => 'Settings', 'href' => btp_url('settings'), 'icon' => 'settings', 'admin' => true],
];
$isAdmin = ($user['role'] ?? '') === 'admin';
$initials = '';
if (is_array($user) && isset($user['name'])) {
    $parts = preg_split('/\s+/', trim((string) $user['name'])) ?: [];
    foreach (array_slice($parts, 0, 2) as $part) {
        $initials .= mb_substr($part, 0, 1);
    }
    $initials = $initials !== '' ? $initials : mb_substr((string) ($user['email'] ?? '?'), 0, 1);
}
?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= btp_e($title !== '' ? $title . ' · ' . $panelName : $panelName) ?></title>
<meta name="csrf-token" content="<?= btp_e($csrf) ?>">
<meta name="app-base" content="<?= btp_e(btp_url('')) ?>">
<meta name="color-scheme" content="dark light">
<link rel="icon" href="<?= btp_e(btp_url('favicon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= btp_e(btp_url('assets/app.css')) ?>">
<script>
  (function () {
    try {
      var stored = localStorage.getItem('btp-theme');
      if (stored === 'light' || stored === 'dark') document.documentElement.dataset.theme = stored;
    } catch (e) {}
  })();
</script>
</head>
<body>
<?php if (($flash['message'] ?? '') !== ''): ?>
  <div hidden data-flash="<?= btp_e($flash['type'] ?? 'ok') ?>"><?= btp_e($flash['message']) ?></div>
<?php endif; ?>
<div class="shell">
  <aside class="sidebar">
    <a class="brand" href="<?= btp_e(btp_url('dashboard')) ?>">
      <span class="brand-mark"><?= btp_brand_mark(22) ?></span>
      <span class="brand-text">
        <strong><?= btp_e($panelName) ?></strong>
        <span>Minecraft control</span>
      </span>
    </a>

    <nav class="nav" aria-label="Primary">
      <span class="nav-label">Manage</span>
      <?php foreach ($navItems as $item): ?>
        <a href="<?= btp_e($item['href']) ?>" class="<?= $active === $item['key'] ? 'active' : '' ?>">
          <?= btp_icon($item['icon']) ?><span><?= btp_e($item['label']) ?></span>
        </a>
      <?php endforeach; ?>

      <?php if ($isAdmin): ?>
        <span class="nav-label">Administration</span>
        <?php foreach ($adminItems as $item): ?>
          <a href="<?= btp_e($item['href']) ?>" class="<?= $active === $item['key'] ? 'active' : '' ?>">
            <?= btp_icon($item['icon']) ?><span><?= btp_e($item['label']) ?></span>
          </a>
        <?php endforeach; ?>
      <?php endif; ?>
    </nav>

    <div class="sidebar-foot">
      <?php if (is_array($user)): ?>
        <div class="user-chip">
          <span class="avatar"><?= btp_e($initials ?: '?') ?></span>
          <span class="who">
            <strong><?= btp_e($user['name'] ?: $user['email']) ?></strong>
            <span><?= btp_e($user['role']) ?></span>
          </span>
        </div>
        <form method="post" action="<?= btp_e(btp_url('logout')) ?>">
          <input type="hidden" name="_csrf" value="<?= btp_e($csrf) ?>">
          <button class="ghost-btn" type="submit"><?= btp_icon('logout', 16) ?> Sign out</button>
        </form>
      <?php endif; ?>
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <div>
        <h1><?= btp_e($title !== '' ? $title : $panelName) ?></h1>
        <div class="crumbs"><?= btp_e($crumbs ?? '') ?></div>
      </div>
      <div class="spacer"></div>
      <div class="topbar-actions">
        <button class="ghost-btn icon" type="button" data-theme-toggle title="Toggle light/dark theme" aria-label="Toggle theme">
          <?= btp_icon('globe', 16) ?>
        </button>
        <?php if (is_array($user) && $active === 'servers'): ?>
          <button class="btn" type="button" data-open-modal="create-server"><?= btp_icon('plus', 16) ?> New server</button>
        <?php endif; ?>
      </div>
    </header>
    <div class="content">
