<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/content.php';
require_once __DIR__ . '/forum.php';
require_once __DIR__ . '/comments.php';
require_once __DIR__ . '/upload.php';
require_once __DIR__ . '/notifications.php';
require_once __DIR__ . '/chat.php';
require_once __DIR__ . '/admin.php';
require_once __DIR__ . '/writers.php';
require_once __DIR__ . '/scheduler.php';

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$token = str_starts_with($authorization, 'Bearer ') ? trim(substr($authorization, 7)) : null;

if ($path === '/api/health' && $method === 'GET') {
    try {
        database();
        json_response(['status' => 'ok', 'database' => 'mysql', 'timestamp' => gmdate('c')]);
    } catch (Throwable $error) {
        json_response(['status' => 'error', 'database' => 'mysql'], 503);
    }
}

if ($path === '/api/auth/register' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($body)) {
        json_response(['success' => false, 'error' => 'Invalid JSON body.'], 400);
    }
    try {
        $result = register_user($body);
        json_response($result, $result['success'] ? 201 : 400);
    } catch (Throwable $error) {
        error_log('[PHP Registration Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to create the account.'], 500);
    }
}

if ($path === '/api/auth/login' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    if (!is_array($body)) {
        json_response(['success' => false, 'error' => 'Invalid JSON body.'], 400);
    }
    try {
        $result = login_user($body);
        json_response($result, $result['success'] ? 200 : 401);
    } catch (Throwable $error) {
        error_log('[PHP Login Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to log in.'], 500);
    }
}

if ($path === '/api/auth/me' && $method === 'GET') {
    $user = user_from_token($token);
    json_response($user
        ? ['authenticated' => true, 'isGuest' => false, 'user' => $user]
        : ['authenticated' => false, 'isGuest' => true]
    );
}

if ($path === '/api/auth/logout' && $method === 'POST') {
    logout_user($token);
    json_response(['success' => true]);
}

if ($path === '/api/content/hierarchy' && $method === 'GET') {
    try {
        json_response(public_content_hierarchy(user_from_token($token)));
    } catch (Throwable $error) {
        error_log('[PHP Content Hierarchy Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to load content.'], 500);
    }
}

if (preg_match('#^/api/content/articles/([^/]+)$#', $path, $matches) && $method === 'GET') {
    try {
        $result = public_content_article(rawurldecode($matches[1]));
        json_response($result, $result['success'] ? 200 : 404);
    } catch (Throwable $error) {
        error_log('[PHP Content Article Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to load the article.'], 500);
    }
}

if ($path === '/api/forum/categories' && $method === 'GET') {
    try {
        json_response(forum_categories());
    } catch (Throwable $error) {
        error_log('[PHP Forum Categories Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to load forum categories.'], 500);
    }
}

if ($path === '/api/forum/topics' && $method === 'GET') {
    try {
        json_response(forum_topics($_GET['category'] ?? null));
    } catch (Throwable $error) {
        error_log('[PHP Forum Topics Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to load forum topics.'], 500);
    }
}

if (preg_match('#^/api/forum/topics/([^/]+)/reply$#', $path, $matches) && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    try {
        $result = add_forum_reply(rawurldecode($matches[1]), is_array($body) ? $body : [], user_from_token($token));
        json_response($result, $result['success'] ? 201 : 400);
    } catch (Throwable $error) {
        error_log('[PHP Forum Reply Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to add reply.'], 500);
    }
}

if ($path === '/api/forum/topics' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    try {
        $result = create_forum_topic(is_array($body) ? $body : [], user_from_token($token));
        json_response($result, $result['success'] ? 201 : 400);
    } catch (Throwable $error) {
        error_log('[PHP Forum Topic Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to create topic.'], 500);
    }
}

if (preg_match('#^/api/forum/topics/([^/]+)$#', $path, $matches) && $method === 'GET') {
    try {
        $result = forum_topic(rawurldecode($matches[1]), user_from_token($token)['id'] ?? null);
        json_response($result, $result['success'] ? 200 : 404);
    } catch (Throwable $error) {
        error_log('[PHP Forum Topic Detail Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to load the topic.'], 500);
    }
}

