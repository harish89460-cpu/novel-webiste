// Real-Time Online Presence Tracking Module
// Tracks authenticated members and guest visitors using MySQL backend
// Rudhra Prarthana Novels

import { query, queryOne } from './db.js';
import { sanitizeAvatar, touchHeartbeat } from './auth.js';

// Configurable inactivity timeout (5 minutes = 300 seconds)
export const PRESENCE_TIMEOUT_SECONDS = 300;

/**
 * Validate and clean a guest session identifier
 * Accepts standard UUIDs or alphanumeric identifiers between 10 and 64 chars
 */
export function sanitizeGuestId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  const clean = rawId.trim();
  if (/^[a-zA-Z0-9_-]{10,64}$/.test(clean)) {
    return clean;
  }
  return null;
}

/**
 * Record or update active presence for a member or guest
 * 
 * @param {Object} params
 * @param {number|null} params.userId - Authenticated user ID (null for guest)
 * @param {string|null} params.guestId - Guest session ID from client
 * @param {boolean} params.isMember - Whether user is authenticated
 */
export async function recordPresence({ userId = null, guestId = null, isMember = false }) {
  const cleanGuest = sanitizeGuestId(guestId);

  if (isMember && userId && Number.isInteger(Number(userId)) && Number(userId) > 0) {
    const validUserId = Number(userId);
    const memberSessionKey = `member_${validUserId}`;

    // If a guest session was transitioned to member, remove stale guest record
    if (cleanGuest) {
      try {
        await query('DELETE FROM user_presence WHERE session_key = ?;', [`guest_${cleanGuest}`]);
      } catch (err) {
        console.error('Failed to cleanup transitioned guest session:', err.message);
      }
    }

    // Upsert member presence
    await query(`
      INSERT INTO user_presence (session_key, user_id, visitor_type, last_activity)
      VALUES (?, ?, 'member', CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE 
        last_activity = CURRENT_TIMESTAMP, 
        visitor_type = 'member', 
        user_id = VALUES(user_id);
    `, [memberSessionKey, validUserId]);

    // Touch user activity in activity_status table
    try {
      await touchHeartbeat(validUserId);
    } catch {}

    return { sessionKey: memberSessionKey, visitorType: 'member' };
  }

  // Guest presence
  if (cleanGuest) {
    const guestSessionKey = `guest_${cleanGuest}`;
    await query(`
      INSERT INTO user_presence (session_key, user_id, visitor_type, last_activity)
      VALUES (?, NULL, 'guest', CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE 
        last_activity = CURRENT_TIMESTAMP;
    `, [guestSessionKey]);

    return { sessionKey: guestSessionKey, visitorType: 'guest' };
  }

  return null;
}

/**
 * Remove active presence (e.g. on logout or session invalidation)
 */
export async function removePresence({ userId = null, guestId = null }) {
  if (userId) {
    const memberSessionKey = `member_${userId}`;
    await query('DELETE FROM user_presence WHERE session_key = ?;', [memberSessionKey]);
  }
  const cleanGuest = sanitizeGuestId(guestId);
  if (cleanGuest) {
    await query('DELETE FROM user_presence WHERE session_key = ?;', [`guest_${cleanGuest}`]);
  }
}

/**
 * Get online presence statistics and visible active members
 * 
 * @param {number|null} viewerId - ID of requesting user (for self privacy bypass)
 */
export async function getOnlinePresenceSummary(viewerId = null) {
  // Prune dead sessions older than 15 minutes to keep table compact
  try {
    await query('DELETE FROM user_presence WHERE last_activity < DATE_SUB(NOW(), INTERVAL 15 MINUTE);');
  } catch (err) {
    console.error('Presence cleanup warning:', err.message);
  }

  // Count active members and active guests within the inactivity timeout
  const countRow = await queryOne(`
    SELECT 
      COALESCE(SUM(CASE WHEN visitor_type = 'member' THEN 1 ELSE 0 END), 0) AS members_count,
      COALESCE(SUM(CASE WHEN visitor_type = 'guest' THEN 1 ELSE 0 END), 0) AS guests_count
    FROM user_presence
    WHERE last_activity >= DATE_SUB(NOW(), INTERVAL ? SECOND);
  `, [PRESENCE_TIMEOUT_SECONDS]);

  const membersOnline = Number(countRow?.members_count || 0);
  const guestsOnline = Number(countRow?.guests_count || 0);
  const totalOnline = membersOnline + guestsOnline;

  // Retrieve active authenticated members
  const memberRows = await query(`
    SELECT 
      u.id, 
      u.username, 
      u.role,
      p.display_name, 
      p.avatar, 
      p.title,
      COALESCE(a.is_enabled, 1) AS activity_status_enabled,
      op.last_activity
    FROM user_presence op
    JOIN users u ON op.user_id = u.id
    LEFT JOIN profiles p ON u.id = p.user_id
    LEFT JOIN activity_status a ON u.id = a.user_id
    WHERE op.visitor_type = 'member' 
      AND op.last_activity >= DATE_SUB(NOW(), INTERVAL ? SECOND)
    ORDER BY op.last_activity DESC
    LIMIT 60;
  `, [PRESENCE_TIMEOUT_SECONDS]);

  const visibleMembers = [];
  let hiddenMembersCount = 0;

  for (const row of memberRows) {
    const isSelf = viewerId && Number(viewerId) === Number(row.id);
    const canShow = Boolean(row.activity_status_enabled) || isSelf;

    if (canShow) {
      visibleMembers.push({
        id: row.id,
        username: row.username,
        displayName: row.display_name || row.username,
        avatar: sanitizeAvatar(row.avatar),
        role: row.role || 'Member',
        title: row.title || row.role || 'Member',
        isOnline: true,
        lastSeen: row.last_activity
      });
    } else {
      hiddenMembersCount++;
    }
  }

  return {
    membersOnline,
    guestsOnline,
    totalOnline,
    visibleMembers,
    visibleMembersCount: visibleMembers.length,
    hiddenMembersCount,
    timeoutSeconds: PRESENCE_TIMEOUT_SECONDS
  };
}
