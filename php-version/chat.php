<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function chat_conversations(int $userId): array
{
    $query = database()->prepare(
        "SELECT c.id, c.last_message_at, cp.unread_count,
                other.id AS other_id, other.username AS other_username,
                COALESCE(op.display_name, other.username) AS other_name,
                COALESCE(op.avatar, '/profile.png') AS other_avatar,
                (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message
         FROM conversation_participants cp
         INNER JOIN conversations c ON c.id = cp.conversation_id
         INNER JOIN conversation_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id <> cp.user_id
         INNER JOIN users other ON other.id = other_cp.user_id
         LEFT JOIN profiles op ON op.user_id = other.id
         WHERE cp.user_id = :user_id ORDER BY c.last_message_at DESC"
    );
    $query->execute(['user_id' => $userId]);
    return ['success' => true, 'conversations' => array_map(static fn(array $row): array => [
        'id' => (int)$row['id'], 'conversationId' => (int)$row['id'],
        'otherUserId' => (int)$row['other_id'], 'otherUsername' => $row['other_username'],
        'otherName' => $row['other_name'], 'otherAvatar' => $row['other_avatar'] ?: '/profile.png',
        'lastMessage' => $row['last_message'] ?? '', 'unreadCount' => (int)$row['unread_count'],
        'lastMessageAt' => $row['last_message_at'],
    ], $query->fetchAll())];
}

function chat_messages(int $conversationId, int $userId): array
{
    $access = database()->prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = :conversation AND user_id = :user LIMIT 1');
    $access->execute(['conversation' => $conversationId, 'user' => $userId]);
    if (!$access->fetch()) return ['success' => false, 'error' => 'Conversation not found.'];
    $query = database()->prepare(
        "SELECT m.id, m.conversation_id, m.sender_id, m.content, m.is_read, m.read_at, m.created_at,
                u.username, COALESCE(p.display_name, u.username) AS sender_name, COALESCE(p.avatar, '/profile.png') AS sender_avatar
         FROM messages m INNER JOIN users u ON u.id = m.sender_id LEFT JOIN profiles p ON p.user_id = u.id
         WHERE m.conversation_id = :conversation ORDER BY m.id ASC LIMIT 500"
    );
    $query->execute(['conversation' => $conversationId]);
    database()->prepare('UPDATE conversation_participants SET unread_count = 0, last_read_at = NOW() WHERE conversation_id = :conversation AND user_id = :user')
        ->execute(['conversation' => $conversationId, 'user' => $userId]);
    return ['success' => true, 'messages' => array_map(static fn(array $row): array => [
        'id' => (int)$row['id'], 'conversationId' => (int)$row['conversation_id'], 'senderId' => (int)$row['sender_id'],
        'content' => $row['content'], 'isRead' => (bool)$row['is_read'], 'createdAt' => $row['created_at'],
        'senderName' => $row['sender_name'], 'senderAvatar' => $row['sender_avatar'] ?: '/profile.png',
        'isMine' => (int)$row['sender_id'] === $userId,
    ], $query->fetchAll())];
}

function send_chat_message(int $userId, array $input): array
{
    $conversationId = (int)($input['conversationId'] ?? $input['conversation_id'] ?? 0);
    $recipientId = (int)($input['recipientId'] ?? $input['targetUserId'] ?? 0);
    $content = trim((string)($input['content'] ?? ''));
    if ($content === '') return ['success' => false, 'error' => 'Message content is required.'];
    $pdo = database();
    if ($conversationId <= 0 && $recipientId > 0) {
        $find = $pdo->prepare(
            'SELECT cp1.conversation_id FROM conversation_participants cp1 INNER JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id WHERE cp1.user_id = :user AND cp2.user_id = :recipient LIMIT 1'
        );
        $find->execute(['user' => $userId, 'recipient' => $recipientId]);
        $conversationId = (int)($find->fetchColumn() ?: 0);
        if (!$conversationId) {
            $pdo->beginTransaction();
            $pdo->prepare('INSERT INTO conversations () VALUES ()')->execute();
            $conversationId = (int)$pdo->lastInsertId();
            $participant = $pdo->prepare('INSERT INTO conversation_participants (conversation_id, user_id) VALUES (:conversation, :user)');
            $participant->execute(['conversation' => $conversationId, 'user' => $userId]);
            $participant->execute(['conversation' => $conversationId, 'user' => $recipientId]);
            $pdo->commit();
        }
    }
    $access = $pdo->prepare('SELECT 1 FROM conversation_participants WHERE conversation_id = :conversation AND user_id = :user LIMIT 1');
    $access->execute(['conversation' => $conversationId, 'user' => $userId]);
    if (!$access->fetch()) return ['success' => false, 'error' => 'Conversation not found.'];
    $insert = $pdo->prepare('INSERT INTO messages (conversation_id, sender_id, content) VALUES (:conversation, :sender, :content)');
    $insert->execute(['conversation' => $conversationId, 'sender' => $userId, 'content' => $content]);
    $pdo->prepare('UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = :id')->execute(['id' => $conversationId]);
    $pdo->prepare('UPDATE conversation_participants SET unread_count = unread_count + 1 WHERE conversation_id = :conversation AND user_id <> :user')->execute(['conversation' => $conversationId, 'user' => $userId]);
    return ['success' => true, 'messageId' => (int)$pdo->lastInsertId(), 'conversationId' => $conversationId];
}
