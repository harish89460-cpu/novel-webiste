/**
 * Rudhra Prarthana Novels — Short Stories Backend Module
 * Comprehensive Database-Connected Short Stories Management,
 * Publishing, Scheduling, Comments, View Counters, and Access Control.
 */

import { query, queryOne } from './db.js';

/**
 * Initialize MySQL tables for Short Stories and migrate initial data
 */
export async function initShortStoriesTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS short_stories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(150) NOT NULL UNIQUE,
        title VARCHAR(255) NOT NULL,
        title_ta VARCHAR(255) NULL,
        author VARCHAR(150) NOT NULL DEFAULT 'Rudhra Prarthana',
        genre VARCHAR(100) DEFAULT 'Romance / Feel Good',
        description TEXT,
        cover_image VARCHAR(500),
        content LONGTEXT NOT NULL,
        word_count INT DEFAULT 0,
        read_time VARCHAR(50) DEFAULT '5 mins',
        status ENUM('draft', 'scheduled', 'published', 'disabled') DEFAULT 'published',
        is_disabled TINYINT(1) DEFAULT 0,
        visibility VARCHAR(50) DEFAULT 'public',
        scheduled_at DATETIME NULL,
        timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
        views_count INT DEFAULT 0,
        comments_count INT DEFAULT 0,
        likes_count INT DEFAULT 0,
        sort_order INT DEFAULT 1,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_slug (slug),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS short_story_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        story_id INT NOT NULL,
        user_id INT NOT NULL,
        parent_id INT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_story (story_id),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Migrate poongaatru-punnagaikka if not already migrated
    const existing = await queryOne('SELECT id FROM short_stories WHERE slug = ? LIMIT 1;', ['poongaatru-punnagaikka']);
    if (!existing) {
      const novel = await queryOne('SELECT * FROM novels WHERE id = ?;', ['poongaatru-punnagaikka']);
      const chapter = await queryOne('SELECT * FROM chapters WHERE novel_id = ? LIMIT 1;', ['poongaatru-punnagaikka']);

      if (novel && chapter) {
        const title = `${novel.title} — ${chapter.title || 'Story Collection'}`;
        const content = chapter.content || '<p>A heartwarming short story by Rudhra Prarthana.</p>';
        const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        const words = plainText ? plainText.split(/\s+/).length : 250;
        const readTime = `${Math.max(1, Math.ceil(words / 200))} mins`;
        const viewsCount = parseInt(String(novel.views || '0').replace(/,/g, ''), 10) || 64300;

        await query(`
          INSERT IGNORE INTO short_stories (
            slug, title, author, genre, description, cover_image, content, 
            word_count, read_time, status, is_disabled, visibility, views_count, 
            sort_order, published_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 0, 'public', ?, 1, ?, NOW(), NOW());
        `, [
          'poongaatru-punnagaikka',
          title,
          novel.author || 'Rudhra Prarthana',
          novel.genre || 'Romance / Feel Good',
          novel.description || 'Heartwarming short stories bringing the gentle joys and warmth of everyday life to readers.',
          novel.cover || 'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?auto=format&fit=crop&w=600&q=80',
          content,
          words,
          readTime,
          viewsCount,
          novel.updated_at || new Date()
        ]);
        console.log('[SHORT STORIES] Successfully migrated poongaatru-punnagaikka into short_stories table.');
      }
    }
  } catch (err) {
    console.error('Failed to initialize short_stories table:', err.message);
  }
}

// Auto-run table init on module import
initShortStoriesTable();

/**
 * Generate a clean URL slug from title
 */
export function slugifyTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 140);
}

/**
 * Fetch all public published short stories
 */
