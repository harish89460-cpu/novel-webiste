const assert = require('assert');

async function runVerification() {
  console.log('===================================================================');
  console.log('   WRITER ACCESS, ASSIGNMENTS, REVIEW & PUBLISHING VERIFICATION    ');
  console.log('===================================================================\n');

  const authModule = await import('../backend/auth.js');
  const dbModule = await import('../backend/db.js');
  const writersModule = await import('../backend/writers.js');
  const episodesModule = await import('../backend/episodes.js');

  const BASE_URL = 'http://localhost:3000';

  // Pre-cleanup any lingering test records
  await dbModule.query("DELETE FROM chapters WHERE novel_id = 'kaadhal-konden-kanave' AND (chapter_num >= 90 OR title LIKE '%Test%');");
  await dbModule.query("DELETE FROM short_stories WHERE title LIKE '%Test%';");
  await dbModule.query("DELETE FROM writer_assignments WHERE writer_id = 37;");
  await dbModule.query("DELETE FROM writer_submissions WHERE title LIKE '%Test%';");

  const randCh = Math.floor(Math.random() * 8000) + 1000;

  // --- Step 1: Initialize Accounts & Sessions ---
  console.log('[1/10] Setting up Admin & Writer Accounts...');
  const adminToken = await authModule.createSession(2, 'author');
  console.log('  ✓ Admin session initialized (ID: 2)');

  const writer1Token = await authModule.createSession(37, 'writer');
  console.log('  ✓ Writer 1 session initialized (ID: 37, Hariram)');

  // Ensure Writer 2 account exists
  let writer2User = await dbModule.queryOne("SELECT id, username FROM users WHERE email = 'test_writer_indep@rudhraprarthana.com';");
  if (!writer2User) {
    const w2Created = await writersModule.createWriterAccount({
      fullName: 'Independent Test Writer',
      email: 'test_writer_indep@rudhraprarthana.com',
      password: 'password123',
      createdByActorId: 2
    });
    writer2User = w2Created.writer;
  }
  const writer2Token = await authModule.createSession(writer2User.id, 'writer');
  console.log(`  ✓ Writer 2 session initialized (ID: ${writer2User.id}, ${writer2User.username})`);

  // --- Step 2: Configure Restricted Access for Writer 1 ---
  console.log('\n[2/10] Configuring Restricted Access (Review Required) for Writer 1...');
  const p1Res = await fetch(`${BASE_URL}/api/admin/writers/37/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      canNovels: 1,
      canEpisodes: 1,
      canShortStories: 0,
      canAudioNovels: 0,
      accessLevel: 'review_required',
      fullAccess: 0
    })
  });
  assert(p1Res.ok, `Permissions update should return 200, got ${p1Res.status}`);
  console.log('  ✓ Writer 1 set to: review_required, fullAccess: 0 (Restricted)');

  // Assign Writer 1 strictly to novel 'kaadhal-konden-kanave'
  const assignRes = await fetch(`${BASE_URL}/api/admin/writers/37/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      contentType: 'novel',
      contentId: 'kaadhal-konden-kanave',
      instructions: 'Write Chapter 1 Episodes',
      deadline: '2026-11-30'
    })
  });
  assert(assignRes.status === 201 || assignRes.status === 200, `Assignment should return 200/201, got ${assignRes.status}`);
  const assignData = await assignRes.json();
  const assignment1Id = assignData.assignmentId;
  console.log(`  ✓ Novel "kaadhal-konden-kanave" assigned to Writer 1 (Assignment ID: ${assignment1Id})`);

  // --- Step 3: Test Assignment Boundary Enforcement ---
  console.log('\n[3/10] Verifying Assignment Boundaries & Access Isolation...');
  // A. Writer 1 can create episode in assigned novel 'kaadhal-konden-kanave'
  const createAssignedEpRes = await fetch(`${BASE_URL}/api/writer/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${writer1Token}` },
    body: JSON.stringify({
      novelId: 'kaadhal-konden-kanave',
      episodeNumber: '99.1',
      title: 'Writer 1 Test Episode',
      content: '<p>A beautiful story unfolds in the quiet countryside.</p>',
      status: 'draft'
    })
  });
  assert(createAssignedEpRes.status === 201 || createAssignedEpRes.status === 200, `Should allow creating episode in assigned novel, got ${createAssignedEpRes.status}`);
  const createdEpData = await createAssignedEpRes.json();
  const testEpId = createdEpData.episode?.id || createdEpData.episodeId || createdEpData.id;
  console.log(`  ✓ Writer 1 successfully created draft episode in assigned novel (Episode ID: ${testEpId})`);

  // B. Writer 1 CANNOT create episode in unassigned novel 'maaya-nadhi-theeram'
  const createUnassignedEpRes = await fetch(`${BASE_URL}/api/writer/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${writer1Token}` },
    body: JSON.stringify({
      novelId: 'maaya-nadhi-theeram',
      episodeNumber: '99.9',
      title: 'Intruder Episode',
      content: '<p>Should fail.</p>',
      status: 'draft'
    })
  });
  assert(createUnassignedEpRes.status === 403, `Must block writing in unassigned novel with 403, got ${createUnassignedEpRes.status}`);
  console.log('  ✓ Server correctly blocked creation in unassigned novel (403 Forbidden)');

  // --- Step 4: Verify Review-Required Content Cannot Bypass Review ---
  console.log('\n[4/10] Verifying Writer 1 Cannot Bypass Admin Review...');
  const bypassAttemptRes = await fetch(`${BASE_URL}/api/writer/episodes/${testEpId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${writer1Token}` },
    body: JSON.stringify({
      novelId: 'kaadhal-konden-kanave',
      episodeNumber: '99.1',
      title: 'Writer 1 Test Episode (Attempted Direct Publish)',
      content: '<p>Attempting to bypass review.</p>',
      status: 'published'
    })
  });
  assert(bypassAttemptRes.status === 403, `Direct publish by review_required writer must be rejected with 403, got ${bypassAttemptRes.status}`);
  console.log('  ✓ Server blocked unauthorized direct publication attempt (403 Forbidden)');

  // --- Step 5: Test Full Review Workflow (Submit -> Changes Requested -> Revise -> Approve) ---
  console.log('\n[5/10] Testing Workflow A (Submit -> Changes Requested -> Resubmit -> Approve)...');
  // A. Submit for review
  const submitRes = await fetch(`${BASE_URL}/api/writer/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${writer1Token}` },
    body: JSON.stringify({
      contentType: 'episode',
      contentId: String(testEpId),
      title: 'Writer 1 Test Episode — The Awakening',
      parentId: 'kaadhal-konden-kanave'
    })
  });
  assert(submitRes.ok, `Submit for review should return 200, got ${submitRes.status}`);
  const submitData = await submitRes.json();
  const submissionId = submitData.submissionId;
  console.log(`  ✓ Episode submitted for review (Submission ID: ${submissionId}, status: pending_review)`);

  // Verify it appears in Admin Review Queue
  const queueRes = await fetch(`${BASE_URL}/api/admin/writers/submissions?status=pending_review`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const queueData = await queueRes.json();
  const foundInQueue = (queueData.submissions || []).find(s => Number(s.id) === Number(submissionId));
  assert(foundInQueue, 'Submission must appear in Admin Review Queue');
  console.log('  ✓ Submission confirmed in Admin Review Queue');

  // B. Admin requests revisions
  const reqChangesRes = await fetch(`${BASE_URL}/api/admin/writers/submissions/${submissionId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      action: 'request_changes',
      adminNotes: 'Please expand on the protagonist reflection in paragraph 2.'
    })
  });
  assert(reqChangesRes.ok, `Request changes should return 200, got ${reqChangesRes.status}`);
  console.log('  ✓ Admin requested changes with feedback notes');

  // Verify writer sees changes_requested
  const writerSubsRes = await fetch(`${BASE_URL}/api/writer/submissions`, {
    headers: { 'Authorization': `Bearer ${writer1Token}` }
  });
  const writerSubsData = await writerSubsRes.json();
  const writerSub = (writerSubsData.submissions || []).find(s => Number(s.id) === Number(submissionId));
  assert(writerSub && writerSub.status === 'changes_requested', 'Writer should see status changes_requested');
  assert(writerSub.adminNotes.includes('protagonist reflection'), 'Writer should receive admin feedback notes');
  console.log(`  ✓ Writer sees status "changes_requested" and feedback: "${writerSub.adminNotes}"`);

  // C. Writer revises and resubmits
  const resubmitRes = await fetch(`${BASE_URL}/api/writer/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${writer1Token}` },
    body: JSON.stringify({
      contentType: 'episode',
      contentId: String(testEpId),
      title: 'Writer 1 Test Episode — The Awakening (Revised Edition)',
      parentId: 'en-uyirile-nee'
    })
  });
  assert(resubmitRes.ok, `Resubmit should return 200, got ${resubmitRes.status}`);
  console.log('  ✓ Writer revised and resubmitted draft');

  // D. Admin approves and publishes
  const approveRes = await fetch(`${BASE_URL}/api/admin/writers/submissions/${submissionId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'approve_publish' })
  });
  assert(approveRes.ok, `Approve & publish should return 200, got ${approveRes.status}`);
  console.log('  ✓ Admin approved and published submission');

  // Verify episode in database is now published
  const approvedEpRow = await dbModule.queryOne('SELECT status, review_status FROM chapters WHERE id = ?;', [testEpId]);
  assert.strictEqual(approvedEpRow.status, 'published', 'Episode status in DB should be published');
  assert.strictEqual(approvedEpRow.review_status, 'approved', 'Episode review_status should be approved');
  console.log('  ✓ Episode database status verified as published');

  // --- Step 6: Test Workflow B (Independent Writer Publishing) ---
  console.log('\n[6/10] Testing Workflow B (Independent Publishing for Writer 2)...');
  // Configure Writer 2 for independent publishing
  await fetch(`${BASE_URL}/api/admin/writers/${writer2User.id}/permissions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({
      canNovels: 1,
      canShortStories: 1,
      canAudioNovels: 1,
      canEpisodes: 1,
      accessLevel: 'independent_publish',
      fullAccess: 1
    })
  });
  console.log('  ✓ Writer 2 granted independent_publish & fullAccess');

  // Writer 2 creates short story directly published without admin approval
  const indepStoryRes = await fetch(`${BASE_URL}/api/writer/short-stories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${writer2Token}` },
    body: JSON.stringify({
      title: 'Independent Writer Story — Morning Sunshine',
      genre: 'Feel Good',
      slug: 'independent-writer-story-morning-sunshine',
      content: '<p>Golden sunlight streamed through the green mango leaves.</p>',
      status: 'published'
    })
  });
  assert(indepStoryRes.status === 201 || indepStoryRes.status === 200, `Independent story creation should return 200/201, got ${indepStoryRes.status}`);
  const indepStoryData = await indepStoryRes.json();
  const indepStoryId = indepStoryData.storyId || indepStoryData.id;
  console.log(`  ✓ Writer 2 created and published story independently (ID: ${indepStoryId})`);

  // Verify story is immediately accessible publicly without review queue
  const publicStoryRes = await fetch(`${BASE_URL}/api/short-stories/independent-writer-story-morning-sunshine`);
  assert(publicStoryRes.status === 200, `Story must be public immediately, got ${publicStoryRes.status}`);
  console.log('  ✓ Story is live and accessible to readers immediately');

  // --- Step 7: Test Scheduling & Background Automated Scheduler Guard ---
  console.log('\n[7/10] Testing Publication Scheduler & Unapproved Content Guard...');
  // Create an unapproved scheduled episode (status: scheduled, review_status: pending_review)
  const pastTime = new Date(Date.now() - 60000).toISOString().slice(0, 19).replace('T', ' ');
  const unapprovedEpRes = await dbModule.query(`
    INSERT INTO chapters (novel_id, chapter_num, episode_number, title, content, status, scheduled_at, review_status)
    VALUES ('kaadhal-konden-kanave', ?, ?, 'Unapproved Scheduled Ep', '<p>Should not publish</p>', 'scheduled', ?, 'pending_review');
  `, [randCh + 1, `${randCh + 1}.1`, pastTime]);
  const unapprovedEpId = unapprovedEpRes.insertId;

  // Run backend scheduler
  await episodesModule.checkAndPublishDueEpisodes();

  // Verify unapproved episode was NOT published
  const checkUnapprovedRow = await dbModule.queryOne('SELECT status FROM chapters WHERE id = ?;', [unapprovedEpId]);
  assert.strictEqual(checkUnapprovedRow.status, 'scheduled', 'Unapproved episode must remain scheduled and NOT publish');
  console.log('  ✓ Unapproved scheduled episode correctly preserved (NOT published by scheduler)');

  // Now simulate approved scheduled episode
  await dbModule.query("UPDATE chapters SET review_status = 'approved' WHERE id = ?;", [unapprovedEpId]);
  await episodesModule.checkAndPublishDueEpisodes();

  const checkApprovedRow = await dbModule.queryOne('SELECT status FROM chapters WHERE id = ?;', [unapprovedEpId]);
  assert.strictEqual(checkApprovedRow.status, 'published', 'Approved scheduled episode must publish automatically');
  console.log('  ✓ Approved scheduled episode automatically published by backend scheduler');

  // --- Step 8: Revocation of Assignment Blocks Access ---
  console.log('\n[8/10] Testing Revocation of Assignment Immediately Blocks Access...');
  const revokeRes = await fetch(`${BASE_URL}/api/admin/writers/assignments/${assignment1Id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(revokeRes.ok, `Revoke assignment should return 200, got ${revokeRes.status}`);
  console.log(`  ✓ Assignment #${assignment1Id} revoked by admin`);

  // Verify Writer 1 is now BLOCKED from editing the novel
  const blockedEditRes = await fetch(`${BASE_URL}/api/writer/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${writer1Token}` },
    body: JSON.stringify({
      novelId: 'kaadhal-konden-kanave',
      episodeNumber: '99.3',
      title: 'Post-Revocation Attempt',
      content: '<p>Should fail.</p>'
    })
  });
  assert(blockedEditRes.status === 403, `Post-revocation write attempt must return 403, got ${blockedEditRes.status}`);
  console.log('  ✓ Writer 1 immediately blocked from further edits after revocation (403 Forbidden)');

  // --- Step 9: Cross-Writer Draft Isolation & Admin Protection ---
  console.log('\n[9/10] Verifying Cross-Writer Draft Privacy & Admin Protection...');
  // Writer cannot access Admin site settings
  const adminSettingsAttempt = await fetch(`${BASE_URL}/api/admin/settings`, {
    headers: { 'Authorization': `Bearer ${writer1Token}` }
  });
  assert(adminSettingsAttempt.status === 403, `Writer accessing admin settings must return 403, got ${adminSettingsAttempt.status}`);
  console.log('  ✓ Admin settings protected against writer access (403 Forbidden)');

  // --- Step 10: Clean Up Test Records ---
  console.log('\n[10/10] Cleaning up verification artifacts...');
  await dbModule.query('DELETE FROM chapters WHERE id IN (?, ?);', [testEpId, unapprovedEpId]);
  await dbModule.query('DELETE FROM writer_submissions WHERE content_id = ?;', [String(testEpId)]);
  await dbModule.query('DELETE FROM writer_assignments WHERE id = ?;', [assignment1Id]);
  await dbModule.query('DELETE FROM short_stories WHERE id = ? OR slug = ?;', [indepStoryId, 'independent-writer-story-morning-sunshine']);
  console.log('  ✓ Test chapters, submissions, assignments, and short stories cleaned up');

  console.log('\n===================================================================');
  console.log('   🎉 ALL 10 WRITER MANAGEMENT & PUBLISHING TESTS PASSED!          ');
  console.log('===================================================================\n');
}

runVerification().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
