<?php
/**
 * Server detail page: overview, console, files, backups and settings.
 *
 * @var array<string,mixed> $server
 * @var array<string,mixed> $status
 * @var list<array<string,mixed>> $backups
 * @var list<string> $console
 * @var int $consoleOffset
 * @var bool $canManage
 * @var bool $hasJar
 * @var string $backend
 * @var string|null $javaVersion
 * @var string $serverHost
 */
$isRunning = $status['state'] === 'running';
$crumbs = btp_e($panelName) . ' / Servers / ' . $server['name'];
require __DIR__ . '/partials/head.php';
?>

<div class="card" data-server-page data-server-id="<?= btp_e($server['id']) ?>" data-console-offset="<?= (int) $consoleOffset ?>">
  <div class="card-body" style="display:flex;flex-wrap:wrap;gap:18px;align-items:center">
    <span class="server-icon" style="width:52px;height:52px"><?= btp_icon('server', 26) ?></span>
    <div style="min-width:220px;flex:1">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <h2 style="font-size:20px"><?= btp_e($server['name']) ?></h2>
        <span class="badge <?= $isRunning ? 'ok' : 'off' ?>" data-live-badge>
          <span class="dot <?= $isRunning ? 'on' : 'off' ?>"></span><?= $isRunning ? 'Running' : 'Stopped' ?>
        </span>
        <span class="badge"><?= btp_e($server['type']) ?> <?= btp_e($server['version']) ?></span>
        <?php if (!$hasJar): ?><span class="badge warn"><?= btp_icon('alert', 12) ?> Files not installed</span><?php endif; ?>
      </div>
      <div class="faint small" style="margin-top:6px">
        <?= btp_e($serverHost) ?>:<?= (int) $server['port'] ?> · RCON <?= (int) $server['rcon_port'] ?> · <?= (int) $server['memory_mb'] ?> MB heap ·
        <span data-live-uptime><?= $isRunning ? btp_duration((int) $status['uptime']) : 'stopped' ?></span>
      </div>
    </div>
    <div class="btn-row">
      <?php if ($isRunning): ?>
        <button class="ghost-btn" type="button" data-power="restart" data-server="<?= btp_e($server['id']) ?>"><?= btp_icon('restart', 15) ?> Restart</button>
        <button class="btn" type="button" data-power="stop" data-server="<?= btp_e($server['id']) ?>"><?= btp_icon('stop', 15) ?> Stop</button>
        <button class="ghost-btn" type="button" data-power="kill" data-server="<?= btp_e($server['id']) ?>" title="Force kill"><?= btp_icon('power', 15) ?></button>
      <?php else: ?>
        <button class="btn" type="button" data-power="start" data-server="<?= btp_e($server['id']) ?>"><?= btp_icon('play', 15) ?> Start</button>
      <?php endif; ?>
      <?php if ($canManage): ?>
        <button class="ghost-btn" type="button" data-install-server data-server="<?= btp_e($server['id']) ?>" <?= $isRunning ? 'disabled title="Stop the server first"' : '' ?>>
          <?= btp_icon('download', 15) ?> <?= $hasJar ? 'Reinstall' : 'Install files' ?>
        </button>
      <?php endif; ?>
    </div>
  </div>
</div>

<div class="tabs" role="tablist">
  <button type="button" role="tab" data-tab="overview" class="active">Overview</button>
  <button type="button" role="tab" data-tab="console">Console</button>
  <button type="button" role="tab" data-tab="files">Files</button>
  <button type="button" role="tab" data-tab="backups">Backups <span class="faint">(<?= count($backups) ?>)</span></button>
  <button type="button" role="tab" data-tab="settings">Settings</button>
</div>

<!-- ---------------------------------------------------------------- Overview -->
<section class="tab-panel grid cols-2" data-panel="overview">
  <div class="card">
    <div class="card-head"><h2>Connection</h2></div>
    <div class="card-body">
      <dl class="kv">
        <dt>Java edition address</dt><dd><?= btp_e($serverHost) ?>:<?= (int) $server['port'] ?></dd>
        <dt>Server directory</dt><dd><?= btp_e($server['directory']) ?></dd>
        <dt>Launcher jar</dt><dd><?= btp_e($server['jar']) ?></dd>
        <dt>RCON</dt><dd>127.0.0.1:<?= (int) $server['rcon_port'] ?> <?= $server['rcon_enabled'] ? '(enabled)' : '(disabled)' ?></dd>
        <dt>JVM</dt><dd><?= btp_e($javaVersion ?? 'java not found') ?></dd>
        <dt>Backend</dt><dd><?= btp_e($backend) ?></dd>
        <?php if (!empty($status['attach_command']) && $isRunning): ?>
          <dt>SSH attach</dt><dd><?= btp_e((string) $status['attach_command']) ?></dd>
        <?php endif; ?>
      </dl>
      <p class="faint small" style="margin-top:14px">
        Open the game port in BT Panel → 安全 (Security) and your provider firewall. Visit the console
        tab for a live view, or attach over SSH with the command above.
      </p>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>Live output</h2><div class="spacer"></div><button class="ghost-btn sm" type="button" data-tab-jump="console">Open console</button></div>
    <div class="card-body">
      <div class="console" data-console-preview style="height:280px">
        <?php if ($console === []): ?>
          <span class="console-empty">No output yet — start the server to see the log.</span>
        <?php else: ?>
          <?php foreach (array_slice($console, -40) as $line): ?>
            <?= btp_console_line($line) ?>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>
    </div>
  </div>
