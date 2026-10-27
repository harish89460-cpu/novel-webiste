import { query } from '../backend/db.js';

async function run() {
  console.log('Running migration 018: Add novel_id and chapter_num to forum_topics...');
  
  const cols = await query('DESCRIBE forum_topics');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('novel_id')) {
    await query('ALTER TABLE forum_topics ADD COLUMN novel_id VARCHAR(100) NULL AFTER category_title');
    console.log('Added novel_id column to forum_topics');
  }

  if (!colNames.includes('chapter_num')) {
    await query('ALTER TABLE forum_topics ADD COLUMN chapter_num VARCHAR(50) NULL AFTER novel_id');
    console.log('Added chapter_num column to forum_topics');
  }

  // Populate novel_id for all existing topics
  await query("UPDATE forum_topics SET novel_id = 'kaadhal-konden-kanave', chapter_num = '18' WHERE id = 'topic-kaadhal-kanave-18'");
  await query("UPDATE forum_topics SET novel_id = 'nenjam-marappadhillai', chapter_num = '24' WHERE id = 'topic-nenjam-24'");
  await query("UPDATE forum_topics SET novel_id = 'kaadhal-konden-kanave' WHERE id = 'topic-tamil-kanave'");
  await query("UPDATE forum_topics SET novel_id = 'poongaatru-punnagaikka' WHERE id = 'topic-short-story'");
  await query("UPDATE forum_topics SET novel_id = 'nenjam-marappadhillai' WHERE id = 'topic-review-style'");
  await query("UPDATE forum_topics SET novel_id = 'nenjam-marappadhillai' WHERE id = 'topic-rain-coffee'");

  // Also ensure topics exist for the other major novels:
  // uyire-unakkaga, vizhigalil-vizhundha-kavithai, maaya-nadhi-theeram
  const existingUyire = await query("SELECT id FROM forum_topics WHERE id = 'topic-uyire-unakkaga'");
  if (existingUyire.length === 0) {
    await query(`
      INSERT INTO forum_topics (id, category_id, category_title, novel_id, chapter_num, title, content, author_id, views_count, replies_count, is_published, visibility)
      VALUES ('topic-uyire-unakkaga', 'completed-novels', 'COMPLETED NOVELS', 'uyire-unakkaga', NULL, 'Uyire Unakkaga — Readers Reflections & Discussion', 'Share your thoughts, reviews, and favorite moments from Uyire Unakkaga!', 2, 85, 0, 1, 'public')
    `);
    console.log('Created discussion topic for Uyire Unakkaga');
  }

  const existingVizhi = await query("SELECT id FROM forum_topics WHERE id = 'topic-vizhigalil-kavithai'");
  if (existingVizhi.length === 0) {
    await query(`
      INSERT INTO forum_topics (id, category_id, category_title, novel_id, chapter_num, title, content, author_id, views_count, replies_count, is_published, visibility)
      VALUES ('topic-vizhigalil-kavithai', 'completed-novels', 'COMPLETED NOVELS', 'vizhigalil-vizhundha-kavithai', NULL, 'Vizhigalil Vizhundha Kavithai — Poetry, Romance & Reader Discussion', 'A poetic tale where silent glances speak louder than words. Discuss your reflections here!', 2, 92, 0, 1, 'public')
    `);
    console.log('Created discussion topic for Vizhigalil Vizhundha Kavithai');
  }

  const existingMaaya = await query("SELECT id FROM forum_topics WHERE id = 'topic-maaya-nadhi'");
  if (existingMaaya.length === 0) {
    await query(`
      INSERT INTO forum_topics (id, category_id, category_title, novel_id, chapter_num, title, content, author_id, views_count, replies_count, is_published, visibility)
      VALUES ('topic-maaya-nadhi', 'ongoing-novels', 'ONGOING NOVELS', 'maaya-nadhi-theeram', NULL, 'Maaya Nadhi Theeram — Mystery, Clues & Discussion', 'Unravel the mysteries along the riverbank. Drop your theories and predictions!', 2, 78, 3, 1, 'public')
    `);
    console.log('Created discussion topic for Maaya Nadhi Theeram');
  }

  // Update replies_count to reflect actual comments
  const nenjamCount = await query("SELECT COUNT(*) as cnt FROM comments WHERE novel_id = 'nenjam-marappadhillai'");
  await query("UPDATE forum_topics SET replies_count = ? WHERE id = 'topic-nenjam-24'", [nenjamCount[0].cnt]);

  const kkkCount = await query("SELECT COUNT(*) as cnt FROM comments WHERE novel_id = 'kaadhal-konden-kanave'");
  await query("UPDATE forum_topics SET replies_count = ? WHERE id = 'topic-kaadhal-kanave-18'", [kkkCount[0].cnt]);

  const maayaCount = await query("SELECT COUNT(*) as cnt FROM comments WHERE novel_id = 'maaya-nadhi-theeram'");
  await query("UPDATE forum_topics SET replies_count = ? WHERE id = 'topic-maaya-nadhi'", [maayaCount[0].cnt]);

  const allTopics = await query('SELECT id, category_id, novel_id, chapter_num, title, replies_count, views_count FROM forum_topics WHERE is_published = 1');
  console.log('Active forum_topics:');
  console.table(allTopics);

  console.log('Migration 018 finished successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration 018 failed:', err);
  process.exit(1);
});
