// Centralized Real-Time Notifications & Web Push Service
// Rudhra Prarthana Novels — MySQL Persistence + SSE + Web Push

import webpush from 'web-push';
import { query, queryOne, loadEnv } from './db.js';
import { sanitizeAvatar } from './auth.js';

loadEnv();

// Configure Web Push VAPID credentials
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@rpnovels.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.error('[WebPush] Error configuring VAPID details:', err.message);
  }
}

/**
 * Registry of active Server-Sent Events (SSE) connections for real-time delivery
 * Map<userId, Set<http.ServerResponse>>
 */
const sseClients = new Map();

/**
 * Register a client SSE connection
 */
export function registerSseClient(userId, res) {
  const uId = Number(userId);
  if (!sseClients.has(uId)) {
    sseClients.set(uId, new Set());
  }
  sseClients.get(uId).add(res);

  res.on('close', () => {
    const set = sseClients.get(uId);
    if (set) {
      set.delete(res);
      if (set.size === 0) {
        sseClients.delete(uId);
      }
    }
  });
}

/**
 * Broadcast event to all active SSE connections for a specific user
 */
export function sendSseToUser(userId, eventName, data) {
  const uId = Number(userId);
  const set = sseClients.get(uId);
  if (!set || set.size === 0) return;

  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of set) {
    try {
      client.write(payload);
    } catch (err) {
      console.warn('[SSE] Error sending to client:', err.message);
    }
  }
}

/**
 * Get public VAPID key for frontend registration
 */
export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

/**
 * Retrieve user notification preferences
 */
export async function getNotificationPreferences(userId) {
  const uId = Number(userId);
  const row = await queryOne(`
    SELECT * FROM notification_preferences WHERE user_id = ?;
  `, [uId]);

  if (!row) {
    // Default preferences
    return {
      userId: uId,
      notifyComments: true,
      notifyReplies: true,
      notifyReactions: true,
      notifyForum: true,
      notifyChapters: true,
      notifySystem: true,
      browserEnabled: false
    };
  }

  return {
    userId: uId,
    notifyComments: Boolean(row.notify_comments),
    notifyReplies: Boolean(row.notify_replies),
    notifyReactions: Boolean(row.notify_reactions),
    notifyForum: Boolean(row.notify_forum),
    notifyChapters: Boolean(row.notify_chapters),
    notifySystem: Boolean(row.notify_system),
    browserEnabled: Boolean(row.browser_enabled)
  };
}

/**
 * Update user notification preferences
 */
export async function updateNotificationPreferences(userId, prefs) {
  const uId = Number(userId);
  const {
    notifyComments = true,
    notifyReplies = true,
    notifyReactions = true,
    notifyForum = true,
    notifyChapters = true,
    notifySystem = true,
    browserEnabled = false
  } = prefs;

  await query(`
    INSERT INTO notification_preferences (
      user_id, notify_comments, notify_replies, notify_reactions, 
      notify_forum, notify_chapters, notify_system, browser_enabled
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      notify_comments = VALUES(notify_comments),
      notify_replies = VALUES(notify_replies),
      notify_reactions = VALUES(notify_reactions),
      notify_forum = VALUES(notify_forum),
      notify_chapters = VALUES(notify_chapters),
      notify_system = VALUES(notify_system),
      browser_enabled = VALUES(browser_enabled),
      updated_at = CURRENT_TIMESTAMP;
  `, [
    uId,
    notifyComments ? 1 : 0,
    notifyReplies ? 1 : 0,
    notifyReactions ? 1 : 0,
    notifyForum ? 1 : 0,
    notifyChapters ? 1 : 0,
    notifySystem ? 1 : 0,
    browserEnabled ? 1 : 0
  ]);

  return getNotificationPreferences(uId);
}

/**
 * Save or update Web Push subscription for authenticated user
 */