</section>

<!-- ---------------------------------------------------------------- Console -->
<section class="tab-panel" data-panel="console" hidden>
  <div class="card">
    <div class="card-head">
      <h2>Console</h2>
      <div class="spacer"></div>
      <span class="badge" data-console-state><?= $isRunning ? 'live' : 'offline' ?></span>
      <button class="ghost-btn sm" type="button" data-console-clear>Clear view</button>
      <label class="ghost-btn sm" style="cursor:pointer">
        <input type="checkbox" data-console-follow checked style="margin-right:6px"> Follow
      </label>
    </div>
    <div class="card-body">
      <div class="console" data-console-log>
        <?php if ($console === []): ?>
          <span class="console-empty">Waiting for the server to write output…</span>
        <?php else: ?>
          <?php foreach ($console as $line): ?>
            <?= btp_console_line($line) ?>
          <?php endforeach; ?>
        <?php endif; ?>
      </div>
      <form class="console-bar" data-console-form>
        <input type="text" name="command" placeholder="say Hello world  ·  list  ·  op <player>" autocomplete="off" spellcheck="false" maxlength="512" data-console-input>
        <button class="btn" type="submit"><?= btp_icon('terminal', 15) ?> Send</button>
      </form>
      <p class="faint small" style="margin-top:8px">Commands run over RCON as the server console. Use ↑ / ↓ for history.</p>
    </div>
  </div>
</section>

<!-- ------------------------------------------------------------------- Files -->
<section class="tab-panel" data-panel="files" hidden>
  <div class="card">
    <div class="card-head">
      <h2>Files</h2>
      <div class="spacer"></div>
      <button class="ghost-btn sm" type="button" data-file-up><?= btp_icon('upload', 14) ?> Upload</button>
      <button class="ghost-btn sm" type="button" data-file-mkdir><?= btp_icon('folder-plus', 14) ?> New folder</button>
      <button class="ghost-btn sm" type="button" data-file-refresh><?= btp_icon('refresh', 14) ?> Refresh</button>
    </div>
    <div class="card-body">
      <div class="file-toolbar">
        <div class="path-crumbs" data-file-path><button type="button" data-file-path-go="">/</button></div>
        <input type="file" data-file-input hidden>
        <span class="faint small" data-file-usage></span>
      </div>
      <div class="file-list" data-file-list>
        <div class="empty"><span class="spinner"></span> <span class="muted" style="margin-left:8px">Loading files…</span></div>
      </div>
      <p class="faint small" style="margin-top:10px">Text files up to 1 MB open in the built-in editor. Uploads are capped at 256 MB.</p>
    </div>
  </div>
</section>

<!-- ----------------------------------------------------------------- Backups -->
<section class="tab-panel" data-panel="backups" hidden>
  <div class="grid cols-2">
    <div class="card">
      <div class="card-head"><h2>Create backup</h2></div>
      <div class="card-body">
        <form data-backup-form>
          <div class="field">
            <label for="backup-label">Label <span class="faint">(optional)</span></label>
            <input id="backup-label" name="label" type="text" maxlength="60" placeholder="Before 1.21 update">
          </div>
          <button class="btn" type="submit" <?= $isRunning ? 'disabled' : '' ?>><?= btp_icon('archive', 15) ?> Create archive</button>
          <p class="faint small" style="margin-top:10px">
            <?= $isRunning ? 'Stop the server first — live world folders can be inconsistent.' : 'Archives the whole server directory (world, plugins, configs) as .tar.gz.' ?>
          </p>
        </form>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Restore notes</h2></div>
      <div class="card-body">
        <p class="muted small" style="margin-top:0">
          Restoring replaces the entire server directory with the archive contents. The server must be stopped;
          the current directory is kept as a rollback until the restore completes.
        </p>
        <p class="faint small">Backups are stored outside the server folder in <code><?= btp_e((string) btp_config()['backup_dir']) ?></code>.</p>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head">
      <h2>Archives</h2>
      <div class="spacer"></div>
      <button class="ghost-btn sm" type="button" data-backup-refresh><?= btp_icon('refresh', 14) ?> Refresh</button>
    </div>
    <div class="card-body tight">
      <table class="data">
        <thead><tr><th>Created</th><th>Label</th><th>Size</th><th></th></tr></thead>
        <tbody data-backup-rows>
        <?php if ($backups === []): ?>
          <tr><td colspan="4"><div class="empty muted">No backups yet.</div></td></tr>
        <?php else: ?>
          <?php foreach ($backups as $backup): ?>
            <tr>
              <td class="mono small"><?= btp_e(btp_datetime($backup['created_at'])) ?></td>
              <td><?= btp_e($backup['label'] ?: '—') ?></td>
              <td class="mono small"><?= btp_bytes((int) $backup['size']) ?></td>
              <td>
                <div class="actions">
                  <a class="ghost-btn sm" href="<?= btp_e(btp_url('api/servers/' . $server['id'] . '/backups/' . $backup['id'] . '/download')) ?>"><?= btp_icon('download', 13) ?></a>
                  <?php if ($canManage): ?>
                    <button class="ghost-btn sm" type="button" data-backup-restore="<?= btp_e($backup['id']) ?>" <?= $isRunning ? 'disabled' : '' ?>><?= btp_icon('restart', 13) ?></button>
                    <button class="ghost-btn sm" type="button" data-backup-delete="<?= btp_e($backup['id']) ?>"><?= btp_icon('trash', 13) ?></button>
                  <?php endif; ?>
                </div>
              </td>
            </tr>
          <?php endforeach; ?>
        <?php endif; ?>
        </tbody>
      </table>
    </div>
  </div>
