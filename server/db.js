// MySQL Relational Database Layer for Rudhra Prarthana Novels
// Centralized single database connection pool with parameterized queries

import mysql from 'mysql2/promise';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
function getDirname() {
  try {
    if (typeof import.meta !== 'undefined' && import.meta?.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch (_) {}
  return path.resolve(process.cwd(), 'backend');
}

const __dirname = getDirname();

// Load environment variables from .env
export function loadEnv() {
  const currentDir = getDirname();
  const envPath = fs.existsSync(path.resolve(currentDir, '.env'))
    ? path.resolve(currentDir, '.env')
    : path.resolve(currentDir, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          process.env[key] = val;
        }
      }
    });
  }
}

loadEnv();

let poolInstance = null;

/**
 * Get or create the singleton MySQL connection pool
 */
export function getDb() {
  if (!poolInstance) {
    loadEnv();
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'root';
    const database = process.env.DB_NAME || 'rp_novels_db';

    poolInstance = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 15,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      dateStrings: true
    });
  }
  return poolInstance;
}

/**
 * Helper to execute parameterized queries
 */
export async function query(sql, params = []) {
  const pool = getDb();
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Diagnostic health check for MySQL connection with clear troubleshooting messages
 */
export async function testDbConnection() {
  try {
    const pool = getDb();
    const [verRows] = await pool.query('SELECT VERSION() AS version, DATABASE() AS db;');
    const [tables] = await pool.query('SHOW TABLES;');
    const version = verRows[0]?.version || 'Unknown';
    const currentDb = verRows[0]?.db || process.env.DB_NAME;
    return {
      ok: true,
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      database: currentDb,
      version,
      tableCount: tables.length
    };
  } catch (err) {
    let diagnostic = '';
    const host = process.env.DB_HOST || 'localhost';
    const port = Number(process.env.DB_PORT) || 3306;
    const user = process.env.DB_USER || 'root';
    const db = process.env.DB_NAME || 'rp_novels_db';

    if (err.code === 'ECONNREFUSED') {
      diagnostic = `MySQL Server is stopped or port ${port} is not listening on ${host}.\n` +
        `Troubleshooting: On Windows, run PowerShell 'Start-Service MySQL80' or check Windows Services (services.msc).`;
    } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      diagnostic = `MySQL authentication failed for user '${user}'.\n` +
        `Troubleshooting: Verify DB_USER and DB_PASSWORD credentials in .env.`;
    } else if (err.code === 'ER_BAD_DB_ERROR') {
      diagnostic = `Database '${db}' does not exist on MySQL Server.\n` +
        `Troubleshooting: Run 'node server/migrate.js' to create and initialize the database.`;
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
      diagnostic = `MySQL host '${host}' could not be reached on port ${port}.\n` +
        `Troubleshooting: Check DB_HOST and DB_PORT settings in .env.`;
    } else {
      diagnostic = `MySQL error: ${err.message} [Code: ${err.code || 'UNKNOWN'}].`;
    }

    return {
      ok: false,
      error: err.message,
      code: err.code,
      diagnostic
    };
  }
}

/**
 * Helper to execute single-row queries
 */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows && rows.length > 0 ? rows[0] : null;
}

/**
 * Cryptographic Scrypt Password Hashing
 */
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/**
 * Timing-safe password verification
 */
