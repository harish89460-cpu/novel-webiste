<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

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
