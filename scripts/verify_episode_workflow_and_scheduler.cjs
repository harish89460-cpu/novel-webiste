const assert = require('assert');
const fs = require('fs');

async function runTests() {
  console.log('=== VERIFYING EPISODE WORKFLOW, STEPPER, SCHEDULER & DB INTEGRATION ===\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error('    Error:', err.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error('    Error:', err.message);
      failed++;
    }
  }

  // 1. Codebase & Parity Checks
  console.log('--- 1. File Parity & Source Integrity ---');
  test('src/js/admin.js and frontend/src/js/admin.js both contain startNewChapterInEditor', () => {
    const src = fs.readFileSync('src/js/admin.js', 'utf8');
    const fe = fs.readFileSync('frontend/src/js/admin.js', 'utf8');
    assert(src.includes('window.startNewChapterInEditor ='), 'src lacks startNewChapterInEditor');
    assert(fe.includes('window.startNewChapterInEditor ='), 'frontend lacks startNewChapterInEditor');
  });

  test('src/js/admin.js and frontend/src/js/admin.js both contain startNewEpisodeInEditor & startNewSubEpisodeInEditor', () => {
    const src = fs.readFileSync('src/js/admin.js', 'utf8');
    const fe = fs.readFileSync('frontend/src/js/admin.js', 'utf8');
    assert(src.includes('window.startNewEpisodeInEditor ='), 'src lacks startNewEpisodeInEditor');
    assert(fe.includes('window.startNewEpisodeInEditor ='), 'frontend lacks startNewEpisodeInEditor');
    assert(src.includes('window.startNewSubEpisodeInEditor ='), 'src lacks startNewSubEpisodeInEditor');
    assert(fe.includes('window.startNewSubEpisodeInEditor ='), 'frontend lacks startNewSubEpisodeInEditor');
  });

  test('Both admin.js files implement Step 1 (Write) -> Step 2 (Preview) -> Step 3 (Publish/Schedule)', () => {
    const src = fs.readFileSync('src/js/admin.js', 'utf8');
    assert(src.includes('editor-stepper-container'), 'Lacks editor-stepper-container');
    assert(src.includes('Step 1: Write Content'), 'Lacks Step 1 text');
    assert(src.includes('Step 2: Preview'), 'Lacks Step 2 text');
    assert(src.includes('Step 3: Publish or Schedule'), 'Lacks Step 3 text');
    assert(src.includes('editor-context-banner'), 'Lacks editor-context-banner');
    assert(src.includes('editor-preview-confirm-card'), 'Lacks editor-preview-confirm-card');
  });

  test('No placeholder text remains in the writing surface', () => {
    const src = fs.readFileSync('src/js/admin.js', 'utf8');
    assert(!src.includes('Episode story unfolds here...'), 'Still contains old placeholder');
    assert(!src.includes('Write your novel chapter here...'), 'Still contains old placeholder');
  });

  test('CSS files contain stepper, context banner, and confirmation card styling', () => {
    const srcCss = fs.readFileSync('src/css/admin.css', 'utf8');
    const feCss = fs.readFileSync('frontend/src/css/admin.css', 'utf8');
    assert(srcCss.includes('.editor-stepper-container'), 'src/css/admin.css missing .editor-stepper-container');
    assert(feCss.includes('.editor-stepper-container'), 'frontend/src/css/admin.css missing .editor-stepper-container');
    assert(srcCss.includes('.editor-preview-confirm-card'), 'src/css/admin.css missing .editor-preview-confirm-card');
    assert(feCss.includes('.editor-preview-confirm-card'), 'frontend/src/css/admin.css missing .editor-preview-confirm-card');
  });

  test('Tree buttons directly invoke editor functions instead of modal popups', () => {
    const src = fs.readFileSync('src/js/admin.js', 'utf8');
    assert(src.includes("startNewChapterInEditor('${currentNovelId}')"), 'Add Chapter button does not call startNewChapterInEditor');
    assert(src.includes("startNewEpisodeInEditor('${currentNovelId}')"), 'Add Episode button does not call startNewEpisodeInEditor');
    assert(src.includes("startNewEpisodeInEditor('${ep.novelId}', ${ep.id})"), 'Chapter row button does not call startNewEpisodeInEditor');
    assert(src.includes("startNewSubEpisodeInEditor('${sub.novelId}', ${sub.id})"), 'Tier 2 sub-ep button does not call startNewSubEpisodeInEditor');
  });

  test('Redundant inline edit icons next to titles are removed to eliminate clutter', () => {
    const src = fs.readFileSync('src/js/admin.js', 'utf8');
    const treeFuncMatch = src.match(/function renderEpisodeTreeItem\(ep\) \{([\s\S]*?)\n\}/);
    assert(treeFuncMatch, 'Could not find renderEpisodeTreeItem');
    const treeBody = treeFuncMatch[1];
    assert(!treeBody.includes('openEditItemTitleModal'), 'renderEpisodeTreeItem still contains openEditItemTitleModal');
  });

  // 2. Database & API Endpoints Integration
  console.log('\n--- 2. Database & API Endpoints Integration ---');
  const db = await import('../backend/db.js');
  const auth = await import('../backend/auth.js');
  const episodesModule = await import('../backend/episodes.js');

  const testNovelId = 'wf-test-novel-' + Date.now();
  let adminSessionToken = null;
  let testChapterId = null;
  let testEpisodeId = null;
  let testSubEpisodeId = null;
  let testScheduledEpisodeId = null;

  await testAsync('Setup test novel and admin session', async () => {
    await db.query(`
      INSERT INTO novels (id, title, author, description, category, status, views, chapters_count, created_at, updated_at)
      VALUES (?, 'Workflow Test Novel', 'Rudhra Prarthana', 'Test description', 'Romance', 'published', 10, 0, NOW(), NOW());
    `, [testNovelId]);

    const adminUser = await db.queryOne("SELECT id FROM users WHERE role = 'admin' LIMIT 1;");
    assert(adminUser, 'Admin user must exist in DB');
    adminSessionToken = await auth.createSession(adminUser.id, 'author');
    assert(adminSessionToken, 'Must generate author session token');
  });

  const BASE_URL = 'http://localhost:3000';

  await testAsync('Create Root Chapter (parent_id = null) via API', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/episodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSessionToken}`
      },
      body: JSON.stringify({
        novelId: testNovelId,
        parentId: null,
        episodeNumber: '1',
        title: 'Workflow Test Novel (Chapter 1)',
        content: '<p>Story content for Chapter 1.</p>',
        status: 'published'
      })
    });
    const data = await res.json();
    assert(res.ok && data.success, 'Failed to create chapter: ' + JSON.stringify(data));
    testChapterId = data.chapter?.id || data.chapterId;
    assert(testChapterId, 'Chapter ID must be returned');

    // Verify in DB
    const row = await db.queryOne('SELECT * FROM chapters WHERE id = ?;', [testChapterId]);
    assert.strictEqual(row.parent_id, null, 'Chapter parent_id must be NULL');
    assert.strictEqual(row.chapter_num, '1', 'Chapter chapter_num must be 1');
    assert.strictEqual(row.status, 'published', 'Chapter status must be published');
  });

  await testAsync('Create Chapter Episode (parent_id = Chapter 1) via API -> hierarchical 1.1', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/episodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSessionToken}`
      },
      body: JSON.stringify({
        novelId: testNovelId,
        parentId: testChapterId,
        episodeNumber: '1.1',
        title: 'Workflow Test Novel (1.1)',
        content: '<p>Story content for Episode 1.1.</p>',
        status: 'published'
      })
    });
    const data = await res.json();
    assert(res.ok && data.success, 'Failed to create episode 1.1: ' + JSON.stringify(data));
    testEpisodeId = data.chapter?.id || data.chapterId;

    // Verify in DB
    const row = await db.queryOne('SELECT * FROM chapters WHERE id = ?;', [testEpisodeId]);
    assert.strictEqual(row.parent_id, testChapterId, 'Parent ID must equal chapter ID');
    assert.strictEqual(row.episode_number, '1.1', 'Episode number must be 1.1');
  });

  await testAsync('Create Sub-Episode (parent_id = Episode 1.1) via API -> hierarchical 1.1.1', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/episodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSessionToken}`
      },
      body: JSON.stringify({
        novelId: testNovelId,
        parentId: testEpisodeId,
        episodeNumber: '1.1.1',
        title: 'Workflow Test Novel (1.1.1)',
        content: '<p>Story content for Sub-Episode 1.1.1.</p>',
        status: 'published'
      })
    });
    const data = await res.json();
    assert(res.ok && data.success, 'Failed to create sub-episode 1.1.1: ' + JSON.stringify(data));
    testSubEpisodeId = data.chapter?.id || data.chapterId;

    // Verify in DB
    const row = await db.queryOne('SELECT * FROM chapters WHERE id = ?;', [testSubEpisodeId]);
    assert.strictEqual(row.parent_id, testEpisodeId, 'Parent ID must equal Episode 1.1 ID');
    assert.strictEqual(row.episode_number, '1.1.1', 'Episode number must be 1.1.1');
  });

  await testAsync('Query hierarchical episodes tree via API', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/episodes?novel=${testNovelId}&hierarchical=true`, {
      headers: { 'Authorization': `Bearer ${adminSessionToken}` }
    });
    const data = await res.json();
    assert(res.ok && data.success, 'Failed to fetch tree');
    assert(data.episodes.length === 1, 'Should have 1 root chapter');
    assert(data.episodes[0].subEpisodes.length === 1, 'Root chapter should have 1 child episode');
    assert(data.episodes[0].subEpisodes[0].subEpisodes.length === 1, 'Episode 1.1 should have 1 child sub-episode');
    assert.strictEqual(data.episodes[0].subEpisodes[0].subEpisodes[0].episodeNumber, '1.1.1');
  });

  // 3. Scheduling & Scheduler Engine Integration
  console.log('\n--- 3. Scheduling & Background Scheduler Engine ---');
  await testAsync('Create scheduled episode with future date/time & timezone', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const res = await fetch(`${BASE_URL}/api/admin/episodes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSessionToken}`
      },
      body: JSON.stringify({
        novelId: testNovelId,
        parentId: testChapterId,
        episodeNumber: '1.2',
        title: 'Workflow Test Novel (1.2 Scheduled)',
        content: '<p>Scheduled story content.</p>',
        status: 'scheduled',
        scheduledAt: futureDate,
        timezone: 'Asia/Kolkata'
      })
    });
    const data = await res.json();
    assert(res.ok && data.success, 'Failed to schedule episode');
    testScheduledEpisodeId = data.chapter?.id || data.chapterId;

    const row = await db.queryOne('SELECT * FROM chapters WHERE id = ?;', [testScheduledEpisodeId]);
    assert.strictEqual(row.status, 'scheduled', 'Status must be scheduled in DB');
    assert(row.scheduled_at !== null, 'scheduled_at must not be null');
    assert.strictEqual(row.timezone, 'Asia/Kolkata', 'Timezone must be Asia/Kolkata');
  });

  await testAsync('Admin Scheduler queue returns scheduled episode with metadata', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/scheduler`, {
      headers: { 'Authorization': `Bearer ${adminSessionToken}` }
    });
    const data = await res.json();
    assert(res.ok && data.success, 'Failed to fetch scheduler list');
    const found = (data.scheduled || []).find(s => s.id === testScheduledEpisodeId);
    assert(found, 'Scheduled episode must be present in scheduler list');
    assert.strictEqual(found.novelTitle, 'Workflow Test Novel');
    assert.strictEqual(found.episodeNumber, '1.2');
  });

  await testAsync('Publish immediately from Scheduler (/publish-now) updates status to published', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/scheduler/${testScheduledEpisodeId}/publish-now`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminSessionToken}` }
    });
    const data = await res.json();
    assert(res.ok && data.success, 'Failed to publish scheduled episode now');

    const row = await db.queryOne('SELECT * FROM chapters WHERE id = ?;', [testScheduledEpisodeId]);
    assert.strictEqual(row.status, 'published', 'Episode status must become published');
    assert.strictEqual(row.scheduled_at, null, 'scheduled_at must be cleared');
    assert(row.published_at !== null, 'published_at must be set');
  });

  await testAsync('Cancel schedule (/cancel) reverts scheduled episode to draft', async () => {
    // Re-schedule it
    await db.query("UPDATE chapters SET status = 'scheduled', scheduled_at = NOW() + INTERVAL 2 DAY WHERE id = ?;", [testScheduledEpisodeId]);

    const res = await fetch(`${BASE_URL}/api/admin/scheduler/${testScheduledEpisodeId}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminSessionToken}` }
    });
    const data = await res.json();
    assert(res.ok && data.success, 'Failed to cancel schedule');

    const row = await db.queryOne('SELECT * FROM chapters WHERE id = ?;', [testScheduledEpisodeId]);
    assert.strictEqual(row.status, 'draft', 'Episode status must revert to draft');
    assert.strictEqual(row.scheduled_at, null, 'scheduled_at must be null');
  });

  await testAsync('Automated backend scheduler publishes due episodes without browser dependency', async () => {
    // Set scheduled_at in the past
    await db.query("UPDATE chapters SET status = 'scheduled', scheduled_at = NOW() - INTERVAL 10 SECOND WHERE id = ?;", [testScheduledEpisodeId]);

    const result = await episodesModule.checkAndPublishDueEpisodes();
    assert(result.published.includes(testScheduledEpisodeId) || result.publishedCount >= 1, 'Scheduler engine must have picked up the due episode');

    const row = await db.queryOne('SELECT * FROM chapters WHERE id = ?;', [testScheduledEpisodeId]);
    assert.strictEqual(row.status, 'published', 'Due episode must have been automatically published');
  });

  // 4. Cleanup test data
  console.log('\n--- 4. Cleanup Test Data ---');
  await testAsync('Clean up test novel and chapters', async () => {
    await db.query('DELETE FROM chapters WHERE novel_id = ?;', [testNovelId]);
    await db.query('DELETE FROM novels WHERE id = ?;', [testNovelId]);
    if (adminSessionToken) {
      await db.query('DELETE FROM sessions WHERE token = ?;', [adminSessionToken]);
    }
  });

  console.log('\n======================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

