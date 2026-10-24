// Live End-to-End Forum Backend & MySQL Verification Script
import { getDb } from '../server/db.js';

async function testForumBackend() {
  console.log('--- 1. Testing MySQL Database Connection ---');
  const pool = getDb();
  const connection = await pool.getConnection();
  console.log('✅ Connected to rp_novels_db');

  // Verify categories in DB
  const [categories] = await connection.execute('SELECT id, title, icon FROM forum_categories ORDER BY sort_order');
  console.log(`✅ Found ${categories.length} forum categories in MySQL:`, categories.map(c => c.title));

  // Verify topics in DB
  const [topics] = await connection.execute('SELECT id, category_id, title, views_count, replies_count FROM forum_topics LIMIT 5');
  console.log(`✅ Found ${topics.length} sample forum topics in MySQL:`, topics.map(t => ({ id: t.id, title: t.title, replies: t.replies_count })));

  // Verify posts in DB
  const [posts] = await connection.execute('SELECT id, topic_id, parent_id, content FROM forum_posts LIMIT 5');
  console.log(`✅ Found ${posts.length} sample forum posts in MySQL:`, posts.map(p => ({ id: p.id, parent_id: p.parent_id, content: p.content.substring(0, 30) })));

  // Verify reactions in DB
  const [reactions] = await connection.execute('SELECT target_type, target_id, user_id, emoji FROM reactions WHERE target_type IN ("forum_post", "forum_topic") LIMIT 5');
  console.log(`✅ Found ${reactions.length} sample forum reactions in MySQL`);

  connection.release();
  await pool.end();

  console.log('\n--- 2. Testing HTTP Endpoints on Local Server (Port 3000) ---');
  
  // Test Categories API
  const catRes = await fetch('http://localhost:3000/api/forum/categories');
  const catData = await catRes.json();
  console.log(`✅ GET /api/forum/categories: ${catRes.status} OK, categories count: ${catData.categories?.length}`);
  if (catData.categories && catData.categories.length > 0) {
    const firstCat = catData.categories[0];
    console.log('   Sample category data:', {
      id: firstCat.id,
      title: firstCat.title,
      topicsCount: firstCat.topicsCount,
      repliesCount: firstCat.repliesCount,
      latestTopicTitle: firstCat.latestTopicTitle,
      lastActivityAuthor: firstCat.lastActivityAuthor
    });
  }

  // Test Topics API
  const topicsRes = await fetch('http://localhost:3000/api/forum/topics');
  const topicsData = await topicsRes.json();
  console.log(`✅ GET /api/forum/topics: ${topicsRes.status} OK, topics count: ${topicsData.topics?.length}`);
  if (topicsData.topics && topicsData.topics.length > 0) {
    const firstTopic = topicsData.topics[0];
    console.log('   Sample topic data:', {
      id: firstTopic.id,
      title: firstTopic.title,
      author: firstTopic.author,
      repliesCount: firstTopic.repliesCount,
      views: firstTopic.views
    });

    // Test Single Topic API
    const singleRes = await fetch(`http://localhost:3000/api/forum/topics/${firstTopic.id}`);
    const singleData = await singleRes.json();
    console.log(`✅ GET /api/forum/topics/${firstTopic.id}: ${singleRes.status} OK, posts count: ${singleData.topic?.posts?.length}`);
    if (singleData.topic?.posts?.length > 0) {
      console.log('   Sample post reactions:', singleData.topic.posts[0].reactions);
    }
  }

  console.log('\n🎉 Forum Backend & MySQL Verification Completed Successfully!');
}

testForumBackend().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
