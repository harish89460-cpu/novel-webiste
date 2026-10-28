// scripts/verify_followers_page_system.cjs
// End-to-end Automated Verification of Dedicated Followers & Following Page Subsystem

const http = require('http');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

function request(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failed++;
  }
}

async function runVerification() {
  console.log('===================================================================');
  console.log('   FOLLOWERS & FOLLOWING DEDICATED PAGE SUBSYSTEM E2E TEST         ');
  console.log('===================================================================\n');

  const { createSession } = await import('../backend/auth.js');
  const { query, queryOne } = await import('../backend/db.js');

  const authorToken = await createSession(2, 'author'); // Rudhra Prarthana (ID 2)
  const writerToken = await createSession(37, 'writer'); // Hariram (ID 37)
  const readerToken = await createSession(69, 'reader'); // Hari (ID 69)

  try {
    // -------------------------------------------------------------
    // TEST 1: AUTHENTICATION ENFORCEMENT ON PROTECTED USER ROUTES
    // -------------------------------------------------------------
    console.log('[1/7] Testing Authentication Enforcement on /api/user/* Routes...');
    const unauthFollowers = await request('GET', '/api/user/followers');
    assert(unauthFollowers.status === 401 && unauthFollowers.data?.success === false, 'GET /api/user/followers without token returns 401 Unauthorized');

    const unauthFollowing = await request('GET', '/api/user/following');
    assert(unauthFollowing.status === 401 && unauthFollowing.data?.success === false, 'GET /api/user/following without token returns 401 Unauthorized');

    const unauthUnfollow = await request('DELETE', '/api/user/following/2');
    assert(unauthUnfollow.status === 401, 'DELETE /api/user/following/:id without token returns 401 Unauthorized');

    // -------------------------------------------------------------
    // TEST 2: DATABASE INITIAL STATE & CLEANUP
    // -------------------------------------------------------------
    console.log('\n[2/7] Preparing Database State (User 37 & 69 -> User 2)...');
    await query('DELETE FROM follows WHERE follower_id IN (37, 69) AND following_id = 2;');
    await query('INSERT INTO follows (follower_id, following_id) VALUES (37, 2), (69, 2);');

    const initRows = await query('SELECT * FROM follows WHERE following_id = 2;');
    assert(initRows.length === 2, 'Two followers (37, 69) confirmed in MySQL follows table for user 2');

    // -------------------------------------------------------------
    // TEST 3: GET FOLLOWERS LIST & ACCURATE COUNTS
    // -------------------------------------------------------------
    console.log('\n[3/7] Testing GET /api/user/followers & GET /api/members/:id/followers...');
    const followersRes = await request('GET', '/api/user/followers', null, authorToken);
    assert(followersRes.status === 200 && followersRes.data?.success === true, 'GET /api/user/followers returns HTTP 200');
    assert(followersRes.data?.followersCount === 2, `Accurate followersCount: 2 (got: ${followersRes.data?.followersCount})`);
    assert(Array.isArray(followersRes.data?.users) && followersRes.data.users.length === 2, 'Followers list returns exactly 2 users');

    const firstFollower = followersRes.data.users[0];
    assert(Boolean(firstFollower.username), `Follower username present: ${firstFollower.username}`);
    assert(Boolean(firstFollower.displayName), `Follower displayName present: ${firstFollower.displayName}`);
    assert(Boolean(firstFollower.avatar), `Follower avatar present: ${firstFollower.avatar}`);
    assert(typeof firstFollower.isFollowing === 'boolean', 'Follower isFollowing flag is boolean');

    // Member route lookup
    const memberFollowersRes = await request('GET', '/api/members/rudhra_author/followers');
    assert(memberFollowersRes.status === 200 && memberFollowersRes.data?.followersCount === 2, 'GET /api/members/:id/followers works for public profile lookup');

    // -------------------------------------------------------------
    // TEST 4: GET FOLLOWING LIST & ACCURATE COUNTS
    // -------------------------------------------------------------
    console.log('\n[4/7] Testing GET /api/user/following & Following List...');
    const followingRes = await request('GET', '/api/user/following', null, writerToken);
    assert(followingRes.status === 200 && followingRes.data?.success === true, 'GET /api/user/following returns HTTP 200');
    assert(followingRes.data?.followingCount === 1, `Writer 37 followingCount: 1 (got: ${followingRes.data?.followingCount})`);
    assert(followingRes.data?.users.some(u => u.id === 2), 'Writer 37 is following Author 2');

    // -------------------------------------------------------------
    // TEST 5: SEARCH FUNCTIONALITY ON FOLLOWERS AND FOLLOWING
    // -------------------------------------------------------------
    console.log('\n[5/7] Testing Real-Time Search on Followers and Following...');
    const searchMatch = await request('GET', '/api/user/followers?search=hariram', null, authorToken);
    assert(searchMatch.status === 200 && searchMatch.data?.users?.length === 1, 'Search query "hariram" matches exactly 1 follower');
    assert(searchMatch.data?.users[0]?.username === 'hariram', 'Search returned matching user "hariram"');

    const searchNoMatch = await request('GET', '/api/user/followers?search=nonexistent_query_xyz', null, authorToken);
    assert(searchNoMatch.status === 200 && searchNoMatch.data?.users?.length === 0, 'Non-matching search query returns empty array');

    // -------------------------------------------------------------
    // TEST 6: DIRECT UNFOLLOW ACTION & DATABASE PERSISTENCE
    // -------------------------------------------------------------
    console.log('\n[6/7] Testing Direct Unfollow Action & Database Persistence...');
    // Writer 37 unfollows Author 2 directly
    const unfollowRes = await request('DELETE', '/api/user/following/2', null, writerToken);
    assert(unfollowRes.status === 200 && unfollowRes.data?.success === true, 'DELETE /api/user/following/:id returns 200 success');
    assert(unfollowRes.data?.isFollowing === false, 'isFollowing is false after unfollow');
    assert(unfollowRes.data?.followingCount === 0, 'Updated followingCount: 0');

    // Verify persistence in MySQL
    const dbCheck = await queryOne('SELECT id FROM follows WHERE follower_id = 37 AND following_id = 2;');
    assert(dbCheck === null, 'Follow record is completely removed from MySQL database');

    // Verify subsequent GET returns updated list
    const updatedFollowing = await request('GET', '/api/user/following', null, writerToken);
    assert(updatedFollowing.data?.followingCount === 0, 'Subsequent GET confirms followingCount is 0');
    assert(updatedFollowing.data?.users.length === 0, 'Subsequent GET confirms following list is empty');

    // Re-follow to verify toggle and leave DB in healthy state
    const refollowRes = await request('POST', '/api/members/2/follow', null, writerToken);
    assert(refollowRes.status === 200 && refollowRes.data?.isFollowing === true, 'Re-following Author 2 succeeds');

    const refollowDb = await queryOne('SELECT id FROM follows WHERE follower_id = 37 AND following_id = 2;');
    assert(refollowDb !== null, 'Re-follow persisted in MySQL follows table');

    // Self follow rejection check
    const selfFollow = await request('POST', '/api/members/37/follow', null, writerToken);
    assert(selfFollow.status === 400 && selfFollow.data?.success === false, 'Self-follow is rejected with 400 Bad Request');

    // -------------------------------------------------------------
    // TEST 7: FRONTEND ASSETS & ROUTING VERIFICATION
    // -------------------------------------------------------------
    console.log('\n[7/7] Verifying Frontend Routing, UI Components, and CSS...');
    const appJs = fs.readFileSync('src/js/app.js', 'utf8');
    assert(appJs.includes("hash.startsWith('#followers')"), 'Router supports #followers route');
    assert(appJs.includes("hash.startsWith('#following')"), 'Router supports #following route');
    assert(appJs.includes("function renderFollowersFollowingView"), 'renderFollowersFollowingView component function implemented');
    assert(appJs.includes("window.handleDirectUnfollow"), 'window.handleDirectUnfollow interactive handler implemented');
    assert(appJs.includes("window.switchConnectionsTab"), 'window.switchConnectionsTab handler implemented');
    assert(appJs.includes("window.handleConnectionsSearch"), 'window.handleConnectionsSearch handler implemented');

    // Profile page link integration
    assert(appJs.includes("window.location.hash='#followers?id="), 'Profile Followers metric box links to #followers');
    assert(appJs.includes("window.location.hash='#following?id="), 'Profile Following metric box links to #following');

    const membersCss = fs.readFileSync('src/css/members.css', 'utf8');
    assert(membersCss.includes('.connections-page-wrap'), 'members.css has .connections-page-wrap styling');
    assert(membersCss.includes('.connection-user-card'), 'members.css has .connection-user-card styling');
    assert(membersCss.includes('.connections-tabs-row'), 'members.css has .connections-tabs-row styling');

    const distIndex = fs.readFileSync('frontend/dist/index.html', 'utf8');
    assert(distIndex.length > 500, 'Frontend production build exists and is valid');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n===================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('===================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runVerification();

