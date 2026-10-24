<?php
/**
 * Choose a new password using a reset token.
 *
 * @var string $panelName
 * @var string $csrf
 * @var array<string,mixed>|null $flash
 * @var bool $valid
 * @var string $token
 * @var string $email
 */
require __DIR__ . '/partials/auth-head.php';
$asideTitle = 'Choose a new password.';
$asideText = 'Setting a new password signs out every other session for this account.';
?>
<div class="auth-shell">
  <?php require __DIR__ . '/partials/auth-aside.php'; ?>

  <main class="auth-main">
    <div class="auth-box">
      <?php if (!$valid): ?>
        <div>
          <h1>Link expired</h1>
          <div class="sub">This reset link is invalid, already used, or older than 60 minutes.</div>
        </div>
        <div class="notice">
          <?= btp_icon('alert', 15) ?>
          <span>Request a fresh link and try again.</span>
        </div>
        <a class="btn" href="<?= btp_e(btp_url('forgot')) ?>"><?= btp_icon('mail', 16) ?> Request a new link</a>
      <?php else: ?>
        <div>
          <h1>New password</h1>
          <div class="sub">for <strong><?= btp_e($email) ?></strong></div>
        </div>

        <form method="post" action="<?= btp_e(btp_url('reset')) ?>" data-ajax-form data-endpoint="<?= btp_e(btp_url('reset')) ?>" novalidate>
          <input type="hidden" name="_csrf" value="<?= btp_e($csrf) ?>">
          <input type="hidden" name="token" value="<?= btp_e($token) ?>">
          <div class="form-error" data-form-error role="alert"></div>

          <div class="field">
            <label for="password">New password</label>
            <input id="password" name="password" type="password" minlength="10" required autofocus autocomplete="new-password" placeholder="At least 10 characters">
          </div>
          <div class="field">
            <label for="password_confirm">Confirm new password</label>
            <input id="password_confirm" name="password_confirm" type="password" minlength="10" required autocomplete="new-password" placeholder="Repeat it">
          </div>
          <button class="btn" type="submit"><?= btp_icon('key', 16) ?> Update password &amp; sign in</button>
        </form>
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
