import { query } from '../backend/db.js';

async function main() {
  const fks = await query(`
    SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'rp_novels_db' AND TABLE_NAME = 'admin_audit_logs';
  `);
  console.log('ADMIN_AUDIT_LOGS KEYS:', fks);

  const cols = await query("SHOW COLUMNS FROM users;");
  console.log('USERS COLUMNS:', cols.map(c => c.Field));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

