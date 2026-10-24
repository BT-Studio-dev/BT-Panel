<?php
/**
 * @var list<array<string,mixed>> $rows
 * @var int $me
 */
$crumbs = btp_e($panelName) . ' / Users';
require __DIR__ . '/partials/head.php';
?>

<section class="card">
  <div class="card-head">
    <h2>Panel accounts</h2>
    <div class="spacer"></div>
    <span class="badge"><?= count($rows) ?> users</span>
    <button class="btn sm" type="button" data-open-modal="create-user"><?= btp_icon('plus', 15) ?> Add user</button>
  </div>
  <div class="card-body tight">
    <table class="data">
      <thead>
        <tr><th>User</th><th>Role</th><th>Servers</th><th>Last sign-in</th><th></th></tr>
      </thead>
      <tbody>
      <?php foreach ($rows as $row): ?>
        <tr data-user-row data-user-id="<?= (int) $row['id'] ?>">
          <td>
            <div style="font-weight:700"><?= btp_e($row['name'] ?: $row['email']) ?><?= (int) $row['id'] === $me ? ' <span class="faint small">(you)</span>' : '' ?></div>
            <div class="faint small">
              <?= btp_e($row['email']) ?>
              <?php if (!empty($row['google_id'])): ?>
                <span class="badge" style="margin-left:6px;padding:0 6px;font-size:10px">Google</span>
              <?php endif; ?>
            </div>
          </td>
          <td>
            <span class="badge <?= $row['role'] === 'admin' ? 'accent' : '' ?>"><?= btp_e($row['role']) ?></span>
          </td>
          <td class="mono small"><?= (int) $row['server_count'] ?></td>
          <td class="faint small"><?= btp_e(btp_ago($row['last_login_at'])) ?></td>
          <td>
            <div class="actions">
              <button class="ghost-btn sm" type="button" data-user-password="<?= (int) $row['id'] ?>" data-user-email="<?= btp_e($row['email']) ?>"><?= btp_icon('key', 13) ?> Password</button>
              <?php if ((int) $row['id'] !== $me): ?>
                <?php if ($row['role'] === 'admin'): ?>
                  <button class="ghost-btn sm" type="button" data-user-role="<?= (int) $row['id'] ?>" data-role="member">Make member</button>
                <?php else: ?>
                  <button class="ghost-btn sm" type="button" data-user-role="<?= (int) $row['id'] ?>" data-role="admin">Make admin</button>
                <?php endif; ?>
                <button class="ghost-btn sm" type="button" data-user-delete="<?= (int) $row['id'] ?>" data-user-email="<?= btp_e($row['email']) ?>"><?= btp_icon('trash', 13) ?></button>
              <?php endif; ?>
            </div>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>

<section class="card">
  <div class="card-head"><h2>Access model</h2></div>
  <div class="card-body">
    <div class="grid cols-3">
      <div>
        <strong>Administrators</strong>
        <p class="muted small">Full access: every server, users, settings, activity log and the installer.</p>
      </div>
      <div>
        <strong>Members</strong>
        <p class="muted small">See and control only the servers they created. They can start, stop, edit files and take backups of their own servers.</p>
      </div>
      <div>
        <strong>Sessions</strong>
        <p class="muted small">Opaque tokens stored hashed in SQLite. Changing a password revokes every session for that user.</p>
      </div>
    </div>
  </div>
</section>

<template id="create-user-form-template">
  <form data-create-user novalidate>
    <div class="form-error" data-form-error role="alert"></div>
    <div class="field">
      <label for="user-name">Display name</label>
      <input id="user-name" name="name" type="text" maxlength="120" placeholder="Moderator">
    </div>
    <div class="field">
      <label for="user-email">Email</label>
      <input id="user-email" name="email" type="email" required placeholder="mod@example.com" autocomplete="off">
    </div>
    <div class="field-row">
      <div class="field">
        <label for="user-role">Role</label>
        <select id="user-role" name="role">
          <option value="member">Member</option>
          <option value="admin">Administrator</option>
        </select>
      </div>
      <div class="field">
        <label for="user-password">Temporary password</label>
        <input id="user-password" name="password" type="text" minlength="10" required placeholder="At least 10 characters" autocomplete="new-password">
      </div>
    </div>
  </form>
</template>

<?php require __DIR__ . '/partials/foot.php'; ?>