</section>

<!-- ---------------------------------------------------------------- Settings -->
<section class="tab-panel" data-panel="settings" hidden>
  <div class="grid cols-2">
    <div class="card">
      <div class="card-head"><h2>Server settings</h2></div>
      <div class="card-body">
        <?php if (!$canManage): ?>
          <p class="muted">Only the server owner or an administrator can change these settings.</p>
        <?php else: ?>
          <form data-server-settings>
            <div class="field">
              <label for="setting-name">Name</label>
              <input id="setting-name" name="name" type="text" value="<?= btp_e($server['name']) ?>" maxlength="64">
            </div>
            <div class="field-row">
              <div class="field">
                <label for="setting-memory">Heap (MB)</label>
                <input id="setting-memory" name="memory_mb" type="number" min="512" max="65536" step="256" value="<?= (int) $server['memory_mb'] ?>">
              </div>
              <div class="field">
                <label for="setting-port">Game port</label>
                <input id="setting-port" name="port" type="number" min="1024" max="65535" value="<?= (int) $server['port'] ?>" <?= $isRunning ? 'disabled' : '' ?>>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="setting-type">Software</label>
                <select id="setting-type" name="type">
                  <?php foreach (['vanilla', 'paper', 'purpur', 'custom'] as $type): ?>
                    <option value="<?= $type ?>" <?= $server['type'] === $type ? 'selected' : '' ?>><?= ucfirst($type) ?></option>
                  <?php endforeach; ?>
                </select>
              </div>
              <div class="field">
                <label for="setting-version">Version</label>
                <input id="setting-version" name="version" type="text" value="<?= btp_e($server['version']) ?>" maxlength="32">
              </div>
            </div>
            <div class="field">
              <label for="setting-flags">Extra JVM flags</label>
              <input id="setting-flags" name="java_flags" type="text" value="<?= btp_e($server['java_flags']) ?>" maxlength="400" placeholder="-XX:+UseG1GC">
              <span class="hint">Applied on next start. Only letters, digits and <code>_.-=:+/</code> are accepted.</span>
            </div>
            <div class="field">
              <label for="setting-rcon">RCON password</label>
              <input id="setting-rcon" name="rcon_password" type="text" value="" placeholder="Leave empty to generate a new one" maxlength="64" autocomplete="new-password">
              <span class="hint">Changing this rewrites server.properties and requires a restart.</span>
            </div>
            <button class="btn" type="submit"><?= btp_icon('check', 15) ?> Save settings</button>
          </form>
        <?php endif; ?>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Danger zone</h2></div>
      <div class="card-body">
        <p class="muted small">
          Deleting a server stops it, removes the server directory with every world file and deletes all of
          its backups. This cannot be undone.
        </p>
        <?php if ($canManage): ?>
          <button class="btn danger" type="button" data-delete-server="<?= btp_e($server['id']) ?>" data-server-name="<?= btp_e($server['name']) ?>">
            <?= btp_icon('trash', 15) ?> Delete server
          </button>
        <?php endif; ?>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="card-head"><h2>server.properties</h2><div class="spacer"></div><span class="faint small">Panel-managed values are re-applied on start</span></div>
    <div class="card-body">
      <dl class="kv">
        <dt>server-port</dt><dd><?= (int) $server['port'] ?></dd>
        <dt>enable-rcon</dt><dd>true</dd>
        <dt>rcon.port</dt><dd><?= (int) $server['rcon_port'] ?></dd>
        <dt>motd</dt><dd><?= btp_e($server['name']) ?></dd>
      </dl>
      <button class="ghost-btn sm" type="button" data-tab-jump="files" style="margin-top:14px"><?= btp_icon('folder', 14) ?> Edit server.properties</button>
    </div>
  </div>
</section>

<?php require __DIR__ . '/partials/foot.php'; ?>
