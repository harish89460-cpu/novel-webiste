import { moveToTrash } from './trash.js';
import { parseISTDateTime, getISTNowString, isPastIST, formatISTDisplay } from './timezone.js';
// Audio Novels & Hierarchical Episode Data Layer for Rudhra Prarthana Novels
// Full support for Chapter-Wise & Episode-Wise Audio Novel Management
// Supports Direct Audio Uploads (MP3/M4A/WAV) and YouTube Video Embeds
// Dynamic MySQL Persistence with Relations to Novels, Chapters, Episodes, Sub-Episodes, and Views

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, queryOne } from './db.js';
import { saveBase64Image, deleteLocalUploadFile } from './auth.js';
import { checkNovelViewAccess } from './novels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Extract YouTube Video ID from any standard YouTube URL
 * Supports: watch?v=, youtu.be/, embed/, v/, shorts/
 */
export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const match = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  return match ? match[1] : null;
}

/**
 * Generate a clean, URL-safe slug for an audio novel
 */
export function generateAudioSlug(title, partNumber = null) {
  let base = (title || 'audio-novel')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .replace(/-{2,}/g, '-');

  if (!base) base = 'audio-novel';
  if (partNumber && !base.includes(`part-${partNumber}`) && !base.includes(`episode-${partNumber}`)) {
    base = `${base}-part-${partNumber}`;
  }
  return base;
}

/**
 * Save Base64 Audio Upload to backend/uploads/audio
 * Max allowed size: 50MB
 */
export function saveBase64Audio(dataUrl, prefix = 'audio') {
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl;
  if (!dataUrl.startsWith('data:audio/')) return dataUrl;

  try {
    const match = dataUrl.match(/^data:audio\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) return dataUrl;

    let ext = match[1].toLowerCase();
    if (ext === 'mpeg' || ext === 'mp3') ext = 'mp3';
    else if (ext === 'mp4' || ext === 'm4a' || ext === 'x-m4a') ext = 'm4a';
    else if (ext === 'wav' || ext === 'x-wav') ext = 'wav';
    else if (ext === 'aac') ext = 'aac';
    else if (ext === 'ogg' || ext === 'vorbis') ext = 'ogg';
    else ext = 'mp3';

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 50 * 1024 * 1024) {
      throw new Error('Audio file exceeds the maximum 50MB size limit.');
    }

    const uploadDir = path.resolve(__dirname, 'uploads/audio');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    return `/uploads/audio/${filename}`;
  } catch (err) {
    console.error('[Audio Storage] Failed to save base64 audio:', err.message);
    throw err;
  }
}

/**
 * Retrieve all Audio Novels from MySQL with hierarchical stats
 * Includes both novels table (is_audio=1 or category='Audio Novels') and standalone audio_novels
 */
