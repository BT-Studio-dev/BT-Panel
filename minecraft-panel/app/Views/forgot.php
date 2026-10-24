<?php
/**
 * Request a password reset link.
 *
 * @var string $panelName
 * @var string $csrf
 * @var array<string,mixed>|null $flash
 * @var bool $mailConfigured
 */
require __DIR__ . '/partials/auth-head.php';
$asideTitle = 'Locked out? We can fix that.';
$asideText = 'Enter the email address on your account and we will send a single-use link. Links expire after 60 minutes.';
?>
<div class="auth-shell">
  <?php require __DIR__ . '/partials/auth-aside.php'; ?>

  <main class="auth-main">
    <div class="auth-box">
      <div>
        <h1>Reset your password</h1>
        <div class="sub">We will email you a link to choose a new password.</div>
      </div>

      <form method="post" action="<?= btp_e(btp_url('forgot')) ?>" data-ajax-form data-endpoint="<?= btp_e(btp_url('forgot')) ?>" novalidate>
        <input type="hidden" name="_csrf" value="<?= btp_e($csrf) ?>">
        <div class="form-error" data-form-error role="alert"></div>
        <div class="field">
          <label for="email">Account email</label>
          <input id="email" name="email" type="email" required autofocus autocomplete="username" placeholder="you@example.com">
        </div>
        <button class="btn" type="submit"><?= btp_icon('mail', 16) ?> Send reset link</button>
      </form>

      <?php if (empty($mailConfigured)): ?>
        <div class="notice">
          <?= btp_icon('alert', 15) ?>
          <span>Mail delivery is not configured on this host yet. An administrator can still reset your password from the panel or with <code>php bin/btp user:passwd</code>.</span>
        </div>
      <?php endif; ?>

      <div class="auth-foot">
        <a class="auth-link" href="<?= btp_e(btp_url('login')) ?>">← Back to sign in</a>
      </div>
    </div>
  </main>
</div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<script src="<?= btp_e(btp_url('assets/app.js')) ?>" defer></script>
</body>
</html>
