// Detailed audit of database records using SELECT *
import { getDb } from '../server/db.js';

async function audit() {
  const pool = getDb();
  const tables = [
    'users', 'profiles', 'novels', 'chapters', 'audio_novels',
    'forum_categories', 'forum_topics', 'forum_posts',
    'comments', 'reactions', 'likes', 'notifications',
    'guest_visitors', 'homepage_sections', 'homepage_section_items'
  ];

  for (const t of tables) {
    try {
      console.log(`\n=== TABLE: ${t} ===`);
      const [rows] = await pool.query(`SELECT * FROM \`${t}\``);
      console.log(`Count: ${rows.length}`);
      if (rows.length > 0) {
        console.table(rows.slice(0, 10));
      }
    } catch (err) {
      console.error(`Error querying ${t}:`, err.message);
    }
  }

  process.exit(0);
}

audit().catch(console.error);
