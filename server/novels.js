// Novel Content SQL Layer for Rudhra Prarthana Novels
// Dynamic MySQL Persistence with Relations to Chapters and Scheduler Integration

import { query, queryOne } from './db.js';
import { checkAndPublishDueEpisodes } from './episodes.js';
import { saveBase64Image } from './auth.js';

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
      : (chapters.length || undefined),
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

  chapterSql += ` ORDER BY sort_order ASC, CAST(chapter_num AS DECIMAL(10,2)) ASC, id ASC;`;

  const chapters = await query(chapterSql, params);
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

  sql += ` ORDER BY sort_order ASC, CAST(chapter_num AS DECIMAL(10,2)) ASC, id ASC;`;

  const chapters = await query(sql, params);

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

/**
 * Get homepage data with dynamically configured sections, custom collections, and priority ordering
 */
export async function getHomepageData(currentUser = null) {
  await checkAndPublishDueEpisodes();

  // 1. Fetch only visible sections ordered by sort_order
  const visibleSections = await query(`
    SELECT * FROM homepage_sections 
    WHERE is_visible = 1 
    ORDER BY sort_order ASC, section_key ASC;
  `);

  // 2. Fetch all sections for backward compatibility config map
  const allSectionRows = await query('SELECT * FROM homepage_sections ORDER BY sort_order ASC');
  const sectionsConfig = {};
  for (const s of allSectionRows) {
    sectionsConfig[s.section_key] = {
      title: s.title,
      subtitle: s.subtitle,
      name: s.name,
      sectionType: s.section_type,
      visible: Boolean(s.is_visible),
      sortOrder: Number(s.sort_order || 0),
      contentLimit: Number(s.content_limit || 6),
      viewAllLink: s.view_all_link,
      displayStyle: s.display_style || 'grid'
    };
  }

  const orderedSections = [];

  for (const s of visibleSections) {
    const limit = Number(s.content_limit) > 0 ? Number(s.content_limit) : 6;
    let items = [];

    switch (s.section_type) {
      case 'featured': {
        const rows = await query(`
          SELECT * FROM novels 
          WHERE is_published = 1 AND visibility = 'public' AND featured = 1 AND LOWER(status) = 'ongoing'
          ORDER BY sort_order ASC, id ASC
          LIMIT ?
        `, [limit]);
        items = rows.map(r => formatNovel(r));
        break;
      }

      case 'continue_reading': {
        if (currentUser && currentUser.id) {
          const userRows = await query(`
            SELECT p.chapter_num AS last_read_chapter, p.progress_percentage, p.last_read_at,
                   n.*, c.title AS chapter_title
            FROM reading_progress p
            JOIN novels n ON p.novel_id = n.id
            LEFT JOIN chapters c ON p.novel_id = c.novel_id AND p.chapter_num = c.chapter_num
            WHERE p.user_id = ? AND n.is_published = 1 AND n.visibility = 'public'
            ORDER BY p.last_read_at DESC
            LIMIT ?
          `, [currentUser.id, limit]);

          if (userRows.length > 0) {
            items = userRows.map(r => {
              const formatted = formatNovel(r);
              formatted.lastReadChapter = r.last_read_chapter;
              formatted.chapterTitle = r.chapter_title;
              formatted.progressPercentage = r.progress_percentage;
              formatted.lastReadAt = r.last_read_at;
              return formatted;
            });
          }
        }
        
        // Fallback to continue_reading / ongoing novels if not logged in or no personal progress
        if (items.length === 0) {
          const rows = await query(`
            SELECT * FROM novels 
            WHERE is_published = 1 AND visibility = 'public' AND (continue_reading = 1 OR LOWER(status) = 'ongoing')
            ORDER BY sort_order ASC, id ASC
            LIMIT ?
          `, [limit]);
          items = rows.map(r => formatNovel(r));
        }
        break;
      }

      case 'audio': {
        try {
          const audioNovelsRows = await query(`
            SELECT an.*, n.title AS linked_novel_title, n.author AS novel_author
            FROM audio_novels an
            LEFT JOIN novels n ON an.novel_id = n.id
            WHERE an.status = 'published'
              AND (an.novel_id IS NULL OR (n.is_published = 1 AND n.visibility = 'public'))
            ORDER BY an.sort_order ASC, an.created_at DESC, an.id DESC
            LIMIT ?
          `, [limit]);
          items = audioNovelsRows.map(r => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            description: r.description,
            cover: r.cover || '/default-cover.jpg',
            sourceType: r.source_type,
            youtubeUrl: r.youtube_url,
            youtubeVideoId: r.youtube_video_id,
            audioFileUrl: r.audio_file_url,
            audioDuration: r.audio_duration,
            episodeNumber: r.episode_number,
            partNumber: r.part_number,
            language: r.language,
            novelId: r.novel_id,
            novelTitle: r.linked_novel_title,
            author: r.novel_author || 'Rudhra Prarthana',
            audioVoice: 'Rudhra Prarthana',
            status: r.status,
            views: r.views || 0,
            createdAt: r.created_at
          }));
        } catch (err) {
          console.error('[Homepage] Failed to query audio_novels:', err.message);
        }

        if (items.length === 0) {
          const fallbackRows = await query(`
            SELECT * FROM novels 
            WHERE is_published = 1 AND visibility = 'public' AND (is_audio = 1 OR audio_available = 1)
            ORDER BY sort_order ASC, id ASC
            LIMIT ?
          `, [limit]);
          items = fallbackRows.map(r => formatNovel(r));
        }
        break;
      }

      case 'trending': {
        const rows = await query(`
          SELECT * FROM novels 
          WHERE is_published = 1 AND visibility = 'public' AND trending_rank > 0
          ORDER BY trending_rank ASC, sort_order ASC
          LIMIT ?
        `, [limit]);
        items = rows.map(r => formatNovel(r));
        break;
      }

      case 'completed': {
        const rows = await query(`
          SELECT * FROM novels 
          WHERE is_published = 1 AND visibility = 'public' AND LOWER(status) = 'completed'
          ORDER BY sort_order ASC, id ASC
          LIMIT ?
        `, [limit]);
        items = rows.map(r => formatNovel(r));
        break;
      }

      case 'latest': {
        const rows = await query(`
          SELECT * FROM novels 
          WHERE is_published = 1 AND visibility = 'public'
          ORDER BY updated_at DESC, id DESC
          LIMIT ?
        `, [limit]);
        items = rows.map(r => formatNovel(r));
        break;
      }

      case 'forum': {
        try {
          const topicRows = await query(`
            SELECT t.id, t.title, t.category_id, t.category_title,
                   t.views_count AS views, t.replies_count, t.created_at, t.updated_at,
                   COALESCE(ap.display_name, au.username, 'Reader') AS author,
                   COALESCE(ap.avatar, '/profile.png') AS author_avatar
            FROM forum_topics t
            LEFT JOIN users au ON t.author_id = au.id
            LEFT JOIN profiles ap ON au.id = ap.user_id
            WHERE t.is_published = 1 AND t.visibility = 'public'
            ORDER BY t.created_at DESC
            LIMIT ?
          `, [limit]);
          items = topicRows.map(t => ({
            id: t.id,
            title: t.title,
            views: t.views || 0,
            repliesCount: t.replies_count || 0,
            date: t.created_at,
            author: t.author || 'Reader',
            authorAvatar: t.author_avatar || '/profile.png'
          }));
        } catch (e) {
          console.warn('[Homepage] Forum topics query error:', e.message);
        }
        break;
      }

      case 'curated': {
        const rows = await query(`
          SELECT n.*, hsi.sort_order AS item_sort_order
          FROM homepage_section_items hsi
          JOIN novels n ON hsi.novel_id = n.id
          WHERE hsi.section_key = ? AND n.is_published = 1 AND n.visibility = 'public'
          ORDER BY hsi.sort_order ASC, hsi.id ASC
          LIMIT ?
        `, [s.section_key, limit]);
        items = rows.map(r => formatNovel(r));
        break;
      }

      case 'author_spotlight': {
        items = [{
          name: 'Rudhra Prarthana',
          role: 'Author & Storyteller',
          avatar: '/profile.png',
          bio: 'Heart-touching family dramas, captivating romance, and a warm community for passionate Tamil novel readers.',
          links: [
            { label: 'Pratilipi', url: 'https://tamil.pratilipi.com/user/rudhra-prarthana-605774cq1w' },
            { label: 'YouTube', url: 'https://www.youtube.com/@rudhraprarthanaaudionovels' }
          ]
        }];
        break;
      }

      case 'community_cta': {
        items = [{
          title: s.title || 'Join Our Reader Community',
          subtitle: s.subtitle || 'Connect & Share',
          desc: 'Discuss chapter twists, connect with author Rudhra Prarthana, and get early notifications for new episode releases.'
        }];
        break;
      }

      default: {
        const rows = await query(`
          SELECT * FROM novels 
          WHERE is_published = 1 AND visibility = 'public'
          ORDER BY sort_order ASC, id ASC
          LIMIT ?
        `, [limit]);
        items = rows.map(r => formatNovel(r));
        break;
      }
    }

    orderedSections.push({
      sectionKey: s.section_key,
      name: s.name || s.title,
      title: s.title,
      subtitle: s.subtitle,
      sectionType: s.section_type,
      isSystem: Boolean(s.is_system),
      isVisible: Boolean(s.is_visible),
      visible: Boolean(s.is_visible),
      sortOrder: Number(s.sort_order || 0),
      contentLimit: limit,
      viewAllLink: s.view_all_link,
      displayStyle: s.display_style || 'grid',
      settings: s.settings ? (typeof s.settings === 'string' ? JSON.parse(s.settings) : s.settings) : null,
      novels: items,
      items: items
    });
  }

  // Backward compatibility object for any components still accessing sections directly
  const legacySections = {
    featured: {
      title: sectionsConfig.featured?.title || 'Featured Ongoing Novels',
      subtitle: sectionsConfig.featured?.subtitle || 'Currently Releasing',
      visible: sectionsConfig.featured?.visible !== false,
      sortOrder: sectionsConfig.featured?.sortOrder || 1,
      novels: orderedSections.find(s => s.sectionKey === 'featured')?.novels || []
    },
    continueReading: {
      title: sectionsConfig.continue_reading?.title || 'Continue Reading',
      subtitle: sectionsConfig.continue_reading?.subtitle || 'Pick Up Where You Left Off',
      visible: sectionsConfig.continue_reading?.visible !== false,
      sortOrder: sectionsConfig.continue_reading?.sortOrder || 2,
      novels: orderedSections.find(s => s.sectionKey === 'continue_reading')?.novels || []
    },
    audio: {
      title: sectionsConfig.audio?.title || 'Audio Novels',
      subtitle: sectionsConfig.audio?.subtitle || 'Listen & Enjoy',
      visible: sectionsConfig.audio?.visible !== false,
      sortOrder: sectionsConfig.audio?.sortOrder || 3,
      novels: orderedSections.find(s => s.sectionKey === 'audio')?.novels || []
    },
    trending: {
      title: sectionsConfig.trending?.title || 'Trending Novels',
      subtitle: sectionsConfig.trending?.subtitle || 'Reader Favorites',
      visible: sectionsConfig.trending?.visible !== false,
      sortOrder: sectionsConfig.trending?.sortOrder || 4,
      novels: orderedSections.find(s => s.sectionKey === 'trending')?.novels || []
    },
    completed: {
      title: sectionsConfig.completed?.title || 'Completed Novels',
      subtitle: sectionsConfig.completed?.subtitle || 'Completed Works',
      visible: sectionsConfig.completed?.visible !== false,
      sortOrder: sectionsConfig.completed?.sortOrder || 5,
      novels: orderedSections.find(s => s.sectionKey === 'completed')?.novels || []
    }
  };

  return {
    success: true,
    orderedSections,
    sectionsConfig,
    sections: legacySections
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

/**
 * Update homepage section visibility and ordering
 */
export async function updateSectionVisibility(sectionKey, data) {
  const existing = await queryOne('SELECT * FROM homepage_sections WHERE section_key = ?', [sectionKey]);
  const isVisible = data.visible !== undefined ? (data.visible ? 1 : 0) : (existing ? existing.is_visible : 1);
  const sortOrder = data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : (existing ? existing.sort_order : 0);
  const title = data.title || (existing ? existing.title : sectionKey);
  const subtitle = data.subtitle || (existing ? existing.subtitle : '');

  await query(`
    INSERT INTO homepage_sections (section_key, title, subtitle, is_visible, sort_order)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      subtitle = VALUES(subtitle),
      is_visible = VALUES(is_visible),
      sort_order = VALUES(sort_order);
  `, [sectionKey, title, subtitle, isVisible, sortOrder]);

  return { success: true, sectionKey, visible: Boolean(isVisible), sortOrder };
}
