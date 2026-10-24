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

/**
 * ========================================================
 * HOMEPAGE SECTIONS & PRIORITY MANAGEMENT SYSTEM
 * Admin-Controlled ordering, visibility, and custom sections
 * ========================================================
 */

/**
 * Retrieve all configured homepage sections with metadata and live item counts
 */
export async function getAdminHomepageSections() {
  const sections = await query(`
    SELECT * FROM homepage_sections 
    ORDER BY sort_order ASC, section_key ASC;
  `);

  const enriched = [];
  for (const s of sections) {
    let itemCount = 0;
    let curatedNovels = [];

    if (s.section_type === 'curated') {
      const items = await query(`
        SELECT hsi.sort_order AS item_sort_order, n.* 
        FROM homepage_section_items hsi
        JOIN novels n ON hsi.novel_id = n.id
        WHERE hsi.section_key = ?
        ORDER BY hsi.sort_order ASC;
      `, [s.section_key]);
      itemCount = items.length;
      curatedNovels = items.map(r => formatNovel(r));
    } else if (s.section_type === 'featured') {
      const cnt = await queryOne(`SELECT COUNT(*) AS total FROM novels WHERE is_published = 1 AND visibility = 'public' AND featured = 1 AND LOWER(status) = 'ongoing';`);
      itemCount = cnt?.total || 0;
    } else if (s.section_type === 'completed') {
      const cnt = await queryOne(`SELECT COUNT(*) AS total FROM novels WHERE is_published = 1 AND visibility = 'public' AND LOWER(status) = 'completed';`);
      itemCount = cnt?.total || 0;
    } else if (s.section_type === 'trending') {
      const cnt = await queryOne(`SELECT COUNT(*) AS total FROM novels WHERE is_published = 1 AND visibility = 'public' AND trending_rank > 0;`);
      itemCount = cnt?.total || 0;
    } else if (s.section_type === 'audio') {
      const cnt = await queryOne(`SELECT COUNT(*) AS total FROM audio_novels WHERE status = 'published';`);
      itemCount = cnt?.total || 0;
    } else if (s.section_type === 'forum') {
      const cnt = await queryOne(`SELECT COUNT(*) AS total FROM forum_topics;`);
      itemCount = cnt?.total || 0;
    } else if (s.section_type === 'continue_reading') {
      const cnt = await queryOne(`SELECT COUNT(*) AS total FROM novels WHERE is_published = 1 AND visibility = 'public' AND (continue_reading = 1 OR LOWER(status) = 'ongoing');`);
      itemCount = cnt?.total || 0;
    } else if (s.section_type === 'latest') {
      const cnt = await queryOne(`SELECT COUNT(*) AS total FROM novels WHERE is_published = 1 AND visibility = 'public';`);
      itemCount = cnt?.total || 0;
    } else {
      itemCount = 1;
    }

    enriched.push({
      id: s.section_key,
      sectionKey: s.section_key,
      section_key: s.section_key,
      name: s.name || s.title || s.section_key,
      title: s.title,
      subtitle: s.subtitle,
      sectionType: s.section_type,
      section_type: s.section_type,
      isSystem: Boolean(s.is_system),
      is_system: Boolean(s.is_system) ? 1 : 0,
      isVisible: Boolean(s.is_visible),
      is_visible: Boolean(s.is_visible) ? 1 : 0,
      sortOrder: Number(s.sort_order || 0),
      sort_order: Number(s.sort_order || 0),
      contentLimit: Number(s.content_limit || 6),
      content_limit: Number(s.content_limit || 6),
      viewAllLink: s.view_all_link,
      view_all_link: s.view_all_link,
      displayStyle: s.display_style || 'grid',
      display_style: s.display_style || 'grid',
      settings: s.settings ? (typeof s.settings === 'string' ? JSON.parse(s.settings) : s.settings) : null,
      itemCount,
      item_count: itemCount,
      curatedNovels,
      items: curatedNovels,
      updatedAt: s.updated_at
    });
  }

  return { success: true, sections: enriched };
}

