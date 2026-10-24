// Transactional script to remove confirmed test records and re-sync counts
import { getDb } from '../server/db.js';

async function cleanup() {
  const pool = getDb();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    console.log('--- STARTING TRANSACTIONAL DATABASE CLEANUP ---');

    // 1. Identify comment IDs to delete
    const [testComments] = await conn.query(
      `SELECT id FROM comments WHERE 
       content LIKE '%Verified timestamp:%' 
       OR content LIKE '%real-time SSE%' 
       OR content LIKE '%I completely agree with you on this plot twist! @kavitha_ramasamy%'`
    );
    const commentIds = testComments.map(c => c.id);
    console.log(`Identified ${commentIds.length} test comments to remove`);

    // 2. Delete test reactions
    let deletedReactionsCount = 0;
    if (commentIds.length > 0) {
      const [reacRes] = await conn.query(
        `DELETE FROM reactions WHERE target_type = 'comment' AND target_id IN (${commentIds.join(',')})`
      );
      deletedReactionsCount = reacRes.affectedRows;
    }
    console.log(`Deleted ${deletedReactionsCount} test reactions`);

    // 3. Delete test notifications
    const [notifRes] = await conn.query(
      `DELETE FROM notifications 
       WHERE entity_id LIKE 'topic-discussion-topic-by-author-%'
          OR title LIKE '%Discussion Topic by Author%'
          OR message LIKE '%Verified timestamp%'
          OR title = 'Real-Time SSE Test'
          ${commentIds.length > 0 ? `OR (entity_type = 'comment' AND entity_id IN (${commentIds.map(id => `'${id}'`).join(',')}))` : ''}`
    );
    console.log(`Deleted ${notifRes.affectedRows} test notifications`);

    // 4. Delete test comments (child comments first, then parents if any hierarchy)
    let deletedCommentsCount = 0;
    if (commentIds.length > 0) {
      const [comResChild] = await conn.query(
        `DELETE FROM comments WHERE parent_id IS NOT NULL AND id IN (${commentIds.join(',')})`
      );
      const [comResParent] = await conn.query(
        `DELETE FROM comments WHERE id IN (${commentIds.join(',')})`
      );
      deletedCommentsCount = comResChild.affectedRows + comResParent.affectedRows;
    }
    console.log(`Deleted ${deletedCommentsCount} test comments`);

    // 5. Delete test forum posts
    const [postRes] = await conn.query(
      `DELETE FROM forum_posts WHERE topic_id LIKE 'topic-discussion-topic-by-author-%'`
    );
    console.log(`Deleted ${postRes.affectedRows} test forum posts`);

    // 6. Delete test forum topics
    const [topicRes] = await conn.query(
      `DELETE FROM forum_topics WHERE id LIKE 'topic-discussion-topic-by-author-%'`
    );
    console.log(`Deleted ${topicRes.affectedRows} test forum topics`);

    // 7. Re-sync counts in profiles table
    await conn.query(`
      UPDATE profiles p
      SET 
        topics_count = (SELECT COUNT(*) FROM forum_topics t WHERE t.author_id = p.user_id AND t.is_published = 1),
        posts_count = (SELECT COUNT(*) FROM forum_posts fp WHERE fp.user_id = p.user_id)
    `);
    console.log('Re-synced profiles.topics_count and profiles.posts_count');

    await conn.commit();
    console.log('--- TRANSACTION COMMITTED SUCCESSFULLY ---');

    // 8. Verification
    const [[{ topicCount }]] = await pool.query('SELECT COUNT(*) as topicCount FROM forum_topics');
    const [[{ postCount }]] = await pool.query('SELECT COUNT(*) as postCount FROM forum_posts');
    const [[{ commentCount }]] = await pool.query('SELECT COUNT(*) as commentCount FROM comments');
    const [[{ notifCount }]] = await pool.query('SELECT COUNT(*) as notifCount FROM notifications');
    const [[{ reacCount }]] = await pool.query('SELECT COUNT(*) as reacCount FROM reactions');
    const [profiles] = await pool.query('SELECT user_id, display_name, topics_count, posts_count FROM profiles');

    console.log('\n=== POST-CLEANUP PRODUCTION VERIFICATION ===');
    console.log(`- Remaining genuine forum topics: ${topicCount}`);
    console.log(`- Remaining genuine forum posts: ${postCount}`);
    console.log(`- Remaining genuine comments: ${commentCount}`);
    console.log(`- Remaining genuine reactions: ${reacCount}`);
    console.log(`- Remaining genuine notifications: ${notifCount}`);
    console.log('- User profiles counts:');
    console.table(profiles);

    conn.release();
    process.exit(0);
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('DATABASE CLEANUP FAILED & ROLLED BACK:', err);
    process.exit(1);
  }
}

cleanup();
