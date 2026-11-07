import { saveUploadedImageFile, deleteLocalUploadFile } from './image-upload.js';
// Admin Dashboard & Author Overview Module for Rudhra Prarthana Novels
// Comprehensive Analytics, Media Management, and Author Settings

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, queryOne, getDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Retrieve Complete Admin Overview & Metric Counts from SQL
 */
export async function getAdminOverview() {
  // 1. Form Management Metrics
  const formStats = await queryOne(`
    SELECT
      (SELECT COUNT(*) FROM forum_categories) AS total_categories,
      (SELECT COUNT(*) FROM content_subcategories) AS total_subcategories,
      (SELECT COUNT(*) FROM content_articles) AS total_articles,
      (SELECT COUNT(*) FROM content_articles WHERE status = 'published') AS published_articles,
      (SELECT COUNT(*) FROM content_articles WHERE status = 'scheduled') AS scheduled_articles,
      (SELECT COUNT(*) FROM content_articles WHERE status = 'draft') AS draft_articles
  `);

  // 2. Readers, Writers & Engagement Metrics
  const engagementStats = await queryOne(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE role = 'writer') AS total_writers,
      (SELECT COUNT(*) FROM content_comments) AS total_comments,
      (SELECT COUNT(*) FROM forum_topics) AS total_topics,
      (SELECT COUNT(*) FROM media) AS total_media,
      (SELECT COUNT(*) FROM trash_items) AS total_trash
  `);

  // 3. Upcoming Scheduled Articles
  const upcomingScheduled = await query(`
    SELECT a.id, a.title, a.scheduled_at, 'Asia/Kolkata' AS timezone,
           c.title AS category_title
    FROM content_articles a
    LEFT JOIN forum_categories c ON a.main_category_id = c.id
    WHERE a.status = 'scheduled'
    ORDER BY a.scheduled_at ASC
    LIMIT 6;
  `);

  // 4. Recent Articles
  const recentArticles = await query(`
    SELECT a.id, a.unique_slug, a.title, a.status, a.is_published, a.visibility, a.updated_at, a.views_count,
           c.title AS category_title
    FROM content_articles a
    LEFT JOIN forum_categories c ON a.main_category_id = c.id
    ORDER BY a.updated_at DESC
    LIMIT 6;
  `);

  const statsObj = {
    forms: {
      categories: Number(formStats?.total_categories || 0),
      subcategories: Number(formStats?.total_subcategories || 0),
      articles: Number(formStats?.total_articles || 0),
      published: Number(formStats?.published_articles || 0),
      scheduled: Number(formStats?.scheduled_articles || 0),
      drafts: Number(formStats?.draft_articles || 0)
    },
    community: {
      users: Number(engagementStats?.total_users || 0),
      writers: Number(engagementStats?.total_writers || 0),
      comments: Number(engagementStats?.total_comments || 0),
      topics: Number(engagementStats?.total_topics || 0),
      media: Number(engagementStats?.total_media || 0),
      trash: Number(engagementStats?.total_trash || 0)
    }
  };

  return {
    success: true,
    stats: statsObj,
    counts: {
      categories: statsObj.forms.categories,
      subcategories: statsObj.forms.subcategories,
      articles: statsObj.forms.articles,
      users: statsObj.community.users,
      writers: statsObj.community.writers,
      comments: statsObj.community.comments,
      topics: statsObj.community.topics,
      media: statsObj.community.media,
      trash: statsObj.community.trash,
      ...statsObj
    },
    upcomingScheduled: (upcomingScheduled || []).map(r => ({
      id: r.id,
      title: r.title,
      categoryTitle: r.category_title || 'General',
      scheduledAt: r.scheduled_at,
      timezone: r.timezone || 'Asia/Kolkata'
    })),
    recentArticles: (recentArticles || []).map(r => ({
      id: r.id,
      slug: r.unique_slug,
      title: r.title,
      categoryTitle: r.category_title || 'General',
      status: r.status,
      isPublished: Boolean(r.is_published),
      visibility: r.visibility,
      viewsCount: r.views_count || 0,
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
    media: (rows || []).map(r => ({
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
export async function uploadMediaAsset({ data: base64Data, filename = 'image.jpg', userId = null, replaceUrl = null }) {
  const result = await saveUploadedImageFile({
    base64Data,
    folder: 'media',
    prefix: 'media',
    filename,
    oldImageUrl: replaceUrl,
    userId
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    media: {
      id: result.mediaId,
      filename: result.filename,
      originalName: result.originalName,
      url: result.url,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
      formattedSize: result.formattedSize
    }
  };
}

/**
 * Delete Media Asset
 */
export async function deleteMediaAsset(id) {
  const media = await queryOne('SELECT * FROM media WHERE id = ?;', [id]);
  if (!media) {
    return { success: false, error: 'Media record not found.' };
  }

  if (media.url) deleteLocalUploadFile(media.url);
  if (media.filename) deleteLocalUploadFile(`/uploads/media/${media.filename}`);

  await query('DELETE FROM media WHERE id = ?;', [id]);
  return { success: true, id };
}

/**
 * Get Site Settings
 */
export async function getSiteSettings() {
  const rows = await query('SELECT * FROM site_settings;');
  const settings = {};
  for (const r of rows || []) {
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
