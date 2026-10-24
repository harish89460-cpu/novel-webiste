// Comprehensive End-to-End Test Suite for Homepage Sections & Priority Management System
// Rudhra Prarthana Novels

const BASE_URL = 'http://localhost:3000';
let adminToken = null;
let writerToken = null;
let memberToken = null;

async function runTests() {
  console.log('================================================================');
  console.log('RUDRHA PRARTHANA NOVELS — HOMEPAGE SECTIONS E2E TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(title, condition, extra = '') {
    if (condition) {
      console.log(`[PASS] ${title} ${extra}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title} ${extra}`);
      failed++;
    }
  }

  // 1. Authenticate Admin (rudhra_author)
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rudhra_author', password: 'Rudhra.pass' })
  }).then(r => r.json());

  assert('1. Admin authentication succeeds', adminLoginRes.success && adminLoginRes.user?.isAdmin);
  adminToken = adminLoginRes.token;

  // 2. Authenticate standard Reader (sessionType: 'reader')
  const readerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'harish89460@gmail.com', password: 'password123' })
  }).then(r => r.json());

  assert('2. Reader authentication succeeds with sessionType=reader', readerLoginRes.success && readerLoginRes.user?.sessionType === 'reader');
  memberToken = readerLoginRes.token;

  // 3. Security: Test Unauthorized Access Control
  const unauthGetRes = await fetch(`${BASE_URL}/api/admin/homepage-sections`);
  assert('3. Unauthorized request without token receives 401', unauthGetRes.status === 401);

  const readerGetRes = await fetch(`${BASE_URL}/api/admin/homepage-sections`, {
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  assert('4. Non-author reader token receives 403 Forbidden on GET /admin/homepage-sections', readerGetRes.status === 403);

  const readerReorderRes = await fetch(`${BASE_URL}/api/admin/homepage-sections/reorder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`
    },
    body: JSON.stringify({ orders: [] })
  });
  assert('5. Non-author reader token receives 403 Forbidden on PUT /admin/homepage-sections/reorder', readerReorderRes.status === 403);

  const readerCreateRes = await fetch(`${BASE_URL}/api/admin/homepage-sections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`
    },
    body: JSON.stringify({ name: 'Malicious', title: 'Malicious', section_type: 'curated' })
  });
  assert('6. Non-author reader token receives 403 Forbidden on POST /admin/homepage-sections', readerCreateRes.status === 403);

  // 4. Admin GET homepage sections
  const sectionsRes = await fetch(`${BASE_URL}/api/admin/homepage-sections`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }).then(r => r.json());

  assert('4. Admin GET /admin/homepage-sections succeeds', sectionsRes.success && Array.isArray(sectionsRes.sections));
  const initialSections = sectionsRes.sections;
  console.log(`   Found ${initialSections.length} sections in database.`);
  initialSections.forEach(s => {
    console.log(`   - Pos #${s.sort_order}: [${s.section_key}] "${s.title}" (${s.section_type}) - Visible: ${s.is_visible}`);
  });

  // Verify all essential sections exist
  const keys = initialSections.map(s => s.section_key);
  assert('5. "audio" section exists', keys.includes('audio'));
  assert('6. "trending" section exists', keys.includes('trending'));
  assert('7. "completed" section exists', keys.includes('completed'));
  assert('8. "continue_reading" section exists', keys.includes('continue_reading'));
  assert('9. "forum" section exists', keys.includes('forum'));

  // 5. Test Priority Reordering: Move "audio" to Priority #1
  const audioIndex = initialSections.findIndex(s => s.section_key === 'audio');
  const reorderedKeys = [...initialSections];
  const [audioSec] = reorderedKeys.splice(audioIndex, 1);
  reorderedKeys.unshift(audioSec);

  const reorderPayload = reorderedKeys.map((s, idx) => ({
    section_key: s.section_key,
    sort_order: idx + 1
  }));

  const reorderRes = await fetch(`${BASE_URL}/api/admin/homepage-sections/reorder`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ orders: reorderPayload })
  }).then(r => r.json());

  assert('10. Admin reorders sections to place Audio Novels at #1', reorderRes.success);

  // 6. Verify Public Homepage Dynamic Rendering reflects Audio Novels at #1
  const publicHomeRes = await fetch(`${BASE_URL}/api/novels/homepage`).then(r => r.json());
  assert('11. Public homepage returns orderedSections array', publicHomeRes.success && Array.isArray(publicHomeRes.orderedSections));
  const firstVisibleSection = publicHomeRes.orderedSections[0];
  assert('12. Audio Novels is now Position #1 on public homepage', firstVisibleSection?.sectionKey === 'audio');

  // 7. Test Hide Section: Hide "completed"
  const hideRes = await fetch(`${BASE_URL}/api/admin/homepage-sections/completed/visibility`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ is_visible: 0 })
  }).then(r => r.json());

  assert('13. Admin toggles Completed Works to Hidden (is_visible=0)', hideRes.success && hideRes.isVisible === false);

  // Verify Completed Works disappears from public homepage
  const publicHomeHiddenRes = await fetch(`${BASE_URL}/api/novels/homepage`).then(r => r.json());
  const completedInPublic = publicHomeHiddenRes.orderedSections.find(s => s.sectionKey === 'completed');
  assert('14. Hidden section "completed" does NOT appear on public homepage', completedInPublic === undefined);

  // 8. Restore Section: Restore "completed" to visible
  const showRes = await fetch(`${BASE_URL}/api/admin/homepage-sections/completed/visibility`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ is_visible: 1 })
  }).then(r => r.json());

  assert('15. Admin restores Completed Works to Visible (is_visible=1)', showRes.success && showRes.isVisible === true);

  const publicHomeRestoredRes = await fetch(`${BASE_URL}/api/novels/homepage`).then(r => r.json());
  const completedRestoredInPublic = publicHomeRestoredRes.orderedSections.find(s => s.sectionKey === 'completed');
  assert('16. Restored section "completed" reappears on public homepage', completedRestoredInPublic !== undefined);

  // 9. Test Create Custom Section: "editor_picks" with real novels
  const testSectionKey = `test_custom_${Date.now()}`;
  const createRes = await fetch(`${BASE_URL}/api/admin/homepage-sections`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      section_key: testSectionKey,
      name: 'Test Curated Spotlight',
      title: 'Editor Spotlight Collection',
      subtitle: 'Specially chosen romantic family sagas',
      section_type: 'curated',
      sort_order: 2,
      display_style: 'grid',
      content_limit: 4,
      view_all_link: '#novels',
      is_visible: 1,
      novel_ids: ['kaadhal-konden-kanave', 'uyire-unakkaga']
    })
  }).then(r => r.json());

  assert('17. Admin creates new Custom Curated Section with real novel IDs', createRes.success);

  // Verify created custom section appears on public homepage
  const publicHomeWithCustom = await fetch(`${BASE_URL}/api/novels/homepage`).then(r => r.json());
  const customInPublic = publicHomeWithCustom.orderedSections.find(s => s.sectionKey === testSectionKey);
  assert('18. Created custom section renders on public homepage with real novels', customInPublic && customInPublic.novels?.length > 0);

  // 10. Test Edit Section
  const editRes = await fetch(`${BASE_URL}/api/admin/homepage-sections/${testSectionKey}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      name: 'Updated Spotlight Name',
      title: 'Updated Heading for Readers',
      subtitle: 'Updated description text',
      display_style: 'carousel',
      content_limit: 5,
      view_all_link: '#novels',
      is_visible: 1
    })
  }).then(r => r.json());

  assert('19. Admin edits custom section title and properties', editRes.success);

  const publicHomeEdited = await fetch(`${BASE_URL}/api/novels/homepage`).then(r => r.json());
  const editedInPublic = publicHomeEdited.orderedSections.find(s => s.sectionKey === testSectionKey);
  assert('20. Edited title is reflected on public homepage', editedInPublic?.title === 'Updated Heading for Readers');

  // 11. Test Core System Section Protection against Deletion
  const deleteSystemRes = await fetch(`${BASE_URL}/api/admin/homepage-sections/audio`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }).then(r => r.json());

  assert('21. Core system section "audio" cannot be deleted (protected)', !deleteSystemRes.success && deleteSystemRes.code === 'SYSTEM_SECTION_PROTECTED');

  // 12. Delete Custom Section safely
  const deleteCustomRes = await fetch(`${BASE_URL}/api/admin/homepage-sections/${testSectionKey}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }).then(r => r.json());

  assert('22. Custom section can be safely deleted', deleteCustomRes.success);

  // Verify underlying novels are completely untouched
  const novelCheck = await fetch(`${BASE_URL}/api/novels/kaadhal-konden-kanave`).then(r => r.json());
  assert('23. Underlying novel records remain intact after custom section deletion', novelCheck.novel?.id === 'kaadhal-konden-kanave');

  // 13. Test Reset to Default System Order
  const resetRes = await fetch(`${BASE_URL}/api/admin/homepage-sections/reset-order`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }).then(r => r.json());

  assert('24. Reset to Default Order succeeds', resetRes.success);

  const resetSectionsRes = await fetch(`${BASE_URL}/api/admin/homepage-sections`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }).then(r => r.json());

  const resetKeys = resetSectionsRes.sections.slice(0, 5).map(s => s.section_key);
  assert('25. Section order restored to system defaults (featured, continue_reading, audio, trending, completed)',
    resetKeys[0] === 'featured' &&
    resetKeys[1] === 'continue_reading' &&
    resetKeys[2] === 'audio' &&
    resetKeys[3] === 'trending' &&
    resetKeys[4] === 'completed'
  );

  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
