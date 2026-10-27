// scripts/run_migration_014.js
import { query } from '../backend/db.js';

async function run() {
  console.log('Running migration 014...');

  // 1. Create reading_sessions table
  await query(`
    CREATE TABLE IF NOT EXISTS reading_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      novel_id VARCHAR(100) NOT NULL,
      chapter_num VARCHAR(50) NOT NULL,
      session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP NULL,
      duration_seconds INT DEFAULT 0,
      is_active TINYINT(1) DEFAULT 1,
      tab_id VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reading_sessions_user_active (user_id, is_active),
      INDEX idx_reading_sessions_last_active (user_id, last_active_at),
      CONSTRAINT fk_reading_session_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ reading_sessions table created or verified');

  // 2. Check and add columns to activity_status
  const existingCols = (await query(`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activity_status';
  `)).map(r => r.COLUMN_NAME);

  const colsToAdd = [
    { name: 'current_novel_id', def: 'VARCHAR(100) NULL' },
    { name: 'current_chapter_num', def: 'VARCHAR(50) NULL' },
    { name: 'reading_session_start', def: 'TIMESTAMP NULL' },
    { name: 'reading_last_active', def: 'TIMESTAMP NULL' },
    { name: 'reading_duration_seconds', def: 'INT DEFAULT 0' },
    { name: 'is_reading', def: 'TINYINT(1) DEFAULT 0' },
    { name: 'last_read_novel_id', def: 'VARCHAR(100) NULL' },
    { name: 'last_read_chapter_num', def: 'VARCHAR(50) NULL' },
    { name: 'last_read_at', def: 'TIMESTAMP NULL' },
    { name: 'last_read_duration_seconds', def: 'INT DEFAULT 0' }
  ];

  for (const col of colsToAdd) {
    if (!existingCols.includes(col.name)) {
      console.log('Adding column to activity_status:', col.name);
      await query(`ALTER TABLE activity_status ADD COLUMN \`${col.name}\` ${col.def};`);
    } else {
      console.log('Column already exists in activity_status:', col.name);
    }
  }

  // 3. Populate existing last_read from reading_progress
  await query(`
    UPDATE activity_status a
    JOIN (
      SELECT user_id, novel_id, chapter_num, last_read_at
      FROM (
        SELECT user_id, novel_id, chapter_num, last_read_at,
               ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY last_read_at DESC) as rn
        FROM reading_progress
      ) ranked
      WHERE rn = 1
    ) r ON a.user_id = r.user_id
    SET 
      a.last_read_novel_id = r.novel_id,
      a.last_read_chapter_num = r.chapter_num,
      a.last_read_at = r.last_read_at
    WHERE a.last_read_novel_id IS NULL;
  `);
  console.log('✓ Populated existing last-read info');

  const check = await query('SELECT * FROM activity_status');
  console.log('Current activity_status rows:', check);
}

run().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
