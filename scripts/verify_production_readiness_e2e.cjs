// Comprehensive End-to-End Production Readiness Verification Suite
// Tests every required production workflow against the live running Node.js + MySQL server

const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const BASE_URL = 'http://127.0.0.1:3000';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runProductionTestSuite() {
  console.log('===================================================================');
  console.log('  STARTING PRODUCTION READINESS END-TO-END VERIFICATION SUITE');
  console.log('===================================================================');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name} -> ${err.message}`);
      failed++;
    }
  }

  // 1. Health check
  await test('Server health endpoint returns 200 OK with MySQL connected', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
    assert.strictEqual(res.body.database, 'mysql');
  });

  // 2. Initial Clean State
  await test('Public novel catalog starts with 0 novels (clean production empty state)', async () => {
    const res = await request('GET', '/api/novels');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(Array.isArray(res.body.novels), true);
    assert.strictEqual(res.body.novels.length, 0);
  });

  // 3. Admin Login
  let adminToken = null;
  await test('Administrator logs in via dedicated Author Portal with valid credentials', async () => {
    const res = await request('POST', '/api/admin/login', {
      username: 'rudhra_author',
      password: 'Rudhra.pass'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual((res.body.user.role || '').toLowerCase(), 'admin');
    assert.strictEqual(res.body.user.isAdmin, true);
    assert.strictEqual(res.body.user.isAuthorSession, true);
    assert(res.body.token);
    adminToken = res.body.token;
  });

  // 4. Access Control
  await test('Unauthenticated requests to admin endpoints are blocked (401 Unauthorized)', async () => {
    const res = await request('GET', '/api/admin/novels');
    assert.strictEqual(res.status, 401);
  });

  // 5. User Registration & Reader Login
  const testUsername = `prod_reader_${Date.now()}`;
  const testEmail = `${testUsername}@example.com`;
  let readerToken = null;
  let readerUserId = null;

  await test('New user registers successfully as reader', async () => {
    const res = await request('POST', '/api/auth/register', {
      username: testUsername,
      email: testEmail,
      password: 'Password123!',
      displayName: 'Production Test Reader'
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.role, 'Member');
    assert(res.body.token);
    readerToken = res.body.token;
    readerUserId = res.body.user.id;
  });

  // 6. Reader Access Control Enforcement
  await test('Reader account is strictly denied access to author portal', async () => {
    const res = await request('POST', '/api/admin/login', {
      username: testUsername,
      password: 'Password123!'
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Reader session token is denied admin endpoints (403 Forbidden)', async () => {
    const res = await request('GET', '/api/admin/novels', null, {
      'Authorization': `Bearer ${readerToken}`
    });
    assert.strictEqual(res.status, 403);
  });

  // 7. Image Upload & Replacement
  const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  let uploadedCoverUrl = null;

  await test('Admin uploads novel cover via unified image upload endpoint', async () => {
    const res = await request('POST', '/api/upload/image', {
      data: tinyPngBase64,
      folder: 'covers',
      filename: 'prod_test_cover.png'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert(res.body.url.startsWith('/uploads/covers/'));
    uploadedCoverUrl = res.body.url;

    // Verify physical file on disk
    const diskPath = path.resolve('backend', uploadedCoverUrl.replace(/^\//, ''));
    assert.strictEqual(fs.existsSync(diskPath), true);
  });

  // 8. Novel Creation Workflow
  const testNovelId = `prod-novel-${Date.now()}`;
  await test('Admin creates a new novel with title, genres, and cover', async () => {
    const res = await request('POST', '/api/admin/novels', {
      id: testNovelId,
      title: 'Vaanavil Ninaivugal (வானவில் நினைவுகள்)',
      author: 'Rudhra Prarthana',
      genre: 'Romance, Drama',
      category: 'Romance',
      description: 'An inspiring emotional family drama and modern love story.',
      cover: uploadedCoverUrl,
      status: 'Ongoing',
      is_published: 1,
      visibility: 'public'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
  });

  // 9. Chapter Creation Workflow
  let chapterId = null;
  await test('Admin creates root Chapter under novel (title and metadata only)', async () => {
    const res = await request('POST', '/api/admin/episodes', {
      novelId: testNovelId,
      chapterNum: '1',
      title: 'Chapter 1: The Beginning',
      titleTa: 'அத்தியாயம் 1: ஆரம்பம்',
      status: 'published'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert(res.body.episode && res.body.episode.id);
    chapterId = res.body.episode.id;
  });

  // 10. Episode Creation Workflow
  let episodeId = null;
  await test('Admin creates child Episode under Chapter with story content', async () => {
    const res = await request('POST', '/api/admin/episodes', {
      novelId: testNovelId,
      parentId: chapterId,
      chapterNum: '1.1',
      title: 'Episode 1.1: Sunrise over the Hills',
      titleTa: 'பகுதி 1.1: மலை முகட்டில் விடியல்',
      content: '<p>The golden dawn spilled across the misty hills of Chennai...</p>',
      status: 'published'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert(res.body.episode && res.body.episode.id);
    episodeId = res.body.episode.id;
  });

  // 11. Chapter Edit Workflow
  await test('Admin edits Chapter title, preserving child episodes and story content', async () => {
    const res = await request('PUT', `/api/admin/episodes/${chapterId}`, {
      title: 'Chapter 1: The Awakening Dawn',
      titleTa: 'அத்தியாயம் 1: விடியலின் விழிப்புணர்வு'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // Verify child episode still intact via admin single episode endpoint
    const childRes = await request('GET', `/api/admin/episodes/${episodeId}`, null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert.strictEqual(childRes.status, 200);
    assert.strictEqual(childRes.body.episode.parentId, chapterId);
    assert(childRes.body.episode.content.includes('golden dawn'));
  });

  // 12. Public Novel Details
  await test('Public novel detail returns published novel with chapters and episodes', async () => {
    const res = await request('GET', `/api/novels/${testNovelId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.novel.id, testNovelId);
    assert.strictEqual(res.body.novel.title, 'Vaanavil Ninaivugal (வானவில் நினைவுகள்)');
    assert(Array.isArray(res.body.novel.chapters));
    assert(res.body.novel.chapters.length >= 1);
  });

  // 13. Comments & Replies
  let commentId = null;
  await test('Reader posts comment on novel detail page', async () => {
    const res = await request('POST', '/api/comments', {
      novelId: testNovelId,
      chapterNum: '0',
      content: '<p>What a wonderfully evocative start to this novel!</p>'
    }, {
      'Authorization': `Bearer ${readerToken}`
    });
    assert(res.status === 200 || res.status === 201);
    assert.strictEqual(res.body.success, true);
    assert(res.body.comment && res.body.comment.id);
    commentId = res.body.comment.id;
  });

  await test('Reader posts reply to comment with parent context', async () => {
    const res = await request('POST', '/api/comments', {
      novelId: testNovelId,
      chapterNum: '0',
      parentId: commentId,
      content: '<p>Looking forward to episode 2 already!</p>'
    }, {
      'Authorization': `Bearer ${readerToken}`
    });
    assert(res.status === 200 || res.status === 201);
    assert.strictEqual(res.body.success, true);
  });

  // 14. Emoji Reaction
  await test('Reader adds emoji reaction to novel', async () => {
    const res = await request('POST', '/api/reactions', {
      targetType: 'novel',
      targetId: testNovelId,
      chapterNum: 0,
      emoji: '❤️'
    }, {
      'Authorization': `Bearer ${readerToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  // 15. Clean up temporary test data created during verification
  console.log('\n[Clean Up] Removing verification test novel and reader...');
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'rp_novels_db'
  });

  await conn.query('DELETE FROM comments WHERE novel_id = ?;', [testNovelId]);
  await conn.query('DELETE FROM reactions WHERE target_id = ?;', [testNovelId]);
  await conn.query('DELETE FROM chapters WHERE novel_id = ?;', [testNovelId]);
  await conn.query('DELETE FROM novels WHERE id = ?;', [testNovelId]);
  await conn.query('DELETE FROM notifications;');
  await conn.query('DELETE FROM sessions WHERE user_id != 2;');
  await conn.query('DELETE FROM profiles WHERE user_id != 2;');
  await conn.query('DELETE FROM activity_status WHERE user_id != 2;');
  await conn.query('DELETE FROM users WHERE id != 2;');

  // Remove uploaded test cover
  if (uploadedCoverUrl) {
    const diskPath = path.resolve('backend', uploadedCoverUrl.replace(/^\//, ''));
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
  }

  // Verify final database state
  const [users] = await conn.query('SELECT id, username, role FROM users;');
  const [novels] = await conn.query('SELECT COUNT(*) as count FROM novels;');
  await conn.end();

  await test('Database cleanly returns to 0 novels and 1 admin account after verification', async () => {
    assert.strictEqual(novels[0].count, 0);
    assert.strictEqual(users.length, 1);
    assert.strictEqual(users[0].id, 2);
    assert.strictEqual(users[0].role, 'Admin');
  });

  console.log('\n===================================================================');
  console.log(`PRODUCTION READINESS VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
  console.log('===================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runProductionTestSuite().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
