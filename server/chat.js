// Real-Time One-to-One Private Chat Service
// Rudhra Prarthana Novels — MySQL Relational Backend + SSE Delivery
// WhatsApp-like Features: Image/Audio Attachments, Voice Messages, Editing, Unsending, & Lock/Unlock Controls

import { query, queryOne, getDb } from './db.js';
import { sanitizeAvatar } from './auth.js';
import { sendSseToUser } from './notifications.js';

/**
 * Sanitize message content to prevent Stored XSS
 */
export function sanitizeMessageText(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
  return rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim();
}

/**
 * 1. Global Chat Availability Setting
 */
export async function getUserChatSettings(userId) {
  const row = await queryOne('SELECT is_chat_available FROM chat_settings WHERE user_id = ?;', [userId]);
  if (!row) {
    // Default is ON (1) per requirement
    await query('INSERT IGNORE INTO chat_settings (user_id, is_chat_available) VALUES (?, 1);', [userId]);
    return { isChatAvailable: true };
  }
  return { isChatAvailable: row.is_chat_available === 1 };
}

export async function updateUserChatSettings(userId, isChatAvailable) {
  const val = isChatAvailable ? 1 : 0;
  await query(`
    INSERT INTO chat_settings (user_id, is_chat_available)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE is_chat_available = VALUES(is_chat_available);
  `, [userId, val]);

  // Broadcast settings change to user's tabs
  sendSseToUser(userId, 'chat:settings', { isChatAvailable: val === 1 });

  return { success: true, isChatAvailable: val === 1 };
}

/**
 * 2. Individual User-to-User Chat Locks
 */
export async function getChatLockStatus(userId, targetUserId) {
  const [lockedByMeRow, lockedByThemRow] = await Promise.all([
    queryOne('SELECT 1 FROM chat_locks WHERE user_id = ? AND target_user_id = ?;', [userId, targetUserId]),
    queryOne('SELECT 1 FROM chat_locks WHERE user_id = ? AND target_user_id = ?;', [targetUserId, userId])
  ]);

  const isLockedByMe = Boolean(lockedByMeRow);
  const isLockedByThem = Boolean(lockedByThemRow);

  return {
    isLocked: isLockedByMe || isLockedByThem,
    isLockedByMe,
    isLockedByThem
  };
}

export async function toggleChatLock(userId, targetUserId, shouldLock) {
  if (Number(userId) === Number(targetUserId)) {
    return { success: false, error: 'Cannot lock yourself.' };
  }

  const target = await queryOne('SELECT id, username FROM users WHERE id = ?;', [targetUserId]);
  if (!target) {
    return { success: false, error: 'Target user not found.' };
  }

  if (shouldLock) {
    await query('INSERT IGNORE INTO chat_locks (user_id, target_user_id) VALUES (?, ?);', [userId, targetUserId]);
  } else {
    await query('DELETE FROM chat_locks WHERE user_id = ? AND target_user_id = ?;', [userId, targetUserId]);
  }

  const status = await getChatLockStatus(userId, targetUserId);

  // Notify target user of lock change in real-time
  sendSseToUser(targetUserId, 'chat:lock_change', {
    userId: Number(userId),
    isLockedByThem: shouldLock
  });

  return {
    success: true,
    targetUserId: Number(targetUserId),
    targetUsername: target.username,
    ...status
  };
}

/**
 * 3. Conversation-Level Lock / Unlock (Restricting / Restoring messaging)
 */
export async function toggleConversationLock(conversationId, userId, shouldLock, reason = '', userRole = 'reader') {
  const convId = Number(conversationId);
  const uId = Number(userId);
  const isAdmin = userRole?.toLowerCase() === 'admin';

  // Check user is participant or admin
  const participant = await queryOne('SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?;', [convId, uId]);
  if (!participant && !isAdmin) {
    return { success: false, error: 'Unauthorized to change lock on this conversation.', code: 'FORBIDDEN' };
  }

  const lockVal = shouldLock ? 1 : 0;
  const cleanReason = (reason || '').trim().substring(0, 255);

  await query(`
    UPDATE conversations
    SET is_locked = ?, locked_by = ?, locked_reason = ?, locked_at = NOW()
    WHERE id = ?;
  `, [lockVal, shouldLock ? uId : null, shouldLock ? cleanReason : null, convId]);

  // Notify participants in real time via SSE
  const participants = await query('SELECT user_id FROM conversation_participants WHERE conversation_id = ?;', [convId]);
  participants.forEach(p => {
    sendSseToUser(p.user_id, 'chat:conversation_lock', {
      conversationId: convId,
      isLocked: Boolean(shouldLock),
      lockedBy: uId,
      lockedReason: cleanReason
    });
  });

  return {
    success: true,
    conversationId: convId,
    isLocked: Boolean(shouldLock),
    lockedBy: uId,
    lockedReason: cleanReason
  };
}

/**
 * 4. Validation: Can User A send a message to User B?
 */
