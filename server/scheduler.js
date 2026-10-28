// Rudhra Prarthana Novels — Unified Automated Background Publishing Engine
// Runs every 30 seconds independently of browser sessions to automatically publish due scheduled content

import { query, queryOne } from './db.js';
import { refreshNovelStats } from './episodes.js';
import { createNotification } from './notifications.js';
import { formatISTDisplay } from './timezone.js';

/**
 * Checks and publishes due chapters/episodes (both text and audio)
 */
export async function checkAndPublishDueEpisodes() {
  try {
    const dueRows = await query(`
      SELECT c.id, c.novel_id, c.title, c.chapter_num, c.episode_number, c.scheduled_at, c.review_status
      FROM chapters c
      WHERE c.status = 'scheduled'
        AND c.scheduled_at IS NOT NULL
        AND c.scheduled_at <= NOW()
        AND (c.review_status IS NULL OR c.review_status = 'approved' OR c.review_status = 'published');
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

    // Refresh affected novel statistics
    for (const novelId of affectedNovelIds) {
      await refreshNovelStats(novelId).catch(() => {});
    }

    // Notify subscribed readers
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
            message: `${authorName} has published Chapter ${ep.chapter_num || ep.episode_number} of ${novelTitle}.`,
            link: `#reader?novel=${ep.novel_id}&ch=${ep.chapter_num || ep.episode_number}`,
            entityType: 'chapter',
            entityId: `${ep.novel_id}:${ep.chapter_num || ep.episode_number}`
          }).catch(() => {});
        }
      } catch (e) {
        console.warn('Scheduler reader notification warning:', e.message);
      }
    }

    console.log(`[Scheduler] Automatically published ${publishedIds.length} due episode(s).`);
    return { publishedCount: publishedIds.length, published: dueRows };
  } catch (err) {
    console.error('[Scheduler Error] checkAndPublishDueEpisodes:', err.message);
    return { publishedCount: 0, error: err.message };
  }
}

/**
 * Checks and publishes due short stories
 */
export async function checkAndPublishDueShortStories() {
  try {
    const dueRows = await query(`
      SELECT id, title, slug, scheduled_at 
      FROM short_stories
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= NOW()
        AND (review_status IS NULL OR review_status = 'approved' OR review_status = 'published');
    `);

    if (!dueRows || dueRows.length === 0) {
      return { publishedCount: 0, publishedIds: [] };
    }

    const publishedIds = [];
    for (const s of dueRows) {
      await query(`
        UPDATE short_stories
        SET status = 'published',
            published_at = COALESCE(scheduled_at, NOW())
        WHERE id = ? AND status = 'scheduled';
      `, [s.id]);
      publishedIds.push(s.id);
    }

    console.log(`[Scheduler] Automatically published ${publishedIds.length} due short story(s).`);
    return { publishedCount: publishedIds.length, publishedIds };
  } catch (err) {
    console.error('[Scheduler Error] checkAndPublishDueShortStories:', err.message);
    return { publishedCount: 0, error: err.message };
  }
}

/**
 * Checks and publishes due novels
 */
export async function checkAndPublishDueNovels() {
  try {
    const dueNovels = await query(`
      SELECT id, title, scheduled_at
      FROM novels
      WHERE status = 'Scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= NOW();
    `);

    if (!dueNovels || dueNovels.length === 0) {
      return { publishedCount: 0, publishedIds: [] };
    }

    const publishedIds = [];
    for (const n of dueNovels) {
      await query(`
        UPDATE novels
        SET status = 'Ongoing',
            is_published = 1,
            visibility = 'public'
        WHERE id = ? AND status = 'Scheduled';
      `, [n.id]);
      publishedIds.push(n.id);
    }

    console.log(`[Scheduler] Automatically published ${publishedIds.length} due novel(s).`);
    return { publishedCount: publishedIds.length, publishedIds };
  } catch (err) {
    console.error('[Scheduler Error] checkAndPublishDueNovels:', err.message);
    return { publishedCount: 0, error: err.message };
  }
}

/**
 * Checks and publishes due forms content articles
 */
export async function checkAndPublishDueArticles() {
  try {
    const dueArticles = await query(`
      SELECT id, title, scheduled_at
      FROM content_articles
      WHERE status = 'scheduled'
        AND scheduled_at IS NOT NULL
        AND scheduled_at <= NOW();
    `);

    if (!dueArticles || dueArticles.length === 0) {
      return { publishedCount: 0, publishedIds: [] };
    }

    const publishedIds = [];
    for (const a of dueArticles) {
      await query(`
        UPDATE content_articles
        SET status = 'published',
            is_published = 1,
            published_at = COALESCE(scheduled_at, NOW())
        WHERE id = ? AND status = 'scheduled';
      `, [a.id]);
      publishedIds.push(a.id);
    }

    console.log(`[Scheduler] Automatically published ${publishedIds.length} due content article(s).`);
    return { publishedCount: publishedIds.length, publishedIds };
  } catch (err) {
    console.error('[Scheduler Error] checkAndPublishDueArticles:', err.message);
    return { publishedCount: 0, error: err.message };
  }
}

/**
 * Master Scheduler Function: Runs all publishing tasks
 */
export async function runAutomatedPublishingScheduler() {
  const [episodes, stories, novels, articles] = await Promise.all([
    checkAndPublishDueEpisodes().catch(e => ({ publishedCount: 0, error: e.message })),
    checkAndPublishDueShortStories().catch(e => ({ publishedCount: 0, error: e.message })),
    checkAndPublishDueNovels().catch(e => ({ publishedCount: 0, error: e.message })),
    checkAndPublishDueArticles().catch(e => ({ publishedCount: 0, error: e.message }))
  ]);

  return {
    episodesCount: episodes.publishedCount || 0,
    storiesCount: stories.publishedCount || 0,
    novelsCount: novels.publishedCount || 0,
    articlesCount: articles.publishedCount || 0,
    totalPublished: (episodes.publishedCount || 0) + (stories.publishedCount || 0) + (novels.publishedCount || 0) + (articles.publishedCount || 0)
  };
}