if ($path === '/api/likes' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    $targetType = trim((string)($body['targetType'] ?? ''));
    $targetId = trim((string)($body['targetId'] ?? ''));
    try {
        json_response(toggle_forum_like($targetType, $targetId, user_from_token($token)));
    } catch (Throwable $error) {
        error_log('[PHP Like Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to update like.'], 500);
    }
}

if ($path === '/api/comments' && $method === 'GET') {
    $novelId = trim((string)($_GET['novel'] ?? $_GET['novelId'] ?? ''));
    if ($novelId === '') json_response(['success' => false, 'error' => 'novel is required'], 400);
    try {
        $comments = list_comments($novelId, trim((string)($_GET['ch'] ?? $_GET['chapterNum'] ?? '0')), user_from_token($token)['id'] ?? null);
        json_response(['success' => true, 'comments' => $comments, 'total' => count($comments)]);
    } catch (Throwable $error) {
        error_log('[PHP Comments List Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to load comments.'], 500);
    }
}

if ($path === '/api/comments' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    try {
        $result = add_comment(is_array($body) ? $body : [], user_from_token($token));
        json_response($result, $result['success'] ? 201 : 400);
    } catch (Throwable $error) {
        error_log('[PHP Comment Create Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to add comment.'], 500);
    }
}

if ($path === '/api/reactions' && $method === 'GET') {
    $targetType = trim((string)($_GET['targetType'] ?? 'content'));
    $targetId = trim((string)($_GET['targetId'] ?? ''));
    if ($targetId === '') json_response(['success' => false, 'error' => 'targetId is required'], 400);
    json_response(get_reactions($targetType, $targetId, user_from_token($token)['id'] ?? null));
}

if ($path === '/api/reactions' && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    $body = is_array($body) ? $body : [];
    try {
        $result = toggle_reaction((string)($body['targetType'] ?? 'content'), (string)($body['targetId'] ?? ''), (string)($body['emoji'] ?? ''), user_from_token($token));
        json_response($result, $result['success'] ? 200 : 400);
    } catch (Throwable $error) {
        error_log('[PHP Reaction Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to update reaction.'], 500);
    }
}

if (($path === '/api/upload/image' || $path === '/api/comments/upload-image') && $method === 'POST') {
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    try {
        $result = save_base64_upload(is_array($body) ? $body : [], user_from_token($token));
        json_response($result, $result['success'] ? 201 : 400);
    } catch (Throwable $error) {
        error_log('[PHP Upload Error] ' . $error->getMessage());
        json_response(['success' => false, 'error' => 'Unable to upload the file.'], 500);
    }
}

$authenticatedUser = user_from_token($token);
$authenticatedUserId = $authenticatedUser ? (int)$authenticatedUser['id'] : null;

if ($path === '/api/notifications' && $method === 'GET') {
    $items = $authenticatedUserId ? notifications_for_user($authenticatedUserId) : [];
    json_response(['success' => true, 'notifications' => $items, 'unreadCount' => $authenticatedUserId ? unread_notifications_count($authenticatedUserId) : 0]);
}
if ($path === '/api/notifications/unread-count' && $method === 'GET') {
    json_response(['success' => true, 'count' => $authenticatedUserId ? unread_notifications_count($authenticatedUserId) : 0]);
}
if (preg_match('#^/api/notifications/(\d+)/read$#', $path, $matches) && in_array($method, ['POST', 'PUT'], true)) {
    if (!$authenticatedUserId) json_response(['success' => false, 'error' => 'Authentication required.'], 401);
    $query = database()->prepare('UPDATE notifications SET is_read = 1 WHERE id = :id AND user_id = :user');
    $query->execute(['id' => (int)$matches[1], 'user' => $authenticatedUserId]);
    json_response(['success' => true]);
}
if ($path === '/api/notifications/read-all' && in_array($method, ['POST', 'PUT'], true)) {
    if (!$authenticatedUserId) json_response(['success' => false, 'error' => 'Authentication required.'], 401);
    database()->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = :user')->execute(['user' => $authenticatedUserId]);
    json_response(['success' => true]);
}
if ($path === '/api/notifications/preferences' && $method === 'GET') {
    if (!$authenticatedUserId) json_response(['success' => false, 'error' => 'Authentication required.'], 401);
    json_response(['success' => true, 'preferences' => notification_preferences($authenticatedUserId)]);
}
if ($path === '/api/notifications/preferences' && in_array($method, ['POST', 'PUT'], true)) {
    if (!$authenticatedUserId) json_response(['success' => false, 'error' => 'Authentication required.'], 401);
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    json_response(['success' => true, 'preferences' => update_notification_preferences($authenticatedUserId, is_array($body) ? $body : [])]);
}

