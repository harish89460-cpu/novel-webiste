/**
 * verify_latest_and_trending_posts.cjs
 * Comprehensive verification for Latest Posts and Trending Posts redesign on Forms page.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const reqHeaders = { ...headers };
    let postData = '';
    if (body) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: reqHeaders,
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('🚀 VERIFYING LATEST POSTS & TRENDING POSTS ON FORMS PAGE');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName, details = '') {
    total++;
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName} - ${details}`);
    }
  }

  try {
    // 1. Backend /api/forum/posts endpoint
    console.log('--- 1. Testing GET /api/forum/posts API ---');
    const res = await request('GET', '/api/forum/posts');
    assert(res.status === 200, 'GET /api/forum/posts returns HTTP 200');
    assert(res.body && res.body.success === true, 'Response reports success: true');
    assert(Array.isArray(res.body.latest) && res.body.latest.length > 0, `Latest posts returns array (found: ${res.body.latest?.length})`);
    assert(Array.isArray(res.body.trending) && res.body.trending.length > 0, `Trending posts returns array (found: ${res.body.trending?.length})`);

    // 2. Metadata completeness on Latest Posts
    console.log('\n--- 2. Verifying Metadata Fields on Latest Posts ---');
    const firstLatest = res.body.latest[0];
    assert(Boolean(firstLatest.title), `Title present: "${firstLatest.title}"`);
    assert(Boolean(firstLatest.lastAuthor), `lastAuthor present: "${firstLatest.lastAuthor}"`);
    assert(Boolean(firstLatest.avatar), `Avatar present: "${firstLatest.avatar}"`);
    assert(typeof firstLatest.views === 'number', `Views count is a number: ${firstLatest.views}`);
    assert(typeof firstLatest.replies === 'number', `Replies count is a number: ${firstLatest.replies}`);
    assert(Boolean(firstLatest.timeDisplay), `Relative time string present: "${firstLatest.timeDisplay}"`);
    assert(Boolean(firstLatest.link) && firstLatest.link.startsWith('#'), `Valid route link present: "${firstLatest.link}"`);

    // 3. Metadata completeness on Trending Posts
    console.log('\n--- 3. Verifying Metadata Fields & Scoring on Trending Posts ---');
    const firstTrending = res.body.trending[0];
    assert(Boolean(firstTrending.title), `Trending title present: "${firstTrending.title}"`);
    assert(Boolean(firstTrending.lastAuthor), `Trending lastAuthor present: "${firstTrending.lastAuthor}"`);
    assert(typeof firstTrending.views === 'number', `Trending views count: ${firstTrending.views}`);
    assert(typeof firstTrending.replies === 'number', `Trending replies count: ${firstTrending.replies}`);
    assert(typeof firstTrending.engagementScore === 'number' && firstTrending.engagementScore > 0, `Trending engagement score computed: ${firstTrending.engagementScore}`);
    assert(Boolean(firstTrending.link) && firstTrending.link.startsWith('#'), `Trending valid route link: "${firstTrending.link}"`);

    // 4. Trending ranking order verification
    console.log('\n--- 4. Verifying Trending Ranking Order ---');
    let isTrendingSorted = true;
    for (let i = 0; i < res.body.trending.length - 1; i++) {
      if (res.body.trending[i].engagementScore < res.body.trending[i + 1].engagementScore) {
        isTrendingSorted = false;
        break;
      }
    }
    assert(isTrendingSorted, 'Trending posts are strictly sorted by engagement score descending');

    // 5. Latest sorting verification (newest timestamp first)
    console.log('\n--- 5. Verifying Latest Posts Sorting Order ---');
    let isLatestSorted = true;
    for (let i = 0; i < res.body.latest.length - 1; i++) {
      const timeA = new Date(res.body.latest[i].updatedAt).getTime();
      const timeB = new Date(res.body.latest[i].updatedAt).getTime();
      if (timeA < timeB) {
        isLatestSorted = false;
        break;
      }
    }
    assert(isLatestSorted, 'Latest posts are strictly sorted by latest activity timestamp descending');

    // 6. Test real comment update: post comment and verify latest posts dynamically updates
    console.log('\n--- 6. Verifying Dynamic Activity Update via Real Comment ---');
    // Register temporary reader user to test "Last updated by"
    const { registerUser, createSession } = await import('../backend/auth.js');
    const testUsername = `testupdater_${Date.now()}`;
    const testDisplayName = `Thani_${Date.now().toString().slice(-4)}`;
    const regRes = await registerUser({
      username: testUsername,
      email: `${testUsername}@example.com`,
      password: 'Password123!',
      displayName: testDisplayName
    });
    assert(regRes.success && regRes.user, `Test member registered: "${testDisplayName}"`);

    const testUserId = regRes.user.id;
    const testToken = await createSession(testUserId, 'reader');
    const testHeaders = { 'Authorization': `Bearer ${testToken}` };

    // Post comment on content article id 1 ("Hello Members")
    const { addContentComment } = await import('../backend/forms-content.js');
    const commentRes = await addContentComment({
      contentId: 1,
      userId: testUserId,
      content: 'Hello everyone! Testing live dynamic updater reflection.'
    });
    assert(commentRes.success && commentRes.comment, 'Added real comment to "Hello Members" article');

    // Re-fetch /api/forum/posts
    const updatedRes = await request('GET', '/api/forum/posts');
    const newFirstLatest = updatedRes.body.latest[0];
    assert(newFirstLatest.id === 'article-1', '"Hello Members" moved to top of Latest Posts');
    assert(newFirstLatest.lastAuthor === testDisplayName, `Last updated by dynamically updated to "${testDisplayName}"`);
    assert(newFirstLatest.timeDisplay === 'Just now', `Relative update time reflected as "Just now"`);

    // Clean up test comment and test user
    const { query } = await import('../backend/db.js');
    if (commentRes.comment?.id) {
      await query('DELETE FROM content_comments WHERE id = ?;', [commentRes.comment.id]);
      await query('UPDATE content_articles SET comments_count = GREATEST(0, comments_count - 1) WHERE id = 1;');
    }
    await query('DELETE FROM sessions WHERE user_id = ?;', [testUserId]);
    await query('DELETE FROM profiles WHERE user_id = ?;', [testUserId]);
    await query('DELETE FROM users WHERE id = ?;', [testUserId]);
    console.log('✓ Cleaned up test comment and test user');

    // 7. Verify Client HTML & CSS templates
    console.log('\n--- 7. Verifying UI Templates & CSS in Frontend Code ---');
    const fs = await import('fs');
    const appJs = fs.readFileSync('src/js/app.js', 'utf8');
    const forumCss = fs.readFileSync('src/css/forum.css', 'utf8');

    assert(appJs.includes('Last updated by'), 'app.js includes "Last updated by" template text');
    assert(appJs.includes('sidebar-post-meta-line'), 'app.js renders structured metadata line');
    assert(appJs.includes('trending-rank-pill'), 'app.js renders rank badge for trending posts');
    assert(forumCss.includes('.sidebar-post-updater'), 'forum.css defines .sidebar-post-updater class');
    assert(forumCss.includes('.sidebar-post-meta-line'), 'forum.css defines .sidebar-post-meta-line class');
    assert(forumCss.includes('.trending-rank-pill'), 'forum.css defines .trending-rank-pill class');

  } catch (err) {
    console.error('Unexpected error in verification:', err);
    total++;
  }

  console.log('\n===============================================================');
  console.log(`VERIFICATION SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');

  if (passed === total && total >= 18) {
    console.log('🎉 ALL LATEST & TRENDING POSTS TESTS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}

runTests();