export async function getAllAudioNovelsHierarchy({ forAdmin = false, search = '', sort = 'newest' } = {}) {
  let sql = `
    SELECT 
      n.id,
      n.title,
      n.author,
      n.genre,
      n.category,
      n.status,
      n.badge,
      n.cover,
      n.description,
      n.chapters_count,
      n.views,
      n.rating,
      n.updated_date,
      n.is_audio,
      n.audio_voice,
      n.audio_duration,
      n.youtube_url,
      n.is_published,
      n.visibility,
      n.sort_order,
      n.created_at,
      n.updated_at
    FROM novels n
    WHERE (n.is_audio = 1 OR n.category = 'Audio Novels' OR LOWER(n.category) LIKE '%audio%')
  `;
  const params = [];

  if (!forAdmin) {
    sql += " AND n.is_published = 1 AND n.visibility = 'public'";
  }

  if (search && search.trim()) {
    sql += ' AND (LOWER(n.title) LIKE LOWER(?) OR LOWER(n.description) LIKE LOWER(?) OR LOWER(n.author) LIKE LOWER(?))';
    params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
  }

  if (sort === 'title') {
    sql += ' ORDER BY n.title ASC';
  } else if (sort === 'views') {
    sql += ' ORDER BY CAST(REPLACE(n.views, ",", "") AS UNSIGNED) DESC, n.created_at DESC';
  } else {
    sql += ' ORDER BY n.sort_order ASC, n.updated_at DESC, n.id ASC';
  }

  const novels = await query(sql, params);

  // For each audio novel, calculate dynamic chapter and episode statistics
  const result = [];
  for (const n of novels) {
    let chCond = "c.novel_id = ? AND c.is_audio = 1";
    if (!forAdmin) {
      chCond += " AND c.status = 'published'";
    }

    const [rootChCount, childEpCount, latestEp] = await Promise.all([
      queryOne(`SELECT COUNT(*) as count FROM chapters c WHERE ${chCond} AND c.parent_id IS NULL;`, [n.id]),
      queryOne(`SELECT COUNT(*) as count FROM chapters c WHERE ${chCond} AND c.parent_id IS NOT NULL;`, [n.id]),
      queryOne(`
        SELECT c.id, c.title, c.chapter_num, c.episode_number, c.audio_duration, c.published_at, c.source_type, c.audio_file_url, c.youtube_url
        FROM chapters c 
        WHERE ${chCond}
        ORDER BY c.sort_order DESC, c.id DESC LIMIT 1;
      `, [n.id])
    ]);

    const numChapters = rootChCount ? Number(rootChCount.count) : 0;
    const numEpisodes = childEpCount ? Number(childEpCount.count) : 0;
    const viewsNum = parseInt(String(n.views || '0').replace(/,/g, ''), 10) || 0;

    result.push({
      id: n.id,
      slug: n.id,
      title: n.title,
      author: n.author || 'Rudhra Prarthana',
      voice: n.audio_voice || n.author || 'Rudhra Prarthana',
      category: 'Audio Novels',
      status: n.status || (n.is_published ? 'published' : 'draft'),
      isPublished: Boolean(n.is_published),
      visibility: n.visibility || 'public',
      cover: n.cover || '/default-cover.jpg',
      description: n.description || '',
      chaptersCount: numChapters,
      episodesCount: numEpisodes,
      totalEpisodes: numChapters + numEpisodes,
      views: viewsNum,
      viewsFormatted: viewsNum.toLocaleString(),
      duration: n.audio_duration || (latestEp?.audio_duration ? latestEp.audio_duration : 'Full Audio'),
      latestEpisode: latestEp ? {
        id: latestEp.id,
        title: latestEp.title,
        episodeNumber: latestEp.episode_number || latestEp.chapter_num,
        audioDuration: latestEp.audio_duration,
        publishedAt: latestEp.published_at,
        sourceType: latestEp.source_type || 'audio_file'
      } : null,
      updatedAt: n.updated_at,
      createdAt: n.created_at,
      link: `#audio?novel=${encodeURIComponent(n.id)}`
    });
  }

  return result;
}

/**
 * Retrieve Audio Novel details with complete hierarchical tree of Chapters, Episodes, and Sub-Episodes
 */
const recentAudioViews = new Map();

