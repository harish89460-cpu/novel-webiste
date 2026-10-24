// Authentication & Session Management Module
// MySQL Relational Backend with Cryptographic Password Hashing and Input Validation

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, queryOne, hashPassword, verifyPassword } from './db.js';
import { sendOtpEmail } from './email.js';
import { recordWriterAudit } from './writers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function saveBase64Image(dataUrl, folder = 'avatars', prefix = 'avatar') {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }
  try {
    const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!match) return dataUrl;
    let ext = match[1].toLowerCase();
    if (ext === 'jpeg') ext = 'jpg';
    if (ext === 'svg+xml') ext = 'svg';
    const buffer = Buffer.from(match[2], 'base64');
    const uploadDir = path.resolve(__dirname, `../public/uploads/${folder}`);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${folder}/${filename}`;
  } catch (err) {
    console.error(`Failed to save base64 image to ${folder}:`, err.message);
    return dataUrl;
  }
}

export function sanitizeAvatar(rawAvatar) {
  if (!rawAvatar || typeof rawAvatar !== 'string') return '/profile.png';
  const trimmed = rawAvatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'remove') return '/profile.png';
  if (trimmed.includes('images.unsplash.com') || trimmed.includes('ui-avatars.com')) {
    return '/profile.png';
  }
  return trimmed;
}

/**
 * Register a new user
 */
export async function registerUser({ username, email, password, displayName, avatar: customAvatar, bio: customBio }) {
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (displayName || '').trim() || cleanUsername;

  if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
    return { success: false, error: 'Username must be between 3 and 30 characters.' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
    return { success: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  // Check unique constraints
  const existingUser = await queryOne('SELECT id FROM users WHERE username = ? OR email = ?;', [cleanUsername, cleanEmail]);
  if (existingUser) {
    return { success: false, error: 'A user with this username or email already exists.' };
  }

  // Cryptographically hash password
  const { hash, salt } = hashPassword(password);

  const res = await query(`
    INSERT INTO users (username, email, password_hash, salt, role)
    VALUES (?, ?, ?, ?, 'Member');
  `, [cleanUsername, cleanEmail, hash, salt]);

  const userId = res.insertId;

  let avatar = (customAvatar && typeof customAvatar === 'string' && customAvatar.trim() && !customAvatar.includes('ui-avatars.com') && !customAvatar.includes('images.unsplash.com')) 
    ? customAvatar.trim() 
    : null;
  if (avatar && avatar.startsWith('data:image/')) {
    avatar = saveBase64Image(avatar, 'avatars', `avatar-${cleanUsername}`);
  }
  const joinedDate = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const initialBio = (customBio && typeof customBio === 'string') ? customBio.trim() : '';

  // Create Profile
  await query(`
    INSERT INTO profiles (user_id, display_name, display_name_ta, avatar, bio, bio_ta, title, title_ta, joined_date, posts_count, topics_count, followers_count)
    VALUES (?, ?, ?, ?, ?, ?, 'Member', 'Member', ?, 0, 0, 0);
  `, [userId, cleanName, cleanName, avatar, initialBio, initialBio, joinedDate]);

  // Initialize Activity Status
  await query(`
    INSERT INTO activity_status (user_id, is_enabled, is_online, last_seen)
    VALUES (?, 1, 1, CURRENT_TIMESTAMP);
  `, [userId]);

  // Create Authenticated Session
  const token = await createSession(userId);

  return {
    success: true,
    token,
    user: {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      displayName: cleanName,
      avatar: sanitizeAvatar(avatar),
      bio: initialBio,
      role: 'Member',
      activityStatusEnabled: true,
      isOnline: true,
      isAdmin: false,
      isAuthorSession: false,
      sessionType: 'reader'
    }
  };
}

/**
 * Update user profile
 */
export async function updateUserProfile(userId, { displayName, username, avatar, bio }) {
  const user = await queryOne('SELECT id, username FROM users WHERE id = ?;', [userId]);
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  let finalUsername = user.username;
  if (username && username.trim().toLowerCase() !== user.username) {
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return { success: false, error: 'Username must be between 3 and 30 characters.' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return { success: false, error: 'Username can only contain letters, numbers, and underscores.' };
    }
    const taken = await queryOne('SELECT id FROM users WHERE username = ? AND id != ?;', [cleanUsername, userId]);
    if (taken) {
      return { success: false, error: 'This username is already taken.' };
    }
    await query('UPDATE users SET username = ? WHERE id = ?;', [cleanUsername, userId]);
    finalUsername = cleanUsername;
  }

  const existingProfile = await queryOne('SELECT * FROM profiles WHERE user_id = ?;', [userId]);
  const cleanDisplayName = (displayName && displayName.trim()) || existingProfile?.display_name || finalUsername;
  const cleanBio = bio !== undefined ? String(bio).trim() : (existingProfile?.bio || '');

  let finalAvatar = existingProfile?.avatar || null;
  if (avatar !== undefined) {
    if (avatar === null || avatar === '' || avatar === 'remove') {
      finalAvatar = null;
    } else if (typeof avatar === 'string' && avatar.trim()) {
      const trimmed = avatar.trim();
      finalAvatar = trimmed.startsWith('data:image/')
        ? saveBase64Image(trimmed, 'avatars', `avatar-${userId}`)
        : trimmed;
    }
  }

  await query(`
    INSERT INTO profiles (user_id, display_name, display_name_ta, avatar, bio, bio_ta, title, title_ta, joined_date)
    VALUES (?, ?, ?, ?, ?, ?, 'Member', 'Member', 'Recent')
    ON DUPLICATE KEY UPDATE
      display_name = VALUES(display_name),
      display_name_ta = VALUES(display_name_ta),
      avatar = VALUES(avatar),
      bio = VALUES(bio),
      bio_ta = VALUES(bio_ta);
  `, [userId, cleanDisplayName, cleanDisplayName, finalAvatar, cleanBio, cleanBio]);

  const updatedProfile = await queryOne(`
    SELECT u.id, u.username, u.email, u.role,
           p.display_name, p.avatar, p.bio, p.title, p.joined_date,
           p.posts_count, p.topics_count, p.followers_count,
           a.is_enabled AS activity_status_enabled,
           a.is_online
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    WHERE u.id = ?;
  `, [userId]);

  return {
    success: true,
    user: {
      id: updatedProfile.id,
      username: updatedProfile.username,
      email: updatedProfile.email,
      role: updatedProfile.role,
      displayName: updatedProfile.display_name || updatedProfile.username,
      avatar: sanitizeAvatar(updatedProfile.avatar),
      bio: updatedProfile.bio || '',
      title: updatedProfile.title || updatedProfile.role,
      joinedDate: updatedProfile.joined_date,
      postsCount: Number(updatedProfile.posts_count || 0),
      topicsCount: Number(updatedProfile.topics_count || 0),
      followersCount: Number(updatedProfile.followers_count || 0),
      activityStatusEnabled: Boolean(updatedProfile.activity_status_enabled),
      isOnline: Boolean(updatedProfile.is_online)
    }
  };
}

/**
 * Authenticate user login
 */
/**
 * Authenticate normal reader login
 * Generates a standard 'reader' session without administrative privileges
 */
export async function loginUser({ username, email, identifier, password } = {}) {
  const cleanIdentifier = (username || email || identifier || '').trim().toLowerCase();
  if (!cleanIdentifier || !password) {
    return { success: false, error: 'Please enter both your username/email and password.' };
  }

  const user = await queryOne(`
    SELECT id, username, email, password_hash, salt, role
    FROM users
    WHERE LOWER(username) = ? OR LOWER(email) = ?;
  `, [cleanIdentifier, cleanIdentifier]);

  if (!user) {
    return { success: false, error: 'Invalid username/email or password.' };
  }

  const valid = verifyPassword(password, user.password_hash, user.salt);
  if (!valid) {
    return { success: false, error: 'Invalid username/email or password.' };
  }

  // Create reader session in MySQL
  const token = await createSession(user.id, 'reader');

  // Set user online
  await query(`
    UPDATE activity_status 
    SET is_online = 1, last_seen = CURRENT_TIMESTAMP 
    WHERE user_id = ?;
  `, [user.id]);

  const profile = await queryOne(`
    SELECT p.*, a.is_enabled AS activity_status_enabled, a.is_online
    FROM profiles p
    LEFT JOIN activity_status a ON p.user_id = a.user_id
    WHERE p.user_id = ?;
  `, [user.id]);

  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      displayName: profile?.display_name || user.username,
      avatar: sanitizeAvatar(profile?.avatar),
      bio: profile?.bio || '',
      title: profile?.title || 'Member',
      joinedDate: profile?.joined_date || '',
      activityStatusEnabled: profile?.activity_status_enabled !== 0,
      isOnline: true,
      isAdmin: false,
      isAuthorSession: false,
      sessionType: 'reader'
    }
  };
}

/**
 * Authenticate Author & Admin login exclusively via dedicated Author Portal
 * Validates credentials, verifies authorization, and issues an 'author' session
 */
export async function loginAuthor({ username, password }) {
  const cleanIdentifier = (username || '').trim().toLowerCase();
  if (!cleanIdentifier || !password) {
    return { success: false, error: 'Please enter both your username/email and password.' };
  }

  const user = await queryOne(`
    SELECT id, username, email, password_hash, salt, role, status
    FROM users
    WHERE LOWER(username) = ? OR LOWER(email) = ?;
  `, [cleanIdentifier, cleanIdentifier]);

  if (!user) {
    return { success: false, error: 'Invalid credentials.' };
  }

  const valid = verifyPassword(password, user.password_hash, user.salt);
  if (!valid) {
    return { success: false, error: 'Invalid credentials.' };
  }

  // Account status validation
  if (user.status === 'blocked') {
    return { success: false, error: 'Your account has been temporarily blocked by the administrator. Please contact support.' };
  }
  if (user.status === 'pending_deletion') {
    return { success: false, error: 'This account is pending deletion and cannot be accessed.' };
  }

  // Identify role: Admin vs Writer
  const role = (user.role || '').toLowerCase();
  const isAdminRole = role === 'admin' || role === 'administrator' || role === 'author';
  const isAuthorizedAdmin = isAdminRole && (user.email === 'digitalmarkservices.in@gmail.com' || user.email === 'rudhra@rpnovels.com' || user.username === 'rudhra_author');
  const isWriter = role === 'writer';

  if (!isAuthorizedAdmin && !isWriter) {
    return { success: false, error: 'Access denied: You are not authorized to access the Author & Writer Portal.' };
  }

  // Update last_login timestamp
  await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?;', [user.id]);

  // Create session in MySQL
  const sessionType = isAuthorizedAdmin ? 'author' : 'writer';
  const token = await createSession(user.id, sessionType);

  // Set user online
  await query(`
    UPDATE activity_status 
    SET is_online = 1, last_seen = CURRENT_TIMESTAMP 
    WHERE user_id = ?;
  `, [user.id]);

  if (isWriter) {
    await recordWriterAudit({
      writerId: user.id,
      actorId: user.id,
      action: 'login_success',
      details: 'Writer logged in successfully via shared Author & Writer portal.'
    });
  }

  const profile = await queryOne(`
    SELECT p.*, a.is_enabled AS activity_status_enabled, a.is_online
    FROM profiles p
    LEFT JOIN activity_status a ON p.user_id = a.user_id
    WHERE p.user_id = ?;
  `, [user.id]);

  return {
    success: true,
    token,
    role: isAuthorizedAdmin ? 'admin' : 'writer',
    redirectUrl: isAuthorizedAdmin ? '#admin' : '#writer',
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: isAuthorizedAdmin ? 'admin' : 'writer',
      status: user.status || 'active',
      displayName: profile?.display_name || user.username,
      avatar: sanitizeAvatar(profile?.avatar),
      bio: profile?.bio || '',
      title: profile?.title || (isAuthorizedAdmin ? 'Author & Admin' : 'Writer'),
      joinedDate: profile?.joined_date || '',
      activityStatusEnabled: profile?.activity_status_enabled !== 0,
      isOnline: true,
      isAdmin: isAuthorizedAdmin,
      isWriter,
      isAuthorSession: isAuthorizedAdmin,
      sessionType
    }
  };
}

/**
 * Create a new authenticated session in MySQL
 * @param {number} userId 
 * @param {'reader'|'author'} sessionType 
 */
export async function createSession(userId, sessionType = 'reader') {
  const token = crypto.randomBytes(32).toString('hex');

  await query(`
    INSERT INTO sessions (token, user_id, session_type, expires_at)
    VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY));
  `, [token, userId, sessionType]);

  return token;
}

/**
 * Validate session token and retrieve current user
 */
export async function getUserByToken(token) {
  if (!token) return null;

  // Clean expired sessions
  try {
    await query(`DELETE FROM sessions WHERE expires_at < NOW();`);
  } catch {}

  const row = await queryOne(`
    SELECT 
      u.id, u.username, u.email, u.role, u.status,
      s.session_type,
      p.display_name, p.avatar, p.bio, p.title, p.joined_date,
      p.posts_count, p.topics_count, p.followers_count,
      a.is_enabled AS activity_status_enabled,
      a.is_online
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    WHERE s.token = ? AND s.expires_at > NOW();
  `, [token]);

  if (!row) return null;

  // Immediately invalidate session if account is blocked or pending deletion
  if (row.status === 'blocked' || row.status === 'pending_deletion') {
    return null;
  }

  const role = (row.role || '').toLowerCase();
  const isAdminRole = role === 'admin' || role === 'administrator' || role === 'author';
  const isAuthorizedAccount = row.email === 'digitalmarkservices.in@gmail.com' || row.email === 'rudhra@rpnovels.com' || row.username === 'rudhra_author';
  const isAuthorSession = row.session_type === 'author' && isAdminRole && isAuthorizedAccount;
  const isAdmin = isAuthorSession;
  const isWriter = role === 'writer' && (row.session_type === 'writer' || row.session_type === 'author');

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status || 'active',
    displayName: row.display_name || row.username,
    avatar: sanitizeAvatar(row.avatar),
    bio: row.bio || '',
    title: row.title || row.role,
    joinedDate: row.joined_date,
    postsCount: Number(row.posts_count || 0),
    topicsCount: Number(row.topics_count || 0),
    followersCount: Number(row.followers_count || 0),
    activityStatusEnabled: Boolean(row.activity_status_enabled),
    isOnline: Boolean(row.is_online),
    isAdmin,
    isWriter,
    isAuthorSession,
    sessionType: row.session_type || 'reader'
  };
}

/**
 * Logout and invalidate session
 */
export async function logoutUser(token) {
  if (!token) return { success: true };

  const session = await queryOne('SELECT user_id FROM sessions WHERE token = ?;', [token]);
  await query('DELETE FROM sessions WHERE token = ?;', [token]);

  if (session) {
    const remaining = await queryOne('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?;', [session.user_id]);
    if (!remaining || remaining.count === 0) {
      await query('UPDATE activity_status SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE user_id = ?;', [session.user_id]);
      try {
        await query('DELETE FROM user_presence WHERE session_key = ?;', [`member_${session.user_id}`]);
      } catch {}
    }
  }

  return { success: true };
}

/**
 * Touch user heartbeat (update last_seen and online status)
 */
export async function touchHeartbeat(userId) {
  if (!userId) return;
  await query(`
    UPDATE activity_status 
    SET is_online = 1, last_seen = CURRENT_TIMESTAMP 
    WHERE user_id = ?;
  `, [userId]);
}

/**
 * Toggle user activity status
 */
export async function setActivityStatus(userId, isEnabled) {
  await query(`
    UPDATE activity_status 
    SET is_enabled = ? 
    WHERE user_id = ?;
  `, [isEnabled ? 1 : 0, userId]);

  return { success: true, isEnabled: Boolean(isEnabled) };
}

/**
 * Get all members directory with privacy-filtered activity status
 */
export async function getAllMembersWithStatus(viewerId = null) {
  const rows = await query(`
    SELECT 
      u.id, u.username, u.role,
      p.display_name, p.avatar, p.bio, p.title, p.joined_date,
      p.posts_count, p.topics_count, p.followers_count,
      a.is_enabled AS activity_status_enabled,
      a.is_online,
      a.last_seen
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    ORDER BY u.created_at ASC;
  `);

  return rows.map(r => {
    const isSelf = viewerId && viewerId === r.id;
    const canShowStatus = Boolean(r.activity_status_enabled) || isSelf;

    return {
      id: r.id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatar: sanitizeAvatar(r.avatar),
      role: r.role || 'Member',
      title: r.title || r.role || 'Member',
      joined: r.joined_date || 'Member',
      joinedDate: r.joined_date || 'Member',
      bio: r.bio || '',
      posts: Number(r.posts_count || 0),
      topics: Number(r.topics_count || 0),
      followers: Number(r.followers_count || 0),
      activityStatusEnabled: Boolean(r.activity_status_enabled),
      isOnline: canShowStatus ? Boolean(r.is_online) : null,
      lastSeen: canShowStatus ? r.last_seen : null
    };
  });
}

/**
 * Password Reset: Step 1 - Request OTP
 */
export async function requestPasswordResetOtp(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: 'Please enter your registered email address.' };
  }

  const user = await queryOne('SELECT id, username, status, role FROM users WHERE LOWER(email) = ?;', [cleanEmail]);
  if (!user) {
    return { success: false, error: 'No account was found with this email address.' };
  }

  if (user.status === 'blocked') {
    return { success: false, error: 'This account has been temporarily blocked. Please contact the administrator.' };
  }
  if (user.status === 'pending_deletion') {
    return { success: false, error: 'This account is pending deletion and cannot be reset.' };
  }

  // Check cooldown: 60 seconds
  const recent = await queryOne(`
    SELECT id, resend_after FROM password_resets 
    WHERE user_id = ? AND used = 0 AND resend_after > NOW()
    ORDER BY created_at DESC LIMIT 1;
  `, [user.id]);

  if (recent) {
    return { success: false, error: 'Please wait before requesting another OTP.' };
  }

  // Generate 6-digit cryptographically secure OTP
  const otp = crypto.randomInt(100000, 999999).toString();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto.scryptSync(otp, salt, 64).toString('hex');

  // Expires in 5 minutes, resend cooldown in 60 seconds
  await query(`
    INSERT INTO password_resets (user_id, email, otp_hash, otp_salt, expires_at, resend_after)
    VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), DATE_ADD(NOW(), INTERVAL 60 SECOND));
  `, [user.id, cleanEmail, otpHash, salt]);

  // Deliver via SMTP Email
  try {
    await sendOtpEmail({ to: cleanEmail, username: user.username, otp });
  } catch (err) {
    console.error('[OTP EMAIL ERROR]:', err);
    return { success: false, error: 'Unable to deliver OTP email. Please check server SMTP configuration.' };
  }

  // Store last OTP in .last_otp.txt for verification and tests
  try {
    const fsMod = await import('node:fs');
    fsMod.writeFileSync('.last_otp.txt', otp, 'utf8');
  } catch {}

  return {
    success: true,
    message: 'A 6-digit verification code has been sent to your email.',
    expiresInSeconds: 300,
    cooldownSeconds: 60
  };
}

/**
 * Password Reset: Step 2 - Verify OTP
 */
export async function verifyPasswordResetOtp(email, otp) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanOtp = (otp || '').trim();

  if (!cleanEmail || !cleanOtp) {
    return { success: false, error: 'Please enter both your email and the 6-digit code.' };
  }

  const record = await queryOne(`
    SELECT *, (expires_at > NOW()) AS is_active
    FROM password_resets 
    WHERE LOWER(email) = ? AND used = 0
    ORDER BY created_at DESC LIMIT 1;
  `, [cleanEmail]);

  if (!record) {
    return { success: false, error: 'No active password reset request found.' };
  }

  if (!record.is_active) {
    return { success: false, error: 'This code has expired. Please request a new one.' };
  }

  if (record.attempts >= record.max_attempts) {
    return { success: false, error: 'Maximum attempts reached. Please request a new code.' };
  }

  // Verify OTP
  const derived = crypto.scryptSync(cleanOtp, record.otp_salt, 64).toString('hex');
  const isValid = crypto.timingSafeEqual(Buffer.from(record.otp_hash, 'hex'), Buffer.from(derived, 'hex'));

  if (!isValid) {
    await query(`UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?;`, [record.id]);
    const remaining = record.max_attempts - (record.attempts + 1);
    return { success: false, error: `Invalid code. ${remaining} attempts remaining.` };
  }

  // Issue reset token (valid for 15 minutes)
  const resetToken = crypto.randomBytes(32).toString('hex');
  await query(`UPDATE password_resets SET reset_token = ?, expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?;`, [resetToken, record.id]);

  return { success: true, resetToken };
}

/**
 * Password Reset: Step 2b - Resend OTP
 */
export async function resendPasswordResetOtp(email) {
  return await requestPasswordResetOtp(email);
}

/**
 * Password Reset: Step 3 - Set New Password
 */
export async function completePasswordReset(email, resetToken, newPassword, confirmPassword) {
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail || !resetToken || !newPassword) {
    return { success: false, error: 'All fields are required.' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return { success: false, error: 'Passwords do not match.' };
  }

  const record = await queryOne(`
    SELECT * FROM password_resets 
    WHERE LOWER(email) = ? AND reset_token = ? AND used = 0 AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1;
  `, [cleanEmail, resetToken]);

  if (!record) {
    return { success: false, error: 'Invalid or expired reset session. Please request a new code.' };
  }

  const { hash, salt } = hashPassword(newPassword);

  await query(`UPDATE users SET password_hash = ?, salt = ? WHERE id = ?;`, [hash, salt, record.user_id]);
  await query(`UPDATE password_resets SET used = 1 WHERE id = ?;`, [record.id]);
  // Terminate any previous sessions and presence
  await query(`DELETE FROM sessions WHERE user_id = ?;`, [record.user_id]);
  try {
    await query(`DELETE FROM user_presence WHERE session_key = ?;`, [`member_${record.user_id}`]);
  } catch {}

  // Record audit event
  await recordWriterAudit({
    writerId: record.user_id,
    actorId: record.user_id,
    action: 'password_reset_completed',
    details: 'Password was updated successfully using verified email OTP.'
  });

  return { success: true, message: 'Password reset successfully! You can now log in.' };
}
