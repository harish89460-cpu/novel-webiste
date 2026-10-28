const http = require('http');
const { query, queryOne } = require('../backend/db');
const { createSession } = require('../backend/auth');
const { canWriterAccessContent } = require('../backend/writers');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
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

async function runVerification() {
  console.log('====================================================');
  console.log('VERIFYING REDESIGNED WRITER ACCESS MANAGEMENT SYSTEM');
  console.log('====================================================\n');

  // 1. Get Admin User and create Author session
  const adminUser = await queryOne("SELECT * FROM users WHERE username = 'rudhra_author' OR email = 'rudhra@rpnovels.com' OR email = 'digitalmarkservices.in@gmail.com' LIMIT 1;");
  if (!adminUser) {
    throw new Error('Admin user not found in database.');
  }
  const adminToken = await createSession(adminUser.id, 'author');
  console.log(`✓ Admin authenticated with author session token (User ID: ${adminUser.id}, Username: ${adminUser.username}).`);

  const authHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Cookie': `rudhra_author_session=${adminToken}; rudhra_session=${adminToken}`
  };

  // Find existing writers
  const writers = await query("SELECT id, username, email FROM users WHERE role = 'writer';");
  console.log(`✓ Found ${writers.length} writer account(s) in database:`, writers.map(w => `${w.username} (#${w.id})`).join(', '));
  if (writers.length < 2) {
    throw new Error('At least 2 writer accounts are required to test single and bulk permissions.');
  }

  const writer1 = writers[0];
  const writer2 = writers[1];

  // Save current permissions to restore later
  const origPerm1 = await queryOne('SELECT * FROM writer_permissions WHERE writer_id = ?;', [writer1.id]);
  const origPerm2 = await queryOne('SELECT * FROM writer_permissions WHERE writer_id = ?;', [writer2.id]);

  // Clean up any test assignments for writer1
  await query("DELETE FROM writer_assignments WHERE writer_id = ? AND content_id = '1';", [writer1.id]);

  // TEST 1: GET /api/admin/writers
  console.log('\n--- TEST 1: GET /api/admin/writers API response schema ---');
  const writersRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/writers',
    method: 'GET',
    headers: { ...authHeaders }
  });
  if (writersRes.status !== 200 || !writersRes.body.success) {
    throw new Error(`Failed to list writers: ${JSON.stringify(writersRes.body)}`);
  }
  const returnedWriters = writersRes.body.writers;
  console.log(`✓ Retrieved ${returnedWriters.length} writers.`);
  for (const w of returnedWriters) {
    if (!w.accessType || !w.permissionStatus || !Array.isArray(w.assignedContent)) {
      throw new Error(`Writer #${w.id} is missing required fields (accessType, permissionStatus, assignedContent).`);
    }
    console.log(`  - [ID ${w.id}] ${w.displayName || w.username}: AccessType=${w.accessType}, Status=${w.permissionStatus}, AssignedItems=${w.assignedContent.length}`);
  }

  // TEST 2: GET /api/admin/writers/content-lookup
  console.log('\n--- TEST 2: GET /api/admin/writers/content-lookup ---');
  const lookupRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/writers/content-lookup',
    method: 'GET',
    headers: { ...authHeaders }
  });
  if (lookupRes.status !== 200 || !lookupRes.body.success) {
    throw new Error(`Content lookup failed: ${JSON.stringify(lookupRes.body)}`);
  }
  const lookup = lookupRes.body;
  console.log(`✓ Lookup loaded: ${lookup.mainCategories.length} main categories, ${lookup.subCategories.length} subcategories, ${lookup.novels.length} novels, ${lookup.shortStories.length} short stories, ${lookup.audioNovels.length} audio novels.`);

  // TEST 3: OPTION A — Full Access
  console.log('\n--- TEST 3: OPTION A — FULL ACCESS GRANT & WORKFLOW ---');
  const fullAccessRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/writers/${writer1.id}/permissions`,
    method: 'PUT',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    }
  }, {
    accessType: 'full',
    fullAccess: 1,
    permissionStatus: 'active'
  });
  if (fullAccessRes.status !== 200 || !fullAccessRes.body.success) {
    throw new Error(`Failed to grant Full Access: ${JSON.stringify(fullAccessRes.body)}`);
  }
  console.log('✓ Granted Option A (Full Access) to Writer #', writer1.id);

  // Verify backend access helper
  const accessCheckFull = await canWriterAccessContent(writer1.id, 'novel', null, 'create');
  if (!accessCheckFull.allowed || accessCheckFull.accessLevel !== 'independent_publish') {
    throw new Error(`Full Access validation failed on backend: ${JSON.stringify(accessCheckFull)}`);
  }
  console.log('✓ Backend verified: Writer has independent_publish and unrestricted access.');

  // TEST 4: OPTION B — Particular Access with Specific Assignment
  console.log('\n--- TEST 4: OPTION B — PARTICULAR ACCESS & STRICT SCOPE ENFORCEMENT ---');
  // First, set writer1 to particular access without independent publishing
  await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/writers/${writer1.id}/permissions`,
    method: 'PUT',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    }
  }, {
    accessType: 'particular',
    fullAccess: 0,
    canPublishIndependently: 0,
    canSchedule: 0,
    canNovels: 1,
    canEpisodes: 1,
    canShortStories: 0,
    canAudioNovels: 0,
    accessLevel: 'review_required',
    permissionStatus: 'active'
  });

  // Assign specific novel (novel #1) to writer1 with write & submit only (no direct publish)
  await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/writers/${writer1.id}/assignments`,
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    }
  }, {
    contentType: 'novel',
    contentId: '1',
    instructions: 'Assigned test novel',
    actions: 'create,edit,submit'
  });
  console.log('✓ Assigned Novel #1 to writer with actions: [create, edit, submit].');

  // Verify access for assigned novel #1 -> should be allowed
  const accessNovel1 = await canWriterAccessContent(writer1.id, 'novel', '1', 'edit');
  if (!accessNovel1.allowed) {
    throw new Error(`Writer was denied access to assigned novel #1: ${JSON.stringify(accessNovel1)}`);
  }
  console.log('✓ Assigned novel access: ALLOWED (Review Required mode).');

  // Verify access for unassigned novel #999 -> should be DENIED
  const accessUnassigned = await canWriterAccessContent(writer1.id, 'novel', '999999', 'edit');
  if (accessUnassigned.allowed) {
    throw new Error('Writer was unexpectedly allowed access to unassigned novel!');
  }
  console.log(`✓ Unassigned novel access: PROPERLY DENIED (${accessUnassigned.reason}).`);

  // Verify publishing without permission -> should be DENIED
  const accessPublishDenied = await canWriterAccessContent(writer1.id, 'novel', '1', 'publish');
  if (accessPublishDenied.allowed) {
    throw new Error('Writer without independent publish rights was allowed to publish directly!');
  }
  console.log(`✓ Independent publishing without permission: PROPERLY DENIED (${accessPublishDenied.reason}).`);

  // Now enable independent publishing on particular access and assignment
  await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/writers/${writer1.id}/permissions`,
    method: 'PUT',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    }
  }, {
    accessType: 'particular',
    fullAccess: 0,
    canPublishIndependently: 1,
    canSchedule: 1,
    accessLevel: 'independent_publish',
    permissionStatus: 'active'
  });

  await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/writers/${writer1.id}/assignments`,
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    }
  }, {
    contentType: 'novel',
    contentId: '1',
    instructions: 'Assigned test novel with publishing permitted',
    actions: 'create,edit,submit,publish,schedule'
  });

  const accessPublishAllowed = await canWriterAccessContent(writer1.id, 'novel', '1', 'publish');
  if (!accessPublishAllowed.allowed) {
    throw new Error(`Independent publishing failed after enabling permission: ${JSON.stringify(accessPublishAllowed)}`);
  }
  console.log('✓ Independent publishing after explicit admin toggle: ALLOWED.');

  // Clean up assignment
  await query("DELETE FROM writer_assignments WHERE writer_id = ? AND content_id = '1';", [writer1.id]);
  console.log('✓ Removed test assignment.');

  // TEST 5: REVOKE ACCESS & REACTIVATE
  console.log('\n--- TEST 5: INSTANT ACCESS REVOCATION & REACTIVATION ---');
  const revokeRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/writers/${writer1.id}/revoke`,
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    }
  }, { reason: 'Automated security revocation test' });
  if (revokeRes.status !== 200 || !revokeRes.body.success) {
    throw new Error(`Failed to revoke access: ${JSON.stringify(revokeRes.body)}`);
  }
  console.log('✓ Called POST /api/admin/writers/:id/revoke successfully.');

  const accessCheckRevoked = await canWriterAccessContent(writer1.id, 'novel', '1', 'edit');
  if (accessCheckRevoked.allowed) {
    throw new Error('Writer was unexpectedly allowed access after revocation!');
  }
  console.log(`✓ Revoked writer blocked: ${accessCheckRevoked.reason}`);

  // Reactivate
  const reactivateRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/writers/${writer1.id}/reactivate`,
    method: 'POST',
    headers: { ...authHeaders }
  });
  if (reactivateRes.status !== 200 || !reactivateRes.body.success) {
    throw new Error(`Failed to reactivate access: ${JSON.stringify(reactivateRes.body)}`);
  }
  console.log('✓ Reactivated writer successfully.');

  // TEST 6: BULK PERMISSION ASSIGNMENT
  console.log('\n--- TEST 6: BULK PERMISSION ASSIGNMENT ---');
  const bulkRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/writers/bulk-permissions',
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    }
  }, {
    writerIds: [writer1.id, writer2.id],
    permissions: {
      accessType: 'particular',
      fullAccess: 0,
      canPublishIndependently: 0,
      canSchedule: 0,
      canNovels: 1,
      canEpisodes: 1,
      canShortStories: 1,
      canAudioNovels: 1,
      permissionStatus: 'active'
    }
  });
  if (bulkRes.status !== 200 || !bulkRes.body.success) {
    throw new Error(`Bulk assignment failed: ${JSON.stringify(bulkRes.body)}`);
  }
  console.log(`✓ Bulk updated ${bulkRes.body.updatedCount} writers simultaneously.`);

  // Verify both writers in DB
  const check1 = await queryOne('SELECT * FROM writer_permissions WHERE writer_id = ?;', [writer1.id]);
  const check2 = await queryOne('SELECT * FROM writer_permissions WHERE writer_id = ?;', [writer2.id]);
  if (check1.can_short_stories !== 1 || check2.can_short_stories !== 1) {
    throw new Error('Bulk update did not persist to both writer records.');
  }
  console.log('✓ Verified both database records reflect bulk changes.');

  // Restore original permissions
  console.log('\n--- RESTORING ORIGINAL WRITER STATE ---');
  if (origPerm1) {
    await query(`
      UPDATE writer_permissions 
      SET access_type = ?, permission_status = ?, can_publish_independently = ?, can_schedule = ?, can_novels = ?, can_short_stories = ?, can_audio_novels = ?, can_episodes = ?, access_level = ?, full_access = ?
      WHERE writer_id = ?;
    `, [origPerm1.access_type || 'particular', origPerm1.permission_status || 'active', origPerm1.can_publish_independently || 0, origPerm1.can_schedule || 0, origPerm1.can_novels || 1, origPerm1.can_short_stories || 0, origPerm1.can_audio_novels || 0, origPerm1.can_episodes || 1, origPerm1.access_level || 'review_required', origPerm1.full_access || 0, writer1.id]);
  }
  if (origPerm2) {
    await query(`
      UPDATE writer_permissions 
      SET access_type = ?, permission_status = ?, can_publish_independently = ?, can_schedule = ?, can_novels = ?, can_short_stories = ?, can_audio_novels = ?, can_episodes = ?, access_level = ?, full_access = ?
      WHERE writer_id = ?;
    `, [origPerm2.access_type || 'full', origPerm2.permission_status || 'active', origPerm2.can_publish_independently || 1, origPerm2.can_schedule || 1, origPerm2.can_novels || 1, origPerm2.can_short_stories || 1, origPerm2.can_audio_novels || 1, origPerm2.can_episodes || 1, origPerm2.access_level || 'independent_publish', origPerm2.full_access || 1, writer2.id]);
  }
  console.log('✓ Original writer permissions restored cleanly.');

  console.log('\n====================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! (100% VERIFIED)');
  console.log('====================================================');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION FAILED:', err);
  process.exit(1);
});