/**
 * Create a new admin-configured homepage section
 */
export async function createAdminHomepageSection(data, adminUser) {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Request body required' };
  }

  const name = String(data.name || '').trim();
  const title = String(data.title || '').trim();
  const subtitle = String(data.subtitle || '').trim();
  const sectionType = String(data.section_type || data.sectionType || '').trim().toLowerCase();

  if (!name) {
    return { success: false, error: 'Section Name (internal management identifier) is required.' };
  }
  if (!title) {
    return { success: false, error: 'Section Heading (public display title) is required.' };
  }

  const validTypes = ['trending', 'completed', 'latest', 'featured', 'forum', 'continue_reading', 'audio', 'curated', 'author_spotlight', 'community_cta'];
  if (!validTypes.includes(sectionType)) {
    return { success: false, error: `Invalid section type. Must be one of: ${validTypes.join(', ')}` };
  }

  // Generate clean unique sectionKey
  const providedKey = data.section_key || data.sectionKey;
  let baseKey = providedKey ? String(providedKey).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '_') : '';
  if (!baseKey) {
    baseKey = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!baseKey) baseKey = `section_${sectionType}_${Date.now()}`;
  }

  // Collision prevention
  let sectionKey = baseKey;
  let collision = await queryOne('SELECT section_key FROM homepage_sections WHERE section_key = ?', [sectionKey]);
  let counter = 1;
  while (collision) {
    sectionKey = `${baseKey}_${counter++}`;
    collision = await queryOne('SELECT section_key FROM homepage_sections WHERE section_key = ?', [sectionKey]);
  }

  // Determine sortOrder: If explicit position provided, shift existing sections down
  const rawOrder = data.sort_order !== undefined ? data.sort_order : data.sortOrder;
  let sortOrder;
  if (rawOrder !== undefined && Number.isInteger(Number(rawOrder)) && Number(rawOrder) > 0) {
    sortOrder = Number(rawOrder);
    await query('UPDATE homepage_sections SET sort_order = sort_order + 1 WHERE sort_order >= ?', [sortOrder]);
  } else {
    const maxOrderRow = await queryOne('SELECT MAX(sort_order) AS max_order FROM homepage_sections');
    sortOrder = (maxOrderRow?.max_order || 0) + 1;
  }

  const rawVis = data.is_visible !== undefined ? data.is_visible : data.isVisible;
  const isVisible = rawVis !== false && rawVis !== 0 && rawVis !== '0' ? 1 : 0;
  const rawLimit = data.content_limit !== undefined ? data.content_limit : data.contentLimit;
  const contentLimit = Number(rawLimit) > 0 ? Number(rawLimit) : 6;
  const rawLink = data.view_all_link !== undefined ? data.view_all_link : data.viewAllLink;
  const viewAllLink = rawLink ? String(rawLink).trim() : null;
  const rawStyle = data.display_style !== undefined ? data.display_style : data.displayStyle;
  const displayStyle = rawStyle ? String(rawStyle).trim() : 'grid';
  const novelList = Array.isArray(data.novel_ids) ? data.novel_ids : (Array.isArray(data.novelIds) ? data.novelIds : (Array.isArray(data.selectedNovelIds) ? data.selectedNovelIds : []));
  const settings = data.settings ? JSON.stringify(data.settings) : (novelList.length > 0 ? JSON.stringify({ novelIds: novelList }) : null);
  const updatedBy = adminUser?.id || null;

  await query(`
    INSERT INTO homepage_sections (
      section_key, name, title, subtitle, section_type, is_system, 
      is_visible, sort_order, content_limit, view_all_link, display_style, settings, updated_by
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?);
  `, [sectionKey, name, title, subtitle, sectionType, isVisible, sortOrder, contentLimit, viewAllLink, displayStyle, settings, updatedBy]);

  // If curated section and novel IDs provided, save to homepage_section_items
  if (sectionType === 'curated' && novelList.length > 0) {
    for (let i = 0; i < novelList.length; i++) {
      const nid = String(novelList[i]).trim();
      if (nid) {
        await query(`
          INSERT INTO homepage_section_items (section_key, novel_id, sort_order)
          VALUES (?, ?, ?);
        `, [sectionKey, nid, i + 1]);
      }
    }
  }

  // Re-normalize sort_order to maintain strictly sequential 1..N order
  const allRows = await query('SELECT section_key FROM homepage_sections ORDER BY sort_order ASC, section_key ASC');
  for (let i = 0; i < allRows.length; i++) {
    await query('UPDATE homepage_sections SET sort_order = ? WHERE section_key = ?', [i + 1, allRows[i].section_key]);
  }

  return { 
    success: true, 
    message: 'Section created successfully',
    sectionKey,
    name,
    title,
    sectionType,
    sortOrder,
    isVisible: Boolean(isVisible)
  };
}

