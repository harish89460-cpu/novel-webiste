// Authentication & Session Management Module
// SQLite Persistent Backend with Secure Cryptographic Hashing

import crypto from 'node:crypto';
import { getDb, hashPassword, verifyPassword } from './db.js';
import { sendOtpEmail } from './email.js';

export function sanitizeAvatar(rawAvatar) {
  if (!rawAvatar || typeof rawAvatar !== 'string') return '/profile.png';
  const trimmed = rawAvatar.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'remove') return '/profile.png';
  if (trimmed.includes('images.unsplash.com') || trimmed.includes('ui-avatars.com')) {
    return '/profile.png';
  }
  return trimmed;
}

export function registerUser({ username, email, password, displayName, displayNameTa, avatar: customAvatar, bio: customBio }) {
  const db = getDb();

  // Validate inputs
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (displayName || '').trim() || cleanUsername;
  const cleanNameTa = (displayNameTa || '').trim() || cleanName;

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
  const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?;').get(cleanUsername, cleanEmail);
  if (existingUser) {
    return { success: false, error: 'A user with this username or email already exists.' };
  }

  // Cryptographically hash password
  const { hash, salt } = hashPassword(password);

  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, salt, role)
    VALUES (?, ?, ?, ?, 'Registered Member');
  `);

  const res = insertUser.run(cleanUsername, cleanEmail, hash, salt);
  const userId = Number(res.lastInsertRowid);

  // Avatar: user-provided or null (neutral default /profile.png)
  const avatar = (customAvatar && typeof customAvatar === 'string' && customAvatar.trim() && !customAvatar.includes('ui-avatars.com') && !customAvatar.includes('images.unsplash.com')) 
    ? customAvatar.trim() 
    : null;
  const joinedDate = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const initialBio = (customBio && typeof customBio === 'string') ? customBio.trim() : '';

  // Create Profile (User controls their own details - no hardcoded defaults)
  db.prepare(`
    INSERT INTO profiles (user_id, display_name, display_name_ta, avatar, bio, bio_ta, title, title_ta, joined_date, posts_count, topics_count, followers_count)
    VALUES (?, ?, ?, ?, ?, ?, 'Member', 'உறுப்பினர்', ?, 0, 0, 0);
  `).run(
    userId, cleanName, cleanNameTa, avatar,
    initialBio, initialBio, joinedDate
  );

  // Initialize Activity Status (Enabled by default, marked Online)
  db.prepare(`
    INSERT INTO activity_status (user_id, is_enabled, is_online, last_seen)
    VALUES (?, 1, 1, CURRENT_TIMESTAMP);
  `).run(userId);

  // Create Authenticated Session
  const token = createSession(userId);

  return {
    success: true,
    token,
    user: {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      role: 'Registered Member',
      displayName: cleanName,
      displayNameTa: cleanNameTa,
      avatar: sanitizeAvatar(avatar),
      bio: initialBio,
      bioTa: initialBio,
      activityStatusEnabled: true,
      isOnline: true
    }
  };
}

export function updateUserProfile(userId, { displayName, displayNameTa, username, avatar, bio, bioTa }) {
  const db = getDb();

  const user = db.prepare('SELECT id, username, email, role FROM users WHERE id = ?;').get(userId);
  if (!user) {
    return { success: false, error: 'User not found.' };
  }

  // If username is changing, validate and verify uniqueness
  let newUsername = user.username;
  if (username && username.trim().toLowerCase() !== user.username) {
    const cleanUser = username.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUser)) {
      return { success: false, error: 'Username must be 3-20 characters long and contain only letters, numbers, and underscores.' };
    }
    const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?;').get(cleanUser, userId);
    if (taken) {
      return { success: false, error: 'Username is already taken by another member.' };
    }
    db.prepare('UPDATE users SET username = ? WHERE id = ?;').run(cleanUser, userId);
    newUsername = cleanUser;
  }

  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?;').get(userId);
  const cleanDisplayName = displayName !== undefined ? displayName.trim() : (profile?.display_name || newUsername);
  const cleanDisplayNameTa = displayNameTa !== undefined ? displayNameTa.trim() : (profile?.display_name_ta || cleanDisplayName);
  
  let cleanAvatar;
  if (avatar !== undefined) {
    if (!avatar || avatar === 'remove' || avatar === '/profile.png' || avatar === 'null' || avatar === '') {
      cleanAvatar = null;
    } else {
      const trimmed = avatar.trim();
      if (trimmed.includes('images.unsplash.com') || trimmed.includes('ui-avatars.com')) {
        cleanAvatar = null;
      } else {
        if (trimmed.startsWith('data:image/')) {
          const match = trimmed.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,/i);
          if (!match) {
            return { success: false, error: 'Invalid image format. Allowed formats: PNG, JPG, WEBP, GIF.' };
          }
          if (trimmed.length > 7 * 1024 * 1024) {
            return { success: false, error: 'Image size exceeds maximum limit of 5MB.' };
          }
        }
        cleanAvatar = trimmed;
      }
    }
  } else {
    cleanAvatar = profile?.avatar || null;
    if (cleanAvatar && (cleanAvatar.includes('images.unsplash.com') || cleanAvatar.includes('ui-avatars.com'))) {
      cleanAvatar = null;
    }
  }

  const cleanBio = bio !== undefined ? bio.trim() : (profile?.bio || '');
  const cleanBioTa = bioTa !== undefined ? bioTa.trim() : (profile?.bio_ta || cleanBio);

  if (profile) {
    db.prepare(`
      UPDATE profiles
      SET display_name = ?, display_name_ta = ?, avatar = ?, bio = ?, bio_ta = ?
      WHERE user_id = ?;
    `).run(cleanDisplayName, cleanDisplayNameTa, cleanAvatar, cleanBio, cleanBioTa, userId);
  } else {
    const joinedDate = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    db.prepare(`
      INSERT INTO profiles (user_id, display_name, display_name_ta, avatar, bio, bio_ta, title, title_ta, joined_date, posts_count, topics_count, followers_count)
      VALUES (?, ?, ?, ?, ?, ?, 'Member', 'உறுப்பினர்', ?, 0, 0, 0);
    `).run(userId, cleanDisplayName, cleanDisplayNameTa, cleanAvatar, cleanBio, cleanBioTa, joinedDate);
  }

  const act = db.prepare('SELECT is_enabled, is_online, last_seen FROM activity_status WHERE user_id = ?;').get(userId);

  return {
    success: true,
    user: {
      id: userId,
      username: newUsername,
      email: user.email,
      role: user.role,
      displayName: cleanDisplayName,
      displayNameTa: cleanDisplayNameTa,
      avatar: sanitizeAvatar(cleanAvatar),
      bio: cleanBio,
      bioTa: cleanBioTa,
      activityStatusEnabled: act ? act.is_enabled === 1 : true,
      isOnline: act ? act.is_online === 1 : true
    }
  };
}

export function loginUser({ username, password }) {
  const db = getDb();
  const cleanIdentifier = (username || '').trim().toLowerCase();

  if (!cleanIdentifier || !password) {
    return { success: false, error: 'Username and password are required.' };
  }

  const user = db.prepare(`
    SELECT u.id, u.username, u.email, u.password_hash, u.salt, u.role,
           p.display_name, p.display_name_ta, p.avatar, p.title, p.title_ta,
           a.is_enabled, a.is_online
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    WHERE u.username = ? OR u.email = ?;
  `).get(cleanIdentifier, cleanIdentifier);

  if (!user) {
    return { success: false, error: 'Invalid username or password.' };
  }

  const isValid = verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    return { success: false, error: 'Invalid username or password.' };
  }

  // Update Activity Status -> Online & Last Seen
  db.prepare(`
    UPDATE activity_status
    SET is_online = 1, last_seen = CURRENT_TIMESTAMP
    WHERE user_id = ?;
  `).run(user.id);

  // Create Session
  const token = createSession(user.id);

  return {
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      displayName: user.display_name,
      displayNameTa: user.display_name_ta,
      avatar: sanitizeAvatar(user.avatar),
      activityStatusEnabled: user.is_enabled === 1,
      isOnline: true
    }
  };
}

export function getUserByToken(token) {
  if (!token) return null;
  const db = getDb();

  const session = db.prepare(`
    SELECT s.user_id, s.expires_at,
           u.id, u.username, u.email, u.role,
           p.display_name, p.display_name_ta, p.avatar, p.bio, p.bio_ta, p.title, p.title_ta, p.joined_date,
           p.posts_count, p.topics_count, p.followers_count,
           a.is_enabled, a.is_online, a.last_seen
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP;
  `).get(token);

  if (!session) return null;

  // Touch session activity
  db.prepare(`
    UPDATE activity_status
    SET is_online = 1, last_seen = CURRENT_TIMESTAMP
    WHERE user_id = ?;
  `).run(session.id);

  return {
    id: session.id,
    username: session.username,
    email: session.email,
    role: session.role,
    displayName: session.display_name,
    displayNameTa: session.display_name_ta,
    avatar: sanitizeAvatar(session.avatar),
    bio: session.bio,
    bioTa: session.bio_ta,
    title: session.title,
    titleTa: session.title_ta,
    joinedDate: session.joined_date,
    postsCount: session.posts_count || 0,
    topicsCount: session.topics_count || 0,
    followersCount: session.followers_count || 0,
    activityStatusEnabled: session.is_enabled === 1,
    isOnline: session.is_online === 1,
    lastSeen: session.last_seen
  };
}

export function logoutUser(token) {
  if (!token) return { success: true };
  const db = getDb();

  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?;').get(token);
  if (session) {
    db.prepare(`
      UPDATE activity_status
      SET is_online = 0, last_seen = CURRENT_TIMESTAMP
      WHERE user_id = ?;
    `).run(session.user_id);

    db.prepare('DELETE FROM sessions WHERE token = ?;').run(token);
  }

  return { success: true };
}

export function setActivityStatus(userId, enabled) {
  const db = getDb();
  const val = enabled ? 1 : 0;
  db.prepare(`
    UPDATE activity_status
    SET is_enabled = ?
    WHERE user_id = ?;
  `).run(val, userId);

  return { success: true, activityStatusEnabled: val === 1 };
}

export function touchHeartbeat(userId) {
  const db = getDb();
  db.prepare(`
    UPDATE activity_status
    SET is_online = 1, last_seen = CURRENT_TIMESTAMP
    WHERE user_id = ?;
  `).run(userId);
  return { success: true };
}

export function getAllMembersWithStatus(viewerUserId = null) {
  const db = getDb();
  const members = db.prepare(`
    SELECT u.id, u.username, u.role,
           p.display_name, p.display_name_ta, p.avatar, p.bio, p.bio_ta, p.title, p.title_ta, p.joined_date,
           p.posts_count, p.topics_count, p.followers_count,
           a.is_enabled, a.is_online, a.last_seen,
           (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > CURRENT_TIMESTAMP) as active_sessions
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    ORDER BY u.id ASC;
  `).all();

  return members.map(m => {
    const isSelf = viewerUserId && viewerUserId === m.id;
    const isPrivacyEnabled = m.is_enabled === 1;

    // Real online status: User must have an active unexpired session AND activity_status is_online === 1
    const reallyOnline = (m.active_sessions > 0) && (m.is_online === 1);
    const canViewStatus = isSelf || isPrivacyEnabled;

    return {
      id: m.id,
      username: m.username,
      role: m.role,
      displayName: m.display_name,
      displayNameTa: m.display_name_ta,
      avatar: sanitizeAvatar(m.avatar),
      bio: m.bio,
      bioTa: m.bio_ta,
      title: m.title,
      titleTa: m.title_ta,
      joinedDate: m.joined_date,
      postsCount: m.posts_count || 0,
      topicsCount: m.topics_count || 0,
      followersCount: m.followers_count || 0,
      activityStatusEnabled: m.is_enabled === 1,
      isOnline: canViewStatus ? reallyOnline : false,
      lastSeen: canViewStatus ? m.last_seen : null,
      statusHidden: !canViewStatus
    };
  });
}

function createSession(userId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?);
  `).run(token, userId, expiresAt);

  return token;
}

