import { query } from '../server/db.js';

async function run() {
  console.log('Applying Migration 008...');

  const userCols = (await query('DESCRIBE users')).map(c => c.Field);
  if (!userCols.includes('status')) {
    await query("ALTER TABLE users ADD COLUMN status ENUM('active', 'blocked', 'pending_deletion') NOT NULL DEFAULT 'active';");
    console.log('✓ Added status column to users');
  }
  if (!userCols.includes('created_by')) {
    await query('ALTER TABLE users ADD COLUMN created_by INT NULL;');
    console.log('✓ Added created_by column to users');
  }
  if (!userCols.includes('last_login')) {
    await query('ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;');
    console.log('✓ Added last_login column to users');
  }

  const novelCols = (await query('DESCRIBE novels')).map(c => c.Field);
  if (!novelCols.includes('author_id')) {
    await query('ALTER TABLE novels ADD COLUMN author_id INT NULL;');
    console.log('✓ Added author_id column to novels');
  }

  await query('UPDATE novels SET author_id = 2 WHERE author_id IS NULL;');
  console.log('✓ Backfilled author_id = 2 on existing novels');

  await query(`
    CREATE TABLE IF NOT EXISTS writer_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      writer_id INT NULL,
      actor_id INT NULL,
      action VARCHAR(60) NOT NULL,
      details TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_writer (writer_id),
      INDEX idx_audit_actor (actor_id),
      INDEX idx_audit_action (action),
      INDEX idx_audit_created (created_at),
      CONSTRAINT fk_audit_writer FOREIGN KEY (writer_id) REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Ensured writer_audit_logs table exists');

  console.log('Migration 008 successfully applied!');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
