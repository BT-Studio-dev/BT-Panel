<?php
/**
 * Sign-in screen.
 *
 * @var string $panelName
 * @var string $csrf
 * @var array<string,mixed>|null $flash
 * @var bool $googleEnabled
 * @var bool $registrationOpen
 */
require __DIR__ . '/partials/auth-head.php';
?>
<div class="auth-shell">
  <?php require __DIR__ . '/partials/auth-aside.php'; ?>

  <main class="auth-main">
    <div class="auth-box">
      <div>
        <h1>Welcome back</h1>
        <div class="sub">Sign in to manage your fleet.</div>
      </div>

      <?php if (!empty($googleEnabled)): ?>
        <a class="btn-google" href="<?= btp_e(btp_url('auth/google/start')) ?>">
          <?= btp_google_icon() ?> Continue with Google
        </a>
        <div class="auth-divider"><span>or sign in with email</span></div>
      <?php endif; ?>

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
        <div class="auth-row">
          <label class="check" style="font-size:12.5px">
            <input type="checkbox" name="remember" value="1" checked>
            <span>Keep me signed in</span>
          </label>
          <a class="auth-link" href="<?= btp_e(btp_url('forgot')) ?>">Forgot password?</a>
        </div>
        <button class="btn" type="submit">Sign in</button>
      </form>

      <?php if (!empty($registrationOpen)): ?>
        <div class="auth-foot">
          New here? <a class="auth-link" href="<?= btp_e(btp_url('register')) ?>">Create an account</a>
        </div>
      <?php else: ?>
        <div class="auth-foot">Need an account? Ask a panel administrator.</div>
      <?php endif; ?>

      <div class="auth-foot">
        <?= btp_icon('lock', 13) ?> Sessions are HttpOnly and revocable from the panel.
      </div>
    </div>
  </main>
</div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<script src="<?= btp_e(btp_url('assets/app.js')) ?>" defer></script>
</body>
</html>
