<?php
/**
 * Marketing panel shown next to the sign-in/register forms.
 *
 * @var string $panelName
 * @var string|null $asideTitle
 * @var string|null $asideText
 */
?>
<aside class="auth-aside">
  <div class="brand" style="padding:0">
    <span class="brand-mark"><?= btp_brand_mark(22) ?></span>
    <span class="brand-text"><strong><?= btp_e($panelName) ?></strong><span>BT Panel module</span></span>
  </div>
  <div class="pitch">
    <h2><?= btp_e($asideTitle ?? 'Your Minecraft servers, one clean console.') ?></h2>
    <p><?= btp_e($asideText ?? 'Start, stop and watch every world from the panel you already run. Built on plain PHP so it drops straight into a BT Panel site.') ?></p>
    <div class="auth-features">
      <div><?= btp_icon('check') ?> Live console over RCON with command history</div>
      <div><?= btp_icon('check') ?> One-click Vanilla, Paper and Purpur installs</div>
      <div><?= btp_icon('check') ?> File manager, backups and audit log</div>
      <div><?= btp_icon('check') ?> Per-server access for your moderators</div>
    </div>
  </div>
  <div class="faint small">PHP <?= btp_e(PHP_VERSION) ?> · SQLite · <?= btp_e(gethostname() ?: 'localhost') ?></div>
</aside>
