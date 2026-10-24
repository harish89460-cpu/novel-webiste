// Complete Database Backup Script prior to Fake Data Cleanup Audit
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runBackup() {
  const pool = getDb();
  const [tables] = await pool.query('SHOW TABLES');
  const tableKey = Object.keys(tables[0])[0];
  const tableNames = tables.map(t => t[tableKey]);

  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = Date.now();
  const jsonPath = path.join(backupDir, `db_backup_pre_cleanup_${timestamp}.json`);
  const sqlPath = path.join(backupDir, `db_backup_pre_cleanup_${timestamp}.sql`);

  const fullData = {};
  let sqlDump = `-- Rudhra Prarthana Novels — MySQL Database Backup\n-- Created: ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\n\n`;

  console.log('--- STARTING MYSQL BACKUP ---');
  for (const tableName of tableNames) {
    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
    fullData[tableName] = rows;
    console.log(`Backed up table: ${tableName} (${rows.length} rows)`);

    const [[createTbl]] = await pool.query(`SHOW CREATE TABLE \`${tableName}\``);
    sqlDump += `DROP TABLE IF EXISTS \`${tableName}\`;\n${createTbl['Create Table']};\n\n`;

    if (rows.length > 0) {
      const [desc] = await pool.query(`DESCRIBE \`${tableName}\``);
      const cols = desc.map(c => `\`${c.Field}\``).join(', ');
      for (const row of rows) {
        const vals = desc.map(c => {
          const val = row[c.Field];
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return String(val);
          if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
          if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
          const str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          return `'${str}'`;
        }).join(', ');
        sqlDump += `INSERT INTO \`${tableName}\` (${cols}) VALUES (${vals});\n`;
      }
      sqlDump += '\n';
    }
  }

  sqlDump += `SET FOREIGN_KEY_CHECKS=1;\n`;

  fs.writeFileSync(jsonPath, JSON.stringify(fullData, null, 2), 'utf8');
  fs.writeFileSync(sqlPath, sqlDump, 'utf8');

  console.log('----------------------------------------------------');
  console.log('✓ Successfully created JSON backup at:', jsonPath);
  console.log('✓ Successfully created SQL dump at:', sqlPath);
  console.log(`✓ Total tables backed up: ${tableNames.length}`);
  console.log('----------------------------------------------------');
  process.exit(0);
}

runBackup().catch(err => {
  console.error('Database backup failed:', err);
  process.exit(1);
});