export async function canUsersChat(senderId, recipientId) {
  if (Number(senderId) === Number(recipientId)) {
    return { allowed: false, error: 'Cannot message yourself.', code: 'SELF' };
  }

  // 1. Check account status
  const [sender, recipient] = await Promise.all([
    queryOne("SELECT id, username, status FROM users WHERE id = ?;", [senderId]),
    queryOne("SELECT id, username, status FROM users WHERE id = ?;", [recipientId])
  ]);

  if (!sender || sender.status === 'blocked' || sender.status === 'pending_deletion') {
    return { allowed: false, error: 'Your account is not active.', code: 'INACTIVE_SENDER' };
  }
  if (!recipient || recipient.status === 'blocked' || recipient.status === 'pending_deletion') {
    return { allowed: false, error: 'This user account is no longer available.', code: 'UNAVAILABLE_RECIPIENT' };
  }

  // 2. Check Global Chat Availability
  const [senderSettings, recipientSettings] = await Promise.all([
    getUserChatSettings(senderId),
    getUserChatSettings(recipientId)
  ]);

  if (!recipientSettings.isChatAvailable) {
    return {
      allowed: false,
      error: 'This user is not accepting new messages.',
      code: 'RECIPIENT_CHAT_OFF'
    };
  }

  if (!senderSettings.isChatAvailable) {
    return {
      allowed: false,
      error: 'You cannot send messages while your chat availability is turned OFF. Please enable chat in settings.',
      code: 'SENDER_CHAT_OFF'
    };
  }

  // 3. Check Individual Chat Locks
  const lockStatus = await getChatLockStatus(senderId, recipientId);
  if (lockStatus.isLockedByThem) {
    return {
      allowed: false,
      error: 'Cannot send message: This conversation is locked by the recipient.',
      code: 'LOCKED_BY_RECIPIENT',
      lockStatus
    };
  }
  if (lockStatus.isLockedByMe) {
    return {
      allowed: false,
      error: 'Cannot send message: You have locked this conversation. Please unlock it to send messages.',
      code: 'LOCKED_BY_ME',
      lockStatus
    };
  }

  return { allowed: true, lockStatus };
}

/**
 * 5. Get or Create a 1-to-1 Conversation
 */
export async function getOrCreateConversation(userId, targetUserId) {
  const u1 = Number(userId);
  const u2 = Number(targetUserId);

  if (u1 === u2) {
    return { success: false, error: 'Cannot create conversation with yourself.' };
  }

  const target = await queryOne('SELECT id, username FROM users WHERE id = ?;', [u2]);
  if (!target) {
    return { success: false, error: 'Target user does not exist.' };
  }

  // Find existing conversation containing both participants
  const existing = await queryOne(`
    SELECT cp1.conversation_id
    FROM conversation_participants cp1
    INNER JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.user_id = ? AND cp2.user_id = ?
    LIMIT 1;
  `, [u1, u2]);

  if (existing) {
    return {
      success: true,
      id: existing.conversation_id,
      conversationId: existing.conversation_id,
      conversation: { id: existing.conversation_id },
      isNew: false
    };
  }

  // Check if eligible to initiate
  const permission = await canUsersChat(u1, u2);
  if (!permission.allowed) {
    return { success: false, error: permission.error, code: permission.code };
  }

  // Create new conversation inside a transaction
  const pool = getDb();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [convRes] = await conn.query('INSERT INTO conversations (last_message_at) VALUES (NOW());');
    const convId = convRes.insertId;

    await conn.query(`
      INSERT INTO conversation_participants (conversation_id, user_id, unread_count)
      VALUES (?, ?, 0), (?, ?, 0);
    `, [convId, u1, convId, u2]);

    await conn.commit();
    return {
      success: true,
      id: convId,
      conversationId: convId,
      conversation: { id: convId },
      isNew: true
    };
  } catch (err) {
    await conn.rollback();
    console.error('[Chat] Failed to create conversation:', err);
    return { success: false, error: 'Failed to create conversation.' };
  } finally {
    conn.release();
  }
}

/**
 * 6. Get User Conversations List (Sorted by Latest Activity)
 */
