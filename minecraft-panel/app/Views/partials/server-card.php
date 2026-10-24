<?php
/**
 * Server summary card, shared by the dashboard and the server list.
 *
 * @var array<string,mixed> $server
 * @var array<string,mixed> $status
 */
$isRunning = ($status['state'] ?? 'stopped') === 'running';
$memoryUsed = (int) ($status['memory_bytes'] ?? 0);
$memoryLimit = max(1, (int) $server['memory_mb']) * 1024 * 1024;
$memoryPercent = $memoryUsed > 0 ? min(100, (int) round($memoryUsed / $memoryLimit * 100)) : 0;
?>
<article class="server-card" data-server-card data-server-id="<?= btp_e($server['id']) ?>" data-memory-limit="<?= (int) $server['memory_mb'] ?> MB">
  <header>
    <span class="server-icon"><?= btp_icon('server', 20) ?></span>
    <div style="min-width:0;flex:1">
      <h3><a href="<?= btp_e(btp_url('servers/' . $server['id'])) ?>"><?= btp_e($server['name']) ?></a></h3>
      <div class="sub"><?= btp_e(ucfirst((string) $server['type'])) ?> <?= btp_e((string) $server['version']) ?> · <?= btp_e($server['directory']) ?></div>
    </div>
    <span class="badge <?= $isRunning ? 'ok' : 'off' ?>" data-status-badge>
      <span class="dot <?= $isRunning ? 'on' : 'off' ?>"></span>
      <?= $isRunning ? 'Running' : 'Stopped' ?>
    </span>
  </header>

  <div class="server-meta">
    <div><span>Address</span><strong><?= btp_e(($_SERVER['SERVER_NAME'] ?? 'localhost')) ?>:<?= (int) $server['port'] ?></strong></div>
    <div><span>Memory</span><strong data-memory><?= btp_bytes($memoryUsed) ?> / <?= (int) $server['memory_mb'] ?> MB</strong></div>
    <div><span>Uptime</span><strong data-uptime><?= $isRunning ? btp_duration((int) $status['uptime']) : '—' ?></strong></div>
  </div>

  <div class="meter <?= $memoryPercent > 85 ? '' : 'green' ?>" aria-hidden="true"><i style="width: <?= $memoryPercent ?>%"></i></div>

  <div class="btn-row">
    <?php if ($isRunning): ?>
      <button class="ghost-btn sm" type="button" data-power="restart" data-server="<?= btp_e($server['id']) ?>"><?= btp_icon('restart', 14) ?> Restart</button>
      <button class="ghost-btn sm" type="button" data-power="stop" data-server="<?= btp_e($server['id']) ?>"><?= btp_icon('stop', 14) ?> Stop</button>
    <?php else: ?>
      <button class="btn sm" type="button" data-power="start" data-server="<?= btp_e($server['id']) ?>"><?= btp_icon('play', 14) ?> Start</button>
    <?php endif; ?>
    <a class="ghost-btn sm" href="<?= btp_e(btp_url('servers/' . $server['id'] . '#console')) ?>"><?= btp_icon('terminal', 14) ?> Console</a>
    <a class="ghost-btn sm" href="<?= btp_e(btp_url('servers/' . $server['id'])) ?>" style="margin-left:auto">Manage <?= btp_icon('chevron', 14) ?></a>
  </div>
</article>
