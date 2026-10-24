// Writer Management & Writer Workspace Service
// Rudhra Prarthana Novels — Pure MySQL Integration

import { query, queryOne, hashPassword, verifyPassword } from './db.js';
import { sanitizeAvatar } from './auth.js';
import { createNotification } from './notifications.js';

/**
 * Record an audit log event for writer account activity
 */
export async function recordWriterAudit({ writerId = null, actorId = null, action, details = null }) {
  try {
    await query(`
      INSERT INTO writer_audit_logs (writer_id, actor_id, action, details, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP);
    `, [writerId, actorId, action, details]);
  } catch (err) {
    console.warn('[Writer Audit Log Error]:', err.message);
  }
}

/**
 * Retrieve audit logs for administrative review
 */
export async function getWriterAuditLogs(writerId = null, limit = 50) {
  let sql = `
    SELECT 
      l.id, l.writer_id, l.actor_id, l.action, l.details, l.created_at,
      w.username AS writer_username, pw.display_name AS writer_display_name,
      a.username AS actor_username, pa.display_name AS actor_display_name
    FROM writer_audit_logs l
    LEFT JOIN users w ON l.writer_id = w.id
    LEFT JOIN profiles pw ON w.id = pw.user_id
    LEFT JOIN users a ON l.actor_id = a.id
    LEFT JOIN profiles pa ON a.id = pa.user_id
  `;
  const params = [];
  if (writerId) {
    sql += ' WHERE l.writer_id = ?';
    params.push(writerId);
  }
  sql += ' ORDER BY l.created_at DESC LIMIT ?;';
  params.push(limit);

  const rows = await query(sql, params);
  return rows.map(r => ({
    id: r.id,
    writerId: r.writer_id,
    writerName: r.writer_display_name || r.writer_username || `Writer #${r.writer_id}`,
    actorId: r.actor_id,
    actorName: r.actor_display_name || r.actor_username || 'System',
    action: r.action,
    details: r.details || '',
    createdAt: r.created_at
  }));
}

/**
 * Create a new Writer account (Admin authorized only)
 */
