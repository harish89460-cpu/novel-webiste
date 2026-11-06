import { moveToTrash } from './trash.js';
// Novel Content SQL Layer for Rudhra Prarthana Novels
// Dynamic MySQL Persistence with Relations to Chapters and Scheduler Integration

import { query, queryOne } from './db.js';
import { checkAndPublishDueEpisodes, compareHierarchicalNumbers } from './episodes.js';
import { checkAndPublishDueNovels } from './scheduler.js';
import { parseISTDateTime, isPastIST } from './timezone.js';
import { saveBase64Image, deleteLocalUploadFile } from './auth.js';
import { createNotification } from './notifications.js';

function compareHierarchicalRows(a, b) {
  const numA = a.chapter_num || a.episode_number || a.num || '';
  const numB = b.chapter_num || b.episode_number || b.num || '';
  const diff = compareHierarchicalNumbers(numA, numB);
  if (diff !== 0) return diff;
  return Number(a.sort_order || 0) - Number(b.sort_order || 0);
}

/**
 * Format a database row into a clean frontend-ready novel object
 */
export function formatNovel(row, chapters = [], extra = {}) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    author: row.author || 'Rudhra Prarthana',
    authorId: row.author_id !== undefined && row.author_id !== null ? Number(row.author_id) : 2,
    author_id: row.author_id !== undefined && row.author_id !== null ? Number(row.author_id) : 2,
    genre: row.genre || 'Novel',
    category: row.category || (row.status ? `${row.status} Novels` : 'Novels'),
    status: row.status || 'Ongoing',
    badge: row.badge || row.status || 'Ongoing',
    cover: row.cover || '/default-cover.jpg',
    description: row.description || '',
    contentType: row.content_type || (row.is_audio ? 'audio_novel' : (row.category === 'Short Stories' ? 'short_story' : 'written_novel')),
    content_type: row.content_type || (row.is_audio ? 'audio_novel' : (row.category === 'Short Stories' ? 'short_story' : 'written_novel')),
    accessPermission: row.access_permission || 'admin_only',
    access_permission: row.access_permission || 'admin_only',
    language: row.language || 'Tamil',
    scheduledAt: row.scheduled_at || null,
    selectedMemberIds: extra.selectedMemberIds || [],
    selectedWriterIds: extra.selectedWriterIds || [],
    chaptersCount: row.chapters_count !== null && row.chapters_count !== undefined 
      ? Number(row.chapters_count) 
      : (chapters.filter(c => !c.parent_id && !c.parentId).length || chapters.length || undefined),
    views: row.views !== null && row.views !== undefined && String(row.views).trim() !== '' ? String(row.views) : undefined,
    rating: extra.averageRating || (row.rating !== null && row.rating !== undefined && String(row.rating).trim() !== '' ? String(row.rating) : '5.0'),
    averageRating: extra.averageRating || (row.rating !== null && row.rating !== undefined && String(row.rating).trim() !== '' ? String(row.rating) : '5.0'),
    totalRatings: extra.totalRatings !== undefined ? extra.totalRatings : 0,
    userRating: extra.userRating !== undefined ? extra.userRating : null,
    isSaved: Boolean(extra.isSaved),
    authorFollowersCount: extra.authorFollowersCount !== undefined ? extra.authorFollowersCount : 0,
    isFollowingAuthor: Boolean(extra.isFollowingAuthor),
    updatedDate: row.updated_date || '',
    featured: Boolean(row.featured),
    continueReading: Boolean(row.continue_reading),
    isAudio: Boolean(row.is_audio),
    audioAvailable: Boolean(row.audio_available),
    duration: row.audio_duration || undefined,
    audioVoice: row.audio_voice || row.author || undefined,
    youtubeUrl: row.youtube_url || undefined,
    trendingRank: Number(row.trending_rank || 0),
    sortOrder: Number(row.sort_order || 0),
    isPublished: Boolean(row.is_published),
    visibility: row.visibility || 'public',
    link: row.link || `#novel?id=${encodeURIComponent(row.id)}`,
    chapters: chapters.map(ch => {
      const numStr = String(ch.episode_number || ch.chapter_num || '1');
      const numericVal = parseFloat(numStr);
      const num = isNaN(numericVal) ? numStr : (numStr.includes('.') ? numStr : Number(numStr));
      return {
        id: ch.id,
        parentId: ch.parent_id || null,
        num: num,
        chapterNum: numStr,
        episodeNumber: numStr,
        title: ch.title,
        titleTa: ch.title_ta || ch.title,
        date: ch.release_date || 'Recent',
        words: ch.word_count || '',
        readTime: ch.read_time || '8 mins',
        status: ch.status || 'published',
        scheduledAt: ch.scheduled_at || null,
        sortOrder: Number(ch.sort_order || 1),
        isAudio: Boolean(ch.is_audio),
        isGuestAllowed: Boolean(ch.is_guest_allowed)
      };
    })
  };
}

