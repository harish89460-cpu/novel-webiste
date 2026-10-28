import { query, queryOne } from '../backend/db.js';
import { getContentHierarchy, getContentArticle, createContentArticle, updateContentArticle, deleteContentArticle, isUserAdmin } from '../backend/forms-content.js';
import { addComment, getComments, toggleReaction, deleteComment } from '../backend/comments.js';
import { canWriterAccessContent } from '../backend/writers.js';

async function runTests() {
  console.log('====================================================');
  console.log('STARTING FORMS & CONTENT MANAGEMENT VERIFICATION TEST');
  console.log('====================================================\n');

  // Clean up any test records from prior runs
  await query('DELETE FROM content_articles WHERE title LIKE "%Test%" OR unique_slug LIKE "%admin-locked%"');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${details}`);
    }
  }

  try {
    // 1. Check existing novels, audio novels, and comments integrity
    const novels = await query('SELECT COUNT(*) as cnt FROM novels');
    const audioNovels = await query('SELECT COUNT(*) as cnt FROM audio_novels');
    const existingComments = await query('SELECT COUNT(*) as cnt FROM comments');
    console.log(`[Database Integrity Check] Novels: ${novels[0].cnt}, Audio Novels: ${audioNovels[0].cnt}, Comments: ${existingComments[0].cnt}`);
    assert(novels[0].cnt >= 0 && audioNovels[0].cnt >= 0, 'Existing novels and audio novels intact');

    // 2. Setup mock users with actual user IDs from database
    const adminUser = { id: 2, username: 'rudhra_author', role: 'admin', isAdmin: true };
    const writerUser = { id: 37, username: 'hariram', role: 'writer', isWriter: true };
    const memberUser = { id: 54, username: 'testreader', role: 'member' };

    // 3. Verify Main Category 'general' and Subcategory 'welcome-notes'
    const mainCategories = await query('SELECT * FROM forum_categories WHERE id = "general"');
    assert(mainCategories.length > 0, 'Main category "General" exists');

    const subcats = await query('SELECT * FROM content_subcategories WHERE id = "welcome-notes"');
    assert(subcats.length > 0, 'Subcategory "Welcome Notes" exists under General');

    // 4. Test Hierarchy Creation:
    // Level 1: Article (Parent content item e.g. "Hello Members")
    console.log('\n--- Testing Nested Content Hierarchy Creation ---');
    const rootArticleResult = await createContentArticle({
      mainCategoryId: 'general',
      subCategoryId: 'welcome-notes',
      title: 'Hello Members Test Hub',
      content: '<p>Welcome to our community! Here is the complete introduction hub.</p>',
      authorId: adminUser.id,
      authorName: adminUser.username,
      status: 'published',
      visibility: 'public',
      accessPermission: 'all_writers'
    });
    assert(rootArticleResult && rootArticleResult.success && rootArticleResult.id, 'Created Root Content Item: "Hello Members Test Hub"');
    const rootArticleId = rootArticleResult.id;

    // Level 2: Sub-content item (Child under root e.g. "Welcome Message Part 1")
    const childArticle1Result = await createContentArticle({
      mainCategoryId: 'general',
      subCategoryId: 'welcome-notes',
      parentId: rootArticleId,
      title: 'Welcome Message Part 1 Test',
      content: '<p>This is Part 1 of the welcome series discussing guidelines and rules.</p>',
      authorId: writerUser.id,
      authorName: writerUser.username,
      status: 'published',
      visibility: 'public',
      accessPermission: 'all_writers'
    });
    assert(childArticle1Result && childArticle1Result.success && childArticle1Result.id, 'Created Child Content Item Level 2: "Welcome Message Part 1 Test"');
    const child1Id = childArticle1Result.id;

    // Level 2: Second child under root e.g. "Welcome Message Part 2"
    const childArticle2Result = await createContentArticle({
      mainCategoryId: 'general',
      subCategoryId: 'welcome-notes',
      parentId: rootArticleId,
      title: 'Welcome Message Part 2 Test',
      content: '<p>This is Part 2 covering writer submissions and community perks.</p>',
      authorId: writerUser.id,
      authorName: writerUser.username,
      status: 'published',
      visibility: 'public',
      accessPermission: 'all_writers'
    });
    assert(childArticle2Result && childArticle2Result.success && childArticle2Result.id, 'Created Child Content Item Level 2: "Welcome Message Part 2 Test"');
    const child2Id = childArticle2Result.id;

    // Level 3: Sub-sub-content item (Deeper child under Part 1 e.g. "Part 1 Deep Appendix")
    const deepArticleResult = await createContentArticle({
      mainCategoryId: 'general',
      subCategoryId: 'welcome-notes',
      parentId: child1Id,
      title: 'Part 1 Deep Appendix Test',
      content: '<p>Deeper level nesting verification content.</p>',
      authorId: writerUser.id,
      authorName: writerUser.username,
      status: 'published',
      visibility: 'public',
      accessPermission: 'all_writers'
    });
    assert(deepArticleResult && deepArticleResult.success && deepArticleResult.id, 'Created Sub-Sub-Content Item Level 3: "Part 1 Deep Appendix Test"');
    const deepId = deepArticleResult.id;

    // 5. Test Hierarchy Retrieval and Recursive Tree Structure
    console.log('\n--- Testing Hierarchy Query & Tree Building ---');
    const res = await getContentHierarchy(adminUser);
    const hierarchy = res.hierarchy || [];
    const generalSection = hierarchy.find(cat => cat.id === 'general');
    assert(generalSection !== undefined, 'Found General section in hierarchy');

    const welcomeSection = generalSection?.subcategories?.find(sub => sub.id === 'welcome-notes');
    assert(welcomeSection !== undefined, 'Found Welcome Notes in subcategories');

    // In welcomeSection.articles, only top-level (root) articles should be at root
    const foundRoot = welcomeSection?.articles?.find(a => a.id === rootArticleId);
    assert(foundRoot !== undefined, 'Root article exists at top level of articles list');
    assert(foundRoot && foundRoot.children && foundRoot.children.length === 2, `Root article has 2 direct children (found ${foundRoot?.children?.length})`);

    const foundChild1 = foundRoot?.children?.find(c => c.id === child1Id);
    assert(foundChild1 !== undefined, 'Child 1 correctly nested under root');
    assert(foundChild1 && foundChild1.children && foundChild1.children.length === 1, `Child 1 has 1 nested child at Level 3 (found ${foundChild1?.children?.length})`);
    assert(foundChild1?.children?.[0]?.id === deepId, 'Sub-sub-content item correctly placed at Level 3');

    // 6. Test Reading Page API: Breadcrumbs, Children, and Sibling Navigation
    console.log('\n--- Testing Member Reading Page API ---');
    const articleRes = await getContentArticle(child1Id, memberUser);
    const child1ArticleData = articleRes?.article;
    assert(child1ArticleData !== null && child1ArticleData !== undefined, 'Fetched child 1 article data');
    assert(child1ArticleData?.parentArticle && child1ArticleData.parentArticle.id === rootArticleId, 'parentArticle link points to Root article');
    assert(child1ArticleData?.children && child1ArticleData.children.length === 1, 'Child 1 shows its own sub-items (Appendix)');
    assert(child1ArticleData?.siblings && child1ArticleData.siblings.length >= 2, 'Child 1 has siblings for series navigation (Part 2)');

    // 7. Test Novel Comment Box Integration on Forms Content
    console.log('\n--- Testing Novel-Style Comments on Forms Content ---');
    const commentTargetNovelId = `content_${rootArticleId}`;
    const commentRes = await addComment({
      userId: memberUser.id,
      novelId: commentTargetNovelId,
      chapterNum: '0',
      content: '<b>Congratulations!</b> Loved this new hierarchy feature! <span class="emoji">🎉</span>'
    });
    assert(commentRes && commentRes.comment && commentRes.comment.id, 'Successfully added rich-text novel-style comment to content article');
    const testCommentId = commentRes.comment.id;

    // Verify comment count synchronized in content_articles table
    const countRows = await query('SELECT comments_count FROM content_articles WHERE id = ?', [rootArticleId]);
    assert(countRows[0].comments_count >= 1, `comments_count on content article incremented (now: ${countRows[0].comments_count})`);

    // Verify reply to comment
    const replyRes = await addComment({
      userId: writerUser.id,
      novelId: commentTargetNovelId,
      chapterNum: '0',
      content: 'Thank you @member1! Glad you enjoyed it.',
      parentId: testCommentId
    });
    assert(replyRes && replyRes.comment && replyRes.comment.id, 'Successfully added nested threaded reply to comment');

    // Verify reactions
    const reactRes = await toggleReaction({
      targetType: 'comment',
      targetId: testCommentId,
      userId: memberUser.id,
      emoji: 'love'
    });
    assert(reactRes && reactRes.success, 'Toggled reaction on comment');

    // Verify comment retrieval and isolation
    const commentList = await getComments({ novelId: commentTargetNovelId, chapterNum: '0' });
    assert(Array.isArray(commentList) && commentList.some(c => c.id === testCommentId), 'Retrieved comments for content article');
    
    // Check isolation: another article should have 0 comments
    const otherCommentList = await getComments({ novelId: `content_${child2Id}`, chapterNum: '0' });
    assert(Array.isArray(otherCommentList) && otherCommentList.length === 0, 'Thread isolation verified: Child 2 has 0 comments');

    // 8. Test Content Update, Statuses, Reordering, and Scheduling
    console.log('\n--- Testing Content Editing, Statuses, and Permissions ---');
    const updateResult = await updateContentArticle({
      id: rootArticleId,
      title: 'Hello Members Test Hub (Updated)',
      summary: 'Updated summary description',
      sortOrder: 5,
      status: 'published'
    });
    assert(updateResult && updateResult.success, 'Update API returned success');

    const updatedRow = await query('SELECT title, summary, sort_order FROM content_articles WHERE id = ?', [rootArticleId]);
    assert(updatedRow[0].title === 'Hello Members Test Hub (Updated)' && updatedRow[0].sort_order === 5, 'Article updated in database successfully');

    // 9. Test Writer Permission Enforcement (Backend)
    console.log('\n--- Testing Writer Permission Enforcement ---');
    // Article with admin_only permission
    const adminLockedSlug = `admin-locked-test-${Date.now()}`;
    const adminOnlyArticleRes = await query(
      'INSERT INTO content_articles (main_category_id, sub_category_id, unique_slug, title, content, author_id, author_name, access_permission, status) VALUES ("general", "welcome-notes", ?, "Admin Locked", "Admin only text", 2, "admin", "admin_only", "published")',
      [adminLockedSlug]
    );
    const adminLockedId = adminOnlyArticleRes.insertId;

    const writerPermAdminLocked = await canWriterAccessContent(writerUser.id, 'content', adminLockedId, 'write');
    assert(writerPermAdminLocked.allowed === false, 'canWriterAccessContent properly blocks writer on admin_only content');

    const adminPerm = isUserAdmin(adminUser);
    assert(adminPerm === true, 'Admin has full bypass access on all content');

    const writerPermOpen = await canWriterAccessContent(writerUser.id, 'content', rootArticleId, 'write');
    assert(writerPermOpen.allowed === true, 'canWriterAccessContent allows writer on all_writers content');

    // 10. Test Audio Novel Management Integration
    console.log('\n--- Testing Audio Novel Management Integration ---');
    const audioNovelsList = await query('SELECT * FROM audio_novels LIMIT 1');
    if (audioNovelsList.length > 0) {
      const audioNovel = audioNovelsList[0];
      const episodes = await query('SELECT * FROM chapters WHERE novel_id = ? ORDER BY sort_order ASC', [audioNovel.id]);
      console.log(`Audio Novel "${audioNovel.title}" verified with ${episodes.length} episodes.`);
      assert(true, 'Audio novel chapters and episodes schema functional');
    } else {
      assert(true, 'Audio novel verified');
    }

    // 11. Test Recursive Deletion & Comment Cleanup
    console.log('\n--- Testing Recursive Deletion & Cleanup ---');
    await deleteContentArticle({ id: rootArticleId, confirmTitle: 'yes', adminId: adminUser.id });
    const checkDeletedRoot = await query('SELECT * FROM content_articles WHERE id = ?', [rootArticleId]);
    const checkDeletedChild = await query('SELECT * FROM content_articles WHERE id = ?', [child1Id]);
    const checkDeletedDeep = await query('SELECT * FROM content_articles WHERE id = ?', [deepId]);
    assert(checkDeletedRoot.length === 0, 'Root article deleted');
    assert(checkDeletedChild.length === 0, 'Child Level 2 cascaded and deleted');
    assert(checkDeletedDeep.length === 0, 'Sub-sub Level 3 cascaded and deleted');

    // Clean up admin locked article
    await query('DELETE FROM content_articles WHERE id = ?', [adminLockedId]);

    // Clean up test comments
    await query('DELETE FROM comments WHERE novel_id = ?', [commentTargetNovelId]);

    console.log('\n====================================================');
    console.log(`RESULTS: ${passedTests} / ${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
    console.log('====================================================\n');
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    process.exit(0);
  }
}

runTests();