export async function getAudioNovelHierarchy(novelIdOrSlug, { forAdmin = false, currentUser = null, incrementView = true } = {}) {
  if (!novelIdOrSlug) return null;

  const novel = await queryOne(`
    SELECT * FROM novels 
    WHERE id = ? OR LOWER(title) = LOWER(?);
  `, [novelIdOrSlug, novelIdOrSlug]);

  if (!novel) return null;
  if (!forAdmin) {
    const access = await checkNovelViewAccess(novel.id, currentUser);
    if (!access.allowed) {
      return null;
    }
  }

  // Atomically increment views for public playback (with debounce)
  if (!forAdmin && incrementView) {
    const debounceKey = `${currentUser?.id || 'guest'}_${novel.id}`;
    const lastTime = recentAudioViews.get(debounceKey) || 0;
    const now = Date.now();
    if (now - lastTime > 5000) {
      recentAudioViews.set(debounceKey, now);
      try {
        const curViews = parseInt(String(novel.views || '0').replace(/,/g, ''), 10) || 0;
        await query('UPDATE novels SET views = ? WHERE id = ?;', [String(curViews + 1), novel.id]);
        novel.views = String(curViews + 1);
      } catch {}
    }
    if (recentAudioViews.size > 20000) recentAudioViews.clear();
  }

  // Fetch all chapters & episodes belonging to this audio novel
  let epSql = `
    SELECT 
      c.id, c.novel_id, c.parent_id, c.chapter_num, c.episode_number,
      c.title, c.title_ta, c.content, c.is_audio,
      c.audio_file_url, c.youtube_url, c.youtube_video_id, c.audio_duration,
      c.source_type, c.thumbnail, c.word_count, c.read_time,
      c.status, c.scheduled_at, c.timezone, c.author_id, c.review_status,
      c.sort_order, c.published_at, c.created_at, c.updated_at
    FROM chapters c
    WHERE c.novel_id = ? AND c.is_audio = 1
  `;
  const epParams = [novel.id];

  if (!forAdmin) {
    epSql += " AND c.status = 'published'";
  }

  epSql += ' ORDER BY c.sort_order ASC, c.id ASC;';
  const allRows = await query(epSql, epParams);

  // Map into 3-tier hierarchy: Chapter (parent_id IS NULL) -> Episode -> Sub-episode
  const chaptersMap = new Map();
  const episodesMap = new Map();
  const rootChapters = [];

  // Helper to format an episode row
  function formatEpisodeItem(row) {
    const videoId = row.youtube_video_id || extractYouTubeVideoId(row.youtube_url);
    const hasAudio = Boolean(row.audio_file_url);
    const hasYouTube = Boolean(videoId);
    let resolvedSourceType = row.source_type || 'audio_file';
    if (hasAudio && hasYouTube) {
      resolvedSourceType = 'both';
    } else if (hasYouTube && !hasAudio) {
      resolvedSourceType = 'youtube';
    } else if (hasAudio && !hasYouTube) {
      resolvedSourceType = 'audio_file';
    }

    return {
      id: Number(row.id),
      novelId: row.novel_id,
      parentId: row.parent_id ? Number(row.parent_id) : null,
      chapterNum: String(row.chapter_num || ''),
      episodeNumber: String(row.episode_number || row.chapter_num || ''),
      title: row.title,
      titleTa: row.title_ta || row.title,
      description: row.content || '',
      thumbnail: row.thumbnail || novel.cover || '/default-cover.jpg',
      audioFileUrl: row.audio_file_url || null,
      youtubeUrl: row.youtube_url || null,
      youtubeVideoId: videoId,
      embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0` : null,
      audioDuration: row.audio_duration || '',
      sourceType: resolvedSourceType,
      hasAudio,
      hasYouTube,
      status: row.status || 'published',
      scheduledAt: row.scheduled_at || null,
      timezone: row.timezone || 'Asia/Kolkata',
      authorId: row.author_id ? Number(row.author_id) : null,
      reviewStatus: row.review_status || null,
      sortOrder: Number(row.sort_order || 0),
      publishedAt: row.published_at,
      createdAt: row.created_at,
      subEpisodes: [],
      children: []
    };
  }

  // 1. Separate roots vs children
  allRows.forEach(row => {
    const item = formatEpisodeItem(row);
    if (!row.parent_id) {
      chaptersMap.set(item.id, item);
      rootChapters.push(item);
    } else {
      episodesMap.set(item.id, item);
    }
  });

  // 2. Attach children to parents (Episode -> Chapter OR Sub-episode -> Episode)
  allRows.forEach(row => {
    if (row.parent_id) {
      const pId = Number(row.parent_id);
      const childItem = episodesMap.get(Number(row.id));
      if (!childItem) return;

      if (chaptersMap.has(pId)) {
        // Child of a root Chapter -> Episode
        chaptersMap.get(pId).subEpisodes.push(childItem);
        chaptersMap.get(pId).children.push(childItem);
      } else if (episodesMap.has(pId)) {
        // Child of an Episode -> Sub-episode
        episodesMap.get(pId).subEpisodes.push(childItem);
        episodesMap.get(pId).children.push(childItem);
      } else {
        // Fallback: attach to first root chapter if orphaned
        if (rootChapters.length > 0) {
          rootChapters[0].subEpisodes.push(childItem);
          rootChapters[0].children.push(childItem);
        }
      }
    }
  });

  // Flat list of playable episodes for audio queue/playlist
  const playlist = [];
  rootChapters.forEach(ch => {
    if (ch.audioFileUrl || ch.youtubeUrl) {
      playlist.push(ch);
    }
    ch.subEpisodes.forEach(ep => {
      playlist.push(ep);
      ep.subEpisodes.forEach(sub => {
        playlist.push(sub);
      });
    });
  });

  const viewsNum = parseInt(String(novel.views || '0').replace(/,/g, ''), 10) || 0;

  return {
    id: novel.id,
    slug: novel.id,
    title: novel.title,
    author: novel.author || 'Rudhra Prarthana',
    voice: novel.audio_voice || novel.author || 'Rudhra Prarthana',
    category: 'Audio Novels',
    status: novel.status || (novel.is_published ? 'published' : 'draft'),
    isPublished: Boolean(novel.is_published),
    visibility: novel.visibility || 'public',
    cover: novel.cover || '/default-cover.jpg',
    description: novel.description || '',
    audioDuration: novel.audio_duration || 'Full Audio',
    views: viewsNum,
    viewsFormatted: viewsNum.toLocaleString(),
    chaptersCount: rootChapters.length,
    episodesCount: playlist.length,
    chapters: rootChapters,
    playlist
  };
}

/**
 * Create a new Audio Novel in MySQL (novels table with is_audio=1)
 */
export async function createAudioNovel(data) {
  const cleanTitle = (data.title || '').trim();
  if (!cleanTitle) {
    return { success: false, error: 'Audio novel title is required.' };
  }

  // Generate unique slug/ID
  const baseSlug = generateAudioSlug(cleanTitle);
  let id = baseSlug;
  let counter = 1;
  while (await queryOne('SELECT id FROM novels WHERE id = ?;', [id])) {
    counter++;
    id = `${baseSlug}-${counter}`;
  }

  let cover = data.cover || null;
  if (cover && typeof cover === 'string' && cover.startsWith('data:image/')) {
    cover = saveBase64Image(cover, 'covers', 'audio-novel');
  }

  const author = (data.author || 'Rudhra Prarthana').trim();
  const voice = (data.audioVoice || data.voice || author).trim();
  const description = (data.description || '').trim();
  const status = data.status === 'draft' ? 'draft' : 'published';
  const isPublished = status === 'published' ? 1 : 0;
  const audioDuration = (data.audioDuration || data.duration || data.audio_duration || '').trim() || null;
  const sortOrder = data.sortOrder ? parseInt(data.sortOrder, 10) : 1;

  await query(`
    INSERT INTO novels (
      id, title, author, category, status, badge, cover,
      description, chapters_count, views, rating, updated_date,
      featured, continue_reading, is_audio, audio_available,
      audio_duration, audio_voice, sort_order, is_published, visibility, link
    ) VALUES (
      ?, ?, ?, 'Audio Novels', ?, 'Audio', ?,
      ?, 0, '0', '5.0', 'Just now',
      0, 0, 1, 1,
      ?, ?, ?, ?, 'public', ?
    );
  `, [
    id, cleanTitle, author, status === 'published' ? 'Ongoing' : 'Draft', cover,
    description, audioDuration, voice, sortOrder, isPublished, `#audio?novel=${encodeURIComponent(id)}`
  ]);

  const inserted = await getAudioNovelHierarchy(id, { forAdmin: true });
  return { success: true, audioNovel: inserted };
}

