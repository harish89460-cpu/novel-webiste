<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function writer_list(?string $search = null, ?string $status = null): array
{
    $sql = "SELECT u.id, u.username, u.email, u.status, u.role, u.created_at,
                   p.display_name, p.avatar, p.bio, p.title,
                   wp.access_type, wp.permission_status, wp.full_access,
                   wp.can_publish_independently, wp.can_schedule, wp.can_novels,
                   wp.can_short_stories, wp.can_audio_novels, wp.can_episodes,
                   wp.access_level
            FROM users u LEFT JOIN profiles p ON p.user_id = u.id
            LEFT JOIN writer_permissions wp ON wp.writer_id = u.id
            WHERE LOWER(u.role) = 'writer'";
    $params = [];
    if ($status && $status !== 'all') { $sql .= ' AND u.status = :status'; $params['status'] = $status; }
    if ($search) { $sql .= ' AND (LOWER(u.username) LIKE :search OR LOWER(u.email) LIKE :search OR LOWER(p.display_name) LIKE :search)'; $params['search'] = '%' . strtolower($search) . '%'; }
    $sql .= ' ORDER BY u.created_at DESC';
    $query = database()->prepare($sql); $query->execute($params);
    $writers = array_map(static fn(array $row): array => [
        'id' => (int)$row['id'], 'username' => $row['username'], 'email' => $row['email'],
        'displayName' => $row['display_name'] ?: $row['username'], 'avatar' => $row['avatar'] ?: '/profile.png',
        'bio' => $row['bio'] ?: '', 'title' => $row['title'] ?: 'Writer',
        'role' => $row['role'], 'status' => $row['status'] ?: 'active',
        'accessType' => $row['access_type'] ?: 'particular', 'permissionStatus' => $row['permission_status'] ?: 'active',
        'fullAccess' => (bool)$row['full_access'], 'canPublishIndependently' => (bool)$row['can_publish_independently'],
        'canSchedule' => (bool)$row['can_schedule'], 'canNovels' => (bool)($row['can_novels'] ?? true),
        'canShortStories' => (bool)$row['can_short_stories'], 'canAudioNovels' => (bool)$row['can_audio_novels'],
        'canEpisodes' => (bool)($row['can_episodes'] ?? true), 'accessLevel' => $row['access_level'] ?: 'review_required',
        'createdAt' => $row['created_at'],
    ], $query->fetchAll());
    return ['success' => true, 'writers' => $writers];
}

function create_writer(array $input, int $actorId): array
{
    $name = trim((string)($input['fullName'] ?? $input['name'] ?? ''));
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $password = (string)($input['password'] ?? '');
    if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 6) {
        return ['success' => false, 'error' => 'Name, valid email, and a password of at least 6 characters are required.'];
    }
    $pdo = database();
    $exists = $pdo->prepare('SELECT id FROM users WHERE LOWER(email) = :email LIMIT 1'); $exists->execute(['email' => $email]);
    if ($exists->fetch()) return ['success' => false, 'error' => 'An account with this email already exists.'];
    $base = preg_replace('/[^a-z0-9]+/i', '_', strtolower($name)) ?: explode('@', $email)[0];
    $username = substr(trim($base, '_'), 0, 30) ?: 'writer'; $suffix = 1;
    $check = $pdo->prepare('SELECT id FROM users WHERE username = :username LIMIT 1');
    while (true) { $check->execute(['username' => $username]); if (!$check->fetch()) break; $username = substr($base, 0, 26) . '_' . $suffix++; }
    $salt = bin2hex(random_bytes(32));
    $pdo->beginTransaction();
    try {
        $insert = $pdo->prepare("INSERT INTO users (username, email, password_hash, salt, role, status, created_by) VALUES (:username, :email, :hash, :salt, 'writer', 'active', :actor)");
        $insert->execute(['username' => $username, 'email' => $email, 'hash' => password_hash($password, PASSWORD_DEFAULT), 'salt' => $salt, 'actor' => $actorId]);
        $id = (int)$pdo->lastInsertId();
        $profile = $pdo->prepare("INSERT INTO profiles (user_id, display_name, avatar, title, joined_date) VALUES (:id, :name, '/profile.png', 'Author & Writer', DATE_FORMAT(NOW(), '%M %Y'))");
        $profile->execute(['id' => $id, 'name' => $name]);
        $pdo->prepare('INSERT INTO activity_status (user_id, is_enabled, is_online) VALUES (:id, 1, 0)')->execute(['id' => $id]);
        $pdo->prepare('INSERT INTO writer_permissions (writer_id) VALUES (:id)')->execute(['id' => $id]);
        $pdo->commit();
        return ['success' => true, 'writer' => ['id' => $id, 'username' => $username, 'email' => $email, 'displayName' => $name, 'role' => 'writer', 'status' => 'active']];
    } catch (Throwable $error) { $pdo->rollBack(); throw $error; }
}

function update_writer_status(int $writerId, string $status): array
{
    if (!in_array($status, ['active', 'blocked', 'pending_deletion'], true)) return ['success' => false, 'error' => 'Invalid writer status.'];
    $query = database()->prepare("UPDATE users SET status = :status WHERE id = :id AND LOWER(role) = 'writer'");
    $query->execute(['status' => $status, 'id' => $writerId]);
    return ['success' => true, 'status' => $status, 'writerId' => $writerId];
}

function update_writer_profile(int $writerId, array $input): array
{
    $query = database()->prepare('UPDATE profiles SET display_name = COALESCE(:name, display_name), bio = COALESCE(:bio, bio), avatar = COALESCE(:avatar, avatar) WHERE user_id = :id');
    $query->execute(['name' => $input['displayName'] ?? null, 'bio' => $input['bio'] ?? null, 'avatar' => $input['avatar'] ?? null, 'id' => $writerId]);
    return ['success' => true, 'writerId' => $writerId];
}
