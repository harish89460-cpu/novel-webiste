<?php
declare(strict_types=1);

if (PHP_SAPI === 'cli-server') {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $asset = __DIR__ . '/public' . $path;
    if ($path !== '/' && is_file($asset)) {
        $mimeTypes = [
            'css' => 'text/css; charset=utf-8',
            'js' => 'text/javascript; charset=utf-8',
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            'gif' => 'image/gif',
            'svg' => 'image/svg+xml',
            'ico' => 'image/x-icon',
            'json' => 'application/json; charset=utf-8',
            'webmanifest' => 'application/manifest+json',
        ];
        $extension = strtolower(pathinfo($asset, PATHINFO_EXTENSION));
        header('Content-Type: ' . ($mimeTypes[$extension] ?? 'application/octet-stream'));
        readfile($asset);
        exit;
    }
}

require __DIR__ . '/index.php';
