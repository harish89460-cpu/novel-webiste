import { query } from '../backend/db.js';
import fs from 'fs';
import path from 'path';

async function createBackup() {
  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sqlPath = path.join(backupDir, `database_backup_${timestamp}.sql`);
  const jsonPath = path.join(backupDir, `database_backup_${timestamp}.json`);

  console.log(`Starting database backup to ${backupDir}...`);

  const tablesResult = await query('SHOW TABLES');
  const tableNames = tablesResult.map(r => Object.values(r)[0]);

  const allData = {};
  let sqlDump = `-- Backup generated on ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\n\n`;

  for (const table of tableNames) {
    const createTableResult = await query(`SHOW CREATE TABLE \`${table}\``);
    const createSql = createTableResult[0]['Create Table'];
    sqlDump += `DROP TABLE IF EXISTS \`${table}\`;\n${createSql};\n\n`;

    const rows = await query(`SELECT * FROM \`${table}\``);
    allData[table] = rows;

    if (rows.length > 0) {
      const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
      for (const row of rows) {
        const vals = Object.values(row).map(val => {
          if (val === null || val === undefined) return 'NULL';
          if (typeof val === 'number') return String(val);
          if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
          const escaped = String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          return `'${escaped}'`;
        }).join(', ');
        sqlDump += `INSERT INTO \`${table}\` (${cols}) VALUES (${vals});\n`;
      }
      sqlDump += '\n';
    }
  }

  sqlDump += 'SET FOREIGN_KEY_CHECKS=1;\n';

  fs.writeFileSync(sqlPath, sqlDump, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(allData, null, 2), 'utf8');

  console.log(`✅ Backup successfully created:\n  SQL:  ${sqlPath}\n  JSON: ${jsonPath}`);
  console.log(`Backed up ${tableNames.length} tables:`);
  for (const table of tableNames) {
    console.log(`  - ${table}: ${allData[table].length} rows`);
  }
}

createBackup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
