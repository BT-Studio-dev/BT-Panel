<?php
/**
 * @var array<string,mixed> $settings
 * @var array<string,mixed> $environment
 * @var array<string,mixed> $auth
 */
$crumbs = btp_e($panelName) . ' / Settings';
require __DIR__ . '/partials/head.php';
?>

<div class="grid cols-2">
  <section class="card">
    <div class="card-head"><h2>Panel</h2></div>
    <div class="card-body">
      <form data-settings-form>
        <div class="form-error" data-form-error role="alert"></div>
        <div class="field">
          <label for="panel-name">Panel name</label>
          <input id="panel-name" name="panel_name" type="text" value="<?= btp_e($settings['panel_name']) ?>" maxlength="60">
          <span class="hint">Shown in the sidebar, page titles and sign-in screen.</span>
        </div>
        <div class="field">
          <label for="default-memory">Default heap for new servers (MB)</label>
          <input id="default-memory" name="default_memory_mb" type="number" min="512" max="65536" step="256" value="<?= (int) $settings['default_memory_mb'] ?>">
        </div>
        <div class="check" style="margin-bottom:16px">
          <input type="checkbox" id="allow-registration" name="allow_registration" value="1" <?= $settings['allow_registration'] ? 'checked' : '' ?>>
          <label for="allow-registration">
            Allow self-registration. New accounts are <strong>members</strong>; only admins can create other admins.
          </label>
        </div>
        <button class="btn" type="submit"><?= btp_icon('check', 15) ?> Save settings</button>
      </form>
    </div>
  </section>

  <section class="card">
    <div class="card-head"><h2>Your password</h2></div>
    <div class="card-body">
      <form data-password-form>
        <div class="form-error" data-form-error role="alert"></div>
        <div class="field">
          <label for="current-password">Current password</label>
          <input id="current-password" name="current_password" type="password" autocomplete="current-password" required>
        </div>
        <div class="field">
          <label for="new-password">New password</label>
          <input id="new-password" name="new_password" type="password" minlength="10" autocomplete="new-password" required>
          <span class="hint">At least 10 characters. Other sessions are signed out.</span>
        </div>
        <button class="btn" type="submit"><?= btp_icon('lock', 15) ?> Update password</button>
      </form>
    </div>
  </section>
</div>

<section class="card">
  <div class="card-head">
    <h2>Sign-in &amp; email</h2>
    <div class="spacer"></div>
    <span class="badge <?= $auth['google_enabled'] ? 'ok' : 'off' ?>">
      Google <?= $auth['google_enabled'] ? 'enabled' : ($auth['google_configured'] ? 'configured, off' : 'not configured') ?>
    </span>
  </div>
  <div class="card-body">
    <form data-auth-form>
      <div class="form-error" data-form-error role="alert"></div>

      <h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin:0 0 12px">Google / Gmail sign-in</h3>
      <div class="field">
        <label for="google-client-id">Client ID</label>
        <input id="google-client-id" name="google_client_id" type="text" value="<?= btp_e($auth['google_client_id']) ?>" placeholder="1234567890-abc123.apps.googleusercontent.com" autocomplete="off">
      </div>
      <div class="field">
        <label for="google-client-secret">Client secret</label>
        <input id="google-client-secret" name="google_client_secret" type="password" value="" placeholder="<?= $auth['google_has_secret'] ? 'Stored — leave empty to keep it' : 'Paste the secret from Google Cloud Console' ?>" autocomplete="new-password">
        <span class="hint">Stored in the panel database, never sent to the browser.</span>
      </div>
      <div class="field">
        <label for="google-redirect">Authorized redirect URI</label>
        <input id="google-redirect" name="google_redirect_uri" type="text" value="<?= btp_e($auth['google_redirect_uri']) ?>" placeholder="https://mc.example.com/auth/google/callback">
        <span class="hint">Add exactly this URI to the OAuth client in Google Cloud Console (APIs &amp; Services → Credentials).</span>
      </div>
      <div class="field">
        <label for="google-domains">Allowed email domains <span class="faint">(optional)</span></label>
        <input id="google-domains" name="google_allowed_domains" type="text" value="<?= btp_e($auth['google_allowed_domains']) ?>" placeholder="gmail.com, yourcompany.com">
        <span class="hint">Comma separated. Empty accepts any Google account.</span>
      </div>
      <div class="check" style="margin-bottom:16px">
        <input type="checkbox" id="google-enabled" name="google_enabled" value="1" <?= $auth['google_enabled'] ? 'checked' : '' ?>>
        <label for="google-enabled">Show “Continue with Google” on the sign-in and registration pages.</label>
      </div>

      <h3 style="font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin:22px 0 12px">Password reset email</h3>
      <div class="field-row">
        <div class="field">
          <label for="mail-transport">Transport</label>
          <select id="mail-transport" name="mail_transport">
            <?php foreach (['mail' => 'PHP mail() / sendmail', 'smtp' => 'SMTP', 'log' => 'Log to file (testing)'] as $value => $label): ?>
              <option value="<?= $value ?>" <?= $auth['mail_transport'] === $value ? 'selected' : '' ?>><?= btp_e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="field">
          <label for="mail-from">Sender address</label>
          <input id="mail-from" name="mail_from" type="email" value="<?= btp_e($auth['mail_from']) ?>" placeholder="no-reply@example.com">
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="mail-host">SMTP host</label>
          <input id="mail-host" name="mail_host" type="text" value="<?= btp_e($auth['mail_host']) ?>" placeholder="smtp.gmail.com" autocomplete="off">
        </div>
        <div class="field">
          <label for="mail-port">Port</label>
          <input id="mail-port" name="mail_port" type="number" min="1" max="65535" value="<?= (int) $auth['mail_port'] ?>">
        </div>
        <div class="field">
          <label for="mail-encryption">Encryption</label>
          <select id="mail-encryption" name="mail_encryption">
            <?php foreach (['tls' => 'STARTTLS (587)', 'ssl' => 'SSL (465)', 'none' => 'None'] as $value => $label): ?>
              <option value="<?= $value ?>" <?= $auth['mail_encryption'] === $value ? 'selected' : '' ?>><?= btp_e($label) ?></option>
            <?php endforeach; ?>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="mail-username">SMTP username</label>
          <input id="mail-username" name="mail_username" type="text" value="<?= btp_e($auth['mail_username']) ?>" autocomplete="off">
        </div>
        <div class="field">
          <label for="mail-password">SMTP password</label>
          <input id="mail-password" name="mail_password" type="password" value="" placeholder="<?= $auth['mail_has_password'] ? 'Stored — leave empty to keep it' : 'App password' ?>" autocomplete="new-password">
        </div>
      </div>
      <div class="field">
        <label for="mail-from-name">Sender name</label>
        <input id="mail-from-name" name="mail_from_name" type="text" value="<?= btp_e($auth['mail_from_name']) ?>" maxlength="120">
      </div>

      <div class="btn-row">
        <button class="btn" type="submit"><?= btp_icon('check', 15) ?> Save sign-in settings</button>
        <button class="ghost-btn" type="button" data-mail-test><?= btp_icon('mail', 15) ?> Send test email</button>
        <a class="ghost-btn" href="<?= btp_e(btp_url('forgot')) ?>" target="_blank" rel="noopener">Preview reset page</a>
      </div>
      <p class="faint small" style="margin-top:12px">
        Gmail SMTP needs an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style="color:var(--info)">app password</a>
        with 2-step verification on. Google OAuth redirect URIs must use HTTPS and match exactly.
      </p>
    </form>
  </div>