/**
 * Check if a user can view a novel (enforces visibility on the backend)
 */
export async function checkNovelViewAccess(novelId, currentUser = null) {
  await checkAndPublishDueNovels().catch(() => {});
  if (!novelId) return { allowed: false, status: 400, error: 'Novel ID is required' };

  let cleanId = String(novelId).trim();
  try { cleanId = decodeURIComponent(cleanId); } catch {}
  const genSlug = generateNovelSlug(cleanId);

  const row = await queryOne(`
    SELECT * FROM novels 
    WHERE id = ? OR LOWER(id) = LOWER(?) OR title = ? OR (id = ? AND ? != '')
    LIMIT 1;
  `, [cleanId, cleanId, cleanId, genSlug, genSlug]);

  if (!row) {
    return { allowed: false, status: 404, error: 'Novel not found' };
  }

  const isAdmin = currentUser && (currentUser.isAdmin || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase()));
  if (isAdmin) return { allowed: true, novel: row };

  const authorId = row.author_id;
  if (currentUser && Number(currentUser.id) === Number(authorId)) {
    return { allowed: true, novel: row };
  }

  // Scheduled check
  if (String(row.status).toLowerCase() === 'scheduled') {
    if (row.scheduled_at && !isPastIST(row.scheduled_at)) {
      return { allowed: false, status: 403, error: 'This content is scheduled for future release.' };
    }
  }

  // Publication status / draft
  const isDraft = !row.is_published || row.status === 'Draft' || row.visibility === 'draft';
  if (isDraft) {
    return { allowed: false, status: 403, error: 'This novel is currently in draft mode.' };
  }

  const vis = (row.visibility || 'public').toLowerCase();

  // 1. Public
  if (vis === 'public') {
    return { allowed: true, novel: row };
  }

  // 2. Private / Admin Only
  if (vis === 'private' || vis === 'admin_only') {
    return { allowed: false, status: 403, error: 'This novel is private and restricted to authorized administrators.' };
  }

  // 3. All Members
  if (vis === 'members' || vis === 'all_members') {
    if (!currentUser || !currentUser.id) {
      return { allowed: false, status: 401, error: 'Please log in as an authorized member to view this novel.' };
    }
    return { allowed: true, novel: row };
  }

  // 4. Selected Members
  if (vis === 'selected_members') {
    if (!currentUser || !currentUser.id) {
      return { allowed: false, status: 401, error: 'Please log in to view this restricted novel.' };
    }
    const rule = await queryOne(`
      SELECT id FROM content_access_rules 
      WHERE target_type IN ('novel', 'audio_novel', 'short_story') 
        AND target_id = ? 
        AND user_id = ? 
        AND rule_type = 'allow'
        AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1;
    `, [row.id, currentUser.id]);

    if (!rule) {
      return { allowed: false, status: 403, error: 'Access restricted: You have not been selected to view this content.' };
    }
    return { allowed: true, novel: row };
  }

  return { allowed: true, novel: row };
}

/**
 * Get all novels with optional filtering and visibility checks
 */
export async function getAllNovels({ status, category, publishedOnly = false, currentUser = null } = {}) {
  await checkAndPublishDueNovels().catch(() => {});
  await checkAndPublishDueEpisodes();

  const isAdmin = currentUser && (currentUser.isAdmin || ['admin', 'administrator', 'editor'].includes((currentUser.role || '').toLowerCase()));
  const userId = currentUser ? currentUser.id : null;

  let sql = 'SELECT * FROM novels WHERE 1=1';
  const params = [];

  if (publishedOnly && !isAdmin) {
    sql += " AND is_published = 1 AND status != 'Draft' AND (LOWER(status) != 'scheduled' OR scheduled_at IS NULL OR scheduled_at <= NOW())";
  }
  if (status) {
    sql += ' AND LOWER(status) = LOWER(?)';
    params.push(status);
  }
  if (category) {
    sql += ' AND LOWER(category) = LOWER(?)';
    params.push(category);
  }

  sql += ' ORDER BY sort_order ASC, created_at DESC';

  const rows = await query(sql, params);

  if (isAdmin || (!publishedOnly && !currentUser)) {
    return rows.map(r => formatNovel(r));
  }

  // Filter for authenticated or public reader
  let userAllowedIds = new Set();
  if (userId) {
    const rules = await query(`
      SELECT target_id FROM content_access_rules 
      WHERE target_type IN ('novel', 'audio_novel', 'short_story') 
        AND user_id = ? AND rule_type = 'allow'
        AND (expires_at IS NULL OR expires_at > NOW());
    `, [userId]);
    rules.forEach(r => userAllowedIds.add(String(r.target_id)));
  }

  const filtered = rows.filter(r => {
    if (isAdmin) return true;
    if (userId && Number(r.author_id) === Number(userId)) return true;
    if (!r.is_published || r.status === 'Draft' || r.visibility === 'draft') return false;
    if (String(r.status).toLowerCase() === 'scheduled') {
      if (!r.scheduled_at || !isPastIST(r.scheduled_at)) return false;
    }

    const vis = (r.visibility || 'public').toLowerCase();
    if (vis === 'public') return true;
    if (vis === 'private' || vis === 'admin_only') return false;
    if (vis === 'members' || vis === 'all_members') return Boolean(userId);
    if (vis === 'selected_members') return userAllowedIds.has(String(r.id));
    return true;
  });

  return filtered.map(r => formatNovel(r));
}

