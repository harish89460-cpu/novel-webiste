// Audio Novels Data Layer for Rudhra Prarthana Novels
// Supports Direct Audio Uploads (MP3/M4A/WAV) and Official YouTube Embeds
// Dynamic MySQL Persistence with Relations to Novels, Multi-Part Episodes, and Views

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, queryOne } from './db.js';
import { saveBase64Image } from './auth.js';

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
 * Save Base64 Audio Upload to public/uploads/audio
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

    const uploadDir = path.resolve(__dirname, '../public/uploads/audio');
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
 * Retrieve all Audio Novels from MySQL with filtering and search
 */
export async function getAllAudioNovels({ forAdmin = false, search = '', language = '', novelId = '', sort = 'newest' } = {}) {
  let sql = `
    SELECT 
      a.*,
      n.title AS linked_novel_title,
      n.cover AS linked_novel_cover,
      n.is_published AS linked_novel_published,
      n.visibility AS linked_novel_visibility
    FROM audio_novels a
    LEFT JOIN novels n ON a.novel_id = n.id
    WHERE 1=1
  `;
  const params = [];

  if (!forAdmin) {
    sql += " AND a.status = 'published'";
    // If linked to a novel, ensure the novel is published/public
    sql += " AND (a.novel_id IS NULL OR (n.is_published = 1 AND n.visibility = 'public'))";
  }

  if (language && language.toLowerCase() !== 'all') {
    sql += ' AND LOWER(a.language) = LOWER(?)';
    params.push(language);
  }

  if (novelId && novelId.toLowerCase() !== 'all') {
    sql += ' AND a.novel_id = ?';
    params.push(novelId);
  }

  if (search && search.trim()) {
    sql += ' AND (LOWER(a.title) LIKE LOWER(?) OR LOWER(a.description) LIKE LOWER(?))';
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  if (sort === 'title') {
    sql += ' ORDER BY a.title ASC, a.part_number ASC';
  } else if (sort === 'views') {
    sql += ' ORDER BY a.views DESC, a.created_at DESC';
  } else {
    // default: newest / sort_order
    sql += ' ORDER BY a.sort_order ASC, a.created_at DESC, a.part_number ASC';
  }

  const rows = await query(sql, params);
  return rows.map(formatAudioNovelRow);
}

/**
 * Format database row into client-friendly audio novel object
 */
export function formatAudioNovelRow(row) {
  if (!row) return null;
  const videoId = row.youtube_video_id || extractYouTubeVideoId(row.youtube_url);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    novelId: row.novel_id || null,
    linkedNovelTitle: row.linked_novel_title || null,
    linkedNovelCover: row.linked_novel_cover || null,
    description: row.description || '',
    cover: row.cover || row.linked_novel_cover || '/default-cover.jpg',
    sourceType: row.source_type || 'youtube',
    youtubeUrl: row.youtube_url || null,
    youtubeVideoId: videoId,
    embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0` : null,
    audioFileUrl: row.audio_file_url || null,
    audioDuration: row.audio_duration || '',
    episodeNumber: row.episode_number || (row.part_number ? `Part ${row.part_number}` : 'Full Audio'),
    partNumber: Number(row.part_number || 1),
    language: row.language || 'Tamil',
    status: row.status || 'published',
    sortOrder: Number(row.sort_order || 0),
    views: Number(row.views || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Retrieve single Audio Novel by ID or Slug, plus all related multi-part episodes
 */
export async function getAudioNovelByIdOrSlug(idOrSlug, { forAdmin = false } = {}) {
  if (!idOrSlug) return null;

  const isNumeric = /^\d+$/.test(String(idOrSlug).trim());
  let sql = `
    SELECT 
      a.*,
      n.title AS linked_novel_title,
      n.cover AS linked_novel_cover,
      n.is_published AS linked_novel_published,
      n.visibility AS linked_novel_visibility
    FROM audio_novels a
    LEFT JOIN novels n ON a.novel_id = n.id
    WHERE ${isNumeric ? 'a.id = ?' : 'a.slug = ?'}
  `;
  const params = [isNumeric ? parseInt(idOrSlug, 10) : String(idOrSlug).trim()];

  if (!forAdmin) {
    sql += " AND a.status = 'published'";
  }

  const row = await queryOne(sql, params);
  if (!row) return null;

  // Increment views count atomically for public reads
  if (!forAdmin) {
    try {
      await query('UPDATE audio_novels SET views = views + 1 WHERE id = ?;', [row.id]);
      row.views = (row.views || 0) + 1;
    } catch {}
  }

  const audioNovel = formatAudioNovelRow(row);

  // Load sibling parts (multi-part series)
  let parts = [];
  if (row.novel_id) {
    let partsSql = `
      SELECT id, title, slug, part_number, episode_number, audio_duration, source_type, status
      FROM audio_novels
      WHERE novel_id = ?
    `;
    const partsParams = [row.novel_id];
    if (!forAdmin) {
      partsSql += " AND status = 'published'";
    }
    partsSql += ' ORDER BY part_number ASC, sort_order ASC, id ASC;';
    parts = await query(partsSql, partsParams);
  } else {
    // If not linked to novel, find entries with matching base title
    const baseTitle = row.title.split('—')[0].split('-')[0].trim();
    if (baseTitle && baseTitle.length > 3) {
      let partsSql = `
        SELECT id, title, slug, part_number, episode_number, audio_duration, source_type, status
        FROM audio_novels
        WHERE title LIKE ?
      `;
      const partsParams = [`%${baseTitle}%`];
      if (!forAdmin) {
        partsSql += " AND status = 'published'";
      }
      partsSql += ' ORDER BY part_number ASC, sort_order ASC, id ASC;';
      parts = await query(partsSql, partsParams);
    }
  }

  return {
    ...audioNovel,
    parts: parts.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      partNumber: Number(p.part_number || 1),
      episodeNumber: p.episode_number || `Part ${p.part_number || 1}`,
      audioDuration: p.audio_duration || '',
      sourceType: p.source_type,
      status: p.status,
      isActive: p.id === row.id
    }))
  };
}

/**
 * Create a new Audio Novel in MySQL
 */
export async function createAudioNovel(data) {
  const cleanTitle = (data.title || '').trim();
  if (!cleanTitle) {
    return { success: false, error: 'Audio novel title is required.' };
  }

  const sourceType = data.sourceType === 'audio_file' ? 'audio_file' : 'youtube';
  let youtubeUrl = null;
  let youtubeVideoId = null;
  let audioFileUrl = null;

  if (sourceType === 'youtube') {
    youtubeUrl = (data.youtubeUrl || '').trim();
    if (!youtubeUrl) {
      return { success: false, error: 'YouTube URL is required when YouTube source is selected.' };
    }
    youtubeVideoId = extractYouTubeVideoId(youtubeUrl);
    if (!youtubeVideoId) {
      return { success: false, error: 'Invalid YouTube URL. Please provide a standard YouTube video link or Shorts URL.' };
    }
  } else {
    // Direct audio upload
    if (data.audioData && typeof data.audioData === 'string' && data.audioData.startsWith('data:audio/')) {
      audioFileUrl = saveBase64Audio(data.audioData, 'audio-novel');
    } else if (data.audioFileUrl) {
      audioFileUrl = String(data.audioFileUrl).trim();
    }
    if (!audioFileUrl) {
      return { success: false, error: 'An audio file upload (MP3/M4A/WAV) is required when Direct Audio is selected.' };
    }
  }

  // Cover image
  let cover = data.cover || null;
  if (cover && typeof cover === 'string' && cover.startsWith('data:image/')) {
    cover = saveBase64Image(cover, 'covers', 'audio-cover');
  }

  // Novel association check
  let novelId = data.novelId ? String(data.novelId).trim() : null;
  if (novelId) {
    const novel = await queryOne('SELECT id FROM novels WHERE id = ?;', [novelId]);
    if (!novel) novelId = null;
  }

  // Generate unique slug
  const partNumber = data.partNumber ? parseInt(data.partNumber, 10) : 1;
  const baseSlug = generateAudioSlug(cleanTitle, partNumber > 1 ? partNumber : null);
  let slug = baseSlug;
  let counter = 1;
  while (await queryOne('SELECT id FROM audio_novels WHERE slug = ?;', [slug])) {
    counter++;
    slug = `${baseSlug}-${counter}`;
  }

  const status = data.status === 'draft' ? 'draft' : 'published';
  const language = (data.language || 'Tamil').trim();
  const description = (data.description || '').trim();
  const audioDuration = (data.audioDuration || '').trim() || null;
  const episodeNumber = (data.episodeNumber || `Part ${partNumber}`).trim();
  const sortOrder = data.sortOrder ? parseInt(data.sortOrder, 10) : partNumber;

  const res = await query(`
    INSERT INTO audio_novels (
      title, slug, novel_id, description, cover,
      source_type, youtube_url, youtube_video_id, audio_file_url,
      audio_duration, episode_number, part_number, language,
      status, sort_order, views
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, 0
    );
  `, [
    cleanTitle, slug, novelId, description, cover,
    sourceType, youtubeUrl, youtubeVideoId, audioFileUrl,
    audioDuration, episodeNumber, partNumber, language,
    status, sortOrder
  ]);

  const inserted = await getAudioNovelByIdOrSlug(res.insertId, { forAdmin: true });
  return { success: true, audioNovel: inserted };
}

/**
 * Update existing Audio Novel in MySQL
 */
export async function updateAudioNovel(id, data) {
  const existing = await queryOne('SELECT * FROM audio_novels WHERE id = ?;', [id]);
  if (!existing) {
    return { success: false, error: 'Audio novel not found.' };
  }

  const cleanTitle = data.title !== undefined ? String(data.title).trim() : existing.title;
  if (!cleanTitle) {
    return { success: false, error: 'Audio novel title cannot be empty.' };
  }

  const sourceType = data.sourceType !== undefined 
    ? (data.sourceType === 'audio_file' ? 'audio_file' : 'youtube') 
    : existing.source_type;

  let youtubeUrl = existing.youtube_url;
  let youtubeVideoId = existing.youtube_video_id;
  let audioFileUrl = existing.audio_file_url;

  if (sourceType === 'youtube') {
    if (data.youtubeUrl !== undefined) {
      youtubeUrl = String(data.youtubeUrl).trim();
      youtubeVideoId = extractYouTubeVideoId(youtubeUrl);
      if (!youtubeVideoId) {
        return { success: false, error: 'Invalid YouTube URL. Please provide a valid YouTube video link.' };
      }
    }
  } else {
    // Direct audio file
    if (data.audioData && typeof data.audioData === 'string' && data.audioData.startsWith('data:audio/')) {
      audioFileUrl = saveBase64Audio(data.audioData, 'audio-novel');
    } else if (data.audioFileUrl !== undefined) {
      audioFileUrl = String(data.audioFileUrl).trim();
    }
  }

  // Cover image
  let cover = existing.cover;
  if (data.cover !== undefined) {
    if (data.cover && typeof data.cover === 'string' && data.cover.startsWith('data:image/')) {
      cover = saveBase64Image(data.cover, 'covers', 'audio-cover');
    } else {
      cover = data.cover;
    }
  }

  // Novel association check
  let novelId = existing.novel_id;
  if (data.novelId !== undefined) {
    novelId = data.novelId ? String(data.novelId).trim() : null;
    if (novelId) {
      const novel = await queryOne('SELECT id FROM novels WHERE id = ?;', [novelId]);
      if (!novel) novelId = null;
    }
  }

  const description = data.description !== undefined ? String(data.description).trim() : existing.description;
  const audioDuration = data.audioDuration !== undefined ? String(data.audioDuration).trim() : existing.audio_duration;
  const episodeNumber = data.episodeNumber !== undefined ? String(data.episodeNumber).trim() : existing.episode_number;
  const partNumber = data.partNumber !== undefined ? parseInt(data.partNumber, 10) : existing.part_number;
  const language = data.language !== undefined ? String(data.language).trim() : existing.language;
  const status = data.status !== undefined ? (data.status === 'draft' ? 'draft' : 'published') : existing.status;
  const sortOrder = data.sortOrder !== undefined ? parseInt(data.sortOrder, 10) : existing.sort_order;

  await query(`
    UPDATE audio_novels
    SET title = ?,
        novel_id = ?,
        description = ?,
        cover = ?,
        source_type = ?,
        youtube_url = ?,
        youtube_video_id = ?,
        audio_file_url = ?,
        audio_duration = ?,
        episode_number = ?,
        part_number = ?,
        language = ?,
        status = ?,
        sort_order = ?
    WHERE id = ?;
  `, [
    cleanTitle, novelId, description, cover,
    sourceType, youtubeUrl, youtubeVideoId, audioFileUrl,
    audioDuration, episodeNumber, partNumber, language,
    status, sortOrder, id
  ]);

  const updated = await getAudioNovelByIdOrSlug(id, { forAdmin: true });
  return { success: true, audioNovel: updated };
}

/**
 * Delete an Audio Novel from MySQL and remove local audio file if present
 */
export async function deleteAudioNovel(id) {
  const existing = await queryOne('SELECT * FROM audio_novels WHERE id = ?;', [id]);
  if (!existing) {
    return { success: false, error: 'Audio novel not found.' };
  }

  // If local audio file, attempt safe removal
  if (existing.audio_file_url && existing.audio_file_url.startsWith('/uploads/audio/')) {
    try {
      const filename = path.basename(existing.audio_file_url);
      const filePath = path.resolve(__dirname, '../public/uploads/audio', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.warn('[Audio Delete] Could not remove audio file from disk:', e.message);
    }
  }

  await query('DELETE FROM audio_novels WHERE id = ?;', [id]);
  return { success: true };
}
