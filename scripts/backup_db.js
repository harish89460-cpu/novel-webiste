import { query } from '../backend/db.js';
import fs from 'node:fs';

async function backup() {
  const tablesRes = await query('SHOW TABLES;');
  const dbKey = Object.keys(tablesRes[0])[0];
  const tables = tablesRes.map(r => r[dbKey]);
  const dump = {};
  for (const t of tables) {
    dump[t] = await query('SELECT * FROM ' + t + ';');
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `backups/db_backup_form_management_${timestamp}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(dump, null, 2), 'utf8');
  console.log(`Successfully backed up ${tables.length} tables to ${backupPath}`);
  process.exit(0);
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
