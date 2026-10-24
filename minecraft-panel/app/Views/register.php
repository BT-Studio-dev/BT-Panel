<?php
/**
 * Self-service registration.
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
  <?php
  $asideTitle = 'Create your account and start a world.';
  $asideText = 'New accounts are members: you get your own servers, files and backups, while administrators keep the host and user list.';
  require __DIR__ . '/partials/auth-aside.php';
  ?>

  <main class="auth-main">
    <div class="auth-box">
      <div>
        <h1>Create your account</h1>
        <div class="sub">It takes a moment — no email confirmation required.</div>
      </div>

      <?php if (!$registrationOpen): ?>
        <div class="notice">
          <?= btp_icon('lock', 15) ?>
          <span>Self-registration is disabled. Ask an administrator to create an account for you.</span>
        </div>
      <?php else: ?>
        <?php if (!empty($googleEnabled)): ?>
          <a class="btn-google" href="<?= btp_e(btp_url('auth/google/start')) ?>">
            <?= btp_google_icon() ?> Sign up with Google
          </a>
          <div class="auth-divider"><span>or use an email address</span></div>
        <?php endif; ?>

        <form method="post" action="<?= btp_e(btp_url('register')) ?>" data-ajax-form data-endpoint="<?= btp_e(btp_url('register')) ?>" novalidate>
          <input type="hidden" name="_csrf" value="<?= btp_e($csrf) ?>">
          <div class="form-error" data-form-error role="alert"></div>

          <div class="field">
            <label for="name">Display name</label>
            <input id="name" name="name" type="text" maxlength="120" autocomplete="name" placeholder="Alex Builder">
          </div>
          <div class="field">
            <label for="email">Email</label>
            <input id="email" name="email" type="email" required autocomplete="username" placeholder="you@example.com">
          </div>
          <div class="field-row">
            <div class="field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" minlength="10" required autocomplete="new-password" placeholder="At least 10 characters">
            </div>
            <div class="field">
              <label for="password_confirm">Confirm password</label>
              <input id="password_confirm" name="password_confirm" type="password" minlength="10" required autocomplete="new-password" placeholder="Repeat it">
            </div>
          </div>

          <div class="check" style="margin:4px 0 16px">
            <input type="checkbox" id="terms" name="terms" value="1" required>
            <label for="terms">
              I agree to the <a href="https://www.minecraft.net/en-us/eula" target="_blank" rel="noopener noreferrer">Minecraft EULA</a>
              and will only run servers I am allowed to host.
            </label>
          </div>

          <button class="btn" type="submit"><?= btp_icon('user', 16) ?> Create account</button>
        </form>
      <?php endif; ?>

      <div class="auth-foot">
        Already have an account? <a class="auth-link" href="<?= btp_e(btp_url('login')) ?>">Sign in</a>
      </div>
    </div>
  </main>
</div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<script src="<?= btp_e(btp_url('assets/app.js')) ?>" defer></script>
</body>
</html>
