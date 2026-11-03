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

async function main() {
  console.log('================================================================');
  console.log('VERIFYING FREE-FORM TITLE & CONTENT IN NOVEL WRITING PAGE');
  console.log('================================================================\n');

  const timestamp = Date.now().toString().slice(-5);

  // 1. Authenticate actual accounts: Admin & Writer
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
  console.log(`  - Admin:  ${adminUser.username} (ID: ${adminUser.id})`);
  console.log(`  - Writer: ${writerUser.username} (ID: ${writerUser.id})`);
  console.log(`  - Member: ${memberUser.username} (ID: ${memberUser.id})\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Admin Novel Writing Page (Free-form Title & Content)
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Admin Novel Content Writing Page (Free Title & Content) ---');
  const adminFreeTitle = `Admin Free Novel Story ${timestamp}`;
  const adminFreeContent = `<p>Admin writes this creative literature freely without choosing Ongoing Novel, Completed Novel, Short Story, or any predefined category selector.</p>`;

  // POST without predefined novelId or category selection
  const adminSaveRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/episodes',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    title: adminFreeTitle,
    content: adminFreeContent,
    status: 'draft'
  });

  if (adminSaveRes.status !== 200 && adminSaveRes.status !== 201) {
    throw new Error('Admin saving novel content failed: ' + JSON.stringify(adminSaveRes.body));
  }
  const adminSavedEp = adminSaveRes.body.episode;
  const adminContentLink = adminSaveRes.body.contentLink;
  console.log(`✓ Admin novel content saved successfully!`);
  console.log(`  - Title Field: "${adminFreeTitle}"`);
  console.log(`  - Status: "${adminSavedEp.status}" (Draft, not published directly)`);
  console.log(`  - Auto-generated Unique Link: "${adminContentLink}"`);

  if (!adminContentLink || !adminContentLink.includes('#reader?novel=')) {
    throw new Error('Invalid admin content link generated: ' + adminContentLink);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Writer Novel Writing Page (Free-form Title & Content)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Writer Novel Content Writing Page (Free Title & Content) ---');
  const writerFreeTitle = `Writer Free Literary Piece ${timestamp}`;
  const writerFreeContent = `<p>Writer Kavitha composes this piece freely without being constrained by predefined options such as Ongoing Novel, Completed Novel, or Short Story.</p>`;

  // POST without predefined novelId or category selection
  const writerSaveRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/writer/episodes',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${writerToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    title: writerFreeTitle,
    content: writerFreeContent,
    status: 'draft'
  });

  if (writerSaveRes.status !== 200 && writerSaveRes.status !== 201) {
    throw new Error('Writer saving novel content failed: ' + JSON.stringify(writerSaveRes.body));
  }
  const writerSavedEp = writerSaveRes.body.episode;
  const writerContentLink = writerSaveRes.body.contentLink;
  console.log(`✓ Writer novel content saved successfully!`);
  console.log(`  - Title Field: "${writerFreeTitle}"`);
  console.log(`  - Status: "${writerSavedEp.status}" (Draft, not published directly)`);
  console.log(`  - Auto-generated Unique Link: "${writerContentLink}"`);

  if (!writerContentLink || !writerContentLink.includes('#reader?novel=')) {
    throw new Error('Invalid writer content link generated: ' + writerContentLink);
  }

  // --------------------------------------------------------------------------
  // TEST 3: Frontend Thread Posting Using the Generated Link
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Frontend Thread Posting with Writer Generated Link ---');
  const threadTitle = `Free Story Thread: ${writerFreeTitle}`;
  const threadPostRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/threads',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${writerToken}`,
      'Content-Type': 'application/json'
    }
  }, {
    mainCategoryId: 'general',
    subCategoryId: 'welcome-to-rudhra-novels',
    title: threadTitle,
    content: '<p>Discussion thread for readers. Please read the linked story below.</p>',
    novelLink: writerContentLink
  });

  if (threadPostRes.status !== 200 && threadPostRes.status !== 201) {
    throw new Error('Posting thread with content link failed: ' + JSON.stringify(threadPostRes.body));
  }

  const thread = threadPostRes.body.article || threadPostRes.body.thread || threadPostRes.body;
  const threadSlug = thread.uniqueSlug || thread.unique_slug || thread.slug || thread.id;
  console.log(`✓ Thread successfully published on frontend (ID: ${thread.id}, Slug: ${threadSlug})`);

  // --------------------------------------------------------------------------
  // TEST 4: Reader Opens Dedicated Reading Page
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Member Reading Page Verification ---');
  const readRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${encodeURIComponent(threadSlug)}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });

  if (readRes.status !== 200 || !readRes.body.success) {
    throw new Error('Reader viewing thread failed: ' + JSON.stringify(readRes.body));
  }

  const readArticle = readRes.body.article;
  console.log(`✓ Member opened thread reader page: "${readArticle.title}"`);
  console.log(`✓ Linked Content: novelId="${readArticle.novelId}", chapter="${readArticle.chapterNum}"`);

  // Verify chapter text is retrievable
  const chRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/chapter?novel=${encodeURIComponent(readArticle.novelId)}&ch=${encodeURIComponent(readArticle.chapterNum)}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });

  if (chRes.status === 200 && chRes.body.success) {
    console.log(`✓ Story content successfully loaded for protected reading (Title: "${chRes.body.chapter.title}")`);
  }

  // --------------------------------------------------------------------------
  // CLEANUP TEST DATA
  // --------------------------------------------------------------------------
  console.log('\n--- Cleaning up test records ---');
  await query("DELETE FROM content_comments WHERE content_id = ?", [thread.id]);
  await query("DELETE FROM content_articles WHERE id = ?", [thread.id]);
  await query("DELETE FROM chapters WHERE id IN (?, ?)", [adminSavedEp.id, writerSavedEp.id]);
  console.log('✓ Test records cleaned up.');

  console.log('\n================================================================');
  console.log('ALL TESTS PASSED: FREE TITLE & CONTENT NOVEL WRITING VERIFIED!');
  console.log('================================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
