// Comprehensive Application Audit & End-to-End Integration Verification Script
// Tests all workflows: Novels, Episodes, Comments, Forum, Duplicate Prevention, and Access Control
import { query, queryOne, getDb } from '../backend/db.js';
import { createSession } from '../backend/auth.js';
import { createNovel, updateNovel, getNovelById } from '../backend/novels.js';
import { checkAndPublishDueEpisodes } from '../backend/episodes.js';

const API_BASE = 'http://localhost:3000';

async function runAudit() {
  console.log('================================================================');
  console.log('RUDHRA PRARTHANA NOVELS — COMPLETE APPLICATION INTEGRATION AUDIT');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(title, condition, extra = '') {
    if (condition) {
      passed++;
      console.log(`  ✓ [PASS] ${title} ${extra}`);
    } else {
      failed++;
      console.error(`  ❌ [FAIL] ${title} ${extra}`);
    }
  }

  // -------------------------------------------------------------
  // 1. MySQL Database & Schema Verification
  // -------------------------------------------------------------
  console.log('\n--- 1. MySQL Database & Schema Integrity ---');
  const tables = await query('SHOW TABLES');
  const tableList = tables.map(t => Object.values(t)[0]);
  assert('Database contains all 19 relational tables', tableList.length >= 19, `(${tableList.length} tables found)`);

  const novelsInDb = await query('SELECT id, title, category, status, is_published FROM novels ORDER BY id ASC');
  assert('Novels table populated with genuine catalog', novelsInDb.length === 6, `(${novelsInDb.length} novels)`);

  const chaptersInDb = await query('SELECT COUNT(*) as cnt FROM chapters');
  assert('Chapters table populated with genuine episodes', chaptersInDb[0].cnt >= 11, `(${chaptersInDb[0].cnt} episodes)`);

  const commentsInDb = await query('SELECT COUNT(*) as cnt FROM comments');
  assert('Comments table populated with reader discussions', commentsInDb[0].cnt >= 8, `(${commentsInDb[0].cnt} comments)`);

  // -------------------------------------------------------------
  // 2. Duplicate Detection & Prevention Audit
  // -------------------------------------------------------------
  console.log('\n--- 2. Duplicate Audit & Prevention ---');
  const titleCounts = new Map();
  for (const n of novelsInDb) {
    const norm = n.title.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    titleCounts.set(norm, (titleCounts.get(norm) || 0) + 1);
  }
  const duplicates = [...titleCounts.entries()].filter(([, cnt]) => cnt > 1);
  assert('No duplicate novel titles exist in MySQL', duplicates.length === 0, duplicates.length ? JSON.stringify(duplicates) : '(0 duplicate groups)');

  // Test backend duplicate prevention in createNovel
  console.log('\n  Testing duplicate prevention on novel creation...');
  const dupAttempt = await createNovel({
    title: novelsInDb[0].title, // Existing title: "Kaadhal Konden Kanave"
    genre: 'Romance'
  });
  assert('Backend strictly rejects duplicate novel creation', !dupAttempt.success && dupAttempt.code === 'DUPLICATE_NOVEL', `(Error: ${dupAttempt.error})`);

  // Test backend title collision in updateNovel
  console.log('  Testing title collision check on novel update...');
  const collisionAttempt = await updateNovel(novelsInDb[1].id, {
    title: novelsInDb[0].title // Attempt to rename novel 2 to novel 1's title
  });
  assert('Backend strictly prevents renaming to an existing novel title', !collisionAttempt.success && collisionAttempt.code === 'DUPLICATE_NOVEL', `(Error: ${collisionAttempt.error})`);

  // -------------------------------------------------------------
  // 3. User Accounts & Identity Verification
  // -------------------------------------------------------------
  console.log('\n--- 3. User Accounts Audit ---');
  const allUsers = await query('SELECT id, username, email, role FROM users');
  console.log('  Current Users in MySQL:');
  console.table(allUsers);

  const authorUser = allUsers.find(u => u.id === 2 || u.username === 'rudhra_author');
  assert('Author/Admin user ID 2 exists in MySQL', Boolean(authorUser), `(Username: ${authorUser?.username}, Email: ${authorUser?.email})`);

  const memberUser = allUsers.find(u => u.email === 'harish89460@gmail.com' || u.username === 'harish');
  assert('Member user account exists in MySQL', Boolean(memberUser), `(ID: ${memberUser?.id}, Email: ${memberUser?.email})`);

  // -------------------------------------------------------------
  // 4. Access Control & Authorization Separation
  // -------------------------------------------------------------
  console.log('\n--- 4. Access Control & Authorization Separation ---');
  const authorToken = await createSession(authorUser.id, 'author');
  const readerToken = await createSession(memberUser.id, 'reader');

  // Anonymous request to protected admin endpoint
  const anonRes = await fetch(`${API_BASE}/api/admin/overview`);
  assert('Anonymous request to /api/admin/overview rejected with 401', anonRes.status === 401);

  // Reader request to protected admin endpoint
  const readerRes = await fetch(`${API_BASE}/api/admin/overview`, {
    headers: { 'Authorization': `Bearer ${readerToken}` }
  });
  assert('Reader session to /api/admin/overview rejected with 403 Forbidden', readerRes.status === 403);

  // Author request to protected admin endpoint
  const authorRes = await fetch(`${API_BASE}/api/admin/overview`, {
    headers: { 'Authorization': `Bearer ${authorToken}` }
  });
  const authorData = await authorRes.json().catch(() => ({}));
  assert('Authorized Author session granted 200 OK to /api/admin/overview', authorRes.status === 200 && authorData.success);

  // -------------------------------------------------------------
  // 5. Public Reader Website & Novel Detail Workflow
  // -------------------------------------------------------------
  console.log('\n--- 5. Public Reader Website & Novel APIs ---');
  const homepageRes = await fetch(`${API_BASE}/api/novels/homepage`);
  const homepageData = await homepageRes.json();
  assert('Homepage API returns 200 with dynamic sections', homepageRes.ok && Boolean(homepageData.sections));
  assert('Homepage contains featured novels from MySQL', (homepageData.sections.featured?.novels?.length || 0) > 0);

  const singleNovel = await getNovelById('nenjam-marappadhillai');
  assert('Novel details loads correctly by slug', singleNovel && singleNovel.title === 'Nenjam Marappadhillai');
  assert('Novel contains chapters loaded from MySQL', singleNovel.chapters.length >= 4);

  // Public reading: chapter content from MySQL content API
  const chapterRes = await fetch(`${API_BASE}/api/content/chapter?novel=nenjam-marappadhillai&ch=1`);
  const chapterData = await chapterRes.json().catch(() => ({}));
  assert('Chapter content loads from MySQL API', chapterRes.ok && chapterData.allowed && Boolean(chapterData.title));

  // -------------------------------------------------------------
  // 6. Comments Workflow Integration
  // -------------------------------------------------------------
  console.log('\n--- 6. Comments Workflow Integration ---');
  const commentsGetRes = await fetch(`${API_BASE}/api/comments?novel=nenjam-marappadhillai&ch=24`);
  const commentsGetData = await commentsGetRes.json();
  assert('Comments fetched dynamically from MySQL', commentsGetRes.ok && Array.isArray(commentsGetData.comments));

  // Post comment as reader
  const commentText = `Empirical verification test comment ${Date.now()}`;
  const postCommentRes = await fetch(`${API_BASE}/api/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${readerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      novelId: 'nenjam-marappadhillai',
      chapterNum: '1',
      content: commentText
    })
  });
  const postCommentData = await postCommentRes.json().catch(() => ({}));
  assert('Reader comment successfully inserted into MySQL', postCommentRes.ok && postCommentData.success);

  // Verify in MySQL
  const commentRow = await queryOne('SELECT id, content FROM comments WHERE content = ?', [commentText]);
  assert('Comment verified in MySQL comments table', Boolean(commentRow));

  // Clean up test comment
  if (commentRow) {
    await query('DELETE FROM comments WHERE id = ?', [commentRow.id]);
    console.log('    (Cleaned up test comment record)');
  }

  // -------------------------------------------------------------
  // 7. Forum Categories, Topics, and Posts Workflow
  // -------------------------------------------------------------
  console.log('\n--- 7. Forum Community Workflow ---');
  const forumCatsRes = await fetch(`${API_BASE}/api/forum/categories`);
  const forumCatsData = await forumCatsRes.json();
  assert('Forum categories fetched from MySQL', forumCatsRes.ok && forumCatsData.categories.length >= 5);

  const forumTopicsRes = await fetch(`${API_BASE}/api/forum/topics`);
  const forumTopicsData = await forumTopicsRes.json();
  assert('Forum topics fetched from MySQL', forumTopicsRes.ok && forumTopicsData.topics.length >= 7);

  // -------------------------------------------------------------
  // 8. Publishing Scheduler Engine
  // -------------------------------------------------------------
  console.log('\n--- 8. Publishing Scheduler Engine ---');
  const schedResult = await checkAndPublishDueEpisodes();
  assert('Scheduler engine executes without error', schedResult && typeof schedResult.publishedCount === 'number');

  // Summary
  console.log('\n================================================================');
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  try {
    await getDb().end();
  } catch { }

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('\nAudit execution error:', err);
  process.exit(1);
});
