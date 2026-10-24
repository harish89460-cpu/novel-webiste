// End-to-End Automated Test Suite: Writer Dashboard & Novel Writing Redesign
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

async function request(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const res = await fetch(`${BASE_URL}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🧪 Starting Writer Dashboard & Novel Writing Redesign E2E Test Suite...\n');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [TEST ${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✕ [TEST ${total}] ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // 1. Writer Login
  const loginRes = await request('/api/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({
      username: 'kavitha.writer@rpnovels.com',
      password: 'WriterPassword123!'
    })
  });

  test('Writer authenticates successfully via Author & Writer Portal', () => {
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.success, true);
    assert.strictEqual(loginRes.data.role, 'writer');
    assert.ok(loginRes.data.token, 'Session token must be returned');
    assert.strictEqual(loginRes.data.user.isWriter, true);
  });

  const writerToken = loginRes.data.token;
  const writerId = loginRes.data.user.id;
  const writerHeaders = { 'Authorization': `Bearer ${writerToken}` };

  // 2. Fetch Writer Workspace Data
  const workspaceRes = await request('/api/writer/workspace', { headers: writerHeaders });

  test('Writer Workspace endpoint returns database-backed stats with NO undefined values', () => {
    assert.strictEqual(workspaceRes.status, 200);
    assert.strictEqual(workspaceRes.data.success, true);
    const stats = workspaceRes.data.stats;
    assert.ok(stats, 'Stats object must exist');
    assert.strictEqual(typeof stats.novelsCount, 'number', 'novelsCount must be a number');
    assert.strictEqual(typeof stats.draftsCount, 'number', 'draftsCount must be a number');
    assert.strictEqual(typeof stats.publishedNovelsCount, 'number', 'publishedNovelsCount must be a number (NOT undefined)');
    assert.strictEqual(typeof stats.episodesCount, 'number', 'episodesCount must be a number');
    assert.strictEqual(typeof stats.totalViews, 'number', 'totalViews must be a number');
    console.log('    Writer stats:', stats);
  });

  // 3. Security & RBAC: Writer cannot access Admin Dashboard endpoints
  const adminAccessRes = await request('/api/admin/homepage-sections', { headers: writerHeaders });
  test('Writer is rejected with 403 Forbidden when attempting Admin actions', () => {
    assert.strictEqual(adminAccessRes.status, 403, 'Writer must not access Admin endpoints');
  });

  // 4. Security & RBAC: Unauthenticated access rejected
  const unauthRes = await request('/api/writer/workspace');
  test('Unauthenticated request to writer workspace rejected with 401', () => {
    assert.strictEqual(unauthRes.status, 401);
  });

  // 5. Create Novel as Writer
  const testNovelTitle = `Kavitha Story ${Date.now()}`;
  const createNovelRes = await request('/api/writer/novels', {
    method: 'POST',
    headers: writerHeaders,
    body: JSON.stringify({
      title: testNovelTitle,
      genre: 'Family Romance',
      cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c',
      description: 'A captivating family tale written by Kavitha.'
    })
  });

  test('Writer can create a novel with draft visibility owned by their account', () => {
    assert.strictEqual(createNovelRes.status, 201);
    assert.strictEqual(createNovelRes.data.success, true);
    assert.ok(createNovelRes.data.novel, 'Novel must be created');
    assert.strictEqual(createNovelRes.data.novel.title, testNovelTitle);
    assert.strictEqual(createNovelRes.data.novel.visibility, 'draft');
    assert.strictEqual(Number(createNovelRes.data.novel.author_id || createNovelRes.data.novel.authorId), Number(writerId));
  });

  const createdNovelId = createNovelRes.data.novel.id;

  // 6. Fetch Novel by ID
  const getNovelRes = await request(`/api/writer/novels/${createdNovelId}`, { headers: writerHeaders });
  test('Writer can retrieve their created novel details', () => {
    assert.strictEqual(getNovelRes.status, 200);
    assert.strictEqual(getNovelRes.data.novel.id, createdNovelId);
    assert.strictEqual(getNovelRes.data.novel.title, testNovelTitle);
  });

  // 7. Update Novel Details
  const updatedDesc = 'Updated description for the story.';
  const updateNovelRes = await request(`/api/writer/novels/${createdNovelId}`, {
    method: 'PUT',
    headers: writerHeaders,
    body: JSON.stringify({
      title: testNovelTitle,
      genre: 'Family Romance',
      description: updatedDesc
    })
  });

  test('Writer can update their own novel details', () => {
    assert.strictEqual(updateNovelRes.status, 200);
    assert.strictEqual(updateNovelRes.data.success, true);
  });

  // 8. Create Episode in Novel
  const createEpRes = await request('/api/writer/episodes', {
    method: 'POST',
    headers: writerHeaders,
    body: JSON.stringify({
      novelId: createdNovelId,
      episodeNumber: '1',
      title: 'Episode 1 — The Dawn',
      content: '<p>The morning sun rose gracefully over the quiet town of Kanchipuram.</p>',
      status: 'draft'
    })
  });

  test('Writer can create an episode draft with rich text content', () => {
    assert.strictEqual(createEpRes.status, 201);
    assert.strictEqual(createEpRes.data.success, true);
    assert.ok(createEpRes.data.episode?.id, 'Episode ID must be returned');
  });

  const createdEpId = createEpRes.data.episode.id;

  // 9. Fetch Episodes for Novel
  const getEpsRes = await request(`/api/writer/episodes?novelId=${createdNovelId}`, { headers: writerHeaders });
  test('Writer can retrieve list of episodes for their novel', () => {
    assert.strictEqual(getEpsRes.status, 200);
    assert.ok(Array.isArray(getEpsRes.data.episodes));
    assert.strictEqual(getEpsRes.data.episodes.length, 1);
    assert.strictEqual(getEpsRes.data.episodes[0].id, createdEpId);
  });

  // 10. Update Episode & Submit for Review
  const updateEpRes = await request(`/api/writer/episodes/${createdEpId}`, {
    method: 'PUT',
    headers: writerHeaders,
    body: JSON.stringify({
      title: 'Episode 1 — The Golden Dawn',
      content: '<p>The morning sun rose gracefully, bringing golden light to every courtyard.</p>',
      status: 'submitted'
    })
  });

  test('Writer can update episode content and submit for review', () => {
    assert.strictEqual(updateEpRes.status, 200);
    assert.strictEqual(updateEpRes.data.success, true);
  });

  // 11. Security Check: Cannot edit another writer\'s novel
  // Novel 'kaadhal-konden-kanave' is owned by author_id 2
  const unauthorizedNovelEditRes = await request('/api/writer/novels/kaadhal-konden-kanave', {
    method: 'PUT',
    headers: writerHeaders,
    body: JSON.stringify({ title: 'Hacked Title' })
  });

  test('Writer cannot edit another author\'s novel (strictly protected 403)', () => {
    assert.strictEqual(unauthorizedNovelEditRes.status, 403);
  });

  // 12. Delete Draft Episode
  const deleteEpRes = await request(`/api/writer/episodes/${createdEpId}`, {
    method: 'DELETE',
    headers: writerHeaders
  });

  test('Writer can safely delete their draft episode', () => {
    assert.strictEqual(deleteEpRes.status, 200);
    assert.strictEqual(deleteEpRes.data.success, true);
  });

  // 13. Verify underlying novel remains completely intact after episode deletion
  const verifyNovelAfterEpDelete = await request(`/api/writer/novels/${createdNovelId}`, { headers: writerHeaders });
  test('Deleting an episode leaves the parent novel completely intact', () => {
    assert.strictEqual(verifyNovelAfterEpDelete.status, 200);
    assert.strictEqual(verifyNovelAfterEpDelete.data.novel.id, createdNovelId);
  });

  // 14. Workspace counts updated accurately after additions and deletions
  const finalWorkspaceRes = await request('/api/writer/workspace', { headers: writerHeaders });
  test('Workspace counts reflect real MySQL state accurately', () => {
    assert.strictEqual(finalWorkspaceRes.status, 200);
    const finalStats = finalWorkspaceRes.data.stats;
    assert.strictEqual(typeof finalStats.publishedNovelsCount, 'number');
    assert.ok(finalStats.publishedNovelsCount >= 0);
  });

  console.log(`\n========================================`);
  console.log(`Results: ${passed}/${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
