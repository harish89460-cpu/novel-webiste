// Reading Activity and Duration Tracking Module
// Rudhra Prarthana Novels
// Tracks real reader sessions, duration, and last-read story with strict Active Status privacy enforcement.

import { query, queryOne } from './db.js';
import { touchHeartbeat } from './auth.js';
import { recordPresence } from './presence.js';

// Inactivity timeout: 120 seconds (2 minutes).
// If no reading heartbeat is received within 120 seconds, current reading session is considered paused/ended.
export const READING_INACTIVITY_TIMEOUT_SECONDS = 120;

// Online presence timeout: 300 seconds (5 minutes).
export const ONLINE_PRESENCE_TIMEOUT_SECONDS = 300;

/**
 * Format duration in seconds into human readable format:
 * e.g., "< 1 min", "5 min", "1 hr", "1 hr 20 min", "2 hr"
 */
export function formatReadingDuration(seconds) {
  const sec = Math.max(0, parseInt(seconds, 10) || 0);
  if (sec < 60) {
    return '< 1 min';
  }
  const totalMinutes = Math.floor(sec / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Format timestamp into relative time string:
 * e.g., "Just now", "5 min ago", "2 hr ago", "Yesterday"
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSeconds < 45) return 'Just now';
  if (diffSeconds < 90) return '1 min ago';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} min ago`;
  if (diffSeconds < 7200) return '1 hr ago';
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} hr ago`;
  if (diffSeconds < 172800) return 'Yesterday';
  const days = Math.floor(diffSeconds / 86400);
  if (days < 30) return `${days} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Prune stale reading sessions where last ping exceeded inactivity timeout
 */
export async function pruneStaleReadingSessions() {
  try {
    // 1. Find sessions that are active but timed out
    const staleSessions = await query(`
      SELECT id, user_id, novel_id, chapter_num, duration_seconds, last_active_at
      FROM reading_sessions
      WHERE is_active = 1 
        AND last_active_at < DATE_SUB(NOW(), INTERVAL ? SECOND);
    `, [READING_INACTIVITY_TIMEOUT_SECONDS]);

    if (staleSessions.length === 0) return;

    // 2. Mark sessions inactive
    const staleIds = staleSessions.map(s => s.id);
    await query(`
      UPDATE reading_sessions
      SET is_active = 0, ended_at = last_active_at
      WHERE id IN (${staleIds.map(() => '?').join(',')});
    `, staleIds);

    // 3. Update activity_status for affected users
    for (const session of staleSessions) {
      await query(`
        UPDATE activity_status
        SET 
          is_reading = 0,
          last_read_novel_id = current_novel_id,
          last_read_chapter_num = current_chapter_num,
          last_read_at = reading_last_active,
          last_read_duration_seconds = reading_duration_seconds,
          current_novel_id = NULL,
          current_chapter_num = NULL
        WHERE user_id = ? AND is_reading = 1;
      `, [session.user_id]);
    }
  } catch (err) {
    console.warn('[Reading Activity] Prune warning:', err.message);
  }
}

/**
 * Start or resume a verified reading session for an authenticated member
 */
export async function startReadingSession({ userId, novelId, chapterNum, tabId = null }) {
  if (!userId || !novelId) {
    return { success: false, error: 'userId and novelId are required' };
  }

  const validUserId = parseInt(userId, 10);
  const cleanNovel = String(novelId).trim();
  const cleanChapter = String(chapterNum || '1').trim();
  const cleanTab = tabId ? String(tabId).trim().slice(0, 64) : null;

  // Resolve target novel ID & title
  const novelRow = await queryOne(`
    SELECT id, title FROM novels WHERE id = ? OR title = ? LIMIT 1;
  `, [cleanNovel, cleanNovel]);
  if (!novelRow) {
    return { success: false, error: 'Novel not found' };
  }
  const targetNovelId = novelRow.id;
  const novelTitle = novelRow.title;

  // First prune any stale sessions
  await pruneStaleReadingSessions();

  // Check if there is an existing active session for this user, novel, and chapter
  const existingSession = await queryOne(`
    SELECT id, session_start, duration_seconds, last_active_at
    FROM reading_sessions
    WHERE user_id = ? AND novel_id = ? AND chapter_num = ? AND is_active = 1
    ORDER BY last_active_at DESC LIMIT 1;
  `, [validUserId, targetNovelId, cleanChapter]);

  let sessionId;
  let durationSeconds = 0;

  if (existingSession) {
    // Resume session on reload or tab re-focus without resetting duration
    sessionId = existingSession.id;
    durationSeconds = existingSession.duration_seconds || 0;
    await query(`
      UPDATE reading_sessions
      SET last_active_at = CURRENT_TIMESTAMP, tab_id = COALESCE(?, tab_id)
      WHERE id = ?;
    `, [cleanTab, sessionId]);
  } else {
    // User is starting a new episode or novel: close any previous active sessions for this user
    const prevSessions = await query(`
      SELECT id, novel_id, chapter_num, duration_seconds, last_active_at
      FROM reading_sessions
      WHERE user_id = ? AND is_active = 1;
    `, [validUserId]);

    for (const prev of prevSessions) {
      await query(`
        UPDATE reading_sessions
        SET is_active = 0, ended_at = last_active_at
        WHERE id = ?;
      `, [prev.id]);

      // Cache as last read
      await query(`
        UPDATE activity_status
        SET 
          last_read_novel_id = ?,
          last_read_chapter_num = ?,
          last_read_at = ?,
          last_read_duration_seconds = ?
        WHERE user_id = ?;
      `, [prev.novel_id, prev.chapter_num, prev.last_active_at, prev.duration_seconds, validUserId]);
    }

    // Insert new session
    const insertRes = await query(`
      INSERT INTO reading_sessions (user_id, novel_id, chapter_num, session_start, last_active_at, duration_seconds, is_active, tab_id)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 1, ?);
    `, [validUserId, targetNovelId, cleanChapter, cleanTab]);
    sessionId = insertRes.insertId;
  }

  // Update activity_status table
  await query(`
    INSERT INTO activity_status (
      user_id, is_enabled, is_online, last_seen, 
      current_novel_id, current_chapter_num, 
      reading_session_start, reading_last_active, 
      reading_duration_seconds, is_reading
    ) VALUES (
      ?, 1, 1, CURRENT_TIMESTAMP,
      ?, ?,
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
      ?, 1
    ) ON DUPLICATE KEY UPDATE
      is_online = 1,
      last_seen = CURRENT_TIMESTAMP,
      current_novel_id = VALUES(current_novel_id),
      current_chapter_num = VALUES(current_chapter_num),
      reading_session_start = COALESCE(reading_session_start, CURRENT_TIMESTAMP),
      reading_last_active = CURRENT_TIMESTAMP,
      reading_duration_seconds = VALUES(reading_duration_seconds),
      is_reading = 1;
  `, [validUserId, targetNovelId, cleanChapter, durationSeconds]);

  // Record presence & touch heartbeat
  await recordPresence({ userId: validUserId, isMember: true }).catch(() => {});
  await touchHeartbeat(validUserId).catch(() => {});

  // Save to reading_progress table as well
  await query(`
    INSERT INTO reading_progress (user_id, novel_id, chapter_num, progress_percentage, last_read_at)
    VALUES (?, ?, ?, 100, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      chapter_num = VALUES(chapter_num),
      progress_percentage = 100,
      last_read_at = CURRENT_TIMESTAMP;
  `, [validUserId, targetNovelId, cleanChapter]).catch(() => {});

  return {
    success: true,
    sessionId,
    novelId: targetNovelId,
    novelTitle,
    chapterNum: cleanChapter,
    durationSeconds,
    duration: formatReadingDuration(durationSeconds)
  };
}

/**
 * Record reading heartbeat while reader tab is active and visible
 */
export async function heartbeatReadingSession({ userId, novelId, chapterNum, tabId = null, secondsElapsed = 0 }) {
  if (!userId || !novelId) {
    return { success: false, error: 'userId and novelId are required' };
  }

  const validUserId = parseInt(userId, 10);
  const cleanNovel = String(novelId).trim();
  const cleanChapter = String(chapterNum || '1').trim();
  const cleanTab = tabId ? String(tabId).trim().slice(0, 64) : null;

  // Resolve target novel
  const novelRow = await queryOne(`
    SELECT id, title FROM novels WHERE id = ? OR title = ? LIMIT 1;
  `, [cleanNovel, cleanNovel]);
  if (!novelRow) {
    return { success: false, error: 'Novel not found' };
  }
  const targetNovelId = novelRow.id;

  // Find active session
  let session = await queryOne(`
    SELECT id, session_start, duration_seconds, last_active_at
    FROM reading_sessions
    WHERE user_id = ? AND novel_id = ? AND chapter_num = ? AND is_active = 1
    ORDER BY last_active_at DESC LIMIT 1;
  `, [validUserId, targetNovelId, cleanChapter]);

  if (!session) {
    // Start session if not existing
    return await startReadingSession({ userId: validUserId, novelId: targetNovelId, chapterNum: cleanChapter, tabId: cleanTab });
  }

  // Calculate duration using reliable server timestamps
  // Capped to prevent disconnected/sleeping tabs from accumulating huge unverified gaps
  const now = new Date();
  const lastActive = new Date(session.last_active_at);
  const gapSeconds = Math.max(0, Math.floor((now.getTime() - lastActive.getTime()) / 1000));

  // If heartbeat gap is reasonable (<= 120s), add elapsed time
  let newDuration = Number(session.duration_seconds || 0);
  if (gapSeconds <= READING_INACTIVITY_TIMEOUT_SECONDS) {
    // Add verified elapsed reading seconds (either from client ping or measured gap)
    const inc = (secondsElapsed > 0 && secondsElapsed <= 60) ? secondsElapsed : Math.min(gapSeconds, 35);
    newDuration += inc;
  }

  // Update session
  await query(`
    UPDATE reading_sessions
    SET 
      last_active_at = CURRENT_TIMESTAMP,
      duration_seconds = ?,
      is_active = 1,
      tab_id = COALESCE(?, tab_id)
    WHERE id = ?;
  `, [newDuration, cleanTab, session.id]);

  // Update activity_status
  await query(`
    UPDATE activity_status
    SET 
      is_online = 1,
      last_seen = CURRENT_TIMESTAMP,
      reading_last_active = CURRENT_TIMESTAMP,
      reading_duration_seconds = ?,
      is_reading = 1
    WHERE user_id = ?;
  `, [newDuration, validUserId]);

  // Touch presence
  await recordPresence({ userId: validUserId, isMember: true }).catch(() => {});
  await touchHeartbeat(validUserId).catch(() => {});

  return {
    success: true,
    sessionId: session.id,
    durationSeconds: newDuration,
    duration: formatReadingDuration(newDuration)
  };
}

/**
 * Pause or stop a reading session (tab hidden, page navigation, or logout)
 */
export async function pauseOrStopReadingSession({ userId, novelId = null, chapterNum = null }) {
  if (!userId) {
    return { success: false, error: 'userId is required' };
  }

  const validUserId = parseInt(userId, 10);

  // Close active sessions for user
  const activeSessions = await query(`
    SELECT id, novel_id, chapter_num, duration_seconds, last_active_at
    FROM reading_sessions
    WHERE user_id = ? AND is_active = 1;
  `, [validUserId]);

  for (const session of activeSessions) {
    await query(`
      UPDATE reading_sessions
      SET is_active = 0, ended_at = last_active_at
      WHERE id = ?;
    `, [session.id]);

    // Update last_read cache in activity_status
    await query(`
      UPDATE activity_status
      SET 
        last_read_novel_id = ?,
        last_read_chapter_num = ?,
        last_read_at = ?,
        last_read_duration_seconds = ?
      WHERE user_id = ?;
    `, [session.novel_id, session.chapter_num, session.last_active_at, session.duration_seconds, validUserId]);
  }

  // Mark not currently reading
  await query(`
    UPDATE activity_status
    SET 
      is_reading = 0,
      current_novel_id = NULL,
      current_chapter_num = NULL
    WHERE user_id = ?;
  `, [validUserId]);

  return { success: true, closedSessions: activeSessions.length };
}

/**
 * Get comprehensive reading activity and online status for a specific member
 * with strict backend privacy enforcement.
 * 
 * If the member has Active Status OFF (is_enabled = 0):
 * - Other members CANNOT see online status, current reading, or last read story.
 * - Only the member themselves (isSelf) can see their own private reading activity.
 */
export async function getMemberReadingActivity(targetUserIdOrUsername, viewerId = null) {
  // Prune any stale sessions first
  await pruneStaleReadingSessions();

  const row = await queryOne(`
    SELECT 
      u.id AS user_id, 
      u.username,
      a.is_enabled AS activity_status_enabled,
      a.is_online,
      a.last_seen,
      a.is_reading,
      a.current_novel_id,
      a.current_chapter_num,
      a.reading_session_start,
      a.reading_last_active,
      a.reading_duration_seconds,
      a.last_read_novel_id,
      a.last_read_chapter_num,
      a.last_read_at,
      a.last_read_duration_seconds,
      cur_n.title AS current_novel_title,
      cur_c.title AS current_chapter_title,
      last_n.title AS last_read_novel_title,
      last_c.title AS last_read_chapter_title,
      TIMESTAMPDIFF(SECOND, a.last_seen, NOW()) AS last_seen_seconds_ago,
      TIMESTAMPDIFF(SECOND, a.reading_last_active, NOW()) AS reading_last_active_seconds_ago
    FROM users u
    LEFT JOIN activity_status a ON u.id = a.user_id
    LEFT JOIN novels cur_n ON a.current_novel_id = cur_n.id
    LEFT JOIN chapters cur_c ON a.current_novel_id = cur_c.novel_id AND a.current_chapter_num = cur_c.chapter_num
    LEFT JOIN novels last_n ON a.last_read_novel_id = last_n.id
    LEFT JOIN chapters last_c ON a.last_read_novel_id = last_c.novel_id AND a.last_read_chapter_num = last_c.chapter_num
    WHERE u.id = ? OR LOWER(u.username) = LOWER(?);
  `, [targetUserIdOrUsername, String(targetUserIdOrUsername)]);

  if (!row) return null;

  const isSelf = viewerId && Number(viewerId) === Number(row.user_id);
  const isEnabled = row.activity_status_enabled === null ? true : Boolean(row.activity_status_enabled);

  // PRIVACY ENFORCEMENT:
  // If Active Status is OFF and viewer is NOT the member themselves, return NO activity or online status!
  if (!isEnabled && !isSelf) {
    return {
      userId: row.user_id,
      username: row.username,
      activityStatusEnabled: false,
      statusHidden: true,
      isOnline: null,
      lastSeen: null,
      lastSeenText: null,
      currentReading: null,
      lastRead: null
    };
  }

  // Active Status is ON (or viewer is self):
  // Check online status: online flag true AND last seen within 300 seconds
  const isOnline = Boolean(row.is_online) && (row.last_seen_seconds_ago !== null && row.last_seen_seconds_ago <= ONLINE_PRESENCE_TIMEOUT_SECONDS);

  // Check currently reading: reading flag true AND active reading ping within 120 seconds
  const isCurrentlyReading = Boolean(row.is_reading) && 
    Boolean(row.current_novel_id) && 
    (row.reading_last_active_seconds_ago !== null && row.reading_last_active_seconds_ago <= READING_INACTIVITY_TIMEOUT_SECONDS);

  let currentReading = null;
  if (isCurrentlyReading) {
    const durSec = row.reading_duration_seconds || 0;
    currentReading = {
      novelId: row.current_novel_id,
      novelTitle: row.current_novel_title || row.current_novel_id,
      chapterNum: row.current_chapter_num,
      chapterTitle: row.current_chapter_title || null,
      durationSeconds: durSec,
      duration: formatReadingDuration(durSec),
      lastActiveAt: row.reading_last_active
    };
  }

  let lastRead = null;
  // If not currently reading, or to provide fallback history, show last read
  if (row.last_read_novel_id) {
    const durSec = row.last_read_duration_seconds || 0;
    lastRead = {
      novelId: row.last_read_novel_id,
      novelTitle: row.last_read_novel_title || row.last_read_novel_id,
      chapterNum: row.last_read_chapter_num,
      chapterTitle: row.last_read_chapter_title || null,
      lastReadAt: row.last_read_at,
      lastReadAgo: formatRelativeTime(row.last_read_at),
      durationSeconds: durSec,
      duration: formatReadingDuration(durSec)
    };
  }

  return {
    userId: row.user_id,
    username: row.username,
    activityStatusEnabled: isEnabled,
    statusHidden: false,
    isOnline,
    lastSeen: row.last_seen,
    lastSeenText: formatRelativeTime(row.last_seen),
    currentReading,
    lastRead
  };
}

/**
 * Get directory of all members with privacy-filtered reading activity and online status
 */
export async function getAllMembersReadingDirectory(viewerId = null) {
  await pruneStaleReadingSessions();

  const rows = await query(`
    SELECT 
      u.id, 
      u.username, 
      u.role,
      p.display_name, 
      p.avatar, 
      p.bio, 
      p.title, 
      p.joined_date,
      p.posts_count, 
      p.topics_count, 
      p.followers_count,
      a.is_enabled AS activity_status_enabled,
      a.is_online,
      a.last_seen,
      a.is_reading,
      a.current_novel_id,
      a.current_chapter_num,
      a.reading_duration_seconds,
      a.reading_last_active,
      a.last_read_novel_id,
      a.last_read_chapter_num,
      a.last_read_at,
      a.last_read_duration_seconds,
      cur_n.title AS current_novel_title,
      cur_c.title AS current_chapter_title,
      last_n.title AS last_read_novel_title,
      last_c.title AS last_read_chapter_title,
      TIMESTAMPDIFF(SECOND, a.last_seen, NOW()) AS last_seen_seconds_ago,
      TIMESTAMPDIFF(SECOND, a.reading_last_active, NOW()) AS reading_last_active_seconds_ago
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    LEFT JOIN novels cur_n ON a.current_novel_id = cur_n.id
    LEFT JOIN chapters cur_c ON a.current_novel_id = cur_c.novel_id AND a.current_chapter_num = cur_c.chapter_num
    LEFT JOIN novels last_n ON a.last_read_novel_id = last_n.id
    LEFT JOIN chapters last_c ON a.last_read_novel_id = last_c.novel_id AND a.last_read_chapter_num = last_c.chapter_num
    ORDER BY u.created_at ASC;
  `);

  return rows.map(r => {
    const isSelf = viewerId && Number(viewerId) === Number(r.id);
    const isEnabled = r.activity_status_enabled === null ? true : Boolean(r.activity_status_enabled);

    // If privacy is OFF and viewer is not self, omit all activity and online status
    if (!isEnabled && !isSelf) {
      return {
        id: r.id,
        username: r.username,
        displayName: r.display_name || r.username,
        avatar: r.avatar || '/profile.png',
        role: r.role || 'Member',
        title: r.title || r.role || 'Member',
        joined: r.joined_date || 'Member',
        joinedDate: r.joined_date || 'Member',
        bio: r.bio || '',
        posts: Number(r.posts_count || 0),
        topics: Number(r.topics_count || 0),
        followers: Number(r.followers_count || 0),
        activityStatusEnabled: false,
        statusHidden: true,
        isOnline: null,
        lastSeen: null,
        lastSeenText: null,
        currentReading: null,
        lastRead: null
      };
    }

    // Active Status is ON (or viewer is self):
    const isOnline = Boolean(r.is_online) && (r.last_seen_seconds_ago !== null && r.last_seen_seconds_ago <= ONLINE_PRESENCE_TIMEOUT_SECONDS);
    const isCurrentlyReading = Boolean(r.is_reading) && 
      Boolean(r.current_novel_id) && 
      (r.reading_last_active_seconds_ago !== null && r.reading_last_active_seconds_ago <= READING_INACTIVITY_TIMEOUT_SECONDS);

    let currentReading = null;
    if (isCurrentlyReading) {
      const durSec = r.reading_duration_seconds || 0;
      currentReading = {
        novelId: r.current_novel_id,
        novelTitle: r.current_novel_title || r.current_novel_id,
        chapterNum: r.current_chapter_num,
        chapterTitle: r.current_chapter_title || null,
        durationSeconds: durSec,
        duration: formatReadingDuration(durSec)
      };
    }

    let lastRead = null;
    if (r.last_read_novel_id) {
      const durSec = r.last_read_duration_seconds || 0;
      lastRead = {
        novelId: r.last_read_novel_id,
        novelTitle: r.last_read_novel_title || r.last_read_novel_id,
        chapterNum: r.last_read_chapter_num,
        chapterTitle: r.last_read_chapter_title || null,
        lastReadAt: r.last_read_at,
        lastReadAgo: formatRelativeTime(r.last_read_at),
        durationSeconds: durSec,
        duration: formatReadingDuration(durSec)
      };
    }

    return {
      id: r.id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatar: r.avatar || '/profile.png',
      role: r.role || 'Member',
      title: r.title || r.role || 'Member',
      joined: r.joined_date || 'Member',
      joinedDate: r.joined_date || 'Member',
      bio: r.bio || '',
      posts: Number(r.posts_count || 0),
      topics: Number(r.topics_count || 0),
      followers: Number(r.followers_count || 0),
      activityStatusEnabled: isEnabled,
      statusHidden: false,
      isOnline,
      lastSeen: r.last_seen,
      lastSeenText: formatRelativeTime(r.last_seen),
      currentReading,
      lastRead
    };
  });
}
