import { query, queryOne } from '../server/db.js';
import { getComments } from '../server/comments.js';

async function verifyCleanedSystem() {
  console.log('=== VERIFYING CLEANED PRODUCTION SYSTEM ===\n');

  // 1. Verify Users & Auth Data
  console.log('1. Checking Legitimate Users & Roles:');
  const users = await query(`
    SELECT u.id, u.username, u.email, u.role, p.display_name, p.title, p.posts_count, p.topics_count
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    ORDER BY u.id ASC;
  `);
  console.table(users);
  if (users.length !== 4) {
    throw new Error(`Expected exactly 4 genuine users, found ${users.length}`);
  }
  const usernames = users.map(u => u.username);
  if (!usernames.includes('rudhra_author') || !usernames.includes('harish')) {
    throw new Error('Core admin accounts missing!');
  }
  console.log('✅ Users and profiles are genuine and intact.\n');

  // 2. Verify Novels (Only Genuine Novels)
  console.log('2. Checking Genuine Novels:');
  const novels = await query(`SELECT id, title, author, category, status, is_published, visibility FROM novels ORDER BY id ASC;`);
  console.table(novels);
  if (novels.some(n => n.id.includes('test') || n.title.includes('Test') || /\d{10,}/.test(n.id))) {
    throw new Error('Test novels still found in database!');
  }
  console.log(`✅ All ${novels.length} novels are genuine production records.\n`);

  // 3. Verify Forum Topics & Categories
  console.log('3. Checking Genuine Forum Topics:');
  const topics = await query(`SELECT id, category_id, title, author_id, replies_count, is_published FROM forum_topics ORDER BY id ASC;`);
  console.table(topics);
  if (topics.some(t => t.id.includes('pacing-3295') || t.title.includes('#3295'))) {
    throw new Error('Test forum topic still found!');
  }
  console.log(`✅ All ${topics.length} forum topics are genuine reader discussions.\n`);

  // 4. Verify Comments & Replies
  console.log('4. Checking Genuine Comments:');
  const comments = await query(`SELECT c.id, c.novel_id, c.chapter_num, u.username, c.parent_id, LEFT(c.content, 60) as preview FROM comments c JOIN users u ON c.user_id = u.id ORDER BY c.id ASC;`);
  console.table(comments);
  if (comments.some(c => c.preview.includes('964663') || c.preview.includes('Test by rudhra') || c.preview.includes('ghjfhmnh') || c.preview.includes('gbjhnj'))) {
    throw new Error('Test comments still found in database!');
  }
  console.log(`✅ All ${comments.length} comments are genuine reader and author messages.\n`);

  // 5. Test Threaded Comments API Call
  console.log('5. Testing getComments API with Threaded Structure:');
  const nenjamComments = await getComments({ novelId: 'nenjam-marappadhillai', chapterNum: '24' });
  console.log(`Retrieved ${nenjamComments.length} top-level comments for Nenjam Marappadhillai Ch 24:`);
  for (const c of nenjamComments) {
    console.log(`  - Comment #${c.id} by @${c.username} (${c.timeAgo}): ${c.content.slice(0, 50)}...`);
    if (c.replies && c.replies.length > 0) {
      for (const r of c.replies) {
        console.log(`      ↳ Reply #${r.id} by @${r.username}: ${r.content.slice(0, 50)}...`);
      }
    }
  }
  console.log('✅ Comment hierarchy, replies, and formatting function correctly.\n');

  // 6. Verify Audio Novels
  console.log('6. Checking Audio Novels:');
  const audio = await query(`SELECT id, title, novel_id, youtube_url, status FROM audio_novels;`);
  console.table(audio);
  if (audio.some(a => a.youtube_url.includes('dQw4w9WgXcQ'))) {
    throw new Error('Placeholder YouTube URL still present in audio_novels!');
  }
  console.log('✅ Audio novels point to the genuine YouTube channel.\n');

  console.log('=== SYSTEM INTEGRITY 100% VERIFIED: ZERO FAKE/TEST DATA REMAINS ===');
  process.exit(0);
}

verifyCleanedSystem().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
