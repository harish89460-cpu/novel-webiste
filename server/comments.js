// Comments & Emoji Reactions Engine for Rudhra Prarthana Novels
// Dynamic SQLite Persistence with Duplicate-Prevention and Role-Based Permissions

import { getDb } from './db.js';

export const ALLOWED_EMOJIS = ['❤️', '👍', '😂', '😢', '😍', '🔥'];

/**
 * 1. Retrieve all comments for a specific novel or chapter
 */
export function getComments({ novelId, chapterNum = 0 }) {
  const db = getDb();
  const ch = parseInt(chapterNum || '0', 10);

  const query = `
    SELECT 
      c.id,
      c.novel_id,
      c.chapter_num,
      c.user_id,
      c.content,
      c.created_at,
      c.updated_at,
      u.username,
      u.role,
      p.display_name,
      p.display_name_ta,
      p.avatar
    FROM comments c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN profiles p ON c.user_id = p.user_id
    WHERE c.novel_id = ? AND c.chapter_num = ?
    ORDER BY c.created_at ASC;
  `;

  const rows = db.prepare(query).all(novelId, ch);

  return rows.map(r => ({
    id: r.id,
    novelId: r.novel_id,
    chapterNum: r.chapter_num,
    userId: r.user_id,
    username: r.username,
    role: r.role,
    displayName: r.display_name || r.username,
    displayNameTa: r.display_name_ta || r.display_name || r.username,
    avatar: r.avatar || '/profile.png',
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

/**
 * 2. Add a new comment
 */
export function addComment({ novelId, chapterNum = 0, userId, content }) {
  const db = getDb();
  const trimmed = (content || '').trim();

  if (!trimmed) {
    return { success: false, error: 'Comment cannot be empty.' };
  }
  if (trimmed.length > 3000) {
    return { success: false, error: 'Comment exceeds maximum allowed length of 3000 characters.' };
  }

  const ch = parseInt(chapterNum || '0', 10);

  const stmt = db.prepare(`
    INSERT INTO comments (novel_id, chapter_num, user_id, content)
    VALUES (?, ?, ?, ?);
  `);

  const res = stmt.run(novelId, ch, userId, trimmed);
  const commentId = Number(res.lastInsertRowid);

  // Increment user profile post/comment count
  try {
    db.prepare(`
      UPDATE profiles SET posts_count = posts_count + 1 WHERE user_id = ?;
    `).run(userId);
  } catch (err) {
    console.warn('Failed to increment posts_count', err);
  }

  // Fetch created comment
  const newComment = db.prepare(`
    SELECT 
      c.id,
      c.novel_id,
      c.chapter_num,
      c.user_id,
      c.content,
      c.created_at,
      c.updated_at,
      u.username,
      u.role,
      p.display_name,
      p.display_name_ta,
      p.avatar
    FROM comments c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN profiles p ON c.user_id = p.user_id
    WHERE c.id = ?;
  `).get(commentId);

  return {
    success: true,
    comment: {
      id: newComment.id,
      novelId: newComment.novel_id,
      chapterNum: newComment.chapter_num,
      userId: newComment.user_id,
      username: newComment.username,
      role: newComment.role,
      displayName: newComment.display_name || newComment.username,
      displayNameTa: newComment.display_name_ta || newComment.display_name || newComment.username,
      avatar: newComment.avatar || '/profile.png',
      content: newComment.content,
      createdAt: newComment.created_at,
      updatedAt: newComment.updated_at
    }
  };
}

/**
 * 3. Update an existing comment
 */
export function updateComment({ commentId, userId, userRole, content }) {
  const db = getDb();
  const trimmed = (content || '').trim();

  if (!trimmed) {
    return { success: false, error: 'Comment cannot be empty.' };
  }

  const comment = db.prepare('SELECT id, user_id FROM comments WHERE id = ?;').get(commentId);
  if (!comment) {
    return { success: false, error: 'Comment not found.' };
  }

  const isOwner = comment.user_id === userId;
  const isPrivileged = userRole === 'Admin' || userRole === 'Moderator';

  if (!isOwner && !isPrivileged) {
    return { success: false, error: 'You do not have permission to edit this comment.' };
  }

  db.prepare(`
    UPDATE comments 
    SET content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `).run(trimmed, commentId);

  return {
    success: true,
    commentId,
    content: trimmed
  };
}

/**
 * 4. Delete an existing comment
 */
export function deleteComment({ commentId, userId, userRole }) {
  const db = getDb();
  const comment = db.prepare('SELECT id, user_id FROM comments WHERE id = ?;').get(commentId);
  if (!comment) {
    return { success: false, error: 'Comment not found.' };
  }

  const isOwner = comment.user_id === userId;
  const isPrivileged = userRole === 'Admin' || userRole === 'Moderator';

  if (!isOwner && !isPrivileged) {
    return { success: false, error: 'You do not have permission to delete this comment.' };
  }

  db.prepare('DELETE FROM comments WHERE id = ?;').run(commentId);

  // Delete any reactions associated with this comment
  try {
    db.prepare("DELETE FROM reactions WHERE target_type = 'comment' AND target_id = ?;").run(String(commentId));
  } catch {}

  return { success: true, commentId };
}

/**
 * 5. Get reaction counts and current user's reaction for a target
 */
export function getReactions({ targetType, targetId, userId = null }) {
  const db = getDb();

  // Initialize all allowed emojis to 0
  const counts = {};
  for (const emoji of ALLOWED_EMOJIS) {
    counts[emoji] = 0;
  }

  const rows = db.prepare(`
    SELECT emoji, COUNT(*) as count 
    FROM reactions 
    WHERE target_type = ? AND target_id = ?
    GROUP BY emoji;
  `).all(targetType, targetId);

  for (const r of rows) {
    if (counts[r.emoji] !== undefined) {
      counts[r.emoji] = Number(r.count);
    }
  }

  let userReaction = null;
  if (userId) {
    const userRow = db.prepare(`
      SELECT emoji 
      FROM reactions 
      WHERE target_type = ? AND target_id = ? AND user_id = ?;
    `).get(targetType, targetId, userId);

    if (userRow) {
      userReaction = userRow.emoji;
    }
  }

  return {
    success: true,
    targetType,
    targetId,
    counts,
    userReaction
  };
}

/**
 * 6. Toggle or change emoji reaction for current user
 * - If user clicked the same emoji again -> remove reaction (toggle off)
 * - If user clicked a different emoji -> change reaction to new emoji (prevents duplicates)
 */
export function toggleReaction({ targetType, targetId, userId, emoji }) {
  const db = getDb();

  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return { success: false, error: 'Unsupported reaction emoji.' };
  }

  const existing = db.prepare(`
    SELECT id, emoji 
    FROM reactions 
    WHERE target_type = ? AND target_id = ? AND user_id = ?;
  `).get(targetType, targetId, userId);

  if (existing) {
    if (existing.emoji === emoji) {
      // Toggle off: Remove reaction
      db.prepare('DELETE FROM reactions WHERE id = ?;').run(existing.id);
    } else {
      // Switch reaction: Update to new emoji
      db.prepare('UPDATE reactions SET emoji = ? WHERE id = ?;').run(emoji, existing.id);
    }
  } else {
    // New reaction: Insert
    db.prepare(`
      INSERT INTO reactions (target_type, target_id, user_id, emoji)
      VALUES (?, ?, ?, ?);
    `).run(targetType, targetId, userId, emoji);
  }

  return getReactions({ targetType, targetId, userId });
}
