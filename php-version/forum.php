<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function forum_categories(): array
{
    $rows = database()->query(
        "SELECT id, title, description, icon, color, sort_order, is_active, is_disabled, status
         FROM forum_categories
         WHERE (is_active = 1 OR is_active IS NULL) AND (is_disabled = 0 OR is_disabled IS NULL)
         ORDER BY sort_order ASC, title ASC"
    )->fetchAll();
    return ['success' => true, 'categories' => $rows];
}

function forum_topics(?string $category = null): array
{
    $sql = "SELECT t.id, t.title, t.content, t.image, t.is_pinned, t.sort_order,
                   t.category_id, t.category_title, t.novel_id, t.chapter_num,
                   t.views_count, t.replies_count, t.created_at, t.updated_at,
                   t.last_reply_at, u.username, u.role,
                   COALESCE(p.display_name, u.username, 'Member') AS author_name,
                   COALESCE(p.avatar, '/profile.png') AS author_avatar
            FROM forum_topics t
            LEFT JOIN users u ON u.id = t.author_id
            LEFT JOIN profiles p ON p.user_id = u.id
            WHERE t.is_published = 1 AND t.visibility = 'public'";
    $params = [];
    if ($category !== null && $category !== '') {
        $sql .= ' AND t.category_id = :category';
        $params['category'] = $category;
    }
    $sql .= ' ORDER BY t.is_pinned DESC, t.sort_order ASC, COALESCE(t.last_reply_at, t.updated_at, t.created_at) DESC';
    $query = database()->prepare($sql);
    $query->execute($params);

    $topics = array_map(static function (array $row): array {
        $plain = trim(strip_tags((string)($row['content'] ?? '')));
        return [
            'id' => $row['id'],
            'categoryId' => $row['category_id'],
            'categoryTitle' => $row['category_title'],
            'title' => $row['title'],
            'link' => '#topic?id=' . rawurlencode((string)$row['id']),
            'content' => $row['content'] ?? '',
            'image' => $row['image'],
            'isPinned' => (bool)$row['is_pinned'],
            'sortOrder' => (int)$row['sort_order'],
            'isPublished' => true,
            'visibility' => $row['visibility'] ?? 'public',
            'author' => $row['author_name'] ?: 'Member',
            'authorAvatar' => $row['author_avatar'] ?: '/profile.png',
            'authorRole' => $row['role'] ?: 'Member',
            'lastReplyAt' => $row['last_reply_at'] ?: $row['updated_at'] ?: $row['created_at'],
            'date' => $row['created_at'],
            'excerpt' => strlen($plain) > 140 ? substr($plain, 0, 140) . '...' : $plain,
            'views' => (int)$row['views_count'],
            'repliesCount' => (int)$row['replies_count'],
        ];
    }, $query->fetchAll());
    return ['success' => true, 'topics' => $topics];
}

function forum_topic(string $topicId, ?int $userId = null): array
{
    $pdo = database();
    $topicQuery = $pdo->prepare(
        "SELECT t.*, COALESCE(p.display_name, u.username, 'Member') AS author,
                COALESCE(p.avatar, '/profile.png') AS author_avatar, u.role
         FROM forum_topics t
         LEFT JOIN users u ON u.id = t.author_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE t.id = :id AND t.is_published = 1 AND t.visibility = 'public' LIMIT 1"
    );
    $topicQuery->execute(['id' => $topicId]);
    $topic = $topicQuery->fetch();
    if (!$topic) {
        return ['success' => false, 'error' => 'Topic not found.'];
    }

    $pdo->prepare('UPDATE forum_topics SET views_count = views_count + 1 WHERE id = :id')->execute(['id' => $topicId]);
    $postQuery = $pdo->prepare(
        "SELECT fp.id, fp.parent_id, fp.content, fp.created_at, fp.updated_at,
                fp.user_id, u.username, u.role,
                COALESCE(p.display_name, u.username, 'Member') AS author,
                COALESCE(p.avatar, '/profile.png') AS avatar
         FROM forum_posts fp
         LEFT JOIN users u ON u.id = fp.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE fp.topic_id = :topic_id ORDER BY fp.id ASC"
    );
    $postQuery->execute(['topic_id' => $topicId]);
    $posts = array_map(static fn(array $post): array => [
        'id' => (int)$post['id'],
        'parentId' => $post['parent_id'] ? (int)$post['parent_id'] : null,
        'content' => $post['content'],
        'createdAt' => $post['created_at'],
        'updatedAt' => $post['updated_at'],
        'userId' => (int)$post['user_id'],
        'author' => $post['author'] ?: 'Member',
        'avatar' => $post['avatar'] ?: '/profile.png',
        'role' => $post['role'] ?: 'Member',
    ], $postQuery->fetchAll());

    return [
        'success' => true,
        'topic' => [
            'id' => $topic['id'],
            'title' => $topic['title'],
            'content' => $topic['content'] ?? '',
            'categoryId' => $topic['category_id'],
            'categoryTitle' => $topic['category_title'],
            'author' => $topic['author'] ?: 'Member',
            'authorAvatar' => $topic['author_avatar'] ?: '/profile.png',
            'authorRole' => $topic['role'] ?: 'Member',
            'views' => (int)$topic['views_count'] + 1,
            'repliesCount' => (int)$topic['replies_count'],
            'createdAt' => $topic['created_at'],
            'posts' => $posts,
        ],
    ];
}

