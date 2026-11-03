// Comprehensive Verification Suite for Automatic Novel Publishing
// Rudhra Prarthana Novels — Asia/Kolkata (IST) Automated Publishing Engine

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('===================================================================');
  console.log('   AUTOMATIC NOVEL PUBLISHING SYSTEM: END-TO-END VERIFICATION      ');
  console.log('===================================================================\n');

  const { getDb } = await import('../backend/db.js');
  const { parseISTDateTime, formatISTDisplay, getISTNowString, isPastIST } = await import('../backend/timezone.js');
  const { createNovel, getNovelById } = await import('../backend/novels.js');
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

  // STEP 1: Verify current Chennai local time from system clock
  console.log('[1/6] Reading Chennai System Time & Setting 2-Minute Future Schedule...');
  const nowMs = Date.now();
  const schedMs = nowMs + 120000; // Exactly 2 minutes in the future
  const schedDate = new Date(schedMs);
  const nowIST = getISTNowString();
  const schedIST = parseISTDateTime(schedDate);

  console.log(`  🕒 Actual Chennai Time (IST Now):   ${nowIST}`);
  console.log(`  ⏰ Scheduled Release Time (IST +2m): ${schedIST}`);
  console.log(`  📌 Formatted IST Display:           ${formatISTDisplay(schedIST)}`);

  // STEP 2: Create a temporary test novel with status: 'Scheduled'
  console.log('\n[2/6] Creating Scheduled Novel in MySQL Database...');
  const testId = `auto-pub-test-novel-${Date.now()}`;
  const testTitle = `Automatic Publishing Test Novel ${Date.now()}`;

  const novelPayload = {
    id: testId,
    title: testTitle,
    author: 'Rudhra Prarthana',
    authorId: 2,
    genre: 'Romance',
    category: 'Ongoing Novels',
    status: 'Scheduled',
    visibility: 'public',
    contentType: 'written_novel',
    language: 'Tamil',
    scheduledAt: schedIST,
    timezone: 'Asia/Kolkata',
    synopsis: 'Temporary automated test novel to verify scheduled publishing.',
    cover: '/default-cover.jpg'
  };

  const createRes = await createNovel(novelPayload);
  assert(createRes.success === true, `Novel created via createNovel(): ID=${createRes.novel?.id || testId}`);

  const novelId = createRes.novel?.id || testId;

  // STEP 3: Verify MySQL initial storage state
  console.log('\n[3/6] Verifying Pending Status & Publication Timestamp in MySQL...');
  const [rows] = await pool.query('SELECT id, title, status, is_published, visibility, scheduled_at FROM novels WHERE id = ?;', [novelId]);
  const initialRow = rows[0];

  assert(Boolean(initialRow), 'Novel record confirmed in MySQL `novels` table');
  assert(initialRow?.status === 'Scheduled', `Initial MySQL status is strictly "Scheduled" (got: "${initialRow?.status}")`);
  assert(initialRow?.is_published === 0, `Initial is_published is strictly 0 (unreleased) (got: ${initialRow?.is_published})`);
  assert(String(initialRow?.scheduled_at).startsWith(schedIST.slice(0, 16)), `MySQL scheduled_at matches IST timestamp: ${initialRow?.scheduled_at}`);

  // STEP 4: Confirm novel is NOT publicly visible before scheduled time
  console.log('\n[4/6] Confirming Test Novel is Blocked from Public Access Before Scheduled Time...');
  
  // Test 4a: GET /api/novels/:id as unauthenticated visitor
  const pubDetailRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${novelId}`,
    method: 'GET'
  });
  assert(pubDetailRes.status === 403, `GET /api/novels/${novelId} returns HTTP 403 Forbidden before release (got: ${pubDetailRes.status})`);
  assert(pubDetailRes.body?.error === 'This content is scheduled for future release.', 'API returns "This content is scheduled for future release." message');

  // Test 4b: GET /api/novels (public novel listing)
  const pubListRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/novels',
    method: 'GET'
  });
  const inPublicList = (pubListRes.body?.novels || []).some(n => n.id === novelId);
  assert(!inPublicList, 'Scheduled novel is hidden from public /api/novels list before release');

  // Test 4c: GET /api/content/hierarchy
  const pubFormsRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/hierarchy',
    method: 'GET'
  });
  let inFormsHierarchy = false;
  if (Array.isArray(pubFormsRes.body?.hierarchy)) {
    for (const cat of pubFormsRes.body.hierarchy) {
      if ((cat.novels || []).some(n => n.id === novelId)) inFormsHierarchy = true;
    }
  }
  assert(!inFormsHierarchy, 'Scheduled novel is hidden from public Forms page hierarchy before release');

  // STEP 5: Live wait until scheduled time arrives, monitoring background scheduler
  console.log('\n[5/6] Real-Time Live Wait for Background Scheduler Execution (Without Browser Open)...');
  console.log(`  ⏳ Waiting for 120s to elapse until ${schedIST} IST. Background scheduler runs every 30s.`);

  let isPublished = false;
  let attempts = 0;
  const maxAttempts = 16; // Up to 160 seconds
  let publishElapsed = 0;

  while (attempts < maxAttempts) {
    await sleep(10000); // 10s check intervals
    attempts++;
    const [statusRows] = await pool.query('SELECT id, status, is_published, visibility, scheduled_at, NOW() as dbNow FROM novels WHERE id = ?;', [novelId]);
    const row = statusRows[0];
    const diffSec = Math.round((new Date(row.scheduled_at).getTime() - new Date(row.dbNow).getTime()) / 1000);

    if (row.is_published === 1 && row.status === 'Ongoing') {
      publishElapsed = attempts * 10;
      console.log(`  🎉 [${publishElapsed}s elapsed] Novel automatically published by background scheduler!`);
      console.log(`     MySQL Status: "${row.status}" | is_published: ${row.is_published} | visibility: "${row.visibility}"`);
      isPublished = true;
      break;
    } else {
      console.log(`  ⏳ [${attempts * 10}s elapsed] MySQL DB Time: ${row.dbNow} | Scheduled: ${row.scheduled_at} (${diffSec > 0 ? diffSec + 's remaining' : 'Due! Awaiting next 30s scheduler loop'})`);
    }
  }

  assert(isPublished, `Novel was genuinely published by background scheduler when due (within ${publishElapsed}s)`);

  // STEP 6: Verify public visibility after scheduled publishing
  console.log('\n[6/6] Verifying Public Visibility, Website Access & API Responses After Publishing...');
  
  // 6a: Detail endpoint now returns 200 OK
  const postDetailRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/novels/${novelId}`,
    method: 'GET'
  });
  assert(postDetailRes.status === 200, `GET /api/novels/${novelId} now returns HTTP 200 OK after publishing`);
  assert(postDetailRes.body?.novel?.title === testTitle, `Public novel title matches: "${postDetailRes.body?.novel?.title}"`);
  assert(postDetailRes.body?.novel?.status === 'Ongoing', `Public novel status is "Ongoing"`);

  // 6b: Public listing now includes the novel
  const postListRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/novels',
    method: 'GET'
  });
  const nowInPublicList = (postListRes.body?.novels || []).some(n => n.id === novelId);
  assert(nowInPublicList, 'Published novel is now actively listed in public /api/novels collection');

  // 6c: Forms hierarchy now includes the novel
  const postFormsRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/hierarchy',
    method: 'GET'
  });
  let nowInForms = false;
  if (Array.isArray(postFormsRes.body?.hierarchy)) {
    for (const cat of postFormsRes.body.hierarchy) {
      if ((cat.novels || []).some(n => n.id === novelId)) nowInForms = true;
    }
  }
  assert(nowInForms, 'Published novel is now actively listed under Ongoing Novels on Forms page');

  // CLEAN UP
  console.log('\n[Clean Up] Removing temporary test novel...');
  await pool.query('DELETE FROM novels WHERE id = ?;', [novelId]);
  console.log(`  ✓ Temporary novel "${novelId}" cleanly removed from MySQL database.`);

  console.log('\n===================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('===================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

