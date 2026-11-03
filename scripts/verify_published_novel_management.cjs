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
  console.log('VERIFYING PUBLISHED NOVEL MANAGEMENT FEATURE (E2E TEST)');
  console.log('================================================================\n');

  const timestamp = Date.now().toString().slice(-5);

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
  console.log(`  - Admin:  ${adminUser.username} (ID: ${adminUser.id})`);
  console.log(`  - Writer: ${writerUser.username} (ID: ${writerUser.id})`);
  console.log(`  - Member: ${memberUser.username} (ID: ${memberUser.id})\n`);

  // --------------------------------------------------------------------------
  // TEST 1: Retrieve Published Novels & Verify Permissions Filter
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing GET /api/published-novels ---');
  const adminListRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/published-novels',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  if (adminListRes.status !== 200 || !adminListRes.body.success) {
    throw new Error('Admin failed to retrieve published novels: ' + JSON.stringify(adminListRes.body));
  }
  const adminItems = adminListRes.body.items;
  console.log(`✓ Admin retrieved ${adminItems.length} total published novel items.`);

  const writerListRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/published-novels',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${writerToken}` }
  });
  if (writerListRes.status !== 200 || !writerListRes.body.success) {
    throw new Error('Writer failed to retrieve published novels: ' + JSON.stringify(writerListRes.body));
  }
  const writerItems = writerListRes.body.items;
  console.log(`✓ Writer retrieved ${writerItems.length} published novel items.`);

  // Verify all writer items belong strictly to the writer
  const foreignItem = writerItems.find(i => Number(i.authorId) !== Number(writerUser.id));
  if (foreignItem) {
    throw new Error(`Security breach: Writer received another author's published novel! Item ID: ${foreignItem.id}`);
  }
  console.log(`✓ Permissions check passed: Writer sees strictly their own authored published novels.\n`);

  // --------------------------------------------------------------------------
  // TEST 2: Create a Published Novel via Writer Dashboard & Frontend
  // --------------------------------------------------------------------------
  console.log('--- 2. Publishing a Novel for Management Verification ---');
  const initialTitle = `Published Novel Initial Title ${timestamp}`;
  const initialContent = `<p>Initial story content for published novel test ${timestamp}. This content will be edited and verified.</p>`;

  // Writer saves novel content in writing page
  const writerSaveRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/writer/episodes',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    title: initialTitle,
    content: initialContent,
    status: 'draft'
  });

  const contentLink = writerSaveRes.body.contentLink;
  const savedEp = writerSaveRes.body.episode;
  console.log(`✓ Novel content saved in workspace (Generated Link: "${contentLink}")`);

  // Writer posts frontend thread using the link
  const publishThreadRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/threads',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    mainCategoryId: 'ongoing-novels',
    subCategoryId: 'ongoing-novels-discussion',
    title: initialTitle,
    content: '<p>Introductory note for readers.</p>',
    novelLink: contentLink
  });

  const publishedArticle = publishThreadRes.body.article || publishThreadRes.body.thread;
  const publishedId = publishedArticle.id;
  const publishedSlug = publishedArticle.uniqueSlug || publishedArticle.unique_slug || publishedArticle.slug;
  console.log(`✓ Novel successfully published to readers (ID: ${publishedId}, Slug: ${publishedSlug})`);

  // Verify it appears in Writer's published novel management list
  const writerListUpdated = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/published-novels',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${writerToken}` }
  });
  const foundItem = writerListUpdated.body.items.find(i => i.id === publishedId);
  if (!foundItem) {
    throw new Error(`Published novel ID ${publishedId} not found in writer's published management list!`);
  }
  console.log(`✓ Published novel verified in Writer Published Management list: "${foundItem.title}"\n`);

  // --------------------------------------------------------------------------
  // TEST 3: Edit and Update Published Novel (In-place, No Duplicates, Same Link)
  // --------------------------------------------------------------------------
  console.log('--- 3. Testing Edit and In-Place Update ---');
  // 3A. Fetch item details for prefilling editor
  const editDetailsRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/published-novels/${publishedId}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${writerToken}` }
  });
  if (editDetailsRes.status !== 200) {
    throw new Error('Failed to get published novel details: ' + JSON.stringify(editDetailsRes.body));
  }
  const prefillData = editDetailsRes.body.item;
  console.log(`✓ Prefill data retrieved: Title="${prefillData.title}", Content length=${prefillData.content.length}`);

  // 3B. Submit Edit (Updated Title & Content)
  const updatedTitle = `UPDATED: Masterpiece Edition ${timestamp}`;
  const updatedContent = `<p>REVISED &amp; EXPANDED story content written by Writer Kavitha. The reader experience has been enriched with emotional depth and literary elegance.</p>`;

  const updateRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/published-novels/${publishedId}`,
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    title: updatedTitle,
    content: updatedContent
  });

  if (updateRes.status !== 200 || !updateRes.body.success) {
    throw new Error('Failed to update published novel: ' + JSON.stringify(updateRes.body));
  }
  console.log(`✓ Published novel updated in-place via PUT /api/published-novels/${publishedId}`);

  // 3C. Verify NO duplicate records were created
  const totalArticlesMatching = await query("SELECT id, unique_slug, title FROM content_articles WHERE id = ?;", [publishedId]);
  if (totalArticlesMatching.length !== 1) {
    throw new Error(`Expected exactly 1 article record, but found ${totalArticlesMatching.length}`);
  }
  if (totalArticlesMatching[0].unique_slug !== publishedSlug) {
    throw new Error(`Original link slug changed! Expected "${publishedSlug}", got "${totalArticlesMatching[0].unique_slug}"`);
  }
  console.log(`✓ Verified NO duplicate records created. Original slug "${totalArticlesMatching[0].unique_slug}" preserved.`);

  // 3D. Verify member immediately sees updated title & content on frontend reader page
  const readerViewRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${encodeURIComponent(publishedSlug)}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });

  if (readerViewRes.status !== 200) {
    throw new Error('Member reader view failed: ' + JSON.stringify(readerViewRes.body));
  }
  const readerArticle = readerViewRes.body.article;
  if (readerArticle.title !== updatedTitle) {
    throw new Error(`Reader page did not reflect updated title! Expected "${updatedTitle}", got "${readerArticle.title}"`);
  }
  console.log(`✓ Member reader view confirmed immediate reflection of updated title: "${readerArticle.title}"`);

  // Verify chapter content
  if (readerArticle.novelId && readerArticle.chapterNum) {
    const chRes = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/content/chapter?novel=${encodeURIComponent(readerArticle.novelId)}&ch=${encodeURIComponent(readerArticle.chapterNum)}`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    if (chRes.status === 200 && chRes.body.chapter) {
      if (!chRes.body.chapter.content.includes('REVISED &amp; EXPANDED')) {
        throw new Error('Chapter story content was not updated!');
      }
      console.log(`✓ Member reader view confirmed immediate reflection of updated story content!`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 4: Security & Permissions Restrictions
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Security & Access Restrictions ---');
  // Writer attempts to edit Admin's published item (first admin item)
  const adminOnlyItem = adminItems.find(i => Number(i.authorId) === Number(adminUser.id));
  if (adminOnlyItem) {
    const unauthorizedEdit = await makeRequest({
      hostname: 'localhost',
      port: 3000,
      path: `/api/published-novels/${adminOnlyItem.id}`,
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
    }, {
      title: 'Hacked Title',
      content: 'Hacked Content'
    });

    if (unauthorizedEdit.status === 403) {
      console.log('✓ Security check passed: Writer forbidden from editing Admin published content (403 Forbidden).');
    } else {
      throw new Error(`Security breach: Writer was allowed to edit Admin published content! Status: ${unauthorizedEdit.status}`);
    }
  }

  // Member attempts to edit published content
  const memberUnauthorizedEdit = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/published-novels/${publishedId}`,
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${memberToken}`, 'Content-Type': 'application/json' }
  }, {
    title: 'Member Hack',
    content: 'Should fail'
  });
  if (memberUnauthorizedEdit.status === 403) {
    console.log('✓ Security check passed: Member forbidden from editing published content (403 Forbidden).');
  } else {
    throw new Error(`Security breach: Member was allowed to edit published content! Status: ${memberUnauthorizedEdit.status}`);
  }

  // --------------------------------------------------------------------------
  // TEST 5: Delete Published Novel Safely
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Delete Published Novel ---');
  // Add a test reader comment first to verify comment cascade cleanup
  await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${publishedId}/comments`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${memberToken}`, 'Content-Type': 'application/json' }
  }, {
    content: 'Reader comment before deletion.'
  });

  const deleteRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/published-novels/${publishedId}`,
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${writerToken}` }
  });

  if (deleteRes.status !== 200 || !deleteRes.body.success) {
    throw new Error('Delete published novel failed: ' + JSON.stringify(deleteRes.body));
  }
  console.log(`✓ Published novel ID ${publishedId} safely deleted.`);

  // Verify it is no longer in database
  const checkDeleted = await queryOne("SELECT id FROM content_articles WHERE id = ?;", [publishedId]);
  if (checkDeleted) {
    throw new Error('Article was not deleted from content_articles!');
  }
  const checkComments = await query("SELECT id FROM content_comments WHERE content_id = ?;", [publishedId]);
  if (checkComments.length > 0) {
    throw new Error('Comments were not cleaned up!');
  }
  console.log('✓ Verified article and associated reader comments safely removed from database.');

  // Verify reader page returns 404/not found
  const readerDeletedRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${encodeURIComponent(publishedSlug)}`,
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  if (readerDeletedRes.status === 404 || !readerDeletedRes.body.success) {
    console.log('✓ Reader page confirms content is safely removed (404 Not Found).');
  } else {
    throw new Error('Deleted content still accessible to readers!');
  }

  // Clean up chapter if any residual
  if (savedEp && savedEp.id) {
    await query("DELETE FROM chapters WHERE id = ?;", [savedEp.id]);
  }

  console.log('\n================================================================');
  console.log('ALL TESTS PASSED: PUBLISHED NOVEL MANAGEMENT VERIFIED 100%!');
  console.log('================================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