/**
 * Update existing Audio Novel in MySQL
 */
export async function updateAudioNovel(id, data) {
  const existing = await queryOne('SELECT * FROM novels WHERE id = ?;', [id]);
  if (!existing) {
    return { success: false, error: 'Audio novel not found.' };
  }

  const cleanTitle = data.title !== undefined ? String(data.title).trim() : existing.title;
  if (!cleanTitle) {
    return { success: false, error: 'Audio novel title cannot be empty.' };
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
      cover = saveBase64Image(rawCover, 'covers', 'audio-novel', existing.cover);
    } else {
      if (existing.cover && existing.cover !== rawCover) {
        deleteLocalUploadFile(existing.cover);
      }
      cover = rawCover;
    }
  }

  const author = data.author !== undefined ? String(data.author).trim() : existing.author;
  const voice = data.audioVoice !== undefined ? String(data.audioVoice).trim() : (data.voice !== undefined ? String(data.voice).trim() : existing.audio_voice);
  const description = data.description !== undefined ? String(data.description).trim() : existing.description;
  const audioDuration = data.audioDuration !== undefined ? String(data.audioDuration).trim() : existing.audio_duration;
  const status = data.status !== undefined ? (data.status === 'draft' ? 'draft' : 'published') : (existing.is_published ? 'published' : 'draft');
  const isPublished = status === 'published' ? 1 : 0;
  const sortOrder = data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : existing.sort_order;

  await query(`
    UPDATE novels
    SET title = ?,
        author = ?,
        cover = ?,
        description = ?,
        audio_voice = ?,
        audio_duration = ?,
        status = ?,
        is_published = ?,
        sort_order = ?,
        updated_at = NOW()
    WHERE id = ?;
  `, [
    cleanTitle, author, cover, description, voice, audioDuration,
    status === 'published' ? 'Ongoing' : 'Draft', isPublished, sortOrder, id
  ]);

  const updated = await getAudioNovelHierarchy(id, { forAdmin: true });
  return { success: true, audioNovel: updated };
}

