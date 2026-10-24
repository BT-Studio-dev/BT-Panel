<?php
/**
 * @var list<array<string,mixed>> $rows
 */
$crumbs = btp_e($panelName) . ' / Activity';
require __DIR__ . '/partials/head.php';
?>

<section class="card">
  <div class="card-head">
    <h2>Audit log</h2>
    <div class="spacer"></div>
    <span class="badge"><?= count($rows) ?> entries</span>
  </div>
  <div class="card-body tight">
    <?php if ($rows === []): ?>
      <div class="empty muted">No activity recorded yet.</div>
    <?php else: ?>
      <table class="data">
        <thead><tr><th>When</th><th>Action</th><th>Server</th><th>Detail</th><th>User</th><th>IP</th></tr></thead>
        <tbody>
        <?php foreach ($rows as $row): ?>
          <tr>
            <td class="mono small" style="white-space:nowrap"><?= btp_e(btp_datetime($row['created_at'])) ?></td>
            <td><span class="badge"><?= btp_e($row['action']) ?></span></td>
            <td>
              <?php if (!empty($row['server_id'])): ?>
                <a href="<?= btp_e(btp_url('servers/' . $row['server_id'])) ?>" style="color:var(--info)"><?= btp_e($row['server_name'] ?: $row['server_id']) ?></a>
              <?php else: ?>
                <span class="faint">—</span>
              <?php endif; ?>
            </td>
            <td class="small"><?= btp_e(mb_strimwidth((string) $row['detail'], 0, 120, '…')) ?></td>
            <td class="faint small"><?= btp_e($row['user_email'] ?: 'system') ?></td>
            <td class="mono small faint"><?= btp_e($row['ip']) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </div>
</section>

<?php require __DIR__ . '/partials/foot.php'; ?>
