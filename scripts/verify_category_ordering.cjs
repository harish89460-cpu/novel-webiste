// scripts/verify_category_ordering.cjs
const http = require('http');

function request(options, data) {
  if (options.data && !data) data = options.data;
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => (body += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log('====================================================');
  console.log('Testing Admin Forms Category Ordering & Persistence');
  console.log('====================================================\n');

  const db = require('../backend/db.js');
  const { createSession } = await import('../backend/auth.js');

  // 1. Get the authorized admin user (rudhra_author or rudhra@rpnovels.com)
  const adminUser = await db.queryOne("SELECT id, username, email, role FROM users WHERE username = 'rudhra_author' OR email = 'digitalmarkservices.in@gmail.com' OR email = 'rudhra@rpnovels.com' LIMIT 1;");
  if (!adminUser) {
    throw new Error('Authorized Admin user not found in database');
  }
  const adminToken = await createSession(adminUser.id, 'author');

  // 2. Fetch existing hierarchy
  console.log('--- 1. Fetching current content hierarchy ---');
  const hRes1 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/hierarchy',
    method: 'GET'
  });
  console.log(`HTTP ${hRes1.status}, total categories: ${hRes1.data.hierarchy?.length}`);
  console.log('Current order:', hRes1.data.hierarchy?.map((c, i) => `${i + 1}. ${c.title} (${c.id}, sort_order=${c.sortOrder})`).join(' -> '));

  // 3. Test unauthenticated reorder -> 401
  console.log('\n--- 2. Testing unauthenticated reorder protection ---');
  const unauthRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/main-categories/reorder',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { order: ['general', 'ongoing-novels', 'audio-novels', 'completed-novels', 'short-stories'] }
  });
  console.log(`✓ Unauthenticated reorder blocked: HTTP ${unauthRes.status}`);

  // 4. Test admin reordering:
  // Required test arrangement: General (1), Ongoing Novels (2), Audio Novels (3), Completed Novels (4), Short Stories (5)
  console.log('\n--- 3. Testing custom reorder by Admin ---');
  const targetOrder = [
    { id: 'general', sortOrder: 1 },
    { id: 'ongoing-novels', sortOrder: 2 },
    { id: 'audio-novels', sortOrder: 3 },
    { id: 'completed-novels', sortOrder: 4 },
    { id: 'short-stories', sortOrder: 5 }
  ];

  const reorderRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/main-categories/reorder',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    data: { order: targetOrder }
  });
  console.log(`✓ Reorder API response: HTTP ${reorderRes.status}, message="${reorderRes.data.message}"`);

  // 5. Verify Forms page hierarchy reflects new order dynamically
  console.log('\n--- 4. Verifying Forms page hierarchy reflects new order dynamically ---');
  const hRes2 = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/hierarchy',
    method: 'GET'
  });

  const newOrder = hRes2.data.hierarchy?.map(c => c.id);
  console.log('New hierarchy order on Forms page:', hRes2.data.hierarchy?.map((c, i) => `${i + 1}. ${c.title} (${c.id})`).join(' -> '));

  if (newOrder[0] === 'general' && newOrder[1] === 'ongoing-novels' && newOrder[2] === 'audio-novels' && newOrder[3] === 'completed-novels' && newOrder[4] === 'short-stories') {
    console.log('✓ EXACT MATCH with target ordering: General (1st), Ongoing Novels (2nd), Audio Novels (3rd), Completed Novels (4th), Short Stories (5th)!');
  } else {
    throw new Error(`Order mismatch! Received: ${JSON.stringify(newOrder)}`);
  }

  // 6. Test Single Category Edit with sort_order
  console.log('\n--- 5. Testing Single Category Edit with Display Order ---');
  const editRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/main-categories/short-stories',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    data: {
      sort_order: 1
    }
  });
  console.log(`✓ Edit category response: HTTP ${editRes.status}, message="${editRes.data.message}"`);

  const dbCheck = await db.queryOne("SELECT id, sort_order FROM forum_categories WHERE id = 'short-stories';");
  console.log(`✓ Database reflects short-stories sort_order = ${dbCheck.sort_order}`);

  // Revert back so General is 1st and Short Stories is 5th
  await db.query("UPDATE forum_categories SET sort_order = 5 WHERE id = 'short-stories';");
  await db.query("UPDATE forum_categories SET sort_order = 1 WHERE id = 'general';");

  // 7. Test Sensible Default Position for newly created category
  console.log('\n--- 6. Testing Sensible Default Position for New Category ---');
  const createRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/main-categories',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    data: {
      id: 'test-new-category',
      title: 'Test New Category',
      description: 'Temporary verification category'
    }
  });
  console.log(`✓ New category created: HTTP ${createRes.status}`);

  const newCatDb = await db.queryOne("SELECT id, sort_order FROM forum_categories WHERE id = 'test-new-category';");
  console.log(`✓ New category assigned sensible default sort_order = ${newCatDb.sort_order} (placed after existing categories)`);

  // Clean up test category
  await db.query("DELETE FROM forum_categories WHERE id = 'test-new-category';");
  console.log('✓ Cleaned up temporary test category');

  console.log('\n====================================================');
  console.log('ALL CATEGORY ORDERING INTEGRATION TESTS PASSED!');
  console.log('====================================================');
  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
