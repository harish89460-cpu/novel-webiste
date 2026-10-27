import { query } from '../backend/db.js';

async function main() {
  console.log('Running Migration 019...');
  try {
    await query(`
      ALTER TABLE users
      ADD COLUMN blocked_until DATETIME NULL AFTER status;
    `);
    console.log('Added blocked_until');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') console.log('blocked_until already exists');
    else throw err;
  }

  try {
    await query(`
      ALTER TABLE users
      ADD COLUMN blocked_at DATETIME NULL AFTER blocked_until;
    `);
    console.log('Added blocked_at');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') console.log('blocked_at already exists');
    else throw err;
  }

  try {
    await query(`
      ALTER TABLE users
      ADD COLUMN block_reason VARCHAR(255) NULL AFTER blocked_at;
    `);
    console.log('Added block_reason');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') console.log('block_reason already exists');
    else throw err;
  }

  try {
    await query(`
      ALTER TABLE users
      ADD COLUMN permissions JSON NULL AFTER block_reason;
    `);
    console.log('Added permissions');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') console.log('permissions already exists');
    else throw err;
  }

  const cols = await query('SHOW COLUMNS FROM users;');
  console.log('USERS COLS NOW:', cols.map(c => c.Field));
  console.log('Migration 019 applied successfully!');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

