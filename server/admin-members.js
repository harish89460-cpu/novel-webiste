// Admin Member Management Service & Security Access Control Module
// Rudhra Prarthana Novels — MySQL 8.0 Relational Architecture
// Provides secure admin account creation, OTP-less password reset, profile editing,
// temporary blocking with auto-expiry, unblocking, permanent account deletion with safety confirmation,
// granular feature permissions management, session revocation, and security audit logging.

import crypto from 'node:crypto';
import { query, queryOne, getDb, hashPassword } from './db.js';
import { sanitizeAvatar } from './auth.js';

// Sensitive keys that must NEVER be written to audit logs or API responses
const SENSITIVE_KEYS = new Set([
  'password', 'password_hash', 'salt', 'token', 'otp', 'otp_hash', 
  'otp_salt', 'reset_token', 'secret', 'auth_token', 'rp_auth_token'
]);

/**
 * Sanitize metadata object to strip any sensitive credentials
 */
function sanitizeAuditMetadata(meta) {
  if (!meta || typeof meta !== 'object') return null;
  const clean = {};
  for (const [k, v] of Object.entries(meta)) {
    if (!SENSITIVE_KEYS.has(k.toLowerCase())) {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Record a security-critical administrative audit log entry
 */
export async function recordAdminAudit({
  adminId,
  targetUserId = null,
  action,
  status = 'success',
  details = '',
  metadata = null,
  ipAddress = null,
  userAgent = null
}) {
  try {
    const cleanMeta = sanitizeAuditMetadata(metadata);
    await query(`
      INSERT INTO admin_audit_logs (
        admin_id, target_user_id, action, status, details, metadata, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP);
    `, [
      adminId,
      targetUserId,
      action,
      status,
      details,
      cleanMeta ? JSON.stringify(cleanMeta) : null,
      ipAddress,
      userAgent ? String(userAgent).substring(0, 250) : null
    ]);
  } catch (err) {
    console.warn('[Admin Audit Log Error]:', err.message);
  }
}

/**
 * Retrieve administrative audit logs with filtering and pagination
 */
export async function getAdminAuditLogs({
  targetUserId = null,
  action = null,
  limit = 50,
  offset = 0
} = {}) {
  let sql = `
    SELECT 
      l.id, l.admin_id, l.target_user_id, l.action, l.status, l.details, l.metadata,
      l.ip_address, l.user_agent, l.created_at,
      a.username AS admin_username, pa.display_name AS admin_display_name,
      t.username AS target_username, t.email AS target_email, pt.display_name AS target_display_name
    FROM admin_audit_logs l
    LEFT JOIN users a ON l.admin_id = a.id
    LEFT JOIN profiles pa ON a.id = pa.user_id
    LEFT JOIN users t ON l.target_user_id = t.id
    LEFT JOIN profiles pt ON t.id = pt.user_id
    WHERE 1=1
  `;
  const params = [];

  if (targetUserId) {
    sql += ' AND l.target_user_id = ?';
    params.push(Number(targetUserId));
  }
  if (action && action.trim() && action !== 'all') {
    sql += ' AND l.action = ?';
    params.push(action.trim());
  }

  sql += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?;';
  params.push(Number(limit), Number(offset));

  const rows = await query(sql, params);
  const totalRow = await queryOne('SELECT COUNT(*) AS total FROM admin_audit_logs;');

  return {
    success: true,
    total: Number(totalRow?.total || 0),
    logs: rows.map(r => ({
      id: r.id,
      adminId: r.admin_id,
      adminName: r.admin_display_name || r.admin_username || `Admin #${r.admin_id}`,
      targetUserId: r.target_user_id,
      targetName: r.target_display_name || r.target_username || (r.target_user_id ? `Member #${r.target_user_id}` : 'System'),
      targetEmail: r.target_email || null,
      action: r.action,
      status: r.status,
      details: r.details || '',
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || null),
      ipAddress: r.ip_address,
      createdAt: r.created_at
    }))
  };
}

/**
 * Default permission set for a given role
 */
export function getDefaultPermissions(role = 'Member') {
  const r = (role || '').toLowerCase();
  if (r === 'admin' || r === 'administrator' || r === 'author') {
    return {
      can_comment: true,
      can_post_forum: true,
      can_chat: true,
      can_access_audio: true,
      can_publish_novels: true
    };
  }
  if (r === 'writer') {
    return {
      can_comment: true,
      can_post_forum: true,
      can_chat: true,
      can_access_audio: true,
      can_publish_novels: true
    };
  }
  return {
    can_comment: true,
    can_post_forum: true,
    can_chat: true,
    can_access_audio: true,
    can_publish_novels: false
  };
}

/**
 * Retrieve all registered members with real KPI metrics, search, filtering, and pagination
 */
export async function getMembersList({
  search = '',
  status = 'all',
  role = 'all',
  dateFilter = 'all',
  sortBy = 'created_at',
  sortOrder = 'DESC',
  page = 1,
  limit = 25
} = {}) {
  // 1. Auto-expire any temporary blocks whose expiration has passed
  try {
    await query(`
      UPDATE users 
      SET status = 'active', blocked_until = NULL, blocked_at = NULL, block_reason = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE status = 'blocked' AND blocked_until IS NOT NULL AND blocked_until <= NOW();
    `);
  } catch (err) {
    console.warn('[Auto-expire Block Warning]:', err.message);
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const offset = (pageNum - 1) * pageSize;

  // 2. Real Database KPI Metrics
  const metricsRow = await queryOne(`
    SELECT
      COUNT(*) AS total_members,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_members,
      SUM(CASE WHEN status = 'blocked' AND (blocked_until IS NOT NULL AND blocked_until > NOW()) THEN 1 ELSE 0 END) AS temp_blocked_members,
      SUM(CASE WHEN status IN ('suspended', 'disabled') OR (status = 'blocked' AND blocked_until IS NULL) THEN 1 ELSE 0 END) AS inactive_members,
      SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS recently_registered,
      SUM(CASE WHEN role = 'writer' THEN 1 ELSE 0 END) AS total_writers
    FROM users;
  `);

  const onlineRow = await queryOne(`
    SELECT COUNT(*) AS online_count
    FROM activity_status
    WHERE is_online = 1 AND is_enabled = 1;
  `);

  const metrics = {
    totalMembers: Number(metricsRow?.total_members || 0),
    activeMembers: Number(metricsRow?.active_members || 0),
    tempBlockedMembers: Number(metricsRow?.temp_blocked_members || 0),
    inactiveMembers: Number(metricsRow?.inactive_members || 0),
    recentlyRegistered: Number(metricsRow?.recently_registered || 0),
    totalWriters: Number(metricsRow?.total_writers || 0),
    onlineNow: Number(onlineRow?.online_count || 0)
  };

  // 3. Build Query with Parameterized Filters
  let whereClauses = ['1=1'];
  const params = [];

  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    const numId = parseInt(search.trim(), 10);
    if (!isNaN(numId) && String(numId) === search.trim()) {
      whereClauses.push('(u.id = ? OR LOWER(u.username) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(p.display_name) LIKE ?)');
      params.push(numId, term, term, term);
    } else {
      whereClauses.push('(LOWER(u.username) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(p.display_name) LIKE ?)');
      params.push(term, term, term);
    }
  }

  if (status && status !== 'all') {
    if (status === 'temporarily_blocked' || status === 'temp_blocked') {
      whereClauses.push('(u.status = "blocked" AND u.blocked_until IS NOT NULL AND u.blocked_until > NOW())');
    } else if (status === 'blocked') {
      whereClauses.push('(u.status = "blocked" AND (u.blocked_until IS NULL OR u.blocked_until > NOW()))');
    } else if (status === 'expired') {
      whereClauses.push('(u.status = "blocked" AND u.blocked_until IS NOT NULL AND u.blocked_until <= NOW())');
    } else {
      whereClauses.push('u.status = ?');
      params.push(status);
    }
  }

  if (role && role !== 'all') {
    if (role.toLowerCase() === 'admin') {
      whereClauses.push("(LOWER(u.role) = 'admin' OR LOWER(u.role) = 'administrator' OR LOWER(u.role) = 'author')");
    } else if (role.toLowerCase() === 'writer') {
      whereClauses.push("LOWER(u.role) = 'writer'");
    } else if (role.toLowerCase() === 'member') {
      whereClauses.push("(LOWER(u.role) = 'member' OR LOWER(u.role) = 'reader' OR u.role IS NULL)");
    } else {
      whereClauses.push('LOWER(u.role) = ?');
      params.push(role.toLowerCase());
    }
  }

  if (dateFilter && dateFilter !== 'all') {
    if (dateFilter === '7d') {
      whereClauses.push('u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
    } else if (dateFilter === '30d') {
      whereClauses.push('u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)');
    } else if (dateFilter === '90d') {
      whereClauses.push('u.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)');
    } else if (dateFilter === 'year') {
      whereClauses.push('u.created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)');
    }
  }

  const whereSql = whereClauses.join(' AND ');

  // Total matching records
  const countRow = await queryOne(`
    SELECT COUNT(*) AS total
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE ${whereSql};
  `, params);
  const total = Number(countRow?.total || 0);

  // Sorting validation
  const safeSortOrder = (sortOrder || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  let safeSortCol = 'u.created_at';
  if (sortBy === 'name') safeSortCol = 'COALESCE(p.display_name, u.username)';
  else if (sortBy === 'email') safeSortCol = 'u.email';
  else if (sortBy === 'last_login') safeSortCol = 'u.last_login';
  else if (sortBy === 'id') safeSortCol = 'u.id';

  // 4. Fetch Members Page
  const selectParams = [...params, pageSize, offset];
  const rows = await query(`
    SELECT 
      u.id, u.username, u.email, u.role, u.status, u.email_verified,
      u.blocked_until, u.blocked_at, u.block_reason, u.permissions,
      u.created_at, u.updated_at, u.last_login,
      p.display_name, p.avatar, p.title, p.bio,
      a.is_online, a.is_enabled AS activity_status_enabled, a.last_seen,
      a.is_reading, a.current_novel_id, a.current_chapter_num, a.reading_duration_seconds,
      a.last_read_novel_id, a.last_read_chapter_num, a.last_read_at, a.last_read_duration_seconds,
      (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > NOW()) AS active_sessions_count
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    WHERE ${whereSql}
    ORDER BY ${safeSortCol} ${safeSortOrder}
    LIMIT ? OFFSET ?;
  `, selectParams);

  const now = new Date();

  return {
    success: true,
    metrics,
    total,
    page: pageNum,
    limit: pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    members: rows.map(r => {
      let computedStatus = r.status || 'active';
      let remainingText = null;
      let isTemporarilyBlocked = false;

      if (r.status === 'blocked') {
        if (r.blocked_until) {
          const expiryDate = new Date(r.blocked_until);
          if (expiryDate > now) {
            computedStatus = 'temporarily_blocked';
            isTemporarilyBlocked = true;
            const diffMs = expiryDate.getTime() - now.getTime();
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const days = Math.floor(hours / 24);
            remainingText = days > 0 ? `${days}d ${hours % 24}h remaining` : `${Math.max(1, hours)}h remaining`;
          } else {
            computedStatus = 'expired';
          }
        } else {
          computedStatus = 'blocked';
        }
      }

      let parsedPerms = null;
      try {
        parsedPerms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions;
      } catch {}
      const effectivePerms = { ...getDefaultPermissions(r.role), ...(parsedPerms || {}) };

      return {
        id: r.id,
        username: r.username,
        email: r.email,
        displayName: r.display_name || r.username,
        avatar: sanitizeAvatar(r.avatar),
        title: r.title || r.role || 'Member',
        bio: r.bio || '',
        role: r.role || 'Member',
        status: r.status || 'active',
        computedStatus,
        isTemporarilyBlocked,
        remainingText,
        blockedUntil: r.blocked_until,
        blockedAt: r.blocked_at,
        blockReason: r.block_reason || null,
        permissions: effectivePerms,
        emailVerified: Boolean(r.email_verified),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        lastLogin: r.last_login,
        activeSessionsCount: Number(r.active_sessions_count || 0),
        isOnline: Boolean(r.is_online),
        activityStatusEnabled: Boolean(r.activity_status_enabled),
        lastSeen: r.last_seen,
        isReading: Boolean(r.is_reading),
        currentNovelId: r.current_novel_id,
        lastReadNovelId: r.last_read_novel_id
      };
    })
  };
}

/**
 * Retrieve comprehensive details for a single member account
 */
export async function getMemberDetails(memberId) {
  const row = await queryOne(`
    SELECT 
      u.id, u.username, u.email, u.role, u.status, u.email_verified,
      u.blocked_until, u.blocked_at, u.block_reason, u.permissions,
      u.created_at, u.updated_at, u.last_login, u.created_by,
      p.display_name, p.avatar, p.title, p.bio, p.joined_date,
      p.posts_count, p.topics_count, p.followers_count,
      a.is_online, a.is_enabled AS activity_status_enabled, a.last_seen,
      a.is_reading, a.current_novel_id, a.current_chapter_num, a.reading_duration_seconds,
      a.last_read_novel_id, a.last_read_chapter_num, a.last_read_at, a.last_read_duration_seconds,
      (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > NOW()) AS active_sessions_count,
      (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comments_count,
      (SELECT COUNT(*) FROM likes l WHERE l.user_id = u.id) AS likes_count
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    WHERE u.id = ?;
  `, [memberId]);

  if (!row) return null;

  let currentReadingNovel = null;
  if (row.current_novel_id) {
    const novel = await queryOne('SELECT title, cover FROM novels WHERE id = ?;', [row.current_novel_id]);
    if (novel) {
      currentReadingNovel = {
        id: row.current_novel_id,
        title: novel.title,
        cover: novel.cover,
        chapterNum: row.current_chapter_num,
        durationSeconds: row.reading_duration_seconds || 0
      };
    }
  }

  let lastReadNovel = null;
  if (row.last_read_novel_id) {
    const novel = await queryOne('SELECT title, cover FROM novels WHERE id = ?;', [row.last_read_novel_id]);
    if (novel) {
      lastReadNovel = {
        id: row.last_read_novel_id,
        title: novel.title,
        cover: novel.cover,
        chapterNum: row.last_read_chapter_num,
        lastReadAt: row.last_read_at,
        durationSeconds: row.last_read_duration_seconds || 0
      };
    }
  }

  // Retrieve security audit history for this specific member
  const auditLogs = await query(`
    SELECT 
      l.id, l.admin_id, l.action, l.status, l.details, l.created_at,
      a.username AS admin_username, pa.display_name AS admin_display_name
    FROM admin_audit_logs l
    LEFT JOIN users a ON l.admin_id = a.id
    LEFT JOIN profiles pa ON a.id = pa.user_id
    WHERE l.target_user_id = ?
    ORDER BY l.created_at DESC
    LIMIT 20;
  `, [memberId]);

  let parsedPerms = null;
  try {
    parsedPerms = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
  } catch {}
  const effectivePerms = { ...getDefaultPermissions(row.role), ...(parsedPerms || {}) };

  const now = new Date();
  let computedStatus = row.status || 'active';
  if (row.status === 'blocked') {
    if (row.blocked_until) {
      computedStatus = new Date(row.blocked_until) > now ? 'temporarily_blocked' : 'expired';
    } else {
      computedStatus = 'blocked';
    }
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name || row.username,
    avatar: sanitizeAvatar(row.avatar),
    title: row.title || row.role || 'Member',
    bio: row.bio || '',
    joinedDate: row.joined_date || '',
    role: row.role || 'Member',
    status: row.status || 'active',
    computedStatus,
    blockedUntil: row.blocked_until,
    blockedAt: row.blocked_at,
    blockReason: row.block_reason || null,
    permissions: effectivePerms,
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLogin: row.last_login,
    createdBy: row.created_by,
    activeSessionsCount: Number(row.active_sessions_count || 0),
    commentsCount: Number(row.comments_count || 0),
    likesCount: Number(row.likes_count || 0),
    postsCount: Number(row.posts_count || 0),
    topicsCount: Number(row.topics_count || 0),
    followersCount: Number(row.followers_count || 0),
    isOnline: Boolean(row.is_online),
    activityStatusEnabled: Boolean(row.activity_status_enabled),
    lastSeen: row.last_seen,
    isReading: Boolean(row.is_reading),
    currentReading: currentReadingNovel,
    lastRead: lastReadNovel,
    auditHistory: auditLogs.map(l => ({
      id: l.id,
      adminId: l.admin_id,
      adminName: l.admin_display_name || l.admin_username || `Admin #${l.admin_id}`,
      action: l.action,
      status: l.status,
      details: l.details,
      createdAt: l.created_at
    }))
  };
}

/**
 * Administrative Creation of a Member Account
 */
export async function createMemberAccount({
  displayName,
  username = '',
  email,
  password,
  confirmPassword = null,
  role = 'Member',
  status = 'active',
  adminId = 2,
  ipAddress = null,
  userAgent = null
}) {
  const cleanName = (displayName || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Full Member Name is required (minimum 2 characters).' };
  }

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'A valid email address is required.' };
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  if (confirmPassword !== null && confirmPassword !== undefined && cleanPassword !== String(confirmPassword).trim()) {
    return { success: false, error: 'Initial password and confirm password do not match.' };
  }

  const existingEmail = await queryOne('SELECT id, username FROM users WHERE LOWER(email) = ?;', [cleanEmail]);
  if (existingEmail) {
    return { success: false, error: `An account with email "${cleanEmail}" already exists (Username: ${existingEmail.username}).` };
  }

  let cleanUsername = (username || '').trim().toLowerCase();
  if (cleanUsername) {
    cleanUsername = cleanUsername.replace(/[^a-z0-9_]/g, '_').slice(0, 30);
    if (cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 alphanumeric characters or underscores.' };
    }
    const taken = await queryOne('SELECT id FROM users WHERE LOWER(username) = ?;', [cleanUsername]);
    if (taken) {
      return { success: false, error: `The username "${cleanUsername}" is already taken.` };
    }
  } else {
    let base = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 25);
    if (!base || base.length < 3) {
      base = cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 25);
    }
    cleanUsername = base;
    let suffix = 1;
    while (await queryOne('SELECT id FROM users WHERE LOWER(username) = ?;', [cleanUsername])) {
      cleanUsername = `${base}_${suffix}`;
      suffix++;
    }
  }

  let safeRole = 'Member';
  if (String(role).toLowerCase() === 'writer') {
    safeRole = 'writer';
  } else if (String(role).toLowerCase() === 'admin' && Number(adminId) === 2) {
    safeRole = 'Admin';
  }

  const allowedStatuses = ['active', 'blocked', 'suspended', 'disabled'];
  const safeStatus = allowedStatuses.includes(status) ? status : 'active';

  const { hash, salt } = hashPassword(cleanPassword);

  const userRes = await query(`
    INSERT INTO users (
      username, email, password_hash, salt, role, status, email_verified, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  `, [cleanUsername, cleanEmail, hash, salt, safeRole, safeStatus, adminId]);

  const newUserId = userRes.insertId;

  const joinedDate = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  await query(`
    INSERT INTO profiles (
      user_id, display_name, display_name_ta, avatar, bio, bio_ta, title, title_ta, joined_date,
      posts_count, topics_count, followers_count
    ) VALUES (?, ?, ?, ?, '', '', ?, ?, ?, 0, 0, 0);
  `, [newUserId, cleanName, cleanName, '/profile.png', safeRole, safeRole, joinedDate]);

  await query(`
    INSERT INTO activity_status (user_id, is_enabled, is_online, last_seen)
    VALUES (?, 1, 0, CURRENT_TIMESTAMP);
  `, [newUserId]);

  await recordAdminAudit({
    adminId,
    targetUserId: newUserId,
    action: 'member_created',
    status: 'success',
    details: `Admin created member account "${cleanName}" (${cleanEmail}) with role "${safeRole}" and status "${safeStatus}".`,
    metadata: {
      memberId: newUserId,
      username: cleanUsername,
      email: cleanEmail,
      role: safeRole,
      status: safeStatus
    },
    ipAddress,
    userAgent
  });

  return {
    success: true,
    message: `Member account for "${cleanName}" created successfully.`,
    member: {
      id: newUserId,
      username: cleanUsername,
      email: cleanEmail,
      displayName: cleanName,
      role: safeRole,
      status: safeStatus,
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Update member details (Name, Username, Email, Role, Status, Bio)
 */
export async function updateMemberDetails({
  memberId,
  displayName,
  username,
  email,
  role,
  status,
  bio,
  title,
  adminId = 2,
  ipAddress = null,
  userAgent = null
}) {
  const existing = await queryOne(`
    SELECT u.id, u.username, u.email, u.role, u.status, p.display_name, p.bio, p.title
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE u.id = ?;
  `, [memberId]);

  if (!existing) {
    return { success: false, error: 'Member account not found.' };
  }

  // Security Protection: Protect primary Author & Administrator account
  const isPrimaryAdmin = Number(memberId) === 2 || 
    existing.email === 'digitalmarkservices.in@gmail.com' || 
    existing.username === 'rudhra_author';

  if (isPrimaryAdmin) {
    if (status && status !== 'active') {
      return { success: false, error: 'The primary Author & Administrator account cannot be disabled, suspended, or blocked.' };
    }
    if (role && !['admin', 'administrator', 'author'].includes(String(role).toLowerCase())) {
      return { success: false, error: 'The primary Author & Administrator account cannot be demoted.' };
    }
  }

  const userUpdates = [];
  const userParams = [];
  const profileUpdates = [];
  const profileParams = [];
  const changes = {};

  if (email !== undefined && email !== null) {
    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (cleanEmail !== existing.email.toLowerCase()) {
      const emailTaken = await queryOne('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?;', [cleanEmail, memberId]);
      if (emailTaken) {
        return { success: false, error: `Email address "${cleanEmail}" is already registered to another account.` };
      }
      userUpdates.push('email = ?');
      userParams.push(cleanEmail);
      changes.email = { from: existing.email, to: cleanEmail };
    }
  }

  if (username !== undefined && username !== null) {
    const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return { success: false, error: 'Username must be between 3 and 30 characters.' };
    }
    if (cleanUsername !== existing.username.toLowerCase()) {
      const usernameTaken = await queryOne('SELECT id FROM users WHERE LOWER(username) = ? AND id != ?;', [cleanUsername, memberId]);
      if (usernameTaken) {
        return { success: false, error: `Username "${cleanUsername}" is already taken.` };
      }
      userUpdates.push('username = ?');
      userParams.push(cleanUsername);
      changes.username = { from: existing.username, to: cleanUsername };
    }
  }

  if (role !== undefined && role !== null && !isPrimaryAdmin) {
    const cleanRole = String(role).trim();
    if (['Member', 'writer', 'Admin'].includes(cleanRole) && cleanRole !== existing.role) {
      userUpdates.push('role = ?');
      userParams.push(cleanRole);
      changes.role = { from: existing.role, to: cleanRole };
    }
  }

  let statusChangedToInactive = false;
  if (status !== undefined && status !== null && !isPrimaryAdmin) {
    const allowed = ['active', 'blocked', 'suspended', 'disabled'];
    if (allowed.includes(status) && status !== existing.status) {
      userUpdates.push('status = ?');
      userParams.push(status);
      changes.status = { from: existing.status, to: status };
      if (status !== 'active') {
        statusChangedToInactive = true;
      }
    }
  }

  if (displayName !== undefined && displayName !== null) {
    const cleanName = String(displayName).trim();
    if (cleanName && cleanName !== existing.display_name) {
      profileUpdates.push('display_name = ?', 'display_name_ta = ?');
      profileParams.push(cleanName, cleanName);
      changes.displayName = { from: existing.display_name, to: cleanName };
    }
  }

  if (bio !== undefined && bio !== null) {
    const cleanBio = String(bio).trim();
    if (cleanBio !== (existing.bio || '')) {
      profileUpdates.push('bio = ?', 'bio_ta = ?');
      profileParams.push(cleanBio, cleanBio);
      changes.bio = 'updated';
    }
  }

  if (title !== undefined && title !== null) {
    const cleanTitle = String(title).trim();
    if (cleanTitle !== (existing.title || '')) {
      profileUpdates.push('title = ?', 'title_ta = ?');
      profileParams.push(cleanTitle, cleanTitle);
      changes.title = { from: existing.title, to: cleanTitle };
    }
  }

  if (userUpdates.length > 0) {
    userUpdates.push('updated_at = CURRENT_TIMESTAMP');
    userParams.push(memberId);
    await query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?;`, userParams);
  }

  if (profileUpdates.length > 0) {
    profileParams.push(memberId);
    await query(`UPDATE profiles SET ${profileUpdates.join(', ')} WHERE user_id = ?;`, profileParams);
  }

  if (statusChangedToInactive) {
    await query('DELETE FROM sessions WHERE user_id = ?;', [memberId]);
    try {
      await query('DELETE FROM user_presence WHERE session_key = ?;', [`member_${memberId}`]);
    } catch {}
  }

  await recordAdminAudit({
    adminId,
    targetUserId: memberId,
    action: 'member_updated',
    status: 'success',
    details: `Admin updated account details for member "${existing.username}" (${existing.email}). Changes: ${Object.keys(changes).join(', ') || 'No fields altered'}.`,
    metadata: {
      memberId,
      changes,
      sessionsRevoked: statusChangedToInactive
    },
    ipAddress,
    userAgent
  });

  return {
    success: true,
    message: 'Member account details updated successfully.',
    changes
  };
}

/**
 * Admin-Only Password Reset WITHOUT Member OTP Verification
 */
export async function adminResetMemberPassword({
  memberId,
  newPassword,
  confirmPassword = null,
  adminId = 2,
  ipAddress = null,
  userAgent = null
}) {
  const cleanPassword = (newPassword || '').trim();

  if (!cleanPassword || cleanPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  if (confirmPassword !== null && confirmPassword !== undefined && cleanPassword !== String(confirmPassword).trim()) {
    return { success: false, error: 'New password and confirm password do not match.' };
  }

  const member = await queryOne('SELECT id, username, email FROM users WHERE id = ?;', [memberId]);
  if (!member) {
    return { success: false, error: 'Member account not found.' };
  }

  const { hash, salt } = hashPassword(cleanPassword);

  await query(`
    UPDATE users 
    SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?;
  `, [hash, salt, memberId]);

  const sessionRes = await query('DELETE FROM sessions WHERE user_id = ?;', [memberId]);
  const revokedCount = sessionRes?.affectedRows || 0;

  try {
    await query('DELETE FROM password_resets WHERE user_id = ? OR email = ?;', [memberId, member.email]);
  } catch {}

  await recordAdminAudit({
    adminId,
    targetUserId: memberId,
    action: 'password_reset',
    status: 'success',
    details: `Admin completed password reset for member "${member.username}" (${member.email}) without member OTP. Active sessions revoked: ${revokedCount}.`,
    metadata: {
      memberId,
      email: member.email,
      username: member.username,
      sessionsRevoked: revokedCount,
      resetMethod: 'admin_direct_no_otp'
    },
    ipAddress,
    userAgent
  });

  return {
    success: true,
    message: `Password reset successfully for "${member.username}". ${revokedCount} active session(s) were terminated.`,
    revokedSessionsCount: revokedCount
  };
}

/**
 * Temporarily Block Member with Duration, Reason, and Session Revocation
 */
export async function temporarilyBlockMember({
  memberId,
  duration = '24h',
  customExpiry = null,
  reason = '',
  adminId = 2,
  ipAddress = null,
  userAgent = null
}) {
  if (Number(memberId) === 2) {
    return { success: false, error: 'The primary Author & Administrator account cannot be blocked.' };
  }
  if (Number(memberId) === Number(adminId)) {
    return { success: false, error: 'You cannot block your own administrative account.' };
  }

  const member = await queryOne('SELECT id, username, email, role, status FROM users WHERE id = ?;', [memberId]);
  if (!member) {
    return { success: false, error: 'Member account not found.' };
  }

  const isTargetAdmin = ['admin', 'administrator', 'author'].includes((member.role || '').toLowerCase());
  if (isTargetAdmin && Number(adminId) !== 2) {
    return { success: false, error: 'Only the primary Author/Superadmin can block an administrator account.' };
  }

  let blockedUntil = null;
  const now = new Date();

  if (duration === '1h') {
    blockedUntil = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  } else if (duration === '24h') {
    blockedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (duration === '3d') {
    blockedUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  } else if (duration === '7d') {
    blockedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (duration === '30d') {
    blockedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  } else if (duration === 'custom' && customExpiry) {
    const parsedCustom = new Date(customExpiry);
    if (isNaN(parsedCustom.getTime()) || parsedCustom <= now) {
      return { success: false, error: 'Custom expiration time must be a valid future date and time.' };
    }
    blockedUntil = parsedCustom;
  } else if (duration === 'indefinite' || duration === 'manual') {
    blockedUntil = null;
  } else {
    // Default 24 hours
    blockedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  const blockedUntilFormatted = blockedUntil 
    ? blockedUntil.toISOString().slice(0, 19).replace('T', ' ')
    : null;

  const cleanReason = (reason || '').trim();

  await query(`
    UPDATE users 
    SET status = 'blocked', blocked_at = CURRENT_TIMESTAMP, blocked_until = ?, block_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `, [blockedUntilFormatted, cleanReason || null, memberId]);

  // Terminate all active sessions immediately
  const sessionRes = await query('DELETE FROM sessions WHERE user_id = ?;', [memberId]);
  const revokedSessions = sessionRes?.affectedRows || 0;
  try {
    await query('DELETE FROM user_presence WHERE session_key = ?;', [`member_${memberId}`]);
  } catch {}

  const durationLabel = blockedUntil 
    ? `until ${blockedUntil.toLocaleString()}` 
    : 'indefinitely until manually unblocked';

  await recordAdminAudit({
    adminId,
    targetUserId: memberId,
    action: 'temporary_block',
    status: 'success',
    details: `Admin temporarily blocked member "${member.username}" (${member.email}) ${durationLabel}. Reason: ${cleanReason || 'Administrative enforcement'}. Revoked ${revokedSessions} active session(s).`,
    metadata: {
      memberId,
      username: member.username,
      duration,
      blockedUntil: blockedUntilFormatted,
      reason: cleanReason || null,
      revokedSessions
    },
    ipAddress,
    userAgent
  });

  return {
    success: true,
    message: `Account for "${member.username}" has been blocked ${durationLabel}.`,
    blockedUntil: blockedUntilFormatted,
    revokedSessions
  };
}

/**
 * Early Unblock Member Account
 */
export async function unblockMember({
  memberId,
  reason = '',
  adminId = 2,
  ipAddress = null,
  userAgent = null
}) {
  const member = await queryOne('SELECT id, username, email, status, blocked_until FROM users WHERE id = ?;', [memberId]);
  if (!member) {
    return { success: false, error: 'Member account not found.' };
  }

  if (member.status === 'active') {
    return { success: true, message: `Account "${member.username}" is already active.` };
  }

  await query(`
    UPDATE users 
    SET status = 'active', blocked_until = NULL, blocked_at = NULL, block_reason = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `, [memberId]);

  const cleanReason = (reason || '').trim();

  await recordAdminAudit({
    adminId,
    targetUserId: memberId,
    action: 'member_unblocked',
    status: 'success',
    details: `Admin unblocked account for "${member.username}" (${member.email}). Account access fully restored. Reason: ${cleanReason || 'Administrative unblock'}.`,
    metadata: {
      memberId,
      username: member.username,
      previousStatus: member.status,
      previousBlockedUntil: member.blocked_until,
      reason: cleanReason || null
    },
    ipAddress,
    userAgent
  });

  return {
    success: true,
    message: `Member account for "${member.username}" has been unblocked and restored to Active status.`
  };
}

/**
 * Toggle Member Access Status (Active, Suspended, Disabled, Blocked)
 */
export async function toggleMemberStatus({
  memberId,
  status,
  reason = '',
  adminId = 2,
  ipAddress = null,
  userAgent = null
}) {
  if (status === 'blocked') {
    return temporarilyBlockMember({
      memberId,
      duration: 'indefinite',
      reason,
      adminId,
      ipAddress,
      userAgent
    });
  }
  if (status === 'active') {
    return unblockMember({
      memberId,
      reason,
      adminId,
      ipAddress,
      userAgent
    });
  }

  const allowed = ['suspended', 'disabled'];
  if (!allowed.includes(status)) {
    return { success: false, error: 'Invalid account status specified.' };
  }

  if (Number(memberId) === 2) {
    return { success: false, error: 'The primary Author & Administrator account cannot be suspended or disabled.' };
  }
  if (Number(memberId) === Number(adminId)) {
    return { success: false, error: 'You cannot alter the status of your own administrator account.' };
  }

  const member = await queryOne('SELECT id, username, email, status FROM users WHERE id = ?;', [memberId]);
  if (!member) {
    return { success: false, error: 'Member account not found.' };
  }

  await query(`
    UPDATE users 
    SET status = ?, blocked_until = NULL, blocked_at = NULL, block_reason = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?;
  `, [status, reason.trim() || null, memberId]);

  const res = await query('DELETE FROM sessions WHERE user_id = ?;', [memberId]);
  const revokedSessions = res?.affectedRows || 0;
  try {
    await query('DELETE FROM user_presence WHERE session_key = ?;', [`member_${memberId}`]);
  } catch {}

  await recordAdminAudit({
    adminId,
    targetUserId: memberId,
    action: `account_${status}`,
    status: 'success',
    details: `Admin changed account status for "${member.username}" to "${status}". Reason: ${reason || 'Administrative action'}. Revoked ${revokedSessions} active session(s).`,
    metadata: {
      memberId,
      previousStatus: member.status,
      newStatus: status,
      reason: reason || null,
      revokedSessions
    },
    ipAddress,
    userAgent
  });

  return {
    success: true,
    status,
    message: `Member account for "${member.username}" has been marked as "${status}".`,
    revokedSessionsCount: revokedSessions
  };
}

/**
 * Permanently Delete Member Account with Explicit Confirmation and Safe Cascades
 */
export async function permanentlyDeleteMember({
  memberId,
  confirmationText = '',
  reason = '',
  adminId = 2,
  ipAddress = null,
  userAgent = null
}) {
  const numMemberId = Number(memberId);
  const numAdminId = Number(adminId);

  // 1. Critical Account Protections
  if (numMemberId === 2) {
    return { success: false, error: 'CRITICAL PROTECTION: The primary Author & Administrator account cannot be deleted under any circumstances.' };
  }

  if (numMemberId === numAdminId) {
    return { success: false, error: 'CRITICAL PROTECTION: You cannot delete your own administrative account.' };
  }

  const member = await queryOne(`
    SELECT id, username, email, role, created_at
    FROM users 
    WHERE id = ?;
  `, [numMemberId]);

  if (!member) {
    return { success: false, error: 'Member account not found.' };
  }

  const isTargetAdmin = ['admin', 'administrator', 'author'].includes((member.role || '').toLowerCase());
  if (isTargetAdmin && numAdminId !== 2) {
    return { success: false, error: 'CRITICAL PROTECTION: Only the primary Author/Superadmin can delete an administrator account.' };
  }

  // 2. Explicit Confirmation Check (Must match username, email, or exact uppercase 'DELETE')
  const cleanConfirm = String(confirmationText).trim().toLowerCase();
  const validConfirms = [
    member.username.toLowerCase(),
    member.email.toLowerCase(),
    'delete',
    `#${member.id}`
  ];

  if (!validConfirms.includes(cleanConfirm)) {
    return { 
      success: false, 
      error: `Confirmation mismatch. You must explicitly type "${member.username}" to authorize permanent deletion.` 
    };
  }

  // 3. Execute Transactional Deletion
  const pool = getDb();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Invalidate sessions & presence
    await conn.query('DELETE FROM sessions WHERE user_id = ?;', [numMemberId]);
    await conn.query('DELETE FROM user_presence WHERE session_key = ?;', [`member_${numMemberId}`]);

    // Delete profiles & activity
    await conn.query('DELETE FROM profiles WHERE user_id = ?;', [numMemberId]);
    await conn.query('DELETE FROM activity_status WHERE user_id = ?;', [numMemberId]);
    await conn.query('DELETE FROM push_subscriptions WHERE user_id = ?;', [numMemberId]);
    await conn.query('DELETE FROM reading_progress WHERE user_id = ?;', [numMemberId]);
    await conn.query('DELETE FROM reading_sessions WHERE user_id = ?;', [numMemberId]);
    await conn.query('DELETE FROM notification_preferences WHERE user_id = ?;', [numMemberId]);
    await conn.query('DELETE FROM chat_settings WHERE user_id = ?;', [numMemberId]);
    await conn.query('DELETE FROM chat_locks WHERE user_id = ? OR target_user_id = ?;', [numMemberId, numMemberId]);
    await conn.query('DELETE FROM conversation_participants WHERE user_id = ?;', [numMemberId]);

    // Anonymize forum topic last reply author references so forum integrity is preserved
    await conn.query('UPDATE forum_topics SET last_reply_author_id = NULL WHERE last_reply_author_id = ?;', [numMemberId]);

    // Finally delete the user record
    await conn.query('DELETE FROM users WHERE id = ?;', [numMemberId]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    console.error('[Permanent Deletion Error]:', err);
    return { success: false, error: `Failed to delete account due to a database error: ${err.message}` };
  } finally {
    conn.release();
  }

  // 4. Record Security Audit Log
  const cleanReason = (reason || '').trim();
  await recordAdminAudit({
    adminId,
    targetUserId: numMemberId,
    action: 'account_deleted',
    status: 'success',
    details: `Admin permanently deleted account for member "${member.username}" (${member.email}, ID: #${numMemberId}). Reason: ${cleanReason || 'Administrative permanent account deletion'}.`,
    metadata: {
      deletedMemberId: numMemberId,
      username: member.username,
      email: member.email,
      role: member.role,
      accountCreatedAt: member.created_at,
      reason: cleanReason || null
    },
    ipAddress,
    userAgent
  });

  return {
    success: true,
    message: `Account for "${member.username}" (#${numMemberId}) has been permanently deleted.`
  };
}

/**
 * Retrieve Granular Feature Permissions for a Member
 */
export async function getMemberPermissions(memberId) {
  const member = await queryOne('SELECT id, username, email, role, permissions FROM users WHERE id = ?;', [memberId]);
  if (!member) return null;

  let stored = null;
  try {
    stored = typeof member.permissions === 'string' ? JSON.parse(member.permissions) : member.permissions;
  } catch {}

  const defaults = getDefaultPermissions(member.role);
  const effective = { ...defaults, ...(stored || {}) };

  return {
    memberId: member.id,
    username: member.username,
    role: member.role,
    permissions: effective
  };
}

/**
 * Update Granular Feature Permissions for a Member
 */
export async function updateMemberPermissions({
  memberId,
  permissions = {},
  revokeSessions = false,
  adminId = 2,
  ipAddress = null,
  userAgent = null
}) {
  const numMemberId = Number(memberId);
  const numAdminId = Number(adminId);

  const member = await queryOne('SELECT id, username, email, role, permissions FROM users WHERE id = ?;', [numMemberId]);
  if (!member) {
    return { success: false, error: 'Member account not found.' };
  }

  if (numMemberId === 2) {
    return { success: false, error: 'The primary Author & Administrator permissions cannot be modified.' };
  }

  const isTargetAdmin = ['admin', 'administrator', 'author'].includes((member.role || '').toLowerCase());
  if (isTargetAdmin && numAdminId !== 2) {
    return { success: false, error: 'Only the primary Author/Superadmin can modify an administrator permissions.' };
  }

  const cleanPerms = {
    can_comment: Boolean(permissions.can_comment !== false),
    can_post_forum: Boolean(permissions.can_post_forum !== false),
    can_chat: Boolean(permissions.can_chat !== false),
    can_access_audio: Boolean(permissions.can_access_audio !== false),
    can_publish_novels: Boolean(permissions.can_publish_novels === true)
  };

  await query(`
    UPDATE users 
    SET permissions = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?;
  `, [JSON.stringify(cleanPerms), numMemberId]);

  let revokedCount = 0;
  if (revokeSessions) {
    const res = await query('DELETE FROM sessions WHERE user_id = ?;', [numMemberId]);
    revokedCount = res?.affectedRows || 0;
  }

  await recordAdminAudit({
    adminId,
    targetUserId: numMemberId,
    action: 'permissions_updated',
    status: 'success',
    details: `Admin updated feature access permissions for "${member.username}". Active sessions revoked: ${revokedCount}. Permissions: Comment=${cleanPerms.can_comment}, Forum=${cleanPerms.can_post_forum}, Chat=${cleanPerms.can_chat}, Audio=${cleanPerms.can_access_audio}, Novels=${cleanPerms.can_publish_novels}.`,
    metadata: {
      memberId: numMemberId,
      permissions: cleanPerms,
      sessionsRevoked: revokedCount
    },
    ipAddress,
    userAgent
  });

  return {
    success: true,
    message: `Permissions updated successfully for "${member.username}".`,
    permissions: cleanPerms,
    revokedSessionsCount: revokedCount
  };
}

/**
 * Revoke All Active Sessions for a Member Account
 */
export async function revokeMemberSessions({
  memberId,
  adminId = 2,
  ipAddress = null,
  userAgent = null
}) {
  const member = await queryOne('SELECT id, username, email FROM users WHERE id = ?;', [memberId]);
  if (!member) {
    return { success: false, error: 'Member account not found.' };
  }

  const res = await query('DELETE FROM sessions WHERE user_id = ?;', [memberId]);
  const count = res?.affectedRows || 0;

  try {
    await query('DELETE FROM user_presence WHERE session_key = ?;', [`member_${memberId}`]);
  } catch {}

  await recordAdminAudit({
    adminId,
    targetUserId: memberId,
    action: 'sessions_revoked',
    status: 'success',
    details: `Admin manually revoked all active sessions for member "${member.username}" (${member.email}). Terminated ${count} session(s).`,
    metadata: {
      memberId,
      revokedCount: count
    },
    ipAddress,
    userAgent
  });

  return {
    success: true,
    message: `Terminated ${count} active session(s) for "${member.username}".`,
    revokedCount: count
  };
}
