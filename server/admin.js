// Admin Dashboard & Author Overview Module for Rudhra Prarthana Novels
// Comprehensive Analytics, Media Management, and Author Settings

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, queryOne, getDb } from './db.js';
import { checkAndPublishDueEpisodes } from './episodes.js';
import { formatNovel } from './novels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Retrieve Complete Admin Overview & Metric Counts from SQL
 */
export async function getAdminOverview() {
  await checkAndPublishDueEpisodes();

  // 1. Novels Metrics
  const novelStats = await queryOne(`
    SELECT
      COUNT(*) AS total_novels,
      SUM(CASE WHEN is_published = 1 AND visibility = 'public' THEN 1 ELSE 0 END) AS published_novels,
      SUM(CASE WHEN LOWER(status) = 'ongoing' THEN 1 ELSE 0 END) AS ongoing_novels,
      SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END) AS completed_novels,
      SUM(CASE WHEN is_published = 0 OR visibility != 'public' THEN 1 ELSE 0 END) AS draft_novels
    FROM novels;
  `);

  // 2. Episodes Metrics
  const episodeStats = await queryOne(`
    SELECT
      COUNT(*) AS total_episodes,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_episodes,
      SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) AS scheduled_episodes,
      SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_episodes,
      SUM(CASE WHEN parent_id IS NOT NULL THEN 1 ELSE 0 END) AS sub_episodes
    FROM chapters;
  `);

  // 3. Readers & Engagement Metrics
  const engagementStats = await queryOne(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM comments) AS total_comments,
      (SELECT COUNT(*) FROM likes WHERE target_type = 'novel') AS total_novel_likes,
      (SELECT COUNT(*) FROM media) AS total_media
  `);

  // 4. Upcoming Scheduled Episodes
  const upcomingScheduled = await query(`
    SELECT c.id, c.novel_id, c.chapter_num, c.episode_number, c.title, c.scheduled_at, c.timezone,
           n.title AS novel_title, n.cover AS novel_cover
    FROM chapters c
    JOIN novels n ON c.novel_id = n.id
    WHERE c.status = 'scheduled'
    ORDER BY c.scheduled_at ASC
    LIMIT 6;
  `);

  // 5. Recent Activity / Latest Episodes
  const recentEpisodes = await query(`
    SELECT c.id, c.novel_id, c.chapter_num, c.episode_number, c.title, c.status, c.created_at, c.updated_at,
           n.title AS novel_title
    FROM chapters c
    JOIN novels n ON c.novel_id = n.id
    ORDER BY c.updated_at DESC
    LIMIT 6;
  `);

  // 6. Recent Novels
  const recentNovels = await query(`
    SELECT id, title, author, status, badge, cover, chapters_count, is_published, visibility, updated_at
    FROM novels
    ORDER BY updated_at DESC
    LIMIT 6;
  `);

  const statsObj = {
    novels: {
      total: Number(novelStats?.total_novels || 0),
      published: Number(novelStats?.published_novels || 0),
      ongoing: Number(novelStats?.ongoing_novels || 0),
      completed: Number(novelStats?.completed_novels || 0),
      drafts: Number(novelStats?.draft_novels || 0)
    },
    episodes: {
      total: Number(episodeStats?.total_episodes || 0),
      published: Number(episodeStats?.published_episodes || 0),
      scheduled: Number(episodeStats?.scheduled_episodes || 0),
      drafts: Number(episodeStats?.draft_episodes || 0),
      subEpisodes: Number(episodeStats?.sub_episodes || 0)
    },
    community: {
      users: Number(engagementStats?.total_users || 0),
      comments: Number(engagementStats?.total_comments || 0),
      likes: Number(engagementStats?.total_novel_likes || 0),
      media: Number(engagementStats?.total_media || 0)
    }
  };

  return {
    success: true,
    stats: statsObj,
    counts: {
      novels: statsObj.novels.total,
      episodes: statsObj.episodes.total,
      users: statsObj.community.users,
      comments: statsObj.community.comments,
      media: statsObj.community.media,
      ...statsObj
    },
    upcomingScheduled: upcomingScheduled.map(r => ({
      id: r.id,
      novelId: r.novel_id,
      novelTitle: r.novel_title,
      novelCover: r.novel_cover,
      episodeNumber: r.episode_number || r.chapter_num,
      title: r.title,
      scheduledAt: r.scheduled_at,
      timezone: r.timezone || 'Asia/Kolkata'
    })),
    recentEpisodes: recentEpisodes.map(r => ({
      id: r.id,
      novelId: r.novel_id,
      novelTitle: r.novel_title,
      episodeNumber: r.episode_number || r.chapter_num,
      title: r.title,
      status: r.status,
      updatedAt: r.updated_at
    })),
    recentNovels: recentNovels.map(r => ({
      id: r.id,
      title: r.title,
      author: r.author,
      status: r.status,
      badge: r.badge,
      cover: r.cover,
      chaptersCount: Number(r.chapters_count || 0),
      isPublished: Boolean(r.is_published),
      visibility: r.visibility,
      updatedAt: r.updated_at
    }))
  };
}

/**
 * Media Gallery: List all media items
 */
export async function getMediaList({ search = '', limit = 50, offset = 0 } = {}) {
  let sql = 'SELECT * FROM media WHERE 1=1';
  const params = [];

  if (search) {
    sql += ' AND (original_name LIKE ? OR filename LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?;';
  params.push(Number(limit), Number(offset));

  const rows = await query(sql, params);
  const totalRow = await queryOne('SELECT COUNT(*) AS total FROM media;');

  return {
    success: true,
    total: Number(totalRow?.total || 0),
    media: rows.map(r => ({
      id: r.id,
      filename: r.filename,
      originalName: r.original_name,
      url: r.url,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      formattedSize: formatBytes(r.size_bytes),
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at
    }))
  };
}

/**
 * Helper: Format bytes to human readable size
 */
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Media Management: Upload new image/asset (Supports up to 10MB)
 */
export async function uploadMediaAsset({ data: base64Data, filename = 'image.jpg', userId = null }) {
  if (!base64Data || typeof base64Data !== 'string') {
    return { success: false, error: 'No media file data provided.' };
  }

  const matches = base64Data.match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,(.+)$/i);
  if (!matches) {
    return { success: false, error: 'Only JPEG, PNG, WebP, and GIF image files are allowed.' };
  }

  const mimeType = matches[1].toLowerCase();
  const rawBase64 = matches[3];
  const buffer = Buffer.from(rawBase64, 'base64');

  if (buffer.length > 10 * 1024 * 1024) {
    return { success: false, error: 'File size must be under 10MB.' };
  }

  let ext = 'jpg';
  if (mimeType.includes('png')) ext = 'png';
  else if (mimeType.includes('webp')) ext = 'webp';
  else if (mimeType.includes('gif')) ext = 'gif';

  const cleanOriginal = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeFilename = `media-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const uploadDir = path.resolve(__dirname, 'uploads/media');

  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, safeFilename);
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/uploads/media/${safeFilename}`;

    const res = await query(`
      INSERT INTO media (filename, original_name, url, mime_type, size_bytes, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?);
    `, [safeFilename, cleanOriginal, relativeUrl, mimeType, buffer.length, userId]);

    return {
      success: true,
      media: {
        id: res.insertId,
        filename: safeFilename,
        originalName: cleanOriginal,
        url: relativeUrl,
        mimeType,
        sizeBytes: buffer.length,
        formattedSize: formatBytes(buffer.length)
      }
    };
  } catch (err) {
    console.error('[Media Upload Error]', err);
    return { success: false, error: 'Failed to write media asset to disk.' };
  }
}

/**
 * Delete Media Asset
 */
export async function deleteMediaAsset(id) {
  const media = await queryOne('SELECT * FROM media WHERE id = ?;', [id]);
  if (!media) {
    return { success: false, error: 'Media record not found.' };
  }

  try {
    const uploadDir = path.resolve(__dirname, 'uploads/media');
    const filePath = path.join(uploadDir, media.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn('[Media Delete Warning] File could not be deleted from disk:', err.message);
  }

  await query('DELETE FROM media WHERE id = ?;', [id]);
  return { success: true, id };
}

/**
 * Get Site Settings
 */
export async function getSiteSettings() {
  const rows = await query('SELECT * FROM site_settings;');
  const settings = {};
  for (const r of rows) {
    settings[r.setting_key] = r.setting_value;
  }
  return { success: true, settings };
}

/**
 * Update Site Settings
 */
export async function updateSiteSettings(settingsObj) {
  if (!settingsObj || typeof settingsObj !== 'object') {
    return { success: false, error: 'Settings object required.' };
  }

  for (const [key, val] of Object.entries(settingsObj)) {
    const cleanKey = String(key).trim();
    const cleanVal = String(val).trim();
    if (cleanKey) {
      await query(`
        INSERT INTO site_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
      `, [cleanKey, cleanVal]);
    }
  }

  return await getSiteSettings();
}