export async function getUserConversations(userId) {
  const uId = Number(userId);

  const rows = await query(`
    SELECT
      c.id AS conversation_id,
      c.last_message_at,
      c.is_locked AS conversation_is_locked,
      c.locked_by AS conversation_locked_by,
      c.locked_reason AS conversation_locked_reason,
      cp_me.unread_count,
      cp_me.last_read_at,
      other.id AS other_user_id,
      other.username AS other_username,
      other.role AS other_role,
      p.display_name AS other_display_name,
      p.avatar AS other_avatar,
      ast.is_online AS other_is_online,
      ast.last_seen AS other_last_seen,
      cs.is_chat_available AS other_is_chat_available,
      m.id AS last_message_id,
      m.sender_id AS last_message_sender_id,
      m.content AS last_message_content,
      m.message_type AS last_message_type,
      m.attachment_url AS last_message_attachment_url,
      m.is_deleted AS last_message_is_deleted,
      m.created_at AS last_message_created_at,
      m.is_read AS last_message_is_read
    FROM conversation_participants cp_me
    INNER JOIN conversations c ON c.id = cp_me.conversation_id
    LEFT JOIN conversation_participants cp_other ON cp_other.conversation_id = c.id AND cp_other.user_id != cp_me.user_id
    LEFT JOIN users other ON other.id = cp_other.user_id
    LEFT JOIN profiles p ON p.user_id = other.id
    LEFT JOIN activity_status ast ON ast.user_id = other.id
    LEFT JOIN chat_settings cs ON cs.user_id = other.id
    LEFT JOIN (
      SELECT m1.*
      FROM messages m1
      INNER JOIN (
        SELECT conversation_id, MAX(id) AS max_id
        FROM messages
        GROUP BY conversation_id
      ) m2 ON m1.id = m2.max_id
    ) m ON m.conversation_id = c.id
    WHERE cp_me.user_id = ?
    ORDER BY c.last_message_at DESC, c.id DESC;
  `, [uId]);

  // Fetch lock statuses for each otherUser in parallel
  const conversations = await Promise.all(rows.map(async r => {
    const otherUserId = r.other_user_id || 0;
    const lockStatus = otherUserId ? await getChatLockStatus(uId, otherUserId) : { isLocked: false, isLockedByMe: false, isLockedByThem: false };
    const otherIsChatAvailable = r.other_is_chat_available !== 0;

    let canSend = true;
    let blockReason = null;

    if (r.conversation_is_locked) {
      canSend = false;
      blockReason = r.conversation_locked_reason || 'This conversation is locked.';
    } else if (!otherIsChatAvailable) {
      canSend = false;
      blockReason = 'This user is not accepting new messages.';
    } else if (lockStatus.isLockedByThem) {
      canSend = false;
      blockReason = 'This conversation is locked by the other participant.';
    } else if (lockStatus.isLockedByMe) {
      canSend = false;
      blockReason = 'You have locked this conversation.';
    }

    const otherUserObj = {
      id: r.other_user_id || 0,
      username: r.other_username || 'Member',
      displayName: r.other_display_name || r.other_username || 'Member',
      display_name: r.other_display_name || r.other_username || 'Member',
      avatar: sanitizeAvatar(r.other_avatar),
      role: r.other_role || 'reader',
      isOnline: Boolean(r.other_is_online),
      is_online: Boolean(r.other_is_online),
      lastSeen: r.other_last_seen,
      last_seen: r.other_last_seen,
      isChatAvailable: otherIsChatAvailable,
      is_chat_available: otherIsChatAvailable,
      isLockedByMe: lockStatus.isLockedByMe,
      isLockedByThem: lockStatus.isLockedByThem
    };

    let snippet = '';
    if (r.last_message_id) {
      if (r.last_message_is_deleted) {
        snippet = '🚫 This message was deleted';
      } else if (r.last_message_type === 'image') {
        snippet = '📷 ' + (r.last_message_content || 'Photo');
      } else if (r.last_message_type === 'audio') {
        snippet = '🎙️ Voice message';
      } else {
        snippet = r.last_message_content || '';
      }
    }

    const lastMsgObj = r.last_message_id ? {
      id: r.last_message_id,
      senderId: r.last_message_sender_id,
      sender_id: r.last_message_sender_id,
      isMe: r.last_message_sender_id === uId,
      is_me: r.last_message_sender_id === uId,
      content: r.last_message_is_deleted ? 'This message was deleted' : r.last_message_content,
      messageType: r.last_message_type || 'text',
      message_type: r.last_message_type || 'text',
      attachmentUrl: r.last_message_attachment_url,
      attachment_url: r.last_message_attachment_url,
      isDeleted: Boolean(r.last_message_is_deleted),
      is_deleted: Boolean(r.last_message_is_deleted),
      createdAt: r.last_message_created_at,
      created_at: r.last_message_created_at,
      isRead: Boolean(r.last_message_is_read),
      is_read: Boolean(r.last_message_is_read)
    } : null;

    return {
      id: r.conversation_id,
      conversationId: r.conversation_id,
      isLocked: Boolean(r.conversation_is_locked),
      is_locked: Boolean(r.conversation_is_locked),
      lockedBy: r.conversation_locked_by,
      locked_by: r.conversation_locked_by,
      lockedReason: r.conversation_locked_reason,
      locked_reason: r.conversation_locked_reason,
      lastMessageAt: r.last_message_at,
      last_message_at: r.last_message_at,
      unreadCount: Number(r.unread_count || 0),
      unread_count: Number(r.unread_count || 0),
      otherUser: otherUserObj,
      other_user: otherUserObj,
      lastMessage: lastMsgObj,
      last_message: snippet,
      canSend,
      blockReason,
      lockStatus
    };
  }));

  return { success: true, conversations };
}

/**
 * 7. Get Message History in a Conversation
 */
