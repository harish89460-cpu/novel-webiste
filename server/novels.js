// Novel Content SQL Layer for Rudhra Prarthana Novels
// Dynamic MySQL Persistence with Relations to Chapters and Scheduler Integration

import { query, queryOne } from './db.js';
import { checkAndPublishDueEpisodes, compareHierarchicalNumbers } from './episodes.js';
import { saveBase64Image } from './auth.js';

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
export function formatNovel(row, chapters = []) {
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
    chaptersCount: row.chapters_count !== null && row.chapters_count !== undefined 
      ? Number(row.chapters_count) 
      : (chapters.filter(c => !c.parent_id && !c.parentId).length || chapters.length || undefined),
    views: row.views !== null && row.views !== undefined && String(row.views).trim() !== '' ? String(row.views) : undefined,
    rating: row.rating !== null && row.rating !== undefined && String(row.rating).trim() !== '' ? String(row.rating) : undefined,
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
 * Get all novels with optional filtering
 */
export async function getAllNovels({ status, category, publishedOnly = false } = {}) {
  await checkAndPublishDueEpisodes();

  let sql = 'SELECT * FROM novels WHERE 1=1';
  const params = [];

  if (publishedOnly) {
    sql += " AND is_published = 1 AND visibility = 'public'";
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
  return rows.map(r => formatNovel(r));
}

/**
 * Get single novel by ID including chapters from the SQL database
 */
export async function getNovelById(id, { includeAll = false } = {}) {
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
  return formatNovel(row, chapters);
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
  const genre = data.genre !== undefined ? String(data.genre).trim() : existing.genre;
  const category = data.category !== undefined ? String(data.category).trim() : existing.category;
  const status = data.status !== undefined ? String(data.status).trim() : existing.status;
  let cover = existing.cover;
  if (data.cover !== undefined) {
    const rawCover = String(data.cover || '').trim();
    cover = rawCover.startsWith('data:image/')
      ? saveBase64Image(rawCover, 'covers', `cover-${id}`)
      : rawCover;
  }
  const chaptersCount = data.chaptersCount !== undefined ? parseInt(data.chaptersCount, 10) : existing.chapters_count;
  const views = data.views !== undefined ? String(data.views).trim() : existing.views;
  const rating = data.rating !== undefined ? String(data.rating).trim() : existing.rating;
  const updatedDate = data.updatedDate !== undefined ? String(data.updatedDate).trim() : existing.updated_date;
  const featured = data.featured !== undefined ? (data.featured ? 1 : 0) : existing.featured;
  const continueReading = data.continueReading !== undefined ? (data.continueReading ? 1 : 0) : existing.continue_reading;
  const isAudio = data.isAudio !== undefined ? (data.isAudio ? 1 : 0) : existing.is_audio;
  const audioAvailable = data.audioAvailable !== undefined ? (data.audioAvailable ? 1 : 0) : existing.audio_available;
  const audioDuration = data.duration !== undefined ? data.duration : existing.audio_duration;
  const audioVoice = data.audioVoice !== undefined ? data.audioVoice : existing.audio_voice;
  const youtubeUrl = data.youtubeUrl !== undefined ? data.youtubeUrl : existing.youtube_url;
  const trendingRank = data.trendingRank !== undefined ? parseInt(data.trendingRank, 10) : existing.trending_rank;
  const sortOrder = data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : existing.sort_order;
  const isPublished = data.isPublished !== undefined ? (data.isPublished ? 1 : 0) : existing.is_published;
  const visibility = data.visibility !== undefined ? String(data.visibility).trim() : existing.visibility;
  const badge = data.badge !== undefined ? String(data.badge).trim() : (existing.badge || status);
  const description = data.description !== undefined ? String(data.description).trim() : (existing.description || '');

  await query(`
    UPDATE novels SET
      title = ?, author = ?, genre = ?, category = ?, status = ?, badge = ?, cover = ?,
      description = ?, chapters_count = ?, views = ?, rating = ?, updated_date = ?,
      featured = ?, continue_reading = ?, is_audio = ?, audio_available = ?,
      audio_duration = ?, audio_voice = ?, youtube_url = ?, trending_rank = ?,
      sort_order = ?, is_published = ?, visibility = ?
    WHERE id = ?;
  `, [
    title, author, genre, category, status, badge, cover,
    description, chaptersCount, views, rating, updatedDate,
    featured, continueReading, isAudio, audioAvailable,
    audioDuration, audioVoice, youtubeUrl, trendingRank,
    sortOrder, isPublished, visibility, id
  ]);

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

  // Prevent duplicate submissions and repeated novel records
  const existingByTitle = await queryOne('SELECT id, title FROM novels WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))', [cleanTitle]);
  if (existingByTitle) {
    return { 
      success: false, 
      error: `A novel titled "${existingByTitle.title}" already exists (ID: ${existingByTitle.id}). Duplicate novel creation is prevented.`, 
      code: 'DUPLICATE_NOVEL',
      duplicateId: existingByTitle.id 
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

  const isPublished = data.isPublished !== undefined ? (data.isPublished ? 1 : 0) : 1;
  const visibility = data.visibility || (isPublished ? 'public' : 'draft');
  const status = data.status || 'Ongoing';
  const authorId = data.authorId || data.author_id || 2;

  await query(`
    INSERT INTO novels (
      id, title, author, genre, category, status, badge, cover,
      description, chapters_count, views, rating, updated_date,
      featured, continue_reading, is_audio, audio_available,
      audio_duration, audio_voice, youtube_url, trending_rank,
      sort_order, is_published, visibility, link, author_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    );
  `, [
    cleanId,
    cleanTitle,
    data.author || 'Rudhra Prarthana',
    data.genre || 'Novel',
    data.category || `${status} Novels`,
    status,
    data.badge || status,
    data.cover && String(data.cover).trim().startsWith('data:image/')
      ? saveBase64Image(String(data.cover).trim(), 'covers', `cover-${cleanId}`)
      : (data.cover || '/default-cover.jpg'),
    data.description || '',
    data.chaptersCount ? parseInt(data.chaptersCount, 10) : 0,
    data.views || '0',
    data.rating || '5.0',
    data.updatedDate || 'Just added',
    data.featured ? 1 : 0,
    data.continueReading ? 1 : 0,
    data.isAudio ? 1 : 0,
    data.audioAvailable ? 1 : 0,
    data.duration || null,
    data.audioVoice || null,
    data.youtubeUrl || null,
    data.trendingRank ? parseInt(data.trendingRank, 10) : 0,
    data.sortOrder ? parseInt(data.sortOrder, 10) : 0,
    isPublished,
    visibility,
    data.link || `#novel?id=${encodeURIComponent(cleanId)}`,
    authorId
  ]);

  return { success: true, novel: await getNovelById(cleanId, { includeAll: true }) };
}

/**
 * Delete novel by ID
 */
export async function deleteNovel(id) {
  const existing = await queryOne('SELECT id FROM novels WHERE id = ?', [id]);
  if (!existing) {
    return { success: false, error: 'Novel not found' };
  }

  await query('DELETE FROM novels WHERE id = ?;', [id]);
  return { success: true };
}