</section>

<section class="card">
  <div class="card-head"><h2>Runtime</h2><div class="spacer"></div><span class="badge accent"><?= btp_e((string) $environment['backend']) ?></span></div>
  <div class="card-body">
    <dl class="kv">
      <dt>PHP</dt><dd><?= btp_e((string) $environment['php']) ?></dd>
      <dt>Java</dt><dd><?= btp_e($environment['java'] ?? 'not found') ?></dd>
      <dt>Java binary</dt><dd><?= btp_e((string) $environment['java_bin']) ?></dd>
      <dt>Process backend</dt><dd><?= btp_e((string) $environment['backend']) ?></dd>
      <dt>Timezone</dt><dd><?= btp_e((string) $environment['timezone']) ?></dd>
      <dt>Secure cookies</dt><dd><?= $environment['secure_cookies'] ? 'enabled' : 'disabled (set secure_cookies = true behind HTTPS)' ?></dd>
      <dt>Data directory</dt><dd><?= btp_e((string) $environment['data_dir']) ?></dd>
      <dt>Backup directory</dt><dd><?= btp_e((string) $environment['backup_dir']) ?></dd>
      <dt>Log directory</dt><dd><?= btp_e((string) $environment['log_dir']) ?></dd>
      <dt>Database</dt><dd><?= btp_e((string) $environment['db_path']) ?></dd>
      <dt>Disk</dt><dd><?= btp_bytes((int) $environment['free_disk']) ?> free of <?= btp_bytes((int) $environment['total_disk']) ?></dd>
    </dl>
  </div>
</section>

<section class="card">
  <div class="card-head"><h2>Deployment notes</h2></div>
  <div class="card-body">
    <div class="grid cols-3">
      <div>
        <strong>BT Panel site</strong>
        <p class="muted small">
          Add the site, set the document root to <code>public/</code>, choose PHP 8.1+ and enable the
          <code>pdo_sqlite</code> extension. Disable the default PHP “anti-cross-site” rewrite for
          <code>/api/</code> if you add custom location rules.
        </p>
      </div>
      <div>
        <strong>Ports &amp; firewall</strong>
        <p class="muted small">
          Open the Minecraft game port (default <code>25565/tcp</code>) and, if you use it, the RCON port in
          BT Panel → Security. Wings does not need to be installed for local servers.
        </p>
      </div>
      <div>
        <strong>Backups &amp; updates</strong>
        <p class="muted small">
          Backups land in <code>storage/backups</code>. Include <code>config.php</code> and
          <code>storage/panel.sqlite</code> in your BT Panel site backup, and keep the folder outside git.
        </p>
      </div>
    </div>
    <p class="faint small" style="margin-top:14px">
      Operating a Minecraft server means you are responsible for the
      <a href="https://www.minecraft.net/en-us/eula" target="_blank" rel="noopener noreferrer" style="color:var(--info)">Minecraft EULA</a>
      and for keeping Java updated.
    </p>
  </div>
</section>

<?php require __DIR__ . '/partials/foot.php'; ?>
