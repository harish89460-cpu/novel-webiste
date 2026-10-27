// Script: run_migration_016.js
// Applies Migration 016 for Forum Admin Management & Category Enhancements

import { query, getDb } from '../backend/db.js';

async function run() {
  console.log('--- RUNNING MIGRATION 016: Forum Admin Management & Categories Redesign ---');

  try {
    const dbName = process.env.DB_NAME || 'rp_novels_db';

    // 1. Check and add columns to forum_categories
    console.log('1. Checking forum_categories columns...');
    const catCols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'forum_categories';
    `, [dbName]);
    const catColNames = catCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!catColNames.includes('is_active')) {
      await query(`ALTER TABLE forum_categories ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER sort_order;`);
      console.log('   ✓ Added is_active to forum_categories');
    }
    if (!catColNames.includes('color')) {
      await query(`ALTER TABLE forum_categories ADD COLUMN color VARCHAR(50) NOT NULL DEFAULT '#2E1065' AFTER is_active;`);
      console.log('   ✓ Added color to forum_categories');
    }

    // 2. Check and add columns to forum_topics
    console.log('2. Checking forum_topics columns...');
    const topicCols = await query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'forum_topics';
    `, [dbName]);
    const topicColNames = topicCols.map(c => c.COLUMN_NAME.toLowerCase());

    if (!topicColNames.includes('content')) {
      await query(`ALTER TABLE forum_topics ADD COLUMN content TEXT NULL AFTER title;`);
      console.log('   ✓ Added content to forum_topics');
    }
    if (!topicColNames.includes('image')) {
      await query(`ALTER TABLE forum_topics ADD COLUMN image VARCHAR(255) NULL AFTER content;`);
      console.log('   ✓ Added image to forum_topics');
    }
    if (!topicColNames.includes('is_pinned')) {
      await query(`ALTER TABLE forum_topics ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0 AFTER visibility;`);
      console.log('   ✓ Added is_pinned to forum_topics');
    }
    if (!topicColNames.includes('sort_order')) {
      await query(`ALTER TABLE forum_topics ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER is_pinned;`);
      console.log('   ✓ Added sort_order to forum_topics');
    }

    // 3. Update existing and ensure 5 core categories
    console.log('3. Updating & inserting forum categories...');
    await query(`
      UPDATE forum_categories 
      SET title = 'General', icon = '💬', sort_order = 1, color = '#2E1065', is_active = 1 
      WHERE id = 'general';
    `);

    await query(`
      UPDATE forum_categories 
      SET title = 'Ongoing Novels', icon = '📖', sort_order = 2, color = '#3B0764', is_active = 1 
      WHERE id = 'ongoing-novels';
    `);

    await query(`
      INSERT INTO forum_categories (id, title, description, icon, sort_order, is_active, color)
      VALUES ('completed-novels', 'Completed Novels', 'Discussions, reviews, and reading experiences on completed novels and series.', '📚', 3, 1, '#4C1D95')
      ON DUPLICATE KEY UPDATE 
        title = VALUES(title), 
        icon = VALUES(icon),
        sort_order = VALUES(sort_order),
        is_active = VALUES(is_active),
        color = VALUES(color);
    `);

    await query(`
      UPDATE forum_categories 
      SET title = 'Short Stories', icon = '✍️', sort_order = 4, color = '#581C87', is_active = 1 
      WHERE id = 'short-stories';
    `);

    await query(`
      INSERT INTO forum_categories (id, title, description, icon, sort_order, is_active, color)
      VALUES ('audio-novels', 'Audio Novels', 'Listen, discuss, and review narrated audio novels and voice performances.', '🎧', 5, 1, '#6B21A8')
      ON DUPLICATE KEY UPDATE 
        title = VALUES(title), 
        icon = VALUES(icon),
        sort_order = VALUES(sort_order),
        is_active = VALUES(is_active),
        color = VALUES(color);
    `);

    await query(`UPDATE forum_categories SET sort_order = 6 WHERE id = 'review-junction';`);
    await query(`UPDATE forum_categories SET sort_order = 7 WHERE id = 'tea-time';`);
    console.log('   ✓ Categories synchronized');

    // 4. Backfill content for existing topics from forum_posts if empty
    await query(`
      UPDATE forum_topics t
      SET t.content = (
        SELECT p.content FROM forum_posts p 
        WHERE p.topic_id = t.id 
        ORDER BY p.id ASC LIMIT 1
      )
      WHERE t.content IS NULL OR t.content = '';
    `);
    console.log('   ✓ Backfilled topic content from first post');

    // 5. Record in schema_migrations
    try {
      await query(`
        INSERT INTO schema_migrations (version, name, applied_at)
        VALUES ('016', 'forum_admin_management_and_categories', NOW())
        ON DUPLICATE KEY UPDATE applied_at = NOW();
      `);
      console.log('   ✓ Recorded 016 in schema_migrations');
    } catch (_) {}

    const verifyCats = await query(`SELECT id, title, icon, sort_order, is_active, color FROM forum_categories ORDER BY sort_order;`);
    console.log('Active categories after migration:', verifyCats);

    console.log('=== MIGRATION 016 COMPLETED SUCCESSFULLY ===');
  } catch (err) {
    console.error('Migration 016 Failed:', err);
    process.exit(1);
  } finally {
    const pool = getDb();
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  }
}

run();
