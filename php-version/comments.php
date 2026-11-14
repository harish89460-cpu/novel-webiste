<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function list_comments(string $novelId, string $chapterNum = '0', ?int $userId = null): array
{
    $isNovel = $chapterNum === '' || $chapterNum === '0' || strtolower($chapterNum) === 'novel' || strtolower($chapterNum) === 'all';
    $sql = "SELECT c.id, c.novel_id, c.chapter_num, c.user_id, c.parent_id, c.content,
                   c.created_at, c.updated_at, u.username, u.role,
                   COALESCE(p.display_name, u.username) AS display_name,
                   COALESCE(p.avatar, '/profile.png') AS avatar,
                   (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'comment' AND l.target_id = CAST(c.id AS CHAR)) AS likes_count
            FROM comments c
            INNER JOIN users u ON u.id = c.user_id
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE (c.novel_id = :novel_id OR c.novel_id = :novel_alt)
              AND " . ($isNovel ? "(c.chapter_num = '0' OR c.chapter_num IS NULL)" : "CAST(c.chapter_num AS CHAR) = :chapter_num") . "
            ORDER BY c.created_at ASC, c.id ASC";
    $params = ['novel_id' => $novelId, 'novel_alt' => rawurldecode($novelId)];
    if (!$isNovel) $params['chapter_num'] = $chapterNum;
    $query = database()->prepare($sql);
    $query->execute($params);
    $rows = $query->fetchAll();
    $comments = [];
    foreach ($rows as $row) {
        $comments[(string)$row['id']] = [
            'id' => (int)$row['id'],
            'novelId' => $row['novel_id'],
            'chapterNum' => $row['chapter_num'],
            'userId' => (int)$row['user_id'],
            'parentId' => $row['parent_id'] ? (int)$row['parent_id'] : null,
            'username' => $row['username'],
            'displayName' => $row['display_name'] ?: $row['username'],
            'avatar' => $row['avatar'] ?: '/profile.png',
            'role' => $row['role'] ?: 'Member',
            'content' => $row['content'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
            'likesCount' => (int)$row['likes_count'],
            'hasLiked' => false,
            'replies' => [],
        ];
    }
    foreach ($comments as $id => &$comment) {
        if ($comment['parentId'] && isset($comments[(string)$comment['parentId']])) {
            $comments[(string)$comment['parentId']]['replies'][] = &$comment;
        }
    }
    unset($comment);
    return array_values(array_filter($comments, static fn(array $comment): bool => !$comment['parentId']));
}

function add_comment(array $input, ?array $user): array
{
    if (!$user) return ['success' => false, 'error' => 'Please log in to post a comment.', 'requireLogin' => true];
    $novelId = trim((string)($input['novelId'] ?? ''));
    $chapterNum = trim((string)($input['chapterNum'] ?? '0')) ?: '0';
    $content = trim((string)($input['content'] ?? ''));
    $parentId = !empty($input['parentId']) ? (int)$input['parentId'] : null;
    if ($novelId === '' || $content === '') return ['success' => false, 'error' => 'Novel and comment content are required.'];

    $pdo = database();
    $query = $pdo->prepare('INSERT INTO comments (novel_id, chapter_num, user_id, parent_id, content) VALUES (:novel_id, :chapter_num, :user_id, :parent_id, :content)');
    $query->execute([
        'novel_id' => $novelId,
        'chapter_num' => $chapterNum,
        'user_id' => $user['id'],
        'parent_id' => $parentId,
        'content' => $content,
    ]);
    return ['success' => true, 'commentId' => (int)$pdo->lastInsertId()];
}

function get_reactions(string $targetType, string $targetId, ?int $userId = null): array
{
    $query = database()->prepare('SELECT emoji, COUNT(*) AS count FROM reactions WHERE target_type = :type AND target_id = :target GROUP BY emoji ORDER BY count DESC');
    $query->execute(['type' => $targetType, 'target' => $targetId]);
    $reactions = [];
    foreach ($query->fetchAll() as $row) $reactions[$row['emoji']] = (int)$row['count'];
    $userEmoji = null;
    if ($userId) {
        $userQuery = database()->prepare('SELECT emoji FROM reactions WHERE target_type = :type AND target_id = :target AND user_id = :user LIMIT 1');
        $userQuery->execute(['type' => $targetType, 'target' => $targetId, 'user' => $userId]);
        $userEmoji = $userQuery->fetchColumn() ?: null;
    }
    return ['success' => true, 'reactions' => $reactions, 'userReaction' => $userEmoji];
}

function toggle_reaction(string $targetType, string $targetId, string $emoji, ?array $user): array
{
    if (!$user) return ['success' => false, 'error' => 'Please log in to react.', 'requireLogin' => true];
    $allowed = ['❤️', '👍', '👏', '😂', '😮', '😍', '😢', '😭'];
    if (!in_array($emoji, $allowed, true)) return ['success' => false, 'error' => 'Unsupported reaction.'];
    $pdo = database();
    $find = $pdo->prepare('SELECT id, emoji FROM reactions WHERE target_type = :type AND target_id = :target AND user_id = :user LIMIT 1');
    $find->execute(['type' => $targetType, 'target' => $targetId, 'user' => $user['id']]);
    $existing = $find->fetch();
    if ($existing && $existing['emoji'] === $emoji) {
        $pdo->prepare('DELETE FROM reactions WHERE id = :id')->execute(['id' => $existing['id']]);
        return get_reactions($targetType, $targetId, (int)$user['id']);
    }
    if ($existing) {
        $pdo->prepare('UPDATE reactions SET emoji = :emoji WHERE id = :id')->execute(['emoji' => $emoji, 'id' => $existing['id']]);
    } else {
        $pdo->prepare('INSERT INTO reactions (target_type, target_id, user_id, emoji) VALUES (:type, :target, :user, :emoji)')->execute(['type' => $targetType, 'target' => $targetId, 'user' => $user['id'], 'emoji' => $emoji]);
    }
    return get_reactions($targetType, $targetId, (int)$user['id']);
}