function create_forum_topic(array $input, ?array $user): array
{
    if (!$user) return ['success' => false, 'error' => 'Authentication required.'];
    $title = trim((string)($input['title'] ?? ''));
    $content = trim((string)($input['content'] ?? ''));
    $categoryId = trim((string)($input['categoryId'] ?? $input['category_id'] ?? ''));
    if ($title === '' || $content === '' || $categoryId === '') {
        return ['success' => false, 'error' => 'Category, title, and content are required.'];
    }

    $pdo = database();
    $category = $pdo->prepare('SELECT id, title FROM forum_categories WHERE id = :id LIMIT 1');
    $category->execute(['id' => $categoryId]);
    $categoryRow = $category->fetch();
    if (!$categoryRow) return ['success' => false, 'error' => 'Category not found.'];

    $topicId = 'topic_' . bin2hex(random_bytes(12));
    $insert = $pdo->prepare(
        "INSERT INTO forum_topics (id, category_id, category_title, title, author_id, content, is_published, visibility, replies_count)
         VALUES (:id, :category_id, :category_title, :title, :author_id, :content, 1, 'public', 0)"
    );
    $insert->execute([
        'id' => $topicId,
        'category_id' => $categoryId,
        'category_title' => $categoryRow['title'],
        'title' => $title,
        'author_id' => $user['id'],
        'content' => $content,
    ]);
    return ['success' => true, 'topicId' => $topicId, 'message' => 'Topic created successfully.'];
}

function add_forum_reply(string $topicId, array $input, ?array $user): array
{
    if (!$user) return ['success' => false, 'error' => 'Authentication required.'];
    $content = trim((string)($input['content'] ?? ''));
    if ($content === '') return ['success' => false, 'error' => 'Reply content is required.'];

    $pdo = database();
    $pdo->beginTransaction();
    try {
        $topic = $pdo->prepare('SELECT id FROM forum_topics WHERE id = :id AND is_published = 1 LIMIT 1');
        $topic->execute(['id' => $topicId]);
        if (!$topic->fetch()) {
            $pdo->rollBack();
            return ['success' => false, 'error' => 'Topic not found.'];
        }
        $post = $pdo->prepare('INSERT INTO forum_posts (topic_id, user_id, content) VALUES (:topic_id, :user_id, :content)');
        $post->execute(['topic_id' => $topicId, 'user_id' => $user['id'], 'content' => $content]);
        $pdo->prepare("UPDATE forum_topics SET replies_count = replies_count + 1, last_reply_author_id = :user_id, last_reply_at = NOW(), updated_at = NOW() WHERE id = :id")
            ->execute(['user_id' => $user['id'], 'id' => $topicId]);
        $pdo->commit();
        return ['success' => true, 'replyId' => (int)$pdo->lastInsertId()];
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }
}

function toggle_forum_like(string $targetType, string $targetId, ?array $user): array
{
    if (!$user) return ['success' => false, 'error' => 'Authentication required.'];
    $pdo = database();
    $find = $pdo->prepare('SELECT id FROM likes WHERE target_type = :type AND target_id = :target AND user_id = :user LIMIT 1');
    $find->execute(['type' => $targetType, 'target' => $targetId, 'user' => $user['id']]);
    $existing = $find->fetch();
    if ($existing) {
        $pdo->prepare('DELETE FROM likes WHERE id = :id')->execute(['id' => $existing['id']]);
        $liked = false;
    } else {
        $pdo->prepare('INSERT INTO likes (target_type, target_id, user_id) VALUES (:type, :target, :user)')
            ->execute(['type' => $targetType, 'target' => $targetId, 'user' => $user['id']]);
        $liked = true;
    }
    $count = $pdo->prepare('SELECT COUNT(*) FROM likes WHERE target_type = :type AND target_id = :target');
    $count->execute(['type' => $targetType, 'target' => $targetId]);
    return ['success' => true, 'liked' => $liked, 'userLiked' => $liked, 'likesCount' => (int)$count->fetchColumn()];
}