/**
 * Delete Audio Novel from MySQL and remove all child chapters, episodes, and disk audio files
 */
export async function deleteAudioNovel(id, deletedBy = 2, deletedByName = 'Admin') {
  const existing = await queryOne('SELECT * FROM novels WHERE id = ?;', [id]);
  if (!existing) {
    return { success: false, error: 'Audio novel not found.' };
  }

  const chapters = await query('SELECT * FROM chapters WHERE novel_id = ?;', [id]);

  try {
    await moveToTrash({
      itemType: 'audio_novel',
      itemId: existing.id,
      title: existing.title,
      ownerId: existing.author_id,
      deletedBy,
      deletedByName,
      originalLocation: 'Audio Novels',
      itemData: {
        audioNovel: existing,
        episodes: chapters || []
      }
    });
  } catch (err) {
    console.warn('Could not move audio novel to trash:', err.message);
  }

  // Delete all chapters & novel records so it is hidden from live site
  await query('DELETE FROM chapters WHERE novel_id = ?;', [id]);
  await query('DELETE FROM novels WHERE id = ?;', [id]);
  await query('DELETE FROM audio_novels WHERE novel_id = ?;', [id]);

  return { success: true, message: 'Audio novel moved to trash.' };
}

/**
 * Fetch hierarchical chapters and episodes tree for a specific audio novel
 */
export async function getAudioEpisodesTree(novelId, { forAdmin = false } = {}) {
  const hierarchy = await getAudioNovelHierarchy(novelId, { forAdmin, incrementView: false });
  if (!hierarchy) return [];
  return hierarchy.chapters;
}

/**
 * Create a new Audio Chapter, Episode, or Sub-Episode
 * Automatically generates numbering from actual parent-child relationships
 */
