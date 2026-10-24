// Inspect all forum_topics, forum_posts, and comments
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupFile = path.resolve(__dirname, '../backups/db_backup_pre_cleanup_1792760935247.json');
const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));

console.log('=== ALL FORUM TOPICS ===');
data.forum_topics.forEach(t => {
  console.log(`[id: ${t.id}] cat: ${t.category_id}, author: ${t.author_id}, title: "${t.title}", created: ${t.created_at}`);
});

console.log('\n=== ALL FORUM POSTS ===');
data.forum_posts.forEach(p => {
  console.log(`[id: ${p.id}] topic: ${p.topic_id}, author: ${p.author_id}, snippet: "${p.content.slice(0, 70).replace(/\n/g, ' ')}"`);
});

console.log('\n=== ALL COMMENTS ===');
data.comments.forEach(c => {
  console.log(`[id: ${c.id}] novel: ${c.novel_id}, ch: ${c.chapter_id}, parent: ${c.parent_id}, author: ${c.author_name} (${c.author_id}), snippet: "${c.content.slice(0, 60).replace(/\n/g, ' ')}"`);
});
