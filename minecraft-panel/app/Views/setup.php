<?php
/**
 * First-run installer.
 *
 * @var string $panelName
 * @var string $csrf
 * @var list<array{key:string,label:string,ok:bool,required:bool,detail:string}> $requirements
 */
$requiredFailing = array_values(array_filter(
    $requirements,
    static fn (array $r): bool => $r['required'] && !$r['ok'],
));
?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Setup · <?= btp_e($panelName) ?></title>
<meta name="csrf-token" content="<?= btp_e($csrf) ?>">
<link rel="icon" href="<?= btp_e(btp_url('favicon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= btp_e(btp_url('assets/app.css')) ?>">
</head>
<body>
<div class="setup-shell">
  <div class="setup-box">
    <div class="brand" style="padding:0 4px">
      <span class="brand-mark"><?= btp_brand_mark(22) ?></span>
      <span class="brand-text"><strong><?= btp_e($panelName) ?></strong><span>First-run setup</span></span>
    </div>

    <div class="card">
      <div class="card-head">
        <h2>1. Server requirements</h2>
        <div class="spacer"></div>
        <span class="badge <?= $requiredFailing === [] ? 'ok' : 'danger' ?>">
          <?= $requiredFailing === [] ? 'Ready to install' : count($requiredFailing) . ' blocking issue(s)' ?>
        </span>
      </div>
      <div class="card-body tight">
        <div class="checklist">
          <?php foreach ($requirements as $requirement): ?>
            <div class="check-item">
              <span class="check-icon <?= $requirement['ok'] ? 'ok' : 'bad' ?>"><?= $requirement['ok'] ? '✓' : '!' ?></span>
              <div>
                <strong>
                  <?= btp_e($requirement['label']) ?>
                  <?php if (!$requirement['required']): ?><span class="faint small">(optional)</span><?php endif; ?>
                </strong>
                <span class="detail"><?= btp_e($requirement['detail']) ?></span>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>2. Panel &amp; administrator</h2></div>
      <div class="card-body">
        <form method="post" action="<?= btp_e(btp_url('setup')) ?>" data-ajax-form data-endpoint="<?= btp_e(btp_url('setup')) ?>" novalidate>
          <input type="hidden" name="_csrf" value="<?= btp_e($csrf) ?>">
          <div class="form-error" data-form-error role="alert"></div>

          <div class="field-row">
            <div class="field">
              <label for="panel_name">Panel name</label>
              <input id="panel_name" name="panel_name" type="text" value="BT Minecraft Panel" maxlength="60">
            </div>
            <div class="field">
              <label for="timezone">Timezone</label>
              <input id="timezone" name="timezone" type="text" value="<?= btp_e(date_default_timezone_get()) ?>" placeholder="UTC">
              <span class="hint">PHP timezone identifier, e.g. Africa/Cairo</span>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <label for="java_bin">Java binary</label>
              <input id="java_bin" name="java_bin" type="text" value="java" placeholder="/usr/bin/java">
              <span class="hint">Absolute path recommended when java is not on PATH.</span>
            </div>
            <div class="field">
              <label for="process_backend">Process backend</label>
              <select id="process_backend" name="process_backend">
                <option value="auto">Auto (screen → tmux → setsid)</option>
                <option value="screen">GNU screen</option>
                <option value="tmux">tmux</option>
                <option value="nohup">setsid / nohup</option>
              </select>
            </div>
          </div>

          <hr style="border:none;border-top:1px solid var(--line);margin:18px 0">

          <div class="field-row">
            <div class="field">
              <label for="name">Your name</label>
              <input id="name" name="name" type="text" value="Administrator" maxlength="120" autocomplete="name">
            </div>
            <div class="field">
              <label for="email">Admin email</label>
              <input id="email" name="email" type="email" autocomplete="username" required placeholder="admin@example.com">
            </div>
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="new-password" minlength="10" required placeholder="At least 10 characters">
            <span class="hint">Stored with PHP's password_hash() (bcrypt).</span>
          </div>

          <div class="check" style="margin:16px 0 18px">
            <input type="checkbox" id="accept" name="accept" required>
            <label for="accept">
              I understand the panel runs Minecraft servers as the PHP-FPM user and that an administrator
              must accept the <a href="https://www.minecraft.net/en-us/eula" target="_blank" rel="noopener noreferrer">Minecraft EULA</a> for each server.
            </label>
          </div>

          <button class="btn" type="submit" <?= $requiredFailing !== [] ? 'disabled' : '' ?>>
            <?= btp_icon('check', 16) ?> Install panel
          </button>
          <?php if ($requiredFailing !== []): ?>
            <p class="faint small" style="margin-top:10px">Fix the blocking requirements above, then reload this page.</p>
          <?php endif; ?>
        </form>
      </div>
    </div>

    <p class="faint small">
      The installer writes <code>config.php</code> next to <code>config.example.php</code> and creates the SQLite
      database in <code>storage/</code>. Both stay outside the web root.
    </p>
  </div>
</div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<script src="<?= btp_e(btp_url('assets/app.js')) ?>" defer></script>
</body>
</html>
