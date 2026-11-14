<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/content.php';

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
