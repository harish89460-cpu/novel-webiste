// Rudhra Prarthana Novels — Unified Automated Background Publishing Engine
// Runs periodically to automatically publish due scheduled content

import { query, queryOne } from './db.js';
import { createNotification } from './notifications.js';
import { formatISTDisplay } from './timezone.js';

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
 * Master Scheduler Function: Runs scheduled publishing tasks
 */
export async function runAutomatedPublishingScheduler() {
  const articles = await checkAndPublishDueArticles().catch(e => ({ publishedCount: 0, error: e.message }));

  return {
    articlesCount: articles.publishedCount || 0,
    totalPublished: articles.publishedCount || 0
  };
}
