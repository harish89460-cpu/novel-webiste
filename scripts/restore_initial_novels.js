import fs from 'node:fs';
import { getDb } from '../backend/db.js';

async function restore() {
  const db = getDb();
  const sql = fs.readFileSync('database_backup_fresh_init.sql', 'utf8');
  const statements = sql.split(/;\r?\n/).map(s => s.trim()).filter(s => s.startsWith('INSERT INTO `chapters`') || s.startsWith('INSERT INTO `novels`'));
  console.log(`Found ${statements.length} statements.`);

  const novelStmts = statements.filter(s => s.startsWith('INSERT INTO `novels`'));
  const chapterStmts = statements.filter(s => s.startsWith('INSERT INTO `chapters`'));
  console.log(`Found ${novelStmts.length} novel statements, ${chapterStmts.length} chapter statements.`);

  for (const stmt of novelStmts) {
    try {
      await db.query(stmt);
    } catch (e) {
      if (!e.message.includes('Duplicate entry')) {
        console.error('Error inserting novel:', e.message);
      }
    }
  }

  for (const stmt of chapterStmts) {
    try {
      await db.query(stmt);
    } catch (e) {
      if (!e.message.includes('Duplicate entry')) {
        console.error('Error inserting chapter:', e.message);
      }
    }
  }

  const [novels] = await db.query('SELECT id, title, category FROM novels');
  console.log('Novels count:', novels.length);
  const [chaps] = await db.query('SELECT count(*) as count FROM chapters');
  console.log('Chapters count:', chaps[0].count);
  process.exit(0);
}

restore().catch(err => {
  console.error(err);
  process.exit(1);
});
