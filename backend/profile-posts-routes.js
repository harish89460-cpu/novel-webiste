// backend/profile-posts-routes.js
// Dedicated backend controller for Latest Profile Posts:
// Allows Admin, Writer, and Member users to create, view, edit, delete, like,
// and comment on profile posts with real-time notifications.
// Completely isolated from Trending Posts, Novels, and Threads.

import { query, queryOne } from './db.js';
import { createNotification } from './notifications.js';

function formatRelativeTime(dateInput) {
  if (!dateInput) return 'Recently';
  try {
    const date = (dateInput instanceof Date) ? dateInput : new Date(typeof dateInput === 'string' && !dateInput.includes('T') ? dateInput.replace(' ', 'T') + 'Z' : dateInput);
    if (isNaN(date.getTime())) return 'Recently';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Just now';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 2) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function checkIsAdmin(currentUser) {
  if (!currentUser) return false;
  return Boolean(
    currentUser.isAdmin === true ||
    currentUser.isAuthorSession === true ||
    ['admin', 'administrator'].includes((currentUser.role || '').toLowerCase()) ||
    currentUser.email === 'digitalmarkservices.in@gmail.com'
  );
}

/**
 * Handle Profile Posts REST API routes
 */
export async function handleProfilePostsEndpoints(req, res, pathname, method, parsed, currentUser, sendJson, readJsonBody) {
  const isAdmin = checkIsAdmin(currentUser);

  // 1. GET /api/profile-posts — List Latest Profile Posts (Newest First)
  if ((pathname === '/profile-posts' || pathname === '/api/profile-posts') && method === 'GET') {
    const page = Math.max(1, parseInt(parsed.query?.page || '1', 10));
    const limit = Math.min(30, Math.max(1, parseInt(parsed.query?.limit || '10', 10)));
    const offset = (page - 1) * limit;
    const filterUserId = parsed.query?.userId ? parseInt(parsed.query.userId, 10) : null;

    let whereClause = '';
    const params = [];
    if (filterUserId) {
      whereClause = 'WHERE pp.user_id = ?';
      params.push(filterUserId);
    }

    const totalRow = await queryOne(`SELECT COUNT(*) AS total FROM profile_posts pp ${whereClause};`, params);
    const total = Number(totalRow?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const postRows = await query(`
      SELECT 
        pp.id,
        pp.user_id,
        pp.content,
        pp.likes_count,
        pp.comments_count,
        pp.created_at,
        pp.updated_at,
        u.username,
        u.role,
        COALESCE(p.display_name, u.username) AS author_name,
        COALESCE(p.avatar, '/profile.png') AS author_avatar
      FROM profile_posts pp
      JOIN users u ON pp.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      ${whereClause}
      ORDER BY pp.created_at DESC
      LIMIT ? OFFSET ?;
    `, [...params, limit, offset]);

    // Check user likes and batch-load reactors
    let likedPostIds = new Set();
    let reactorsByPost = {};
    if (postRows.length > 0) {
      const postIds = postRows.map(p => String(p.id));
      if (currentUser) {
        const likesRows = await query(`
          SELECT target_id 
          FROM likes 
          WHERE target_type = 'profile_post' 
            AND user_id = ? 
            AND target_id IN (${postIds.map(() => '?').join(',')});
        `, [currentUser.id, ...postIds]);
        likedPostIds = new Set(likesRows.map(l => Number(l.target_id)));
      }

      // Batch load top reactors for posts with likes
      try {
        const likedPostIdsList = postRows.filter(p => Number(p.likes_count || 0) > 0).map(p => String(p.id));
        if (likedPostIdsList.length > 0) {
          const placeholders = likedPostIdsList.map(() => '?').join(',');
          const rRows = await query(`
            SELECT l.target_id, l.user_id, l.created_at,
                   u.username,
                   COALESCE(p.display_name, u.username) AS name,
                   p.avatar
            FROM likes l
            JOIN users u ON l.user_id = u.id
            LEFT JOIN profiles p ON u.id = p.user_id
            WHERE l.target_type = 'profile_post' AND l.target_id IN (${placeholders})
            ORDER BY ${currentUser ? `(l.user_id = ${parseInt(currentUser.id, 10)}) DESC, ` : ''}l.created_at DESC;
          `, likedPostIdsList);

          for (const r of rRows) {
            if (!reactorsByPost[r.target_id]) reactorsByPost[r.target_id] = [];
            reactorsByPost[r.target_id].push({
              userId: r.user_id,
              isCurrentUser: Boolean(currentUser && Number(r.user_id) === Number(currentUser.id)),
              username: r.username,
              name: r.name || r.username,
              avatar: r.avatar || '/profile.png',
              emoji: '❤️',
              createdAt: r.created_at
            });
          }
        }
      } catch (rErr) {
        console.warn('[ProfilePosts] Error fetching like reactors:', rErr.message);
      }
    }

    const posts = postRows.map(row => {
      const canEdit = Boolean(currentUser && (currentUser.id === row.user_id || isAdmin));
      const canDelete = Boolean(currentUser && (currentUser.id === row.user_id || isAdmin));
      return {
        id: row.id,
        userId: row.user_id,
        content: row.content,
        authorName: row.author_name || row.username || 'Member',
        authorUsername: row.username || 'member',
        authorAvatar: row.author_avatar || '/profile.png',
        authorRole: row.role || 'Member',
        likesCount: Number(row.likes_count || 0),
        commentsCount: Number(row.comments_count || 0),
        isLiked: likedPostIds.has(row.id),
        reactors: reactorsByPost[String(row.id)] || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        timeAgo: formatRelativeTime(row.created_at),
        canEdit,
        canDelete
      };
    });

    return sendJson(res, {
      success: true,
      posts,
      pagination: { page, limit, total, totalPages }
    }, 200);
  }

  // 2. GET /api/profile-posts/:id — Get Single Profile Post with full comments
  if (pathname.match(/^\/(api\/)?profile-posts\/\d+$/) && method === 'GET') {
    const postId = parseInt(pathname.split('/').pop(), 10);
    const row = await queryOne(`
      SELECT 
        pp.id,
        pp.user_id,
        pp.content,
        pp.likes_count,
        pp.comments_count,
        pp.created_at,
        pp.updated_at,
        u.username,
        u.role,
        COALESCE(p.display_name, u.username) AS author_name,
        COALESCE(p.avatar, '/profile.png') AS author_avatar
      FROM profile_posts pp
      JOIN users u ON pp.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE pp.id = ?;
    `, [postId]);

    if (!row) {
      return sendJson(res, { success: false, error: 'Profile post not found.' }, 404);
    }

    let isLiked = false;
    if (currentUser) {
      const likeCheck = await queryOne(`
        SELECT id FROM likes 
        WHERE target_type = 'profile_post' AND target_id = ? AND user_id = ?;
      `, [String(postId), currentUser.id]);
      isLiked = Boolean(likeCheck);
    }

    const commentRows = await query(`
      SELECT 
        ppc.id,
        ppc.post_id,
        ppc.user_id,
        ppc.content,
        ppc.created_at,
        u.username,
        u.role,
        COALESCE(p.display_name, u.username) AS author_name,
        COALESCE(p.avatar, '/profile.png') AS author_avatar
      FROM profile_post_comments ppc
      JOIN users u ON ppc.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE ppc.post_id = ?
      ORDER BY ppc.created_at ASC;
    `, [postId]);

    const comments = commentRows.map(c => ({
      id: c.id,
      postId: c.post_id,
      userId: c.user_id,
      content: c.content,
      authorName: c.author_name || c.username || 'Member',
      authorUsername: c.username || 'member',
      authorAvatar: c.author_avatar || '/profile.png',
      authorRole: c.role || 'Member',
      createdAt: c.created_at,
      timeAgo: formatRelativeTime(c.created_at),
      canDelete: Boolean(currentUser && (currentUser.id === c.user_id || currentUser.id === row.user_id || isAdmin))
    }));

    return sendJson(res, {
      success: true,
      post: {
        id: row.id,
        userId: row.user_id,
        content: row.content,
        authorName: row.author_name || row.username || 'Member',
        authorUsername: row.username || 'member',
        authorAvatar: row.author_avatar || '/profile.png',
        authorRole: row.role || 'Member',
        likesCount: Number(row.likes_count || 0),
        commentsCount: Number(row.comments_count || 0),
        isLiked,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        timeAgo: formatRelativeTime(row.created_at),
        canEdit: Boolean(currentUser && (currentUser.id === row.user_id || isAdmin)),
        canDelete: Boolean(currentUser && (currentUser.id === row.user_id || isAdmin)),
        comments
      }
    }, 200);
  }

  // 3. POST /api/profile-posts — Create a New Profile Post
  if ((pathname === '/profile-posts' || pathname === '/api/profile-posts') && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to share a profile post.' }, 401);
    }

    const body = await readJsonBody(req);
    const content = (body.content || '').trim();

    if (!content) {
      return sendJson(res, { success: false, error: 'Please enter something to post.' }, 400);
    }
    if (content.length > 2000) {
      return sendJson(res, { success: false, error: 'Post exceeds 2000 characters maximum limit.' }, 400);
    }

    const result = await query(`
      INSERT INTO profile_posts (user_id, content, created_at, updated_at)
      VALUES (?, ?, NOW(), NOW());
    `, [currentUser.id, content]);

    const newPostId = result.insertId;

    // Fetch author details for immediate client return
    const authorProfile = await queryOne(`
      SELECT u.username, u.role, COALESCE(p.display_name, u.username) AS author_name, COALESCE(p.avatar, '/profile.png') AS author_avatar
      FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?;
    `, [currentUser.id]);

    const post = {
      id: newPostId,
      userId: currentUser.id,
      content,
      authorName: authorProfile?.author_name || currentUser.username,
      authorUsername: authorProfile?.username || currentUser.username,
      authorAvatar: authorProfile?.author_avatar || '/profile.png',
      authorRole: authorProfile?.role || currentUser.role || 'Member',
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeAgo: 'Just now',
      canEdit: true,
      canDelete: true,
      comments: []
    };

    // Notify user's followers according to follow rules (strictly valid users only)
    try {
      const followers = await query(`
        SELECT f.follower_id 
        FROM follows f 
        INNER JOIN users u ON f.follower_id = u.id 
        WHERE f.following_id = ?;
      `, [currentUser.id]);
      const preview = content.length > 60 ? content.slice(0, 57) + '…' : content;
      const authorDisplayName = authorProfile?.author_name || currentUser.username;

      for (const f of followers) {
        try {
          await createNotification({
            userId: f.follower_id,
            actorId: currentUser.id,
            type: 'announcement',
            title: 'New Profile Post',
            message: `${authorDisplayName} posted: "${preview}"`,
            link: `#forms?post=${newPostId}`,
            entityType: 'profile_post',
            entityId: newPostId
          });
        } catch (perErr) {
          console.warn('[Profile Post Single Follower Notification Warning]:', perErr.message);
        }
      }
    } catch (notifErr) {
      console.warn('[Profile Post Notification Error]:', notifErr.message);
    }

    return sendJson(res, { success: true, post, message: 'Profile post published!' }, 201);
  }

  // 4. PUT /api/profile-posts/:id — Edit an Existing Profile Post
  if (pathname.match(/^\/(api\/)?profile-posts\/\d+$/) && method === 'PUT') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to edit this post.' }, 401);
    }

    const postId = parseInt(pathname.split('/').pop(), 10);
    const existing = await queryOne('SELECT * FROM profile_posts WHERE id = ?;', [postId]);
    if (!existing) {
      return sendJson(res, { success: false, error: 'Profile post not found.' }, 404);
    }

    // Permission enforcement: only creator or admin can edit
    if (Number(existing.user_id) !== Number(currentUser.id) && !isAdmin) {
      return sendJson(res, { success: false, error: 'Access denied: You can only edit your own posts.' }, 403);
    }

    const body = await readJsonBody(req);
    const newContent = (body.content || '').trim();
    if (!newContent) {
      return sendJson(res, { success: false, error: 'Content cannot be empty.' }, 400);
    }

    await query('UPDATE profile_posts SET content = ?, updated_at = NOW() WHERE id = ?;', [newContent, postId]);

    return sendJson(res, {
      success: true,
      post: {
        id: postId,
        content: newContent,
        updatedAt: new Date().toISOString()
      },
      message: 'Profile post updated successfully.'
    }, 200);
  }

  // 5. DELETE /api/profile-posts/:id — Delete Profile Post
  if (pathname.match(/^\/(api\/)?profile-posts\/\d+$/) && method === 'DELETE') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to delete this post.' }, 401);
    }

    const postId = parseInt(pathname.split('/').pop(), 10);
    const existing = await queryOne('SELECT * FROM profile_posts WHERE id = ?;', [postId]);
    if (!existing) {
      return sendJson(res, { success: false, error: 'Profile post not found.' }, 404);
    }

    // Permission enforcement: only creator or admin can delete
    if (Number(existing.user_id) !== Number(currentUser.id) && !isAdmin) {
      return sendJson(res, { success: false, error: 'Access denied: You can only delete your own posts.' }, 403);
    }

    // Delete associated likes and comments
    await query("DELETE FROM likes WHERE target_type = 'profile_post' AND target_id = ?;", [String(postId)]);
    await query('DELETE FROM profile_posts WHERE id = ?;', [postId]);

    return sendJson(res, { success: true, message: 'Profile post permanently deleted.' }, 200);
  }

  // 6. POST /api/profile-posts/:id/like — Toggle Like on a Profile Post
  if (pathname.match(/^\/(api\/)?profile-posts\/\d+\/like$/) && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to like posts.' }, 401);
    }

    const parts = pathname.split('/');
    const postId = parseInt(parts[parts.length - 2], 10);

    const post = await queryOne('SELECT id, user_id, likes_count, content FROM profile_posts WHERE id = ?;', [postId]);
    if (!post) {
      return sendJson(res, { success: false, error: 'Profile post not found.' }, 404);
    }

    const existingLike = await queryOne(`
      SELECT id FROM likes 
      WHERE target_type = 'profile_post' AND target_id = ? AND user_id = ?;
    `, [String(postId), currentUser.id]);

    let isLiked = false;
    if (existingLike) {
      await query('DELETE FROM likes WHERE id = ?;', [existingLike.id]);
      isLiked = false;
    } else {
      await query(`
        INSERT INTO likes (target_type, target_id, user_id, created_at)
        VALUES ('profile_post', ?, ?, NOW());
      `, [String(postId), currentUser.id]);
      isLiked = true;

      // Notify post author (if not self)
      if (Number(post.user_id) !== Number(currentUser.id)) {
        try {
          const likerProfile = await queryOne(`
            SELECT COALESCE(p.display_name, u.username) AS name 
            FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?;
          `, [currentUser.id]);
          const likerName = likerProfile?.name || currentUser.username || 'A reader';

          await createNotification({
            userId: post.user_id,
            actorId: currentUser.id,
            type: 'comment_reaction',
            title: 'Liked your profile post',
            message: `${likerName} liked your profile post`,
            link: `#forms?post=${postId}`,
            entityType: 'profile_post',
            entityId: postId
          });
        } catch (e) {
          console.warn('[Like Notification Error]:', e.message);
        }
      }
    }

    // Update likes_count in database
    const countRow = await queryOne("SELECT COUNT(*) AS count FROM likes WHERE target_type = 'profile_post' AND target_id = ?;", [String(postId)]);
    const likesCount = Number(countRow?.count || 0);
    await query('UPDATE profile_posts SET likes_count = ? WHERE id = ?;', [likesCount, postId]);

    // Load updated reactors
    let reactors = [];
    if (likesCount > 0) {
      const rRows = await query(`
        SELECT l.user_id, l.created_at,
               u.username,
               COALESCE(p.display_name, u.username) AS name,
               p.avatar
        FROM likes l
        JOIN users u ON l.user_id = u.id
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE l.target_type = 'profile_post' AND l.target_id = ?
        ORDER BY (l.user_id = ?) DESC, l.created_at DESC;
      `, [String(postId), currentUser.id]);

      reactors = rRows.map(r => ({
        userId: r.user_id,
        isCurrentUser: Boolean(Number(r.user_id) === Number(currentUser.id)),
        username: r.username,
        name: r.name || r.username,
        avatar: r.avatar || '/profile.png',
        emoji: '❤️',
        createdAt: r.created_at
      }));
    }

    return sendJson(res, {
      success: true,
      isLiked,
      likesCount,
      total: likesCount,
      activeEmojis: likesCount > 0 ? ['❤️'] : [],
      reactors
    }, 200);
  }

  // 7. GET /api/profile-posts/:id/comments — Get Comments on a Profile Post
  if (pathname.match(/^\/(api\/)?profile-posts\/\d+\/comments$/) && method === 'GET') {
    const parts = pathname.split('/');
    const postId = parseInt(parts[parts.length - 2], 10);

    const post = await queryOne('SELECT id, user_id FROM profile_posts WHERE id = ?;', [postId]);
    if (!post) {
      return sendJson(res, { success: false, error: 'Profile post not found.' }, 404);
    }

    const commentRows = await query(`
      SELECT 
        ppc.id,
        ppc.post_id,
        ppc.user_id,
        ppc.content,
        ppc.created_at,
        u.username,
        u.role,
        COALESCE(p.display_name, u.username) AS author_name,
        COALESCE(p.avatar, '/profile.png') AS author_avatar
      FROM profile_post_comments ppc
      JOIN users u ON ppc.user_id = u.id
      LEFT JOIN profiles p ON u.id = p.user_id
      WHERE ppc.post_id = ?
      ORDER BY ppc.created_at ASC;
    `, [postId]);

    const comments = commentRows.map(c => ({
      id: c.id,
      postId: c.post_id,
      userId: c.user_id,
      content: c.content,
      authorName: c.author_name || c.username || 'Member',
      authorUsername: c.username || 'member',
      authorAvatar: c.author_avatar || '/profile.png',
      authorRole: c.role || 'Member',
      createdAt: c.created_at,
      timeAgo: formatRelativeTime(c.created_at),
      canDelete: Boolean(currentUser && (currentUser.id === c.user_id || currentUser.id === post.user_id || isAdmin))
    }));

    return sendJson(res, { success: true, comments }, 200);
  }

  // 8. POST /api/profile-posts/:id/comments — Add a Comment on a Profile Post
  if (pathname.match(/^\/(api\/)?profile-posts\/\d+\/comments$/) && method === 'POST') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to comment.' }, 401);
    }

    const parts = pathname.split('/');
    const postId = parseInt(parts[parts.length - 2], 10);

    const post = await queryOne('SELECT id, user_id, content FROM profile_posts WHERE id = ?;', [postId]);
    if (!post) {
      return sendJson(res, { success: false, error: 'Profile post not found.' }, 404);
    }

    const body = await readJsonBody(req);
    const content = (body.content || '').trim();
    if (!content) {
      return sendJson(res, { success: false, error: 'Comment cannot be empty.' }, 400);
    }
    if (content.length > 500) {
      return sendJson(res, { success: false, error: 'Comment is too long (max 500 characters).' }, 400);
    }

    const resIns = await query(`
      INSERT INTO profile_post_comments (post_id, user_id, content, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW());
    `, [postId, currentUser.id, content]);

    const newCommentId = resIns.insertId;

    // Recalculate comments_count
    const countRow = await queryOne('SELECT COUNT(*) AS count FROM profile_post_comments WHERE post_id = ?;', [postId]);
    const commentsCount = Number(countRow?.count || 0);
    await query('UPDATE profile_posts SET comments_count = ? WHERE id = ?;', [commentsCount, postId]);

    // Fetch commenter details
    const commenterProfile = await queryOne(`
      SELECT u.username, u.role, COALESCE(p.display_name, u.username) AS name, COALESCE(p.avatar, '/profile.png') AS avatar
      FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?;
    `, [currentUser.id]);

    const commenterName = commenterProfile?.name || currentUser.username || 'Member';
    const preview = content.length > 50 ? content.slice(0, 47) + '…' : content;

    // Notify post author (if not self)
    if (Number(post.user_id) !== Number(currentUser.id)) {
      try {
        await createNotification({
          userId: post.user_id,
          actorId: currentUser.id,
          type: 'novel_comment',
          title: 'New comment on your profile post',
          message: `${commenterName} commented: "${preview}"`,
          link: `#forms?post=${postId}`,
          entityType: 'profile_post',
          entityId: postId
        });
      } catch (err) {
        console.warn('[Comment Author Notification Error]:', err.message);
      }
    }

    // Also notify other commenters who joined this thread
    try {
      const otherCommenters = await query(`
        SELECT DISTINCT user_id FROM profile_post_comments 
        WHERE post_id = ? AND user_id NOT IN (?, ?);
      `, [postId, currentUser.id, post.user_id]);

      for (const oc of otherCommenters) {
        await createNotification({
          userId: oc.user_id,
          actorId: currentUser.id,
          type: 'comment_reply',
          title: 'New reply on a profile post',
          message: `${commenterName} also commented on a profile post you joined: "${preview}"`,
          link: `#forms?post=${postId}`,
          entityType: 'profile_post',
          entityId: postId
        });
      }
    } catch (err) {
      console.warn('[Other Commenters Notification Error]:', err.message);
    }

    return sendJson(res, {
      success: true,
      comment: {
        id: newCommentId,
        postId,
        userId: currentUser.id,
        content,
        authorName: commenterName,
        authorUsername: commenterProfile?.username || currentUser.username,
        authorAvatar: commenterProfile?.avatar || '/profile.png',
        authorRole: commenterProfile?.role || currentUser.role || 'Member',
        createdAt: new Date().toISOString(),
        timeAgo: 'Just now',
        canDelete: true
      },
      commentsCount
    }, 201);
  }

  // 9. DELETE /api/profile-posts/comments/:id — Delete a Comment
  if (pathname.match(/^\/(api\/)?profile-posts\/comments\/\d+$/) && method === 'DELETE') {
    if (!currentUser) {
      return sendJson(res, { success: false, error: 'Please log in to delete this comment.' }, 401);
    }

    const commentId = parseInt(pathname.split('/').pop(), 10);
    const comment = await queryOne('SELECT * FROM profile_post_comments WHERE id = ?;', [commentId]);
    if (!comment) {
      return sendJson(res, { success: false, error: 'Comment not found.' }, 404);
    }

    const post = await queryOne('SELECT user_id FROM profile_posts WHERE id = ?;', [comment.post_id]);
    const isPostOwner = post && Number(post.user_id) === Number(currentUser.id);
    const isCommentOwner = Number(comment.user_id) === Number(currentUser.id);

    if (!isCommentOwner && !isPostOwner && !isAdmin) {
      return sendJson(res, { success: false, error: 'Access denied: You do not have permission to delete this comment.' }, 403);
    }

    await query('DELETE FROM profile_post_comments WHERE id = ?;', [commentId]);

    // Recalculate comments_count
    const countRow = await queryOne('SELECT COUNT(*) AS count FROM profile_post_comments WHERE post_id = ?;', [comment.post_id]);
    const commentsCount = Number(countRow?.count || 0);
    await query('UPDATE profile_posts SET comments_count = ? WHERE id = ?;', [commentsCount, comment.post_id]);

    return sendJson(res, { success: true, message: 'Comment deleted.', commentsCount }, 200);
  }

  // Not handled by this sub-router
  return false;
}

