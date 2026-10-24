<?php
/**
 * @var array<string,mixed> $stats
 * @var list<array{server:array<string,mixed>,status:array<string,mixed>}> $rows
 * @var list<array<string,mixed>> $activity
 * @var array<string,mixed> $user
 */
$crumbs = btp_e($panelName) . ' / Dashboard';
require __DIR__ . '/partials/head.php';
?>

<section class="grid cols-4">
  <div class="stat">
    <span class="label"><?= btp_icon('server', 14) ?> Servers</span>
    <span class="value"><?= (int) $stats['servers'] ?></span>
    <span class="hint"><?= (int) $stats['running'] ?> running now</span>
  </div>
  <div class="stat">
    <span class="label"><?= btp_icon('memory', 14) ?> Heap in use</span>
    <span class="value"><?= btp_bytes((int) $stats['memory_bytes']) ?></span>
    <span class="hint">Across running JVMs</span>
  </div>
  <div class="stat">
    <span class="label"><?= btp_icon('disk', 14) ?> Server storage</span>
    <span class="value"><?= btp_bytes((int) $stats['disk_bytes']) ?></span>
    <span class="hint"><?= btp_bytes((int) $stats['free_disk_bytes']) ?> free on disk</span>
  </div>
  <div class="stat">
    <span class="label"><?= btp_icon('archive', 14) ?> Backups</span>
    <span class="value"><?= (int) $stats['backups'] ?></span>
    <span class="hint">Archives on disk</span>
  </div>
</section>

<section class="card">
  <div class="card-head">
    <h2>Your servers</h2>
    <div class="spacer"></div>
    <span class="badge accent"><?= btp_icon('wifi', 13) ?> <?= btp_e((string) $stats['backend']) ?></span>
    <a class="ghost-btn sm" href="<?= btp_e(btp_url('servers')) ?>">All servers <?= btp_icon('chevron', 14) ?></a>
  </div>
  <div class="card-body">
    <?php if ($rows === []): ?>
      <div class="empty">
        <?= btp_icon('server', 34) ?>
        <h3>No servers yet</h3>
        <p class="muted">Create your first Minecraft server — the panel writes the config, generates an RCON password and installs the jar for you.</p>
        <a class="btn" href="<?= btp_e(btp_url('servers')) ?>"><?= btp_icon('plus', 16) ?> Create a server</a>
      </div>
    <?php else: ?>
      <div class="server-grid">
        <?php foreach (array_slice($rows, 0, 6) as $row): ?>
          <?php
          $server = $row['server'];
          $status = $row['status'];
          require __DIR__ . '/partials/server-card.php';
          ?>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<div class="grid cols-2">
  <section class="card">
    <div class="card-head">
      <h2>Recent activity</h2>
      <div class="spacer"></div>
      <?php if (($user['role'] ?? '') === 'admin'): ?>
        <a class="ghost-btn sm" href="<?= btp_e(btp_url('activity')) ?>">Full log</a>
      <?php endif; ?>
    </div>
    <div class="card-body tight">
      <?php if ($activity === []): ?>
        <div class="empty"><p class="muted">Nothing has happened yet.</p></div>
      <?php else: ?>
        <table class="data">
          <tbody>
          <?php foreach ($activity as $entry): ?>
            <tr>
              <td style="width:1%"><span class="badge"><?= btp_e($entry['action']) ?></span></td>
              <td>
                <div><?= btp_e($entry['server_name'] ?: ($entry['detail'] ?: '—')) ?></div>
                <div class="faint small"><?= btp_e($entry['user_email'] ?: 'system') ?> · <?= btp_e(btp_ago($entry['created_at'])) ?></div>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
  </section>

  <section class="card">
    <div class="card-head"><h2>Host &amp; runtime</h2></div>
    <div class="card-body">
      <dl class="kv">
        <dt>Hostname</dt><dd><?= btp_e(gethostname() ?: 'localhost') ?></dd>
        <dt>PHP</dt><dd><?= btp_e(PHP_VERSION) ?></dd>
        <dt>Java</dt><dd><?= btp_e($stats['java'] ?? 'not found') ?></dd>
        <dt>Process backend</dt><dd><?= btp_e((string) $stats['backend']) ?></dd>
        <dt>Free disk</dt><dd data-free-disk><?= btp_bytes((int) $stats['free_disk_bytes']) ?></dd>
        <?php if ($stats['users'] !== null): ?>
          <dt>Panel users</dt><dd><?= (int) $stats['users'] ?></dd>
        <?php endif; ?>
      </dl>
      <div class="btn-row" style="margin-top:16px">
        <a class="ghost-btn sm" href="<?= btp_e(btp_url('settings')) ?>"><?= btp_icon('settings', 14) ?> Panel settings</a>
        <button class="ghost-btn sm" type="button" data-refresh-stats><?= btp_icon('refresh', 14) ?> Refresh</button>
      </div>
    </div>
  </section>
</div>

<?php require __DIR__ . '/partials/foot.php'; ?>