if ($path === '/api/chat/conversations' && $method === 'GET') {
    if (!$authenticatedUserId) json_response(['success' => false, 'error' => 'Authentication required.'], 401);
    json_response(chat_conversations($authenticatedUserId));
}
if (preg_match('#^/api/chat/conversations/(\d+)/messages$#', $path, $matches) && $method === 'GET') {
    if (!$authenticatedUserId) json_response(['success' => false, 'error' => 'Authentication required.'], 401);
    $result = chat_messages((int)$matches[1], $authenticatedUserId);
    json_response($result, $result['success'] ? 200 : 403);
}
if ($path === '/api/chat/messages' && $method === 'POST') {
    if (!$authenticatedUserId) json_response(['success' => false, 'error' => 'Authentication required.'], 401);
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    $result = send_chat_message($authenticatedUserId, is_array($body) ? $body : []);
    json_response($result, $result['success'] ? 201 : 400);
}

if ($path === '/api/admin/overview' && $method === 'GET') {
    require_admin_user($authenticatedUser);
    json_response(admin_overview());
}
if ($path === '/api/admin/settings' && $method === 'GET') {
    require_admin_user($authenticatedUser);
    json_response(site_settings());
}
if ($path === '/api/admin/settings' && in_array($method, ['POST', 'PUT'], true)) {
    require_admin_user($authenticatedUser);
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    json_response(update_site_settings(is_array($body) ? $body : []));
}

if ($path === '/api/admin/writers' && $method === 'GET') {
    require_admin_user($authenticatedUser);
    json_response(writer_list($_GET['search'] ?? null, $_GET['status'] ?? null));
}
if ($path === '/api/admin/writers' && $method === 'POST') {
    require_admin_user($authenticatedUser);
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    $result = create_writer(is_array($body) ? $body : [], $authenticatedUserId);
    json_response($result, $result['success'] ? 201 : 400);
}
if (preg_match('#^/api/admin/writers/(\d+)/status$#', $path, $matches) && in_array($method, ['POST', 'PUT'], true)) {
    require_admin_user($authenticatedUser);
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    $result = update_writer_status((int)$matches[1], (string)(is_array($body) ? ($body['status'] ?? '') : ''));
    json_response($result, $result['success'] ? 200 : 400);
}
if (preg_match('#^/api/admin/writers/(\d+)/profile$#', $path, $matches) && in_array($method, ['POST', 'PUT'], true)) {
    require_admin_user($authenticatedUser);
    $body = json_decode(file_get_contents('php://input') ?: '{}', true);
    json_response(update_writer_profile((int)$matches[1], is_array($body) ? $body : []));
}

if ($path === '/api/scheduler/run' && $method === 'POST') {
    require_admin_user($authenticatedUser);
    json_response(publish_due_articles());
}

if ($path === '/' || $path === '/index.php') {
    $frontendIndex = __DIR__ . '/public/index.html';
    if (is_file($frontendIndex)) {
        header('Content-Type: text/html; charset=utf-8');
        readfile($frontendIndex);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Rudhra Prarthana Novels</title></head><body><h1>PHP migration backend is ready</h1><p>API health: <a href="/api/health">/api/health</a></p></body></html>';
    exit;
}

json_response(['success' => false, 'error' => 'Endpoint not found'], 404);
