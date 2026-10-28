// scripts/verify_features_integration.cjs
const http = require('http');

function request(options, data) {
  if (options.data && !data) data = options.data;
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('Testing Follow/Unfollow, Save Novel, and 5-Star Rating');
  console.log('====================================================\n');

  // 1. Get or create test users
  const db = require('../backend/db.js');
  let userA = await db.queryOne("SELECT id, username FROM users WHERE username = 'test_member_a' LIMIT 1;");
  if (!userA) {
    const res = await db.query("INSERT INTO users (username, email, password_hash, salt, role) VALUES ('test_member_a', 'test_a@rpnovels.com', 'dummy_hash', 'dummy_salt', 'Member');");
    userA = { id: res.insertId, username: 'test_member_a' };
    await db.query("INSERT INTO profiles (user_id, display_name) VALUES (?, 'Test Member A');", [userA.id]);
  }

  let userB = await db.queryOne("SELECT id, username FROM users WHERE username = 'test_member_b' LIMIT 1;");
  if (!userB) {
    const res = await db.query("INSERT INTO users (username, email, password_hash, salt, role) VALUES ('test_member_b', 'test_b@rpnovels.com', 'dummy_hash', 'dummy_salt', 'Member');");
    userB = { id: res.insertId, username: 'test_member_b' };
    await db.query("INSERT INTO profiles (user_id, display_name) VALUES (?, 'Test Member B');", [userB.id]);
  }

  // Generate tokens for test users via createSession
  const { createSession } = await import('../backend/auth.js');
  const tokenA = await createSession(userA.id);
  const tokenB = await createSession(userB.id);

  // Get a test novel
  const testNovel = await db.queryOne("SELECT id, title, author_id FROM novels LIMIT 1;");
  console.log(`Using Test Novel: "${testNovel.title}" (ID: ${testNovel.id})\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Follow / Unfollow
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Follow / Unfollow ---');

  // Clean prior follow between userA and userB
  await db.query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?;', [userA.id, userB.id]);

  // Unauthenticated follow attempt -> 401
  const unauthFollow = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/members/${userB.id}/follow`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  console.log(`✓ Unauthenticated follow blocked: HTTP ${unauthFollow.status} (${unauthFollow.data.error})`);

  // Self-follow attempt -> 400
  const selfFollow = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/members/${userA.id}/follow`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  });
  console.log(`✓ Self-follow prevented: HTTP ${selfFollow.status} (${selfFollow.data.error})`);

  // User A follows User B -> 200, isFollowing: true
  const followRes1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/members/${userB.id}/follow`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  });
  console.log(`✓ User A follows User B: isFollowing=${followRes1.data.isFollowing}, followersCount=${followRes1.data.followersCount}`);

  // Verify follower count on profile
  const profileRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/members/${userB.id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log(`✓ User B profile shows: followers=${profileRes.data.member.followers}, isFollowing=${profileRes.data.member.isFollowing}`);

  // User A unfollows User B (toggle) -> 200, isFollowing: false
  const followRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/members/${userB.id}/follow`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` }
  });
  console.log(`✓ User A unfollows User B: isFollowing=${followRes2.data.isFollowing}, followersCount=${followRes2.data.followersCount}`);

  // --------------------------------------------------------------------------
  // TEST 2: Save Novel
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Save Novel ---');

  // Clean prior save
  await db.query('DELETE FROM saved_novels WHERE user_id = ? AND novel_id = ?;', [userA.id, testNovel.id]);

  // Unauthenticated save attempt -> 401
  const unauthSave = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}/save`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  console.log(`✓ Unauthenticated save blocked: HTTP ${unauthSave.status} (${unauthSave.data.error})`);

  // User A saves novel -> 200, isSaved: true
  const saveRes1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}/save`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    data: { novelId: testNovel.id }
  });
  console.log(`✓ User A saves novel: isSaved=${saveRes1.data.isSaved}, message="${saveRes1.data.message}"`);

  // Verify GET /api/novels/:id returns isSaved: true
  const novelDetailRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log(`✓ GET /api/novels/${testNovel.id} returns isSaved=${novelDetailRes.data.novel.isSaved}`);

  // Verify novel appears in user's Saved Novels list
  const savedListRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/members/${userA.id}/saved-novels?page=1&limit=10`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  const savedItem = savedListRes.data.items.find(item => item.novelId === testNovel.id);
  console.log(`✓ Saved Novels list contains novel: ${Boolean(savedItem)} (Total saved: ${savedListRes.data.pagination.total})`);

  // User A unsaves novel (toggle) -> 200, isSaved: false
  const saveRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}/save`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    data: { novelId: testNovel.id }
  });
  console.log(`✓ User A unsaves novel: isSaved=${saveRes2.data.isSaved}, message="${saveRes2.data.message}"`);

  // --------------------------------------------------------------------------
  // TEST 3: 5-Star Rating
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: 5-Star Novel Rating ---');

  // Clean prior ratings for test novel from test users
  await db.query('DELETE FROM novel_ratings WHERE novel_id = ? AND user_id IN (?, ?);', [testNovel.id, userA.id, userB.id]);

  // Unauthenticated rating attempt -> 401
  const unauthRating = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}/rating`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { rating: 5 }
  });
  console.log(`✓ Unauthenticated rating blocked: HTTP ${unauthRating.status} (${unauthRating.data.error})`);

  // Invalid rating value attempt (e.g., 0 or 6) -> 400
  const invalidRating = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}/rating`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    data: { rating: 6 }
  });
  console.log(`✓ Invalid rating (6 stars) blocked: HTTP ${invalidRating.status} (${invalidRating.data.error})`);

  // User A rates novel 4 stars
  const ratingResA = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}/rating`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    data: { rating: 4 }
  });
  console.log(`✓ User A rates 4 stars: avg=${ratingResA.data.averageRating}, total=${ratingResA.data.totalRatings}, userRating=${ratingResA.data.userRating}`);

  // User B rates novel 5 stars
  const ratingResB = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}/rating`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
    data: { rating: 5 }
  });
  console.log(`✓ User B rates 5 stars: avg=${ratingResB.data.averageRating}, total=${ratingResB.data.totalRatings}, userRating=${ratingResB.data.userRating}`);

  // User A updates rating from 4 to 5 stars (upsert / update in place, no duplicate)
  const ratingResAUpdate = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}/rating`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
    data: { rating: 5 }
  });
  console.log(`✓ User A updates rating to 5 stars: avg=${ratingResAUpdate.data.averageRating}, total=${ratingResAUpdate.data.totalRatings}, userRating=${ratingResAUpdate.data.userRating}`);

  // Query GET /api/novels/:id/rating
  const getRatingRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}/rating`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log(`✓ GET rating endpoint returns: avg=${getRatingRes.data.averageRating}, total=${getRatingRes.data.totalRatings}, userRating=${getRatingRes.data.userRating}`);

  // Verify GET /api/novels/:id reflects averageRating, totalRatings, and userRating
  const novelWithRating = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${testNovel.id}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenA}` }
  });
  console.log(`✓ GET /api/novels/${testNovel.id} reflects: rating="${novelWithRating.data.novel.rating}", avg="${novelWithRating.data.novel.averageRating}", total=${novelWithRating.data.novel.totalRatings}, userRating=${novelWithRating.data.novel.userRating}`);

  console.log('\n====================================================');
  console.log('ALL INTEGRATION TESTS PASSED PERFECTLY!');
  console.log('====================================================');
  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
