// Automated Verification Script: verify_forum_admin.js
// Tests Forum Categories, Admin Management APIs, Database Persistence, and Permissions

import { query, getDb } from '../backend/db.js';
import crypto from 'node:crypto';

const BASE_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('=== RUNNING FORUM CATEGORIES & ADMIN MANAGEMENT TEST SUITE ===');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Get an existing admin user and session token for authorization
    const adminUser = await query(`
      SELECT u.id, u.username, u.email, s.token 
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id AND s.session_type = 'author' AND s.expires_at > NOW()
      WHERE u.role = 'admin'
      ORDER BY s.token DESC LIMIT 1;
    `);

    let adminToken = null;
    let adminId = null;

    if (adminUser && adminUser.length > 0 && adminUser[0].token) {
      adminToken = adminUser[0].token;
      adminId = adminUser[0].id;
      console.log(`Using existing admin user ID: ${adminId} (${adminUser[0].username})`);
    } else {
      // Find admin user or create session
      const anyAdmin = await query(`SELECT id, username FROM users WHERE role = 'admin' LIMIT 1;`);
      if (anyAdmin && anyAdmin.length > 0) {
        adminId = anyAdmin[0].id;
        adminToken = 'test_adm_tok_' + crypto.randomBytes(16).toString('hex');
        await query(`
          INSERT INTO sessions (user_id, token, session_type, expires_at, created_at)
          VALUES (?, ?, 'author', DATE_ADD(NOW(), INTERVAL 2 DAY), NOW());
        `, [adminId, adminToken]);
        console.log(`Created test admin session for user ID: ${adminId}`);
      }
    }

    assert(Boolean(adminToken), 'Admin authorization session available for testing');

    // 2. Test Public Category API
    console.log('\n--- 1. Testing Public Categories API ---');
    const catRes = await fetch(`${BASE_URL}/forum/categories`);
    const catData = await catRes.json();
    assert(catRes.status === 200, 'GET /forum/categories returns HTTP 200');
    assert(catData.success === true, 'GET /forum/categories success is true');
    assert(Array.isArray(catData.categories), 'GET /forum/categories returns categories array');

    const catIds = (catData.categories || []).map(c => c.id);
    console.log('Categories found:', catIds);
    assert(catIds.includes('general'), 'Includes category: general');
    assert(catIds.includes('ongoing-novels'), 'Includes category: ongoing-novels');
    assert(catIds.includes('completed-novels'), 'Includes category: completed-novels');
    assert(catIds.includes('short-stories'), 'Includes category: short-stories');
    assert(catIds.includes('audio-novels'), 'Includes category: audio-novels');

    // 3. Test Unauthorized Access Prevention
    console.log('\n--- 2. Testing Security & Authorization Controls ---');
    const unauthRes = await fetch(`${BASE_URL}/admin/forum/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hacker Category' })
    });
    assert(unauthRes.status === 401 || unauthRes.status === 403, 'Unauthenticated POST /admin/forum/categories rejected with 401/403');

    const unauthTopicRes = await fetch(`${BASE_URL}/admin/forum/topics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hacker Topic', content: 'Exploit' })
    });
    assert(unauthTopicRes.status === 401 || unauthTopicRes.status === 403, 'Unauthenticated POST /admin/forum/topics rejected with 401/403');

    // 4. Test Admin Category Creation
    console.log('\n--- 3. Testing Admin Category Creation & Updating ---');
    const testCatId = 'test-festive-specials-' + Date.now().toString().slice(-4);
    const createCatRes = await fetch(`${BASE_URL}/admin/forum/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        id: testCatId,
        title: 'Festive Specials Hub',
        description: 'Special festival novellas, celebratory chapters, and community holiday greetings.',
        icon: '🎉',
        color: '#4A0E4E',
        sort_order: 15,
        is_active: 1
      })
    });
    const createCatData = await createCatRes.json();
    assert(createCatRes.status === 201, 'POST /admin/forum/categories returns HTTP 201 Created');
    assert(createCatData.success === true, 'Category creation returns success: true');
    assert(createCatData.categoryId === testCatId, `Returned categoryId matches: ${testCatId}`);

    // Update Category
    const updateCatRes = await fetch(`${BASE_URL}/admin/forum/categories/${testCatId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Festive Specials & Holiday Tales',
        sort_order: 12
      })
    });
    const updateCatData = await updateCatRes.json();
    assert(updateCatRes.status === 200, 'PUT /admin/forum/categories/:id returns HTTP 200 OK');
    assert(updateCatData.success === true, 'Category update returns success: true');

    // Verify DB reflection
    const dbCat = await query(`SELECT title, sort_order, color, is_active FROM forum_categories WHERE id = ?`, [testCatId]);
    assert(dbCat.length > 0 && dbCat[0].title === 'Festive Specials & Holiday Tales', 'Category updates persisted genuinely in MySQL');

    // 5. Test Admin Official Topic Creation
    console.log('\n--- 4. Testing Admin Official Topic Creation & Pinning ---');
    const createTopicRes = await fetch(`${BASE_URL}/admin/forum/topics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        categoryId: testCatId,
        title: 'Official Welcome Note: Celebrating Literary Journeys Together',
        content: 'Dear cherished readers, welcome to this festive space! Here we share festival-special novellas, reader thoughts, and heartfelt stories.',
        is_published: 1,
        is_pinned: 1,
        sort_order: 1
      })
    });
    const createTopicData = await createTopicRes.json();
    assert(createTopicRes.status === 201, 'POST /admin/forum/topics returns HTTP 201 Created');
    assert(createTopicData.success === true, 'Topic creation returns success: true');
    const testTopicId = createTopicData.topicId;
    assert(Boolean(testTopicId), `Created topic with ID: ${testTopicId}`);

    // Verify Topic in Topics API
    const topicListRes = await fetch(`${BASE_URL}/forum/topics?category=${testCatId}`);
    const topicListData = await topicListRes.json();
    assert(topicListRes.status === 200, 'GET /forum/topics?category=... returns HTTP 200');
    assert(topicListData.topics.length > 0, 'New topic appears under category in topics list');
    const foundTopic = topicListData.topics.find(t => t.id === testTopicId);
    assert(foundTopic && foundTopic.isPinned === true, 'Topic has isPinned = true');
    assert(foundTopic && foundTopic.title.includes('Official Welcome Note'), 'Topic title matches database');

    // Update Topic (Edit & Pin Toggle)
    console.log('\n--- 5. Testing Topic Updating, Pinning & Publishing Toggles ---');
    const updateTopicRes = await fetch(`${BASE_URL}/admin/forum/topics/${testTopicId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        title: 'Official Welcome Note: Updated Edition',
        is_pinned: 0
      })
    });
    const updateTopicData = await updateTopicRes.json();
    assert(updateTopicRes.status === 200, 'PUT /admin/forum/topics/:id returns HTTP 200');
    assert(updateTopicData.success === true, 'Topic updated successfully');

    // Verify Unpin
    const dbTopic = await query(`SELECT title, is_pinned, is_published FROM forum_topics WHERE id = ?`, [testTopicId]);
    assert(dbTopic[0].is_pinned === 0, 'Topic is_pinned toggled to 0 in MySQL');
    assert(dbTopic[0].title === 'Official Welcome Note: Updated Edition', 'Topic title updated in MySQL');

    // 6. Test Safe Deletion / Disable
    console.log('\n--- 6. Testing Safe Deletion / Preservation of Member Data ---');
    const deleteCatRes = await fetch(`${BASE_URL}/admin/forum/categories/${testCatId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const deleteCatData = await deleteCatRes.json();
    assert(deleteCatRes.status === 200, 'DELETE /admin/forum/categories returns HTTP 200');
    assert(deleteCatData.success === true, 'Delete endpoint handles category safely');

    // Check that because topic existed, category is safely disabled rather than hard deleted
    const disabledCat = await query(`SELECT is_active FROM forum_categories WHERE id = ?`, [testCatId]);
    assert(disabledCat.length > 0 && disabledCat[0].is_active === 0, 'Category safely disabled to preserve discussions');

    // Clean up test data
    await query(`DELETE FROM forum_posts WHERE topic_id = ?`, [testTopicId]);
    await query(`DELETE FROM forum_topics WHERE id = ?`, [testTopicId]);
    await query(`DELETE FROM forum_categories WHERE id = ?`, [testCatId]);
    console.log('Cleaned up temporary test category and topic.');

    console.log('\n======================================================');
    console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('======================================================');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    const pool = getDb();
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  }
}

runTests();