/**
 * 1. Request Password Reset OTP
 * Checks registered account, enforces rate limiting, generates secure 6-digit OTP,
 * stores salted hash in SQLite, and dispatches email from trendup089@gmail.com
 */
export async function requestPasswordResetOtp(rawEmail) {
  const db = getDb();
  const cleanEmail = (rawEmail || '').trim().toLowerCase();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return {
      success: false,
      error: 'Please enter a valid registered email address.',
      errorTa: 'சரியான பதிவு செய்யப்பட்ட மின்னஞ்சல் முகவரியை உள்ளிடவும்.'
    };
  }

  // 1. Verify that the email belongs to a registered account
  const user = db.prepare('SELECT id, username, email FROM users WHERE email = ?;').get(cleanEmail);
  if (!user) {
    return {
      success: false,
      error: 'No registered account found with this email address.',
      errorTa: 'இந்த மின்னஞ்சல் முகவரியில் பதிவு செய்யப்பட்ட கணக்கு எதுவும் இல்லை.'
    };
  }

  // 2. Check Rate Limiting: Max 5 requests in last 15 minutes per email
  const recentCountRow = db.prepare(`
    SELECT COUNT(*) as count FROM password_resets 
    WHERE email = ? AND created_at > datetime('now', '-15 minutes');
  `).get(cleanEmail);
  if (recentCountRow && recentCountRow.count >= 5) {
    return {
      success: false,
      error: 'Too many OTP requests. Please wait 15 minutes before trying again.',
      errorTa: 'அதிக முறை முயற்சிக்கப்பட்டது. 15 நிமிடங்கள் கழித்து மீண்டும் முயற்சிக்கவும்.'
    };
  }

  // 3. Check Resend Cooldown: 60 seconds
  const activeRecord = db.prepare(`
    SELECT resend_after FROM password_resets 
    WHERE email = ? AND used = 0 
    ORDER BY id DESC LIMIT 1;
  `).get(cleanEmail);

  if (activeRecord) {
    const resendAfterTime = new Date(activeRecord.resend_after).getTime();
    const nowTime = Date.now();
    if (resendAfterTime > nowTime) {
      const remainingSeconds = Math.ceil((resendAfterTime - nowTime) / 1000);
      return {
        success: false,
        error: `Please wait ${remainingSeconds}s before requesting a new OTP.`,
        errorTa: `புதிய OTP-ஐக் கோருவதற்கு முன் ${remainingSeconds} வினாடிகள் காத்திருக்கவும்.`,
        cooldownSeconds: remainingSeconds
      };
    }
  }

  // 4. Invalidate any previous unverified OTPs for this user
  db.prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0;').run(user.id);

  // 5. Generate secure 6-digit OTP and cryptographically hash with salt
  const otp = crypto.randomInt(100000, 1000000).toString();
  const { hash, salt } = hashPassword(otp);

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes expiry
  const resendAfter = new Date(Date.now() + 60 * 1000).toISOString();   // 60s cooldown

  db.prepare(`
    INSERT INTO password_resets (user_id, email, otp_hash, otp_salt, attempts, max_attempts, expires_at, resend_after, used)
    VALUES (?, ?, ?, ?, 0, 5, ?, ?, 0);
  `).run(user.id, user.email, hash, salt, expiresAt, resendAfter);

  // 6. Send email via SMTP (trendup089@gmail.com)
  const emailResult = await sendOtpEmail({
    to: user.email,
    username: user.username,
    otp
  });

  if (!emailResult.delivered) {
    db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used = 0;').run(user.id);
    return {
      success: false,
      error: `Could not send OTP email (${emailResult.error || 'SMTP delivery error'}). Please try again.`,
      errorTa: `மின்னஞ்சல் அனுப்புவதில் பிழை ஏற்பட்டது (${emailResult.error || 'SMTP பிழை'}). தயவுசெய்து மீண்டும் முயற்சிக்கவும்.`
    };
  }

  return {
    success: true,
    email: user.email,
    expiresInSeconds: 300,
    cooldownSeconds: 60,
    emailDelivered: true,
    message: 'A 6-digit OTP has been sent to your registered email address.',
    messageTa: 'உங்கள் பதிவுசெய்யப்பட்ட மின்னஞ்சலுக்கு 6 இலக்க OTP அனுப்பப்பட்டுள்ளது.'
  };
}

