// Verification test for Rudhra Prarthana Novels Scheduling System
// Tests:
// 1. Minute validation & normalization (00, 01, 09, 10, 30, 58, 59)
// 2. Scheduler endpoints & escapeQuote bug resolution
// 3. Real 2-minute future schedule, wait, and verify background publishing
// 4. Rescheduling and Cancellation APIs

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
  console.log('   SCHEDULER & MINUTE SELECTION END-TO-END VERIFICATION TEST       ');
  console.log('===================================================================\n');

  const { getDb } = await import('../backend/db.js');
  const { parseISTDateTime, formatISTDisplay, getISTNowString, isPastIST } = await import('../backend/timezone.js');
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

  // TEST 1: Minute values & Normalization
  console.log('[1/5] Testing minute values (00, 01, 09, 10, 30, 58, 59) and IST Parsing...');
  const testMinutes = ['00', '01', '09', '10', '30', '58', '59'];
  for (const min of testMinutes) {
    const parsed = parseISTDateTime({
      date: '2026-10-29',
      hour: 8,
      minute: min,
      ampm: 'PM'
    });
    assert(parsed === `2026-10-29 20:${min}:00`, `Minute "${min}" correctly parses to "2026-10-29 20:${min}:00"`);
  }

  // Also test single digit unpadded minute entry (e.g. typing 1 or 9)
  const parsed1 = parseISTDateTime({ date: '2026-10-29', hour: 8, minute: 1, ampm: 'PM' });
  assert(parsed1 === '2026-10-29 20:01:00', 'Typing single digit 1 normalizes to 20:01:00');
  const parsed9 = parseISTDateTime({ date: '2026-10-29', hour: 8, minute: 9, ampm: 'PM' });
  assert(parsed9 === '2026-10-29 20:09:00', 'Typing single digit 9 normalizes to 20:09:00');

  // TEST 2: EscapeQuote and Scheduler API
  console.log('\n[2/5] Testing Scheduler API & Frontend escapeQuote Resolution...');
  
  // Obtain authentic author/admin session token
  const adminToken = await createSession(2, 'author');
  assert(Boolean(adminToken), 'Admin author session token generated successfully');

  // Fetch scheduler list
  const schedRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/scheduler',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  });

  assert(schedRes.status === 200, 'GET /api/admin/scheduler returns HTTP 200');
  assert(schedRes.body?.success === true, 'Scheduler response has success: true');
  assert(Array.isArray(schedRes.body?.scheduled), 'Scheduler returned scheduled array without errors');

  // Verify escapeQuote exists in frontend source files
  const fs = require('fs');
  const adminJs = fs.readFileSync('src/js/admin.js', 'utf8');
  assert(adminJs.includes('window.escapeQuote = escapeQuote'), 'src/js/admin.js exports and binds window.escapeQuote');
  assert(adminJs.includes('window.validateAndNormalizeMinute'), 'src/js/admin.js includes window.validateAndNormalizeMinute');
  assert(adminJs.includes('sched-minute-select'), 'src/js/admin.js includes sched-minute-select (all 60 minutes)');

  const writerJs = fs.readFileSync('src/js/writer.js', 'utf8');
  assert(writerJs.includes('window.escapeQuote = escapeQuote'), 'src/js/writer.js exports and binds window.escapeQuote');
  assert(writerJs.includes('wsched-minute-select'), 'src/js/writer.js includes wsched-minute-select (all 60 minutes)');

  // TEST 3: Rescheduling & Cancellation functions
  console.log('\n[3/5] Testing Rescheduling and Edit Schedule API...');
  const [novels] = await pool.query('SELECT id, title FROM novels LIMIT 1;');
  const testNovel = novels[0];
  assert(Boolean(testNovel), `Target novel found: "${testNovel?.title}" (ID: ${testNovel?.id})`);

  const [preTest] = await pool.query(`
    INSERT INTO chapters (novel_id, chapter_num, title, content, status, scheduled_at, timezone, review_status)
    VALUES (?, 9997, 'Pre-Test Episode', '<p>Test</p>', 'scheduled', '2026-10-30 15:00:00', 'Asia/Kolkata', 'approved');
  `, [testNovel.id]);
  const preEpId = preTest.insertId;

  const reschedRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/scheduler/${preEpId}/reschedule`,
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  }, { scheduledAt: '2026-10-30 18:45:00', timezone: 'Asia/Kolkata' });

  assert(reschedRes.status === 200, 'Reschedule API returns 200 (rescheduled to 2026-10-30 18:45:00)');
  assert(reschedRes.body?.success === true, 'Reschedule API success flag is true');

  // Verify in MySQL
  const [reschedRows] = await pool.query('SELECT scheduled_at FROM chapters WHERE id = ?;', [preEpId]);
  assert(String(reschedRows[0]?.scheduled_at).startsWith('2026-10-30 18:45:00'), 'MySQL scheduled_at updated with new rescheduled time');

  // Test Cancellation
  const cancelRes = await httpRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/scheduler/${preEpId}/cancel`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    }
  });
  assert(cancelRes.status === 200, 'Cancel schedule API returns HTTP 200');
  const [canceledRow] = await pool.query('SELECT status, scheduled_at FROM chapters WHERE id = ?;', [preEpId]);
  assert(canceledRow[0]?.status === 'draft', 'Canceled episode status reverted to "draft"');
  assert(canceledRow[0]?.scheduled_at === null, 'Canceled episode scheduled_at cleared to NULL');
  await pool.query('DELETE FROM chapters WHERE id = ?;', [preEpId]);

  // TEST 4: Create real test schedule for exactly 2 minutes in the future
  console.log('\n[4/5] Setting up real 2-minute scheduled publishing test...');
  const nowMs = Date.now();
  const schedMs = nowMs + 120000; // +120 seconds (2 minutes)
  const schedDate = new Date(schedMs);
  const schedIST = parseISTDateTime(schedDate);
  const nowIST = getISTNowString();
  console.log(`  🕒 System Clock (Chennai IST Now):  ${nowIST}`);
  console.log(`  ⏰ Scheduled Publication Time (IST): ${schedIST} (+2 minutes)`);

  const testTitle = `Live E2E Verification Episode [${Date.now()}]`;
  const [insertResult] = await pool.query(`
    INSERT INTO chapters (novel_id, chapter_num, title, content, status, scheduled_at, timezone, review_status)
    VALUES (?, 9999, ?, '<p>Verification content for automated publishing engine.</p>', 'scheduled', ?, 'Asia/Kolkata', 'approved');
  `, [testNovel.id, testTitle, schedIST]);

  const testChapterId = insertResult.insertId;
  assert(Boolean(testChapterId), `Test episode created in MySQL with ID: ${testChapterId}`);

  // Confirm in MySQL that it is 'scheduled', NOT published yet, published_at is NULL
  const [checkRows] = await pool.query('SELECT id, status, scheduled_at, published_at FROM chapters WHERE id = ?;', [testChapterId]);
  assert(checkRows[0]?.status === 'scheduled', 'Initial MySQL status is strictly "scheduled"');
  assert(checkRows[0]?.published_at === null, 'Initial published_at is NULL');
  assert(String(checkRows[0]?.scheduled_at).startsWith(schedIST.slice(0, 16)), `MySQL scheduled_at matches expected IST timestamp: ${checkRows[0]?.scheduled_at}`);

  // TEST 5: Real-Time Live Wait for Background Scheduler Execution
  console.log('\n[5/5] Real-Time Live Wait for Background Scheduler Execution...');
  console.log('  ⏳ Waiting for the 2 minutes to elapse. Scheduler runs every 30s.');
  
  let isPublished = false;
  let attempts = 0;
  const maxAttempts = 15; // 150 seconds max wait
  
  while (attempts < maxAttempts) {
    await sleep(10000); // 10s intervals
    attempts++;
    const [statusRows] = await pool.query('SELECT id, status, scheduled_at, published_at, NOW() as currentDbTime FROM chapters WHERE id = ?;', [testChapterId]);
    const row = statusRows[0];
    const diffSeconds = Math.round((new Date(row.scheduled_at).getTime() - new Date(row.currentDbTime).getTime()) / 1000);
    
    if (row.status === 'published') {
      console.log(`  🎉 [${attempts * 10}s elapsed] Chapter published automatically by background scheduler!`);
      console.log(`     Published At: ${row.published_at}`);
      isPublished = true;
      break;
    } else {
      console.log(`  ⏳ [${attempts * 10}s elapsed] DB Time: ${row.currentDbTime} | Scheduled: ${row.scheduled_at} (${diffSeconds > 0 ? diffSeconds + 's remaining' : 'Due! Awaiting next 30s scheduler loop'})`);
    }
  }

  assert(isPublished, 'Test chapter was automatically published by the background publishing engine when due');

  // Verify DB state
  const [finalRows] = await pool.query('SELECT status, published_at FROM chapters WHERE id = ?;', [testChapterId]);
  assert(finalRows[0]?.status === 'published', 'Final database status is "published"');
  assert(Boolean(finalRows[0]?.published_at), `published_at is timestamped: ${finalRows[0]?.published_at}`);

  // Clean up
  console.log('\n[Clean Up] Removing temporary test chapter...');
  await pool.query('DELETE FROM chapters WHERE id = ?;', [testChapterId]);
  console.log('  ✓ Temporary test chapter removed cleanly without touching real records.');

  console.log('\n===================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED.`);
  console.log('===================================================================');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