export async function getConversationMessages(conversationId, userId, { limit = 80, beforeId = null } = {}) {
  const convId = Number(conversationId);
  const uId = Number(userId);

  // Authorization check: Verify user is a participant or admin
  const participant = await queryOne(`
    SELECT * FROM conversation_participants
    WHERE conversation_id = ? AND user_id = ?;
  `, [convId, uId]);

  const userRecord = await queryOne('SELECT role FROM users WHERE id = ?;', [uId]);
  const isAdmin = userRecord?.role?.toLowerCase() === 'admin';

  if (!participant && !isAdmin) {
    return { success: false, error: 'Unauthorized: You are not a participant in this conversation.', code: 'FORBIDDEN' };
  }

  // Conversation lock info
  const convRow = await queryOne('SELECT is_locked, locked_by, locked_reason FROM conversations WHERE id = ?;', [convId]);
  const isConvLocked = Boolean(convRow?.is_locked);

  // Get other participant info
  const otherRow = await queryOne(`
    SELECT
      u.id, u.username, u.role, u.status,
      p.display_name, p.avatar,
      ast.is_online, ast.last_seen,
      cs.is_chat_available
    FROM conversation_participants cp
    INNER JOIN users u ON u.id = cp.user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN activity_status ast ON ast.user_id = u.id
    LEFT JOIN chat_settings cs ON cs.user_id = u.id
    WHERE cp.conversation_id = ? AND cp.user_id != ?;
  `, [convId, uId]);

  const otherUser = otherRow ? {
    id: otherRow.id,
    username: otherRow.username,
    displayName: otherRow.display_name || otherRow.username,
    display_name: otherRow.display_name || otherRow.username,
    avatar: sanitizeAvatar(otherRow.avatar),
    role: otherRow.role || 'reader',
    isOnline: Boolean(otherRow.is_online),
    is_online: Boolean(otherRow.is_online),
    lastSeen: otherRow.last_seen,
    last_seen: otherRow.last_seen,
    isChatAvailable: otherRow.is_chat_available !== 0,
    is_chat_available: otherRow.is_chat_available !== 0
  } : {
    id: 0,
    username: 'Member',
    displayName: 'Member',
    display_name: 'Member',
    avatar: '/profile.png',
    role: 'reader',
    isOnline: false,
    is_online: false,
    lastSeen: null,
    last_seen: null,
    isChatAvailable: true,
    is_chat_available: true
  };

  // Mark all unread incoming messages as read
  await query(`
    UPDATE messages
    SET is_read = 1, read_at = NOW()
    WHERE conversation_id = ? AND sender_id != ? AND is_read = 0;
  `, [convId, uId]);

  // Reset unread_count for me in conversation_participants
  await query(`
    UPDATE conversation_participants
    SET unread_count = 0, last_read_at = NOW()
    WHERE conversation_id = ? AND user_id = ?;
  `, [convId, uId]);

  // Notify other user that their messages were read
  if (otherUser && otherUser.id) {
    sendSseToUser(otherUser.id, 'chat:read', {
      conversationId: convId,
      readByUserId: uId,
      readAt: new Date().toISOString()
    });
  }

  // Fetch messages
  let messagesQuery = `
    SELECT
      m.id,
      m.conversation_id,
      m.sender_id,
      m.content,
      m.message_type,
      m.attachment_url,
      m.attachment_meta,
      m.is_edited,
      m.edited_at,
      m.is_deleted,
      m.deleted_at,
      m.is_read,
      m.read_at,
      m.created_at,
      u.username AS sender_username,
      p.display_name AS sender_display_name,
      p.avatar AS sender_avatar
    FROM messages m
    INNER JOIN users u ON u.id = m.sender_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE m.conversation_id = ?
  `;
  const params = [convId];

  if (beforeId) {
    messagesQuery += ' AND m.id < ?';
    params.push(Number(beforeId));
  }

  messagesQuery += ' ORDER BY m.id ASC LIMIT ?;';
  params.push(Number(limit));

  const msgRows = await query(messagesQuery, params);

  const messages = msgRows.map(m => {
    let meta = null;
    if (m.attachment_meta) {
      try {
        meta = typeof m.attachment_meta === 'string' ? JSON.parse(m.attachment_meta) : m.attachment_meta;
      } catch {}
    }

    const isDel = Boolean(m.is_deleted);

    return {
      id: m.id,
      conversationId: m.conversation_id,
      conversation_id: m.conversation_id,
      senderId: m.sender_id,
      sender_id: m.sender_id,
      isMe: m.sender_id === uId,
      is_me: m.sender_id === uId,
      sender: {
        id: m.sender_id,
        username: m.sender_username,
        displayName: m.sender_display_name || m.sender_username,
        display_name: m.sender_display_name || m.sender_username,
        avatar: sanitizeAvatar(m.sender_avatar)
      },
      content: isDel ? 'This message was deleted' : m.content,
      messageType: m.message_type || 'text',
      message_type: m.message_type || 'text',
      attachmentUrl: isDel ? null : m.attachment_url,
      attachment_url: isDel ? null : m.attachment_url,
      attachmentMeta: isDel ? null : meta,
      attachment_meta: isDel ? null : meta,
      isEdited: Boolean(m.is_edited),
      is_edited: Boolean(m.is_edited),
      editedAt: m.edited_at,
      edited_at: m.edited_at,
      isDeleted: isDel,
      is_deleted: isDel,
      deletedAt: m.deleted_at,
      deleted_at: m.deleted_at,
      isRead: Boolean(m.is_read),
      is_read: Boolean(m.is_read),
      readAt: m.read_at,
      read_at: m.read_at,
      createdAt: m.created_at,
      created_at: m.created_at
    };
  });

  // Check current lock status and sending permission
  let canSend = true;
  let blockReason = null;
  let lockStatus = { isLocked: false, isLockedByMe: false, isLockedByThem: false };

  if (isConvLocked) {
    canSend = false;
    blockReason = convRow?.locked_reason || 'This conversation is locked.';
  } else if (otherUser && otherUser.id) {
    const permission = await canUsersChat(uId, otherUser.id);
    canSend = permission.allowed;
    blockReason = permission.allowed ? null : permission.error;
    lockStatus = permission.lockStatus || (await getChatLockStatus(uId, otherUser.id));
  }

  // Update total badge
  const unreadTotal = await getTotalUnreadChatCount(uId);

  const conversationObj = {
    id: convId,
    conversationId: convId,
    isLocked: isConvLocked,
    is_locked: isConvLocked,
    lockedBy: convRow?.locked_by || null,
    locked_by: convRow?.locked_by || null,
    lockedReason: convRow?.locked_reason || null,
    locked_reason: convRow?.locked_reason || null,
    otherUser,
    other_user: otherUser,
    canSend,
    blockReason,
    lockStatus
  };

  return {
    success: true,
    id: convId,
    conversationId: convId,
    conversation: conversationObj,
    otherUser,
    other_user: otherUser,
    isLocked: isConvLocked,
    is_locked: isConvLocked,
    lockedBy: convRow?.locked_by || null,
    locked_by: convRow?.locked_by || null,
    lockedReason: convRow?.locked_reason || null,
    locked_reason: convRow?.locked_reason || null,
    isChatAvailable: otherUser ? otherUser.isChatAvailable : true,
    messages,
    canSend,
    blockReason,
    lockStatus,
    unreadTotal
  };
}