/**
 * Get single novel by ID including chapters from the SQL database
 */
export async function getNovelById(id, { includeAll = false, currentUser = null } = {}) {
  await checkAndPublishDueNovels().catch(() => {});
  await checkAndPublishDueEpisodes();

  if (!id) return null;

  let cleanId = String(id).trim();
  try {
    cleanId = decodeURIComponent(cleanId);
  } catch (e) {
    // ignore decode error
  }

  const genSlug = generateNovelSlug(cleanId);
  const row = await queryOne(
    `SELECT * FROM novels 
     WHERE id = ? 
        OR LOWER(id) = LOWER(?) 
        OR title = ? 
        OR (id = ? AND ? != '')
     LIMIT 1`,
    [cleanId, cleanId, cleanId, genSlug, genSlug]
  );
  if (!row) return null;

  const actualNovelId = row.id;

  let chapterSql = `
    SELECT * FROM chapters 
    WHERE novel_id = ? 
  `;
  const params = [actualNovelId];

  if (!includeAll) {
    chapterSql += ` AND status = 'published'`;
  }

  chapterSql += ` ORDER BY sort_order ASC, id ASC;`;

  const chapters = await query(chapterSql, params);
  chapters.sort(compareHierarchicalRows);

  const memberRows = await query(`
    SELECT user_id FROM content_access_rules 
    WHERE target_type IN ('novel', 'audio_novel', 'short_story') 
      AND target_id = ? AND rule_type = 'allow';
  `, [actualNovelId]);
  const selectedMemberIds = memberRows.map(r => r.user_id);

  const writerRows = await query(`
    SELECT writer_id FROM writer_assignments 
    WHERE content_type IN ('novel', 'audio_novel', 'short_story') 
      AND content_id = ? AND status = 'active';
  `, [actualNovelId]);
  const selectedWriterIds = writerRows.map(w => w.writer_id);

  // Rating stats from novel_ratings
  const ratingRow = await queryOne('SELECT AVG(rating) AS avg_rating, COUNT(*) AS count FROM novel_ratings WHERE novel_id = ?;', [actualNovelId]);
  const totalRatings = Number(ratingRow?.count || 0);
  const averageRating = totalRatings > 0 ? Number(ratingRow.avg_rating).toFixed(1) : (row.rating || '5.0');

  // User-specific states (rating, saved, author follow)
  let userRating = null;
  let isSaved = false;
  let isFollowingAuthor = false;

  if (currentUser) {
    const [uRating, uSaved] = await Promise.all([
      queryOne('SELECT rating FROM novel_ratings WHERE user_id = ? AND novel_id = ?;', [currentUser.id, actualNovelId]),
      queryOne('SELECT id FROM saved_novels WHERE user_id = ? AND novel_id = ?;', [currentUser.id, actualNovelId])
    ]);
    if (uRating) userRating = Number(uRating.rating);
    isSaved = Boolean(uSaved);
  }

  // Author details & follow stats
  const authorUserId = row.author_id ? Number(row.author_id) : 2;
  const authorFollowersRow = await queryOne('SELECT COUNT(*) AS count FROM follows WHERE following_id = ?;', [authorUserId]);
  const authorFollowersCount = Number(authorFollowersRow?.count || 0);

  if (currentUser && currentUser.id !== authorUserId) {
    const fCheck = await queryOne('SELECT id FROM follows WHERE follower_id = ? AND following_id = ?;', [currentUser.id, authorUserId]);
    isFollowingAuthor = Boolean(fCheck);
  }

  return formatNovel(row, chapters, {
    selectedMemberIds,
    selectedWriterIds,
    averageRating,
    totalRatings,
    userRating,
    isSaved,
    authorFollowersCount,
    isFollowingAuthor
  });
}

/**
 * Get chapters for a novel
 */
