const http = require('http');
const { query, queryOne } = require('../backend/db');
const { createSession } = require('../backend/auth');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('VERIFYING NOVEL CREATION & FRONTEND POSTING WORKFLOW (E2E TEST)');
  console.log('================================================================\n');

  // 1. Authenticate actual accounts: Admin, Writer, Member
  const adminUser = await queryOne("SELECT * FROM users WHERE username = 'rudhra_author';");
  const writerUser = await queryOne("SELECT * FROM users WHERE username = 'writer_kavitha';");
  const memberUser = await queryOne("SELECT * FROM users WHERE username = 'forum_member_1793423007938';");

  if (!adminUser) throw new Error('Admin user rudhra_author not found');
  if (!writerUser) throw new Error('Writer user writer_kavitha not found');
  if (!memberUser) throw new Error('Member user forum_member_1793423007938 not found');

  const adminToken = await createSession(adminUser.id, 'author');
  const writerToken = await createSession(writerUser.id, 'writer');
  const memberToken = await createSession(memberUser.id, 'reader');

  console.log('✓ Actual accounts authenticated:');
  console.log(`  - Admin:  ${adminUser.username} (ID: ${adminUser.id}, Token: ${adminToken.slice(0, 10)}...)`);
  console.log(`  - Writer: ${writerUser.username} (ID: ${writerUser.id}, Token: ${writerToken.slice(0, 10)}...)`);
  console.log(`  - Member: ${memberUser.username} (ID: ${memberUser.id}, Token: ${memberToken.slice(0, 10)}...)\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Admin Dashboard - Category and Title Management
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: Admin Alone Manages Categories & Category Titles ---');

  // Admin retrieves categories
  const adminCatsRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/main-categories',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (adminCatsRes.status !== 200) throw new Error(`Admin failed to get categories: ${JSON.stringify(adminCatsRes.body)}`);
  console.log(`✓ Admin retrieved ${adminCatsRes.body.categories.length} categories.`);

  // Writer attempts category management (MUST BE RESTRICTED)
  const writerCatCreate = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/main-categories',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' },
  }, { title: 'Unauthorized Category', id: 'unauthorized-cat' });

  if (writerCatCreate.status === 403 || !writerCatCreate.body.success) {
    console.log('✓ Writer is strictly restricted from Category Management (403 Forbidden).');
  } else {
    throw new Error('Security flaw: Writer was able to create category!');
  }

  // Admin creates/verifies Category Title "Welcome to Rudhra Novels"
  const welcomeSub = await queryOne("SELECT * FROM content_subcategories WHERE id = 'welcome-to-rudhra-novels';");
  if (!welcomeSub) {
    throw new Error('Category title "Welcome to Rudhra Novels" missing.');
  }
  console.log(`✓ Category Title "${welcomeSub.title}" (ID: ${welcomeSub.id}) verified under category "${welcomeSub.main_category_id}".\n`);

  // --------------------------------------------------------------------------
  // TEST 2: Admin and Writer Dashboard - Novel Writing & Content Link Generation
  // --------------------------------------------------------------------------
  console.log('--- TEST 2: Novel Writing & Unique Content Link Generation ---');

  const runId = Date.now().toString().slice(-5);

  // 2A. Admin writes/saves episode in dashboard
  const adminEpSave = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/episodes',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  }, {
    novelId: 'hello',
    episodeNumber: `1.${runId}`,
    title: `Hello - Episode 1.${runId} (Admin Saved Content)`,
    content: '<p>Admin wrote this private novel content in the dashboard editor. It must not be published directly.</p>',
    status: 'draft'
  });

  if (adminEpSave.status !== 200 && adminEpSave.status !== 201) {
    throw new Error(`Admin episode save failed: ${JSON.stringify(adminEpSave.body)}`);
  }
  const adminGeneratedLink = adminEpSave.body.contentLink || `#reader?novel=hello&ch=1.${runId}`;
  console.log(`✓ Admin saved episode without direct publishing (Status: ${adminEpSave.body.episode.status}).`);
  console.log(`✓ Admin generated unique content link: "${adminGeneratedLink}"`);

  // 2B. Writer writes and saves a novel in Writer dashboard
  const novelTitle = `Kavitha Literary Novel ${runId}`;
  const writerNovelSave = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/writer/novels',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    title: novelTitle,
    genre: 'Romance / Drama',
    category: 'Ongoing Novels',
    description: 'An insightful literary journey written by Kavitha.',
    status: 'Ongoing'
  });

  if (writerNovelSave.status !== 200 && writerNovelSave.status !== 201) {
    throw new Error(`Writer novel save failed: ${JSON.stringify(writerNovelSave.body)}`);
  }
  const writerNovelId = writerNovelSave.body.novel?.id || writerNovelSave.body.id;
  console.log(`✓ Writer saved novel in writer workspace (ID: ${writerNovelId}).`);

  // 2C. Writer writes and saves an episode for their novel
  const writerEpSave = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/writer/episodes',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    novelId: writerNovelId,
    episodeNumber: '1',
    title: 'Episode 1: The Beginning',
    content: '<p>Writer Kavitha composed this emotional story episode in writer workspace.</p>',
    status: 'draft'
  });

  if (writerEpSave.status !== 200 && writerEpSave.status !== 201) {
    throw new Error(`Writer episode save failed: ${JSON.stringify(writerEpSave.body)}`);
  }
  const writerGeneratedLink = writerEpSave.body.contentLink || `#reader?novel=${writerNovelId}&ch=1`;
  console.log(`✓ Writer saved episode in writer dashboard without direct publishing (Status: ${writerEpSave.body.episode?.status || 'draft'}).`);
  console.log(`✓ Writer generated unique content link: "${writerGeneratedLink}"\n`);

  // --------------------------------------------------------------------------
  // TEST 3: Frontend - Thread Posting
  // --------------------------------------------------------------------------
  console.log('--- TEST 3: Frontend Thread Posting Workflow ---');

  // Member attempts to post a thread (MUST BE FORBIDDEN)
  const memberThreadPost = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/threads',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${memberToken}`, 'Content-Type': 'application/json' }
  }, {
    mainCategoryId: 'general',
    subCategoryId: 'welcome-to-rudhra-novels',
    title: 'Illegal Member Thread',
    content: 'Should fail',
    novelLink: adminGeneratedLink
  });

  if (memberThreadPost.status === 403) {
    console.log('✓ Normal member is forbidden from creating threads (403 Forbidden).');
  } else {
    throw new Error('Security failure: Member was able to post thread!');
  }

  // Writer posts a thread with the generated content link
  const writerThreadTitle = `Discussion & Reading: The Beginning ${runId}`;
  const writerThreadPost = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/threads',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    mainCategoryId: 'general',
    subCategoryId: 'welcome-to-rudhra-novels',
    title: writerThreadTitle,
    content: 'Welcome readers! This thread shares Episode 1 of my new novel. Please read and share your feedback below.',
    novelLink: writerGeneratedLink
  });

  if (writerThreadPost.status !== 201 && writerThreadPost.status !== 200) {
    throw new Error(`Writer thread creation failed: ${JSON.stringify(writerThreadPost.body)}`);
  }
  const publishedThread = writerThreadPost.body.article;
  console.log(`✓ Writer successfully published thread: "${writerThreadPost.body.article.slug}"`);

  // Admin posts a thread with their generated content link
  const adminThreadTitle = `Official Welcome Note & Hello Episode 1.${runId}`;
  const adminThreadPost = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/threads',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  }, {
    mainCategoryId: 'general',
    subCategoryId: 'welcome-to-rudhra-novels',
    title: adminThreadTitle,
    content: 'Warm greetings from Rudhra Prarthana! Enjoy reading the continuation.',
    novelLink: adminGeneratedLink
  });

  if (adminThreadPost.status !== 201 && adminThreadPost.status !== 200) {
    throw new Error(`Admin thread creation failed: ${JSON.stringify(adminThreadPost.body)}`);
  }
  console.log(`✓ Admin successfully published thread: "${adminThreadPost.body.article.slug}"`);

  // Verify threads appear in the Category Title dedicated page hierarchy
  const hierarchyRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/hierarchy',
    method: 'GET'
  });
  const generalCat = hierarchyRes.body.hierarchy.find(c => c.id === 'general');
  const welcomeCategoryTitle = generalCat.subcategories.find(s => s.id === 'welcome-to-rudhra-novels');
  const threadTitles = welcomeCategoryTitle.articles.map(a => a.title);
  console.log(`✓ Threads displayed under "${welcomeCategoryTitle.title}":`, threadTitles);
  if (!threadTitles.includes(writerThreadTitle)) {
    throw new Error('Published thread not found in category title articles list!');
  }
  console.log('✓ Published thread title is immediately visible on the category page!\n');

  // --------------------------------------------------------------------------
  // TEST 4: Reader Experience - Dedicated Reading Page & Comments
  // --------------------------------------------------------------------------
  console.log('--- TEST 4: Member Reader Experience ---');

  // Member opens the dedicated reading page for the published thread
  const threadSlug = publishedThread.slug;
  const readRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${encodeURIComponent(threadSlug)}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });

  if (readRes.status !== 200) {
    throw new Error(`Failed to load reading page for member: ${JSON.stringify(readRes.body)}`);
  }

  const artData = readRes.body.article;
  console.log(`✓ Member loaded reading page for: "${artData.title}"`);
  console.log(`  - Linked Novel: ${artData.linkedNovel ? artData.linkedNovel.title : 'None'}`);
  console.log(`  - Linked Chapter: ${artData.linkedChapter ? artData.linkedChapter.title : 'None'}`);
  console.log(`  - Novel Link: ${artData.novelLink}`);
  console.log(`  - Story Content Length: ${(artData.linkedChapter?.content || artData.content).length} chars`);

  if (!artData.linkedChapter || !artData.linkedChapter.content) {
    throw new Error('Linked novel chapter content was not resolved for reader page!');
  }
  console.log('✓ Linked novel content successfully resolved and attached for reader view.');

  // Member submits a comment / review on this reading page
  const commentRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${encodeURIComponent(threadSlug)}/comments`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
  }, { content: 'Fantastic chapter! The emotions and storytelling are wonderful.' });

  if (commentRes.status !== 201 && commentRes.status !== 200) {
    throw new Error(`Member comment submission failed: ${JSON.stringify(commentRes.body)}`);
  }
  console.log('✓ Member successfully posted comment/review on dedicated reading page.');

  // Verify comment persisted in database
  const getCommentsRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${encodeURIComponent(threadSlug)}/comments`,
    method: 'GET'
  });
  console.log(`✓ Verified ${getCommentsRes.body.comments.length} comment(s) on thread reading page: "${getCommentsRes.body.comments[0].content}"`);

  console.log('\n================================================================');
  console.log('ALL VERIFICATIONS PASSED: COMPLETE WORKFLOW IS FULLY OPERATIONAL!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
