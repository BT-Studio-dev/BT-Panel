<?php
/**
 * Shared <head> for the standalone authentication pages.
 *
 * @var string $title
 * @var string $panelName
 * @var string $csrf
 */
?>
<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= btp_e($title) ?> · <?= btp_e($panelName) ?></title>
<meta name="csrf-token" content="<?= btp_e($csrf) ?>">
<link rel="icon" href="<?= btp_e(btp_url('favicon.svg')) ?>" type="image/svg+xml">
<link rel="stylesheet" href="<?= btp_e(btp_url('assets/app.css')) ?>">
<script>
  (function () { try { var t = localStorage.getItem('btp-theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) {} })();
</script>
</head>
<body>
<?php if (($flash['message'] ?? '') !== ''): ?>
  <div hidden data-flash="<?= btp_e($flash['type'] ?? 'ok') ?>"><?= btp_e($flash['message']) ?></div>
<?php endif; ?>