export async function getChaptersByNovel(novelId, { includeAll = false } = {}) {
  await checkAndPublishDueEpisodes();

  if (!novelId) return [];

  let cleanId = String(novelId).trim();
  try {
    cleanId = decodeURIComponent(cleanId);
  } catch (e) {
    // ignore decode error
  }

  const genSlug = generateNovelSlug(cleanId);
  const novelRow = await queryOne(
    `SELECT id FROM novels 
     WHERE id = ? 
        OR LOWER(id) = LOWER(?) 
        OR title = ? 
        OR (id = ? AND ? != '')
     LIMIT 1`,
    [cleanId, cleanId, cleanId, genSlug, genSlug]
  );
  const targetId = novelRow ? novelRow.id : cleanId;

  let sql = `
    SELECT * FROM chapters 
    WHERE novel_id = ? 
  `;
  const params = [targetId];

  if (!includeAll) {
    sql += ` AND status = 'published'`;
  }

  sql += ` ORDER BY sort_order ASC, id ASC;`;

  const chapters = await query(sql, params);
  chapters.sort(compareHierarchicalRows);

  return chapters.map(ch => {
    const numStr = String(ch.episode_number || ch.chapter_num || '1');
    const numericVal = parseFloat(numStr);
    const num = isNaN(numericVal) ? numStr : (numStr.includes('.') ? numStr : Number(numStr));
    return {
      id: ch.id,
      parentId: ch.parent_id || null,
      num: num,
      chapterNum: numStr,
      episodeNumber: numStr,
      title: ch.title,
      titleTa: ch.title_ta || ch.title,
      date: ch.release_date || 'Recent',
      words: ch.word_count || '',
      readTime: ch.read_time || '8 mins',
      status: ch.status || 'published',
      scheduledAt: ch.scheduled_at || null,
      sortOrder: Number(ch.sort_order || 1),
      isAudio: Boolean(ch.is_audio),
      isGuestAllowed: Boolean(ch.is_guest_allowed)
    };
  });
}

export async function getHomepageData() {
  await checkAndPublishDueEpisodes();
  return {
    success: true,
    message: 'Forms is now the main landing page',
    sections: {},
    orderedSections: []
  };
}

/**
 * Update novel details
 */
