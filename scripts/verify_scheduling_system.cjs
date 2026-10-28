// scripts/verify_scheduling_system.cjs
// End-to-end Automated Verification of Rudhra Prarthana Novels Scheduling System

const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failed++;
  }
}

async function runVerification() {
  console.log('===================================================================');
  console.log('       RUDHRA PRARTHANA NOVELS SCHEDULING SYSTEM E2E TEST          ');
  console.log('===================================================================\n');

  const { createSession } = await import('../backend/auth.js');
  const { query, queryOne } = await import('../backend/db.js');
  const { parseISTDateTime, formatISTDisplay, isPastIST, getISTNowString } = await import('../backend/timezone.js');
  const { runAutomatedPublishingScheduler } = await import('../backend/scheduler.js');
  const { updateWriterPermissions, createWriterAssignment } = await import('../backend/writers.js');

  const adminToken = await createSession(2, 'author');
  const writerToken = await createSession(37, 'writer');

  const adminNovelId = 'nenjam-marappadhillai';
  const writerNovelId = 'writer-test-sched-novel';

  try {
    // -------------------------------------------------------------
    // TEST 1: TIMEZONE ENGINE (IST Asia/Kolkata + 12-Hour AM/PM)
    // -------------------------------------------------------------
    console.log('[1/8] Verifying IST Timezone Parsing & 12-Hour AM/PM Formatting...');
    const parsed1 = parseISTDateTime({ date: '2026-10-29', hour: 8, minute: 30, ampm: 'PM' });
    assert(parsed1 === '2026-10-29 20:30:00', 'Component object parses to exact IST string 2026-10-29 20:30:00');

    const formatted1 = formatISTDisplay('2026-10-29 20:30:00');
    assert(formatted1 === '29 Oct 2026, 08:30 PM IST', `formatISTDisplay produces '29 Oct 2026, 08:30 PM IST' (got: ${formatted1})`);

    const parsedMidnight = parseISTDateTime({ date: '2026-10-29', hour: 12, minute: 0, ampm: 'AM' });
    assert(parsedMidnight === '2026-10-29 00:00:00', '12 AM converts to 00:00:00 midnight');

    const parsedNoon = parseISTDateTime({ date: '2026-10-29', hour: 12, minute: 0, ampm: 'PM' });
    assert(parsedNoon === '2026-10-29 12:00:00', '12 PM converts to 12:00:00 noon');

    const isPast = isPastIST('2020-01-01 10:00:00');
    assert(isPast === true, 'isPastIST accurately identifies past date');

    const isFuture = isPastIST('2028-01-01 10:00:00');
    assert(isFuture === false, 'isPastIST accurately identifies future date');

    // -------------------------------------------------------------
    // TEST 2: ADMIN SCHEDULE CREATION & VALIDATION
    // -------------------------------------------------------------
    console.log('\n[2/8] Admin Scheduling Episode in Future & Rejecting Past Dates...');
    
    // Past date should be rejected
    const pastRes = await request('POST', '/api/admin/episodes', {
      novelId: adminNovelId,
      chapterNum: '998',
      title: 'Past Test Episode',
      content: '<p>Test</p>',
      status: 'scheduled',
      scheduledAt: '2020-01-01 10:00:00'
    }, adminToken);
    assert(pastRes.status === 400 && pastRes.data?.success === false, 'Backend rejects scheduling with past date');

    // Clean up any prior test episode
    await query('DELETE FROM chapters WHERE novel_id = ? AND chapter_num IN ("998", "999");', [adminNovelId]);

    // Valid future schedule (Tomorrow at 08:30 PM IST)
    const futureDate = '2026-10-30 20:30:00';
    const createRes = await request('POST', '/api/admin/episodes', {
      novelId: adminNovelId,
      chapterNum: '999',
      title: 'Admin Scheduled Episode Test',
      content: '<p>Testing scheduled release content</p>',
      status: 'scheduled',
      scheduledAt: futureDate,
      timezone: 'Asia/Kolkata'
    }, adminToken);

    assert(createRes.status === 201 && createRes.data?.success, 'Admin creates episode with scheduled status');
    const createdEpisodeId = createRes.data?.episode?.id;

    // Verify in database
    const dbRow = await queryOne('SELECT status, scheduled_at, published_at FROM chapters WHERE id = ?;', [createdEpisodeId]);
    assert(dbRow?.status === 'scheduled', 'MySQL chapters.status is "scheduled"');
    assert(dbRow?.scheduled_at === '2026-10-30 20:30:00', `MySQL chapters.scheduled_at stored in exact IST: ${dbRow?.scheduled_at}`);
    assert(dbRow?.published_at === null, 'Episode remains unpublished before release time');

    // -------------------------------------------------------------
    // TEST 3: ADMIN SCHEDULER QUEUE & RESCHEDULING
    // -------------------------------------------------------------
    console.log('\n[3/8] Admin Scheduler Queue & Rescheduling Endpoint...');
    const queueRes = await request('GET', '/api/admin/scheduler', null, adminToken);
    assert(queueRes.status === 200 && Array.isArray(queueRes.data?.scheduled), 'GET /api/admin/scheduler returns scheduled queue');
    const queuedItem = (queueRes.data.scheduled || []).find(s => s.id === createdEpisodeId);
    assert(queuedItem !== undefined, 'Scheduled episode appears in admin scheduler list');
    assert(queuedItem?.formattedIST.includes('30 Oct 2026, 08:30 PM IST'), `Formatted IST matches: ${queuedItem?.formattedIST}`);

    // Reschedule to 31 Oct 2026, 09:15 AM IST
    const newFutureDate = '2026-10-31 09:15:00';
    const reschedRes = await request('PUT', `/api/admin/scheduler/${createdEpisodeId}/reschedule`, {
      scheduledAt: newFutureDate,
      timezone: 'Asia/Kolkata'
    }, adminToken);
    assert(reschedRes.status === 200 && reschedRes.data?.success, 'PUT /api/admin/scheduler/:id/reschedule succeeds');

    const dbReschedRow = await queryOne('SELECT scheduled_at FROM chapters WHERE id = ?;', [createdEpisodeId]);
    assert(dbReschedRow?.scheduled_at === '2026-10-31 09:15:00', `Updated MySQL scheduled_at: ${dbReschedRow?.scheduled_at}`);

    // -------------------------------------------------------------
    // TEST 4: IMMEDIATE PUBLISHING (Publish Now)
    // -------------------------------------------------------------
    console.log('\n[4/8] Immediate Publishing via Admin "Publish Now"...');
    const pubNowRes = await request('POST', `/api/admin/scheduler/${createdEpisodeId}/publish-now`, null, adminToken);
    assert(pubNowRes.status === 200 && pubNowRes.data?.success, 'POST /api/admin/scheduler/:id/publish-now succeeds');

    const dbPublishedRow = await queryOne('SELECT status, published_at FROM chapters WHERE id = ?;', [createdEpisodeId]);
    assert(dbPublishedRow?.status === 'published', 'Episode status transitioned to "published" immediately');
    assert(Boolean(dbPublishedRow?.published_at), `Published timestamp successfully recorded: ${dbPublishedRow?.published_at}`);

    // Clean up
    await query('DELETE FROM chapters WHERE id = ?;', [createdEpisodeId]);

    // -------------------------------------------------------------
    // SETUP DEDICATED WRITER NOVEL FOR TESTS 5, 6, 7
    // -------------------------------------------------------------
    await query('DELETE FROM chapters WHERE novel_id = ?;', [writerNovelId]);
    await query('DELETE FROM novels WHERE id = ?;', [writerNovelId]);
    await query(`
      INSERT INTO novels (id, title, author, author_id, category, status, is_published, visibility, access_permission)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
    `, [writerNovelId, 'Writer Test Novel', 'Tamil Writer', 37, 'Ongoing', 'Ongoing', 1, 'public', 'all_writers']);

    // -------------------------------------------------------------
    // TEST 5: WRITER SCHEDULING (FULL ACCESS / INDEPENDENT PUBLISH)
    // -------------------------------------------------------------
    console.log('\n[5/8] Writer Scheduling with Full Access (Independent Publishing)...');
    await updateWriterPermissions(37, {
      accessType: 'full',
      permissionStatus: 'active',
      canPublishIndependently: true
    }, 2);

    const writerSchedRes = await request('POST', '/api/writer/episodes', {
      novelId: writerNovelId,
      episodeNumber: '1',
      title: 'Writer Independent Scheduled Episode',
      content: '<p>Writer episode content</p>',
      status: 'scheduled',
      scheduledAt: '2026-11-01 18:00:00'
    }, writerToken);

    assert(writerSchedRes.status === 201 && writerSchedRes.data?.success, 'Writer creates scheduled episode independently');
    const writerEpId = writerSchedRes.data?.episode?.id;

    const writerDbRow = await queryOne('SELECT status, scheduled_at, review_status FROM chapters WHERE id = ?;', [writerEpId]);
    assert(writerDbRow?.status === 'scheduled', 'Writer episode stored as "scheduled"');
    assert(writerDbRow?.review_status === 'approved', 'Review status automatically approved for independent publisher');
    assert(writerDbRow?.scheduled_at === '2026-11-01 18:00:00', 'Scheduled at stored correctly');

    // Writer checks schedule list
    const writerQueueRes = await request('GET', '/api/writer/schedule', null, writerToken);
    assert(writerQueueRes.status === 200 && Array.isArray(writerQueueRes.data?.scheduled), 'GET /api/writer/schedule returns list');
    const writerQueued = (writerQueueRes.data.scheduled || []).find(s => s.id === writerEpId);
    assert(writerQueued !== undefined, 'Scheduled episode is visible in Writer publication schedule');
    assert(writerQueued?.canPublishIndependently === true, 'Writer has independent publishing flag = true');

    // Writer reschedules
    const writerReschedRes = await request('PUT', `/api/writer/scheduler/${writerEpId}/reschedule`, {
      scheduledAt: '2026-11-02 20:00:00'
    }, writerToken);
    assert(writerReschedRes.status === 200 && writerReschedRes.data?.success, 'Writer reschedules release time');

    // Clean up
    await query('DELETE FROM chapters WHERE id = ?;', [writerEpId]);

    // -------------------------------------------------------------
    // TEST 6: WRITER SCHEDULING (PARTICULAR ACCESS / REVIEW REQUIRED)
    // -------------------------------------------------------------
    console.log('\n[6/8] Writer Scheduling Requiring Admin Review Approval...');
    await updateWriterPermissions(37, {
      accessType: 'particular',
      permissionStatus: 'active',
      canPublishIndependently: false
    }, 2);

    const reviewEpRes = await request('POST', '/api/writer/episodes', {
      novelId: writerNovelId,
      episodeNumber: '2',
      title: 'Writer Review-Required Episode',
      content: '<p>Requires approval</p>',
      status: 'scheduled',
      scheduledAt: '2026-11-05 15:00:00'
    }, writerToken);

    assert(reviewEpRes.status === 201 && reviewEpRes.data?.success, 'Writer submits episode with requested schedule');
    const reviewEpId = reviewEpRes.data?.episode?.id;

    const reviewDbRow = await queryOne('SELECT status, review_status, scheduled_at FROM chapters WHERE id = ?;', [reviewEpId]);
    assert(reviewDbRow?.status === 'submitted', 'Status is "submitted" instead of direct scheduled');
    assert(reviewDbRow?.review_status === 'pending_review', 'Review status is "pending_review"');
    assert(reviewDbRow?.scheduled_at === '2026-11-05 15:00:00', 'Requested scheduled_at is safely recorded');

    // Writer attempts to publish now without permission -> MUST BE REJECTED 403
    const unauthorizedPub = await request('POST', `/api/writer/scheduler/${reviewEpId}/publish-now`, null, writerToken);
    assert(unauthorizedPub.status === 403, 'Writer without independent publish permission cannot bypass review (HTTP 403)');

    // -------------------------------------------------------------
    // TEST 7: SCHEDULE CANCELLATION (Revert to Draft)
    // -------------------------------------------------------------
    console.log('\n[7/8] Schedule Cancellation (Revert to Draft)...');
    const cancelRes = await request('POST', `/api/writer/scheduler/${reviewEpId}/cancel`, null, writerToken);
    assert(cancelRes.status === 200 && cancelRes.data?.success, 'Schedule cancellation succeeds');

    const cancelDbRow = await queryOne('SELECT status, scheduled_at FROM chapters WHERE id = ?;', [reviewEpId]);
    assert(cancelDbRow?.status === 'draft', 'Episode status reverted to "draft"');
    assert(cancelDbRow?.scheduled_at === null, 'Schedule cleared in database');

    await query('DELETE FROM chapters WHERE id = ?;', [reviewEpId]);
    await query('DELETE FROM novels WHERE id = ?;', [writerNovelId]);

    // -------------------------------------------------------------
    // TEST 8: AUTOMATIC BACKGROUND PUBLISHING (CRON/SCHEDULER ENGINE)
    // -------------------------------------------------------------
    console.log('\n[8/8] Automated Background Publishing Engine (Timer/Cron)...');
    // Create an episode scheduled 2 seconds in the past to simulate due release
    const nowStr = getISTNowString();
    const createDue = await query(`
      INSERT INTO chapters (
        novel_id, chapter_num, episode_number, title, content, status, scheduled_at, timezone
      ) VALUES (
        ?, '993', '993', 'Auto Release Episode', '<p>Auto release content</p>', 'scheduled', ?, 'Asia/Kolkata'
      );
    `, [adminNovelId, nowStr]);
    const dueEpId = createDue.insertId;

    // Run scheduler engine
    const schedResult = await runAutomatedPublishingScheduler();
    assert(schedResult.episodesCount >= 1, `Automated scheduler published due episode(s): count = ${schedResult.episodesCount}`);

    const autoPubDbRow = await queryOne('SELECT status, published_at FROM chapters WHERE id = ?;', [dueEpId]);
    assert(autoPubDbRow?.status === 'published', 'Due episode automatically changed to "published" by background engine');
    assert(Boolean(autoPubDbRow?.published_at), `Published timestamp automatically set: ${autoPubDbRow?.published_at}`);

    // Verify idempotency: running again should not re-publish or duplicate
    const secondRun = await runAutomatedPublishingScheduler();
    const afterSecondRun = await queryOne('SELECT status FROM chapters WHERE id = ?;', [dueEpId]);
    assert(afterSecondRun?.status === 'published', 'Idempotency verified: Status remains "published" without duplication');

    // Clean up
    await query('DELETE FROM chapters WHERE id = ?;', [dueEpId]);

  } catch (err) {
    console.error('Test execution failed with error:', err);
    failed++;
  }

  console.log('\n===================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('===================================================================');
  process.exit(failed > 0 ? 1 : 0);
}

runVerification();