export function verifyPassword(password, hash, salt) {
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Fetch formatted Latest Posts & Trending Posts for the Community Sidebar
 */
export async function getSidebarPostsFromDb() {
  function formatRelativeTime(dateStr) {
    if (!dateStr) return 'Recently';
    try {
      const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
      const date = new Date(normalized);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 2) return 'Just now';
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

  function mapPostRow(r) {
    const rawExcerpt = (r.excerpt || '').replace(/<[^>]+>/g, '').trim();
    const cleanExcerpt = rawExcerpt.length > 75 ? rawExcerpt.substring(0, 75) + '...' : rawExcerpt;
    const resolvedNovelId = r.novel_id || resolveNovelIdFromTitle(r.title);
    const link = resolvedNovelId
      ? `#novel?id=${encodeURIComponent(resolvedNovelId)}${r.chapter_num ? '&ch=' + encodeURIComponent(r.chapter_num) : ''}#comments`
      : `#topic?id=${encodeURIComponent(r.id)}`;

    return {
      id: r.id,
      novelId: resolvedNovelId,
      chapterNum: r.chapter_num || null,
      title: r.title,
      category: r.category_title,
      categoryId: r.category_id,
      author: r.author_name || 'Member',
      lastAuthor: r.last_author_name || r.author_name || 'Member',
      avatar: r.author_avatar || '/profile.png',
      views: Number(r.views_count || 0),
      replies: Number(r.replies_count || 0),
      excerpt: cleanExcerpt,
      updatedAt: r.last_reply_at || r.updated_at || r.created_at,
      timeDisplay: formatRelativeTime(r.last_reply_at || r.updated_at || r.created_at),
      link
    };
  }

  // 1. Latest Posts: strictly sorted by latest update / reply timestamp
  const latestRows = await query(`
    SELECT 
      t.id, t.title, t.category_id, t.category_title, t.novel_id, t.chapter_num,
      t.views_count, t.replies_count, t.created_at, t.updated_at, t.last_reply_at,
      COALESCE(lp.display_name, lu.username, ap.display_name, au.username, 'Member') AS last_author_name,
      COALESCE(lp.avatar, ap.avatar, '/profile.png') AS author_avatar,
      COALESCE(ap.display_name, au.username, 'Member') AS author_name,
      COALESCE((SELECT content FROM forum_posts WHERE topic_id = t.id ORDER BY id DESC LIMIT 1), '') AS excerpt
    FROM forum_topics t
    LEFT JOIN users au ON t.author_id = au.id
    LEFT JOIN profiles ap ON au.id = ap.user_id
    LEFT JOIN users lu ON t.last_reply_author_id = lu.id
    LEFT JOIN profiles lp ON lu.id = lp.user_id
    WHERE t.is_published = 1 AND t.visibility = 'public'
    ORDER BY COALESCE(t.last_reply_at, t.updated_at, t.created_at) DESC
    LIMIT 5;
  `);

  // 2. Trending Posts: engagement formula: (replies_count * 3) + views_count DESC
  const trendingRows = await query(`
    SELECT 
      t.id, t.title, t.category_id, t.category_title, t.novel_id, t.chapter_num,
      t.views_count, t.replies_count, t.created_at, t.updated_at, t.last_reply_at,
      ((t.replies_count * 3) + t.views_count) AS engagement_score,
      COALESCE(lp.display_name, lu.username, ap.display_name, au.username, 'Member') AS last_author_name,
      COALESCE(lp.avatar, ap.avatar, '/profile.png') AS author_avatar,
      COALESCE(ap.display_name, au.username, 'Member') AS author_name,
      COALESCE((SELECT content FROM forum_posts WHERE topic_id = t.id ORDER BY id DESC LIMIT 1), '') AS excerpt
    FROM forum_topics t
    LEFT JOIN users au ON t.author_id = au.id
    LEFT JOIN profiles ap ON au.id = ap.user_id
    LEFT JOIN users lu ON t.last_reply_author_id = lu.id
    LEFT JOIN profiles lp ON lu.id = lp.user_id
    WHERE t.is_published = 1 AND t.visibility = 'public'
    ORDER BY engagement_score DESC, COALESCE(t.last_reply_at, t.updated_at, t.created_at) DESC
    LIMIT 5;
  `);

  return {
    latest: (latestRows || []).map(mapPostRow),
    trending: (trendingRows || []).map(mapPostRow)
  };
}

export function resolveNovelIdFromTitle(title) {
  const s = String(title || '').toLowerCase();
  if (s.includes('nenjam')) return 'nenjam-marappadhillai';
  if (s.includes('kaadhal') || s.includes('காதல்')) return 'kaadhal-konden-kanave';
  if (s.includes('vizhigalil')) return 'vizhigalil-vizhundha-kavithai';
  if (s.includes('uyire')) return 'uyire-unakkaga';
  if (s.includes('maaya')) return 'maaya-nadhi-theeram';
  if (s.includes('rain') || s.includes('poongaatru')) return 'poongaatru-punnagaikka';
  return 'nenjam-marappadhillai';
}

/**
 * Fetch all forum topics with metadata
 */
export async function getForumTopicsFromDb(categoryId = null, options = {}) {
  const includeUnpublished = Boolean(options.includeUnpublished);
  let sql = `
    SELECT 
      t.id, t.title, t.content, t.image, t.is_pinned, t.sort_order, t.category_id, t.category_title,
      t.novel_id, t.chapter_num,
      t.views_count, t.replies_count, t.is_published, t.visibility, t.created_at, t.updated_at, t.last_reply_at,
      COALESCE(ap.display_name, au.username, 'Member') AS author_name,
      COALESCE(ap.avatar, '/profile.png') AS author_avatar,
      au.role AS author_role,
      COALESCE(lp.display_name, lu.username, ap.display_name, au.username, 'Member') AS last_author_name,
      COALESCE(lp.avatar, ap.avatar, '/profile.png') AS last_author_avatar,
      COALESCE(t.content, (SELECT content FROM forum_posts WHERE topic_id = t.id ORDER BY id ASC LIMIT 1), '') AS raw_content,
      (SELECT COUNT(*) FROM reactions r WHERE (r.target_type = 'forum_topic' AND r.target_id = t.id) OR (r.target_type = 'forum_post' AND r.target_id IN (SELECT fp.id FROM forum_posts fp WHERE fp.topic_id = t.id))) AS reactions_count
    FROM forum_topics t
    LEFT JOIN users au ON t.author_id = au.id
    LEFT JOIN profiles ap ON au.id = ap.user_id
    LEFT JOIN users lu ON t.last_reply_author_id = lu.id
    LEFT JOIN profiles lp ON lu.id = lp.user_id
    WHERE 1=1
  `;
  const params = [];

  if (!includeUnpublished) {
    sql += ` AND t.is_published = 1 AND t.visibility = 'public'`;
  }

  if (categoryId) {
    sql += ` AND t.category_id = ?`;
    params.push(categoryId);
  }

  sql += ` ORDER BY t.is_pinned DESC, t.sort_order ASC, COALESCE(t.last_reply_at, t.updated_at, t.created_at) DESC;`;

  const topics = await query(sql, params);

  return (topics || []).map(t => {
    const rawExcerpt = (t.raw_content || '').replace(/<[^>]+>/g, '').trim();
    const cleanExcerpt = rawExcerpt.length > 140 ? rawExcerpt.substring(0, 140) + '...' : rawExcerpt;
    const resolvedNovelId = t.novel_id || resolveNovelIdFromTitle(t.title);
    const chParam = t.chapter_num ? `&ch=${t.chapter_num}` : '';
    const novelLink = resolvedNovelId ? `#novel?id=${encodeURIComponent(resolvedNovelId)}${chParam}#comments` : `#topic?id=${t.id}`;
    return {
      id: t.id,
      categoryId: t.category_id,
      categoryTitle: t.category_title,
      novelId: resolvedNovelId,
      chapterNum: t.chapter_num || null,
      novelLink: novelLink,
      title: t.title,
      content: t.content || t.raw_content,
      image: t.image || null,
      isPinned: Boolean(t.is_pinned),
      sortOrder: Number(t.sort_order || 0),
      isPublished: Number(t.is_published),
      visibility: t.visibility,
      author: t.author_name,
      authorAvatar: t.author_avatar,
      authorRole: t.author_role,
      lastAuthor: t.last_author_name,
      lastAuthorAvatar: t.last_author_avatar,
      lastReplyAt: t.last_reply_at || t.updated_at || t.created_at,
      date: t.created_at,
      excerpt: cleanExcerpt,
      views: Number(t.views_count || 0),
      repliesCount: Number(t.replies_count || 0),
      reactionsCount: Number(t.reactions_count || 0)
    };
  });
}

/**
 * Fetch a single topic by ID from MySQL with real posts, reactions and nested parent relationships
 */
export async function getForumTopicByIdFromDb(topicId, currentUserId = null) {
  try {
    await query(`UPDATE forum_topics SET views_count = views_count + 1 WHERE id = ?`, [topicId]);
  } catch {}

  const topic = await queryOne(`
    SELECT 
      t.id, t.title, t.category_id, t.category_title, t.novel_id, t.chapter_num,
      t.views_count, t.replies_count, t.created_at, t.updated_at, t.last_reply_at,
      COALESCE(ap.display_name, au.username, 'Member') AS author_name,
      COALESCE(ap.avatar, '/profile.png') AS author_avatar
    FROM forum_topics t
    LEFT JOIN users au ON t.author_id = au.id
    LEFT JOIN profiles ap ON au.id = ap.user_id
    WHERE t.id = ?;
  `, [topicId]);

  if (!topic) return null;

  const posts = await query(`
    SELECT 
      p.id, p.parent_id, p.content, p.created_at,
      u.role, pr.title AS user_title,
      COALESCE(pr.display_name, u.username, 'Member') AS author,
      COALESCE(pr.avatar, '/profile.png') AS avatar
    FROM forum_posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN profiles pr ON u.id = pr.user_id
    WHERE p.topic_id = ?
    ORDER BY p.id ASC;
  `, [topicId]);

  // Load genuine reactions from MySQL for all posts in this topic
  const postIds = (posts || []).map(p => String(p.id));
  const reactionsMap = {};
  const userReactionsMap = {};

  if (postIds.length > 0) {
    const placeholders = postIds.map(() => '?').join(',');
    const reactionCounts = await query(`
      SELECT target_id, emoji, COUNT(*) AS count
      FROM reactions
      WHERE target_type = 'forum_post' AND target_id IN (${placeholders})
      GROUP BY target_id, emoji;
    `, postIds);

    for (const r of reactionCounts) {
      if (!reactionsMap[r.target_id]) reactionsMap[r.target_id] = {};
      reactionsMap[r.target_id][r.emoji] = Number(r.count || 0);
    }

    if (currentUserId) {
      const userReacts = await query(`
        SELECT target_id, emoji
        FROM reactions
        WHERE target_type = 'forum_post' AND target_id IN (${placeholders}) AND user_id = ?;
      `, [...postIds, currentUserId]);

      for (const ur of userReacts) {
        userReactionsMap[ur.target_id] = ur.emoji;
      }
    }
  }

  // Load genuine reactions for the topic itself
  const topicReactionsRows = await query(`
    SELECT emoji, COUNT(*) AS count
    FROM reactions
    WHERE target_type = 'forum_topic' AND target_id = ?
    GROUP BY emoji;
  `, [topicId]);
  const topicReactions = {};
  for (const r of topicReactionsRows) {
    topicReactions[r.emoji] = Number(r.count || 0);
  }
  let userTopicReaction = null;
  if (currentUserId) {
    const utr = await queryOne(`
      SELECT emoji FROM reactions
      WHERE target_type = 'forum_topic' AND target_id = ? AND user_id = ? LIMIT 1;
    `, [topicId, currentUserId]);
    if (utr) userTopicReaction = utr.emoji;
  }

  return {
    id: topic.id,
    categoryId: topic.category_id,
    categoryTitle: topic.category_title,
    novelId: topic.novel_id || resolveNovelIdFromTitle(topic.title),
    chapterNum: topic.chapter_num || null,
    title: topic.title,
    author: topic.author_name,
    authorAvatar: topic.author_avatar,
    date: topic.created_at,
    views: Number(topic.views_count || 0),
    repliesCount: Number(topic.replies_count || 0),
    reactions: topicReactions,
    userReacted: userTopicReaction,
    posts: (posts || []).map(p => {
      const pReactions = reactionsMap[String(p.id)] || {};
      const totalR = Object.values(pReactions).reduce((a, b) => a + b, 0);
      return {
        id: p.id,
        parentId: p.parent_id || null,
        author: p.author,
        avatar: p.avatar,
        role: p.role || 'Member',
        userTitle: p.user_title || p.role || 'Member',
        date: p.created_at,
        content: p.content,
        reactions: pReactions,
        totalReactions: totalR,
        userReacted: userReactionsMap[String(p.id)] || null
      };
    })
  };
}

/**
 * Add a reply to a forum topic with optional parent_id for nested threads
 */
export async function addForumReplyToDb(topicId, userId, content, parentId = null) {
  const cleanContent = (content || '').trim();
  if (!cleanContent) return { success: false, error: 'Content cannot be empty' };

  const topic = await queryOne('SELECT id FROM forum_topics WHERE id = ?;', [topicId]);
  if (!topic) return { success: false, error: 'Topic not found' };

  const parsedParentId = parentId ? parseInt(parentId, 10) : null;

  const res = await query(`
    INSERT INTO forum_posts (topic_id, user_id, content, parent_id)
    VALUES (?, ?, ?, ?);
  `, [topicId, userId, cleanContent, parsedParentId || null]);

  const postId = res.insertId;

  await query(`
    UPDATE forum_topics 
    SET replies_count = replies_count + 1,
        last_reply_author_id = ?,
        last_reply_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?;
  `, [userId, topicId]);

  // Update user's profile post count
  await query(`
    UPDATE profiles 
    SET posts_count = posts_count + 1 
    WHERE user_id = ?;
  `, [userId]);

  const authorProfile = await queryOne(`
    SELECT u.role, p.title AS user_title, COALESCE(p.display_name, u.username, 'Member') AS name, COALESCE(p.avatar, '/profile.png') AS avatar
    FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?;
  `, [userId]);

  // Genuine Notification Triggers for Forum Replies & Mentions
  try {
    const cleanSnippet = cleanContent.replace(/<[^>]+>/g, '').trim().slice(0, 80);
    const topicRow = await queryOne('SELECT id, title, author_id FROM forum_topics WHERE id = ?;', [topicId]);

    let parentAuthorId = null;
    if (parsedParentId) {
      // 1. Reply to a specific post: Notify that post's author
      const parentPost = await queryOne('SELECT user_id FROM forum_posts WHERE id = ?;', [parsedParentId]);
      if (parentPost && parentPost.user_id && Number(parentPost.user_id) !== Number(userId)) {
        parentAuthorId = Number(parentPost.user_id);
        await createNotification({
          userId: parentPost.user_id,
          actorId: userId,
          type: 'forum_reply',
          title: `Reply to your Post in "${topicRow?.title || 'Forum'}"`,
          message: `${authorProfile?.name || 'A member'} replied: "${cleanSnippet}"`,
          link: `#forum?topic=${topicId}`,
          entityType: 'forum_topic',
          entityId: topicId
        });
      }
    }

    // 2. Notify Topic Author if they are not the poster and not already notified as parent post author
    if (topicRow && topicRow.author_id && Number(topicRow.author_id) !== Number(userId) && Number(topicRow.author_id) !== parentAuthorId) {
      await createNotification({
        userId: topicRow.author_id,
        actorId: userId,
        type: 'forum_reply',
        title: `New Reply in "${topicRow.title}"`,
        message: `${authorProfile?.name || 'A member'} replied to your forum topic: "${cleanSnippet}"`,
        link: `#forum?topic=${topicId}`,
        entityType: 'forum_topic',
        entityId: topicId
      });
    }

    // 3. Mentions: @username
    const mentions = cleanContent.match(/@([a-zA-Z0-9_]{3,30})/g);
    if (mentions) {
      const uniqueUsernames = [...new Set(mentions.map(m => m.slice(1).toLowerCase()))];
      for (const uname of uniqueUsernames) {
        const targetUser = await queryOne('SELECT id, username FROM users WHERE LOWER(username) = ?;', [uname]);
        if (targetUser && Number(targetUser.id) !== Number(userId) && Number(targetUser.id) !== Number(topicRow?.author_id) && Number(targetUser.id) !== parentAuthorId) {
          await createNotification({
            userId: targetUser.id,
            actorId: userId,
            type: 'forum_mention',
            title: `Mentioned in "${topicRow?.title || 'Forum'}"`,
            message: `${authorProfile?.name || 'A member'} mentioned you in forum topic "${topicRow?.title || 'Forum'}".`,
            link: `#forum?topic=${topicId}`,
            entityType: 'forum_topic',
            entityId: topicId
          });
        }
      }
    }
  } catch (err) {
    console.warn('[Forum Notification Error]:', err.message);
  }

  return {
    success: true,
    post: {
      id: postId,
      parentId: parsedParentId || null,
      author: authorProfile?.name || 'Member',
      avatar: authorProfile?.avatar || '/profile.png',
      role: authorProfile?.role || 'Member',
      userTitle: authorProfile?.user_title || authorProfile?.role || 'Member',
      date: 'Just now',
      content: cleanContent,
      reactions: {},
      totalReactions: 0,
      userReacted: null
    }
  };
}

/**
 * Create a new forum topic (Supports admin pinning, order, publication status, image)
 */
export async function createForumTopicInDb({ categoryId, title, authorId, content, image = null, isPublished = 1, isPinned = 0, sortOrder = 0 }) {
  const cleanTitle = (title || '').trim();
  const cleanContent = (content || '').trim();
  if (!cleanTitle) return { success: false, error: 'Title is required' };
  if (!cleanContent) return { success: false, error: 'Content is required' };

  const category = await queryOne('SELECT id, title FROM forum_categories WHERE id = ?;', [categoryId || 'general']);
  const catId = category ? category.id : 'general';
  const catTitle = category ? category.title : 'General';

  const slug = cleanTitle.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  const topicId = `topic-${slug || 'discussion'}-${Date.now().toString().slice(-4)}`;

  const pubStatus = (isPublished === 0 || isPublished === false || isPublished === '0') ? 0 : 1;
  const pinStatus = (isPinned === 1 || isPinned === true || isPinned === '1') ? 1 : 0;
  const orderNum = Number(sortOrder) || 0;

  await query(`
    INSERT INTO forum_topics (id, category_id, category_title, title, content, image, author_id, views_count, replies_count, is_published, is_pinned, sort_order, visibility, last_reply_author_id, last_reply_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, 'public', ?, CURRENT_TIMESTAMP);
  `, [topicId, catId, catTitle, cleanTitle, cleanContent, image || null, authorId, pubStatus, pinStatus, orderNum, authorId]);

  await query(`
    INSERT INTO forum_posts (topic_id, user_id, content)
    VALUES (?, ?, ?);
  `, [topicId, authorId, cleanContent]);

  // Update user's profile topic & post counts
  await query(`
    UPDATE profiles 
    SET topics_count = topics_count + 1, posts_count = posts_count + 1 
    WHERE user_id = ?;
  `, [authorId]);

  return { success: true, topicId };
}

/**
 * Fetch all forum categories with accurate real MySQL topic & post counts, active status, color, and latest activity
 */
export async function getForumCategoriesFromDb(includeInactive = false) {
  let sql = `
    SELECT 
      c.id, c.title, c.description, c.icon, c.sort_order, c.is_active, c.color,
      (SELECT COUNT(*) FROM forum_topics t WHERE t.category_id = c.id AND t.is_published = 1 AND t.visibility = 'public') AS topics_count,
      (SELECT COUNT(*) FROM forum_posts p JOIN forum_topics t ON p.topic_id = t.id WHERE t.category_id = c.id AND t.is_published = 1 AND t.visibility = 'public') AS posts_count,
      (SELECT COALESCE(SUM(t.replies_count), 0) FROM forum_topics t WHERE t.category_id = c.id AND t.is_published = 1 AND t.visibility = 'public') AS replies_count,
      latest_t.id AS latest_topic_id,
      latest_t.title AS latest_topic_title,
      COALESCE(latest_t.last_reply_at, latest_t.updated_at, latest_t.created_at) AS last_activity_at,
      COALESCE(lp.display_name, lu.username, ap.display_name, au.username, 'Member') AS last_activity_author,
      COALESCE(lp.avatar, ap.avatar, '/profile.png') AS last_activity_avatar
    FROM forum_categories c
    LEFT JOIN forum_topics latest_t ON latest_t.id = (
      SELECT t2.id FROM forum_topics t2 
      WHERE t2.category_id = c.id AND t2.is_published = 1 AND t2.visibility = 'public'
      ORDER BY COALESCE(t2.last_reply_at, t2.updated_at, t2.created_at) DESC LIMIT 1
    )
    LEFT JOIN users lu ON latest_t.last_reply_author_id = lu.id
    LEFT JOIN profiles lp ON lu.id = lp.user_id
    LEFT JOIN users au ON latest_t.author_id = au.id
    LEFT JOIN profiles ap ON au.id = ap.user_id
  `;

  if (!includeInactive) {
    sql += ` WHERE c.is_active = 1 `;
  }

  sql += ` ORDER BY c.sort_order ASC;`;

  const categories = await query(sql);

  return (categories || []).map(c => ({
    id: c.id,
    title: c.title,
    desc: c.description,
    icon: c.icon || '💬',
    sortOrder: Number(c.sort_order || 0),
    isActive: Boolean(c.is_active === 1 || c.is_active === true),
    color: c.color || '#2E1065',
    topicsCount: Number(c.topics_count || 0),
    postsCount: Number(c.posts_count || 0),
    repliesCount: Number(c.replies_count || 0),
    latestTopicId: c.latest_topic_id || null,
    latestTopicTitle: c.latest_topic_title || null,
    lastActivityAt: c.last_activity_at || null,
    lastActivityAuthor: c.latest_topic_id ? c.last_activity_author : null,
    lastActivityAvatar: c.latest_topic_id ? c.last_activity_avatar : null
  }));
}

/**
 * Admin: Create a new forum category
 */
export async function createForumCategoryInDb({ id, title, description, icon, sort_order, color, is_active }) {
  const cleanTitle = (title || '').trim();
  if (!cleanTitle) return { success: false, error: 'Category title is required' };

  let catId = (id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!catId) {
    catId = cleanTitle.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }
  if (!catId) catId = 'category-' + Date.now();

  const existing = await queryOne('SELECT id FROM forum_categories WHERE id = ?', [catId]);
  if (existing) {
    catId = `${catId}-${Date.now().toString().slice(-4)}`;
  }

  const order = Number(sort_order) || 10;
  const active = (is_active === false || is_active === 0 || is_active === '0') ? 0 : 1;
  const catColor = (color || '#2E1065').trim();
  const catIcon = (icon || '💬').trim();

  await query(`
    INSERT INTO forum_categories (id, title, description, icon, sort_order, is_active, color)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `, [catId, cleanTitle, (description || '').trim(), catIcon, order, active, catColor]);

  return { success: true, categoryId: catId };
}

/**
 * Admin: Update an existing forum category
 */
export async function updateForumCategoryInDb(catId, { title, description, icon, sort_order, color, is_active }) {
  const category = await queryOne('SELECT id FROM forum_categories WHERE id = ?', [catId]);
  if (!category) return { success: false, error: 'Category not found' };

  const updates = [];
  const params = [];

  if (title !== undefined) {
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) return { success: false, error: 'Title cannot be empty' };
    updates.push('title = ?');
    params.push(cleanTitle);

    // Synchronize category_title in forum_topics
    await query('UPDATE forum_topics SET category_title = ? WHERE category_id = ?', [cleanTitle, catId]);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push((description || '').trim());
  }
  if (icon !== undefined) {
    updates.push('icon = ?');
    params.push((icon || '').trim());
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(Number(sort_order) || 0);
  }
  if (color !== undefined) {
    updates.push('color = ?');
    params.push((color || '').trim());
  }
  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push((is_active === true || is_active === 1 || is_active === '1') ? 1 : 0);
  }

  if (updates.length > 0) {
    params.push(catId);
    await query(`UPDATE forum_categories SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  return { success: true };
}

/**
 * Admin: Delete or disable forum category
 */
export async function deleteForumCategoryInDb(catId) {
  const category = await queryOne('SELECT id FROM forum_categories WHERE id = ?', [catId]);
  if (!category) return { success: false, error: 'Category not found' };

  const topicCount = await queryOne('SELECT COUNT(*) AS count FROM forum_topics WHERE category_id = ?', [catId]);
  if (topicCount && Number(topicCount.count) > 0) {
    await query('UPDATE forum_categories SET is_active = 0 WHERE id = ?', [catId]);
    return { success: true, message: 'Category has existing discussions and was disabled rather than deleted to protect reader content.' };
  }

  await query('DELETE FROM forum_categories WHERE id = ?', [catId]);
  return { success: true };
}

/**
 * Admin: Update forum topic metadata (title, content, category, pin, published, sort_order, image)
 */
export async function updateForumTopicInDb(topicId, { title, categoryId, content, image, is_published, is_pinned, sort_order }) {
  const topic = await queryOne('SELECT id, category_id FROM forum_topics WHERE id = ?', [topicId]);
  if (!topic) return { success: false, error: 'Topic not found' };

  const updates = [];
  const params = [];

  if (title !== undefined) {
    const cleanTitle = (title || '').trim();
    if (!cleanTitle) return { success: false, error: 'Title cannot be empty' };
    updates.push('title = ?');
    params.push(cleanTitle);
  }
  if (categoryId !== undefined) {
    const cat = await queryOne('SELECT id, title FROM forum_categories WHERE id = ?', [categoryId]);
    if (cat) {
      updates.push('category_id = ?');
      params.push(cat.id);
      updates.push('category_title = ?');
      params.push(cat.title);
    }
  }
  if (content !== undefined) {
    const cleanContent = (content || '').trim();
    updates.push('content = ?');
    params.push(cleanContent);

    // Also update first post in forum_posts
    const firstPost = await queryOne('SELECT id FROM forum_posts WHERE topic_id = ? ORDER BY id ASC LIMIT 1', [topicId]);
    if (firstPost) {
      await query('UPDATE forum_posts SET content = ? WHERE id = ?', [cleanContent, firstPost.id]);
    }
  }
  if (image !== undefined) {
    updates.push('image = ?');
    params.push(image ? image.trim() : null);
  }
  if (is_published !== undefined) {
    updates.push('is_published = ?');
    params.push((is_published === true || is_published === 1 || is_published === '1') ? 1 : 0);
  }
  if (is_pinned !== undefined) {
    updates.push('is_pinned = ?');
    params.push((is_pinned === true || is_pinned === 1 || is_pinned === '1') ? 1 : 0);
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?');
    params.push(Number(sort_order) || 0);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(topicId);
    await query(`UPDATE forum_topics SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  return { success: true };
}

/**
 * Admin: Delete or unpublish forum topic
 */
export async function deleteForumTopicInDb(topicId, permanent = false) {
  const topic = await queryOne('SELECT id FROM forum_topics WHERE id = ?', [topicId]);
  if (!topic) return { success: false, error: 'Topic not found' };

  if (permanent) {
    await query('DELETE FROM forum_posts WHERE topic_id = ?', [topicId]);
    await query('DELETE FROM reactions WHERE target_type = "forum_topic" AND target_id = ?', [topicId]);
    await query('DELETE FROM forum_topics WHERE id = ?', [topicId]);
    return { success: true, message: 'Topic deleted.' };
  } else {
    await query('UPDATE forum_topics SET is_published = 0 WHERE id = ?', [topicId]);
    return { success: true, message: 'Topic unpublished.' };
  }
}

/**
 * Reading Progress Handlers
 */
export async function getReadingProgressFromDb(userId, novelId = null) {
  if (novelId) {
    const row = await queryOne(`
      SELECT p.*, n.title AS novel_title, n.chapters_count, c.title AS chapter_title
      FROM reading_progress p
      JOIN novels n ON p.novel_id = n.id
      LEFT JOIN chapters c ON p.novel_id = c.novel_id AND p.chapter_num = c.chapter_num
      WHERE p.user_id = ? AND p.novel_id = ?;
    `, [userId, novelId]);
    return row;
  }

  const rows = await query(`
    SELECT p.*, n.title AS novel_title, n.cover AS novel_cover, n.chapters_count, c.title AS chapter_title
    FROM reading_progress p
    JOIN novels n ON p.novel_id = n.id
    LEFT JOIN chapters c ON p.novel_id = c.novel_id AND p.chapter_num = c.chapter_num
    WHERE p.user_id = ?
    ORDER BY p.last_read_at DESC;
  `, [userId]);
  return rows;
}

export async function saveReadingProgressToDb(userId, novelId, chapterNum, percentage = 100) {
  await query(`
    INSERT INTO reading_progress (user_id, novel_id, chapter_num, progress_percentage, last_read_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      chapter_num = VALUES(chapter_num),
      progress_percentage = VALUES(progress_percentage),
      last_read_at = CURRENT_TIMESTAMP;
  `, [userId, novelId, chapterNum, percentage]);
  return { success: true };
}

/**
 * Notifications Handlers
 */
export async function getNotificationsFromDb(userId) {
  return await getUserNotifications(userId);
}

export async function markNotificationReadInDb(notificationId, userId) {
  return await notifMarkRead(notificationId, userId);
}

export async function markAllNotificationsReadInDb(userId) {
  return await notifMarkAllRead(userId);
}

/**
 * Likes Handlers
 */
export async function getLikesFromDb({ targetType, targetId, userId = null }) {
  const countRow = await queryOne(`
    SELECT COUNT(*) AS count FROM likes 
    WHERE target_type = ? AND target_id = ?;
  `, [targetType, targetId]);

  let userLiked = false;
  if (userId) {
    const userRow = await queryOne(`
      SELECT id FROM likes 
      WHERE target_type = ? AND target_id = ? AND user_id = ?;
    `, [targetType, targetId, userId]);
    userLiked = Boolean(userRow);
  }

  return {
    success: true,
    likesCount: Number(countRow?.count || 0),
    userLiked
  };
}

export async function toggleLikeInDb({ targetType, targetId, userId }) {
  const existing = await queryOne(`
    SELECT id FROM likes 
    WHERE target_type = ? AND target_id = ? AND user_id = ?;
  `, [targetType, targetId, userId]);

  if (existing) {
    await query(`DELETE FROM likes WHERE id = ?;`, [existing.id]);
    const info = await getLikesFromDb({ targetType, targetId, userId });
    return { success: true, liked: false, ...info };
  } else {
    await query(`
      INSERT INTO likes (target_type, target_id, user_id) 
      VALUES (?, ?, ?);
    `, [targetType, targetId, userId]);

    // Like Notification for comments
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
            type: 'comment_like',
            title: 'Liked your Comment',
            message: `${actorProfile?.name || 'A reader'} liked your comment on ${commentRow.novel_title || 'Novel'}.`,
            link: commentRow.chapter_num && commentRow.chapter_num !== '0' ? `#reader?novel=${commentRow.novel_id}&ch=${commentRow.chapter_num}` : `#novel-detail?id=${commentRow.novel_id}`,
            entityType: 'comment',
            entityId: targetId
          });
        }
      } catch (err) {
        console.warn('[Like Notification Error]:', err.message);
      }
    }

    const info = await getLikesFromDb({ targetType, targetId, userId });
    return { success: true, liked: true, ...info };
  }
}

