<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function notifications_for_user(int $userId): array
{
    $query = database()->prepare(
        "SELECT n.id, n.type, n.title, n.message, n.link, n.is_read, n.created_at,
                n.actor_id, COALESCE(p.display_name, u.username) AS actor_name,
                COALESCE(p.avatar, '/profile.png') AS actor_avatar
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE n.user_id = :user_id ORDER BY n.created_at DESC LIMIT 100"
    );
    $query->execute(['user_id' => $userId]);
    $notifications = array_map(static fn(array $row): array => [
        'id' => (int)$row['id'], 'type' => $row['type'], 'title' => $row['title'],
        'message' => $row['message'], 'link' => $row['link'], 'isRead' => (bool)$row['is_read'],
        'unread' => !(bool)$row['is_read'], 'createdAt' => $row['created_at'],
        'actorId' => $row['actor_id'] ? (int)$row['actor_id'] : null,
        'actorName' => $row['actor_name'], 'actorAvatar' => $row['actor_avatar'] ?: '/profile.png',
    ], $query->fetchAll());
    return $notifications;
}

function unread_notifications_count(int $userId): int
{
    $query = database()->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = :user_id AND is_read = 0');
    $query->execute(['user_id' => $userId]);
    return (int)$query->fetchColumn();
}

function notification_preferences(int $userId): array
{
    $query = database()->prepare('SELECT * FROM notification_preferences WHERE user_id = :user_id LIMIT 1');
    $query->execute(['user_id' => $userId]);
    $row = $query->fetch() ?: [];
    return [
        'userId' => $userId,
        'notifyComments' => (bool)($row['notify_comments'] ?? true),
        'notifyReplies' => (bool)($row['notify_replies'] ?? true),
        'notifyReactions' => (bool)($row['notify_reactions'] ?? true),
        'notifyForum' => (bool)($row['notify_forum'] ?? true),
        'notifyChapters' => (bool)($row['notify_chapters'] ?? true),
        'notifySystem' => (bool)($row['notify_system'] ?? true),
        'browserEnabled' => (bool)($row['browser_enabled'] ?? false),
    ];
}

function update_notification_preferences(int $userId, array $input): array
{
    $query = database()->prepare(
        "INSERT INTO notification_preferences
         (user_id, notify_comments, notify_replies, notify_reactions, notify_forum, notify_chapters, notify_system, browser_enabled)
         VALUES (:user_id, :comments, :replies, :reactions, :forum, :chapters, :system, :browser)
         ON DUPLICATE KEY UPDATE notify_comments = VALUES(notify_comments), notify_replies = VALUES(notify_replies),
         notify_reactions = VALUES(notify_reactions), notify_forum = VALUES(notify_forum),
         notify_chapters = VALUES(notify_chapters), notify_system = VALUES(notify_system), browser_enabled = VALUES(browser_enabled)"
    );
    $query->execute([
        'user_id' => $userId,
        'comments' => !empty($input['notifyComments']) ? 1 : 0,
        'replies' => !empty($input['notifyReplies']) ? 1 : 0,
        'reactions' => !empty($input['notifyReactions']) ? 1 : 0,
        'forum' => !empty($input['notifyForum']) ? 1 : 0,
        'chapters' => !empty($input['notifyChapters']) ? 1 : 0,
        'system' => !empty($input['notifySystem']) ? 1 : 0,
        'browser' => !empty($input['browserEnabled']) ? 1 : 0,
    ]);
    return notification_preferences($userId);
}