export async function getPublicShortStories(options = {}) {
  await checkAndPublishDueShortStories();

  const search = options.search ? `%${options.search.trim()}%` : null;
  const genre = options.genre && options.genre !== 'All' ? options.genre.trim() : null;

  let sql = `
    SELECT 
      s.id,
      s.slug,
      s.title,
      s.title_ta,
      s.author,
      s.genre,
      s.description,
      s.cover_image,
      s.word_count,
      s.read_time,
      s.status,
      s.views_count,
      s.comments_count,
      s.likes_count,
      s.sort_order,
      s.published_at,
      s.created_at,
      s.updated_at,
      (SELECT COUNT(*) FROM short_story_comments WHERE story_id = s.id) AS real_comments_count
    FROM short_stories s
    WHERE s.status = 'published' AND s.is_disabled = 0
  `;
  const params = [];

  if (search) {
    sql += ` AND (s.title LIKE ? OR s.description LIKE ? OR s.genre LIKE ?)`;
    params.push(search, search, search);
  }

  if (genre) {
    sql += ` AND s.genre = ?`;
    params.push(genre);
  }

  sql += ` ORDER BY s.sort_order ASC, s.published_at DESC;`;

  const rows = await query(sql, params);

  return (rows || []).map(r => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    titleTa: r.title_ta || r.title,
    author: r.author || 'Rudhra Prarthana',
    genre: r.genre || 'Romance / Feel Good',
    description: r.description || '',
    coverImage: r.cover_image || '/default-cover.jpg',
    wordCount: r.word_count,
    readTime: r.read_time,
    status: r.status,
    viewsCount: r.views_count,
    commentsCount: Math.max(r.comments_count, r.real_comments_count || 0),
    likesCount: r.likes_count,
    sortOrder: r.sort_order,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    link: `#story?id=${encodeURIComponent(r.slug || r.id)}`
  }));
}

/**
 * Fetch a single short story for reading by ID or slug
 */
export async function getShortStoryByIdOrSlug(idOrSlug, currentUser = null, recordView = true) {
  await checkAndPublishDueShortStories();

  const isNumeric = /^\d+$/.test(String(idOrSlug));
  let row = null;

  if (isNumeric) {
    row = await queryOne('SELECT * FROM short_stories WHERE id = ? LIMIT 1;', [parseInt(idOrSlug, 10)]);
  }
  if (!row) {
    row = await queryOne('SELECT * FROM short_stories WHERE slug = ? LIMIT 1;', [String(idOrSlug)]);
  }

  if (!row) {
    return { success: false, error: 'Short story not found.', code: 'NOT_FOUND' };
  }

  const isAdmin = currentUser && (currentUser.isAdmin || currentUser.role === 'admin' || currentUser.role === 'author' || currentUser.isAuthorSession);

  // Access Control: check disabled state
  if (row.is_disabled && !isAdmin) {
    return {
      success: false,
      error: 'This short story has been temporarily placed on hold by the author.',
      code: 'DISABLED',
      title: row.title
    };
  }

  // Access Control: check published state
  if (row.status !== 'published' && !isAdmin) {
    return {
      success: false,
      error: 'This short story is not yet published.',
      code: 'UNPUBLISHED',
      title: row.title
    };
  }

  // Access Control: check visibility
  if (!isAdmin) {
    const vis = (row.visibility || 'public').toLowerCase();
    if (vis === 'private' || vis === 'admin_only') {
      return {
        success: false,
        error: 'This short story is private and restricted to authorized administrators.',
        code: 'FORBIDDEN',
        title: row.title
      };
    }
    if (vis === 'members' || vis === 'all_members') {
      if (!currentUser || !currentUser.id) {
        return {
          success: false,
          error: 'Please log in as an authorized member to read this short story.',
          code: 'UNAUTHORIZED',
          requireLogin: true,
          title: row.title
        };
      }
    }
    if (vis === 'selected_members') {
      if (!currentUser || !currentUser.id) {
        return {
          success: false,
          error: 'Please log in to read this restricted short story.',
          code: 'UNAUTHORIZED',
          requireLogin: true,
          title: row.title
        };
      }
      const rule = await queryOne(`
        SELECT id FROM content_access_rules 
        WHERE target_type IN ('story', 'short_story', 'novel') 
          AND (target_id = ? OR target_id = ?) 
          AND user_id = ? 
          AND rule_type = 'allow'
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1;
      `, [String(row.id), String(row.slug), currentUser.id]);
      if (!rule) {
        return {
          success: false,
          error: 'Access restricted: You have not been selected to view this content.',
          code: 'FORBIDDEN',
          title: row.title
        };
      }
    }
  }

  // Record genuine read view count
  if (recordView) {
    try {
      await query('UPDATE short_stories SET views_count = views_count + 1 WHERE id = ?;', [row.id]);
      row.views_count += 1;
    } catch {}
  }

  // Real comments count
  const commentCountRow = await queryOne('SELECT COUNT(*) as c FROM short_story_comments WHERE story_id = ?;', [row.id]);
  const realCommentsCount = Math.max(row.comments_count, commentCountRow?.c || 0);

  return {
    success: true,
    story: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      titleTa: row.title_ta || row.title,
      author: row.author || 'Rudhra Prarthana',
      authorAvatar: '/profile.png',
      genre: row.genre || 'Romance / Feel Good',
      description: row.description || '',
      coverImage: row.cover_image || '/default-cover.jpg',
      content: row.content || '',
      wordCount: row.word_count,
      readTime: row.read_time,
      status: row.status,
      isDisabled: Boolean(row.is_disabled),
      visibility: row.visibility,
      viewsCount: row.views_count,
      commentsCount: realCommentsCount,
      likesCount: row.likes_count,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  };
}

