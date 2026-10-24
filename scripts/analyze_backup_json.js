// Analyze database backup JSON
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupFile = path.resolve(__dirname, '../backups/db_backup_pre_cleanup_1792760935247.json');
const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

console.log('Tables in backup:', Object.keys(data));

for (const [table, rows] of Object.entries(data)) {
  console.log(`\n========================================`);
  console.log(`TABLE: ${table} (${rows.length} rows)`);
  console.log(`========================================`);
  if (rows.length === 0) {
    console.log('(empty)');
    continue;
  }
  
  if (table === 'sessions') {
    console.log(`Sessions count: ${rows.length}. Sample:`, rows[0]);
    continue;
  }

  // Print summary of records
  rows.forEach((r, idx) => {
    const summary = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'string' && v.length > 50) {
        summary[k] = v.substring(0, 50) + '...';
      } else {
        summary[k] = v;
      }
    }
    console.log(`[${idx}]`, JSON.stringify(summary));
  });
}
