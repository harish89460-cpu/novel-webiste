const { query } = require('../backend/db.js');

async function run() {
  console.log('Applying database compatibility fixes...');

  // 1. Create comments table so legacy and compatibility comments queries never throw ER_NO_SUCH_TABLE
  await query(`
    CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      novel_id VARCHAR(100) NOT NULL,
      chapter_num VARCHAR(50) DEFAULT '0',
      user_id INT NOT NULL,
      parent_id INT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_comments_novel (novel_id, chapter_num),
      INDEX idx_comments_user (user_id),
      INDEX idx_comments_parent (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ comments table verified/created.');

  // 2. Create novel_genres table so /api/genres never throws ER_NO_SUCH_TABLE
  await query(`
    CREATE TABLE IF NOT EXISTS novel_genres (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ novel_genres table verified/created.');

  // 3. Populate default genres if empty
  const genreCount = await query('SELECT COUNT(*) AS count FROM novel_genres;');
  if (genreCount[0].count === 0) {
    await query(`
      INSERT INTO novel_genres (name, slug) VALUES 
      ('Romance', 'romance'),
      ('Family Drama', 'family-drama'),
      ('Social', 'social'),
      ('Thriller', 'thriller'),
      ('Mystery', 'mystery'),
      ('Feel Good', 'feel-good');
    `);
    console.log('✓ Seeded default genres.');
  }

  console.log('All database compatibility fixes applied successfully.');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
