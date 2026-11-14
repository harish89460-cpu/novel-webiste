<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';

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

if ($path === '/' || $path === '/index.php') {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Rudhra Prarthana Novels</title></head><body><h1>PHP migration backend is ready</h1><p>API health: <a href="/api/health">/api/health</a></p></body></html>';
    exit;
}

json_response(['success' => false, 'error' => 'Endpoint not found'], 404);
