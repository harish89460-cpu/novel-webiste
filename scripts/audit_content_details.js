// Audit content records in detail
import { getDb } from '../backend/db.js';

async function auditContent() {
  const pool = getDb();

  console.log('=== NOVELS ===');
  const [novels] = await pool.query('SELECT id, title, author, status, category, total_episodes, views_count FROM novels');
  console.table(novels);

  console.log('\n=== CHAPTERS ===');
  const [chapters] = await pool.query('SELECT id, novel_id, episode_number, title, is_published, views_count, comments_count FROM chapters');
  console.table(chapters);

  console.log('\n=== AUDIO NOVELS ===');
  const [audio] = await pool.query('SELECT id, title, narrator, duration, episodes_count FROM audio_novels');
  console.table(audio);

  console.log('\n=== FORUM CATEGORIES ===');
  const [cats] = await pool.query('SELECT id, name, slug, description, display_order, topics_count, posts_count FROM forum_categories');
  console.table(cats);

  console.log('\n=== FORUM TOPICS ===');
  const [topics] = await pool.query('SELECT id, category_id, title, author_id, views_count, replies_count, created_at FROM forum_topics');
  console.table(topics);

  console.log('\n=== FORUM POSTS (sample) ===');
  const [posts] = await pool.query('SELECT id, topic_id, author_id, SUBSTRING(content, 1, 60) as snippet, created_at FROM forum_posts');
  console.table(posts);

  console.log('\n=== NOVEL COMMENTS (sample) ===');
  const [comments] = await pool.query('SELECT id, novel_id, chapter_id, author_id, author_name, parent_id, SUBSTRING(content, 1, 60) as snippet, created_at FROM comments');
  console.table(comments);

  process.exit(0);
}

auditContent().catch(console.error);
