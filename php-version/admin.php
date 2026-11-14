<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function require_admin_user(?array $user): void
{
    $role = strtolower((string)($user['role'] ?? ''));
    if (!$user || !in_array($role, ['admin', 'administrator', 'editor'], true)) {
        json_response(['success' => false, 'error' => 'Admin authorization required.'], 403);
    }
}

function admin_overview(): array
{
    $pdo = database();
    $queries = [
        'categories' => 'SELECT COUNT(*) FROM forum_categories',
        'subcategories' => 'SELECT COUNT(*) FROM content_subcategories',
        'articles' => 'SELECT COUNT(*) FROM content_articles',
        'published' => "SELECT COUNT(*) FROM content_articles WHERE status = 'published'",
        'users' => 'SELECT COUNT(*) FROM users',
        'writers' => "SELECT COUNT(*) FROM users WHERE LOWER(role) = 'writer'",
        'comments' => 'SELECT COUNT(*) FROM content_comments',
        'topics' => 'SELECT COUNT(*) FROM forum_topics',
        'media' => 'SELECT COUNT(*) FROM media',
    ];
    $counts = [];
    foreach ($queries as $key => $sql) {
        try { $counts[$key] = (int)$pdo->query($sql)->fetchColumn(); } catch (Throwable) { $counts[$key] = 0; }
    }
    return ['success' => true, 'counts' => $counts, 'stats' => ['forms' => [
        'categories' => $counts['categories'], 'subcategories' => $counts['subcategories'],
        'articles' => $counts['articles'], 'published' => $counts['published'],
    ], 'community' => [
        'users' => $counts['users'], 'writers' => $counts['writers'],
        'comments' => $counts['comments'], 'topics' => $counts['topics'], 'media' => $counts['media'],
    ]]];
}

function site_settings(): array
{
    $rows = database()->query('SELECT setting_key, setting_value FROM site_settings ORDER BY setting_key')->fetchAll();
    $settings = [];
    foreach ($rows as $row) $settings[$row['setting_key']] = $row['setting_value'];
    return ['success' => true, 'settings' => $settings];
}

function update_site_settings(array $input): array
{
    $query = database()->prepare(
        'INSERT INTO site_settings (setting_key, setting_value) VALUES (:key, :value) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
    );
    foreach ($input as $key => $value) {
        $cleanKey = trim((string)$key);
        if ($cleanKey !== '') $query->execute(['key' => $cleanKey, 'value' => is_scalar($value) ? (string)$value : json_encode($value)]);
    }
    return site_settings();
}