/**
 * Record a unique guest visitor in MySQL
 * Privacy-preserving: Hashes user-agent, does not store IP addresses
 * Idempotent: Repeat visits by same visitor update last_visit_at without duplicating
 */
export async function recordGuestVisitor({ visitorId, userAgent = '' }) {
  if (!visitorId || typeof visitorId !== 'string') return null;
  const cleanId = visitorId.trim();
  if (!/^[a-zA-Z0-9_-]{10,64}$/.test(cleanId)) return null;

  const uaHash = userAgent ? crypto.createHash('sha256').update(userAgent).digest('hex').substring(0, 32) : null;

  try {
    await query(`
      INSERT INTO guest_visitors (visitor_id, user_agent_hash, first_visit_at, last_visit_at)
      VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON DUPLICATE KEY UPDATE 
        last_visit_at = CURRENT_TIMESTAMP;
    `, [cleanId, uaHash]);
  } catch (err) {
    console.error('[DB] recordGuestVisitor error:', err.message);
  }

  return cleanId;
}

/**
 * Get Forum Live Statistics (Total Valid Members, Total Replies, Total Unique Guests)
 * Strictly queries real MySQL records with parameterized queries
 */
export async function getForumLiveStatsFromDb() {
  try {
    const [membersRow, repliesRow, guestsRow] = await Promise.all([
      queryOne("SELECT COUNT(*) AS total_members FROM users WHERE status = 'active';"),
      queryOne("SELECT COALESCE(SUM(replies_count), 0) AS total_replies FROM forum_topics WHERE is_published = 1 AND visibility = 'public';"),
      queryOne("SELECT COUNT(*) AS total_guests FROM guest_visitors;")
    ]);

    return {
      totalMembers: Number(membersRow?.total_members || 0),
      totalReplies: Number(repliesRow?.total_replies || 0),
      totalGuests: Number(guestsRow?.total_guests || 0)
    };
  } catch (err) {
    console.error('[DB] getForumLiveStatsFromDb error:', err.message);
    return {
      totalMembers: 0,
      totalReplies: 0,
      totalGuests: 0
    };
  }
}

