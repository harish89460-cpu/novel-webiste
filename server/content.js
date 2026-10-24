// Content Reading Access Layer for Rudhra Prarthana Novels
// Dynamic MySQL Chapter/Episode Content Delivery with Access Evaluation and Draft Protection

import { queryOne } from './db.js';
import { checkAndPublishDueEpisodes } from './episodes.js';
import { generateNovelSlug } from './novels.js';

/**
 * Retrieve novel chapter content with access evaluation from MySQL
 */
export async function getChapterContent({ novelId, chNum, user }) {
  // Always trigger scheduler to check if any scheduled episodes are now due
  await checkAndPublishDueEpisodes();

  const chStr = String(chNum || '1').trim();
  const isAuthenticated = Boolean(user && user.id);
  const isAdmin = Boolean(user && (user.isAdmin || (user.role && ['admin', 'administrator', 'editor'].includes(user.role.toLowerCase()))));

  let cleanNovelId = String(novelId || '').trim();
  try {
    cleanNovelId = decodeURIComponent(cleanNovelId);
  } catch {}

  const genSlug = generateNovelSlug(cleanNovelId);
  // Resolve novel ID if slug, title, or encoded ID was provided
  const novelRow = await queryOne(
    `SELECT id FROM novels 
     WHERE id = ? 
        OR id = ? 
        OR LOWER(id) = LOWER(?) 
        OR title = ? 
        OR (id = ? AND ? != '')
     LIMIT 1`,
    [novelId, cleanNovelId, cleanNovelId, cleanNovelId, genSlug, genSlug]
  );
  const targetNovelId = novelRow ? novelRow.id : cleanNovelId;

  let chapter = await queryOne(`
    SELECT id, novel_id, parent_id, chapter_num, episode_number, title, title_ta, content,
           is_guest_allowed, is_audio, word_count, read_time, release_date,
           status, scheduled_at, timezone, published_at
    FROM chapters
    WHERE novel_id = ? AND (chapter_num = ? OR episode_number = ? OR CAST(chapter_num AS CHAR) = ?);
  `, [targetNovelId, chStr, chStr, chStr]);

  // If chStr is default '1' or '0' but episodes start with sub-episodes (e.g. 1.1), resolve first published episode
  if (!chapter && (chStr === '1' || chStr === '0' || chStr === '')) {
    chapter = await queryOne(`
      SELECT id, novel_id, parent_id, chapter_num, episode_number, title, title_ta, content,
             is_guest_allowed, is_audio, word_count, read_time, release_date,
             status, scheduled_at, timezone, published_at
      FROM chapters
      WHERE novel_id = ? AND status = 'published'
      ORDER BY sort_order ASC, id ASC
      LIMIT 1;
    `, [targetNovelId]);
  }

  if (!chapter) {
    return {
      allowed: false,
      restricted: false,
      notFound: true,
      message: 'Chapter not found.',
      novelId: targetNovelId,
      chapterNum: chStr
    };
  }

  // 1. Draft & Scheduled Content Protection:
  // Scheduled and Draft episodes are strictly private and hidden from public until publication time
  if (chapter.status !== 'published') {
    if (!isAdmin) {
      return {
        allowed: false,
        restricted: true,
        novelId,
        chapterNum: chStr,
        status: chapter.status,
        message: chapter.status === 'scheduled' 
          ? 'This episode is scheduled for future release and is not yet available.' 
          : 'This episode is currently in draft mode and is not publicly visible.',
        reason: 'unpublished_content'
      };
    }
  }

  // 2. Audio Novel Protection: Members-only for full audio stories
  if (chapter.is_audio === 1) {
    if (!isAuthenticated) {
      return {
        allowed: false,
        restricted: true,
        isAudio: true,
        novelId,
        chapterNum: chStr,
        message: 'Please log in to listen to full audio novels.',
        reason: 'audio_restricted_for_guest',
        redirectHash: `#reader?novel=${encodeURIComponent(novelId)}&ch=${encodeURIComponent(chStr)}`
      };
    }
  }

  // 3. Text Chapters & Episodes:
  const content = chapter.content || '';
  const title = chapter.title || `Episode ${chStr}`;

  return {
    allowed: true,
    restricted: false,
    id: chapter.id,
    novelId,
    parentId: chapter.parent_id,
    chapterNum: chapter.chapter_num,
    episodeNumber: chapter.episode_number || chapter.chapter_num,
    title,
    titleTa: chapter.title_ta || title,
    content,
    isAudio: chapter.is_audio === 1,
    isGuest: !isAuthenticated,
    wordCount: chapter.word_count || '',
    readTime: chapter.read_time || '8 mins',
    releaseDate: chapter.release_date || '',
    status: chapter.status,
    scheduledAt: chapter.scheduled_at,
    publishedAt: chapter.published_at,
    isAdminPreview: isAdmin && chapter.status !== 'published'
  };
}

/**
 * Retrieve Audio Story Access
 */
export async function getAudioAccess({ audioId, user }) {
  const isAuthenticated = Boolean(user && user.id);

  if (isAuthenticated) {
    return {
      allowed: true,
      audioId,
      title: 'Maaya Nadhi Theeram (Full Audio Story)',
      duration: '4h 25m',
      audioUrl: 'https://www.youtube.com/@rudhraprarthanaaudionovels'
    };
  }

  return {
    allowed: false,
    restricted: true,
    audioId,
    message: 'Please log in to listen to full audio stories.',
    reason: 'audio_restricted_for_guest',
    redirectHash: `#audio?id=${encodeURIComponent(audioId || 'maaya-nadhi-theeram')}`
  };
}
