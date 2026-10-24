// End-to-end verification of Novel Creation Workflow, Author Authorization, and MySQL Persistence
import http from 'node:http';
import { query, queryOne } from '../server/db.js';
import { createSession } from '../server/auth.js';

const PORT = 3000;

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('STARTING NOVEL CREATION & AUTHOR AUTHORIZATION WORKFLOW TESTS');
  console.log('='.repeat(70));

  let passed = 0;
  let total = 0;

  function assert(title, condition, extra = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${title} ${extra}`);
    } else {
      console.error(`[FAIL] ${title} ${extra}`);
    }
  }

  // TEST 1: Unauthenticated user cannot create a novel
  const unauthRes = await request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/novels',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { title: 'Hacked Novel', slug: 'hacked-novel' });
  assert('1. Unauthenticated request to POST /api/novels is blocked (401)', unauthRes.status === 401);

  // TEST 2: Normal reader account cannot create a novel
  // Create a regular user session (role: 'Member', isAuthorSession: false)
  const readerUser = await queryOne("SELECT id FROM users WHERE role = 'Member' LIMIT 1;");
  if (readerUser) {
    const readerToken = await createSession(readerUser.id, 'reader');
    const readerRes = await request({
      hostname: '127.0.0.1',
      port: PORT,
      path: '/api/novels',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${readerToken}`
      }
    }, { title: 'Reader Novel', slug: 'reader-novel' });
    assert('2. Ordinary reader token is rejected with 403 Forbidden', readerRes.status === 403);
  }

  // TEST 3: Author Login succeeds and returns authorized session
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'digitalmarkservices.in@gmail.com',
    password: 'Rudhra.pass'
  });
  assert('3. Author Login authenticates successfully (200)', loginRes.status === 200 && loginRes.body.success === true);
  const authorToken = loginRes.body.token;

  // TEST 4: Get Overview Metrics before novel creation
  const overviewBefore = await request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/admin/overview',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authorToken}` }
  });
  const initialNovelsCount = overviewBefore.body.stats?.novels?.total || 0;
  console.log(`Initial total novels in database: ${initialNovelsCount}`);

  // TEST 5: Create a real novel via authorized author
  const testSlug = `test-novel-${Date.now().toString().slice(-6)}`;
  const testTitle = `காதல் நிலவே (Kadhal Nilave - Test ${Date.now().toString().slice(-4)})`;
  const createRes = await request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/novels',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authorToken}`
    }
  }, {
    id: testSlug,
    slug: testSlug,
    title: testTitle,
    author: 'Rudhra Prarthana',
    genre: 'Romance / Drama',
    category: 'Ongoing Novels',
    status: 'Ongoing',
    visibility: 'public',
    isPublished: 1,
    featured: 1,
    cover: '/default-cover.jpg',
    description: 'A mesmerizing romantic drama penned by Rudhra Prarthana.'
  });

  assert('5. Authorized Author creates novel successfully (201)', createRes.status === 201 && createRes.body.success === true);

  // TEST 6: Verify persistence directly in MySQL database
  const dbNovel = await queryOne('SELECT * FROM novels WHERE id = ?;', [testSlug]);
  assert('6. Novel record exists in MySQL novels table', Boolean(dbNovel) && dbNovel.title === testTitle);
  assert('6a. Novel author is saved as Rudhra Prarthana', dbNovel?.author === 'Rudhra Prarthana');
  assert('6b. Novel status is saved as Ongoing', dbNovel?.status === 'Ongoing');
  assert('6c. Novel visibility is saved as public', dbNovel?.visibility === 'public');

  // TEST 7: Check Overview Metrics after novel creation
  const overviewAfter = await request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/admin/overview',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${authorToken}` }
  });
  const updatedNovelsCount = overviewAfter.body.stats?.novels?.total || 0;
  assert('7. Overview metrics reflect the new novel count increment', updatedNovelsCount === initialNovelsCount + 1, `(${initialNovelsCount} -> ${updatedNovelsCount})`);

  // TEST 8: Test Save Draft workflow
  const draftSlug = `draft-novel-${Date.now().toString().slice(-6)}`;
  const draftTitle = `கனவுப் பயணம் (Kanavu Payanam Draft)`;
  const draftRes = await request({
    hostname: '127.0.0.1',
    port: PORT,
    path: '/api/novels',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authorToken}`
    }
  }, {
    id: draftSlug,
    slug: draftSlug,
    title: draftTitle,
    author: 'Rudhra Prarthana',
    genre: 'Family Drama',
    status: 'Ongoing',
    visibility: 'draft',
    isPublished: 0,
    cover: '/default-cover.jpg',
    description: 'Draft manuscript for upcoming release.'
  });
  assert('8. Author saves novel draft successfully', draftRes.status === 201 && draftRes.body.success === true);

  const dbDraft = await queryOne('SELECT * FROM novels WHERE id = ?;', [draftSlug]);
  assert('8a. Draft novel saved in MySQL with visibility=draft and is_published=0', dbDraft?.visibility === 'draft' && dbDraft?.is_published === 0);

  // Clean up test records
  await query('DELETE FROM novels WHERE id IN (?, ?);', [testSlug, draftSlug]);
  console.log('Cleaned up test novels from database.');

  console.log('\n' + '='.repeat(70));
  console.log(`WORKFLOW TEST RESULTS: ${passed} / ${total} CHECKS PASSED`);
  console.log('='.repeat(70));

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
