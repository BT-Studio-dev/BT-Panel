<?php

declare(strict_types=1);

/**
 * BT Minecraft Panel — web entry point.
 *
 * Point the site root here (BT Panel: 网站 → 网站目录 → 运行目录 = /public).
 * All routing lives in Btp\Http\Kernel.
 */

require dirname(__DIR__) . '/bootstrap.php';

Btp\Http\Kernel::run();
