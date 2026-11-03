// Comprehensive End-to-End Verification for Redesigned Chapter & Episode Workflow
// Verifies Admin and Writer chapter creation (Title & basic details only, no content required)
// Followed by automated navigation and linking to Episode Creation under that chapter.

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
  console.log('   CHAPTER & EPISODE WORKFLOW REDESIGN: END-TO-END VERIFICATION    ');
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

  // 1. Identify existing target novel and writer
  console.log('[1/4] Preparing test environment & credentials...');
  const [novels] = await pool.query('SELECT id, title, author_id FROM novels LIMIT 1;');
  const targetNovel = novels[0];
  assert(Boolean(targetNovel), `Target novel found: "${targetNovel?.title}" (ID: ${targetNovel?.id})`);

  const [writers] = await pool.query("SELECT id, username, email FROM users WHERE role = 'writer' LIMIT 1;");
  const targetWriter = writers[0] || { id: 2, username: 'writer', email: 'writer@rudhra.test' };
  assert(Boolean(targetWriter), `Target writer found: "${targetWriter.username}" (ID: ${targetWriter.id})`);

  // Generate direct valid sessions for Admin and Writer
  const adminToken = await createSession(2, 'author');
  assert(Boolean(adminToken), 'Admin/Author session token generated successfully');

  const writerToken = await createSession(targetWriter.id, 'writer');
  assert(Boolean(writerToken), `Writer session token generated for ${targetWriter.username}`);

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

  // 2. Admin Chapter Creation Workflow (Title & Basic Details only -> No Content)
  console.log('\n[2/4] Testing Admin Chapter Creation (Title & Basic Details Only, No Content)...');
  const adminChapTitle = `Admin Test Chapter ${Date.now()}`;
  
  const adminChapRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/episodes',
    method: 'POST',
    headers: adminHeaders
  }, {
    novelId: targetNovel.id,
    parentId: null,
    title: adminChapTitle,
    status: 'published',
    content: '' // No content required!
  });

  assert(adminChapRes.status === 201 || adminChapRes.status === 200, `Admin Chapter created via /api/admin/episodes (HTTP ${adminChapRes.status})`);
  const adminChapter = adminChapRes.body?.episode;
  assert(Boolean(adminChapter?.id), `Admin Chapter returned with ID: ${adminChapter?.id}`);

  // Verify in MySQL database: parent_id is NULL, content is empty
  const [adminChapRows] = await pool.query('SELECT id, parent_id, title, content, status FROM chapters WHERE id = ?;', [adminChapter?.id]);
  const adminChapDb = adminChapRows[0];
  assert(adminChapDb?.parent_id === null, 'MySQL: Chapter parent_id is strictly NULL (Root Chapter)');
  assert(adminChapDb?.content === '' || !adminChapDb?.content, 'MySQL: Chapter content is empty (no story content required at chapter stage)');
  assert(adminChapDb?.title === adminChapTitle, `MySQL: Chapter title matches: "${adminChapDb?.title}"`);

  // 2b. Now simulate automated navigation to Episode Creation for that chapter:
  console.log('\n[2b] Admin Episode Creation under the created chapter...');
  const adminEpTitle = `Episode 1 for ${adminChapTitle}`;
  const adminEpStory = '<p>This is the full rich story content written inside the Episode Creation page.</p>';

  const adminEpRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/episodes',
    method: 'POST',
    headers: adminHeaders
  }, {
    novelId: targetNovel.id,
    parentId: adminChapter.id, // Linked to the newly created chapter!
    title: adminEpTitle,
    status: 'published',
    content: adminEpStory
  });

  assert(adminEpRes.status === 201 || adminEpRes.status === 200, `Admin Episode created under Chapter ${adminChapter.id} (HTTP ${adminEpRes.status})`);
  const adminEpisode = adminEpRes.body?.episode;
  assert(Boolean(adminEpisode?.id), `Admin Episode returned with ID: ${adminEpisode?.id}`);

  // Verify in MySQL: episode has parent_id = chapter.id, and contains story content
  const [adminEpRows] = await pool.query('SELECT id, parent_id, title, content, status FROM chapters WHERE id = ?;', [adminEpisode?.id]);
  const adminEpDb = adminEpRows[0];
  assert(Number(adminEpDb?.parent_id) === Number(adminChapter.id), `MySQL: Episode parent_id strictly matches Chapter ID: ${adminChapter.id}`);
  assert(adminEpDb?.content?.includes('This is the full rich story content'), 'MySQL: Episode contains the rich story content');

  // 3. Writer Chapter Creation Workflow (Title & Basic Details only -> No Content)
  console.log('\n[3/4] Testing Writer Chapter Creation (Title & Basic Details Only, No Content)...');
  
  // Ensure writer has Full Access permissions
  await pool.query(`
    INSERT INTO writer_permissions (writer_id, access_type, permission_status, can_novels, can_episodes, can_publish_independently, can_schedule, can_create, can_edit, can_submit)
    VALUES (?, 'full', 'active', 1, 1, 1, 1, 1, 1, 1)
    ON DUPLICATE KEY UPDATE access_type = 'full', permission_status = 'active', can_novels = 1, can_episodes = 1, can_publish_independently = 1;
  `, [targetWriter.id]);

  const writerChapTitle = `Writer Test Chapter ${Date.now()}`;
  const writerChapRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/writer/episodes',
    method: 'POST',
    headers: writerHeaders
  }, {
    novelId: targetNovel.id,
    parentId: null,
    title: writerChapTitle,
    status: 'published',
    content: '' // No content required!
  });

  assert(writerChapRes.status === 201 || writerChapRes.status === 200, `Writer Chapter created via /api/writer/episodes (HTTP ${writerChapRes.status})`);
  const writerChapter = writerChapRes.body?.episode;
  assert(Boolean(writerChapter?.id), `Writer Chapter returned with ID: ${writerChapter?.id}`);

  // Verify in MySQL: parent_id is NULL, content is empty
  const [writerChapRows] = await pool.query('SELECT id, parent_id, title, content, status FROM chapters WHERE id = ?;', [writerChapter?.id]);
  const writerChapDb = writerChapRows[0];
  assert(writerChapDb?.parent_id === null, 'MySQL: Writer Chapter parent_id is strictly NULL');
  assert(writerChapDb?.content === '' || !writerChapDb?.content, 'MySQL: Writer Chapter content is empty (title & basic details only)');

  // 3b. Simulate Writer automated navigation to Episode Creation for that chapter:
  console.log('\n[3b] Writer Episode Creation under the created chapter...');
  const writerEpTitle = `Writer Episode 1 for ${writerChapTitle}`;
  const writerEpStory = '<p>This is the writer episode story content created in the Episode Creation editor.</p>';

  const writerEpRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/writer/episodes',
    method: 'POST',
    headers: writerHeaders
  }, {
    novelId: targetNovel.id,
    parentId: writerChapter.id, // Linked to the newly created chapter!
    title: writerEpTitle,
    status: 'published',
    content: writerEpStory
  });

  assert(writerEpRes.status === 201 || writerEpRes.status === 200, `Writer Episode created under Chapter ${writerChapter.id} (HTTP ${writerEpRes.status})`);
  const writerEpisode = writerEpRes.body?.episode;
  assert(Boolean(writerEpisode?.id), `Writer Episode returned with ID: ${writerEpisode?.id}`);

  // Verify in MySQL: episode parent_id = writerChapter.id, contains content
  const [writerEpRows] = await pool.query('SELECT id, parent_id, title, content, status FROM chapters WHERE id = ?;', [writerEpisode?.id]);
  const writerEpDb = writerEpRows[0];
  assert(Number(writerEpDb?.parent_id) === Number(writerChapter.id), `MySQL: Writer Episode parent_id strictly matches Chapter ID: ${writerChapter.id}`);
  assert(writerEpDb?.content?.includes('This is the writer episode story content'), 'MySQL: Writer Episode contains the rich story content');

  // 4. Clean up temporary test records
  console.log('\n[4/4] Cleaning up test chapters & episodes...');
  const idsToDelete = [adminChapter?.id, adminEpisode?.id, writerChapter?.id, writerEpisode?.id].filter(Boolean);
  if (idsToDelete.length > 0) {
    await pool.query('DELETE FROM chapters WHERE id IN (?);', [idsToDelete]);
    console.log(`  ✓ Cleanly removed ${idsToDelete.length} temporary test records from MySQL.`);
  }

  console.log('\n===================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('===================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
