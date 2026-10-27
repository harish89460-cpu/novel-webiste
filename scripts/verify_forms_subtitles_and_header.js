// scripts/verify_forms_subtitles_and_header.js
import http from 'node:http';
import fs from 'node:fs';

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, json: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('VERIFYING HEADER NAVIGATION, GENERAL SUBTITLES & STATS PANELS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Verify Backend API Hierarchy & Statistics
  console.log('--- 1. Testing Backend /api/content/hierarchy ---');
  const apiRes = await get('http://localhost:3000/api/content/hierarchy');
  assert(apiRes.status === 200, 'API endpoint returns HTTP 200');
  assert(apiRes.json?.success === true, 'API response reports success: true');

  const hierarchy = apiRes.json?.hierarchy || [];
  const generalCat = hierarchy.find(c => c.id === 'general');
  assert(!!generalCat, 'General main category exists in hierarchy');
  assert(generalCat?.subcategories?.length === 3, `General has exactly 3 subtitles (found: ${generalCat?.subcategories?.length})`);

  const subTitles = generalCat?.subcategories?.map(s => s.title) || [];
  assert(subTitles.includes('Welcome Notes'), 'Contains "Welcome Notes" subtitle');
  assert(subTitles.includes('Announcements'), 'Contains "Announcements" subtitle');
  assert(subTitles.includes('Tea Time'), 'Contains "Tea Time" subtitle');

  // Verify Subtitle Stats
  const welcomeSub = generalCat?.subcategories?.find(s => s.id === 'welcome-notes');
  assert(welcomeSub?.stats !== null && typeof welcomeSub?.stats === 'object', 'Welcome Notes has stats object');
  assert(typeof welcomeSub?.stats?.totalItems === 'number' && welcomeSub?.stats?.totalItems >= 2, `Welcome Notes has totalItems >= 2 (actual: ${welcomeSub?.stats?.totalItems})`);
  assert(typeof welcomeSub?.stats?.totalComments === 'number', `Welcome Notes has totalComments number (actual: ${welcomeSub?.stats?.totalComments})`);
  assert(typeof welcomeSub?.stats?.totalViews === 'number', `Welcome Notes has totalViews number (actual: ${welcomeSub?.stats?.totalViews})`);
  assert(!!welcomeSub?.stats?.latestTitle, `Welcome Notes has latestTitle (actual: "${welcomeSub?.stats?.latestTitle}")`);

  // Verify Novel Category Stats
  const ongoingCat = hierarchy.find(c => c.id === 'ongoing-novels');
  assert(!!ongoingCat?.stats, 'Ongoing Novels category has precalculated stats object');
  assert(typeof ongoingCat?.stats?.totalItems === 'number' && ongoingCat?.stats?.totalItems > 0, `Ongoing Novels totalItems > 0 (actual: ${ongoingCat?.stats?.totalItems})`);
  assert(typeof ongoingCat?.stats?.totalViews === 'number' && ongoingCat?.stats?.totalViews > 0, `Ongoing Novels totalViews > 0 (actual: ${ongoingCat?.stats?.totalViews})`);

  // 2. Verify Frontend HTML Header
  console.log('\n--- 2. Testing Header Navigation in HTML Files ---');
  ['index.html', 'frontend/index.html', 'frontend/dist/index.html'].forEach(filePath => {
    const html = fs.readFileSync(filePath, 'utf8');
    const navMatch = html.match(/<nav class="nav-desktop"[\s\S]*?<\/nav>/);
    const navHtml = navMatch ? navMatch[0] : '';

    assert(
      navHtml.includes('data-nav="home">Home</a>'),
      `${filePath}: First nav item has data-nav="home" and text "Home"`
    );
    assert(
      !navHtml.match(/data-nav="home">Forms/i),
      `${filePath}: First nav item does NOT say "Forms"`
    );
    assert(
      navHtml.includes('data-nav="forms"'),
      `${filePath}: Second nav item has data-nav="forms"`
    );
    assert(
      navHtml.includes('Forms <span class="nav-link-badge">New</span>'),
      `${filePath}: Second nav item displays "Forms" with "New" badge`
    );
    assert(
      navHtml.includes('href="#forms" class="nav-link" data-nav="home"'),
      `${filePath}: Home link redirects to #forms without separate home page`
    );
  });

  // 3. Verify Router and View Rendering Logic
  console.log('\n--- 3. Testing Frontend Client-Side App Logic ---');
  const appJs = fs.readFileSync('src/js/app.js', 'utf8');

  // Verify General Overview does NOT render individual loose content cards
  assert(
    !appJs.includes('<div class="forms-articles-grid" style="margin-top:10px;">'),
    'app.js removed loose forms-articles-grid from General overview'
  );
  assert(
    appJs.includes('class="forms-sub-row-card"'),
    'app.js renders clean clickable subtitle rows (.forms-sub-row-card)'
  );
  assert(
    appJs.includes('id="sidebar-sub-stats-heading"'),
    'app.js renders Section Statistics panel on dedicated subtitle view'
  );
  assert(
    appJs.includes('id="sidebar-cat-stats-heading"'),
    'app.js renders Category Statistics panel on dedicated category view'
  );

  // 4. Verify CSS Styles
  console.log('\n--- 4. Testing CSS Styles ---');
  const forumCss = fs.readFileSync('src/css/forum.css', 'utf8');
  assert(forumCss.includes('.forms-stats-panel'), 'forum.css defines .forms-stats-panel');
  assert(forumCss.includes('.forms-stats-grid'), 'forum.css defines .forms-stats-grid');
  assert(forumCss.includes('.forms-sub-row-card'), 'forum.css defines .forms-sub-row-card');

  // 5. Test Live HTTP Server Responses
  console.log('\n--- 5. Testing Live Server (http://localhost:3000) ---');
  const serverRes = await get('http://localhost:3000/');
  assert(serverRes.status === 200, 'Server root returns HTTP 200');
  assert(serverRes.raw.includes('data-nav="home">Home</a>'), 'Live server serves Home as first nav link');
  assert(serverRes.raw.includes('data-nav="forms"'), 'Live server serves Forms as second nav link');

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