/**
 * Fetch comments for a short story
 */
export async function getStoryComments(storyId) {
  const rows = await query(`
    SELECT 
      c.id,
      c.story_id,
      c.user_id,
      c.parent_id,
      c.content,
      c.created_at,
      c.updated_at,
      COALESCE(p.display_name, u.username, 'Member') AS author_name,
      COALESCE(p.avatar, '/profile.png') AS author_avatar,
      u.role AS author_role
    FROM short_story_comments c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE c.story_id = ?
    ORDER BY c.created_at ASC;
  `, [parseInt(storyId, 10)]);

  return (rows || []).map(r => ({
    id: r.id,
    storyId: r.story_id,
    userId: r.user_id,
    parentId: r.parent_id,
    authorName: r.author_name,
    authorAvatar: r.author_avatar,
    authorRole: r.author_role,
    content: r.content,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

/**
 * Add a comment to a short story
 */
export async function addStoryComment(storyId, userId, content, parentId = null) {
  const cleanContent = String(content || '').trim();
  if (!cleanContent) {
    return { success: false, error: 'Comment content cannot be empty.' };
  }

  const story = await queryOne('SELECT id, title FROM short_stories WHERE id = ?;', [parseInt(storyId, 10)]);
  if (!story) {
    return { success: false, error: 'Short story not found.' };
  }

  const result = await query(`
    INSERT INTO short_story_comments (story_id, user_id, parent_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, NOW(), NOW());
  `, [story.id, parseInt(userId, 10), parentId ? parseInt(parentId, 10) : null, cleanContent]);

  // Update story comments count
  await query(`
    UPDATE short_stories 
    SET comments_count = (SELECT COUNT(*) FROM short_story_comments WHERE story_id = ?)
    WHERE id = ?;
  `, [story.id, story.id]);

  const newComment = await queryOne(`
    SELECT 
      c.id, c.story_id, c.user_id, c.parent_id, c.content, c.created_at,
      COALESCE(p.display_name, u.username, 'Member') AS author_name,
      COALESCE(p.avatar, '/profile.png') AS author_avatar,
      u.role AS author_role
    FROM short_story_comments c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN profiles p ON u.id = p.user_id
    WHERE c.id = ?;
  `, [result.insertId]);

  return {
    success: true,
    commentId: result.insertId,
    comment: newComment
  };
}

/**
 * Fetch all short stories for Admin Dashboard (includes draft, scheduled, disabled)
 */
export async function getAdminShortStories(filters = {}) {
  await checkAndPublishDueShortStories();

  const search = filters.search ? `%${filters.search.trim()}%` : null;
  const status = filters.status && filters.status !== 'all' ? filters.status.trim() : null;

  let sql = `
    SELECT 
      s.*,
      (SELECT COUNT(*) FROM short_story_comments WHERE story_id = s.id) AS real_comments_count
    FROM short_stories s
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    sql += ` AND (s.title LIKE ? OR s.slug LIKE ? OR s.genre LIKE ? OR s.author LIKE ?)`;
    params.push(search, search, search, search);
  }

  if (status) {
    if (status === 'disabled') {
      sql += ` AND s.is_disabled = 1`;
    } else {
      sql += ` AND s.status = ? AND s.is_disabled = 0`;
      params.push(status);
    }
  }

  sql += ` ORDER BY s.sort_order ASC, s.created_at DESC;`;

  const rows = await query(sql, params);

  return (rows || []).map(r => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    titleTa: r.title_ta || r.title,
    author: r.author,
    genre: r.genre,
    description: r.description,
    coverImage: r.cover_image,
    content: r.content,
    wordCount: r.word_count,
    readTime: r.read_time,
    status: r.is_disabled ? 'disabled' : r.status,
    rawStatus: r.status,
    isDisabled: Boolean(r.is_disabled),
    visibility: r.visibility,
    scheduledAt: r.scheduled_at,
    timezone: r.timezone,
    viewsCount: r.views_count,
    commentsCount: Math.max(r.comments_count, r.real_comments_count || 0),
    likesCount: r.likes_count,
    sortOrder: r.sort_order,
    publishedAt: r.published_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  }));
}

/**
 * Admin: Create a new Short Story
 */
export async function createShortStory(data) {
  const title = String(data.title || '').trim();
  const content = String(data.content || '').trim();

  if (!title) {
    return { success: false, error: 'Short story title is required.' };
  }
  if (!content) {
    return { success: false, error: 'Story content cannot be empty.' };
  }

  let slug = String(data.slug || '').trim() || slugifyTitle(title);
  if (!slug) {
    slug = 'story-' + Date.now();
  }

  // Ensure unique slug
  let finalSlug = slug;
  let counter = 1;
  while (true) {
    const dup = await queryOne('SELECT id FROM short_stories WHERE slug = ? LIMIT 1;', [finalSlug]);
    if (!dup) break;
    finalSlug = `${slug}-${counter++}`;
  }

  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const readTime = `${Math.max(1, Math.ceil(words / 200))} mins`;

  const author = String(data.author || 'Rudhra Prarthana').trim();
  const genre = String(data.genre || 'Romance / Feel Good').trim();
  const description = String(data.description || '').trim();
  const coverImage = String(data.coverImage || data.cover_image || '/default-cover.jpg').trim();
  const status = ['draft', 'scheduled', 'published'].includes(data.status) ? data.status : 'published';
  const visibility = data.visibility || 'public';
  const sortOrder = parseInt(data.sortOrder || 1, 10);

  let scheduledAt = null;
  let timezone = data.timezone || 'Asia/Kolkata';

  if (status === 'scheduled') {
    if (!data.scheduledAt) {
      return { success: false, error: 'Please specify publication date and time to schedule this story.' };
    }
    scheduledAt = new Date(data.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      return { success: false, error: 'Invalid scheduled date/time.' };
    }
  }

  const result = await query(`
    INSERT INTO short_stories (
      slug, title, title_ta, author, genre, description, cover_image, content,
      word_count, read_time, status, is_disabled, visibility, scheduled_at, timezone,
      views_count, comments_count, sort_order, published_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 0, 0, ?, ?, NOW(), NOW());
  `, [
    finalSlug,
    title,
    data.titleTa || title,
    author,
    genre,
    description,
    coverImage,
    content,
    words,
    readTime,
    status,
    visibility,
    scheduledAt,
    timezone,
    sortOrder,
    status === 'published' ? new Date() : (scheduledAt || null)
  ]);

  const created = await queryOne('SELECT * FROM short_stories WHERE id = ?;', [result.insertId]);

  return {
    success: true,
    storyId: result.insertId,
    story: created
  };
}

/**
 * Admin: Update an existing Short Story
 */
export async function updateShortStory(id, data) {
  const existing = await queryOne('SELECT * FROM short_stories WHERE id = ?;', [parseInt(id, 10)]);
  if (!existing) {
    return { success: false, error: 'Short story not found.' };
  }

  const title = data.title !== undefined ? String(data.title).trim() : existing.title;
  const content = data.content !== undefined ? String(data.content).trim() : existing.content;

  if (!title) {
    return { success: false, error: 'Story title cannot be empty.' };
  }
  if (!content) {
    return { success: false, error: 'Story content cannot be empty.' };
  }

  let slug = data.slug !== undefined ? String(data.slug).trim() : existing.slug;
  if (!slug) slug = slugifyTitle(title);

  // Check unique slug if changed
  if (slug !== existing.slug) {
    const dup = await queryOne('SELECT id FROM short_stories WHERE slug = ? AND id != ? LIMIT 1;', [slug, existing.id]);
    if (dup) {
      return { success: false, error: `A story with slug "${slug}" already exists.` };
    }
  }

  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const readTime = `${Math.max(1, Math.ceil(words / 200))} mins`;

  const author = data.author !== undefined ? String(data.author).trim() : existing.author;
  const genre = data.genre !== undefined ? String(data.genre).trim() : existing.genre;
  const description = data.description !== undefined ? String(data.description).trim() : existing.description;
  const coverImage = data.coverImage !== undefined ? String(data.coverImage).trim() : (data.cover_image !== undefined ? String(data.cover_image).trim() : existing.cover_image);
  const status = data.status !== undefined && ['draft', 'scheduled', 'published'].includes(data.status) ? data.status : existing.status;
  const sortOrder = data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : existing.sort_order;

  let scheduledAt = existing.scheduled_at;
  let timezone = data.timezone || existing.timezone || 'Asia/Kolkata';

  if (status === 'scheduled') {
    if (data.scheduledAt) {
      scheduledAt = new Date(data.scheduledAt);
      if (isNaN(scheduledAt.getTime())) {
        return { success: false, error: 'Invalid scheduled date/time.' };
      }
    }
  } else if (status === 'published' && !existing.published_at) {
    existing.published_at = new Date();
  }

  await query(`
    UPDATE short_stories SET
      slug = ?,
      title = ?,
      title_ta = ?,
      author = ?,
      genre = ?,
      description = ?,
      cover_image = ?,
      content = ?,
      word_count = ?,
      read_time = ?,
      status = ?,
      scheduled_at = ?,
      timezone = ?,
      sort_order = ?,
      updated_at = NOW()
    WHERE id = ?;
  `, [
    slug,
    title,
    data.titleTa || existing.title_ta || title,
    author,
    genre,
    description,
    coverImage,
    content,
    words,
    readTime,
    status,
    scheduledAt,
    timezone,
    sortOrder,
    existing.id
  ]);

  const updated = await queryOne('SELECT * FROM short_stories WHERE id = ?;', [existing.id]);

  return {
    success: true,
    story: updated
  };
}

/**
 * Admin: Toggle disabled status (Temporarily Disable or Restore)
 */
export async function toggleShortStoryDisabled(id, forcedDisabled = null) {
  const existing = await queryOne('SELECT id, is_disabled, title FROM short_stories WHERE id = ?;', [parseInt(id, 10)]);
  if (!existing) {
    return { success: false, error: 'Short story not found.' };
  }

  const newDisabled = forcedDisabled !== null ? (forcedDisabled ? 1 : 0) : (existing.is_disabled ? 0 : 1);
  const newStatus = newDisabled ? 'disabled' : 'published';

  await query('UPDATE short_stories SET is_disabled = ?, status = ? WHERE id = ?;', [newDisabled, newStatus, existing.id]);

  return {
    success: true,
    id: existing.id,
    isDisabled: Boolean(newDisabled),
    status: newStatus,
    title: existing.title
  };
}

/**
 * Admin: Delete a Short Story and its comments
 */
export async function deleteShortStory(id) {
  const existing = await queryOne('SELECT id, title FROM short_stories WHERE id = ?;', [parseInt(id, 10)]);
  if (!existing) {
    return { success: false, error: 'Short story not found.' };
  }

  await query('DELETE FROM short_story_comments WHERE story_id = ?;', [existing.id]);
  await query('DELETE FROM short_stories WHERE id = ?;', [existing.id]);

  return {
    success: true,
    id: existing.id,
    title: existing.title
  };
}

/**
 * Automated Background Engine: Check and publish due scheduled short stories
 */
export async function checkAndPublishDueShortStories() {
  try {
    const dueRows = await query(`
      SELECT id, title, slug, scheduled_at 
      FROM short_stories
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= NOW();
    `);

    if (!dueRows || dueRows.length === 0) {
      return { publishedCount: 0, publishedIds: [] };
    }

    const publishedIds = [];
    for (const s of dueRows) {
      await query(`
        UPDATE short_stories
        SET status = 'published',
            published_at = COALESCE(scheduled_at, NOW()),
            scheduled_at = NULL
        WHERE id = ?;
      `, [s.id]);
      publishedIds.push(s.id);
    }

    console.log(`[SHORT STORIES SCHEDULER] Automatically released ${publishedIds.length} due short story(s):`, publishedIds);
    return { publishedCount: publishedIds.length, publishedIds };
  } catch (err) {
    console.error('Error in checkAndPublishDueShortStories:', err.message);
    return { publishedCount: 0, publishedIds: [] };
  }
}
