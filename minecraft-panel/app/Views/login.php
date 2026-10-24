<?php
/**
 * Sign-in screen. Standalone layout (no sidebar).
 *
 * @var string $panelName
 * @var string $csrf
 * @var array<string,mixed>|null $flash
 */
?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · <?= btp_e($panelName) ?></title>
<meta name="csrf-token" content="<?= btp_e($csrf) ?>">
<link rel="icon" href="<?= btp_e(btp_url('favicon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= btp_e(btp_url('assets/app.css')) ?>">
<script>
  (function () { try { var t = localStorage.getItem('btp-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {} })();
</script>
</head>
<body>
<div class="auth-shell">
  <aside class="auth-aside">
    <div class="brand" style="padding:0">
      <span class="brand-mark"><?= btp_brand_mark(22) ?></span>
      <span class="brand-text"><strong><?= btp_e($panelName) ?></strong><span>BT Panel module</span></span>
    </div>
    <div class="pitch">
      <h2>Your Minecraft servers, one clean console.</h2>
      <p>Start, stop and watch every world from the panel you already run. Built on plain PHP so it drops straight into a BT Panel site.</p>
      <div class="auth-features">
        <div><?= btp_icon('check') ?> Live console over RCON with command history</div>
        <div><?= btp_icon('check') ?> One-click Vanilla, Paper and Purpur installs</div>
        <div><?= btp_icon('check') ?> File manager, scheduled-friendly backups, audit log</div>
        <div><?= btp_icon('check') ?> Per-server access for your moderators</div>
      </div>
    </div>
    <div class="faint small">PHP <?= btp_e(PHP_VERSION) ?> · SQLite · <?= btp_e(gethostname() ?: 'localhost') ?></div>
  </aside>

  <main class="auth-main">
    <div class="auth-box">
      <div>
        <h1>Welcome back</h1>
        <div class="sub">Sign in to manage your fleet.</div>
      </div>

      <form method="post" action="<?= btp_e(btp_url('login')) ?>" data-ajax-form data-endpoint="<?= btp_e(btp_url('login')) ?>" novalidate>
        <input type="hidden" name="_csrf" value="<?= btp_e($csrf) ?>">
        <div class="form-error" data-form-error role="alert"></div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="username" required autofocus placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required placeholder="••••••••••">
        </div>
        <button class="btn" type="submit">Sign in</button>
      </form>

      <div class="auth-foot">
        <?= btp_icon('lock', 13) ?> Sessions are HttpOnly and revocable from the panel.
      </div>
    </div>
  </main>
</div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<?php if (($flash['message'] ?? '') !== ''): ?>
  <div hidden data-flash="<?= btp_e($flash['type'] ?? 'ok') ?>"><?= btp_e($flash['message']) ?></div>
<?php endif; ?>
<script src="<?= btp_e(btp_url('assets/app.js')) ?>" defer></script>
</body>
</html>
