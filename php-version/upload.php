<?php
declare(strict_types=1);

function save_base64_upload(array $input, ?array $user): array
{
    if (!$user) return ['success' => false, 'error' => 'Please log in to upload files.', 'requireLogin' => true];
    $raw = (string)($input['data'] ?? $input['file'] ?? $input['dataUrl'] ?? '');
    if (!preg_match('#^data:(image/(?:jpeg|png|gif|webp)|audio/(?:mpeg|mp4|wav|ogg|webm));base64,(.+)$#s', $raw, $matches)) {
        return ['success' => false, 'error' => 'Only supported image and audio files may be uploaded.'];
    }

    $binary = base64_decode($matches[2], true);
    if ($binary === false || strlen($binary) > 60 * 1024 * 1024) {
        return ['success' => false, 'error' => 'The uploaded file is invalid or exceeds the 60 MB limit.'];
    }
    $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($binary);
    $extensions = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/gif' => 'gif', 'image/webp' => 'webp',
        'audio/mpeg' => 'mp3', 'audio/mp4' => 'm4a', 'audio/wav' => 'wav',
        'audio/ogg' => 'ogg', 'audio/webm' => 'webm'
    ];
    if (!isset($extensions[$mime])) return ['success' => false, 'error' => 'The detected file type is not allowed.'];

    $folder = strtolower(trim((string)($input['folder'] ?? 'comments')));
    if (!in_array($folder, ['comments', 'covers', 'media', 'audio'], true)) $folder = 'comments';
    $directory = __DIR__ . '/uploads/' . $folder;
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) {
        return ['success' => false, 'error' => 'Upload storage is unavailable.'];
    }
    $filename = bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
    $path = $directory . '/' . $filename;
    if (file_put_contents($path, $binary, LOCK_EX) === false) {
        return ['success' => false, 'error' => 'Unable to save the uploaded file.'];
    }
    return ['success' => true, 'url' => '/uploads/' . $folder . '/' . $filename, 'mimeType' => $mime, 'sizeBytes' => strlen($binary)];
}
