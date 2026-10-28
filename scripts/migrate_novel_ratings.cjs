// scripts/migrate_novel_ratings.cjs
const db = require('../backend/db.js');

async function run() {
  console.log('--- Applying Migration 024: novel_ratings ---');
  await db.query(`
    CREATE TABLE IF NOT EXISTS novel_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      novel_id VARCHAR(100) NOT NULL,
      rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_novel_rating (user_id, novel_id),
      KEY idx_novel_ratings_novel (novel_id),
      KEY idx_novel_ratings_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ novel_ratings table verified');
  console.log('--- Migration completed successfully ---');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