export async function createAudioEpisode(data) {
  const novelId = (data.novelId || data.novel || data.novel_id || '').trim();
  if (!novelId) {
    return { success: false, error: 'Novel ID is required.' };
  }

  const novel = await queryOne('SELECT id, cover FROM novels WHERE id = ?;', [novelId]);
  if (!novel) {
    return { success: false, error: 'Audio novel not found.' };
  }

  const cleanTitle = (data.title || '').trim();
  if (!cleanTitle) {
    return { success: false, error: 'Episode / Chapter title is required.' };
  }

  const rawParentId = data.parentId !== undefined && data.parentId !== null ? data.parentId : data.parent_id;
  const parentId = rawParentId && !isNaN(Number(rawParentId)) ? Number(rawParentId) : null;
  let parentEpisode = null;
  if (parentId) {
    parentEpisode = await queryOne('SELECT id, parent_id, chapter_num, episode_number, sort_order FROM chapters WHERE id = ?;', [parentId]);
    if (!parentEpisode) {
      return { success: false, error: 'Parent chapter or episode not found.' };
    }
  }

  // Automatic Hierarchical Numbering and Sort Order
  let episodeNumber = (data.episodeNumber || data.chapterNum || '').trim();
  let chapterNum = episodeNumber;
  let sortOrder = data.sortOrder !== undefined && !isNaN(parseFloat(data.sortOrder))
    ? parseFloat(data.sortOrder)
    : null;

  if (parentId && parentEpisode) {
    const parentNum = String(parentEpisode.episode_number || parentEpisode.chapter_num || '1');
    const existingSubs = await query(`
      SELECT id, chapter_num, episode_number, sort_order 
      FROM chapters 
      WHERE parent_id = ? AND is_audio = 1
      ORDER BY sort_order ASC, id ASC;
    `, [parentId]);

    if (!episodeNumber) {
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
      chapterNum = episodeNumber;
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
        WHERE novel_id = ? AND parent_id IS NULL AND is_audio = 1;
      `, [novelId]);

      let maxChapterNum = 0;
      for (const ch of rootChapters) {
        const cNum = parseInt(String(ch.episode_number || ch.chapter_num || '0'), 10);
        if (!isNaN(cNum) && cNum > maxChapterNum) {
          maxChapterNum = cNum;
        }
      }
      episodeNumber = String(maxChapterNum + 1);
      chapterNum = episodeNumber;
      if (sortOrder === null) {
        sortOrder = Number(maxChapterNum + 1);
      }
    } else if (sortOrder === null) {
      const parsed = parseFloat(episodeNumber);
      sortOrder = !isNaN(parsed) ? parsed : 1.0;
    }
  }

  // Handle Flexible Audio & YouTube Media (Audio Only, YouTube Only, or Audio + YouTube)
  let youtubeUrl = null;
  let youtubeVideoId = null;
  let audioFileUrl = null;

  if (data.youtubeUrl || data.youtube_url) {
    const rawYt = String(data.youtubeUrl || data.youtube_url).trim();
    if (rawYt) {
      youtubeUrl = rawYt;
      youtubeVideoId = extractYouTubeVideoId(rawYt);
    }
  }

  const audioData = data.audioData || data.audio_data;
  if (audioData && typeof audioData === 'string' && audioData.startsWith('data:audio/')) {
    audioFileUrl = saveBase64Audio(audioData, 'audio-episode');
  } else if (data.audioFileUrl || data.audio_file_url) {
    audioFileUrl = String(data.audioFileUrl || data.audio_file_url).trim() || null;
  }

  let sourceType = data.sourceType || data.source_type;
  if (!sourceType || sourceType === 'both' || (audioFileUrl && youtubeUrl)) {
    sourceType = (audioFileUrl && youtubeUrl) ? 'both' : (youtubeUrl ? 'youtube' : 'audio_file');
  }

  // Thumbnail / Cover
  let thumbnail = data.thumbnail || null;
  if (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('data:image/')) {
    thumbnail = saveBase64Image(thumbnail, 'covers', 'audio-thumb');
  }

  const description = (data.description || data.content || '').trim();
  const audioDuration = (data.audioDuration || '').trim() || null;
  
  // Status and Scheduling
  let status = data.status === 'draft' ? 'draft' : (data.status === 'disabled' ? 'disabled' : (data.status === 'scheduled' ? 'scheduled' : 'published'));
  let scheduledAt = data.scheduledAt || data.scheduled_at || null;
  let timezone = data.timezone || 'Asia/Kolkata';
  if (scheduledAt) {
    scheduledAt = parseISTDateTime(scheduledAt);
    if (!scheduledAt) {
      return { success: false, error: 'Invalid scheduled date/time format.' };
    }
    if (isPastIST(scheduledAt, 5)) {
      return { success: false, error: 'Scheduled publication time cannot be in the past.' };
    }
    status = 'scheduled';
    timezone = 'Asia/Kolkata';
  }
  const authorId = data.authorId ? Number(data.authorId) : null;
  const reviewStatus = data.reviewStatus || (status === 'published' ? 'published' : (status === 'scheduled' ? 'approved' : 'draft'));

  const res = await query(`
    INSERT INTO chapters (
      novel_id, parent_id, chapter_num, episode_number, title, title_ta,
      content, is_guest_allowed, is_audio, audio_file_url, youtube_url,
      youtube_video_id, audio_duration, source_type, thumbnail,
      word_count, read_time, release_date, status, scheduled_at, timezone,
      author_id, review_status, published_at, sort_order
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, 1, 1, ?, ?,
      ?, ?, ?, ?,
      ?, ?, NOW(), ?, ?, ?,
      ?, ?, ${status === 'published' ? 'NOW()' : 'NULL'}, ?
    );
  `, [
    novelId, parentId, chapterNum, episodeNumber, cleanTitle, cleanTitle,
    description, audioFileUrl, youtubeUrl,
    youtubeVideoId, audioDuration, sourceType, thumbnail,
    audioDuration ? `Audio ${audioDuration}` : 'Audio',
    audioDuration || 'Audio', status, scheduledAt, timezone,
    authorId, reviewStatus, sortOrder
  ]);

  // Recalculate root chapter counts on the novel
  await query(`
    UPDATE novels 
    SET chapters_count = (SELECT COUNT(*) FROM chapters WHERE novel_id = ? AND is_audio = 1 AND parent_id IS NULL),
        updated_at = NOW()
    WHERE id = ?;
  `, [novelId, novelId]);

  const inserted = await queryOne('SELECT * FROM chapters WHERE id = ?;', [res.insertId]);
  return { success: true, episode: inserted };
}

/**
 * Update an existing Audio Chapter, Episode, or Sub-Episode
 */
export async function updateAudioEpisode(id, data) {
  const existing = await queryOne('SELECT * FROM chapters WHERE id = ? AND is_audio = 1;', [id]);
  if (!existing) {
    return { success: false, error: 'Audio episode not found.' };
  }

  const cleanTitle = data.title !== undefined ? String(data.title).trim() : existing.title;
  if (!cleanTitle) {
    return { success: false, error: 'Episode title cannot be empty.' };
  }

  let youtubeUrl = existing.youtube_url;
  let youtubeVideoId = existing.youtube_video_id;
  let audioFileUrl = existing.audio_file_url;

  if (data.youtubeUrl !== undefined) {
    const rawYt = String(data.youtubeUrl).trim();
    youtubeUrl = rawYt || null;
    youtubeVideoId = rawYt ? extractYouTubeVideoId(rawYt) : null;
  }

  if (data.audioData && typeof data.audioData === 'string' && data.audioData.startsWith('data:audio/')) {
    audioFileUrl = saveBase64Audio(data.audioData, 'audio-episode');
  } else if (data.audioFileUrl !== undefined) {
    audioFileUrl = String(data.audioFileUrl).trim() || null;
  }

  let sourceType = data.sourceType !== undefined ? data.sourceType : existing.source_type;
  if (!sourceType || sourceType === 'both' || (audioFileUrl && youtubeUrl)) {
    sourceType = (audioFileUrl && youtubeUrl) ? 'both' : (youtubeUrl ? 'youtube' : 'audio_file');
  }

  let thumbnail = existing.thumbnail;
  if (data.thumbnail !== undefined) {
    if (data.thumbnail && typeof data.thumbnail === 'string' && data.thumbnail.startsWith('data:image/')) {
      thumbnail = saveBase64Image(data.thumbnail, 'covers', 'audio-thumb');
    } else {
      thumbnail = data.thumbnail;
    }
  }

  const description = data.description !== undefined ? String(data.description).trim() : (data.content !== undefined ? String(data.content).trim() : existing.content);
  const audioDuration = data.audioDuration !== undefined ? String(data.audioDuration).trim() : existing.audio_duration;
  let status = data.status !== undefined ? (data.status === 'draft' ? 'draft' : (data.status === 'disabled' ? 'disabled' : (data.status === 'scheduled' ? 'scheduled' : 'published'))) : existing.status;
  let scheduledAt = data.scheduledAt !== undefined ? (data.scheduledAt || null) : existing.scheduled_at;
  let timezone = data.timezone !== undefined ? data.timezone : (existing.timezone || 'Asia/Kolkata');
  if (data.scheduledAt) {
    status = 'scheduled';
  }

  const episodeNumber = data.episodeNumber !== undefined ? String(data.episodeNumber).trim() : existing.episode_number;
  const chapterNum = data.chapterNum !== undefined ? String(data.chapterNum).trim() : (episodeNumber || existing.chapter_num);
  const sortOrder = data.sortOrder !== undefined && !isNaN(parseFloat(data.sortOrder)) ? parseFloat(data.sortOrder) : existing.sort_order;

  await query(`
    UPDATE chapters
    SET title = ?,
        title_ta = ?,
        chapter_num = ?,
        episode_number = ?,
        content = ?,
        source_type = ?,
        youtube_url = ?,
        youtube_video_id = ?,
        audio_file_url = ?,
        audio_duration = ?,
        thumbnail = ?,
        status = ?,
        scheduled_at = ?,
        timezone = ?,
        sort_order = ?,
        published_at = CASE 
          WHEN ? = 'published' AND published_at IS NULL THEN NOW() 
          ELSE published_at 
        END,
        updated_at = NOW()
    WHERE id = ?;
  `, [
    cleanTitle, cleanTitle, chapterNum, episodeNumber, description,
    sourceType, youtubeUrl, youtubeVideoId, audioFileUrl, audioDuration,
    thumbnail, status, scheduledAt, timezone, sortOrder, status, id
  ]);

  const updated = await queryOne('SELECT * FROM chapters WHERE id = ?;', [id]);
  return { success: true, episode: updated };
}

/**
 * Delete Audio Episode or Chapter (and recursively all child episodes)
 */
export async function deleteAudioEpisode(id) {
  const existing = await queryOne('SELECT * FROM chapters WHERE id = ? AND is_audio = 1;', [id]);
  if (!existing) {
    return { success: false, error: 'Audio episode not found.' };
  }

  // Find all children and grandchildren
  const toDelete = [existing.id];
  const children = await query('SELECT id, audio_file_url FROM chapters WHERE parent_id = ?;', [existing.id]);
  for (const c of children) {
    toDelete.push(c.id);
    const grandChildren = await query('SELECT id, audio_file_url FROM chapters WHERE parent_id = ?;', [c.id]);
    for (const gc of grandChildren) {
      toDelete.push(gc.id);
      if (gc.audio_file_url && gc.audio_file_url.startsWith('/uploads/audio/')) {
        try { fs.unlinkSync(path.resolve(__dirname, 'uploads/audio', path.basename(gc.audio_file_url))); } catch {}
      }
    }
    if (c.audio_file_url && c.audio_file_url.startsWith('/uploads/audio/')) {
      try { fs.unlinkSync(path.resolve(__dirname, 'uploads/audio', path.basename(c.audio_file_url))); } catch {}
    }
  }

  if (existing.audio_file_url && existing.audio_file_url.startsWith('/uploads/audio/')) {
    try { fs.unlinkSync(path.resolve(__dirname, 'uploads/audio', path.basename(existing.audio_file_url))); } catch {}
  }

  // Delete records
  for (const epId of toDelete) {
    await query('DELETE FROM chapters WHERE id = ?;', [epId]);
  }

  // Recalculate root chapter count
  await query(`
    UPDATE novels 
    SET chapters_count = (SELECT COUNT(*) FROM chapters WHERE novel_id = ? AND is_audio = 1 AND parent_id IS NULL),
        updated_at = NOW()
    WHERE id = ?;
  `, [existing.novel_id, existing.novel_id]);

  return { success: true, deletedCount: toDelete.length };
}

/**
 * Toggle Audio Episode Status (published, draft, disabled)
 */
export async function toggleAudioEpisodeStatus(id, newStatus = null) {
  const existing = await queryOne('SELECT id, status FROM chapters WHERE id = ? AND is_audio = 1;', [id]);
  if (!existing) {
    return { success: false, error: 'Audio episode not found.' };
  }

  let targetStatus = newStatus;
  if (!targetStatus) {
    targetStatus = existing.status === 'published' ? 'draft' : 'published';
  }

  await query('UPDATE chapters SET status = ?, updated_at = NOW() WHERE id = ?;', [targetStatus, id]);
  return { success: true, status: targetStatus, newStatus: targetStatus };
}

/**
 * Reorder chapters and episodes
 */
export async function reorderAudioEpisodes(novelId, orderedIds) {
  if (!Array.isArray(orderedIds)) {
    return { success: false, error: 'Ordered IDs array required.' };
  }

  for (let idx = 0; idx < orderedIds.length; idx++) {
    const epId = orderedIds[idx];
    await query('UPDATE chapters SET sort_order = ?, updated_at = NOW() WHERE id = ? AND novel_id = ?;', [idx + 1, epId, novelId]);
  }

  return { success: true };
}

// ============================================================================
// LEGACY COMPATIBILITY HELPERS FOR AUDIO_NOVELS TABLE
// ============================================================================

export async function getAllAudioNovels({ forAdmin = false, search = '', language = '', novelId = '', sort = 'newest' } = {}) {
  return getAllAudioNovelsHierarchy({ forAdmin, search, sort });
}

export function formatAudioNovelRow(row) {
  if (!row) return null;
  const videoId = row.youtube_video_id || extractYouTubeVideoId(row.youtube_url);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug || row.id,
    novelId: row.novel_id || row.id,
    linkedNovelTitle: row.title || row.linked_novel_title,
    linkedNovelCover: row.cover || row.linked_novel_cover,
    description: row.description || '',
    cover: row.cover || '/default-cover.jpg',
    sourceType: row.source_type || 'youtube',
    youtubeUrl: row.youtube_url || null,
    youtubeVideoId: videoId,
    embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0` : null,
    audioFileUrl: row.audio_file_url || null,
    audioDuration: row.audio_duration || '',
    episodeNumber: row.episode_number || 'Full Audio',
    partNumber: Number(row.part_number || 1),
    language: row.language || 'Tamil',
    status: row.status || 'published',
    sortOrder: Number(row.sort_order || 0),
    views: Number(row.views || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function getAudioNovelByIdOrSlug(idOrSlug, { forAdmin = false, currentUser = null } = {}) {
  return getAudioNovelHierarchy(idOrSlug, { forAdmin, currentUser });
}
