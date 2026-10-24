<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/bootstrap.php';
require_once dirname(__DIR__) . '/src/actions.php';
require_once dirname(__DIR__) . '/src/views.php';
require_once dirname(__DIR__) . '/src/admin-views.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        handle_web_action($store);
    } catch (Throwable $error) {
        flash('error', $error->getMessage());
        redirect(post_return_query());
    }
}

$data = $store->read();
$user = current_user($data);
$flash = consume_flash();

if (!$user) {
    unset($_SESSION['user_id']);
    render_login($data['settings'], $flash);
    exit;
}

$section = (string) ($_GET['section'] ?? 'home');
if (!in_array($section, ['home', 'servers', 'account', 'admin'], true)) {
    $section = 'home';
}
if ($section === 'admin' && !is_admin($user)) {
    $section = 'home';
}
$tab = (string) ($_GET['tab'] ?? 'overview');
if (!array_key_exists($tab, admin_tabs())) {
    $tab = 'overview';
}
$newKey = $_SESSION['new_api_key'] ?? null;
unset($_SESSION['new_api_key']);

render_app($data, $user, $section, $tab, $flash, is_array($newKey) ? $newKey : null);