export async function savePushSubscription(userId, subscription, userAgent = '') {
  const uId = Number(userId);
  if (!subscription || !subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { success: false, error: 'Invalid subscription payload.' };
  }

  const { endpoint, keys } = subscription;

  await query(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      p256dh = VALUES(p256dh),
      auth = VALUES(auth),
      user_agent = VALUES(user_agent),
      updated_at = CURRENT_TIMESTAMP;
  `, [uId, endpoint, keys.p256dh, keys.auth, (userAgent || '').slice(0, 250)]);

  // Mark browser_enabled in preferences
  await query(`
    INSERT INTO notification_preferences (user_id, browser_enabled)
    VALUES (?, 1)
    ON DUPLICATE KEY UPDATE browser_enabled = 1;
  `, [uId]);

  return { success: true };
}

/**
 * Remove Web Push subscription
 */
export async function removePushSubscription(userId, endpoint) {
  const uId = Number(userId);
  if (endpoint) {
    await query(`
      DELETE FROM push_subscriptions 
      WHERE user_id = ? AND endpoint = ?;
    `, [uId, endpoint]);
  } else {
    await query(`
      DELETE FROM push_subscriptions 
      WHERE user_id = ?;
    `, [uId]);
  }

  // Check if any subscriptions remain
  const remaining = await queryOne(`
    SELECT COUNT(*) AS count FROM push_subscriptions WHERE user_id = ?;
  `, [uId]);

  if (!remaining || remaining.count === 0) {
    await query(`
      UPDATE notification_preferences 
      SET browser_enabled = 0 
      WHERE user_id = ?;
    `, [uId]);
  }

  return { success: true };
}

/**
 * Send Web Push notifications to all subscriptions of a user
 */
export async function sendWebPushNotification(userId, payload) {
  const uId = Number(userId);
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  const subscriptions = await query(`
    SELECT endpoint, p256dh, auth 
    FROM push_subscriptions 
    WHERE user_id = ?;
  `, [uId]);

  if (!subscriptions || subscriptions.length === 0) return;

  const pushString = JSON.stringify(payload);

  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth
      }
    };

    try {
      await webpush.sendNotification(pushSub, pushString, {
        TTL: 60 * 60 * 24 // 24 hours
      });
    } catch (err) {
      // 404 Not Found or 410 Gone means the subscription is expired or revoked by user
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log(`[WebPush] Removing expired subscription endpoint: ${sub.endpoint.slice(0, 40)}...`);
        try {
          await query('DELETE FROM push_subscriptions WHERE endpoint = ?;', [sub.endpoint]);
        } catch {}
      } else {
        console.warn('[WebPush] Send error:', err.statusCode, err.message);
      }
    }
  }
}

/**
 * Format timestamp into relative display string
 */
export function formatNotificationTime(dateStr) {
  if (!dateStr) return 'Just now';
  try {
    const normalized = typeof dateStr === 'string' && !dateStr.includes('T') ? dateStr.replace(' ', 'T') + 'Z' : dateStr;
    const date = new Date(normalized);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'Just now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

/**
 * Create a genuine notification backed by MySQL
 * 
 * @param {Object} params
 * @param {number} params.userId - Recipient user ID (Required)
 * @param {number|null} params.actorId - Actor user ID who performed action (Optional)
 * @param {string} params.type - Event type (e.g. 'novel_comment', 'comment_reply', 'comment_reaction', 'forum_reply', 'forum_mention', 'chapter_release', 'account_event')
 * @param {string} params.title - Notification title
 * @param {string} params.message - Safe notification text
 * @param {string} params.link - Target hash or URL link
 * @param {string|null} params.entityType - Content type ('novel', 'chapter', 'comment', 'forum_topic', 'account')
 * @param {string|number|null} params.entityId - Target entity identifier
 */
export async function createNotification({
  userId,
  actorId = null,
  type = 'announcement',
  title,
  message,
  link = '#home',
  entityType = null,
  entityId = null
}) {
  const recipientId = Number(userId);
  const cleanActorId = actorId ? Number(actorId) : null;

  // RULE 1: Never notify a user about their own action
  if (cleanActorId && cleanActorId === recipientId) {
    return null;
  }

  if (!recipientId || !title || !message) {
    return null;
  }

  // RULE 2: Respect user's notification preferences
  const prefs = await getNotificationPreferences(recipientId);
  if (type === 'novel_comment' && !prefs.notifyComments) return null;
  if (type === 'comment_reply' && !prefs.notifyReplies) return null;
  if ((type === 'comment_reaction' || type === 'comment_like') && !prefs.notifyReactions) return null;
  if ((type === 'forum_reply' || type === 'forum_mention') && !prefs.notifyForum) return null;
  if (type === 'chapter_release' && !prefs.notifyChapters) return null;
  if (type === 'account_event' && !prefs.notifySystem) return null;

  // RULE 3: Deduplication safeguard
  // Check if an identical notification was recently generated (within 15 minutes)
  const recentDuplicate = await queryOne(`
    SELECT id, created_at 
    FROM notifications 
    WHERE user_id = ? 
      AND (actor_id = ? OR (actor_id IS NULL AND ? IS NULL))
      AND type = ?
      AND (entity_type = ? OR (entity_type IS NULL AND ? IS NULL))
      AND (entity_id = ? OR (entity_id IS NULL AND ? IS NULL))
      AND created_at >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
    LIMIT 1;
  `, [
    recipientId, 
    cleanActorId, cleanActorId, 
    type, 
    entityType, entityType, 
    entityId ? String(entityId) : null, entityId ? String(entityId) : null
  ]);

  if (recentDuplicate) {
    // Already notified recently for this specific item, avoid spamming recipient
    return null;
  }

  // Insert into notifications table
  const res = await query(`
    INSERT INTO notifications (user_id, actor_id, type, title, message, link, entity_type, entity_id, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP);
  `, [
    recipientId,
    cleanActorId,
    type,
    title.trim(),
    message.trim(),
    link.trim(),
    entityType || null,
    entityId ? String(entityId) : null
  ]);

  const notifId = res.insertId;

  // Fetch actor details for rich client rendering
  let actorInfo = null;
  if (cleanActorId) {
    const actorRow = await queryOne(`
      SELECT u.id, u.username, u.role, COALESCE(p.display_name, u.username) AS display_name, COALESCE(p.avatar, '/profile.png') AS avatar
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE u.id = ?;
    `, [cleanActorId]);

    if (actorRow) {
      actorInfo = {
        id: actorRow.id,
        username: actorRow.username,
        displayName: actorRow.display_name,
        avatar: sanitizeAvatar(actorRow.avatar),
        role: actorRow.role
      };
    }
  }

  const newNotif = {
    id: notifId,
    userId: recipientId,
    actorId: cleanActorId,
    actor: actorInfo,
    type,
    title,
    message,
    text: message,
    link,
    entityType,
    entityId,
    unread: true,
    isRead: false,
    time: 'Just now',
    createdAt: new Date().toISOString()
  };

  // Get updated unread count
  const unreadCount = await getUnreadNotificationsCount(recipientId);

  // 1. Real-time in-website delivery via SSE
  sendSseToUser(recipientId, 'notification', {
    notification: newNotif,
    unreadCount
  });

  // 2. Native Chrome Browser Push delivery via Web Push
  const pushPayload = {
    title: title,
    body: message,
    icon: actorInfo?.avatar || '/profile.png',
    badge: '/images/logo.png',
    tag: `rp-notif-${type}-${entityId || notifId}`,
    data: {
      url: link,
      notificationId: notifId
    }
  };

  sendWebPushNotification(recipientId, pushPayload).catch(e => {
    console.warn('[WebPush] Delivery warning:', e.message);
  });

  return newNotif;
}

/**
 * Get notification history for a user
 */
export async function getUserNotifications(userId, limit = 50) {
  const uId = Number(userId);
  const rows = await query(`
    SELECT 
      n.id, n.user_id, n.actor_id, n.type, n.title, n.message, n.link, 
      n.entity_type, n.entity_id, n.is_read, n.created_at,
      u.username AS actor_username, u.role AS actor_role,
      p.display_name AS actor_display_name, p.avatar AS actor_avatar
    FROM notifications n
    LEFT JOIN users u ON n.actor_id = u.id
    LEFT JOIN profiles p ON n.actor_id = p.user_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT ?;
  `, [uId, limit]);

  return rows.map(n => ({
    id: n.id,
    userId: n.user_id,
    actorId: n.actor_id,
    actor: n.actor_id ? {
      id: n.actor_id,
      username: n.actor_username,
      displayName: n.actor_display_name || n.actor_username,
      avatar: sanitizeAvatar(n.actor_avatar),
      role: n.actor_role || 'Member'
    } : null,
    type: n.type || 'announcement',
    title: n.title,
    message: n.message,
    text: n.message,
    link: n.link || '#home',
    entityType: n.entity_type,
    entityId: n.entity_id,
    unread: n.is_read === 0,
    isRead: n.is_read === 1,
    time: formatNotificationTime(n.created_at),
    createdAt: n.created_at
  }));
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationsCount(userId) {
  const uId = Number(userId);
  const row = await queryOne(`
    SELECT COUNT(*) AS count 
    FROM notifications 
    WHERE user_id = ? AND is_read = 0;
  `, [uId]);
  return Number(row?.count || 0);
}

/**
 * Mark a single notification as read
 */
export async function markNotificationReadInDb(notificationId, userId) {
  const notifId = Number(notificationId);
  const uId = Number(userId);

  await query(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE id = ? AND user_id = ?;
  `, [notifId, uId]);

  const unreadCount = await getUnreadNotificationsCount(uId);

  // Sync state across all open tabs of this user
  sendSseToUser(uId, 'unread_count', { unreadCount });

  return { success: true, unreadCount };
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsReadInDb(userId) {
  const uId = Number(userId);

  await query(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE user_id = ?;
  `, [uId]);

  // Sync state across all open tabs of this user
  sendSseToUser(uId, 'unread_count', { unreadCount: 0 });

  return { success: true, unreadCount: 0 };
}
