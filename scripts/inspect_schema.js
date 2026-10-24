import { query, queryOne } from '../backend/db.js';

async function inspect() {
  const userCols = await query('DESC users;');
  console.log('users columns:', userCols.map(c => c.Field + ' (' + c.Type + ')'));
  
  const userCount = await queryOne("SELECT COUNT(*) as total, SUM(CASE WHEN status != 'blocked' AND status != 'pending_deletion' THEN 1 ELSE 0 END) as valid_members FROM users;");
  console.log('User counts:', userCount);

  const topicCount = await queryOne("SELECT COUNT(*) as topics, SUM(replies_count) as total_replies FROM forum_topics WHERE is_published = 1 AND visibility = 'public';");
  console.log('Topic replies_count sum:', topicCount);

  const postsCols = await query('DESC forum_posts;');
  console.log('forum_posts columns:', postsCols.map(c => c.Field + ' (' + c.Type + ')'));

  // Let's check how forum_posts are related to forum_topics:
  // In getForumTopicByIdFromDb:
  // const posts = await query('SELECT p.* ... FROM forum_posts p WHERE p.topic_id = ? ORDER BY p.id ASC;', [topicId]);
  // The first post or all posts in forum_posts?
  const allPosts = await query('SELECT id, topic_id, parent_id, content FROM forum_posts;');
  console.log('Total forum_posts count:', allPosts.length);
  for (const p of allPosts.slice(0, 10)) {
    console.log(` - Post ID ${p.id}, topic: ${p.topic_id}, parent_id: ${p.parent_id}, snippet: "${p.content.substring(0, 30)}..."`);
  }

  process.exit(0);
}

inspect();