/**
 * Update an existing homepage section
 */
export async function updateAdminHomepageSection(sectionKey, data, adminUser) {
  const existing = await queryOne('SELECT * FROM homepage_sections WHERE section_key = ?', [sectionKey]);
  if (!existing) {
    return { success: false, error: 'Section not found' };
  }

  const name = data.name !== undefined ? String(data.name).trim() : existing.name;
  const title = data.title !== undefined ? String(data.title).trim() : existing.title;
  const subtitle = data.subtitle !== undefined ? String(data.subtitle).trim() : existing.subtitle;
  const rawVis = data.is_visible !== undefined ? data.is_visible : data.isVisible;
  const isVisible = rawVis !== undefined ? (rawVis ? 1 : 0) : existing.is_visible;
  const rawLimit = data.content_limit !== undefined ? data.content_limit : data.contentLimit;
  const contentLimit = rawLimit !== undefined ? (Number(rawLimit) > 0 ? Number(rawLimit) : 6) : existing.content_limit;
  const rawLink = data.view_all_link !== undefined ? data.view_all_link : data.viewAllLink;
  const viewAllLink = rawLink !== undefined ? (rawLink ? String(rawLink).trim() : null) : existing.view_all_link;
  const rawStyle = data.display_style !== undefined ? data.display_style : data.displayStyle;
  const displayStyle = rawStyle !== undefined ? String(rawStyle).trim() : existing.display_style;
  const settings = data.settings !== undefined ? (data.settings ? JSON.stringify(data.settings) : null) : existing.settings;
  const updatedBy = adminUser?.id || null;

  // System sections maintain their original section_type
  let sectionType = existing.section_type;
  const newType = data.section_type || data.sectionType;
  if (!existing.is_system && newType) {
    sectionType = String(newType).trim().toLowerCase();
  }

  await query(`
    UPDATE homepage_sections SET
      name = ?,
      title = ?,
      subtitle = ?,
      section_type = ?,
      is_visible = ?,
      content_limit = ?,
      view_all_link = ?,
      display_style = ?,
      settings = ?,
      updated_by = ?
    WHERE section_key = ?;
  `, [name, title, subtitle, sectionType, isVisible, contentLimit, viewAllLink, displayStyle, settings, updatedBy, sectionKey]);

  // Update curated novel items if provided
  const novelList = Array.isArray(data.novel_ids) ? data.novel_ids : (Array.isArray(data.novelIds) ? data.novelIds : (Array.isArray(data.selectedNovelIds) ? data.selectedNovelIds : null));
  if (sectionType === 'curated' && novelList !== null) {
    await query('DELETE FROM homepage_section_items WHERE section_key = ?', [sectionKey]);
    for (let i = 0; i < novelList.length; i++) {
      const nid = String(novelList[i]).trim();
      if (nid) {
        await query('INSERT INTO homepage_section_items (section_key, novel_id, sort_order) VALUES (?, ?, ?)', [sectionKey, nid, i + 1]);
      }
    }
  }

  return { success: true, message: 'Section updated successfully', sectionKey };
}

/**
 * Reorder homepage sections in an atomic transaction
 */
