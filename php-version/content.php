<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function public_content_hierarchy(?array $user = null): array
{
    $pdo = database();
    $categories = $pdo->query(
        "SELECT id, title, icon, color, sort_order, status, is_active, is_disabled
         FROM forum_categories
         WHERE is_active = 1 AND is_disabled = 0
           AND (status = 'published' OR status IS NULL)
         ORDER BY sort_order ASC, title ASC"
    )->fetchAll();

    $subcategories = $pdo->query(
        "SELECT id, main_category_id, parent_id, title, description, icon, novel_id,
                sort_order, status, is_active, is_disabled
         FROM content_subcategories
         WHERE is_active = 1 AND is_disabled = 0 AND status = 'published'
         ORDER BY sort_order ASC, title ASC"
    )->fetchAll();

    $articles = $pdo->query(
        "SELECT id, unique_slug, main_category_id, sub_category_id, parent_id,
                title, summary, cover_image, author_id, author_name, status,
                is_published, is_disabled, visibility, access_permission,
                views_count, comments_count, sort_order, published_at, scheduled_at,
                created_at, updated_at
         FROM content_articles
         WHERE is_published = 1 AND is_disabled = 0 AND status = 'published'
         ORDER BY sort_order ASC, published_at DESC, id DESC"
    )->fetchAll();

    $isMember = $user !== null;
    $articles = array_values(array_filter($articles, static function (array $article) use ($isMember): bool {
        $visibility = strtolower((string)($article['visibility'] ?? 'public'));
        return $visibility === 'public' || ($isMember && in_array($visibility, ['members', 'all_members'], true));
    }));

    $articleTree = static function (array $items, $parentId = null) use (&$articleTree): array {
        $result = [];
        foreach ($items as $article) {
            $articleParent = $article['parent_id'] === null ? null : (int)$article['parent_id'];
            if ($articleParent !== $parentId) {
                continue;
            }
            $children = $articleTree($items, (int)$article['id']);
            $result[] = [
                'id' => (int)$article['id'],
                'uniqueSlug' => $article['unique_slug'],
                'mainCategoryId' => $article['main_category_id'],
                'subCategoryId' => $article['sub_category_id'],
                'parentId' => $articleParent,
                'title' => $article['title'],
                'summary' => $article['summary'] ?? '',
                'coverImage' => $article['cover_image'],
                'authorId' => (int)$article['author_id'],
                'authorName' => $article['author_name'] ?: 'Rudhra Prarthana',
                'status' => $article['status'],
                'isPublished' => (bool)$article['is_published'],
                'isDisabled' => (bool)$article['is_disabled'],
                'visibility' => $article['visibility'] ?: 'public',
                'accessPermission' => $article['access_permission'] ?: 'admin_only',
                'viewsCount' => (int)$article['views_count'],
                'commentsCount' => (int)$article['comments_count'],
                'sortOrder' => (int)$article['sort_order'],
                'publishedAt' => $article['published_at'] ?: $article['created_at'],
                'scheduledAt' => $article['scheduled_at'],
                'updatedAt' => $article['updated_at'] ?: $article['created_at'],
                'link' => '#content?slug=' . rawurlencode($article['unique_slug']),
                'children' => $children,
                'hasChildren' => count($children) > 0,
            ];
        }
        return $result;
    };

    $subTree = static function (array $items, string $mainId, $parentId = null) use (&$subTree, $articleTree, $articles): array {
        $result = [];
        foreach ($items as $sub) {
            $subParent = $sub['parent_id'] === null || $sub['parent_id'] === '' ? null : (string)$sub['parent_id'];
            if ((string)$sub['main_category_id'] !== $mainId || $subParent !== $parentId) {
                continue;
            }
            $children = $subTree($items, $mainId, (string)$sub['id']);
            $directArticles = array_values(array_filter($articles, static fn(array $article): bool => (string)$article['sub_category_id'] === (string)$sub['id']));
            $result[] = [
                'id' => $sub['id'],
                'mainCategoryId' => $sub['main_category_id'],
                'parentId' => $subParent,
                'title' => $sub['title'],
                'description' => $sub['description'] ?? '',
                'icon' => $sub['icon'] ?: '📌',
                'novelId' => $sub['novel_id'],
                'sortOrder' => (int)$sub['sort_order'],
                'status' => $sub['status'] ?: 'published',
                'isActive' => (bool)$sub['is_active'],
                'isDisabled' => (bool)$sub['is_disabled'],
                'hasChildren' => count($children) > 0,
                'isLeaf' => count($children) === 0,
                'children' => $children,
                'subcategories' => $children,
                'articles' => $articleTree($directArticles),
            ];
        }
        return $result;
    };

    $hierarchy = [];
    foreach ($categories as $category) {
        $categoryId = (string)$category['id'];
        $categorySubs = $subTree($subcategories, $categoryId);
        $directArticles = array_values(array_filter($articles, static function (array $article) use ($categoryId): bool {
            return (string)$article['main_category_id'] === $categoryId && empty($article['sub_category_id']);
        }));
        $hierarchy[] = [
            'id' => $category['id'],
            'title' => $category['title'],
            'icon' => $category['icon'] ?: '💬',
            'color' => $category['color'] ?: '#2E1065',
            'sortOrder' => (int)$category['sort_order'],
            'status' => $category['status'] ?: 'published',
            'isActive' => (bool)$category['is_active'],
            'isDisabled' => (bool)$category['is_disabled'],
            'subcategories' => $categorySubs,
            'articles' => $articleTree($directArticles),
            'novels' => [],
        ];
    }

    return ['success' => true, 'hierarchy' => $hierarchy];
}

