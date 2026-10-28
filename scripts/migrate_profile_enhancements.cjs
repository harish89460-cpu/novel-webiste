// scripts/migrate_profile_enhancements.cjs
const db = require('../backend/db.js');

async function run() {
  console.log('--- Applying Profile Enhancement Tables ---');
  await db.query(`
    CREATE TABLE IF NOT EXISTS follows (
      id INT AUTO_INCREMENT PRIMARY KEY,
      follower_id INT NOT NULL,
      following_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_follower_following (follower_id, following_id),
      KEY idx_following (following_id),
      KEY idx_follower (follower_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ follows table verified');

  await db.query(`
    CREATE TABLE IF NOT EXISTS saved_novels (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      novel_id VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_novel (user_id, novel_id),
      KEY idx_user (user_id),
      KEY idx_novel (novel_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ saved_novels table verified');

  await db.query(`
    CREATE TABLE IF NOT EXISTS topic_reads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      topic_id VARCHAR(100) NOT NULL,
      last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_topic (user_id, topic_id),
      KEY idx_user (user_id),
      KEY idx_topic (topic_id),
      KEY idx_last_read (last_read_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ topic_reads table verified');

  console.log('--- Migration completed successfully ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
