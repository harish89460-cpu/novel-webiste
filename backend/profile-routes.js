// backend/profile-routes.js
// Dedicated backend controller for Instagram-style Member Profile,
// Statistics, Follows, Saved Novels, Activity Timeline, and Topic Reads.

import { query, queryOne } from './db.js';
import { createNotification } from './notifications.js';

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

      // Genuine notification for new follower
      try {
        const followerProfile = await queryOne(`
          SELECT COALESCE(p.display_name, u.username) AS name
          FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?;
        `, [currentUser.id]);

        await createNotification({
          userId: targetUser.id,
          actorId: currentUser.id,
          type: 'follow',
          title: 'New Follower',
          message: `${followerProfile?.name || currentUser.username} started following you!`,
          link: `#member?id=${encodeURIComponent(currentUser.username)}`,
          entityType: 'user',
          entityId: currentUser.id
        });
      } catch (err) {
        console.warn('[Follow Notification Error]:', err.message);
      }
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
    let rawNovelId = pathname.startsWith('/novels/') ? pathname.replace('/novels/', '').replace('/save', '').trim() : (body.novelId || '').trim();
    let novelId = rawNovelId;
    try { novelId = decodeURIComponent(rawNovelId); } catch {}
    if (!novelId) {
      return sendJson(res, { success: false, error: 'Novel ID is required.' }, 400);
    }

    const novelRow = await queryOne('SELECT id, title FROM novels WHERE id = ? OR LOWER(id) = LOWER(?) LIMIT 1;', [novelId, novelId]);
    const actualNovelId = novelRow ? novelRow.id : novelId;

    const existing = await queryOne('SELECT id FROM saved_novels WHERE user_id = ? AND novel_id = ?;', [currentUser.id, actualNovelId]);
    let isSaved = false;
    if (existing) {
      await query('DELETE FROM saved_novels WHERE id = ?;', [existing.id]);
      isSaved = false;
    } else {
      await query('INSERT INTO saved_novels (user_id, novel_id) VALUES (?, ?);', [currentUser.id, actualNovelId]);
      isSaved = true;
    }

    return sendJson(res, {
      success: true,
      novelId: actualNovelId,
      isSaved,
      message: isSaved ? 'Novel added to your Saved Novels!' : 'Novel removed from Saved Novels.'
    }, 200);
  }

  // 3b. Novel Save Status Check
  // GET /api/novels/:id/save-status
  if (pathname.startsWith('/novels/') && pathname.endsWith('/save-status') && method === 'GET') {
    const rawNovelId = pathname.replace('/novels/', '').replace('/save-status', '').trim();
    let novelId = rawNovelId;
    try { novelId = decodeURIComponent(rawNovelId); } catch {}
    const novelRow = await queryOne('SELECT id FROM novels WHERE id = ? OR LOWER(id) = LOWER(?) LIMIT 1;', [novelId, novelId]);
    const actualNovelId = novelRow ? novelRow.id : novelId;
    let isSaved = false;
    if (currentUser) {
      const existing = await queryOne('SELECT id FROM saved_novels WHERE user_id = ? AND novel_id = ?;', [currentUser.id, actualNovelId]);
      isSaved = Boolean(existing);
    }
    return sendJson(res, { success: true, novelId: actualNovelId, isSaved }, 200);
  }

  // 3c. Novel 1-5 Star Rating Endpoints
  // GET /api/novels/:id/rating
  // POST /api/novels/:id/rating
  if (pathname.startsWith('/novels/') && pathname.endsWith('/rating')) {
    const rawNovelId = pathname.replace('/novels/', '').replace('/rating', '').trim();
    let novelId = rawNovelId;
    try { novelId = decodeURIComponent(rawNovelId); } catch {}

    const novelRow = await queryOne('SELECT id, title, rating FROM novels WHERE id = ? OR LOWER(id) = LOWER(?) LIMIT 1;', [novelId, novelId]);
    const actualNovelId = novelRow ? novelRow.id : novelId;

    if (method === 'GET') {
      const stats = await queryOne('SELECT AVG(rating) AS avg_rating, COUNT(*) AS count FROM novel_ratings WHERE novel_id = ?;', [actualNovelId]);
      let userRating = null;
      if (currentUser) {
        const uRow = await queryOne('SELECT rating FROM novel_ratings WHERE user_id = ? AND novel_id = ?;', [currentUser.id, actualNovelId]);
        if (uRow) userRating = Number(uRow.rating);
      }
      const totalRatings = Number(stats?.count || 0);
      const averageRating = totalRatings > 0 ? Number(stats.avg_rating).toFixed(1) : (novelRow?.rating || '5.0');
      return sendJson(res, {
        success: true,
        novelId: actualNovelId,
        averageRating,
        totalRatings,
        userRating
      }, 200);
    }

    if (method === 'POST') {
      if (!currentUser) {
        return sendJson(res, { success: false, error: 'Please log in to rate this novel.' }, 401);
      }
      const body = await readJsonBody(req);
      const rating = parseInt(body.rating, 10);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        return sendJson(res, { success: false, error: 'Rating must be an integer between 1 and 5.' }, 400);
      }

      await query(`
        INSERT INTO novel_ratings (user_id, novel_id, rating)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = CURRENT_TIMESTAMP;
      `, [currentUser.id, actualNovelId, rating]);

      const stats = await queryOne('SELECT AVG(rating) AS avg_rating, COUNT(*) AS count FROM novel_ratings WHERE novel_id = ?;', [actualNovelId]);
      const totalRatings = Number(stats?.count || 0);
      const averageRating = totalRatings > 0 ? Number(stats.avg_rating).toFixed(1) : String(rating);

      try {
        await query('UPDATE novels SET rating = ? WHERE id = ?;', [averageRating, actualNovelId]);
      } catch (err) {
        console.warn('Could not update novels cached rating column:', err.message);
      }

      return sendJson(res, {
        success: true,
        message: 'Your rating has been recorded!',
        novelId: actualNovelId,
        averageRating,
        totalRatings,
        userRating: rating
      }, 200);
    }
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

  
  // 10. Followers List for a Member or Logged-in User
  // GET /api/user/followers or GET /api/members/:id/followers
  if (((pathname === '/user/followers' || pathname === '/api/user/followers') ||
       (pathname.startsWith('/members/') && pathname.endsWith('/followers'))) && method === 'GET') {
    let targetUser = null;

    if (pathname === '/user/followers' || pathname === '/api/user/followers') {
      if (!currentUser) {
        return sendJson(res, { success: false, error: 'Please log in to view your followers.' }, 401);
      }
      targetUser = currentUser;
    } else {
      const targetParam = pathname.replace('/members/', '').replace('/followers', '').trim();
      targetUser = await queryOne('SELECT id, username FROM users WHERE id = ? OR LOWER(username) = LOWER(?) OR (? = "rudhra" AND LOWER(username) = "rudhra_author");', [targetParam, targetParam, targetParam]);
      if (!targetUser) {
        return sendJson(res, { success: false, error: 'Member not found.' }, 404);
      }
    }

    const search = String(parsed.query?.search || '').trim();
    const searchPattern = `%${search}%`;
    const viewerId = currentUser ? currentUser.id : 0;

    const [followersCountRow, followingCountRow] = await Promise.all([
      queryOne('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?;', [targetUser.id]),
      queryOne('SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?;', [targetUser.id])
    ]);

    const followersCount = Number(followersCountRow?.count || 0);
    const followingCount = Number(followingCountRow?.count || 0);

    const rows = await query(`
      SELECT 
        u.id, u.username, u.role,
        p.display_name, p.avatar, p.bio, p.title,
        f.created_at AS followed_at,
        EXISTS (
          SELECT 1 FROM follows f2 
          WHERE f2.follower_id = ? AND f2.following_id = u.id
        ) AS is_following
      FROM follows f
      JOIN users u ON f.follower_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE f.following_id = ?
        AND (
          ? = '' OR 
          LOWER(u.username) LIKE LOWER(?) OR 
          LOWER(COALESCE(p.display_name, '')) LIKE LOWER(?)
        )
      ORDER BY f.created_at DESC;
    `, [viewerId, targetUser.id, search, searchPattern, searchPattern]);

    const users = rows.map(r => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatar: (r.avatar && !r.avatar.includes('images.unsplash.com') && !r.avatar.includes('ui-avatars.com')) ? r.avatar : '/profile.png',
      role: r.title || r.role || 'Member',
      bio: r.bio || '',
      followedAt: r.followed_at,
      isFollowing: Boolean(r.is_following),
      isSelf: currentUser ? currentUser.id === r.id : false
    }));

    return sendJson(res, {
      success: true,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username
      },
      followersCount,
      followingCount,
      users
    }, 200);
  }

  // 11. Following List for a Member or Logged-in User
  // GET /api/user/following or GET /api/members/:id/following
  if (((pathname === '/user/following' || pathname === '/api/user/following') ||
       (pathname.startsWith('/members/') && pathname.endsWith('/following'))) && method === 'GET') {
    let targetUser = null;

    if (pathname === '/user/following' || pathname === '/api/user/following') {
      if (!currentUser) {
        return sendJson(res, { success: false, error: 'Please log in to view who you are following.' }, 401);
      }
      targetUser = currentUser;
    } else {
      const targetParam = pathname.replace('/members/', '').replace('/following', '').trim();
      targetUser = await queryOne('SELECT id, username FROM users WHERE id = ? OR LOWER(username) = LOWER(?) OR (? = "rudhra" AND LOWER(username) = "rudhra_author");', [targetParam, targetParam, targetParam]);
      if (!targetUser) {
        return sendJson(res, { success: false, error: 'Member not found.' }, 404);
      }
    }

    const search = String(parsed.query?.search || '').trim();
    const searchPattern = `%${search}%`;
    const viewerId = currentUser ? currentUser.id : 0;

    const [followersCountRow, followingCountRow] = await Promise.all([
      queryOne('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?;', [targetUser.id]),
      queryOne('SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?;', [targetUser.id])
    ]);

    const followersCount = Number(followersCountRow?.count || 0);
    const followingCount = Number(followingCountRow?.count || 0);

    const rows = await query(`
      SELECT 
        u.id, u.username, u.role,
        p.display_name, p.avatar, p.bio, p.title,
        f.created_at AS followed_at,
        EXISTS (
          SELECT 1 FROM follows f2 
          WHERE f2.follower_id = ? AND f2.following_id = u.id
        ) AS is_following
      FROM follows f
      JOIN users u ON f.following_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE f.follower_id = ?
        AND (
          ? = '' OR 
          LOWER(u.username) LIKE LOWER(?) OR 
          LOWER(COALESCE(p.display_name, '')) LIKE LOWER(?)
        )
      ORDER BY f.created_at DESC;
    `, [viewerId, targetUser.id, search, searchPattern, searchPattern]);

    const users = rows.map(r => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatar: (r.avatar && !r.avatar.includes('images.unsplash.com') && !r.avatar.includes('ui-avatars.com')) ? r.avatar : '/profile.png',
      role: r.title || r.role || 'Member',
      bio: r.bio || '',
      followedAt: r.followed_at,
      isFollowing: Boolean(r.is_following),
      isSelf: currentUser ? currentUser.id === r.id : false
    }));

    return sendJson(res, {
      success: true,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username
      },
      followersCount,
      followingCount,
      users
    }, 200);
  }

  // 12. Direct Unfollow Endpoint
  // DELETE /api/user/following/:id or POST /api/members/:id/unfollow
  if (((pathname.startsWith('/user/following/') && method === 'DELETE') ||
       (pathname.startsWith('/members/') && pathname.endsWith('/unfollow') && method === 'POST')) ) {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to unfollow members.' }, 401);
    }

    let targetParam = '';
    if (pathname.startsWith('/user/following/')) {
      targetParam = pathname.replace('/user/following/', '').trim();
    } else {
      targetParam = pathname.replace('/members/', '').replace('/unfollow', '').trim();
    }

    const targetUser = await queryOne('SELECT id, username FROM users WHERE id = ? OR LOWER(username) = LOWER(?) OR (? = "rudhra" AND LOWER(username) = "rudhra_author");', [targetParam, targetParam, targetParam]);
    if (!targetUser) {
      return sendJson(res, { success: false, error: 'Member not found.' }, 404);
    }

    await query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?;', [currentUser.id, targetUser.id]);

    const [followersCountRow, followingCountRow] = await Promise.all([
      queryOne('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?;', [targetUser.id]),
      queryOne('SELECT COUNT(*) AS count FROM follows WHERE follower_id = ?;', [currentUser.id])
    ]);

    return sendJson(res, {
      success: true,
      isFollowing: false,
      followersCount: Number(followersCountRow?.count || 0),
      followingCount: Number(followingCountRow?.count || 0),
      message: `You have unfollowed ${targetUser.username}.`
    }, 200);
  }

  // Not handled here
  return false;
}
