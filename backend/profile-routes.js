// backend/profile-routes.js
// Dedicated backend controller for Instagram-style Member Profile,
// Statistics, Follows, Saved Novels, Activity Timeline, and Topic Reads.

import { query, queryOne } from './db.js';

/**
 * Handle Profile Subsystem Endpoints
 */
export async function handleProfileEndpoints(req, res, pathname, method, parsed, currentUser, sendJson, readJsonBody) {
  // 1. Follow / Unfollow Toggle
  // POST /api/members/:id/follow
  if (pathname.startsWith('/members/') && pathname.endsWith('/follow') && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to follow members.' }, 401);
    }
    const targetParam = pathname.replace('/members/', '').replace('/follow', '').trim();
    const targetUser = await queryOne('SELECT id, username FROM users WHERE id = ? OR LOWER(username) = LOWER(?) OR (? = "rudhra" AND LOWER(username) = "rudhra_author");', [targetParam, targetParam, targetParam]);
    if (!targetUser) {
      return sendJson(res, { success: false, error: 'Member not found.' }, 404);
    }
    if (targetUser.id === currentUser.id) {
      return sendJson(res, { success: false, error: 'You cannot follow yourself.' }, 400);
    }

    const existing = await queryOne('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?;', [currentUser.id, targetUser.id]);
    let isFollowing = false;
    if (existing) {
      await query('DELETE FROM follows WHERE id = ?;', [existing.id]);
      isFollowing = false;
    } else {
      await query('INSERT INTO follows (follower_id, following_id) VALUES (?, ?);', [currentUser.id, targetUser.id]);
      isFollowing = true;
    }

    const followersCountRow = await queryOne('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?;', [targetUser.id]);
    const followersCount = Number(followersCountRow?.count || 0);

    return sendJson(res, {
      success: true,
      isFollowing,
      followersCount,
      message: isFollowing ? `You are now following ${targetUser.username}!` : `Unfollowed ${targetUser.username}.`
    }, 200);
  }

  // 2. Saved Novels List (Paginated, 10 items/page)
  // GET /api/members/:id/saved-novels?page=1&limit=10
  if (pathname.startsWith('/members/') && pathname.endsWith('/saved-novels') && method === 'GET') {
    const targetParam = pathname.replace('/members/', '').replace('/saved-novels', '').trim();
    const targetUser = await queryOne('SELECT id, username FROM users WHERE id = ? OR LOWER(username) = LOWER(?) OR (? = "rudhra" AND LOWER(username) = "rudhra_author");', [targetParam, targetParam, targetParam]);
    if (!targetUser) {
      return sendJson(res, { success: false, error: 'Member not found.' }, 404);
    }

    const page = Math.max(1, parseInt(parsed.query?.page || '1', 10));
    const limit = Math.max(1, Math.min(50, parseInt(parsed.query?.limit || '10', 10)));
    const offset = (page - 1) * limit;

    const totalRow = await queryOne('SELECT COUNT(*) AS total FROM saved_novels WHERE user_id = ?;', [targetUser.id]);
    const total = Number(totalRow?.total || 0);

    const rows = await query(`
      SELECT 
        s.id AS saved_id,
        s.novel_id,
        s.created_at AS saved_at,
        n.title,
        n.cover AS cover_image,
        n.author,
        n.category,
        n.chapters_count AS episodes_count,
        n.views AS total_views
      FROM saved_novels s
      LEFT JOIN novels n ON s.novel_id = n.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?;
    `, [targetUser.id, limit, offset]);

    return sendJson(res, {
      success: true,
      items: rows.map(r => ({
        savedId: r.saved_id,
        novelId: r.novel_id,
        title: r.title || r.novel_id,
        
        coverImage: r.cover_image || '/images/logo.png',
        author: r.author || r.author_name || 'Rudhra Prarthana',
        category: r.category || 'Ongoing',
        episodesCount: r.episodes_count || 0,
        totalViews: r.total_views || 0,
        savedAt: r.saved_at
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    }, 200);
  }

  // 3. Save / Unsave Novel
  // POST /api/novels/:id/save or POST /api/members/me/saved-novels
  if ((pathname.startsWith('/novels/') && pathname.endsWith('/save') && method === 'POST') ||
      (pathname === '/members/me/saved-novels' && method === 'POST')) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to save novels.' }, 401);
    }
    const body = await readJsonBody(req);
    let novelId = pathname.startsWith('/novels/') ? pathname.replace('/novels/', '').replace('/save', '').trim() : (body.novelId || '').trim();
    if (!novelId) {
      return sendJson(res, { success: false, error: 'Novel ID is required.' }, 400);
    }

    const existing = await queryOne('SELECT id FROM saved_novels WHERE user_id = ? AND novel_id = ?;', [currentUser.id, novelId]);
    let isSaved = false;
    if (existing) {
      await query('DELETE FROM saved_novels WHERE id = ?;', [existing.id]);
      isSaved = false;
    } else {
      await query('INSERT INTO saved_novels (user_id, novel_id) VALUES (?, ?);', [currentUser.id, novelId]);
      isSaved = true;
    }

    return sendJson(res, {
      success: true,
      isSaved,
      message: isSaved ? 'Novel added to your Saved Novels!' : 'Novel removed from Saved Novels.'
    }, 200);
  }

  // 4. Remove from Saved Novels by saved_id or novel_id
  // DELETE /api/members/me/saved-novels/:id
  if (pathname.startsWith('/members/me/saved-novels/') && method === 'DELETE') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in.' }, 401);
    }
    const itemParam = pathname.replace('/members/me/saved-novels/', '').trim();
    await query('DELETE FROM saved_novels WHERE user_id = ? AND (id = ? OR novel_id = ?);', [currentUser.id, itemParam, itemParam]);
    return sendJson(res, { success: true, message: 'Novel removed from Saved Novels.' }, 200);
  }

  // 5. Activity Timeline (Paginated, 10 items/page)
  // GET /api/members/:id/activity?page=1&limit=10
  if (pathname.startsWith('/members/') && pathname.endsWith('/activity') && method === 'GET') {
    const targetParam = pathname.replace('/members/', '').replace('/activity', '').trim();
    const targetUser = await queryOne('SELECT id, username FROM users WHERE id = ? OR LOWER(username) = LOWER(?) OR (? = "rudhra" AND LOWER(username) = "rudhra_author");', [targetParam, targetParam, targetParam]);
    if (!targetUser) {
      return sendJson(res, { success: false, error: 'Member not found.' }, 404);
    }

    const page = Math.max(1, parseInt(parsed.query?.page || '1', 10));
    const limit = Math.max(1, Math.min(50, parseInt(parsed.query?.limit || '10', 10)));
    const offset = (page - 1) * limit;

    // Aggregate member activity across comments, short_story_comments, forum_posts, forum_topics, likes, and reactions
    const countSql = `
      SELECT CAST((
        (SELECT COUNT(*) FROM comments WHERE user_id = ?) +
        (SELECT COUNT(*) FROM content_comments WHERE user_id = ?) +
        (SELECT COUNT(*) FROM short_story_comments WHERE user_id = ?) +
        (SELECT COUNT(*) FROM forum_posts WHERE user_id = ?) +
        (SELECT COUNT(*) FROM forum_topics WHERE author_id = ?) +
        (SELECT COUNT(*) FROM likes WHERE user_id = ?) +
        (SELECT COUNT(*) FROM reactions WHERE user_id = ?)
      ) AS UNSIGNED) AS total;
    `;
    const countRow = await queryOne(countSql, [
      targetUser.id, targetUser.id, targetUser.id, targetUser.id, targetUser.id, targetUser.id, targetUser.id
    ]);
    const total = Number(countRow?.total || 0);

    const activitySql = `
      (SELECT 
        'novel_comment' AS activity_type,
        c.id AS item_id,
        c.content,
        c.created_at,
        c.novel_id AS target_id,
        COALESCE(n.title, c.novel_id) AS target_title,
        CONCAT('#novel?id=', c.novel_id) AS target_url,
        c.user_id
      FROM comments c
      LEFT JOIN novels n ON c.novel_id = n.id
      WHERE c.user_id = ?)

      UNION ALL

      (SELECT 
        'content_comment' AS activity_type,
        cc.id AS item_id,
        cc.content,
        cc.created_at,
        CAST(cc.content_id AS CHAR) AS target_id,
        COALESCE(ca.title, 'Content') AS target_title,
        CONCAT('#forms/article?id=', cc.content_id) AS target_url,
        cc.user_id
      FROM content_comments cc
      LEFT JOIN content_articles ca ON cc.content_id = ca.id
      WHERE cc.user_id = ?)

      UNION ALL

      (SELECT 
        'story_comment' AS activity_type,
        sc.id AS item_id,
        sc.content,
        sc.created_at,
        CAST(sc.story_id AS CHAR) AS target_id,
        COALESCE(ss.title, 'Story') AS target_title,
        CONCAT('#short-story?id=', sc.story_id) AS target_url,
        sc.user_id
      FROM short_story_comments sc
      LEFT JOIN short_stories ss ON sc.story_id = ss.id
      WHERE sc.user_id = ?)

      UNION ALL

      (SELECT 
        'forum_reply' AS activity_type,
        fp.id AS item_id,
        fp.content,
        fp.created_at,
        fp.topic_id AS target_id,
        COALESCE(ft.title, fp.topic_id) AS target_title,
        CONCAT('#topic?id=', fp.topic_id) AS target_url,
        fp.user_id
      FROM forum_posts fp
      LEFT JOIN forum_topics ft ON fp.topic_id = ft.id
      WHERE fp.user_id = ?)

      UNION ALL

      (SELECT 
        'forum_topic' AS activity_type,
        ft.id AS item_id,
        ft.title AS content,
        ft.created_at,
        ft.id AS target_id,
        ft.title AS target_title,
        CONCAT('#topic?id=', ft.id) AS target_url,
        ft.author_id AS user_id
      FROM forum_topics ft
      WHERE ft.author_id = ?)

      UNION ALL

      (SELECT 
        'like' AS activity_type,
        l.id AS item_id,
        CONCAT('Liked ', l.target_type) AS content,
        l.created_at,
        l.target_id,
        CONCAT('Item #', l.target_id) AS target_title,
        '#forum' AS target_url,
        l.user_id
      FROM likes l
      WHERE l.user_id = ?)

      UNION ALL

      (SELECT 
        'reaction' AS activity_type,
        r.id AS item_id,
        CONCAT(r.emoji, ' reacted') AS content,
        r.created_at,
        r.target_id,
        CONCAT('Reacted ', r.emoji, ' on ', r.target_type) AS target_title,
        '#forum' AS target_url,
        r.user_id
      FROM reactions r
      WHERE r.user_id = ?)

      ORDER BY created_at DESC
      LIMIT ? OFFSET ?;
    `;

    const activities = await query(activitySql, [
      targetUser.id, targetUser.id, targetUser.id, targetUser.id, targetUser.id, targetUser.id, targetUser.id,
      limit, offset
    ]);

    const isViewerOwnerOrAdmin = Boolean(
      currentUser && (currentUser.id === targetUser.id || currentUser.role === 'Admin' || currentUser.role === 'Administrator')
    );

    return sendJson(res, {
      success: true,
      items: activities.map(a => ({
        id: a.item_id,
        activityType: a.activity_type,
        content: a.content,
        createdAt: a.created_at,
        targetId: a.target_id,
        targetTitle: a.target_title,
        targetUrl: a.target_url,
        canEdit: isViewerOwnerOrAdmin && ['novel_comment', 'content_comment', 'story_comment', 'forum_reply'].includes(a.activity_type),
        canDelete: isViewerOwnerOrAdmin && ['novel_comment', 'content_comment', 'story_comment', 'forum_reply', 'forum_topic'].includes(a.activity_type)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    }, 200);
  }

  // 6. Delete Activity Item (Enforce Ownership)
  // DELETE /api/members/activity/:type/:id
  if (pathname.startsWith('/members/activity/') && method === 'DELETE') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const parts = pathname.replace('/members/activity/', '').split('/');
    const type = parts[0];
    const itemId = parseInt(parts[1] || '0', 10);
    const isPrivileged = currentUser.role === 'Admin' || currentUser.role === 'Administrator';

    if (type === 'novel_comment') {
      const row = await queryOne('SELECT user_id FROM comments WHERE id = ?;', [itemId]);
      if (!row) return sendJson(res, { success: false, error: 'Comment not found.' }, 404);
      if (row.user_id !== currentUser.id && !isPrivileged) return sendJson(res, { success: false, error: 'Permission denied.' }, 403);
      await query('DELETE FROM comments WHERE id = ?;', [itemId]);
      return sendJson(res, { success: true, message: 'Comment deleted successfully.' }, 200);
    }

    if (type === 'content_comment') {
      const row = await queryOne('SELECT user_id FROM content_comments WHERE id = ?;', [itemId]);
      if (!row) return sendJson(res, { success: false, error: 'Comment not found.' }, 404);
      if (row.user_id !== currentUser.id && !isPrivileged) return sendJson(res, { success: false, error: 'Permission denied.' }, 403);
      await query('DELETE FROM content_comments WHERE id = ?;', [itemId]);
      return sendJson(res, { success: true, message: 'Comment deleted successfully.' }, 200);
    }

    if (type === 'story_comment') {
      const row = await queryOne('SELECT user_id FROM short_story_comments WHERE id = ?;', [itemId]);
      if (!row) return sendJson(res, { success: false, error: 'Comment not found.' }, 404);
      if (row.user_id !== currentUser.id && !isPrivileged) return sendJson(res, { success: false, error: 'Permission denied.' }, 403);
      await query('DELETE FROM short_story_comments WHERE id = ?;', [itemId]);
      return sendJson(res, { success: true, message: 'Comment deleted successfully.' }, 200);
    }

    if (type === 'forum_reply') {
      const row = await queryOne('SELECT user_id FROM forum_posts WHERE id = ?;', [itemId]);
      if (!row) return sendJson(res, { success: false, error: 'Reply not found.' }, 404);
      if (row.user_id !== currentUser.id && !isPrivileged) return sendJson(res, { success: false, error: 'Permission denied.' }, 403);
      await query('DELETE FROM forum_posts WHERE id = ?;', [itemId]);
      return sendJson(res, { success: true, message: 'Reply deleted successfully.' }, 200);
    }

    return sendJson(res, { success: false, error: 'Unsupported activity type for deletion.' }, 400);
  }

  // 7. Edit Activity Item (Enforce Ownership)
  // PUT /api/members/activity/:type/:id
  if (pathname.startsWith('/members/activity/') && (method === 'PUT' || method === 'POST')) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Authentication required' }, 401);
    }
    const parts = pathname.replace('/members/activity/', '').split('/');
    const type = parts[0];
    const itemId = parseInt(parts[1] || '0', 10);
    const body = await readJsonBody(req);
    const content = (body.content || '').trim();
    if (!content) {
      return sendJson(res, { success: false, error: 'Content cannot be empty.' }, 400);
    }

    const isPrivileged = currentUser.role === 'Admin' || currentUser.role === 'Administrator';

    if (type === 'novel_comment') {
      const row = await queryOne('SELECT user_id FROM comments WHERE id = ?;', [itemId]);
      if (!row) return sendJson(res, { success: false, error: 'Comment not found.' }, 404);
      if (row.user_id !== currentUser.id && !isPrivileged) return sendJson(res, { success: false, error: 'Permission denied.' }, 403);
      await query('UPDATE comments SET content = ?, updated_at = NOW() WHERE id = ?;', [content, itemId]);
      return sendJson(res, { success: true, message: 'Comment updated successfully.' }, 200);
    }

    if (type === 'content_comment') {
      const row = await queryOne('SELECT user_id FROM content_comments WHERE id = ?;', [itemId]);
      if (!row) return sendJson(res, { success: false, error: 'Comment not found.' }, 404);
      if (row.user_id !== currentUser.id && !isPrivileged) return sendJson(res, { success: false, error: 'Permission denied.' }, 403);
      await query('UPDATE content_comments SET content = ?, updated_at = NOW() WHERE id = ?;', [content, itemId]);
      return sendJson(res, { success: true, message: 'Comment updated successfully.' }, 200);
    }

    if (type === 'story_comment') {
      const row = await queryOne('SELECT user_id FROM short_story_comments WHERE id = ?;', [itemId]);
      if (!row) return sendJson(res, { success: false, error: 'Comment not found.' }, 404);
      if (row.user_id !== currentUser.id && !isPrivileged) return sendJson(res, { success: false, error: 'Permission denied.' }, 403);
      await query('UPDATE short_story_comments SET content = ?, updated_at = NOW() WHERE id = ?;', [content, itemId]);
      return sendJson(res, { success: true, message: 'Comment updated successfully.' }, 200);
    }

    if (type === 'forum_reply') {
      const row = await queryOne('SELECT user_id FROM forum_posts WHERE id = ?;', [itemId]);
      if (!row) return sendJson(res, { success: false, error: 'Reply not found.' }, 404);
      if (row.user_id !== currentUser.id && !isPrivileged) return sendJson(res, { success: false, error: 'Permission denied.' }, 403);
      await query('UPDATE forum_posts SET content = ?, updated_at = NOW() WHERE id = ?;', [content, itemId]);
      return sendJson(res, { success: true, message: 'Reply updated successfully.' }, 200);
    }

    return sendJson(res, { success: false, error: 'Unsupported activity type for update.' }, 400);
  }

  // 8. Track Topic Read (Recorded when a member opens a forum topic)
  // POST /api/forum/topics/:id/read
  if (pathname.startsWith('/forum/topics/') && pathname.endsWith('/read') && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: true, tracked: false, reason: 'Guest read' }, 200);
    }
    const topicId = pathname.replace('/forum/topics/', '').replace('/read', '').trim();
    if (topicId) {
      await query(`
        INSERT INTO topic_reads (user_id, topic_id, last_read_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE last_read_at = NOW();
      `, [currentUser.id, topicId]);
    }
    return sendJson(res, { success: true, tracked: true }, 200);
  }

  // 9. Recently Read Topics (Paginated, 10 items/page)
  // GET /api/members/:id/recent-topics?page=1&limit=10
  if (pathname.startsWith('/members/') && pathname.endsWith('/recent-topics') && method === 'GET') {
    const targetParam = pathname.replace('/members/', '').replace('/recent-topics', '').trim();
    const targetUser = await queryOne('SELECT id, username FROM users WHERE id = ? OR LOWER(username) = LOWER(?) OR (? = "rudhra" AND LOWER(username) = "rudhra_author");', [targetParam, targetParam, targetParam]);
    if (!targetUser) {
      return sendJson(res, { success: false, error: 'Member not found.' }, 404);
    }

    const page = Math.max(1, parseInt(parsed.query?.page || '1', 10));
    const limit = Math.max(1, Math.min(50, parseInt(parsed.query?.limit || '10', 10)));
    const offset = (page - 1) * limit;

    const totalRow = await queryOne('SELECT COUNT(*) AS total FROM topic_reads WHERE user_id = ?;', [targetUser.id]);
    const total = Number(totalRow?.total || 0);

    const rows = await query(`
      SELECT 
        tr.topic_id,
        tr.last_read_at,
        ft.title,
        ft.category_id,
        ft.category_title,
        ft.views_count,
        ft.replies_count,
        ft.created_at AS topic_created_at,
        u.username AS author_username,
        p.display_name AS author_name,
        p.avatar AS author_avatar
      FROM topic_reads tr
      JOIN forum_topics ft ON tr.topic_id = ft.id
      LEFT JOIN users u ON ft.author_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE tr.user_id = ?
      ORDER BY tr.last_read_at DESC
      LIMIT ? OFFSET ?;
    `, [targetUser.id, limit, offset]);

    return sendJson(res, {
      success: true,
      items: rows.map(r => ({
        topicId: r.topic_id,
        title: r.title,
        categoryId: r.category_id,
        categoryTitle: r.category_title,
        viewsCount: r.views_count || 0,
        repliesCount: r.replies_count || 0,
        lastReadAt: r.last_read_at,
        topicCreatedAt: r.topic_created_at,
        author: {
          username: r.author_username,
          displayName: r.author_name || r.author_username || 'Author',
          avatar: r.author_avatar || '/profile.png'
        }
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    }, 200);
  }

  // Not handled here
  return false;
}