export async function reorderAdminHomepageSections(orders, adminUser) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return { success: false, error: 'Reorder array is required.' };
  }

  const pool = getDb();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (let i = 0; i < orders.length; i++) {
      const item = orders[i];
      const sectionKey = typeof item === 'string' ? item : (item?.section_key || item?.sectionKey);
      const rawOrder = item && (item.sort_order !== undefined ? item.sort_order : item.sortOrder);
      const sortOrder = rawOrder !== undefined ? Number(rawOrder) : (i + 1);

      if (sectionKey) {
        await conn.query(
          'UPDATE homepage_sections SET sort_order = ?, updated_by = ? WHERE section_key = ?',
          [sortOrder, adminUser?.id || null, sectionKey]
        );
      }
    }

    await conn.commit();
    return { success: true, message: 'Homepage section order updated successfully.' };
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Reorder Error]:', err);
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Toggle visibility of a homepage section
 */
export async function toggleAdminHomepageSectionVisibility(sectionKey, isVisible, adminUser) {
  const existing = await queryOne('SELECT * FROM homepage_sections WHERE section_key = ?', [sectionKey]);
  if (!existing) {
    return { success: false, error: 'Section not found' };
  }

  const newVis = (isVisible !== undefined) ? (isVisible ? 1 : 0) : (existing.is_visible ? 0 : 1);
  await query('UPDATE homepage_sections SET is_visible = ?, updated_by = ? WHERE section_key = ?', [newVis, adminUser?.id || null, sectionKey]);
  return { success: true, sectionKey, isVisible: Boolean(newVis) };
}

/**
 * Delete a custom section (Core system sections are strictly protected)
 */
export async function deleteAdminHomepageSection(sectionKey, adminUser) {
  const existing = await queryOne('SELECT * FROM homepage_sections WHERE section_key = ?', [sectionKey]);
  if (!existing) {
    return { success: false, error: 'Section not found' };
  }

  if (Boolean(existing.is_system)) {
    return { 
      success: false, 
      error: 'Core system sections cannot be deleted as they represent foundational features. You may hide this section using the toggle instead.',
      code: 'SYSTEM_SECTION_PROTECTED'
    };
  }

  // Clean up curated relations first
  await query('DELETE FROM homepage_section_items WHERE section_key = ?', [sectionKey]);
  await query('DELETE FROM homepage_sections WHERE section_key = ?', [sectionKey]);

  // Re-normalize remaining sort_orders
  const remaining = await query('SELECT section_key FROM homepage_sections ORDER BY sort_order ASC, section_key ASC');
  for (let i = 0; i < remaining.length; i++) {
    await query('UPDATE homepage_sections SET sort_order = ? WHERE section_key = ?', [i + 1, remaining[i].section_key]);
  }

  return { success: true, message: 'Section deleted successfully. Associated novels and community data remain intact.', deletedKey: sectionKey };
}

/**
 * Reset homepage section ordering to system default
 */
export async function resetAdminHomepageSectionsOrder(adminUser) {
  const defaultOrder = [
    'featured',
    'continue_reading',
    'audio',
    'trending',
    'completed',
    'forum',
    'author_spotlight',
    'community_cta'
  ];

  const pool = getDb();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (let i = 0; i < defaultOrder.length; i++) {
      await conn.query(
        'UPDATE homepage_sections SET sort_order = ?, is_visible = 1, updated_by = ? WHERE section_key = ?',
        [i + 1, adminUser?.id || null, defaultOrder[i]]
      );
    }

    // Place any custom sections after the 8 system sections
    const [customRows] = await conn.query('SELECT section_key FROM homepage_sections WHERE is_system = 0 ORDER BY created_at ASC');
    let orderIndex = defaultOrder.length + 1;
    for (const r of customRows) {
      await conn.query(
        'UPDATE homepage_sections SET sort_order = ?, updated_by = ? WHERE section_key = ?',
        [orderIndex++, adminUser?.id || null, r.section_key]
      );
    }

    await conn.commit();
    return { success: true, message: 'Homepage section order reset to default configuration.' };
  } catch (err) {
    await conn.rollback();
    console.error('[Admin Reset Order Error]:', err);
    throw err;
  } finally {
    conn.release();
  }
}

