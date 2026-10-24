// Comments & Emoji Reactions Engine for Rudhra Prarthana Novels
// Dynamic MySQL Persistence with Duplicate-Prevention and Role-Based Permissions

import { query, queryOne } from './db.js';
import { generateNovelSlug } from './novels.js';
import { createNotification } from './notifications.js';

// The allowed episode & forum reactions: ❤️ Love, 👍 Like, 👏 Clap, 😂 Laugh, 😮 Surprise, 😍 Adore, 😢 Sad, and 😭 Cry
export const ALLOWED_EMOJIS = ['❤️', '👍', '👏', '😂', '😮', '😍', '😢', '😭'];

export const EMOJI_LABELS = {
  '❤️': 'Love',
  '👍': 'Like',
  '👏': 'Clap',
  '😂': 'Laugh',
  '😮': 'Surprise',
  '😍': 'Adore',
  '😢': 'Sad',
  '😭': 'Cry'
};

/**
 * Sanitize comment HTML to permit formatting, styling (font size, color, alignment),
 * safe links, quotes, code, and validated images while strictly preventing XSS.
 */
export function sanitizeCommentHtml(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let html = raw.trim();

  // 1. Strip dangerous tags and their contents
  html = html.replace(/<\s*(script|style|iframe|object|embed|applet|form|input|button|textarea|select|svg|math|meta|link|base)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  html = html.replace(/<\s*(script|style|iframe|object|embed|applet|form|input|button|textarea|select|svg|math|meta|link|base)[^>]*\/?>/gi, '');

  // 2. Strip on* event handlers (e.g. onerror=, onclick=)
  html = html.replace(/\s+on[a-zA-Z]+\s*=\s*(['\"]).*?\1/gi, '');
  html = html.replace(/\s+on[a-zA-Z]+\s*=\s*[^>\s]+/gi, '');

  // 3. Sanitize links (<a> tags)
  html = html.replace(/<\s*a\b([^>]*)>/gi, (match, attrs) => {
    const hrefMatch = attrs.match(/href\s*=\s*(['"])(.*?)\1/i) || attrs.match(/href\s*=\s*([^>\s]+)/i);
    let href = hrefMatch ? (hrefMatch[2] || hrefMatch[1]) : '';
    href = href.trim();
    if (!href || !/^https?:\/\//i.test(href)) {
      return '<span>';
    }
    const cleanHref = href.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<a href="${cleanHref}" target="_blank" rel="noopener noreferrer" class="rp-comment-link">`;
  });

  // 4. Sanitize images (<img> tags)
  html = html.replace(/<\s*img\b([^>]*)>/gi, (match, attrs) => {
    const srcMatch = attrs.match(/src\s*=\s*(['"])(.*?)\1/i) || attrs.match(/src\s*=\s*([^>\s]+)/i);
    let src = srcMatch ? (srcMatch[2] || srcMatch[1]) : '';
    src = src.trim();
    const altMatch = attrs.match(/alt\s*=\s*(['"])(.*?)\1/i);
    const alt = altMatch ? (altMatch[2] || altMatch[1]).replace(/"/g, '&quot;') : 'Comment image';

    if (!src || (!/^https?:\/\//i.test(src) && !src.startsWith('/uploads/') && !/^data:image\/(jpeg|jpg|png|webp|gif);base64,/i.test(src))) {
      return '';
    }
    const cleanSrc = src.replace(/"/g, '&quot;');
    return `<img src="${cleanSrc}" alt="${alt}" class="rp-comment-img" loading="lazy" />`;
  });

  // 5. Sanitize text styling (font-family, font-size, color, background-color, text-align) on block and inline tags
  html = html.replace(/<\s*(p|div|span|blockquote|h1|h2|h3|h4|h5|h6|ul|ol|li)\b([^>]*)>/gi, (match, tag, attrs) => {
    const cleanStyles = [];
    const styleMatch = attrs.match(/style\s*=\s*(['"])(.*?)\1/i);
    if (styleMatch) {
      const styleVal = styleMatch[2] || styleMatch[1];

      // Text alignment
      const alignMatch = styleVal.match(/text-align\s*:\s*(left|center|right|justify)/i);
      if (alignMatch) {
        cleanStyles.push(`text-align: ${alignMatch[1].toLowerCase()}`);
      }

      // Font family (safe list)
      const fontMatch = styleVal.match(/(?:^|;)\s*font-family\s*:\s*([^;]+)/i);
      if (fontMatch) {
        const f = fontMatch[1].trim();
        if (/^['"a-zA-Z0-9\s,-]+$/i.test(f) && !/javascript|expression/i.test(f)) {
          cleanStyles.push(`font-family: ${f}`);
        }
      }

      // Font color
      const colorMatch = styleVal.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      if (colorMatch) {
        const c = colorMatch[1].trim();
        if (/^(#[0-9a-f]{3,8}|rgb\([^)]+\)|hsl\([^)]+\)|[a-z]+)$/i.test(c)) {
          cleanStyles.push(`color: ${c}`);
        }
      }

      // Background color
      const bgMatch = styleVal.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i);
      if (bgMatch) {
        const bg = bgMatch[1].trim();
        if (/^(#[0-9a-f]{3,8}|rgb\([^)]+\)|hsl\([^)]+\)|[a-z]+)$/i.test(bg)) {
          cleanStyles.push(`background-color: ${bg}`);
        }
      }

      // Font size
      const sizeMatch = styleVal.match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/i);
      if (sizeMatch) {
        const s = sizeMatch[1].trim();
        if (/^([0-9.]+(px|em|rem|%|pt)|small|medium|large|x-large|xx-large)$/i.test(s)) {
          cleanStyles.push(`font-size: ${s}`);
        }
      }
    }

    const styleAttr = cleanStyles.length ? ` style="${cleanStyles.join('; ')}"` : '';
    return `<${tag}${styleAttr}>`;
  });

  return html;
}

/**
 * Format Instagram-style relative time display ("now", "2m", "1h", "3d", "2w")
 */
export function formatInstagramTime(dateStr) {
  if (!dateStr) return 'now';
  try {
    const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'now';
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return 'now';
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 52) return `${diffWeeks}w`;
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears}y`;
  } catch {
    return 'now';
  }
}

export function formatTimeAgo(dateStr) {
  return formatInstagramTime(dateStr);
}

export function formatFullDate(dateStr) {
  if (!dateStr) return '';
  try {
    const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
    const d = new Date(normalized);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return String(dateStr);
  }
}

/**
 * Retrieve comments for a novel or chapter with Instagram-style nested threaded replies and likes
 */
export async function getComments({ novelId, chapterNum = 0, userId = null, limit = null, offset = null }) {
  let cleanNovelId = String(novelId || '').trim();
  try {
    cleanNovelId = decodeURIComponent(cleanNovelId);
  } catch {}

  const genSlug = generateNovelSlug(cleanNovelId);
  const novelRow = await queryOne(
    `SELECT id FROM novels 
     WHERE id = ? 
        OR LOWER(id) = LOWER(?) 
        OR title = ? 
        OR (id = ? AND ? != '')
     LIMIT 1`,
    [cleanNovelId, cleanNovelId, cleanNovelId, genSlug, genSlug]
  );
  const targetNovelId = novelRow ? novelRow.id : cleanNovelId;

  // Determine if this is a novel-level query (chapterNum is 0, '', null, or 'novel')
  const chRaw = chapterNum !== undefined ? String(chapterNum).trim() : '0';
  const isNovelLevel = !chRaw || chRaw === '0' || chRaw === 'novel' || chRaw === 'all';
  const chStr = isNovelLevel ? '0' : chRaw;

  // Query comments with likes count and user liked status, sorted latest first
  const sql = `
    SELECT 
      c.id, c.novel_id, c.chapter_num, c.user_id, c.parent_id, c.content, c.created_at, c.updated_at,
      u.username, u.role,
      COALESCE(p.display_name, u.username) AS display_name,
      COALESCE(p.avatar, '/profile.png') AS avatar,
      p.title AS user_title,
      (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'comment' AND l.target_id = CAST(c.id AS CHAR)) AS likes_count
      ${userId ? `, (SELECT COUNT(*) FROM likes l WHERE l.target_type = 'comment' AND l.target_id = CAST(c.id AS CHAR) AND l.user_id = ${parseInt(userId, 10)}) AS user_liked` : ', 0 AS user_liked'}
    FROM comments c
    JOIN users u ON c.user_id = u.id
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE (c.novel_id = ? OR c.novel_id = ? OR c.novel_id = ?) 
      AND (
        ${isNovelLevel 
          ? "(c.chapter_num = '0' OR c.chapter_num = '' OR c.chapter_num IS NULL)" 
          : "(c.chapter_num = ? OR CAST(c.chapter_num AS CHAR) = ?)"}
      )
    ORDER BY c.created_at DESC;
  `;

  const params = isNovelLevel
    ? [targetNovelId, cleanNovelId, novelId]
    : [targetNovelId, cleanNovelId, novelId, chStr, chStr];

  const rows = await query(sql, params);

  // Map raw rows to comment models
  const commentMap = new Map();
  const topLevelComments = [];

  for (const r of rows) {
    const item = {
      id: r.id,
      novelId: r.novel_id,
      chapterNum: r.chapter_num,
      userId: r.user_id,
      parentId: r.parent_id ? Number(r.parent_id) : null,
      username: r.username,
      displayName: r.display_name,
      avatar: r.avatar || '/profile.png',
      role: r.role || 'Member',
      userTitle: r.user_title || r.role || 'Member',
      content: r.content,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      timeAgo: formatInstagramTime(r.created_at),
      fullDate: formatFullDate(r.created_at),
      isEdited: r.updated_at !== r.created_at,
      likesCount: Number(r.likes_count || 0),
      hasLiked: Boolean(r.user_liked && Number(r.user_liked) > 0),
      replies: []
    };

    commentMap.set(r.id, item);
  }

  // Nest replies under their respective parent comments
  for (const [id, item] of commentMap.entries()) {
    if (item.parentId && commentMap.has(item.parentId)) {
      commentMap.get(item.parentId).replies.push(item);
    } else {
      topLevelComments.push(item);
    }
  }

  // Ensure top-level comments are sorted newest first (descending by created_at)
  topLevelComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Ensure all replies are also sorted newest first (descending by created_at)
  for (const item of commentMap.values()) {
    if (item.replies && item.replies.length > 1) {
      item.replies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  // Pagination support: slice top-level comments without skipping or duplicating replies
  if (limit && Number(limit) > 0) {
    const start = offset && Number(offset) > 0 ? Number(offset) : 0;
    return topLevelComments.slice(start, start + Number(limit));
  }

  return topLevelComments;
}

/**
 * Add a new comment or nested threaded reply
 */
export async function addComment({ novelId, chapterNum = 0, userId, content, parentId = null }) {
  const cleanContent = sanitizeCommentHtml(content);
  const hasMedia = /<img\b[^>]*>/i.test(cleanContent);
  if (!cleanContent || (!hasMedia && cleanContent.replace(/<[^>]+>/g, '').trim().length === 0)) {
    return { success: false, error: 'Comment content cannot be empty.' };
  }

  let cleanNovelId = String(novelId || '').trim();
  try {
    cleanNovelId = decodeURIComponent(cleanNovelId);
  } catch {}

  const genSlug = generateNovelSlug(cleanNovelId);
  const novelRow = await queryOne(
    `SELECT id FROM novels 
     WHERE id = ? 
        OR LOWER(id) = LOWER(?) 
        OR title = ? 
        OR (id = ? AND ? != '')
     LIMIT 1`,
    [cleanNovelId, cleanNovelId, cleanNovelId, genSlug, genSlug]
  );
  let targetNovelId = novelRow ? novelRow.id : cleanNovelId;

  // Determine chapter number: novel-level comments normalized to '0'
  const chRaw = chapterNum !== undefined ? String(chapterNum).trim() : '0';
  const isNovelLevel = !chRaw || chRaw === '0' || chRaw === 'novel' || chRaw === 'all';
  let chStr = isNovelLevel ? '0' : chRaw;

  let resolvedParentId = null;
  if (parentId) {
    const parentRow = await queryOne('SELECT id, novel_id, chapter_num FROM comments WHERE id = ?;', [parentId]);
    if (parentRow) {
      resolvedParentId = parentRow.id;
      // Inherit target novel and chapter from parent comment for consistency
      targetNovelId = parentRow.novel_id;
      chStr = parentRow.chapter_num;
    }
  }

  const res = await query(`
    INSERT INTO comments (novel_id, chapter_num, user_id, parent_id, content)
    VALUES (?, ?, ?, ?, ?);
  `, [targetNovelId, chStr, userId, resolvedParentId, cleanContent]);

  const commentId = res.insertId;

  // Update user's profile post count
  await query(`UPDATE profiles SET posts_count = posts_count + 1 WHERE user_id = ?;`, [userId]);

  const user = await queryOne(`
    SELECT u.id, u.username, u.role, COALESCE(p.display_name, u.username) AS display_name, COALESCE(p.avatar, '/profile.png') AS avatar, p.title
    FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?;
  `, [userId]);

  // Genuine Notifications Trigger for Novel Comment / Comment Reply
  try {
    const cleanSnippet = cleanContent.replace(/<[^>]+>/g, '').trim().slice(0, 80);
    const chLabel = chStr && chStr !== '0' ? ` (Chapter ${chStr})` : '';

    if (resolvedParentId) {
      // 1. Comment Reply Event: Notify original comment author
      const parentRow = await queryOne(`
        SELECT c.id, c.user_id, c.novel_id, c.chapter_num, n.title AS novel_title
        FROM comments c
        LEFT JOIN novels n ON c.novel_id = n.id
        WHERE c.id = ?;
      `, [resolvedParentId]);

      if (parentRow && parentRow.user_id && Number(parentRow.user_id) !== Number(userId)) {
        await createNotification({
          userId: parentRow.user_id,
          actorId: userId,
          type: 'comment_reply',
          title: 'New Reply to your Comment',
          message: `${user.display_name || user.username} replied on ${parentRow.novel_title || 'Novel'}${chLabel}: "${cleanSnippet}"`,
          link: chStr && chStr !== '0' ? `#reader?novel=${targetNovelId}&ch=${chStr}` : `#novel-detail?id=${targetNovelId}`,
          entityType: 'comment',
          entityId: resolvedParentId
        });
      }
    } else {
      // 2. Top-level Novel/Chapter Comment Event: Notify Novel Author
      const novelInfo = await queryOne('SELECT id, title, author FROM novels WHERE id = ?;', [targetNovelId]);
      if (novelInfo) {
        let authorUser = await queryOne(`
          SELECT u.id FROM users u
          JOIN profiles p ON u.id = p.user_id
          WHERE p.display_name = ? OR p.display_name_ta = ? OR u.username = ?
          LIMIT 1;
        `, [novelInfo.author, novelInfo.author, novelInfo.author]);

        // Default author is user ID 2 (rudhra_author)
        const recipientAuthorId = authorUser ? authorUser.id : 2;

        if (recipientAuthorId && Number(recipientAuthorId) !== Number(userId)) {
          await createNotification({
            userId: recipientAuthorId,
            actorId: userId,
            type: 'novel_comment',
            title: `New Comment on ${novelInfo.title}`,
            message: `${user.display_name || user.username} commented on ${novelInfo.title}${chLabel}: "${cleanSnippet}"`,
            link: chStr && chStr !== '0' ? `#reader?novel=${targetNovelId}&ch=${chStr}` : `#novel-detail?id=${targetNovelId}`,
            entityType: 'novel',
            entityId: targetNovelId
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Comment Notification Error]:', err.message);
  }

  const nowIso = new Date().toISOString();

  return {
    success: true,
    comment: {
      id: commentId,
      novelId: targetNovelId,
      chapterNum: chStr,
      userId,
      parentId: resolvedParentId,
      username: user.username,
      displayName: user.display_name,
      avatar: user.avatar || '/profile.png',
      role: user.role,
      userTitle: user.title || user.role,
      content: cleanContent,
      createdAt: nowIso,
      updatedAt: nowIso,
      timeAgo: 'now',
      fullDate: formatFullDate(nowIso),
      isEdited: false,
      likesCount: 0,
      hasLiked: false,
      replies: []
    }
  };
}

/**
 * Update an existing comment
 */
export async function updateComment({ commentId, userId, content }) {
  const existing = await queryOne('SELECT * FROM comments WHERE id = ?;', [commentId]);
  if (!existing) {
    return { success: false, error: 'Comment not found.' };
  }

  const user = await queryOne('SELECT role FROM users WHERE id = ?;', [userId]);
  const isPrivileged = user && (user.role === 'Admin' || user.role === 'Administrator' || user.role === 'Editor');

  if (existing.user_id !== userId && !isPrivileged) {
    return { success: false, error: 'You do not have permission to edit this comment.' };
  }

  const cleanContent = sanitizeCommentHtml(content);
  if (!cleanContent || cleanContent.replace(/<[^>]+>/g, '').trim().length === 0) {
    return { success: false, error: 'Comment content cannot be empty.' };
  }

  await query(`
    UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `, [cleanContent, commentId]);

  return { success: true, commentId, content: cleanContent, isEdited: true };
}

/**
 * Delete a comment and all its nested replies and likes
 */
export async function deleteComment({ commentId, userId }) {
  const existing = await queryOne('SELECT * FROM comments WHERE id = ?;', [commentId]);
  if (!existing) {
    return { success: false, error: 'Comment not found.' };
  }

  const user = await queryOne('SELECT role FROM users WHERE id = ?;', [userId]);
  const isPrivileged = user && (user.role === 'Admin' || user.role === 'Administrator' || user.role === 'Editor');

  if (existing.user_id !== userId && !isPrivileged) {
    return { success: false, error: 'You do not have permission to delete this comment.' };
  }

  // Delete all nested replies to this comment
  const childReplies = await query('SELECT id FROM comments WHERE parent_id = ?;', [commentId]);
  for (const child of childReplies) {
    await query('DELETE FROM likes WHERE target_type = "comment" AND target_id = ?;', [String(child.id)]);
  }
  await query('DELETE FROM comments WHERE parent_id = ?;', [commentId]);

  // Delete likes on this comment
  await query('DELETE FROM likes WHERE target_type = "comment" AND target_id = ?;', [String(commentId)]);

  // Delete the comment itself
  await query('DELETE FROM comments WHERE id = ?;', [commentId]);
  await query('UPDATE profiles SET posts_count = GREATEST(0, posts_count - 1) WHERE user_id = ?;', [existing.user_id]);

  return { success: true, commentId };
}

/**
 * Toggle like on a comment (Instagram-style Like)
 */
export async function toggleCommentLike({ commentId, userId }) {
  if (!userId) {
    return { success: false, error: 'Authentication required to like a comment.' };
  }

  const comment = await queryOne('SELECT id FROM comments WHERE id = ?;', [commentId]);
  if (!comment) {
    return { success: false, error: 'Comment not found.' };
  }

  const targetId = String(commentId);
  const existing = await queryOne(
    'SELECT id FROM likes WHERE target_type = "comment" AND target_id = ? AND user_id = ?;',
    [targetId, userId]
  );

  let liked = false;
  if (existing) {
    await query('DELETE FROM likes WHERE id = ?;', [existing.id]);
    liked = false;
  } else {
    await query(
      'INSERT INTO likes (target_type, target_id, user_id) VALUES ("comment", ?, ?);',
      [targetId, userId]
    );
    liked = true;
  }

  const countRow = await queryOne(
    'SELECT COUNT(*) AS count FROM likes WHERE target_type = "comment" AND target_id = ?;',
    [targetId]
  );

  return {
    success: true,
    commentId: Number(commentId),
    likesCount: Number(countRow?.count || 0),
    hasLiked: liked
  };
}

/**
 * Get reactions summary for a target (chapter, novel, content, etc.)
 */
export async function getReactions({ targetType, targetId, userId = null }) {
  const rows = await query(`
    SELECT emoji, COUNT(*) AS count
    FROM reactions
    WHERE target_type = ? AND target_id = ?
    GROUP BY emoji;
  `, [targetType, targetId]);

  const counts = {};
  for (const emoji of ALLOWED_EMOJIS) {
    counts[emoji] = 0;
  }
  for (const r of rows) {
    counts[r.emoji] = Number(r.count || 0);
  }

  let userReaction = null;
  if (userId) {
    const userRow = await queryOne(`
      SELECT emoji FROM reactions
      WHERE target_type = ? AND target_id = ? AND user_id = ?;
    `, [targetType, targetId, userId]);
    if (userRow) {
      userReaction = userRow.emoji;
    }
  }

  const total = Object.values(counts).reduce((acc, c) => acc + c, 0);

  return {
    success: true,
    targetType,
    targetId,
    counts,
    total,
    userReaction,
    allowedEmojis: ALLOWED_EMOJIS,
    emojiLabels: EMOJI_LABELS
  };
}

/**
 * Toggle user reaction (Prevents duplicate reactions; clicking the same reaction removes it)
 */
export async function toggleReaction({ targetType, targetId, userId, emoji }) {
  const emojiAliases = {
    love: '❤️',
    like: '👍',
    clap: '👏',
    laugh: '😂',
    haha: '😂',
    surprise: '😮',
    wow: '😮',
    adore: '😍',
    sad: '😢',
    cry: '😭'
  };
  const resolvedEmoji = emojiAliases[emoji?.toLowerCase?.()] || emoji;

  if (!ALLOWED_EMOJIS.includes(resolvedEmoji)) {
    return { success: false, error: 'Invalid emoji reaction.' };
  }

  const existing = await queryOne(`
    SELECT id, emoji FROM reactions
    WHERE target_type = ? AND target_id = ? AND user_id = ?;
  `, [targetType, targetId, userId]);

  if (existing) {
    if (existing.emoji === resolvedEmoji) {
      // User clicked their active reaction -> remove it
      await query(`DELETE FROM reactions WHERE id = ?;`, [existing.id]);
    } else {
      // User clicked a different emoji -> update to the new one
      await query(`UPDATE reactions SET emoji = ? WHERE id = ?;`, [resolvedEmoji, existing.id]);
    }
  } else {
    // New reaction
    await query(`
      INSERT INTO reactions (target_type, target_id, user_id, emoji)
      VALUES (?, ?, ?, ?);
    `, [targetType, targetId, userId, resolvedEmoji]);

    // Reaction Notification
    if (targetType === 'comment') {
      try {
        const commentRow = await queryOne(`
          SELECT c.id, c.user_id, c.novel_id, c.chapter_num, n.title AS novel_title
          FROM comments c
          LEFT JOIN novels n ON c.novel_id = n.id
          WHERE c.id = ?;
        `, [targetId]);

        if (commentRow && commentRow.user_id && Number(commentRow.user_id) !== Number(userId)) {
          const actorProfile = await queryOne(`
            SELECT COALESCE(p.display_name, u.username) AS name
            FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?;
          `, [userId]);

          await createNotification({
            userId: commentRow.user_id,
            actorId: userId,
            type: 'comment_reaction',
            title: 'Reaction on your Comment',
            message: `${actorProfile?.name || 'A reader'} reacted ${resolvedEmoji} to your comment on ${commentRow.novel_title || 'Novel'}.`,
            link: commentRow.chapter_num && commentRow.chapter_num !== '0' ? `#reader?novel=${commentRow.novel_id}&ch=${commentRow.chapter_num}` : `#novel-detail?id=${commentRow.novel_id}`,
            entityType: 'comment',
            entityId: targetId
          });
        }
      } catch (err) {
        console.warn('[Reaction Notification Error]:', err.message);
      }
    }
  }

  return await getReactions({ targetType, targetId, userId });
}
