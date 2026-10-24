// Print specific content tables
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupFile = path.resolve(__dirname, '../backups/db_backup_pre_cleanup_1792760935247.json');
const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

const targetTables = ['novels', 'chapters', 'audio_novels', 'forum_categories', 'forum_topics', 'forum_posts', 'comments', 'notifications'];

for (const t of targetTables) {
  console.log(`\n================== ${t} (${data[t].length}) ==================`);
  data[t].forEach((r, i) => {
    const s = {};
    for (const [k, v] of Object.entries(r)) {
      if (typeof v === 'string' && v.length > 60) s[k] = v.slice(0, 60) + '...';
      else s[k] = v;
    }
    console.log(`[${i}]`, JSON.stringify(s));
  });
}
