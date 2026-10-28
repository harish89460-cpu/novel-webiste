// scripts/migrate_025.cjs
const db = require('../backend/db.js');

async function run() {
  console.log('--- Applying Migration 025: Category Ordering & Audio Novels ---');
  await db.query(`UPDATE forum_categories SET id = 'short-stories' WHERE id = 'Short stories';`);
  await db.query(`
    INSERT INTO forum_categories (id, title, description, icon, color, sort_order, is_active, status, is_disabled, visibility)
    VALUES ('audio-novels', 'Audio Novels', 'Listen to narrated audio novels, immersive voice acting, and background scores.', '🎧', '#312E81', 5, 1, 'published', 0, 'public')
    ON DUPLICATE KEY UPDATE 
      title = VALUES(title),
      description = VALUES(description),
      icon = VALUES(icon);
  `);
  const cats = await db.query('SELECT id, title, sort_order FROM forum_categories ORDER BY sort_order ASC;');
  console.log('Current forum_categories in DB:', cats);
  console.log('--- Migration 025 applied successfully ---');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