export async function updateNovel(id, data) {
  const existing = await queryOne('SELECT * FROM novels WHERE id = ?', [id]);
  if (!existing) {
    return { success: false, error: 'Novel not found' };
  }

  const title = data.title !== undefined ? String(data.title).trim() : existing.title;
  if (data.title !== undefined && title.toLowerCase() !== (existing.title || '').toLowerCase()) {
    const titleCollision = await queryOne('SELECT id, title FROM novels WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) AND id != ?', [title, id]);
    if (titleCollision) {
      return { 
        success: false, 
        error: `Another novel titled "${titleCollision.title}" already exists (ID: ${titleCollision.id}). Novel titles must be unique.`,
        code: 'DUPLICATE_NOVEL'
      };
    }
  }

  const author = data.author !== undefined ? String(data.author).trim() : (existing.author || 'Rudhra Prarthana');
  let genre = data.genre !== undefined ? String(data.genre).trim() : existing.genre;
  if (data.newGenre && String(data.newGenre).trim()) {
    genre = String(data.newGenre).trim();
  }
  if (genre && genre !== 'Other') {
    try {
      const gSlug = genre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      await query('INSERT IGNORE INTO novel_genres (name, slug) VALUES (?, ?);', [genre, gSlug]);
    } catch {}
  }

  const contentType = data.contentType || data.content_type || existing.content_type || (existing.is_audio ? 'audio_novel' : 'written_novel');
  const accessPermission = data.accessPermission || data.access_permission || existing.access_permission || 'admin_only';
  const language = data.language !== undefined ? String(data.language).trim() : (existing.language || 'Tamil');
  const status = data.status !== undefined ? String(data.status).trim() : existing.status;

  let scheduledAt = existing.scheduled_at;
  if (data.scheduledAt !== undefined) {
    scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    if (scheduledAt && isNaN(scheduledAt.getTime())) scheduledAt = null;
  }

  let category = data.category !== undefined ? String(data.category).trim() : existing.category;
  let isAudio = existing.is_audio;
  let audioAvailable = existing.audio_available;
  let link = existing.link;
  let audioVoice = data.audioVoice !== undefined ? data.audioVoice : existing.audio_voice;
  let audioDuration = data.duration !== undefined ? data.duration : (data.audioDuration || existing.audio_duration);
  let youtubeUrl = data.youtubeUrl !== undefined ? data.youtubeUrl : existing.youtube_url;

  if (contentType === 'audio_novel') {
    isAudio = 1;
    audioAvailable = 1;
    category = 'Audio Novels';
    link = `#audio?novel=${encodeURIComponent(id)}`;
    if (!audioVoice) audioVoice = author;
  } else if (contentType === 'short_story') {
    category = 'Short Stories';
    link = `#story?id=${encodeURIComponent(id)}`;
  } else if (contentType === 'written_novel') {
    link = `#novel?id=${encodeURIComponent(id)}`;
    if (!category || category === 'Other') {
      category = (status === 'Completed') ? 'Completed Novels' : 'Ongoing Novels';
    }
  }

  let cover = existing.cover;
  if (data.cover !== undefined) {
    const rawCover = String(data.cover || '').trim();
    if (!rawCover || rawCover === '/default-cover.jpg') {
      if (existing.cover && existing.cover !== '/default-cover.jpg') {
        deleteLocalUploadFile(existing.cover);
      }
      cover = '/default-cover.jpg';
    } else if (rawCover.startsWith('data:image/') || rawCover.startsWith('data:;base64,') || /^[A-Za-z0-9+/=]{100,}$/.test(rawCover)) {
      cover = saveBase64Image(rawCover, 'covers', `cover-${id}`, existing.cover);
    } else {
      if (existing.cover && existing.cover !== rawCover) {
        deleteLocalUploadFile(existing.cover);
      }
      cover = rawCover;
    }
  }

  const chaptersCount = data.chaptersCount !== undefined ? parseInt(data.chaptersCount, 10) : existing.chapters_count;
  const views = data.views !== undefined ? String(data.views).trim() : existing.views;
  const rating = data.rating !== undefined ? String(data.rating).trim() : existing.rating;
  const updatedDate = data.updatedDate !== undefined ? String(data.updatedDate).trim() : existing.updated_date;
  const featured = 0; // Homepage Placement removed
  const continueReading = data.continueReading !== undefined ? (data.continueReading ? 1 : 0) : existing.continue_reading;
  const trendingRank = data.trendingRank !== undefined ? parseInt(data.trendingRank, 10) : existing.trending_rank;
  const sortOrder = data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : existing.sort_order;
  let isPublished = data.isPublished !== undefined ? (data.isPublished ? 1 : 0) : existing.is_published;
  if (status === 'Scheduled') {
    isPublished = 0;
  }
  const visibility = data.visibility !== undefined ? String(data.visibility).trim() : existing.visibility;
  const badge = data.badge !== undefined ? String(data.badge).trim() : (existing.badge || status);
  const description = data.description !== undefined ? String(data.description).trim() : (existing.description || '');

  await query(`
    UPDATE novels SET
      title = ?, author = ?, genre = ?, category = ?, status = ?, badge = ?, cover = ?,
      description = ?, chapters_count = ?, views = ?, rating = ?, updated_date = ?,
      featured = ?, continue_reading = ?, is_audio = ?, audio_available = ?,
      audio_duration = ?, audio_voice = ?, youtube_url = ?, trending_rank = ?,
      sort_order = ?, is_published = ?, visibility = ?, link = ?,
      content_type = ?, access_permission = ?, language = ?, scheduled_at = ?
    WHERE id = ?;
  `, [
    title, author, genre, category, status, badge, cover,
    description, chaptersCount, views, rating, updatedDate,
    featured, continueReading, isAudio, audioAvailable,
    audioDuration, audioVoice, youtubeUrl, trendingRank,
    sortOrder, isPublished, visibility, link,
    contentType, accessPermission, language, scheduledAt,
    id
  ]);

  // Persist selected member IDs if visibility is selected_members
  if (data.selectedMemberIds !== undefined) {
    await query(`DELETE FROM content_access_rules WHERE target_type = 'novel' AND target_id = ? AND rule_type = 'allow';`, [id]);
    if (visibility === 'selected_members' && Array.isArray(data.selectedMemberIds)) {
      for (const memId of data.selectedMemberIds) {
        const uId = parseInt(memId, 10);
        if (uId) {
          await query(`
            INSERT INTO content_access_rules (target_type, target_id, user_id, rule_type, reason, created_by_admin_id)
            VALUES ('novel', ?, ?, 'allow', 'Selected member view access', ?);
          `, [id, uId, existing.author_id || 2]);
        }
      }
    }
  }

  // Persist selected writers in writer_assignments if accessPermission is selected_writers / assigned_writers
  if (data.selectedWriterIds !== undefined) {
    if ((accessPermission === 'selected_writers' || accessPermission === 'assigned_writers') && Array.isArray(data.selectedWriterIds)) {
      const allowedWriterIds = new Set(data.selectedWriterIds.map(w => parseInt(w, 10)).filter(Boolean));
      // Mark revoked for unselected
      const existingAssigns = await query(`SELECT id, writer_id FROM writer_assignments WHERE content_type = 'novel' AND content_id = ?;`, [id]);
      for (const ea of existingAssigns) {
        if (!allowedWriterIds.has(ea.writer_id)) {
          await query(`UPDATE writer_assignments SET status = 'revoked' WHERE id = ?;`, [ea.id]);
        }
      }
      for (const wId of allowedWriterIds) {
        const ea = existingAssigns.find(a => a.writer_id === wId);
        if (!ea) {
          await query(`
            INSERT INTO writer_assignments (writer_id, content_type, content_id, title, status, assigned_by)
            VALUES (?, 'novel', ?, ?, 'active', ?);
          `, [wId, id, title, existing.author_id || 2]);
        } else {
          await query(`UPDATE writer_assignments SET status = 'active' WHERE id = ?;`, [ea.id]);
        }
      }
    }
  }

  // If novel title changed, cascade update to chapters that used default generated title "${existing.title} (...)"
  if (title && existing.title && title !== existing.title) {
    try {
      const relatedChapters = await query('SELECT id, chapter_num, episode_number, title FROM chapters WHERE novel_id = ?;', [id]);
      for (const ch of relatedChapters) {
        const chNum = ch.episode_number || ch.chapter_num;
        const expectedOldTitle = `${existing.title} (${chNum})`;
        if (ch.title === expectedOldTitle) {
          const newChTitle = `${title} (${chNum})`;
          await query('UPDATE chapters SET title = ?, title_ta = ? WHERE id = ?;', [newChTitle, newChTitle, ch.id]);
        }
      }
    } catch (e) {
      console.warn('Could not cascade novel title update to chapters:', e.message);
    }
  }

  return { success: true, novel: await getNovelById(id, { includeAll: true }) };
}