/**
 * 8. Send a Message (Text, Image attachment, or Voice note)
 */
export async function sendMessage(conversationId, senderId, payloadOrContent) {
  const convId = Number(conversationId);
  const sId = Number(senderId);

  let content = '';
  let messageType = 'text';
  let attachmentUrl = null;
  let attachmentMeta = null;

  if (typeof payloadOrContent === 'string') {
    content = payloadOrContent;
  } else if (payloadOrContent && typeof payloadOrContent === 'object') {
    content = payloadOrContent.content || '';
    messageType = payloadOrContent.messageType || payloadOrContent.type || 'text';
    attachmentUrl = payloadOrContent.attachmentUrl || payloadOrContent.url || null;
    attachmentMeta = payloadOrContent.attachmentMeta || payloadOrContent.meta || null;
  }

  content = sanitizeMessageText(content);

  if (messageType === 'text') {
    if (!content || content.length === 0) {
      return { success: false, error: 'Message cannot be empty.' };
    }
    if (content.length > 4000) {
      return { success: false, error: 'Message exceeds the 4,000 character limit.' };
    }
  } else if (messageType === 'image' || messageType === 'audio') {
    if (!attachmentUrl) {
      return { success: false, error: `${messageType === 'image' ? 'Image' : 'Voice'} attachment is required.` };
    }
  } else {
    messageType = 'text';
  }

  // 1. Verify sender is a participant
  const participant = await queryOne(`
    SELECT * FROM conversation_participants
    WHERE conversation_id = ? AND user_id = ?;
  `, [convId, sId]);

  if (!participant) {
    return { success: false, error: 'Unauthorized: You are not a participant in this conversation.', code: 'FORBIDDEN' };
  }

  // 2. Check conversation-level lock
  const conv = await queryOne('SELECT is_locked, locked_by, locked_reason FROM conversations WHERE id = ?;', [convId]);
  if (conv && conv.is_locked) {
    return {
      success: false,
      error: conv.locked_reason || 'This conversation is locked. Messaging is restricted.',
      code: 'CONVERSATION_LOCKED'
    };
  }

  // 3. Identify recipient
  const recipientRow = await queryOne(`
    SELECT user_id FROM conversation_participants
    WHERE conversation_id = ? AND user_id != ?
    LIMIT 1;
  `, [convId, sId]);

  if (!recipientRow) {
    return { success: false, error: 'Recipient not found in conversation.' };
  }
  const rId = Number(recipientRow.user_id);

  // 4. Strict Precedence Validation: Global availability + Individual Locks
  const permission = await canUsersChat(sId, rId);
  if (!permission.allowed) {
    return {
      success: false,
      error: permission.error,
      code: permission.code,
      lockStatus: permission.lockStatus
    };
  }

  // 5. Insert message and update conversation timestamps atomically
  const pool = getDb();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [msgRes] = await conn.query(`
      INSERT INTO messages (conversation_id, sender_id, content, message_type, attachment_url, attachment_meta, is_read)
      VALUES (?, ?, ?, ?, ?, ?, 0);
    `, [convId, sId, content, messageType, attachmentUrl, attachmentMeta ? JSON.stringify(attachmentMeta) : null]);

    const messageId = msgRes.insertId;

    // Update conversation last_message_at
    await conn.query(`
      UPDATE conversations
      SET last_message_at = NOW()
      WHERE id = ?;
    `, [convId]);

    // Increment recipient's unread_count
    await conn.query(`
      UPDATE conversation_participants
      SET unread_count = unread_count + 1
      WHERE conversation_id = ? AND user_id = ?;
    `, [convId, rId]);

    await conn.commit();

    // Fetch sender profile for the broadcast payload
    const senderProfile = await queryOne(`
      SELECT u.username, u.role, p.display_name, p.avatar
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = ?;
    `, [sId]);

    const messagePayload = {
      id: messageId,
      conversationId: convId,
      senderId: sId,
      content,
      messageType,
      message_type: messageType,
      attachmentUrl,
      attachment_url: attachmentUrl,
      attachmentMeta,
      attachment_meta: attachmentMeta,
      isEdited: false,
      editedAt: null,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      isRead: false,
      sender: {
        id: sId,
        username: senderProfile?.username || 'Member',
        displayName: senderProfile?.display_name || senderProfile?.username || 'Member',
        avatar: sanitizeAvatar(senderProfile?.avatar)
      }
    };

    // 6. Real-Time Delivery via SSE
    const recipientUnreadTotal = await getTotalUnreadChatCount(rId);

    // Broadcast to recipient
    sendSseToUser(rId, 'chat:message', {
      conversationId: convId,
      message: messagePayload,
      unreadTotal: recipientUnreadTotal
    });

    // Broadcast to sender (multi-tab sync)
    sendSseToUser(sId, 'chat:message_sent', {
      conversationId: convId,
      message: messagePayload
    });

    return {
      success: true,
      message: messagePayload
    };
  } catch (err) {
    await conn.rollback();
    console.error('[Chat] Failed to send message:', err);
    return { success: false, error: 'Database error sending message.' };
  } finally {
    conn.release();
  }
}

