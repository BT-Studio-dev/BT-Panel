<?php
/**
 * @var int $status
 * @var string $message
 * @var string $panelName
 * @var array<string,mixed>|null $user
 */
?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= (int) $status ?> · <?= btp_e($panelName) ?></title>
<link rel="icon" href="<?= btp_e(btp_url('favicon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= btp_e(btp_url('assets/app.css')) ?>">
</head>
<body>
<div class="error-shell">
  <div class="error-box card" style="padding:38px 30px">
    <div class="error-code"><?= (int) $status ?></div>
    <h1 style="font-size:19px"><?= btp_e($title ?? 'Request failed') ?></h1>
    <p class="muted" style="margin:0"><?= btp_e($message) ?></p>
    <div class="btn-row" style="justify-content:center;margin-top:8px">
      <a class="btn" href="<?= btp_e(btp_url($user ? 'dashboard' : 'login')) ?>"><?= btp_icon('back', 15) ?> <?= $user ? 'Back to dashboard' : 'Go to sign in' ?></a>
      <?php if ($status === 401): ?>
        <a class="ghost-btn" href="<?= btp_e(btp_url('login')) ?>">Sign in</a>
      <?php endif; ?>
    </div>
  </div>
</div>
</body>
</html>
