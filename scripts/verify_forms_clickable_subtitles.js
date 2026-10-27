import http from 'node:http';
import fs from 'node:fs';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const opts = { ...options, headers: { ...(options.headers || {}) } };
    let payload = null;
    if (body) {
      payload = typeof body === 'object' ? JSON.stringify(body) : String(body);
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
      if (!opts.headers['Content-Type']) {
        opts.headers['Content-Type'] = 'application/json';
      }
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('RUNNING VERIFICATION: CLICKABLE SUBTITLES & CLEAN CONTENT CARDS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name} - ${details}`);
      failed++;
    }
  }

  // 1. Source Code Verification: Descriptions removed & subtitle links added
  console.log('--- TEST SUITE 1: Code Structure & Descriptions Removal ---');
  const appJs = fs.readFileSync('src/js/app.js', 'utf8');

  // Verify forms-sub-desc removed from forms overview
  const hasSubDescInOverview = appJs.includes('<div class="forms-sub-desc">');
  assert(!hasSubDescInOverview, 'Subtitle description markup removed from Forms overview');

  // Verify card summary description removed from forms overview
  const hasSummaryInCards = appJs.includes('${art.summary ? `<div style="font-size:12px;');
  assert(!hasSummaryInCards, 'Content card summary description removed from article cards');

  // Verify subtitle titles are clickable links
  assert(appJs.includes('class="forms-sub-title-link"'), 'Subtitle titles use clickable link class "forms-sub-title-link"');
  assert(appJs.includes('#forms?sub='), 'Subtitle titles link to dedicated subpage route "#forms?sub="');

  // 2. CSS Styles Verification
  console.log('\n--- TEST SUITE 2: CSS Styling Verification ---');
  const forumCss = fs.readFileSync('src/css/forum.css', 'utf8');
  assert(forumCss.includes('.forms-sub-title-link'), '.forms-sub-title-link CSS class defined');
  assert(forumCss.includes('.forms-subpage-header-bar'), '.forms-subpage-header-bar CSS class defined');
  assert(forumCss.includes('.forms-subpage-articles-card'), '.forms-subpage-articles-card CSS class defined');

  // 3. Admin & Member Authentication
  console.log('\n--- TEST SUITE 3: Authentication & Role Verification ---');
  const adminLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'rudhra_author',
    password: 'Rudhra.pass'
  });

  const adminToken = adminLoginRes.body?.token;
  assert(adminLoginRes.status === 200 && adminToken, 'Admin authenticated');

  let memberToken = null;
  const memberRegRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'subtester_' + Date.now(),
    email: `subtester_${Date.now()}@example.com`,
    password: 'Password123!',
    display_name: 'Sub Tester'
  });

  if (memberRegRes.status === 201 && memberRegRes.body?.token) {
    memberToken = memberRegRes.body.token;
  } else {
    // Try login
    const mLogin = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      email: 'reader1@example.com',
      password: 'Password123!'
    });
    memberToken = mLogin.body?.token;
  }

  assert(memberToken !== null, 'Regular member authenticated');

  // 4. Content Hierarchy & Subtitle Route Verification
  console.log('\n--- TEST SUITE 4: Content Hierarchy & Subtitle Navigation ---');
  const hierRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/hierarchy',
    method: 'GET'
  });

  assert(hierRes.status === 200 && hierRes.body?.success, 'Content hierarchy API returns HTTP 200');
  const hierarchy = hierRes.body?.hierarchy || [];

  const generalCat = hierarchy.find(c => c.id === 'general');
  assert(generalCat !== undefined, 'General Main Title exists');

  const welcomeNotes = generalCat?.subcategories?.find(s => s.id === 'welcome-notes');
  assert(welcomeNotes !== undefined, 'Sub Title "Welcome Notes" exists (ID: welcome-notes)');

  // Verify Welcome Notes contains Hello Members and Welcome to Our Community
  const articlesInWelcome = welcomeNotes?.articles || [];
  const helloMembers = articlesInWelcome.find(a => (a.uniqueSlug === 'hello-members' || a.title === 'Hello Members'));
  const welcomeCommunity = articlesInWelcome.find(a => (a.uniqueSlug === 'welcome-to-our-community' || a.title === 'Welcome to Our Community'));

  assert(helloMembers !== undefined, 'Content Title "Hello Members" listed under Welcome Notes');
  assert(welcomeCommunity !== undefined, 'Content Title "Welcome to Our Community" listed under Welcome Notes');

  // Verify dedicated reading page for Hello Members
  const helloReadRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/articles/hello-members',
    method: 'GET'
  });
  assert(helloReadRes.status === 200 && helloReadRes.body?.article?.title === 'Hello Members', 'Opening Hello Members loads full reading page');
  assert(helloReadRes.body?.article?.content && helloReadRes.body?.article?.content.length > 50, 'Full reading content formatted properly');

  // 5. Admin-Only (+) Button: Create New Content Under Subtitle
  console.log('\n--- TEST SUITE 5: Admin-Only Add Content Under Subtitle ---');
  const newSlug = 'new-announcement-' + Date.now();
  const createArtRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/articles',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    main_category_id: 'general',
    sub_category_id: 'welcome-notes',
    title: 'New Community Note ' + Date.now(),
    unique_slug: newSlug,
    content: 'Welcome everyone! This is a newly published reading note created directly under Welcome Notes.',
    author_name: 'Rudhra Prarthana',
    status: 'published',
    sort_order: 10
  });

  assert(createArtRes.status === 201 && createArtRes.body?.success, 'Admin creates new content title under Welcome Notes');
  const newArticleId = createArtRes.body?.id || createArtRes.body?.article?.id;

  // Verify new content item appears under Welcome Notes hierarchy
  const hierUpdatedRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/hierarchy',
    method: 'GET'
  });
  const updatedWelcome = hierUpdatedRes.body?.hierarchy?.find(c => c.id === 'general')?.subcategories?.find(s => s.id === 'welcome-notes');
  const foundNewArticle = updatedWelcome?.articles?.find(a => a.uniqueSlug === newSlug);
  assert(foundNewArticle !== undefined, 'New content article immediately appears under Welcome Notes');

  // Verify new content item reading page works
  const readNewRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${newSlug}`,
    method: 'GET'
  });
  assert(readNewRes.status === 200 && readNewRes.body?.article?.uniqueSlug === newSlug, 'New content title reading page opens correctly');

  // 6. Security: Non-Admin / Member Cannot Create Content
  console.log('\n--- TEST SUITE 6: Access Control & Permissions Enforcement ---');
  const memberCreateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/articles',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`
    }
  }, {
    main_category_id: 'general',
    sub_category_id: 'welcome-notes',
    title: 'Unauthorized Article',
    unique_slug: 'unauthorized-article',
    content: 'This should be blocked',
    author_name: 'Hacker',
    status: 'published'
  });

  assert(memberCreateRes.status === 403, 'Regular member blocked from creating content (HTTP 403 Forbidden)');

  const guestCreateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/articles',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    main_category_id: 'general',
    sub_category_id: 'welcome-notes',
    title: 'Guest Article',
    unique_slug: 'guest-article',
    content: 'This should be blocked',
    author_name: 'Guest'
  });

  assert(guestCreateRes.status === 401 || guestCreateRes.status === 403, 'Guest blocked from creating content (HTTP 401/403)');

  // 7. Cleanup Test Records
  console.log('\n--- TEST SUITE 7: Safe Cleanup of Test Content ---');
  if (newArticleId) {
    const deleteRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/content/articles/${newArticleId}`,
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    }, { confirm: true, confirmTitle: 'yes' });
    assert(deleteRes.status === 200 && deleteRes.body?.success, 'Test content safely cleaned up', JSON.stringify({ status: deleteRes.status, body: deleteRes.body, newArticleId }));
  }

  // Summary
  console.log('\n================================================================');
  console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
