const { query } = require('../backend/db.js');

async function migrate() {
  console.log('Running Writer Management & Submissions Migration...');

  async function addCol(table, colDef, colName) {
    const cols = await query(`DESCRIBE ${table}`);
    if (!cols.some(c => c.Field === colName)) {
      await query(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      console.log(`  ✓ Added ${colName} to ${table}`);
    } else {
      console.log(`  - ${colName} already exists in ${table}`);
    }
  }

  // 1. Add columns to chapters
  await addCol('chapters', 'author_id INT NULL', 'author_id');
  await addCol('chapters', "review_status VARCHAR(50) DEFAULT 'published'", 'review_status');
  await addCol('chapters', 'admin_feedback TEXT NULL', 'admin_feedback');

  // 2. Add columns to short_stories
  await addCol('short_stories', 'author_id INT NULL', 'author_id');
  await addCol('short_stories', "review_status VARCHAR(50) DEFAULT 'published'", 'review_status');
  await addCol('short_stories', 'admin_feedback TEXT NULL', 'admin_feedback');

  // 3. Add columns to audio_novels
  await addCol('audio_novels', 'author_id INT NULL', 'author_id');
  await addCol('audio_novels', "review_status VARCHAR(50) DEFAULT 'published'", 'review_status');
  await addCol('audio_novels', 'admin_feedback TEXT NULL', 'admin_feedback');

  // 4. Create writer_permissions table
  await query(`
    CREATE TABLE IF NOT EXISTS writer_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      writer_id INT NOT NULL UNIQUE,
      can_novels TINYINT(1) DEFAULT 1,
      can_short_stories TINYINT(1) DEFAULT 0,
      can_audio_novels TINYINT(1) DEFAULT 0,
      can_episodes TINYINT(1) DEFAULT 1,
      access_level ENUM('view_only', 'draft_only', 'review_required', 'independent_publish') DEFAULT 'review_required',
      full_access TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (writer_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log('  ✓ writer_permissions table ready');

  // 5. Create writer_assignments table
  await query(`
    CREATE TABLE IF NOT EXISTS writer_assignments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      writer_id INT NOT NULL,
      content_type ENUM('novel', 'short_story', 'audio_novel', 'chapter', 'episode') NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NULL,
      instructions TEXT NULL,
      deadline DATETIME NULL,
      status ENUM('active', 'completed', 'revoked') DEFAULT 'active',
      assigned_by INT DEFAULT 2,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_writer_status (writer_id, status),
      FOREIGN KEY (writer_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log('  ✓ writer_assignments table ready');

  // 6. Create writer_submissions table
  await query(`
    CREATE TABLE IF NOT EXISTS writer_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      writer_id INT NOT NULL,
      content_type ENUM('novel', 'short_story', 'audio_novel', 'chapter', 'episode') NOT NULL,
      content_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      parent_id VARCHAR(100) NULL,
      status ENUM('pending_review', 'approved', 'changes_requested', 'rejected', 'published') DEFAULT 'pending_review',
      admin_notes TEXT NULL,
      scheduled_at DATETIME NULL,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME NULL,
      reviewed_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_submission_status (status),
      INDEX idx_writer (writer_id),
      FOREIGN KEY (writer_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  console.log('  ✓ writer_submissions table ready');

  // Seed default permissions for any existing writer in users table without permissions
  const writers = await query("SELECT id FROM users WHERE role = 'writer';");
  for (const w of writers) {
    await query(`
      INSERT INTO writer_permissions (writer_id, can_novels, can_short_stories, can_audio_novels, can_episodes, access_level, full_access)
      VALUES (?, 1, 1, 1, 1, 'review_required', 0)
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
    `, [w.id]);
  }
  console.log(`  ✓ Initialized default permissions for ${writers.length} writer(s)`);

  console.log('Migration completed successfully.');
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