/**
 * 9. Edit Message (Sender only, within permission rules)
 */
export async function editMessage(messageId, userId, newRawContent) {
  const mId = Number(messageId);
  const uId = Number(userId);

  const msg = await queryOne('SELECT * FROM messages WHERE id = ?;', [mId]);
  if (!msg) {
    return { success: false, error: 'Message not found.', code: 'NOT_FOUND' };
  }
  if (msg.sender_id !== uId) {
    return { success: false, error: 'Unauthorized: You can only edit your own messages.', code: 'FORBIDDEN' };
  }
  if (msg.is_deleted) {
    return { success: false, error: 'Cannot edit a deleted message.', code: 'ALREADY_DELETED' };
  }
  if (msg.message_type !== 'text') {
    return { success: false, error: 'Only text messages can be edited.', code: 'INVALID_TYPE' };
  }

  const content = sanitizeMessageText(newRawContent);
  if (!content || content.length === 0) {
    return { success: false, error: 'Message cannot be empty.' };
  }
  if (content.length > 4000) {
    return { success: false, error: 'Message exceeds the 4,000 character limit.' };
  }

  const now = new Date();
  await query(`
    UPDATE messages
    SET content = ?, is_edited = 1, edited_at = NOW()
    WHERE id = ?;
  `, [content, mId]);

  // Notify participants in conversation
  const participants = await query(`
    SELECT user_id FROM conversation_participants WHERE conversation_id = ?;
  `, [msg.conversation_id]);

  participants.forEach(p => {
    sendSseToUser(p.user_id, 'chat:message_edited', {
      conversationId: msg.conversation_id,
      messageId: mId,
      content,
      isEdited: true,
      editedAt: now.toISOString()
    });
  });

  return {
    success: true,
    message: {
      id: mId,
      conversationId: msg.conversation_id,
      content,
      isEdited: true,
      editedAt: now.toISOString()
    }
  };
}

/**
 * 10. Unsend / Delete Message (Sender or Admin only)
 */
export async function unsendMessage(messageId, userId, userRole = 'reader') {
  const mId = Number(messageId);
  const uId = Number(userId);

  const msg = await queryOne('SELECT * FROM messages WHERE id = ?;', [mId]);
  if (!msg) {
    return { success: false, error: 'Message not found.', code: 'NOT_FOUND' };
  }

  const isAdmin = userRole?.toLowerCase() === 'admin';
  if (msg.sender_id !== uId && !isAdmin) {
    return { success: false, error: 'Unauthorized: You can only unsend your own messages.', code: 'FORBIDDEN' };
  }

  if (msg.is_deleted) {
    return { success: true, messageId: mId, alreadyDeleted: true };
  }

  const now = new Date();
  await query(`
    UPDATE messages
    SET is_deleted = 1, deleted_at = NOW(), deleted_by = ?
    WHERE id = ?;
  `, [uId, mId]);

  // Notify participants in conversation
  const participants = await query(`
    SELECT user_id FROM conversation_participants WHERE conversation_id = ?;
  `, [msg.conversation_id]);

  participants.forEach(p => {
    sendSseToUser(p.user_id, 'chat:message_deleted', {
      conversationId: msg.conversation_id,
      messageId: mId,
      isDeleted: true,
      deletedAt: now.toISOString(),
      deletedBy: uId
    });
  });

  return {
    success: true,
    messageId: mId,
    conversationId: msg.conversation_id,
    isDeleted: true
  };
}

