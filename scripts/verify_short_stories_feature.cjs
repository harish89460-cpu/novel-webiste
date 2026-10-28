const assert = require('assert');

async function runVerification() {
  console.log('====================================================');
  console.log('   SHORT STORIES COMPREHENSIVE VERIFICATION SUITE   ');
  console.log('====================================================\n');

  const authModule = await import('../backend/auth.js');
  const dbModule = await import('../backend/db.js');
  const shortStoriesModule = await import('../backend/short-stories.js');

  const BASE_URL = 'http://localhost:3000';

  // 1. Authenticate admin user (id: 2) with 'author' session
  console.log('[1/8] Testing Admin & Member Authentication...');
  const adminToken = await authModule.createSession(2, 'author');
  const adminUser = await authModule.getUserByToken(adminToken);
  assert(adminUser && adminUser.isAdmin, 'Admin session should be verified as admin');
  console.log('  ✓ Admin session successfully created (id: 2, isAdmin: true)');

  const memberToken = await authModule.createSession(69, 'reader');
  console.log('  ✓ Member session successfully created (id: 69, reader)');

  // 2. Test Admin Endpoint Access Control
  console.log('\n[2/8] Testing Admin Access Control...');
  // A. No token
  const unauthRes = await fetch(`${BASE_URL}/api/admin/short-stories`);
  assert(unauthRes.status === 401 || unauthRes.status === 403, `Unauthenticated request should be 401/403, got ${unauthRes.status}`);
  console.log('  ✓ Unauthenticated access correctly rejected');

  // B. Member token (not admin)
  const memberRes = await fetch(`${BASE_URL}/api/admin/short-stories`, {
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  assert(memberRes.status === 403, `Non-admin request should be 403, got ${memberRes.status}`);
  console.log('  ✓ Non-admin member access correctly blocked (403 Forbidden)');

  // C. Admin token
  const adminGetRes = await fetch(`${BASE_URL}/api/admin/short-stories`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminGetRes.status === 200, `Admin request should be 200, got ${adminGetRes.status}`);
  const adminGetData = await adminGetRes.json();
  assert(adminGetData.success && Array.isArray(adminGetData.stories), 'Admin stories list should be returned');
  console.log(`  ✓ Admin access granted (Found ${adminGetData.stories.length} existing stories)`);

  // 3. Test Public Short Stories Listing & Single Story Reading
  console.log('\n[3/8] Testing Public Short Stories Listing & Reading View...');
  const pubListRes = await fetch(`${BASE_URL}/api/short-stories`);
  assert(pubListRes.status === 200, `Public stories list should be 200, got ${pubListRes.status}`);
  const pubListData = await pubListRes.json();
  assert(pubListData.success && Array.isArray(pubListData.stories), 'Public stories list should be array');
  console.log(`  ✓ Public listing returns ${pubListData.stories.length} stories`);

  const sampleStory = pubListData.stories.find(s => s.slug === 'poongaatru-punnagaikka') || pubListData.stories[0];
  assert(sampleStory, 'At least one public story should exist');
  
  const initialViews = Number(sampleStory.views_count || sampleStory.viewsCount || 0);
  const singleRes = await fetch(`${BASE_URL}/api/short-stories/${sampleStory.slug}`);
  assert(singleRes.status === 200, `Single story GET should be 200, got ${singleRes.status}`);
  const singleData = await singleRes.json();
  assert(singleData.success && singleData.story, 'Single story data returned');
  assert.strictEqual(singleData.story.slug, sampleStory.slug, 'Slug must match');
  console.log(`  ✓ Story "${singleData.story.title}" successfully loaded via slug`);
  console.log(`  ✓ Verified word count: ${singleData.story.wordCount}, read time: ${singleData.story.readTime}`);

  // 4. Test Forms Hierarchy Integration
  console.log('\n[4/8] Testing Forms Hierarchy Integration...');
  const hierarchyRes = await fetch(`${BASE_URL}/api/content/hierarchy`);
  assert(hierarchyRes.status === 200, `Hierarchy GET should be 200, got ${hierarchyRes.status}`);
  const hierarchyData = await hierarchyRes.json();
  const shortStoriesCategory = hierarchyData.hierarchy?.find(c => c.id === 'short-stories');
  assert(shortStoriesCategory, 'Category short-stories must exist in content hierarchy');
  assert(shortStoriesCategory.novels && shortStoriesCategory.novels.length > 0, 'Category short-stories must contain novels/stories');
  const foundInHierarchy = shortStoriesCategory.novels.find(n => n.id === sampleStory.slug || n.rawId === sampleStory.id);
  assert(foundInHierarchy, 'Sample story must be listed in short-stories category');
  assert(foundInHierarchy.link.startsWith('#story?id='), `Story link in hierarchy must be #story?id=..., got ${foundInHierarchy.link}`);
  console.log(`  ✓ Forms category "Short Stories" verified with link: ${foundInHierarchy.link}`);

  // 5. Test Latest & Trending Posts Integration
  console.log('\n[5/8] Testing Latest & Trending Posts Integration...');
  const sidebarRes = await fetch(`${BASE_URL}/api/forum/posts`);
  assert(sidebarRes.status === 200, `Sidebar posts GET should be 200, got ${sidebarRes.status}`);
  const sidebarData = await sidebarRes.json();
  const storyInLatest = (sidebarData.latest || []).find(p => p.link && p.link.startsWith('#story?id='));
  console.log(`  ✓ Latest Posts contains short stories: ${Boolean(storyInLatest)} (found: "${storyInLatest?.title || 'None'}")`);

  // 6. Test Reader Comments & Replies Flow
  console.log('\n[6/8] Testing Comments & Replies on Short Stories...');
  const testCommentText = `Verification test comment at ${new Date().toISOString()}`;
  const postCommentRes = await fetch(`${BASE_URL}/api/short-stories/${singleData.story.id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`
    },
    body: JSON.stringify({ content: testCommentText })
  });
  assert(postCommentRes.status === 200 || postCommentRes.status === 201, `Comment POST should be 200/201, got ${postCommentRes.status}`);
  const postCommentData = await postCommentRes.json();
  assert(postCommentData.success && postCommentData.commentId, 'Comment ID returned');
  const parentCommentId = postCommentData.commentId;
  console.log(`  ✓ Root comment posted with ID: ${parentCommentId}`);

  // Post a reply
  const testReplyText = `Verification reply to #${parentCommentId}`;
  const postReplyRes = await fetch(`${BASE_URL}/api/short-stories/${singleData.story.id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ content: testReplyText, parentId: parentCommentId })
  });
  assert(postReplyRes.status === 200 || postReplyRes.status === 201, `Reply POST should be 200/201, got ${postReplyRes.status}`);
  console.log('  ✓ Child reply posted successfully');

  // Fetch comments list
  const getCommentsRes = await fetch(`${BASE_URL}/api/short-stories/${singleData.story.id}/comments`);
  assert(getCommentsRes.status === 200, `Comments GET should be 200, got ${getCommentsRes.status}`);
  const getCommentsData = await getCommentsRes.json();
  assert(getCommentsData.success && Array.isArray(getCommentsData.comments), 'Comments array returned');
  const foundComment = getCommentsData.comments.find(c => c.id === parentCommentId);
  assert(foundComment, 'Posted root comment must be found in comments list');
  const foundReply = getCommentsData.comments.find(c => c.parentId === parentCommentId);
  assert(foundReply && foundReply.content === testReplyText, 'Posted reply must point to parentId');
  console.log(`  ✓ Comments list verified with ${getCommentsData.total} comments and reply linkages`);

  // 7. Test Admin Full Lifecycle: Create, Read, Update, Toggle Disabled, Delete
  console.log('\n[7/8] Testing Admin Story Lifecycle (Create, Edit, Disable/Restore, Delete)...');
  const tempStoryPayload = {
    title: 'E2E Test Story — Golden Horizon',
    title_ta: 'தங்க அடிவானம்',
    slug: 'e2e-test-story-golden-horizon',
    author: 'Rudhra Prarthana',
    genre: 'Drama / Romance',
    cover_image: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843',
    description: 'A test short story created during automated verification.',
    content: '<p>The evening dusk painted the horizon in shades of burnished gold and lavender.</p><p>A gentle breeze carried memories long forgotten.</p>',
    status: 'published'
  };

  // Create
  const createRes = await fetch(`${BASE_URL}/api/admin/short-stories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify(tempStoryPayload)
  });
  assert(createRes.status === 200 || createRes.status === 201, `Create story POST should be 200/201, got ${createRes.status}`);
  const createData = await createRes.json();
  assert(createData.success && createData.storyId, 'Story created with ID');
  const newStoryId = createData.storyId;
  console.log(`  ✓ Story created with ID: ${newStoryId}`);

  // Read via Admin
  const adminGetSingle = await fetch(`${BASE_URL}/api/admin/short-stories/${newStoryId}`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(adminGetSingle.status === 200, `Admin single GET should be 200, got ${adminGetSingle.status}`);
  const singleAdminData = await adminGetSingle.json();
  assert.strictEqual(singleAdminData.story.title, tempStoryPayload.title);
  console.log('  ✓ Admin story retrieval verified');

  // Update
  const updatePayload = {
    ...tempStoryPayload,
    title: 'E2E Test Story — Golden Horizon (Updated Edition)',
    genre: 'Literary Romance'
  };
  const updateRes = await fetch(`${BASE_URL}/api/admin/short-stories/${newStoryId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify(updatePayload)
  });
  assert(updateRes.status === 200, `Update story PUT should be 200, got ${updateRes.status}`);
  console.log('  ✓ Story updated successfully');

  // Toggle Disabled (Hide from public)
  const disableRes = await fetch(`${BASE_URL}/api/admin/short-stories/${newStoryId}/toggle-disabled`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(disableRes.status === 200, `Toggle disabled POST should be 200, got ${disableRes.status}`);
  const disableData = await disableRes.json();
  assert(disableData.isDisabled === true || disableData.is_disabled === true || disableData.is_disabled === 1, 'Story should now be disabled');
  console.log('  ✓ Story disabled flag set to true');

  // Check public endpoint blocks disabled story for readers
  const checkPublicDisabled = await fetch(`${BASE_URL}/api/short-stories/${tempStoryPayload.slug}`);
  assert(checkPublicDisabled.status === 403, `Disabled story must return 403 to public, got ${checkPublicDisabled.status}`);
  console.log('  ✓ Public reader access blocked for disabled story (403 Disabled)');

  // Restore story
  const restoreRes = await fetch(`${BASE_URL}/api/admin/short-stories/${newStoryId}/toggle-disabled`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(restoreRes.status === 200, `Restore POST should be 200, got ${restoreRes.status}`);
  console.log('  ✓ Story restored to public view');

  // Permanent Delete
  const deleteRes = await fetch(`${BASE_URL}/api/admin/short-stories/${newStoryId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert(deleteRes.status === 200, `Delete story DELETE should be 200, got ${deleteRes.status}`);
  console.log('  ✓ Story permanently deleted');

  // Verify it is gone
  const verifyDeleted = await fetch(`${BASE_URL}/api/short-stories/${tempStoryPayload.slug}`);
  assert(verifyDeleted.status === 404, `Deleted story should be 404, got ${verifyDeleted.status}`);
  console.log('  ✓ Verified 404 Not Found after deletion');

  // 8. Clean up test comments on sample story
  console.log('\n[8/8] Cleaning up test comments...');
  await dbModule.query('DELETE FROM short_story_comments WHERE id = ? OR parent_id = ?', [parentCommentId, parentCommentId]);
  await dbModule.query('UPDATE short_stories SET comments_count = (SELECT COUNT(*) FROM short_story_comments WHERE story_id = ?) WHERE id = ?', [singleData.story.id, singleData.story.id]);
  console.log('  ✓ Test comments cleaned up cleanly');

  console.log('\n====================================================');
  console.log('   🎉 ALL SHORT STORIES VERIFICATION TESTS PASSED!   ');
  console.log('====================================================\n');
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
