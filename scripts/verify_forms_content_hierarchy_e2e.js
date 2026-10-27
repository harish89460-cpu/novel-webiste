import http from 'node:http';

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json, raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      if (typeof body === 'object') {
        req.write(JSON.stringify(body));
      } else {
        req.write(body);
      }
    }
    req.end();
  });
}

async function runVerification() {
  console.log('================================================================');
  console.log('STARTING END-TO-END VERIFICATION: FORMS & CONTENT MANAGEMENT');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName} - ${details}`);
      failed++;
    }
  }

  // 1. Authenticate as Admin to get Admin JWT
  console.log('--- STEP 1: Admin Authentication ---');
  const adminLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    username: 'rudhra_author',
    password: 'Rudhra.pass'
  });

  const adminToken = adminLoginRes.body?.token;
  assert(adminLoginRes.status === 200 && adminToken, 'Admin Login Authenticated', JSON.stringify(adminLoginRes.body));

  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // 2. Authenticate / Login as regular test member
  console.log('\n--- STEP 2: Regular Member Authentication ---');
  let memberToken = null;
  let memberId = null;

  // Login as member (test user or reader)
  const memberLoginRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: 'reader1@example.com',
    password: 'Password123!'
  });

  if (memberLoginRes.status === 200 && memberLoginRes.body?.token) {
    memberToken = memberLoginRes.body.token;
    memberId = memberLoginRes.body.user?.id;
  } else {
    // Try reader2 or create one if needed
    const readerRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      username: 'testreader_' + Date.now(),
      email: `testreader_${Date.now()}@example.com`,
      password: 'Password123!',
      display_name: 'Test Reader'
    });
    if (readerRes.status === 201 && readerRes.body?.token) {
      memberToken = readerRes.body.token;
      memberId = readerRes.body.user?.id;
    }
  }

  assert(memberToken && memberId, `Member Authenticated (ID: ${memberId})`);
  const memberHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${memberToken}`
  };

  // 3. Test Member Hierarchy API
  console.log('\n--- STEP 3: Content Hierarchy API (/api/content/hierarchy) ---');
  const hierRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/hierarchy',
    method: 'GET'
  });

  assert(hierRes.status === 200 && hierRes.body?.success, 'Hierarchy API returns HTTP 200 Success');
  const hierarchy = hierRes.body?.hierarchy || [];
  
  // Verify General Category and its seeded subcategories & articles
  const generalCat = hierarchy.find(c => c.id === 'general' || c.title.toLowerCase().includes('general'));
  assert(generalCat !== undefined, 'Main Title "General" exists in hierarchy');
  if (generalCat) {
    const welcomeSub = generalCat.subcategories?.find(s => s.title.includes('Welcome Notes'));
    assert(welcomeSub !== undefined, 'Sub Title "Welcome Notes" exists under General');
    if (welcomeSub) {
      const helloArt = welcomeSub.articles?.find(a => (a.uniqueSlug === 'hello-members' || a.unique_slug === 'hello-members'));
      assert(helloArt !== undefined, 'Content Article "Hello Members" exists under Welcome Notes');
    }
  }

  // Verify Ongoing Novels category with real novels & latest published episode info
  const ongoingCat = hierarchy.find(c => c.id === 'ongoing' || c.title.toLowerCase().includes('ongoing'));
  assert(ongoingCat !== undefined, 'Main Title "Ongoing Novels" exists in hierarchy');
  if (ongoingCat) {
    assert(ongoingCat.novels && ongoingCat.novels.length > 0, `Ongoing Novels has ${ongoingCat.novels?.length} novels`);
    const firstNovel = ongoingCat.novels?.[0];
    assert(firstNovel && firstNovel.title, `First Ongoing Novel: ${firstNovel?.title}`);
    if (firstNovel?.latest_chapter) {
      console.log(`   Latest Chapter: ${firstNovel.latest_chapter.title} (Published: ${firstNovel.latest_chapter.published_at})`);
    }
  }

  // 4. Test Dedicated Reading View API & Comments
  console.log('\n--- STEP 4: Dedicated Reading View & Comment Box ---');
  const readRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/articles/hello-members',
    method: 'GET',
    headers: memberHeaders
  });

  assert(readRes.status === 200 && readRes.body?.success, 'Reading View API returns article details');
  const article = readRes.body?.article;
  assert(article && article.title === 'Hello Members', `Article Title matches: ${article?.title}`);
  assert(article && article.content && article.content.length > 20, 'Article contains rich reading content');

  // Post a comment to the article
  const commentText = 'End-to-End Test: Truly wonderful community platform! ' + Date.now();
  const postCommentRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/articles/hello-members/comments',
    method: 'POST',
    headers: memberHeaders
  }, {
    content: commentText
  });

  assert(postCommentRes.status === 201 && postCommentRes.body?.success, 'Comment posted successfully to article');
  const commentId = postCommentRes.body?.comment?.id;

  // Post a reply to that comment
  let replyId = null;
  if (commentId) {
    const postReplyRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/content/articles/hello-members/comments',
      method: 'POST',
      headers: memberHeaders
    }, {
      content: 'Replying to the test comment!',
      parent_id: commentId
    });
    assert(postReplyRes.status === 201 && postReplyRes.body?.success, 'Reply posted successfully');
    replyId = postReplyRes.body?.comment?.id;
  }

  // Fetch comments to verify hierarchy
  const getCommentsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/articles/hello-members/comments',
    method: 'GET'
  });
  assert(getCommentsRes.status === 200 && getCommentsRes.body?.comments?.length > 0, 'Comments list returned');
  const foundComment = getCommentsRes.body?.comments?.find(c => c.id === commentId);
  assert(foundComment && foundComment.replies?.some(r => r.id === replyId), 'Comment tree contains nested reply');

  // 5. Test Admin Content Management CRUD (Main Title -> Sub Title -> Content Article)
  console.log('\n--- STEP 5: Admin Content Management CRUD ---');
  // A. Create Main Title
  const createMainRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/main-categories',
    method: 'POST',
    headers: adminHeaders
  }, {
    title: 'E2E Test Category ' + Date.now(),
    description: 'Main category created by automated verification',
    icon: '🌟',
    accent_color: '#4C1D95',
    sort_order: 99,
    status: 'published'
  });

  assert(createMainRes.status === 201 && createMainRes.body?.success, 'Admin creates Main Title', JSON.stringify(createMainRes.body));
  const createdMainId = createMainRes.body?.category?.id || createMainRes.body?.id;

  // B. Create Sub Title under new Main Title
  let createdSubId = null;
  if (createdMainId) {
    const createSubRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/content/subcategories',
      method: 'POST',
      headers: adminHeaders
    }, {
      main_category_id: createdMainId,
      title: 'E2E Sub Title Section ' + Date.now(),
      description: 'Subcategory under E2E main title',
      sort_order: 1,
      status: 'active'
    });
    assert(createSubRes.status === 201 && createSubRes.body?.success, 'Admin creates Sub Title', JSON.stringify({ status: createSubRes.status, body: createSubRes.body, createdMainId }));
    createdSubId = createSubRes.body?.subcategory?.id || createSubRes.body?.id;
  }

  // C. Create Content Article under new Sub Title
  let createdArticleId = null;
  const testSlug = 'e2e-reading-test-' + Date.now();
  if (createdMainId && createdSubId) {
    const createArticleRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/content/articles',
      method: 'POST',
      headers: adminHeaders
    }, {
      main_category_id: createdMainId,
      sub_category_id: createdSubId,
      title: 'E2E Test Reading Article',
      unique_slug: testSlug,
      summary: 'Short note for E2E verification',
      content: 'This is the full rich reading content formatted for comfortable distraction-free reading.',
      author_name: 'Rudhra Prarthana',
      status: 'published',
      sort_order: 1
    });
    assert(createArticleRes.status === 201 && createArticleRes.body?.success, 'Admin creates Content Article');
    createdArticleId = createArticleRes.body?.article?.id;
  }

  // Verify newly created content item is readable
  if (testSlug) {
    const testReadRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/content/articles/${testSlug}`,
      method: 'GET'
    });
    assert(testReadRes.status === 200 && testReadRes.body?.article?.title === 'E2E Test Reading Article', 'New article accessible via slug');
  }

  // 6. Test Fine-Grained Member Access Control & Inheritance
  console.log('\n--- STEP 6: Fine-Grained Member Access Control ---');

  // Case A: Block specific member from reading the article
  console.log('Testing: Block specific member with 24-hour temporary duration');
  const blockRuleRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/content/access-rules',
    method: 'POST',
    headers: adminHeaders
  }, {
    target_type: 'article',
    target_id: createdArticleId,
    user_id: memberId,
    rule_type: 'block',
    duration: '24h',
    reason: 'Temporary reading suspension for E2E testing'
  });

  assert(blockRuleRes.status === 201 && blockRuleRes.body?.success, 'Admin created temporary member access restriction', JSON.stringify({ status: blockRuleRes.status, body: blockRuleRes.body, createdArticleId, memberId }));
  const ruleId = blockRuleRes.body?.rule?.id || blockRuleRes.body?.ruleId;

  // Attempt access as blocked member -> Must return 403 Forbidden with reason
  const blockedAccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${testSlug}`,
    method: 'GET',
    headers: memberHeaders
  });

  assert(blockedAccessRes.status === 403, 'Blocked member receives HTTP 403 Forbidden');
  assert(blockedAccessRes.body?.code === 'FORBIDDEN', 'Error code is FORBIDDEN');
  assert(blockedAccessRes.body?.error?.includes('Temporary reading suspension'), 'Blocked member sees specific reason');

  // Attempt access as anonymous / other reader -> Must succeed!
  const anonAccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${testSlug}`,
    method: 'GET'
  });
  assert(anonAccessRes.status === 200 && anonAccessRes.body?.success, 'Other reader can access unhindered');

  // Case B: Restore access manually
  console.log('Testing: Admin manually restores access');
  if (ruleId) {
    const restoreRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/content/access-rules/${ruleId}`,
      method: 'DELETE',
      headers: adminHeaders
    });
    assert(restoreRes.status === 200 && restoreRes.body?.success, 'Admin deletes access rule (Restores Access)');

    // Attempt access again as member -> Must now succeed!
    const restoredAccessRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/content/articles/${testSlug}`,
      method: 'GET',
      headers: memberHeaders
    });
    assert(restoredAccessRes.status === 200 && restoredAccessRes.body?.success, 'Member access immediately restored');
  }

  // Case C: Hierarchical inheritance (Disable parent Main Category -> All descendants disabled)
  console.log('Testing: Hierarchical inheritance - Disable Main Category disables all articles inside');
  const disableMainRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/admin/content/main-categories/${createdMainId}/status`,
    method: 'PATCH',
    headers: adminHeaders
  }, {
    is_disabled: true
  });
  assert(disableMainRes.status === 200 && disableMainRes.body?.success, 'Main category disabled');

  // Anonymous reader access -> Must return 403 with DISABLED
  const inhAccessRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/api/content/articles/${testSlug}`,
    method: 'GET'
  });
  assert(inhAccessRes.status === 403 && inhAccessRes.body?.code === 'DISABLED', 'Article inherited disabled state from parent Main Category');

  // 7. Cleanup Test Records
  console.log('\n--- STEP 7: Cleanup Test Records ---');
  if (createdArticleId) {
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/content/articles/${createdArticleId}`,
      method: 'DELETE',
      headers: adminHeaders
    });
  }
  if (createdSubId) {
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/content/subcategories/${createdSubId}`,
      method: 'DELETE',
      headers: adminHeaders
    });
  }
  if (createdMainId) {
    await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/admin/content/main-categories/${createdMainId}`,
      method: 'DELETE',
      headers: adminHeaders
    });
  }
  console.log('Test records safely cleaned up.');

  // Final Summary
  console.log('\n================================================================');
  console.log(`VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