/**
 * 11. Total Unread Chat Count for Badge
 */
export async function getTotalUnreadChatCount(userId) {
  const row = await queryOne(`
    SELECT COALESCE(SUM(unread_count), 0) AS total_unread
    FROM conversation_participants
    WHERE user_id = ?;
  `, [userId]);
  return Number(row?.total_unread || 0);
}

/**
 * 12. Search Eligible Users for New Conversations
 */
export async function getEligibleChatUsers(currentUserId, search = '') {
  const uId = Number(currentUserId);
  const cleanSearch = (search || '').trim().toLowerCase();

  let sql = `
    SELECT
      u.id,
      u.username,
      u.role,
      u.status,
      p.display_name,
      p.avatar,
      ast.is_online,
      ast.last_seen,
      cs.is_chat_available
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN activity_status ast ON ast.user_id = u.id
    LEFT JOIN chat_settings cs ON cs.user_id = u.id
    WHERE u.id != ? AND (u.status = 'active' OR u.status IS NULL)
  `;
  const params = [uId];

  if (cleanSearch) {
    sql += ` AND (LOWER(u.username) LIKE ? OR LOWER(p.display_name) LIKE ?)`;
    params.push(`%${cleanSearch}%`, `%${cleanSearch}%`);
  }

  sql += ' ORDER BY ast.is_online DESC, u.id ASC LIMIT 30;';

  const rows = await query(sql, params);

  const users = await Promise.all(rows.map(async r => {
    const lockStatus = await getChatLockStatus(uId, r.id);
    return {
      id: r.id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatar: sanitizeAvatar(r.avatar),
      role: r.role || 'reader',
      isOnline: Boolean(r.is_online),
      lastSeen: r.last_seen,
      isChatAvailable: r.is_chat_available !== 0,
      isLockedByMe: lockStatus.isLockedByMe,
      isLockedByThem: lockStatus.isLockedByThem
    };
  }));

  return { success: true, users };
}

/**
 * =========================================================================
 * 13. Administrator Writer Chat Audit Features
 * STRICT PRIVACY BOUNDARY: Only writer/author conversations may be audited!
 * =========================================================================
 */

export function isWriterOrAuthor(role) {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === 'writer' || r === 'author';
}

export async function getAdminWritersList(adminId) {
  const admin = await queryOne('SELECT id, role FROM users WHERE id = ?;', [adminId]);
  if (!admin || admin.role?.toLowerCase() !== 'admin') {
    return { success: false, error: 'Unauthorized: Administrator access required.', code: 'FORBIDDEN' };
  }

  const writers = await query(`
    SELECT DISTINCT
      u.id,
      u.username,
      u.email,
      u.role,
      p.display_name,
      p.avatar,
      ast.is_online,
      ast.last_seen,
      COUNT(DISTINCT cp.conversation_id) AS total_conversations,
      MAX(c.last_message_at) AS latest_activity
    FROM users u
    INNER JOIN conversation_participants cp ON cp.user_id = u.id
    INNER JOIN conversations c ON c.id = cp.conversation_id
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN activity_status ast ON ast.user_id = u.id
    WHERE LOWER(u.role) IN ('writer', 'author')
    GROUP BY u.id
    ORDER BY latest_activity DESC, total_conversations DESC;
  `);

  return {
    success: true,
    writers: writers.map(w => ({
      id: w.id,
      username: w.username,
      displayName: w.display_name || w.username,
      email: w.email,
      role: w.role,
      avatar: sanitizeAvatar(w.avatar),
      isOnline: Boolean(w.is_online),
      lastSeen: w.last_seen,
      totalConversations: Number(w.total_conversations || 0),
      latestActivity: w.latest_activity
    }))
  };
}

