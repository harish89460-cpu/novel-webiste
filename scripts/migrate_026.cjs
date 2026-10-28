const { query } = require('../backend/db');

async function runMigration() {
  console.log('Running migration 026 with column checks...');

  async function addColumnIfNotExists(table, column, def) {
    const rows = await query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?;
    `, [table, column]);
    if (rows.length === 0) {
      await query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def};`);
      console.log(`Added column ${column} to ${table}.`);
    } else {
      console.log(`Column ${column} already exists in ${table}.`);
    }
  }

  // 1. writer_permissions columns
  await addColumnIfNotExists('writer_permissions', 'access_type', "VARCHAR(20) NOT NULL DEFAULT 'particular'");
  await addColumnIfNotExists('writer_permissions', 'permission_status', "VARCHAR(20) NOT NULL DEFAULT 'active'");
  await addColumnIfNotExists('writer_permissions', 'can_publish_independently', "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfNotExists('writer_permissions', 'can_schedule', "TINYINT(1) NOT NULL DEFAULT 0");
  await addColumnIfNotExists('writer_permissions', 'can_create', "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfNotExists('writer_permissions', 'can_edit', "TINYINT(1) NOT NULL DEFAULT 1");
  await addColumnIfNotExists('writer_permissions', 'can_submit', "TINYINT(1) NOT NULL DEFAULT 1");

  // Backfill
  await query("UPDATE writer_permissions SET access_type = 'full' WHERE full_access = 1;");
  await query("UPDATE writer_permissions SET access_type = 'particular' WHERE full_access = 0 OR full_access IS NULL;");
  await query("UPDATE writer_permissions SET can_publish_independently = 1 WHERE access_level = 'independent_publish' OR full_access = 1;");
  await query("UPDATE writer_permissions SET can_schedule = 1 WHERE access_level = 'independent_publish' OR full_access = 1;");

  // 2. writer_assignments columns
  await query("ALTER TABLE writer_assignments MODIFY COLUMN content_type VARCHAR(50) NOT NULL;");
  await addColumnIfNotExists('writer_assignments', 'actions', "VARCHAR(255) NOT NULL DEFAULT 'create,edit,submit,publish,schedule'");

  // Unique index on writer_assignments
  const existingKeys = await query(`
    SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'writer_assignments'
      AND INDEX_NAME = 'uq_writer_assignment';
  `);
  if (existingKeys.length === 0) {
    await query(`ALTER TABLE writer_assignments ADD UNIQUE KEY uq_writer_assignment (writer_id, content_type, content_id);`);
    console.log('Added unique key uq_writer_assignment.');
  } else {
    console.log('uq_writer_assignment already exists.');
  }

  const pCols = await query('DESCRIBE writer_permissions;');
  console.log('writer_permissions columns:', pCols.map(c => c.Field));
  const aCols = await query('DESCRIBE writer_assignments;');
  console.log('writer_assignments columns:', aCols.map(c => c.Field));

  console.log('Migration 026 completed successfully.');
  process.exit(0);
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