/**
 * 2. Verify 6-digit OTP
 * Validates expiration (5 min), max attempts (5), and hashes
 */
export function verifyPasswordResetOtp(rawEmail, rawOtp) {
  const db = getDb();
  const cleanEmail = (rawEmail || '').trim().toLowerCase();
  const cleanOtp = (rawOtp || '').toString().trim().replace(/\D/g, '');

  if (!cleanEmail || !cleanOtp || cleanOtp.length !== 6) {
    return {
      success: false,
      error: 'Please enter the complete 6-digit OTP code.',
      errorTa: 'முழுமையான 6 இலக்க OTP குறியீட்டை உள்ளிடவும்.'
    };
  }

  // Find latest active reset record
  const record = db.prepare(`
    SELECT * FROM password_resets 
    WHERE email = ? AND used = 0 
    ORDER BY id DESC LIMIT 1;
  `).get(cleanEmail);

  if (!record) {
    return {
      success: false,
      error: 'No active OTP request found. Please request a new code.',
      errorTa: 'செயலில் உள்ள OTP கோரிக்கை இல்லை. புதிய குறியீட்டைக் கோரவும்.'
    };
  }

  // Check 5-minute expiry
  const expiresAt = new Date(record.expires_at).getTime();
  if (Date.now() > expiresAt) {
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?;').run(record.id);
    return {
      success: false,
      expired: true,
      error: 'OTP code has expired (valid for 5 minutes). Please request a new one.',
      errorTa: 'OTP குறியீடு காலாவதியாகிவிட்டது (5 நிமிடங்கள் மட்டுமே). புதிய OTP-ஐக் கோரவும்.'
    };
  }

  // Check maximum attempts limit
  if (record.attempts >= record.max_attempts) {
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?;').run(record.id);
    return {
      success: false,
      maxAttemptsReached: true,
      error: 'Maximum verification attempts exceeded. Please request a new OTP.',
      errorTa: 'அதிகபட்ச சரிபார்ப்பு முயற்சிகள் கடந்துவிட்டன. புதிய OTP-ஐக் கோரவும்.'
    };
  }

  // Verify OTP hash
  const isValid = verifyPassword(cleanOtp, record.otp_hash, record.otp_salt);
  if (!isValid) {
    const updatedAttempts = record.attempts + 1;
    db.prepare('UPDATE password_resets SET attempts = ? WHERE id = ?;').run(updatedAttempts, record.id);
    const remaining = Math.max(0, record.max_attempts - updatedAttempts);

    if (remaining === 0) {
      db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?;').run(record.id);
      return {
        success: false,
        maxAttemptsReached: true,
        error: 'Incorrect OTP. Maximum attempts reached. Please request a new OTP.',
        errorTa: 'தவறான OTP. அதிகபட்ச முயற்சிகள் முடிவடைந்தன. புதிய OTP-ஐக் கோரவும்.'
      };
    }

    return {
      success: false,
      remainingAttempts: remaining,
      error: `Invalid OTP code. ${remaining} attempt(s) remaining.`,
      errorTa: `தவறான OTP குறியீடு. இன்னும் ${remaining} முயற்சி(கள்) உள்ளன.`
    };
  }

  // OTP is valid! Generate one-time reset token for password entry step
  const resetToken = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE password_resets SET reset_token = ?, attempts = attempts + 1 WHERE id = ?;').run(resetToken, record.id);

  return {
    success: true,
    resetToken,
    email: record.email,
    message: 'OTP verified successfully. Please enter your new password.',
    messageTa: 'OTP வெற்றிகரமாக சரிபார்க்கப்பட்டது. புதிய கடவுச்சொல்லை உள்ளிடவும்.'
  };
}

