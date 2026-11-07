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
 * Retrieve all writer accounts with aggregated metrics, access types, permission statuses, and assigned content
 */
export async function getAllWriters({ search = '', status = '' } = {}) {
  let sql = `
    SELECT 
      u.id, u.username, u.email, u.status, u.role, u.created_by, u.last_login, u.created_at,
      p.display_name, p.avatar, p.bio, p.title,
      wp.access_type, wp.permission_status, wp.full_access, wp.can_publish_independently,
      wp.can_schedule, wp.can_novels, wp.can_short_stories, wp.can_audio_novels, wp.can_episodes,
      wp.access_level,
      (SELECT COUNT(*) FROM content_articles ca WHERE ca.author_id = u.id) AS novels_count,
      (SELECT COUNT(*) FROM content_articles ca WHERE ca.author_id = u.id AND ca.status = 'published') AS published_episodes_count,
      (SELECT COUNT(*) FROM content_articles ca WHERE ca.author_id = u.id) AS total_episodes_count,
      (SELECT COALESCE(SUM(CAST(ca.views_count AS UNSIGNED)), 0) FROM content_articles ca WHERE ca.author_id = u.id) AS total_views
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN writer_permissions wp ON u.id = wp.writer_id
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

  // Fetch all active assignments for writers
  const allAssignments = await query(`
    SELECT id, writer_id, content_type, content_id, title, instructions, deadline, status, actions, created_at
    FROM writer_assignments
    WHERE status = 'active'
    ORDER BY created_at DESC;
  `);

  return rows.map(r => {
    const rawAccess = r.access_type || (r.full_access ? 'full' : 'particular');
    const isFull = (rawAccess === 'full' || Boolean(r.full_access));
    const permissionStatus = r.permission_status || 'active';
    const writerAssigns = allAssignments
      .filter(a => Number(a.writer_id) === Number(r.id))
      .map(a => ({
        id: a.id,
        contentType: a.content_type,
        contentId: a.content_id,
        title: a.title,
        instructions: a.instructions || '',
        deadline: a.deadline,
        status: a.status,
        actions: (a.actions || 'create,edit,submit,publish,schedule').split(',').map(s => s.trim()).filter(Boolean)
      }));

    return {
      id: r.id,
      username: r.username,
      email: r.email,
      displayName: r.display_name || r.username,
      avatar: sanitizeAvatar(r.avatar),
      bio: r.bio || '',
      title: r.title || 'Writer',
      status: r.status || 'active',
      role: r.role || 'writer',
      accessType: isFull ? 'full' : 'particular',
      permissionStatus: permissionStatus,
      fullAccess: isFull ? 1 : 0,
      canPublishIndependently: isFull ? 1 : Number(r.can_publish_independently || (r.access_level === 'independent_publish' ? 1 : 0)),
      canSchedule: isFull ? 1 : Number(r.can_schedule || (r.access_level === 'independent_publish' ? 1 : 0)),
      canNovels: isFull ? 1 : Number(r.can_novels !== undefined ? r.can_novels : 1),
      canShortStories: isFull ? 1 : Number(r.can_short_stories || 0),
      canAudioNovels: isFull ? 1 : Number(r.can_audio_novels || 0),
      canEpisodes: isFull ? 1 : Number(r.can_episodes !== undefined ? r.can_episodes : 1),
      accessLevel: isFull ? 'independent_publish' : (r.access_level || 'review_required'),
      assignedContent: writerAssigns,
      novelsCount: Number(r.novels_count || 0),
      publishedEpisodesCount: Number(r.published_episodes_count || 0),
      totalEpisodesCount: Number(r.total_episodes_count || 0),
      totalViews: Number(r.total_views || 0),
      lastLogin: r.last_login,
      createdAt: r.created_at
    };
  });
}

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

  // Retrieve articles owned by this writer
  const novels = await query(`
    SELECT id, title, unique_slug, status, is_published, visibility, created_at, views_count AS views
    FROM content_articles
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

  // Preserve articles integrity: reassign owned articles to primary author (user_id = 2)
  const ownedArticles = await query('SELECT id, title FROM content_articles WHERE author_id = ?;', [writerId]);
  if (ownedArticles.length > 0) {
    await query('UPDATE content_articles SET author_id = ? WHERE author_id = ?;', [reassignToId, writerId]);
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
    details: `Writer "${writer.username}" (${writer.email}) deleted. ${ownedArticles.length} article(s) preserved and reassigned to Author ID ${reassignToId}.`
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

  const assignments = await query(`
    SELECT * FROM writer_assignments WHERE writer_id = ? ORDER BY created_at DESC;
  `, [writerId]);

  const submissions = await query(`
    SELECT * FROM writer_submissions WHERE writer_id = ? ORDER BY submitted_at DESC;
  `, [writerId]);

  const articles = await query(`
    SELECT id, unique_slug, title, status, is_published, created_at, updated_at
    FROM content_articles
    WHERE author_id = ?
    ORDER BY updated_at DESC;
  `, [writerId]);

  const activeAssignments = (assignments || []).filter(a => a.status === 'active');
  const pendingSubmissions = (submissions || []).filter(s => s.status === 'pending_review');
  const changesRequested = (submissions || []).filter(s => s.status === 'changes_requested');

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
      assignmentsCount: activeAssignments.length,
      submissionsCount: (submissions || []).length,
      pendingSubmissionsCount: pendingSubmissions.length,
      changesRequestedCount: changesRequested.length,
      articlesCount: (articles || []).length
    },
    assignments: assignments || [],
    submissions: submissions || [],
    articles: articles || []
  };
}