const TAMIL_MAP = {
  // Independent vowels
  'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
  'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oa', 'ஔ': 'au', 'ஃ': 'akh',
  // Consonants
  'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'ny', 'ட': 't', 'ண': 'n',
  'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
  'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
  'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h', 'க்ஷ': 'ksh'
};

const TAMIL_VOWEL_SIGNS = {
  'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
  'ெ': 'e', 'ே': 'ae', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oa', 'ௌ': 'au'
};

/**
 * Transliterates Tamil script into readable phonetic Latin characters
 */
export function transliterateTamil(text) {
  if (!text || typeof text !== 'string') return '';
  let res = '';
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    if (TAMIL_MAP[ch]) {
      if (['அ','ஆ','இ','ஈ','உ','ஊ','எ','ஏ','ஐ','ஒ','ஓ','ஔ','ஃ'].includes(ch)) {
        res += TAMIL_MAP[ch];
      } else {
        const base = TAMIL_MAP[ch];
        if (next === '்') {
          res += base;
          i++;
        } else if (next && TAMIL_VOWEL_SIGNS[next]) {
          res += base + TAMIL_VOWEL_SIGNS[next];
          i++;
        } else {
          res += base + 'a';
        }
      }
    } else if (TAMIL_VOWEL_SIGNS[ch]) {
      res += TAMIL_VOWEL_SIGNS[ch];
    } else if (ch === '்') {
      // stray virama ignored
    } else {
      res += ch;
    }
  }
  return res;
}

/**
 * Automatically generate a clean, URL-safe slug from a novel title.
 * Handles English, Tamil, and Unicode titles reliably.
 */
export function generateNovelSlug(title) {
  if (!title || typeof title !== 'string') return '';
  const transliterated = transliterateTamil(title.trim());
  let slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (!slug) {
    slug = title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .replace(/-{2,}/g, '-');
  }
  if (!slug) {
    slug = 'novel-' + Date.now().toString(36);
  }
  return slug;
}

/**
 * Create a new novel with automatic backend slug generation & collision resolution
 */