export async function createWriterAccount({
  fullName,
  email,
  password,
  avatar = null,
  createdByActorId = 2
}) {
  const cleanName = (fullName || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();

  if (!cleanName) {
    return { success: false, error: "Writer's full name is required." };
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'A valid email address is required.' };
  }
  if (!cleanPassword || cleanPassword.length < 6) {
    return { success: false, error: 'Initial password must be at least 6 characters long.' };
  }

  // Check email uniqueness constraint in users table
  const existingUser = await queryOne('SELECT id, email, username FROM users WHERE LOWER(email) = ?;', [cleanEmail]);
  if (existingUser) {
    return { success: false, error: `An account with email "${cleanEmail}" already exists (Username: ${existingUser.username}).` };
  }

  // Generate unique username from name or email
  let baseUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  if (!baseUsername || baseUsername.length < 3) {
    baseUsername = cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  }
  let finalUsername = baseUsername;
  let suffix = 1;
  while (await queryOne('SELECT id FROM users WHERE LOWER(username) = ?;', [finalUsername])) {
    finalUsername = `${baseUsername}_${suffix}`;
    suffix++;
  }

  // Cryptographically hash password with salt
  const { hash, salt } = hashPassword(cleanPassword);

  // Insert user with role 'writer' and status 'active'
  const userRes = await query(`
    INSERT INTO users (username, email, password_hash, salt, role, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'writer', 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  `, [finalUsername, cleanEmail, hash, salt, createdByActorId]);

  const newUserId = userRes.insertId;

  // Insert corresponding profile
  await query(`
    INSERT INTO profiles (user_id, display_name, avatar, title, joined_date)
    VALUES (?, ?, ?, 'Author & Writer', DATE_FORMAT(NOW(), '%M %Y'));
  `, [newUserId, cleanName, sanitizeAvatar(avatar)]);

  // Initialize activity status
  await query(`
    INSERT INTO activity_status (user_id, is_enabled, is_online, last_seen)
    VALUES (?, 1, 0, CURRENT_TIMESTAMP);
  `, [newUserId]);

  // Record audit log
  await recordWriterAudit({
    writerId: newUserId,
    actorId: createdByActorId,
    action: 'account_created',
    details: `Writer account "${cleanName}" (${cleanEmail}) created by Admin.`
  });

  // Notify new writer account
  await createNotification({
    userId: newUserId,
    actorId: createdByActorId,
    type: 'account_event',
    title: 'Writer Privileges Granted',
    message: 'Congratulations! Your account has been assigned Writer privileges on Rudhra Prarthana Novels.',
    link: '#writer',
    entityType: 'account',
    entityId: newUserId
  }).catch(() => {});

  return {
    success: true,
    message: 'Writer account created successfully.',
    writer: {
      id: newUserId,
      username: finalUsername,
      email: cleanEmail,
      displayName: cleanName,
      role: 'writer',
      status: 'active',
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Retrieve all writer accounts with aggregated novel and episode metrics
 */
export async function getAllWriters({ search = '', status = '' } = {}) {
  let sql = `
    SELECT 
      u.id, u.username, u.email, u.status, u.role, u.created_by, u.last_login, u.created_at,
      p.display_name, p.avatar, p.bio, p.title,
      (SELECT COUNT(*) FROM novels n WHERE n.author_id = u.id) AS novels_count,
      (SELECT COUNT(*) FROM chapters c JOIN novels n ON c.novel_id = n.id WHERE n.author_id = u.id AND c.status = 'published') AS published_episodes_count,
      (SELECT COUNT(*) FROM chapters c JOIN novels n ON c.novel_id = n.id WHERE n.author_id = u.id) AS total_episodes_count,
      (SELECT COALESCE(SUM(CAST(n.views AS UNSIGNED)), 0) FROM novels n WHERE n.author_id = u.id) AS total_views
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE u.role = 'writer'
  `;
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND u.status = ?';
    params.push(status);
  }

  if (search && search.trim()) {
    const term = `%${search.trim().toLowerCase()}%`;
    sql += ' AND (LOWER(u.username) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(p.display_name) LIKE ?)';
    params.push(term, term, term);
  }

  sql += ' ORDER BY u.created_at DESC;';

  const rows = await query(sql, params);
  return rows.map(r => ({
    id: r.id,
    username: r.username,
    email: r.email,
    displayName: r.display_name || r.username,
    avatar: sanitizeAvatar(r.avatar),
    bio: r.bio || '',
    title: r.title || 'Writer',
    status: r.status || 'active',
    role: r.role || 'writer',
    novelsCount: Number(r.novels_count || 0),
    publishedEpisodesCount: Number(r.published_episodes_count || 0),
    totalEpisodesCount: Number(r.total_episodes_count || 0),
    totalViews: Number(r.total_views || 0),
    lastLogin: r.last_login,
    createdAt: r.created_at
  }));
}

/**
 * Retrieve single writer details with their assigned/created novels and audit history
 */
export async function getWriterDetails(writerId) {
  const user = await queryOne(`
    SELECT 
      u.id, u.username, u.email, u.status, u.role, u.created_by, u.last_login, u.created_at,
      p.display_name, p.avatar, p.bio, p.title
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE u.id = ? AND u.role = 'writer';
  `, [writerId]);

  if (!user) return null;

  // Retrieve novels owned by this writer
  const novels = await query(`
    SELECT id, title, genre, category, status, cover, chapters_count, views, rating, is_published, visibility, created_at
    FROM novels
    WHERE author_id = ?
    ORDER BY created_at DESC;
  `, [writerId]);

  // Retrieve recent audit history
  const auditLogs = await getWriterAuditLogs(writerId, 25);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name || user.username,
    avatar: sanitizeAvatar(user.avatar),
    bio: user.bio || '',
    title: user.title || 'Writer',
    status: user.status || 'active',
    role: user.role,
    lastLogin: user.last_login,
    createdAt: user.created_at,
    novels,
    novelsCount: novels.length,
    auditLogs
  };
}

/**
 * Update permitted writer profile information
 */
export async function updateWriterProfile({ writerId, displayName, bio, avatar, actorId = 2 }) {
  const existing = await queryOne('SELECT id, username FROM users WHERE id = ? AND role = "writer";', [writerId]);
  if (!existing) {
    return { success: false, error: 'Writer account not found.' };
  }

  const updates = [];
  const params = [];

  if (displayName !== undefined && String(displayName).trim()) {
    updates.push('display_name = ?');
    params.push(String(displayName).trim());
  }
  if (bio !== undefined) {
    updates.push('bio = ?');
    params.push(String(bio).trim());
  }
  if (avatar !== undefined) {
    updates.push('avatar = ?');
    params.push(sanitizeAvatar(avatar));
  }

  if (updates.length > 0) {
    params.push(writerId);
    await query(`UPDATE profiles SET ${updates.join(', ')} WHERE user_id = ?;`, params);
  }

  await recordWriterAudit({
    writerId,
    actorId,
    action: 'profile_updated',
    details: 'Writer profile details updated by administrator.'
  });

  return { success: true };
}

/**
 * Temporarily block or reactivate a writer account
 */
export async function setWriterStatus({ writerId, status, actorId = 2, reason = '' }) {
  if (!['active', 'blocked'].includes(status)) {
    return { success: false, error: 'Invalid status specified.' };
  }

  const existing = await queryOne('SELECT id, username, email, status FROM users WHERE id = ? AND role = "writer";', [writerId]);
  if (!existing) {
    return { success: false, error: 'Writer account not found.' };
  }

  // Update account status in MySQL
  await query('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;', [status, writerId]);

  if (status === 'blocked') {
    // Invalidate all active sessions for this blocked writer immediately
    await query('DELETE FROM sessions WHERE user_id = ?;', [writerId]);
    // Invalidate presence
    try {
      await query('DELETE FROM user_presence WHERE session_key = ?;', [`member_${writerId}`]);
    } catch {}
  }

  // Record audit log
  await recordWriterAudit({
    writerId,
    actorId,
    action: status === 'blocked' ? 'account_blocked' : 'account_reactivated',
    details: reason || (status === 'blocked' ? 'Writer account temporarily blocked by administrator.' : 'Writer account reactivated by administrator.')
  });

  return {
    success: true,
    status,
    message: status === 'blocked' 
      ? `Writer account for "${existing.username}" has been temporarily blocked and active sessions revoked.`
      : `Writer account for "${existing.username}" has been reactivated.`
  };
}

/**
 * Permanently delete a writer account safely with content preservation
 */
export async function deleteWriterAccount({ writerId, actorId = 2, reassignToId = 2 }) {
  // Guard against deleting admin account
  if (Number(writerId) === 2) {
    return { success: false, error: 'The primary Author & Administrator account cannot be deleted.' };
  }

  const writer = await queryOne('SELECT id, username, email FROM users WHERE id = ? AND role = "writer";', [writerId]);
  if (!writer) {
    return { success: false, error: 'Writer account not found or cannot be deleted.' };
  }

  // Preserve novels integrity: reassign owned novels to primary author (user_id = 2)
  const ownedNovels = await query('SELECT id, title FROM novels WHERE author_id = ?;', [writerId]);
  if (ownedNovels.length > 0) {
    await query('UPDATE novels SET author_id = ? WHERE author_id = ?;', [reassignToId, writerId]);
  }

  // Revoke all sessions and presence
  await query('DELETE FROM sessions WHERE user_id = ?;', [writerId]);
  try {
    await query('DELETE FROM user_presence WHERE session_key = ?;', [`member_${writerId}`]);
  } catch {}

  // Delete foreign records in profiles, activity_status, and users
  await query('DELETE FROM profiles WHERE user_id = ?;', [writerId]);
  await query('DELETE FROM activity_status WHERE user_id = ?;', [writerId]);
  await query('DELETE FROM users WHERE id = ?;', [writerId]);

  // Record audit log
  await recordWriterAudit({
    writerId: null,
    actorId,
    action: 'account_deleted',
    details: `Writer "${writer.username}" (${writer.email}) deleted. ${ownedNovels.length} novel(s) preserved and reassigned to Author ID ${reassignToId}.`
  });

  return {
    success: true,
    message: `Writer account "${writer.username}" deleted safely. Associated content reassigned to primary author.`,
    reassignedNovelsCount: ownedNovels.length
  };
}

/**
 * Retrieve statistics and novels for the authenticated writer's workspace
 */
export async function getWriterWorkspaceData(writerId) {
  const writer = await queryOne(`
    SELECT u.id, u.username, u.email, u.status, p.display_name, p.avatar, p.bio
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE u.id = ?;
  `, [writerId]);

  if (!writer) return null;

  const novels = await query(`
    SELECT 
      n.id, n.title, n.genre, n.category, n.status, n.badge, n.cover, n.description,
      n.chapters_count, n.views, n.rating, n.is_published, n.visibility, n.created_at, n.updated_at
    FROM novels n
    WHERE n.author_id = ?
    ORDER BY n.updated_at DESC;
  `, [writerId]);

  const episodes = await query(`
    SELECT 
      c.id, c.novel_id, c.chapter_num, c.episode_number, c.title, c.word_count, c.read_time,
      c.status, c.scheduled_at, c.published_at, c.created_at, c.updated_at,
      n.title AS novel_title
    FROM chapters c
    JOIN novels n ON c.novel_id = n.id
    WHERE n.author_id = ?
    ORDER BY c.novel_id, c.sort_order ASC;
  `, [writerId]);

  const draftNovels = novels.filter(n => n.visibility === 'draft' || !n.is_published);
  const publishedNovels = novels.filter(n => n.visibility === 'public' && n.is_published === 1);
  const draftEpisodes = episodes.filter(e => e.status === 'draft');
  const publishedEpisodes = episodes.filter(e => e.status === 'published');
  const scheduledCount = episodes.filter(e => e.status === 'scheduled').length;
  const totalViews = novels.reduce((acc, n) => acc + (parseInt(n.views, 10) || 0), 0);

  return {
    writer: {
      id: writer.id,
      username: writer.username,
      email: writer.email,
      displayName: writer.display_name || writer.username,
      avatar: sanitizeAvatar(writer.avatar),
      status: writer.status
    },
    stats: {
      novelsCount: novels.length,
      draftsCount: draftNovels.length + draftEpisodes.length,
      draftNovelsCount: draftNovels.length,
      draftEpisodesCount: draftEpisodes.length,
      publishedNovelsCount: publishedNovels.length,
      episodesCount: episodes.length,
      publishedEpisodesCount: publishedEpisodes.length,
      publishedCount: publishedEpisodes.length,
      scheduledCount,
      totalViews
    },
    novels,
    recentEpisodes: episodes.slice(0, 10)
  };
}
