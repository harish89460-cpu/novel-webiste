// Comprehensive Verification Suite for Chapter Edit Functionality
// Verifies that editing a chapter modifies ONLY the chapter title in MySQL,
// does not modify episode content, and preserves all associated episodes and relationships.

const http = require('http');

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
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

async function run() {
  console.log('===================================================================');
  console.log('   CHAPTER EDIT FUNCTIONALITY: END-TO-END VERIFICATION             ');
  console.log('===================================================================\n');

  const { getDb } = await import('../backend/db.js');
  const { createSession } = await import('../backend/auth.js');
  const pool = getDb();

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Prepare target novel, writer, and sessions
  console.log('[1/4] Preparing test environment & credentials...');
  const [novels] = await pool.query('SELECT id, title FROM novels LIMIT 1;');
  const targetNovel = novels[0];
  assert(Boolean(targetNovel), `Target novel found: "${targetNovel?.title}" (ID: ${targetNovel?.id})`);

  const [writers] = await pool.query("SELECT id, username, email FROM users WHERE role = 'writer' LIMIT 1;");
  const targetWriter = writers[0] || { id: 2, username: 'writer' };
  assert(Boolean(targetWriter), `Target writer found: "${targetWriter.username}" (ID: ${targetWriter.id})`);

  const adminToken = await createSession(2, 'author');
  const writerToken = await createSession(targetWriter.id, 'writer');

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
    'Cookie': `rp_auth_token=${adminToken}`
  };

  const writerHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${writerToken}`,
    'Cookie': `rp_auth_token=${writerToken}`
  };

  // Ensure writer has permissions
  await pool.query(`
    INSERT INTO writer_permissions (writer_id, access_type, permission_status, can_novels, can_episodes, can_publish_independently, can_schedule, can_create, can_edit, can_submit)
    VALUES (?, 'full', 'active', 1, 1, 1, 1, 1, 1, 1)
    ON DUPLICATE KEY UPDATE access_type = 'full', permission_status = 'active', can_novels = 1, can_episodes = 1, can_publish_independently = 1;
  `, [targetWriter.id]);

  // 2. Setup initial chapter with an associated episode
  console.log('\n[2/4] Setting up test chapter and associated episode with rich content...');
  const initialChapterTitle = `Initial Chapter ${Date.now()}`;
  const createChapRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/episodes',
    method: 'POST',
    headers: adminHeaders
  }, {
    novelId: targetNovel.id,
    parentId: null,
    title: initialChapterTitle,
    status: 'published',
    content: ''
  });

  const testChapter = createChapRes.body?.episode;
  assert(Boolean(testChapter?.id), `Initial chapter created (ID: ${testChapter?.id})`);

  const episodeStoryContent = '<p>This is crucial episode story text that MUST NOT be modified or lost during chapter title edit.</p>';
  const initialEpisodeTitle = `Episode 1.1 for Chapter ${testChapter.id}`;
  const createEpRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/episodes',
    method: 'POST',
    headers: adminHeaders
  }, {
    novelId: targetNovel.id,
    parentId: testChapter.id,
    title: initialEpisodeTitle,
    status: 'published',
    content: episodeStoryContent
  });

  const testEpisode = createEpRes.body?.episode;
  assert(Boolean(testEpisode?.id), `Associated episode created (ID: ${testEpisode?.id}, parentId: ${testEpisode?.parentId})`);

  // 3. Test Admin Chapter Edit (Modifies ONLY Chapter Title)
  console.log('\n[3/4] Testing Admin Chapter Edit (Modifying ONLY Chapter Title)...');
  const updatedAdminTitle = `Updated Admin Chapter Title ${Date.now()}`;

  const adminEditRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/episodes/${testChapter.id}`,
    method: 'PUT',
    headers: adminHeaders
  }, {
    title: updatedAdminTitle
    // Notice: NO content is passed, only title
  });

  assert(adminEditRes.status === 200, `Admin Chapter Edit returned HTTP 200 (got: ${adminEditRes.status})`);
  assert(adminEditRes.body?.success === true, 'Admin Chapter Edit API reported success: true');

  // Verify in MySQL Database
  const [chapAfterAdmin] = await pool.query('SELECT id, parent_id, title, content, status FROM chapters WHERE id = ?;', [testChapter.id]);
  const chapDbAdmin = chapAfterAdmin[0];
  assert(chapDbAdmin?.title === updatedAdminTitle, `MySQL: Chapter title successfully updated to: "${chapDbAdmin?.title}"`);
  assert(chapDbAdmin?.parent_id === null, 'MySQL: Chapter parent_id is still strictly NULL (hierarchy preserved)');

  // Verify that associated child episode is 100% UNTOUCHED
  const [epAfterAdmin] = await pool.query('SELECT id, parent_id, title, content FROM chapters WHERE id = ?;', [testEpisode.id]);
  const epDbAdmin = epAfterAdmin[0];
  assert(Number(epDbAdmin?.parent_id) === Number(testChapter.id), `MySQL: Child episode still points to Chapter ${testChapter.id}`);
  assert(epDbAdmin?.title === initialEpisodeTitle, `MySQL: Child episode title is untouched: "${epDbAdmin?.title}"`);
  assert(epDbAdmin?.content === episodeStoryContent, 'MySQL: Child episode story content is 100% preserved and untouched');

  // 4. Test Writer Chapter Edit (Modifies ONLY Chapter Title)
  console.log('\n[4/4] Testing Writer Chapter Edit (Modifying ONLY Chapter Title)...');
  const updatedWriterTitle = `Updated Writer Chapter Title ${Date.now()}`;

  const writerEditRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/writer/episodes/${testChapter.id}`,
    method: 'PUT',
    headers: writerHeaders
  }, {
    title: updatedWriterTitle
    // Notice: NO content is passed, only title
  });

  assert(writerEditRes.status === 200, `Writer Chapter Edit returned HTTP 200 (got: ${writerEditRes.status})`);
  assert(writerEditRes.body?.success === true, 'Writer Chapter Edit API reported success: true');

  // Verify in MySQL Database
  const [chapAfterWriter] = await pool.query('SELECT id, parent_id, title, content, status FROM chapters WHERE id = ?;', [testChapter.id]);
  const chapDbWriter = chapAfterWriter[0];
  assert(chapDbWriter?.title === updatedWriterTitle, `MySQL: Chapter title successfully updated by writer to: "${chapDbWriter?.title}"`);
  assert(chapDbWriter?.parent_id === null, 'MySQL: Chapter parent_id remains NULL');

  // Verify child episode is STILL intact
  const [epAfterWriter] = await pool.query('SELECT id, parent_id, title, content FROM chapters WHERE id = ?;', [testEpisode.id]);
  const epDbWriter = epAfterWriter[0];
  assert(Number(epDbWriter?.parent_id) === Number(testChapter.id), `MySQL: Child episode remains linked to Chapter ${testChapter.id}`);
  assert(epDbWriter?.content === episodeStoryContent, 'MySQL: Child episode story content remains completely preserved');

  // 5. Clean up temporary test records
  console.log('\n[Clean Up] Removing temporary test chapter & episode...');
  await pool.query('DELETE FROM chapters WHERE id IN (?, ?);', [testChapter.id, testEpisode.id]);
  console.log('  ✓ Cleanly deleted temporary test records from MySQL.');

  console.log('\n===================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('===================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

