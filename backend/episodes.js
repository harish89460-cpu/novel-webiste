// Episode Management & Publishing Scheduler Layer for Rudhra Prarthana Novels
// Full support for Unlimited Episodes, Nested Sub-Episodes (e.g. 1, 1.1, 1.2),
// Reader Rich-Text Content, Publishing Queue, and Timezone Scheduling

import { query, queryOne } from './db.js';
import { createNotification } from './notifications.js';

/**
 * Utility: Strip HTML tags to calculate word count and estimated reading time
 */
export function calculateReadingStats(content = '') {
  if (!content || typeof content !== 'string') {
    return { wordCount: '0 words', readTime: '1 min', words: 0 };
  }
  const plainText = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = plainText ? plainText.split(' ').filter(Boolean).length : 0;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return {
    wordCount: `${words.toLocaleString()} words`,
    readTime: `${minutes} min${minutes > 1 ? 's' : ''}`,
    words
  };
}

/**
 * Utility: Format current date for release_date field
 */
function formatReleaseDate(date = new Date()) {
  try {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

/**
 * Reliable Backend Scheduler Engine
 * Automatically checks and publishes all due scheduled episodes across all novels.
 * Prevents duplicate publishing and updates novel chapter counts and timestamps.
 */
export async function checkAndPublishDueEpisodes() {
  try {
    // Find due scheduled episodes
    const dueRows = await query(`
      SELECT c.id, c.novel_id, c.title, c.chapter_num, c.scheduled_at
      FROM chapters c
      WHERE c.status = 'scheduled'
        AND c.scheduled_at IS NOT NULL
        AND c.scheduled_at <= NOW();
    `);

    if (!dueRows || dueRows.length === 0) {
      return { publishedCount: 0, published: [] };
    }

    const publishedIds = [];
    const affectedNovelIds = new Set();

    for (const ep of dueRows) {
      await query(`
        UPDATE chapters
        SET status = 'published',
            published_at = COALESCE(scheduled_at, NOW())
        WHERE id = ? AND status = 'scheduled';
      `, [ep.id]);

      publishedIds.push(ep.id);
      affectedNovelIds.add(ep.novel_id);
    }

    // Refresh affected novels' chapters count and updated date
    for (const novelId of affectedNovelIds) {
      await refreshNovelStats(novelId);
    }

    // Send genuine notifications to readers for newly published episodes
    for (const ep of dueRows) {
      try {
        const readers = await query(`
          SELECT DISTINCT user_id FROM reading_progress WHERE novel_id = ?
          UNION
          SELECT DISTINCT user_id FROM comments WHERE novel_id = ?;
        `, [ep.novel_id, ep.novel_id]);

        const novelRow = await queryOne('SELECT title, author FROM novels WHERE id = ?;', [ep.novel_id]);
        const novelTitle = novelRow?.title || 'Novel';
        const authorName = novelRow?.author || 'Rudhra Prarthana';

        for (const reader of readers) {
          await createNotification({
            userId: reader.user_id,
            type: 'chapter_release',
            title: 'New Chapter Released!',
            message: `${authorName} has published Chapter ${ep.chapter_num} of ${novelTitle}.`,
            link: `#reader?novel=${ep.novel_id}&ch=${ep.chapter_num}`,
            entityType: 'chapter',
            entityId: `${ep.novel_id}:${ep.chapter_num}`
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('Scheduler notification error:', e.message);
      }
    }

    console.log(`[Scheduler] Automatically published ${publishedIds.length} due episode(s).`);
    return { publishedCount: publishedIds.length, published: dueRows };
  } catch (err) {
    console.error('[Scheduler Error] Failed to publish due episodes:', err.message);
    return { publishedCount: 0, error: err.message };
  }
}

/**
 * Helper: Refresh a novel's total chapters count and updated_date in the database
 */
export async function refreshNovelStats(novelId) {
  try {
    const cleanId = String(novelId || '').trim();
    const countRow = await queryOne(`
      SELECT COUNT(*) AS total
      FROM chapters
      WHERE novel_id = ? AND status = 'published' AND parent_id IS NULL;
    `, [cleanId]);

    let total = Number(countRow?.total || 0);
    if (total === 0) {
      const fallbackRow = await queryOne(`
        SELECT COUNT(*) AS total
        FROM chapters
        WHERE novel_id = ? AND status = 'published';
      `, [cleanId]);
      total = Number(fallbackRow?.total || 0);
    }
    const updatedDate = formatReleaseDate(new Date());

    await query(`
      UPDATE novels
      SET chapters_count = ?,
          updated_date = ?
      WHERE id = ?;
    `, [total, updatedDate, cleanId]);
  } catch (err) {
    console.warn(`[Stats Refresh Warning] Failed for novel ${novelId}:`, err.message);
  }
}

/**
 * Format raw database row into clean episode object
 */
export function formatEpisode(row, subEpisodes = []) {
  if (!row) return null;
  const numStr = String(row.episode_number || row.chapter_num || '1');
  const numericVal = parseFloat(numStr);
  const num = isNaN(numericVal) ? numStr : (numStr.includes('.') ? numStr : Number(numStr));

  return {
    id: row.id,
    novelId: row.novel_id,
    novelTitle: row.novel_title || undefined,
    parentId: row.parent_id !== null && row.parent_id !== undefined ? Number(row.parent_id) : null,
    parentTitle: row.parent_title || null,
    chapterNum: numStr,
    num: num,
    episodeNumber: numStr,
    title: row.title,
    titleTa: row.title_ta || row.title,
    content: row.content || '',
    isGuestAllowed: Boolean(row.is_guest_allowed),
    isAudio: Boolean(row.is_audio),
    wordCount: row.word_count || '',
    readTime: row.read_time || '8 mins',
    date: row.release_date || 'Recent',
    releaseDate: row.release_date || 'Recent',
    status: row.status || 'published',
    scheduledAt: row.scheduled_at || null,
    timezone: row.timezone || 'Asia/Kolkata',
    publishedAt: row.published_at || null,
    sortOrder: Number(row.sort_order || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isSubEpisode: Boolean(row.parent_id),
    subEpisodesCount: subEpisodes.length,
    subEpisodes: subEpisodes.map(sub => (sub && sub.id && sub.subEpisodes !== undefined ? sub : formatEpisode(sub)))
  };
}

/**
 * Compare hierarchical dot numbers (e.g. 1, 1.1, 1.1.1, 1.2, 2, 2.1)
 */
export function compareHierarchicalNumbers(aStr, bStr) {
  const aParts = String(aStr || '').split('.').map(s => parseInt(s, 10));
  const bParts = String(bStr || '').split('.').map(s => parseInt(s, 10));
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aVal = isNaN(aParts[i]) ? 0 : aParts[i];
    const bVal = isNaN(bParts[i]) ? 0 : bParts[i];
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
}

function compareEpisodeRows(a, b) {
  const numA = a.chapter_num || a.episode_number || '';
  const numB = b.chapter_num || b.episode_number || '';
  const diff = compareHierarchicalNumbers(numA, numB);
  if (diff !== 0) return diff;
  return Number(a.sort_order || 0) - Number(b.sort_order || 0);
}

/**
 * Get all episodes for a novel
 * - If includeAll = true (admin), returns all episodes including drafts & scheduled
 * - If includeAll = false (reader/guest), returns only published episodes
 * Builds nested parent-child tree structure for sub-episodes (e.g. 1 -> [1.1, 1.2])
 */
export async function getEpisodesByNovel(novelId, { includeAll = false, hierarchical = false } = {}) {
  // Always trigger scheduler check first to guarantee real-time freshness
  await checkAndPublishDueEpisodes();

  const cleanId = String(novelId || '').trim();
  const novelRow = await queryOne('SELECT id, title FROM novels WHERE id = ? OR title = ? LIMIT 1;', [cleanId, cleanId]);
  const targetId = novelRow ? novelRow.id : cleanId;

  let sql = `
    SELECT c.*, p.title AS parent_title, n.title AS novel_title
    FROM chapters c
    LEFT JOIN chapters p ON c.parent_id = p.id
    LEFT JOIN novels n ON c.novel_id = n.id
    WHERE c.novel_id = ?
  `;
  const params = [targetId];

  if (!includeAll) {
    sql += ` AND c.status = 'published'`;
  }

  sql += ` ORDER BY c.sort_order ASC, c.id ASC;`;

  const rows = await query(sql, params);
  rows.sort(compareEpisodeRows);

  if (!hierarchical) {
    return rows.map(r => formatEpisode(r));
  }

  // Build recursive 3-level tree (Chapter -> Episode -> Sub-episode)
  const childrenMap = new Map();
  for (const r of rows) {
    if (r.parent_id) {
      const pId = Number(r.parent_id);
      if (!childrenMap.has(pId)) {
        childrenMap.set(pId, []);
      }
      childrenMap.get(pId).push(r);
    }
  }

  function buildTreeItem(r) {
    const childRows = childrenMap.get(Number(r.id)) || [];
    childRows.sort(compareEpisodeRows);
    const childTree = childRows.map(child => buildTreeItem(child));
    return formatEpisode(r, childTree);
  }

  const rootEpisodes = [];
  const rootRows = rows.filter(r => !r.parent_id);
  rootRows.sort(compareEpisodeRows);

  for (const r of rootRows) {
    rootEpisodes.push(buildTreeItem(r));
  }

  // If there are orphaned sub-episodes whose parents aren't in roots, append them
  const emittedIds = new Set();
  function markEmitted(item) {
    emittedIds.add(Number(item.id));
    if (item.subEpisodes) {
      item.subEpisodes.forEach(markEmitted);
    }
  }
  rootEpisodes.forEach(markEmitted);

  for (const r of rows) {
    if (!emittedIds.has(Number(r.id))) {
      rootEpisodes.push(buildTreeItem(r));
    }
  }

  return rootEpisodes;
}

/**
 * Get single episode by ID
 */
export async function getEpisodeById(id) {
  const row = await queryOne(`
    SELECT c.*, n.title AS novel_title, p.title AS parent_title
    FROM chapters c
    LEFT JOIN novels n ON c.novel_id = n.id
    LEFT JOIN chapters p ON c.parent_id = p.id
    WHERE c.id = ?;
  `, [id]);

  if (!row) return null;

  // Retrieve any child sub-episodes
  const subs = await query(`
    SELECT c.*, n.title AS novel_title, p.title AS parent_title
    FROM chapters c
    LEFT JOIN novels n ON c.novel_id = n.id
    LEFT JOIN chapters p ON c.parent_id = p.id
    WHERE c.parent_id = ? 
    ORDER BY c.sort_order ASC, c.id ASC;
  `, [id]);
  subs.sort(compareEpisodeRows);

  return formatEpisode(row, subs);
}

/**
 * Create a new Chapter, Episode, or Sub-Episode
 */
export async function createEpisode(data) {
  const rawNovelId = String(data.novelId || '').trim();
  const content = (data.content || '').trim();

  if (!rawNovelId) {
    return { success: false, error: 'novelId is required.' };
  }

  // Verify novel exists by id or title
  const novel = await queryOne('SELECT id, title FROM novels WHERE id = ? OR title = ? LIMIT 1;', [rawNovelId, rawNovelId]);
  if (!novel) {
    return { success: false, error: `Novel "${rawNovelId}" not found.` };
  }
  const novelId = novel.id;

  const parentId = data.parentId ? parseInt(data.parentId, 10) : null;
  let parentEpisode = null;
  if (parentId) {
    parentEpisode = await queryOne('SELECT * FROM chapters WHERE id = ? AND novel_id = ?;', [parentId, novelId]);
    if (!parentEpisode) {
      return { success: false, error: 'Specified parent chapter/episode was not found.' };
    }
  }

  // Determine Hierarchical Numbering and Sort Order
  let episodeNumber = (data.episodeNumber || data.chapterNum || '').trim();
  let sortOrder = data.sortOrder !== undefined && !isNaN(parseFloat(data.sortOrder))
    ? parseFloat(data.sortOrder)
    : null;

  if (parentId && parentEpisode) {
    // Parent could be a Chapter (parent_id IS NULL) OR an Episode (parent_id IS NOT NULL)
    const parentNum = String(parentEpisode.episode_number || parentEpisode.chapter_num || '1');
    const existingSubs = await query(`
      SELECT id, chapter_num, episode_number, sort_order 
      FROM chapters 
      WHERE parent_id = ? 
      ORDER BY sort_order ASC, id ASC;
    `, [parentId]);

    if (!episodeNumber) {
      // Find highest suffix number under parentNum (e.g. 1.1 -> suffix 1, 1.2 -> suffix 2)
      let maxSuffix = 0;
      for (const sub of existingSubs) {
        const subNumStr = String(sub.episode_number || sub.chapter_num || '');
        if (subNumStr.startsWith(parentNum + '.')) {
          const rest = subNumStr.slice(parentNum.length + 1);
          const firstPart = parseInt(rest.split('.')[0], 10);
          if (!isNaN(firstPart) && firstPart > maxSuffix) {
            maxSuffix = firstPart;
          }
        }
      }
      const nextIndex = Math.max(maxSuffix + 1, existingSubs.length + 1);
      episodeNumber = `${parentNum}.${nextIndex}`;
    }

    if (sortOrder === null) {
      const baseSort = Number(parentEpisode.sort_order || 1);
      const subOffset = (existingSubs.length + 1) * 0.01;
      sortOrder = Number((baseSort + subOffset).toFixed(4));
    }
  } else {
    // Root Chapter (parent_id IS NULL)
    if (!episodeNumber) {
      const rootChapters = await query(`
        SELECT chapter_num, episode_number, sort_order 
        FROM chapters 
        WHERE novel_id = ? AND parent_id IS NULL;
      `, [novelId]);

      let maxChapterNum = 0;
      for (const ch of rootChapters) {
        const cNum = parseInt(String(ch.episode_number || ch.chapter_num || '0'), 10);
        if (!isNaN(cNum) && cNum > maxChapterNum) {
          maxChapterNum = cNum;
        }
      }
      episodeNumber = String(maxChapterNum + 1);
      if (sortOrder === null) {
        sortOrder = Number(maxChapterNum + 1);
      }
    } else if (sortOrder === null) {
      const parsed = parseFloat(episodeNumber);
      sortOrder = !isNaN(parsed) ? parsed : 1.0;
    }
  }

  // Ensure unique chapter_num per novel by cleanly incrementing if collision occurs
  let finalChapterNum = episodeNumber;
  let collisionCount = 1;
  while (true) {
    const duplicate = await queryOne(`
      SELECT id FROM chapters WHERE novel_id = ? AND chapter_num = ?;
    `, [novelId, finalChapterNum]);
    if (!duplicate) break;

    // Increment last dot segment
    if (finalChapterNum.includes('.')) {
      const parts = finalChapterNum.split('.');
      const last = parseInt(parts[parts.length - 1], 10);
      parts[parts.length - 1] = String(!isNaN(last) ? last + 1 : collisionCount++);
      finalChapterNum = parts.join('.');
    } else {
      const num = parseInt(finalChapterNum, 10);
      finalChapterNum = String(!isNaN(num) ? num + 1 : `${episodeNumber}_${collisionCount++}`);
    }
  }

  // Auto-generate display title according to naming rules if title not explicitly provided:
  // Chapter: Novel Title (1)
  // Episode: Novel Title (1.1)
  // Sub-episode: Novel Title (1.1.1)
  let title = (data.title || '').trim();
  const novelTitle = novel.title || 'Novel';
  if (!title) {
    title = `${novelTitle} (${finalChapterNum})`;
  }

  // Publishing Status & Scheduling
  const status = ['draft', 'scheduled', 'published'].includes(data.status) ? data.status : 'published';
  let scheduledAt = null;
  let timezone = data.timezone || 'Asia/Kolkata';
  let publishedAt = null;

  if (status === 'scheduled') {
    if (!data.scheduledAt) {
      return { success: false, error: 'A publication date and time is required when scheduling an episode.' };
    }
    // Normalize scheduled date string
    const schedDate = new Date(data.scheduledAt);
    if (isNaN(schedDate.getTime())) {
      return { success: false, error: 'Invalid scheduled date/time format.' };
    }
    scheduledAt = schedDate.toISOString().slice(0, 19).replace('T', ' ');
  } else if (status === 'published') {
    publishedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
  }

  // Word count & Reading time calculation
  const stats = calculateReadingStats(content);
  const releaseDate = data.releaseDate || formatReleaseDate(new Date());

  const res = await query(`
    INSERT INTO chapters (
      novel_id, parent_id, chapter_num, episode_number, title, title_ta,
      content, is_guest_allowed, is_audio, word_count, read_time,
      release_date, status, scheduled_at, timezone, published_at, sort_order
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    );
  `, [
    novelId,
    parentId,
    finalChapterNum,
    episodeNumber,
    title,
    data.titleTa || title,
    content,
    data.isGuestAllowed !== undefined ? (data.isGuestAllowed ? 1 : 0) : 1,
    data.isAudio ? 1 : 0,
    stats.wordCount,
    stats.readTime,
    releaseDate,
    status,
    scheduledAt,
    timezone,
    publishedAt,
    sortOrder
  ]);

  const newId = res.insertId;

  // If published, refresh novel chapters count and notify readers
  if (status === 'published') {
    await refreshNovelStats(novelId);

    try {
      const readers = await query(`
        SELECT DISTINCT user_id FROM reading_progress WHERE novel_id = ?
        UNION
        SELECT DISTINCT user_id FROM comments WHERE novel_id = ?;
      `, [novelId, novelId]);

      const novelRow = await queryOne('SELECT title, author FROM novels WHERE id = ?;', [novelId]);
      const novelTitle = novelRow?.title || 'Novel';
      const authorName = novelRow?.author || 'Rudhra Prarthana';

      for (const reader of readers) {
        await createNotification({
          userId: reader.user_id,
          type: 'chapter_release',
          title: 'New Chapter Released!',
          message: `${authorName} has published Chapter ${finalChapterNum} of ${novelTitle}.`,
          link: `#reader?novel=${novelId}&ch=${finalChapterNum}`,
          entityType: 'chapter',
          entityId: `${novelId}:${finalChapterNum}`
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Chapter release notif error:', e.message);
    }
  }

  const created = await getEpisodeById(newId);
  return { success: true, episode: created };
}

/**
 * Update an existing Episode
 */
export async function updateEpisode(id, data) {
  const existing = await queryOne('SELECT * FROM chapters WHERE id = ?;', [id]);
  if (!existing) {
    return { success: false, error: 'Episode not found.' };
  }

  const novelId = existing.novel_id;
  const title = data.title !== undefined ? String(data.title).trim() : existing.title;
  const titleTa = data.titleTa !== undefined ? String(data.titleTa).trim() : (data.title !== undefined ? title : existing.title_ta);
  const content = data.content !== undefined ? String(data.content).trim() : existing.content;

  if (!title) {
    return { success: false, error: 'Episode title cannot be empty.' };
  }

  let episodeNumber = data.episodeNumber !== undefined ? String(data.episodeNumber).trim() : existing.episode_number;
  let chapterNum = data.chapterNum !== undefined ? String(data.chapterNum).trim() : (episodeNumber || existing.chapter_num);

  // Check unique chapter_num if changed
  if (chapterNum !== existing.chapter_num) {
    const duplicate = await queryOne('SELECT id FROM chapters WHERE novel_id = ? AND chapter_num = ? AND id != ?;', [novelId, chapterNum, id]);
    if (duplicate) {
      return { success: false, error: `An episode with number "${chapterNum}" already exists for this novel.` };
    }
  }

  const parentId = data.parentId !== undefined 
    ? (data.parentId ? parseInt(data.parentId, 10) : null) 
    : existing.parent_id;

  // Prevent circular parent reference
  if (parentId && parentId === Number(id)) {
    return { success: false, error: 'An episode cannot be its own parent.' };
  }

  const sortOrder = data.sortOrder !== undefined && !isNaN(parseFloat(data.sortOrder))
    ? parseFloat(data.sortOrder)
    : existing.sort_order;

  // Status & Scheduling
  const status = data.status && ['draft', 'scheduled', 'published'].includes(data.status) 
    ? data.status 
    : existing.status;

  let scheduledAt = existing.scheduled_at;
  let timezone = data.timezone || existing.timezone || 'Asia/Kolkata';
  let publishedAt = existing.published_at;

  if (status === 'scheduled') {
    if (data.scheduledAt) {
      const schedDate = new Date(data.scheduledAt);
      if (isNaN(schedDate.getTime())) {
        return { success: false, error: 'Invalid scheduled date/time format.' };
      }
      scheduledAt = schedDate.toISOString().slice(0, 19).replace('T', ' ');
    } else if (!existing.scheduled_at) {
      return { success: false, error: 'A publication date and time is required when scheduling an episode.' };
    }
  } else if (status === 'published' && (!existing.published_at || existing.status !== 'published')) {
    publishedAt = new Date().toISOString().slice(0, 19).replace('T', ' ');
    scheduledAt = null;
  } else if (status === 'draft') {
    scheduledAt = null;
  }

  // Recalculate reading stats if content changed
  const stats = calculateReadingStats(content);
  const isGuestAllowed = data.isGuestAllowed !== undefined ? (data.isGuestAllowed ? 1 : 0) : existing.is_guest_allowed;
  const isAudio = data.isAudio !== undefined ? (data.isAudio ? 1 : 0) : existing.is_audio;
  const releaseDate = data.releaseDate || existing.release_date || formatReleaseDate(new Date());

  await query(`
    UPDATE chapters SET
      parent_id = ?,
      chapter_num = ?,
      episode_number = ?,
      title = ?,
      title_ta = ?,
      content = ?,
      is_guest_allowed = ?,
      is_audio = ?,
      word_count = ?,
      read_time = ?,
      release_date = ?,
      status = ?,
      scheduled_at = ?,
      timezone = ?,
      published_at = ?,
      sort_order = ?
    WHERE id = ?;
  `, [
    parentId,
    chapterNum,
    episodeNumber,
    title,
    titleTa,
    content,
    isGuestAllowed,
    isAudio,
    stats.wordCount,
    stats.readTime,
    releaseDate,
    status,
    scheduledAt,
    timezone,
    publishedAt,
    sortOrder,
    id
  ]);

  // Refresh novel stats if status changed to/from published
  await refreshNovelStats(novelId);

  const updated = await getEpisodeById(id);
  return { success: true, episode: updated };
}

/**
 * Duplicate an Episode as a Draft
 */
export async function duplicateEpisode(id) {
  const original = await queryOne('SELECT * FROM chapters WHERE id = ?;', [id]);
  if (!original) {
    return { success: false, error: 'Episode not found to duplicate.' };
  }

  const novelId = original.novel_id;
  const newTitle = `${original.title} (Copy)`;
  const copySuffix = `copy-${Date.now().toString().slice(-4)}`;
  const newNum = `${original.chapter_num}-${copySuffix}`;

  const res = await query(`
    INSERT INTO chapters (
      novel_id, parent_id, chapter_num, episode_number, title, title_ta,
      content, is_guest_allowed, is_audio, word_count, read_time,
      release_date, status, scheduled_at, timezone, published_at, sort_order
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, 'draft', NULL, ?, NULL, ?
    );
  `, [
    novelId,
    original.parent_id,
    newNum,
    newNum,
    newTitle,
    original.title_ta ? `${original.title_ta} (Copy)` : newTitle,
    original.content,
    original.is_guest_allowed,
    original.is_audio,
    original.word_count,
    original.read_time,
    formatReleaseDate(new Date()),
    original.timezone || 'Asia/Kolkata',
    Number(original.sort_order || 1) + 0.001
  ]);

  const duplicated = await getEpisodeById(res.insertId);
  return { success: true, episode: duplicated };
}

/**
 * Delete an Episode
 * Safely unlinks any child sub-episodes by setting their parent_id = NULL
 */
export async function deleteEpisode(id) {
  const existing = await queryOne('SELECT id, novel_id FROM chapters WHERE id = ?;', [id]);
  if (!existing) {
    return { success: false, error: 'Episode not found.' };
  }

  // Unlink children
  await query('UPDATE chapters SET parent_id = NULL WHERE parent_id = ?;', [id]);

  // Delete comments and reading progress
  try {
    await query('DELETE FROM comments WHERE novel_id = ? AND chapter_num = (SELECT chapter_num FROM chapters WHERE id = ?);', [existing.novel_id, id]);
  } catch {}

  // Delete episode
  await query('DELETE FROM chapters WHERE id = ?;', [id]);

  // Refresh novel stats
  await refreshNovelStats(existing.novel_id);

  return { success: true, id };
}

/**
 * Get all scheduled episodes across all novels
 */
export async function getScheduledEpisodes() {
  await checkAndPublishDueEpisodes();

  const rows = await query(`
    SELECT c.*, n.title AS novel_title, n.cover AS novel_cover
    FROM chapters c
    JOIN novels n ON c.novel_id = n.id
    WHERE c.status = 'scheduled'
    ORDER BY c.scheduled_at ASC;
  `);

  return rows.map(r => ({
    id: r.id,
    novelId: r.novel_id,
    novelTitle: r.novel_title,
    novelCover: r.novel_cover,
    chapterNum: r.chapter_num,
    episodeNumber: r.episode_number || r.chapter_num,
    title: r.title,
    scheduledAt: r.scheduled_at,
    timezone: r.timezone || 'Asia/Kolkata',
    sortOrder: Number(r.sort_order || 1),
    wordCount: r.word_count,
    readTime: r.read_time,
    createdAt: r.created_at
  }));
}

/**
 * Immediately publish a scheduled episode
 */
export async function publishEpisodeNow(id) {
  const existing = await queryOne('SELECT id, novel_id, title FROM chapters WHERE id = ?;', [id]);
  if (!existing) {
    return { success: false, error: 'Episode not found.' };
  }

  await query(`
    UPDATE chapters 
    SET status = 'published',
        published_at = NOW(),
        scheduled_at = NULL
    WHERE id = ?;
  `, [id]);

  await refreshNovelStats(existing.novel_id);
  const updated = await getEpisodeById(id);
  return { success: true, episode: updated };
}

/**
 * Cancel scheduling for an episode (revert to draft)
 */
export async function cancelEpisodeSchedule(id) {
  const existing = await queryOne('SELECT id, novel_id FROM chapters WHERE id = ?;', [id]);
  if (!existing) {
    return { success: false, error: 'Episode not found.' };
  }

  await query(`
    UPDATE chapters 
    SET status = 'draft',
        scheduled_at = NULL
    WHERE id = ?;
  `, [id]);

  await refreshNovelStats(existing.novel_id);
  const updated = await getEpisodeById(id);
  return { success: true, episode: updated };
}
