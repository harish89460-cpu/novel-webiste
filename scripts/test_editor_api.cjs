const assert = require('assert');

async function testEditorApi() {
  const { query } = await import('../backend/db.js');
  const { createSession } = await import('../backend/auth.js');

  console.log('Testing Editor API and Episode creation...');

  // 1. Get an admin user
  const adminUsers = await query("SELECT id, username, role FROM users WHERE role = 'admin' LIMIT 1;");
  assert(adminUsers.length > 0, 'No admin user found in database');
  const adminUser = adminUsers[0];
  const token = await createSession(adminUser.id, 'author');

  // 2. Get an existing novel
  const novels = await query("SELECT id, title FROM novels WHERE is_audio = 0 LIMIT 1;");
  assert(novels.length > 0, 'No novel found');
  const novel = novels[0];

  // 3. Test saving a Draft Episode
  const draftTitle = 'E2E Editor Test Draft ' + Date.now();
  const draftRes = await fetch('http://localhost:3000/api/admin/episodes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: draftTitle,
      novelId: novel.id,
      parentId: null,
      episodeNumber: '998',
      content: '<p>This is a test draft chapter content created by the redesigned editor.</p>',
      status: 'draft'
    })
  });

  const draftData = await draftRes.json();
  console.log('Draft creation response:', draftData);
  assert(draftRes.ok, 'Failed to create draft');
  assert.strictEqual(draftData.success, true);
  const draftId = draftData.chapterId || draftData.episodeId || draftData.episode?.id;

  // Verify draft in database
  const draftDb = await query("SELECT id, title, status FROM chapters WHERE id = ?", [draftId]);
  assert.strictEqual(draftDb[0].title, draftTitle);
  assert.strictEqual(draftDb[0].status, 'draft');
  console.log('✓ Successfully created and verified Draft episode');

  // 4. Test Publishing an Episode
  const pubTitle = 'E2E Editor Test Published ' + Date.now();
  const pubRes = await fetch('http://localhost:3000/api/admin/episodes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: pubTitle,
      novelId: novel.id,
      parentId: null,
      episodeNumber: '999',
      content: '<p>This is published episode content created by the redesigned editor.</p>',
      status: 'published'
    })
  });

  const pubData = await pubRes.json();
  assert(pubRes.ok, 'Failed to create published episode');
  const pubId = pubData.chapterId || pubData.episodeId || pubData.episode?.id;

  const pubDb = await query("SELECT id, title, status FROM chapters WHERE id = ?", [pubId]);
  assert.strictEqual(pubDb[0].title, pubTitle);
  assert.strictEqual(pubDb[0].status, 'published');
  console.log('✓ Successfully created and verified Published episode');

  // 5. Clean up test episodes
  await query("DELETE FROM chapters WHERE id IN (?, ?)", [draftId, pubId]);
  console.log('✓ Cleaned up test episodes');

  console.log('\nAll Editor API tests passed successfully!');
}

testEditorApi().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
