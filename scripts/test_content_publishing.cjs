const { query } = require('../backend/db.js');
const crypto = require('crypto');

async function testPublishing() {
  console.log('Testing Content & Thread Publishing Operations...');

  const testSlug = 'test-e2e-thread-' + Date.now();
  const testTitle = 'Test Thread ' + Date.now();

  // 1. Create thread via API simulation
  const res = await query(`
    INSERT INTO content_articles (
      main_category_id, sub_category_id, title, unique_slug, content, summary,
      author_id, is_published, status, visibility
    ) VALUES (
      'chit_chat_corner', 'welcome-notes', ?, ?, '<p>Test automated content body</p>', 'Test automated excerpt',
      2, 1, 'published', 'public'
    );
  `, [testTitle, testSlug]);

  const insertedId = res.insertId;
  console.log('✓ Inserted test article ID:', insertedId);

  // 2. Fetch the created thread
  const fetched = await query('SELECT id, title, unique_slug, status FROM content_articles WHERE id = ?;', [insertedId]);
  if (!fetched.length || fetched[0].title !== testTitle) {
    throw new Error('Failed to fetch inserted article');
  }
  console.log('✓ Successfully fetched inserted article:', fetched[0].title);

  // 3. Add a comment to this article
  const commentRes = await query(`
    INSERT INTO content_comments (content_id, user_id, content)
    VALUES (?, 2, 'Test automated comment reply');
  `, [insertedId]);
  console.log('✓ Inserted test comment ID:', commentRes.insertId);

  // 4. Clean up test data
  await query('DELETE FROM content_comments WHERE content_id = ?;', [insertedId]);
  await query('DELETE FROM content_articles WHERE id = ?;', [insertedId]);
  console.log('✓ Cleaned up test content and comment.');

  console.log('\nContent Publishing E2E Operations: ALL PASSED!');
  process.exit(0);
}

testPublishing().catch(err => {
  console.error('Publishing test failed:', err);
  process.exit(1);
});