// ============================================================================
// WRITER PERMISSIONS, CONTENT ASSIGNMENTS & REVIEW SUBMISSIONS
// ============================================================================

/**
 * Get permissions for a writer
 */
export async function getWriterPermissions(writerId) {
  const row = await queryOne('SELECT * FROM writer_permissions WHERE writer_id = ?;', [writerId]);
  if (!row) {
    return {
      writerId,
      accessType: 'particular',
      permissionStatus: 'active',
      canNovels: 1,
      canShortStories: 0,
      canAudioNovels: 0,
      canEpisodes: 1,
      canPublishIndependently: 0,
      canSchedule: 0,
      canCreate: 1,
      canEdit: 1,
      canSubmit: 1,
      accessLevel: 'review_required',
      fullAccess: 0
    };
  }
  const isFull = (row.access_type === 'full' || Number(row.full_access) === 1);
  return {
    id: row.id,
    writerId: row.writer_id,
    accessType: isFull ? 'full' : (row.access_type || 'particular'),
    permissionStatus: row.permission_status || 'active',
    canNovels: isFull ? 1 : Number(row.can_novels !== undefined ? row.can_novels : 1),
    canShortStories: isFull ? 1 : Number(row.can_short_stories || 0),
    canAudioNovels: isFull ? 1 : Number(row.can_audio_novels || 0),
    canEpisodes: isFull ? 1 : Number(row.can_episodes !== undefined ? row.can_episodes : 1),
    canPublishIndependently: isFull ? 1 : Number(row.can_publish_independently || (row.access_level === 'independent_publish' ? 1 : 0)),
    canSchedule: isFull ? 1 : Number(row.can_schedule || (row.access_level === 'independent_publish' ? 1 : 0)),
    canCreate: isFull ? 1 : Number(row.can_create !== undefined ? row.can_create : 1),
    canEdit: isFull ? 1 : Number(row.can_edit !== undefined ? row.can_edit : 1),
    canSubmit: isFull ? 1 : Number(row.can_submit !== undefined ? row.can_submit : 1),
    accessLevel: isFull ? 'independent_publish' : (row.access_level || 'review_required'),
    fullAccess: isFull ? 1 : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Update permissions for a writer (Admin only)
 */
export async function updateWriterPermissions(writerId, {
  accessType = 'particular',
  permissionStatus = 'active',
  canNovels = 1,
  canShortStories = 0,
  canAudioNovels = 0,
  canEpisodes = 1,
  canPublishIndependently = 0,
  canSchedule = 0,
  canCreate = 1,
  canEdit = 1,
  canSubmit = 1,
  accessLevel = 'review_required',
  fullAccess = 0,
  actorId = 2
} = {}) {
  const isFull = (accessType === 'full' || Boolean(fullAccess));
  const finalAccessType = isFull ? 'full' : 'particular';
  const finalFullAccess = isFull ? 1 : 0;
  const finalIndependent = isFull ? 1 : (canPublishIndependently ? 1 : 0);
  const finalSchedule = isFull ? 1 : (canSchedule ? 1 : 0);
  const finalAccessLevel = isFull ? 'independent_publish' : (finalIndependent ? 'independent_publish' : (accessLevel || 'review_required'));
  const finalStatus = (permissionStatus === 'revoked' || permissionStatus === 'blocked') ? 'revoked' : 'active';

  await query(`
    INSERT INTO writer_permissions (
      writer_id, access_type, permission_status, can_publish_independently, can_schedule,
      can_create, can_edit, can_submit, can_novels, can_short_stories, can_audio_novels,
      can_episodes, access_level, full_access, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      access_type = VALUES(access_type),
      permission_status = VALUES(permission_status),
      can_publish_independently = VALUES(can_publish_independently),
      can_schedule = VALUES(can_schedule),
      can_create = VALUES(can_create),
      can_edit = VALUES(can_edit),
      can_submit = VALUES(can_submit),
      can_novels = VALUES(can_novels),
      can_short_stories = VALUES(can_short_stories),
      can_audio_novels = VALUES(can_audio_novels),
      can_episodes = VALUES(can_episodes),
      access_level = VALUES(access_level),
      full_access = VALUES(full_access),
      updated_at = CURRENT_TIMESTAMP;
  `, [
    writerId,
    finalAccessType,
    finalStatus,
    finalIndependent,
    finalSchedule,
    isFull ? 1 : (canCreate ? 1 : 0),
    isFull ? 1 : (canEdit ? 1 : 0),
    isFull ? 1 : (canSubmit ? 1 : 0),
    isFull ? 1 : (canNovels ? 1 : 0),
    isFull ? 1 : (canShortStories ? 1 : 0),
    isFull ? 1 : (canAudioNovels ? 1 : 0),
    isFull ? 1 : (canEpisodes ? 1 : 0),
    finalAccessLevel,
    finalFullAccess
  ]);

  await recordWriterAudit({
    writerId,
    actorId,
    action: 'permissions_updated',
    details: `Updated permissions: type=${finalAccessType}, status=${finalStatus}, independentPublish=${finalIndependent}, schedule=${finalSchedule}`
  });

  await createNotification({
    userId: writerId,
    actorId,
    type: 'permission_change',
    title: 'Writing Permissions Updated',
    message: isFull
      ? 'Your account has been granted Full Access across Rudhra Prarthana Novels.'
      : `Your permissions have been set to Particular Access (Independent Publishing: ${finalIndependent ? 'Enabled' : 'Disabled'}).`,
    link: '#writer'
  }).catch(() => {});

  return { 
    success: true, 
    message: isFull ? 'Full Access granted successfully.' : 'Particular Access permissions successfully saved.',
    accessType: finalAccessType,
    permissionStatus: finalStatus,
    fullAccess: finalFullAccess
  };
}

/**
 * Revoke writer access immediately (Admin only)
 */
export async function revokeWriterAccess(writerId, actorId = 2, reason = 'Writer access revoked by administrator.') {
  await query(`
    INSERT INTO writer_permissions (writer_id, access_type, permission_status, updated_at)
    VALUES (?, 'particular', 'revoked', CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      permission_status = 'revoked',
      updated_at = CURRENT_TIMESTAMP;
  `, [writerId]);

  await recordWriterAudit({
    writerId,
    actorId,
    action: 'access_revoked',
    details: reason
  });

  await createNotification({
    userId: writerId,
    actorId,
    type: 'permission_change',
    title: 'Writer Access Revoked',
    message: reason,
    link: '#writer'
  }).catch(() => {});

  return { success: true, message: 'Writer access has been revoked.' };
}

/**
 * Reactivate writer access (Admin only)
 */
export async function reactivateWriterAccess(writerId, actorId = 2) {
  await query(`
    UPDATE writer_permissions 
    SET permission_status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE writer_id = ?;
  `, [writerId]);

  await recordWriterAudit({
    writerId,
    actorId,
    action: 'access_reactivated',
    details: 'Writer permissions reactivated by administrator.'
  });

  return { success: true, message: 'Writer access reactivated successfully.' };
}

/**
 * Bulk update permissions for multiple writers
 */
export async function bulkUpdateWriterPermissions(writerIds = [], permissionsData = {}, actorId = 2) {
  if (!Array.isArray(writerIds) || writerIds.length === 0) {
    return { success: false, error: 'No writers specified for bulk update.' };
  }
  const results = [];
  for (const id of writerIds) {
    const res = await updateWriterPermissions(id, { ...permissionsData, actorId });
    results.push({ writerId: id, success: res.success });
  }
  return { success: true, updatedCount: results.length, results };
}

export async function getWriterAssignments(writerId, status = 'active') {
  let sql = `
    SELECT 
      a.id, a.writer_id, a.content_type, a.content_id, a.title, a.instructions,
      a.deadline, a.status, a.assigned_by, a.created_at, a.updated_at,
      u.username AS assigned_by_name
    FROM writer_assignments a
    LEFT JOIN users u ON a.assigned_by = u.id
    WHERE a.writer_id = ?
  `;
  const params = [writerId];
  if (status && status !== 'all') {
    sql += ' AND a.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY a.created_at DESC;';

  const rows = await query(sql, params);
  return rows.map(r => ({
    id: r.id,
    writerId: r.writer_id,
    contentType: r.content_type,
    contentId: r.content_id,
    title: r.title || `${r.content_type} #${r.content_id}`,
    instructions: r.instructions || '',
    deadline: r.deadline,
    status: r.status,
    assignedBy: r.assigned_by_name || 'Admin',
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

/**
 * Create or update a content assignment for a writer with configurable allowed actions
 */
export async function createWriterAssignment({
  writerId,
  contentType,
  contentId,
  title = null,
  instructions = null,
  deadline = null,
  actions = 'create,edit,submit,publish,schedule',
  assignedBy = 2
}) {
  const validTypes = ['main_category', 'sub_category', 'novel', 'short_story', 'audio_novel', 'chapter', 'episode'];
  if (!validTypes.includes(contentType)) {
    return { success: false, error: 'Invalid content type for assignment.' };
  }

  let contentTitle = title;
  if (!contentTitle) {
    if (contentType === 'main_category') {
      const cat = await queryOne('SELECT id, title FROM forum_categories WHERE id = ?;', [contentId, contentId]);
      contentTitle = cat ? (cat.title || cat.name) : `Category #${contentId}`;
    } else if (contentType === 'sub_category') {
      const sub = await queryOne('SELECT title FROM content_subcategories WHERE id = ?;', [contentId]);
      contentTitle = sub ? sub.title : `Subcategory #${contentId}`;
    } else if (contentType === 'article' || contentType === 'content_article' || contentType === 'novel') {
      const a = await queryOne('SELECT title FROM content_articles WHERE id = ?;', [contentId]);
      contentTitle = a ? a.title : `Article #${contentId}`;
    } else {
      contentTitle = `Content #${contentId}`;
    }
  }

  const actionsStr = Array.isArray(actions) ? actions.join(',') : (actions || 'create,edit,submit,publish,schedule');

  const res = await query(`
    INSERT INTO writer_assignments (writer_id, content_type, content_id, title, instructions, deadline, status, actions, assigned_by)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      instructions = VALUES(instructions),
      deadline = VALUES(deadline),
      status = 'active',
      actions = VALUES(actions),
      assigned_by = VALUES(assigned_by),
      updated_at = CURRENT_TIMESTAMP;
  `, [writerId, contentType, String(contentId), contentTitle, instructions, deadline || null, actionsStr, assignedBy]);

  const assignmentId = res.insertId || null;

  await recordWriterAudit({
    writerId,
    actorId: assignedBy,
    action: 'content_assigned',
    details: `Assigned ${contentType} "${contentTitle}" (ID: ${contentId}) with actions: [${actionsStr}].`
  });

  await createNotification({
    userId: writerId,
    actorId: assignedBy,
    type: 'assignment',
    title: 'New Content Assignment',
    message: `You have been assigned to: "${contentTitle}".`,
    link: '#writer?tab=assignments'
  }).catch(() => {});

  return { success: true, assignmentId, title: contentTitle, actions: actionsStr };
}

export async function updateWriterAssignmentStatus(assignmentId, status, actorId = 2) {
  if (!['active', 'completed', 'revoked'].includes(status)) {
    return { success: false, error: 'Invalid assignment status.' };
  }

  const existing = await queryOne('SELECT * FROM writer_assignments WHERE id = ?;', [assignmentId]);
  if (!existing) {
    return { success: false, error: 'Assignment not found.' };
  }

  await query('UPDATE writer_assignments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;', [status, assignmentId]);

  await recordWriterAudit({
    writerId: existing.writer_id,
    actorId,
    action: `assignment_${status}`,
    details: `Assignment #${assignmentId} (${existing.content_type} "${existing.title}") status changed to ${status}.`
  });

  return { success: true, status };
}

/**
 * Validate writer access to a specific piece of content based on Full Access or Particular Access permissions
 */
export async function canWriterAccessContent(writerId, contentType, contentId, requiredAction = 'read') {
  const perms = await getWriterPermissions(writerId);

  // 1. Check if writer permissions have been revoked
  if (perms.permissionStatus === 'revoked') {
    return {
      allowed: false,
      reason: 'Your writer privileges have been revoked by an administrator.'
    };
  }

  // 2. Full Access: writer can create, write, edit, publish, and schedule without admin approval
  if (perms.fullAccess === 1 || perms.accessType === 'full') {
    return {
      allowed: true,
      accessLevel: 'independent_publish',
      fullAccess: true,
      canPublishIndependently: true,
      canSchedule: true
    };
  }

  // View-only restriction check
  if (perms.accessLevel === 'view_only' && requiredAction !== 'read' && requiredAction !== 'view') {
    return { allowed: false, reason: 'Your account has view-only access.' };
  }

  // 3. Particular Access checks:
  const canIndependentPublish = Boolean(perms.canPublishIndependently || perms.accessLevel === 'independent_publish');
  const canSchedule = Boolean(perms.canSchedule || perms.accessLevel === 'independent_publish');

  // Query writer's active assignments
  const assignments = await query(`
    SELECT * FROM writer_assignments 
    WHERE writer_id = ? AND status = 'active';
  `, [writerId]);

  let matchingAssignment = null;
  if (contentId) {
    matchingAssignment = assignments.find(a => 
      a.content_type === contentType && String(a.content_id).toLowerCase() === String(contentId).toLowerCase()
    );

    // Check category-level assignments for articles
    if (!matchingAssignment) {
      if (contentType === 'content' || contentType === 'content_article') {
        const art = await queryOne('SELECT main_category_id, sub_category_id FROM content_articles WHERE id = ? OR unique_slug = ?;', [contentId, String(contentId)]);
        if (art) {
          matchingAssignment = assignments.find(a => 
            (a.content_type === 'main_category' && String(a.content_id) === String(art.main_category_id)) ||
            (a.content_type === 'sub_category' && String(a.content_id) === String(art.sub_category_id))
          );
        }
      }
    }
  }

  // If assigned to this content or its category
  if (matchingAssignment) {
    const allowedActions = (matchingAssignment.actions || 'create,edit,submit,publish,schedule').split(',').map(s => s.trim().toLowerCase());
    const actionMap = { 'write': 'edit', 'update': 'edit', 'read': 'view' };
    const normalizedReq = actionMap[requiredAction] || requiredAction.toLowerCase();

    const hasPublish = allowedActions.includes('publish') && canIndependentPublish;
    const hasSchedule = allowedActions.includes('schedule') && canSchedule;

    if (normalizedReq === 'publish' && !hasPublish) {
      return { allowed: false, reason: 'Independent publishing is not authorized for this assignment. Please submit for review.' };
    }
    if (normalizedReq === 'schedule' && !hasSchedule) {
      return { allowed: false, reason: 'Scheduling is not authorized for this assignment. Please submit for review.' };
    }

    const hasAction = allowedActions.includes(normalizedReq) || 
                      normalizedReq === 'view' ||
                      (normalizedReq === 'submit' && (allowedActions.includes('submit') || allowedActions.includes('edit')));

    if (!hasAction && normalizedReq !== 'create') {
      return { allowed: false, reason: `Action "${requiredAction}" is not authorized for this assigned content.` };
    }

    return {
      allowed: true,
      accessLevel: hasPublish ? 'independent_publish' : 'review_required',
      isAssigned: true,
      canPublishIndependently: hasPublish,
      canSchedule: hasSchedule,
      assignment: matchingAssignment
    };
  }

  // Check direct ownership or general type capability for articles
  if ((contentType === 'article' || contentType === 'content_article' || contentType === 'novel') && contentId) {
    const art = await queryOne('SELECT author_id, access_permission FROM content_articles WHERE id = ?;', [contentId]);
    if (art) {
      if (Number(art.author_id) === Number(writerId)) {
        return {
          allowed: true,
          accessLevel: canIndependentPublish ? 'independent_publish' : 'review_required',
          isOwner: true,
          canPublishIndependently: canIndependentPublish,
          canSchedule
        };
      }
      if (art.access_permission === 'admin_only') {
        return { allowed: false, reason: 'This content is restricted to Admin Only. Writers cannot edit this content.' };
      }
    }
  }

  // If creating new content
  if (!contentId && requiredAction === 'create') {
    return { allowed: true, accessLevel: canIndependentPublish ? 'independent_publish' : 'review_required', isCreating: true };
  }

  return { allowed: false, reason: 'You do not have active assignment permissions for this content.' };
}

export async function createOrUpdateSubmission({
  writerId,
  contentType,
  contentId,
  title,
  parentId = null,
  scheduledAt = null
}) {
  const perms = await getWriterPermissions(writerId);
  const requiresReview = perms.accessLevel === 'review_required';

  // If writer has independent publishing permissions, they can publish/schedule directly
  if (perms.accessLevel === 'independent_publish') {
    const status = scheduledAt ? 'scheduled' : 'published';
    await updateContentStatus(contentType, contentId, status, scheduledAt, 'approved');
    return {
      success: true,
      independent: true,
      status,
      message: scheduledAt 
        ? `Successfully scheduled for publication without review.`
        : `Published directly without review.`
    };
  }

  // Otherwise, review is required
  const initialStatus = 'pending_review';

  // Check if existing pending or changes_requested submission exists
  const existingSub = await queryOne(`
    SELECT id FROM writer_submissions 
    WHERE writer_id = ? AND content_type = ? AND content_id = ?;
  `, [writerId, contentType, String(contentId)]);

  let subId;
  if (existingSub) {
    subId = existingSub.id;
    await query(`
      UPDATE writer_submissions 
      SET title = ?, parent_id = ?, status = 'pending_review', scheduled_at = ?, submitted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?;
    `, [title, parentId, scheduledAt || null, subId]);
  } else {
    const insertRes = await query(`
      INSERT INTO writer_submissions (writer_id, content_type, content_id, title, parent_id, status, scheduled_at, submitted_at)
      VALUES (?, ?, ?, ?, ?, 'pending_review', ?, CURRENT_TIMESTAMP);
    `, [writerId, contentType, String(contentId), title, parentId, scheduledAt || null]);
    subId = insertRes.insertId;
  }

  // Update content table's review_status
  await updateContentStatus(contentType, contentId, 'draft', scheduledAt, 'pending_review');

  await recordWriterAudit({
    writerId,
    actorId: writerId,
    action: 'submitted_for_review',
    details: `Submitted ${contentType} "${title}" for admin review.`
  });

  // Notify admin
  await createNotification({
    userId: 2,
    actorId: writerId,
    type: 'submission',
    title: 'New Writer Submission for Review',
    message: `Writer submitted ${contentType} "${title}" for your review.`,
    link: '#admin?tab=submissions'
  }).catch(() => {});

  return {
    success: true,
    submissionId: subId,
    status: initialStatus,
    message: 'Submitted for administrative review.'
  };
}

/**
 * Helper to update content status across chapters, short_stories, audio_novels, or novels
 */
async function updateContentStatus(contentType, contentId, status, scheduledAt = null, reviewStatus = 'published', feedback = null) {
  const isPub = status === 'published' ? 1 : 0;
  await query(`
    UPDATE content_articles 
    SET status = ?, is_published = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? OR unique_slug = ?;
  `, [status, isPub, contentId, String(contentId)]);
}

/**
 * Retrieve all submissions for Admin Review Queue
 */
export async function getAllSubmissions({ status = 'all', writerId = null, contentType = 'all' } = {}) {
  let sql = `
    SELECT 
      s.id, s.writer_id, s.content_type, s.content_id, s.title, s.parent_id,
      s.status, s.admin_notes, s.scheduled_at, s.submitted_at, s.reviewed_at, s.reviewed_by,
      s.created_at, s.updated_at,
      u.username, p.display_name, p.avatar,
      rev_u.username AS reviewer_name
    FROM writer_submissions s
    JOIN users u ON s.writer_id = u.id
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN users rev_u ON s.reviewed_by = rev_u.id
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  if (writerId) {
    sql += ' AND s.writer_id = ?';
    params.push(writerId);
  }
  if (contentType && contentType !== 'all') {
    sql += ' AND s.content_type = ?';
    params.push(contentType);
  }

  sql += ' ORDER BY s.submitted_at DESC;';

  const rows = await query(sql, params);
  return rows.map(r => ({
    id: r.id,
    writerId: r.writer_id,
    writerName: r.display_name || r.username,
    writerAvatar: sanitizeAvatar(r.avatar),
    contentType: r.content_type,
    contentId: r.content_id,
    title: r.title,
    parentId: r.parent_id,
    status: r.status,
    adminNotes: r.admin_notes || '',
    scheduledAt: r.scheduled_at,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at,
    reviewedBy: r.reviewer_name || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

/**
 * Review a submission (Admin only: Approve & Publish, Approve & Schedule, Request Changes, Reject)
 */
export async function reviewSubmission({
  submissionId,
  action,
  adminNotes = '',
  scheduledAt = null,
  actorId = 2
}) {
  const sub = await queryOne('SELECT * FROM writer_submissions WHERE id = ?;', [submissionId]);
  if (!sub) {
    return { success: false, error: 'Submission not found.' };
  }

  let newSubStatus = 'pending_review';
  let newContentStatus = 'draft';
  let newReviewStatus = 'pending_review';
  let notifyTitle = '';
  let notifyMsg = '';

  if (action === 'approve_publish') {
    newSubStatus = 'published';
    newContentStatus = 'published';
    newReviewStatus = 'published';
    notifyTitle = 'Submission Approved & Published';
    notifyMsg = `Your submission "${sub.title}" has been approved and published to the website!`;
  } else if (action === 'approve_schedule') {
    newSubStatus = 'approved';
    newContentStatus = 'scheduled';
    newReviewStatus = 'approved';
    notifyTitle = 'Submission Approved & Scheduled';
    notifyMsg = `Your submission "${sub.title}" has been approved and scheduled for ${scheduledAt ? new Date(scheduledAt).toLocaleString() : 'release'}!`;
  } else if (action === 'request_changes') {
    newSubStatus = 'changes_requested';
    newContentStatus = 'draft';
    newReviewStatus = 'changes_requested';
    notifyTitle = 'Changes Requested on Submission';
    notifyMsg = `Admin requested revisions on "${sub.title}": ${adminNotes || 'Please check feedback and resubmit.'}`;
  } else if (action === 'reject') {
    newSubStatus = 'rejected';
    newContentStatus = 'draft';
    newReviewStatus = 'rejected';
    notifyTitle = 'Submission Rejected';
    notifyMsg = `Your submission "${sub.title}" was rejected: ${adminNotes || 'Does not meet current publishing criteria.'}`;
  } else {
    return { success: false, error: 'Invalid review action.' };
  }

  // Update submission record
  await query(`
    UPDATE writer_submissions 
    SET status = ?, admin_notes = ?, scheduled_at = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `, [newSubStatus, adminNotes || null, scheduledAt || sub.scheduled_at || null, actorId, submissionId]);

  // Update content table
  await updateContentStatus(sub.content_type, sub.content_id, newContentStatus, scheduledAt || sub.scheduled_at, newReviewStatus, adminNotes);

  // Record audit log
  await recordWriterAudit({
    writerId: sub.writer_id,
    actorId,
    action: `submission_${action}`,
    details: `Admin executed ${action} on ${sub.content_type} "${sub.title}". Notes: ${adminNotes || 'None'}`
  });

  // Notify writer
  await createNotification({
    userId: sub.writer_id,
    actorId,
    type: 'submission_review',
    title: notifyTitle,
    message: notifyMsg,
    link: '#writer'
  }).catch(() => {});

  return {
    success: true,
    status: newSubStatus,
    message: notifyTitle
  };
}

/**
 * Get comprehensive workspace data for a writer
 */
export async function getEnhancedWriterWorkspaceData(writerId) {
  const baseData = await getWriterWorkspaceData(writerId);
  if (!baseData) return null;

  const perms = await getWriterPermissions(writerId);
  const assignments = await getWriterAssignments(writerId, 'active');
  const submissions = await query(`
    SELECT * FROM writer_submissions WHERE writer_id = ? ORDER BY submitted_at DESC;
  `, [writerId]);

  const pendingSubmissions = (submissions || []).filter(s => s.status === 'pending_review');
  const changesRequested = (submissions || []).filter(s => s.status === 'changes_requested');

  return {
    ...baseData,
    permissions: perms,
    assignments: assignments || [],
    assignmentsCount: (assignments || []).length,
    submissions: submissions || [],
    pendingSubmissionsCount: pendingSubmissions.length,
    changesRequestedCount: changesRequested.length
  };
}
