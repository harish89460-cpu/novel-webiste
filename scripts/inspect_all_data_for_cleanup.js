import { query } from '../backend/db.js';

async function inspectData() {
  console.log('=== 1. USERS & PROFILES ===');
  const users = await query(`
    SELECT u.id, u.username, u.email, u.role, u.created_at,
           p.display_name, p.title, p.bio, p.avatar
    FROM users u
    LEFT JOIN profiles p ON u.id = p.user_id
    ORDER BY u.id ASC;
  `);
  console.log(JSON.stringify(users, null, 2));

  console.log('\n=== 2. NOVELS ===');
  const novels = await query(`
    SELECT id, title, tamil_title, author_name, status, total_episodes, free_episodes, created_at
    FROM novels
    ORDER BY id ASC;
  `);
  console.log(JSON.stringify(novels, null, 2));

  console.log('\n=== 3. CHAPTERS ===');
  const chapters = await query(`
    SELECT id, novel_id, chapter_num, title, is_free, created_at
    FROM chapters
    ORDER BY novel_id, chapter_num ASC;
  `);
  console.log(JSON.stringify(chapters, null, 2));

  console.log('\n=== 4. FORUM TOPICS & POSTS ===');
  const topics = await query(`
    SELECT t.id, t.category_id, t.title, t.slug, t.user_id, t.views_count, t.replies_count, t.is_locked, t.is_pinned, t.created_at
    FROM forum_topics t
    ORDER BY t.id ASC;
  `);
  console.log(JSON.stringify(topics, null, 2));

  const posts = await query(`
    SELECT p.id, p.topic_id, p.user_id, LEFT(p.content, 80) AS snippet, p.created_at
    FROM forum_posts p
    ORDER BY p.id ASC;
  `);
  console.log(JSON.stringify(posts, null, 2));

  console.log('\n=== 5. COMMENTS ===');
  const comments = await query(`
    SELECT c.id, c.novel_id, c.chapter_num, c.user_id, c.parent_id, LEFT(c.content, 100) AS snippet, c.created_at
    FROM comments c
    ORDER BY c.id ASC;
  `);
  console.log(JSON.stringify(comments, null, 2));

  console.log('\n=== 6. GUEST VISITORS ===');
  const guests = await query(`
    SELECT id, visitor_hash, ip_address, user_agent, page_views, first_visited_at, last_visited_at
    FROM guest_visitors
    ORDER BY id ASC;
  `);
  console.log(JSON.stringify(guests, null, 2));

  console.log('\n=== 7. SITE SETTINGS & HOMEPAGE SECTIONS ===');
  const settings = await query(`SELECT * FROM site_settings;`);
  console.log('Site settings:', JSON.stringify(settings, null, 2));
  const sections = await query(`SELECT * FROM homepage_sections;`);
  console.log('Homepage sections:', JSON.stringify(sections, null, 2));
}

inspectData().catch(console.error).finally(() => process.exit(0));