/**
 * 3. Resend OTP
 * Applies 60-second cooldown and rate limiting
 */
export async function resendPasswordResetOtp(rawEmail) {
  return await requestPasswordResetOtp(rawEmail);
}

/**
 * 4. Complete Password Reset
 * Validates new password strength, securely updates password in database,
 * and immediately invalidates the OTP and reset token
 */
export function completePasswordReset(rawEmail, resetToken, newPassword, confirmPassword) {
  const db = getDb();
  const cleanEmail = (rawEmail || '').trim().toLowerCase();

  if (!cleanEmail || !resetToken) {
    return {
      success: false,
      error: 'Invalid password reset session. Please request a new OTP.',
      errorTa: 'தவறான மீட்டமைப்பு அமர்வு. புதிய OTP-ஐக் கோரவும்.'
    };
  }

  if (!newPassword || newPassword.length < 6) {
    return {
      success: false,
      error: 'New password must be at least 6 characters long.',
      errorTa: 'புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள் கொண்டதாக இருக்க வேண்டும்.'
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      success: false,
      error: 'Passwords do not match.',
      errorTa: 'கடவுச்சொற்கள் பொருந்தவில்லை.'
    };
  }

  // Verify the active reset record with this reset token
  const record = db.prepare(`
    SELECT * FROM password_resets 
    WHERE email = ? AND reset_token = ? AND used = 0 
    ORDER BY id DESC LIMIT 1;
  `).get(cleanEmail, resetToken);

  if (!record) {
    return {
      success: false,
      error: 'Password reset link or session has expired. Please restart the process.',
      errorTa: 'மீட்டமைப்பு அமர்வு காலாவதியானது. மீண்டும் தொடங்கவும்.'
    };
  }

  // Check 5-minute expiry
  if (Date.now() > new Date(record.expires_at).getTime()) {
    db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?;').run(record.id);
    return {
      success: false,
      error: 'Session expired. Please request a new OTP.',
      errorTa: 'அமர்வு காலாவதியாகிவிட்டது. புதிய OTP-ஐக் கோரவும்.'
    };
  }

  // Hash new password securely
  const { hash, salt } = hashPassword(newPassword);

  // Update password in users table
  db.prepare(`
    UPDATE users 
    SET password_hash = ?, salt = ? 
    WHERE id = ?;
  `).run(hash, salt, record.user_id);

  // Invalidate OTP and reset token immediately (Prevent OTP and token reuse)
  db.prepare(`
    UPDATE password_resets 
    SET used = 1, reset_token = NULL 
    WHERE id = ?;
  `).run(record.id);

  // Invalidate all active sessions for that user for security
  db.prepare('DELETE FROM sessions WHERE user_id = ?;').run(record.user_id);

  return {
    success: true,
    email: record.email,
    message: 'Your password has been successfully reset! You can now log in.',
    messageTa: 'உங்கள் கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது! இப்போது உள்நுழையலாம்.'
  };
}