export async function createNovel(data) {
  const cleanTitle = (data.title || '').trim();

  if (!cleanTitle) {
    return { success: false, error: 'Novel title is required.' };
  }

  // If a novel with this exact title already exists, return it cleanly so editing/saving continues seamlessly
  const existingByTitle = await queryOne('SELECT * FROM novels WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))', [cleanTitle]);
  if (existingByTitle) {
    return { 
      success: true, 
      message: `Existing novel "${existingByTitle.title}" reused.`, 
      novel: existingByTitle,
      id: existingByTitle.id,
      isExisting: true 
    };
  }

  // Auto-generate slug from title (or validate/sanitize any explicitly provided slug)
  let baseSlug = (data.slug || data.id || '').trim();
  if (!baseSlug) {
    baseSlug = generateNovelSlug(cleanTitle);
  } else {
    baseSlug = generateNovelSlug(baseSlug);
  }

  // Ensure unique slug that does not collide with any existing novel
  let cleanId = baseSlug;
  let counter = 1;
  while (await queryOne('SELECT id FROM novels WHERE id = ?', [cleanId])) {
    counter++;
    cleanId = `${baseSlug}-${counter}`;
  }

  const status = data.status || 'Draft';
  let isPublished = 0;
  if (status === 'Scheduled') {
    isPublished = 0;
  } else if (data.isPublished !== undefined) {
    isPublished = data.isPublished ? 1 : 0;
  } else if (status === 'Draft' || data.visibility === 'draft') {
    isPublished = 0;
  } else {
    isPublished = 1;
  }
  const visibility = data.visibility || (isPublished ? 'public' : (status === 'Scheduled' ? 'public' : 'draft'));
  const authorId = data.authorId || data.author_id || 2;
  const author = (data.author || 'Rudhra Prarthana').trim();
  const contentType = (data.contentType || data.content_type || 'written_novel').trim();
  const accessPermission = (data.accessPermission || data.access_permission || 'admin_only').trim();
  const language = (data.language || 'Tamil').trim();

  let scheduledAt = null;
  if (status === 'Scheduled' || data.scheduledAt || data.scheduled_at) {
    scheduledAt = parseISTDateTime(data.scheduledAt || data.scheduled_at);
  }

  // Process genre and save into novel_genres if new
  let genre = (data.genre || 'Novel').trim();
  if (data.newGenre && String(data.newGenre).trim()) {
    genre = String(data.newGenre).trim();
  }
  if (genre && genre !== 'Other') {
    try {
      const gSlug = genre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      await query('INSERT IGNORE INTO novel_genres (name, slug) VALUES (?, ?);', [genre, gSlug]);
    } catch {}
  }

  // Content type specific field adjustments & routing
  let category = data.category;
  let isAudio = 0;
  let audioAvailable = 0;
  let badge = status;
  let link = `#novel?id=${encodeURIComponent(cleanId)}`;
  let audioVoice = data.audioVoice || null;
  let audioDuration = data.duration || data.audioDuration || null;
  let youtubeUrl = data.youtubeUrl || null;

  if (contentType === 'audio_novel') {
    isAudio = 1;
    audioAvailable = 1;
    category = 'Audio Novels';
    badge = 'Audio';
    link = `#audio?novel=${encodeURIComponent(cleanId)}`;
    audioVoice = data.audioVoice || author;
  } else if (contentType === 'short_story') {
    category = 'Short Stories';
    badge = 'Short Story';
    link = `#story?id=${encodeURIComponent(cleanId)}`;
  } else if (contentType === 'written_novel') {
    if (!category || category === 'Other') {
      category = (status === 'Completed') ? 'Completed Novels' : 'Ongoing Novels';
    }
  } else {
    // Custom content category
    const customCatName = (data.customCategoryName || data.category || contentType).trim();
    category = customCatName;
    badge = customCatName;
    try {
      const cSlug = customCatName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      await query(`
        INSERT IGNORE INTO forum_categories (id, title, icon, sort_order, is_active, status, visibility, is_disabled)
        VALUES (?, ?, '📖', 99, 1, 'published', 'public', 0);
      `, [cSlug, customCatName]);
    } catch {}
  }

  let cover = data.cover && String(data.cover).trim().startsWith('data:image/')
    ? saveBase64Image(String(data.cover).trim(), 'covers', `cover-${cleanId}`)
    : (data.cover || '/default-cover.jpg');

  await query(`
    INSERT INTO novels (
      id, title, author, genre, category, status, badge, cover,
      description, chapters_count, views, rating, updated_date,
      featured, continue_reading, is_audio, audio_available,
      audio_duration, audio_voice, youtube_url, trending_rank,
      sort_order, is_published, visibility, link, author_id,
      content_type, access_permission, language, scheduled_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    );
  `, [
    cleanId,
    cleanTitle,
    author,
    genre,
    category,
    status,
    badge,
    cover,
    data.description || '',
    data.chaptersCount ? parseInt(data.chaptersCount, 10) : 0,
    data.views || '0',
    data.rating || '5.0',
    data.updatedDate || 'Just added',
    0, // Homepage placement removed
    0,
    isAudio,
    audioAvailable,
    audioDuration,
    audioVoice,
    youtubeUrl,
    0,
    data.sortOrder ? parseInt(data.sortOrder, 10) : 0,
    isPublished,
    visibility,
    link,
    authorId,
    contentType,
    accessPermission,
    language,
    scheduledAt
  ]);

  // If short story, also sync record into short_stories table for unified reader support
  if (contentType === 'short_story') {
    try {
      const storyContent = data.storyContent || data.content || data.description || cleanTitle;
      const plainText = storyContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
      const readTime = `${Math.max(1, Math.ceil(words / 200))} mins`;
      await query(`
        INSERT INTO short_stories (
          slug, title, title_ta, author, genre, description, cover_image, content,
          word_count, read_time, status, is_disabled, visibility, scheduled_at, timezone,
          views_count, comments_count, sort_order, published_at, created_at, updated_at, author_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'Asia/Kolkata', 0, 0, 1, NOW(), NOW(), NOW(), ?)
        ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content);
      `, [
        cleanId,
        cleanTitle,
        cleanTitle,
        author,
        genre,
        data.description || '',
        cover,
        storyContent,
        words,
        readTime,
        status === 'Draft' ? 'draft' : (status === 'Scheduled' ? 'scheduled' : 'published'),
        visibility,
        scheduledAt,
        authorId
      ]);
    } catch (e) {
      console.warn('Could not mirror short story record:', e.message);
    }
  }

  // Persist selected member IDs in content_access_rules if visibility is selected_members
  if (visibility === 'selected_members' && Array.isArray(data.selectedMemberIds)) {
    await query(`DELETE FROM content_access_rules WHERE target_type = 'novel' AND target_id = ? AND rule_type = 'allow';`, [cleanId]);
    for (const memId of data.selectedMemberIds) {
      const uId = parseInt(memId, 10);
      if (uId) {
        await query(`
          INSERT INTO content_access_rules (target_type, target_id, user_id, rule_type, reason, created_by_admin_id)
          VALUES ('novel', ?, ?, 'allow', 'Selected member view access', ?);
        `, [cleanId, uId, authorId || 2]);
      }
    }
  }

  // Persist selected writers in writer_assignments if access_permission is selected_writers or assigned_writers
  if ((accessPermission === 'selected_writers' || accessPermission === 'assigned_writers') && Array.isArray(data.selectedWriterIds)) {
    for (const wrId of data.selectedWriterIds) {
      const wId = parseInt(wrId, 10);
      if (wId) {
        const existingAssign = await queryOne(`
          SELECT id FROM writer_assignments 
          WHERE writer_id = ? AND content_type = 'novel' AND content_id = ? AND status = 'active';
        `, [wId, cleanId]);
        if (!existingAssign) {
          await query(`
            INSERT INTO writer_assignments (writer_id, content_type, content_id, title, status, assigned_by)
            VALUES (?, 'novel', ?, ?, 'active', ?);
          `, [wId, cleanId, cleanTitle, authorId || 2]);
        }
      }
    }
  }

  const createdNovel = await getNovelById(cleanId, { includeAll: true });
  const contentLink = `#novel?id=${encodeURIComponent(cleanId)}`;

  // Notify followers of author upon novel publication
  if (isPublished && status !== 'Draft' && status !== 'draft') {
    try {
      const recipients = await query(`
        SELECT DISTINCT u.id AS user_id
        FROM users u
        LEFT JOIN notification_preferences np ON u.id = np.user_id
        WHERE u.id != ?
          AND u.status = 'active'
          AND (np.notify_chapters IS NULL OR np.notify_chapters = 1);
      `, [authorId || 2]);
      for (const r of recipients) {
        await createNotification({
          userId: r.user_id,
          actorId: authorId || 2,
          type: 'novel_created',
          title: 'New Novel Released!',
          message: `${author} has released a new novel: "${cleanTitle}".`,
          link: contentLink,
          entityType: 'novel',
          entityId: cleanId
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('[Novel Created Notification Error]:', err.message);
    }
  }

  return { success: true, novel: createdNovel, contentLink, id: cleanId };
}

/**
 * Delete novel by ID
 */
export async function deleteNovel(id, deletedBy = 2, deletedByName = 'Admin') {
  const existing = await queryOne('SELECT * FROM novels WHERE id = ?', [id]);
  if (!existing) {
    return { success: false, error: 'Novel not found' };
  }

  const chapters = await query('SELECT * FROM chapters WHERE novel_id = ?;', [id]);
  const ratings = await query('SELECT * FROM novel_ratings WHERE novel_id = ?;', [id]);

  try {
    await moveToTrash({
      itemType: 'novel',
      itemId: existing.id,
      title: existing.title,
      ownerId: existing.author_id,
      deletedBy,
      deletedByName,
      originalLocation: 'Novels',
      itemData: {
        novel: existing,
        chapters: chapters || [],
        ratings: ratings || []
      }
    });
  } catch (err) {
    console.warn('Could not move novel to trash:', err.message);
  }

  // Clean up associated rules and assignments and chapters so it is hidden from live site
  try {
    await query("DELETE FROM content_access_rules WHERE target_type = 'novel' AND target_id = ?;", [id]);
    await query("DELETE FROM writer_assignments WHERE content_type = 'novel' AND content_id = ?;", [id]);
    await query('DELETE FROM chapters WHERE novel_id = ?;', [id]);
  } catch {}

  await query('DELETE FROM novels WHERE id = ?;', [id]);
  return { success: true, message: 'Novel moved to trash.' };
}
