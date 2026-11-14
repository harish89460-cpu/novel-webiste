<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function user_from_token(?string $token): ?array
{
    if (!$token) {
        return null;
    }

    $query = database()->prepare(
        'SELECT u.id, u.username, u.email, u.role, p.display_name, p.avatar, p.bio
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         LEFT JOIN profiles p ON p.user_id = u.id
         WHERE s.token = :token AND s.expires_at > NOW()
         LIMIT 1'
    );
    $query->execute(['token' => $token]);
    $row = $query->fetch();
    if (!$row) {
        return null;
    }

    return [
        'id' => (int)$row['id'],
        'username' => $row['username'],
        'email' => $row['email'],
        'displayName' => $row['display_name'] ?: $row['username'],
        'avatar' => $row['avatar'] ?: '/profile.png',
        'bio' => $row['bio'] ?: '',
        'role' => $row['role'] ?: 'Member',
        'isAdmin' => in_array(strtolower((string)$row['role']), ['admin', 'administrator'], true),
        'isAuthorSession' => false,
        'sessionType' => 'reader',
    ];
}

function login_user(array $input): array
{
    $identifier = strtolower(trim((string)($input['username'] ?? $input['email'] ?? '')));
    $password = (string)($input['password'] ?? '');
    if ($identifier === '' || $password === '') {
        return ['success' => false, 'error' => 'Username/email and password are required.'];
    }

    $query = database()->prepare(
        'SELECT id, username, email, password_hash FROM users
         WHERE LOWER(username) = :identifier OR LOWER(email) = :identifier
         LIMIT 1'
    );
    $query->execute(['identifier' => $identifier]);
    $user = $query->fetch();
    if (!$user || !password_verify($password, $user['password_hash'])) {
        return ['success' => false, 'error' => 'Invalid username/email or password.'];
    }

    $token = bin2hex(random_bytes(64));
    $session = database()->prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (:token, :user_id, DATE_ADD(NOW(), INTERVAL 30 DAY))');
    $session->execute(['token' => $token, 'user_id' => $user['id']]);
    $profile = database()->prepare('SELECT display_name, avatar, bio FROM profiles WHERE user_id = :user_id LIMIT 1');
    $profile->execute(['user_id' => $user['id']]);
    $profileRow = $profile->fetch() ?: [];

    return [
        'success' => true,
        'token' => $token,
        'user' => user_from_token($token),
    ];
}

function logout_user(?string $token): void
{
    if (!$token) {
        return;
    }
    $query = database()->prepare('DELETE FROM sessions WHERE token = :token');
    $query->execute(['token' => $token]);
}

function register_user(array $input): array
{
    $username = strtolower(trim((string)($input['username'] ?? '')));
    $email = strtolower(trim((string)($input['email'] ?? '')));
    $displayName = trim((string)($input['displayName'] ?? '')) ?: $username;
    $password = (string)($input['password'] ?? '');

    if ($username === '' || strlen($username) < 3 || strlen($username) > 30) {
        return ['success' => false, 'error' => 'Username must be between 3 and 30 characters.'];
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        return ['success' => false, 'error' => 'Username can only contain letters, numbers, and underscores.'];
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        return ['success' => false, 'error' => 'Please enter a valid email address.'];
    }
    if (strlen($password) < 6) {
        return ['success' => false, 'error' => 'Password must be at least 6 characters long.'];
    }

    $pdo = database();
    $existing = $pdo->prepare('SELECT id FROM users WHERE username = :username OR email = :email LIMIT 1');
    $existing->execute(['username' => $username, 'email' => $email]);
    if ($existing->fetch()) {
        return ['success' => false, 'error' => 'A user with this username or email already exists.'];
    }

    $salt = bin2hex(random_bytes(32));
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
    $joinedDate = date('M Y');
    $pdo->beginTransaction();
    try {
        $insertUser = $pdo->prepare('INSERT INTO users (username, email, password_hash, salt, role) VALUES (:username, :email, :password_hash, :salt, \'Member\')');
        $insertUser->execute([
            'username' => $username,
            'email' => $email,
            'password_hash' => $passwordHash,
            'salt' => $salt,
        ]);
        $userId = (int)$pdo->lastInsertId();

        $profile = $pdo->prepare('INSERT INTO profiles (user_id, display_name, display_name_ta, avatar, bio, bio_ta, title, title_ta, joined_date, posts_count, topics_count, followers_count) VALUES (:user_id, :display_name, :display_name_ta, :avatar, \'\', \'\', \'Member\', \'Member\', :joined_date, 0, 0, 0)');
        $profile->execute([
            'user_id' => $userId,
            'display_name' => $displayName,
            'display_name_ta' => $displayName,
            'avatar' => '/profile.png',
            'joined_date' => $joinedDate,
        ]);

        $activity = $pdo->prepare('INSERT INTO activity_status (user_id, is_enabled, is_online, last_seen) VALUES (:user_id, 1, 1, CURRENT_TIMESTAMP)');
        $activity->execute(['user_id' => $userId]);

        $token = bin2hex(random_bytes(64));
        $session = $pdo->prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (:token, :user_id, DATE_ADD(NOW(), INTERVAL 30 DAY))');
        $session->execute(['token' => $token, 'user_id' => $userId]);
        $pdo->commit();
    } catch (Throwable $error) {
        $pdo->rollBack();
        throw $error;
    }

    return [
        'success' => true,
        'token' => $token,
        'user' => [
            'id' => $userId,
            'username' => $username,
            'email' => $email,
            'displayName' => $displayName,
            'avatar' => '/profile.png',
            'bio' => '',
            'role' => 'Member',
            'activityStatusEnabled' => true,
            'isOnline' => true,
            'isAdmin' => false,
            'isAuthorSession' => false,
            'sessionType' => 'reader',
        ],
    ];
}
