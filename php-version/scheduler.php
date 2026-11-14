<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function publish_due_articles(): array
{
    $pdo = database();
    $pdo->beginTransaction();
    try {
        $query = $pdo->query("SELECT id FROM content_articles WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW() FOR UPDATE");
        $ids = array_map(static fn(array $row): int => (int)$row['id'], $query->fetchAll());
        if ($ids) {
            $placeholders = implode(',', array_fill(0, count($ids), '?'));
            $update = $pdo->prepare("UPDATE content_articles SET status = 'published', is_published = 1, published_at = COALESCE(scheduled_at, NOW()) WHERE id IN ($placeholders) AND status = 'scheduled'");
            $update->execute($ids);
        }
        $sessions = $pdo->exec('DELETE FROM sessions WHERE expires_at < NOW()');
        $pdo->commit();
        return ['success' => true, 'publishedCount' => count($ids), 'publishedIds' => $ids, 'expiredSessions' => (int)$sessions];
    } catch (Throwable $error) { $pdo->rollBack(); throw $error; }
}
