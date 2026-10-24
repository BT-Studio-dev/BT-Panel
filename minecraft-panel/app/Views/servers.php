<?php
/**
 * @var list<array{server:array<string,mixed>,status:array<string,mixed>}> $rows
 * @var list<string> $types
 * @var int $defaultMemory
 */
$crumbs = btp_e($panelName) . ' / Servers';
require __DIR__ . '/partials/head.php';
?>

<section class="card">
  <div class="card-head">
    <h2>All servers</h2>
    <div class="spacer"></div>
    <span class="badge"><?= count($rows) ?> total</span>
    <button class="btn sm" type="button" data-open-modal="create-server"><?= btp_icon('plus', 15) ?> New server</button>
  </div>
  <div class="card-body <?= $rows === [] ? '' : 'tight' ?>">
    <?php if ($rows === []): ?>
      <div class="empty">
        <?= btp_icon('server', 34) ?>
        <h3>No servers yet</h3>
        <p class="muted">Spin up a Vanilla, Paper or Purpur world. The panel installs the jar and writes server.properties for you.</p>
        <button class="btn" type="button" data-open-modal="create-server"><?= btp_icon('plus', 16) ?> Create your first server</button>
      </div>
    <?php else: ?>
      <table class="data">
        <thead>
          <tr>
            <th>Server</th>
            <th>Software</th>
            <th>Port</th>
            <th>State</th>
            <th>Memory</th>
            <th>Owner</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
        <?php foreach ($rows as $row): ?>
          <?php $server = $row['server']; $status = $row['status']; $isRunning = $status['state'] === 'running'; ?>
          <tr data-server-row data-server-id="<?= btp_e($server['id']) ?>">
            <td>
              <a href="<?= btp_e(btp_url('servers/' . $server['id'])) ?>" style="font-weight:700"><?= btp_e($server['name']) ?></a>
              <div class="faint small"><?= btp_e($server['directory']) ?></div>
            </td>
            <td><span class="badge"><?= btp_e($server['type']) ?></span> <span class="faint small"><?= btp_e($server['version']) ?></span></td>
            <td class="mono"><?= (int) $server['port'] ?></td>
            <td>
              <span class="badge <?= $isRunning ? 'ok' : 'off' ?>" data-status-badge>
                <span class="dot <?= $isRunning ? 'on' : 'off' ?>"></span><?= $isRunning ? 'Running' : 'Stopped' ?>
              </span>
            </td>
            <td class="mono"><?= (int) $server['memory_mb'] ?> MB</td>
            <td class="faint small"><?= btp_e($server['owner_email'] ?? '—') ?></td>
            <td>
              <div class="actions">
                <?php if ($isRunning): ?>
                  <button class="ghost-btn sm" type="button" data-power="stop" data-server="<?= btp_e($server['id']) ?>"><?= btp_icon('stop', 13) ?> Stop</button>
                <?php else: ?>
                  <button class="ghost-btn sm" type="button" data-power="start" data-server="<?= btp_e($server['id']) ?>"><?= btp_icon('play', 13) ?> Start</button>
                <?php endif; ?>
                <a class="ghost-btn sm" href="<?= btp_e(btp_url('servers/' . $server['id'])) ?>">Open</a>
              </div>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </div>
</section>

<template id="create-server-form-template">
  <form data-create-server novalidate>
    <div class="form-error" data-form-error role="alert"></div>

    <div class="field">
      <label for="new-name">Server name</label>
      <input id="new-name" name="name" type="text" maxlength="64" required placeholder="Survival SMP">
      <span class="hint">Used for the folder name and the MOTD.</span>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="new-type">Software</label>
        <select id="new-type" name="type">
          <?php foreach ($types as $type): ?>
            <option value="<?= btp_e($type) ?>"><?= btp_e(ucfirst($type)) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label for="new-version">Minecraft version</label>
        <input id="new-version" name="version" type="text" value="latest" placeholder="latest / 1.21.4">
        <span class="hint">“latest” resolves when you install.</span>
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="new-memory">Heap (MB)</label>
        <input id="new-memory" name="memory_mb" type="number" min="512" max="65536" step="256" value="<?= (int) $defaultMemory ?>">
      </div>
      <div class="field">
        <label for="new-port">Port</label>
        <input id="new-port" name="port" type="number" min="1024" max="65535" value="25565">
        <span class="hint">The next free port is used if this one is busy.</span>
      </div>
    </div>

    <div class="field">
      <label for="new-flags">Extra JVM flags <span class="faint">(optional)</span></label>
      <input id="new-flags" name="java_flags" type="text" placeholder="-XX:+UseG1GC -XX:MaxGCPauseMillis=200" maxlength="400">
    </div>

    <div class="check">
      <input type="checkbox" id="new-eula" name="accept_eula" required>
      <label for="new-eula">
        I accept the <a href="https://www.minecraft.net/en-us/eula" target="_blank" rel="noopener noreferrer">Minecraft EULA</a> and understand
        servers run as the panel's system user.
      </label>
    </div>
  </form>
</template>

<?php require __DIR__ . '/partials/foot.php'; ?>
