<?php
/**
 * @var array<string,mixed> $settings
 * @var array<string,mixed> $environment
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