function public_content_article(string $identifier): array
{
    $pdo = database();
    $query = $pdo->prepare(
        "SELECT a.*, m.title AS main_category_title, s.title AS sub_category_title
         FROM content_articles a
         LEFT JOIN forum_categories m ON m.id = a.main_category_id
         LEFT JOIN content_subcategories s ON s.id = a.sub_category_id
         WHERE (a.id = :id OR a.unique_slug = :slug)
           AND a.is_published = 1 AND a.is_disabled = 0 AND a.status = 'published'
         LIMIT 1"
    );
    $query->execute(['id' => $identifier, 'slug' => $identifier]);
    $article = $query->fetch();
    if (!$article) {
        return ['success' => false, 'error' => 'Content not found.', 'code' => 'NOT_FOUND'];
    }

    $children = $pdo->prepare(
        "SELECT id, unique_slug, title, summary, cover_image, author_name,
                status, is_published, published_at, created_at
         FROM content_articles
         WHERE parent_id = :parent_id AND is_published = 1
               AND is_disabled = 0 AND status = 'published'
         ORDER BY sort_order ASC, published_at ASC, id ASC"
    );
    $children->execute(['parent_id' => $article['id']]);

    return [
        'success' => true,
        'article' => [
            'id' => (int)$article['id'],
            'uniqueSlug' => $article['unique_slug'],
            'title' => $article['title'],
            'content' => $article['content'],
            'summary' => $article['summary'] ?? '',
            'coverImage' => $article['cover_image'],
            'authorId' => (int)$article['author_id'],
            'authorName' => $article['author_name'] ?: 'Rudhra Prarthana',
            'mainCategoryTitle' => $article['main_category_title'],
            'subCategoryTitle' => $article['sub_category_title'],
            'viewsCount' => (int)$article['views_count'],
            'commentsCount' => (int)$article['comments_count'],
            'publishedAt' => $article['published_at'] ?: $article['created_at'],
            'children' => array_map(static fn(array $child): array => [
                'id' => (int)$child['id'],
                'uniqueSlug' => $child['unique_slug'],
                'title' => $child['title'],
                'summary' => $child['summary'] ?? '',
                'coverImage' => $child['cover_image'],
                'authorName' => $child['author_name'] ?: 'Rudhra Prarthana',
                'publishedAt' => $child['published_at'] ?: $child['created_at'],
            ], $children->fetchAll()),
        ],
    ];
}