export async function getAdminWriterConversations(adminId, writerId) {
  const admin = await queryOne('SELECT id, role FROM users WHERE id = ?;', [adminId]);
  if (!admin || admin.role?.toLowerCase() !== 'admin') {
    return { success: false, error: 'Unauthorized: Administrator access required.', code: 'FORBIDDEN' };
  }

  const wId = Number(writerId);
  const writer = await queryOne('SELECT id, username, role FROM users WHERE id = ?;', [wId]);
  if (!writer || !isWriterOrAuthor(writer.role)) {
    return { success: false, error: 'Selected user is not a writer or author.', code: 'INVALID_TARGET' };
  }

  const rows = await query(`
    SELECT
      c.id AS conversation_id,
      c.last_message_at,
      other.id AS other_user_id,
      other.username AS other_username,
      other.role AS other_role,
      p.display_name AS other_display_name,
      p.avatar AS other_avatar,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) AS total_messages,
      m.content AS last_message_content,
      m.created_at AS last_message_created_at
    FROM conversation_participants cp_writer
    INNER JOIN conversations c ON c.id = cp_writer.conversation_id
    INNER JOIN conversation_participants cp_other ON cp_other.conversation_id = c.id AND cp_other.user_id != cp_writer.user_id
    INNER JOIN users other ON other.id = cp_other.user_id
    LEFT JOIN profiles p ON p.user_id = other.id
    LEFT JOIN (
      SELECT m1.*
      FROM messages m1
      INNER JOIN (
        SELECT conversation_id, MAX(id) AS max_id
        FROM messages
        GROUP BY conversation_id
      ) m2 ON m1.id = m2.max_id
    ) m ON m.conversation_id = c.id
    WHERE cp_writer.user_id = ?
    ORDER BY c.last_message_at DESC;
  `, [wId]);

  return {
    success: true,
    writer: {
      id: writer.id,
      username: writer.username,
      role: writer.role
    },
    conversations: rows.map(r => {
      const otherUserObj = {
        id: r.other_user_id,
        username: r.other_username,
        displayName: r.other_display_name || r.other_username,
        display_name: r.other_display_name || r.other_username,
        role: r.other_role || 'reader',
        avatar: sanitizeAvatar(r.other_avatar)
      };
      return {
        id: r.conversation_id,
        conversationId: r.conversation_id,
        lastMessageAt: r.last_message_at,
        last_message_at: r.last_message_at,
        totalMessages: Number(r.total_messages || 0),
        otherParticipant: otherUserObj,
        otherUser: otherUserObj,
        other_user: otherUserObj,
        lastMessage: r.last_message_content ? {
          content: r.last_message_content,
          createdAt: r.last_message_created_at
        } : null,
        last_message: r.last_message_content || ''
      };
    })
  };
}

export async function getAdminWriterChatHistory(adminId, conversationId, { ipAddress = null } = {}) {
  const admin = await queryOne('SELECT id, username, role FROM users WHERE id = ?;', [adminId]);
  if (!admin || admin.role?.toLowerCase() !== 'admin') {
    return { success: false, error: 'Unauthorized: Administrator access required.', code: 'FORBIDDEN' };
  }

  const convId = Number(conversationId);

  const participants = await query(`
    SELECT
      u.id, u.username, u.role, u.email,
      p.display_name, p.avatar
    FROM conversation_participants cp
    INNER JOIN users u ON u.id = cp.user_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE cp.conversation_id = ?;
  `, [convId]);

  if (participants.length === 0) {
    return { success: false, error: 'Conversation not found.', code: 'NOT_FOUND' };
  }

  const hasWriterParticipant = participants.some(p => isWriterOrAuthor(p.role));

  if (!hasWriterParticipant) {
    return {
      success: false,
      error: 'Access Denied: Administrators are strictly restricted to inspecting conversations involving writers or authors. Member-to-member conversations cannot be audited.',
      code: 'PRIVACY_VIOLATION'
    };
  }

  const writerParticipant = participants.find(p => isWriterOrAuthor(p.role));

  await query(`
    INSERT INTO admin_chat_audit_logs (admin_id, writer_id, conversation_id, action, ip_address)
    VALUES (?, ?, ?, 'view_writer_history', ?);
  `, [adminId, writerParticipant.id, convId, ipAddress || '127.0.0.1']);

  const messages = await query(`
    SELECT
      m.id,
      m.sender_id,
      m.content,
      m.message_type,
      m.attachment_url,
      m.is_edited,
      m.is_deleted,
      m.is_read,
      m.read_at,
      m.created_at,
      u.username AS sender_username,
      u.role AS sender_role,
      p.display_name AS sender_display_name,
      p.avatar AS sender_avatar
    FROM messages m
    INNER JOIN users u ON u.id = m.sender_id
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.id ASC;
  `, [convId]);

  return {
    success: true,
    isReadOnly: true,
    conversationId: convId,
    participants: participants.map(p => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name || p.username,
      role: p.role,
      avatar: sanitizeAvatar(p.avatar)
    })),
    messages: messages.map(m => ({
      id: m.id,
      senderId: m.sender_id,
      sender: {
        id: m.sender_id,
        username: m.sender_username,
        displayName: m.sender_display_name || m.sender_username,
        role: m.sender_role,
        avatar: sanitizeAvatar(m.sender_avatar)
      },
      content: m.is_deleted ? 'This message was deleted' : m.content,
      messageType: m.message_type || 'text',
      attachmentUrl: m.is_deleted ? null : m.attachment_url,
      isEdited: Boolean(m.is_edited),
      isDeleted: Boolean(m.is_deleted),
      isRead: Boolean(m.is_read),
      readAt: m.read_at,
      createdAt: m.created_at
    }))
  };
}
