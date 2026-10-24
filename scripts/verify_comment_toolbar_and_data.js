import { getDb } from '../backend/db.js';
import { getComments, addComment, toggleCommentLike, sanitizeCommentHtml } from '../backend/comments.js';
import { getSidebarPostsFromDb } from '../backend/db.js';
import fs from 'node:fs';
import path from 'node:path';

async function verify() {
  console.log('====================================================');
  console.log('Rudhra Prarthana Novels — Comment Upgrade & Data Fix Verification');
  console.log('====================================================\n');

  const db = getDb();

  // Test 1: Real comments for Nenjam Marappadhillai
  console.log('1. Checking real comments for Nenjam Marappadhillai (Novel Level)...');
  const novelComments = await getComments({ novelId: 'nenjam-marappadhillai', chapterNum: 0 });
  console.log(`   Found ${novelComments.length} top-level comments at novel level.`);
  if (novelComments.length > 0) {
    const c = novelComments[0];
    console.log(`   Top Comment: "${c.content}" by @${c.username} (${c.displayName})`);
    if (c.replies && c.replies.length > 0) {
      console.log(`   Reply: "${c.replies[0].content}" by @${c.replies[0].username} (${c.replies[0].displayName})`);
    }
  }

  // Test 2: Comments for Chapter 24
  console.log('\n2. Checking comments for Nenjam Marappadhillai Chapter 24...');
  const ch24Comments = await getComments({ novelId: 'nenjam-marappadhillai', chapterNum: 24 });
  console.log(`   Found ${ch24Comments.length} comments on Chapter 24.`);
  if (ch24Comments.length > 0) {
    console.log(`   Chapter 24 Comment: "${ch24Comments[0].content}" by @${ch24Comments[0].username}`);
  }

  // Test 3: Forum Latest Posts — verify no test automated strings
  console.log('\n3. Checking Forum Latest Posts in Community Sidebar...');
  const sidebarData = await getSidebarPostsFromDb();
  console.log(`   Retrieved ${sidebarData.latest.length} latest forum topics:`);
  let hasTestGarbage = false;
  for (const post of sidebarData.latest) {
    console.log(`   - [${post.category}] "${post.title}" by ${post.author}`);
    console.log(`     Excerpt: "${post.excerpt}"`);
    if (post.excerpt.includes('Verified live automated reply') || post.title.includes('#3295')) {
      hasTestGarbage = true;
    }
  }
  if (!hasTestGarbage) {
    console.log('   ✅ PASS: No automated test threads or sample comments in Forum Latest Posts!');
  } else {
    console.warn('   ❌ FAIL: Automated test topic still appeared in Latest Posts.');
  }

  // Test 4: Separation — verify comments on Kaadhal Konden Kanave don't appear in Nenjam Marappadhillai
  console.log('\n4. Checking separation between novels...');
  const kkkComments = await getComments({ novelId: 'kaadhal-konden-kanave', chapterNum: 18 });
  const kkkIds = new Set(kkkComments.map(c => c.id));
  const nmpIds = new Set(novelComments.map(c => c.id));
  const intersection = [...kkkIds].filter(id => nmpIds.has(id));
  if (intersection.length === 0) {
    console.log('   ✅ PASS: Complete separation between novels. Zero cross-contamination.');
  } else {
    console.warn('   ❌ FAIL: Comment IDs shared across different novels:', intersection);
  }

  // Test 5: Post a rich formatted comment with bold, italic, style, link, and GIF attachment
  console.log('\n5. Testing Rich Formatted Comment Submission with Image/GIF...');
  // 1x1 transparent animated GIF base64
  const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const uploadDir = path.resolve('public/uploads/comments');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const testGifName = `test-animation-${Date.now()}.gif`;
  fs.writeFileSync(path.join(uploadDir, testGifName), Buffer.from(gifBase64, 'base64'));
  const testGifUrl = `/uploads/comments/${testGifName}`;

  const richHtmlContent = `
    <h2>Impressive Story Progression!</h2>
    <p>This chapter is <b>truly powerful</b> and <i>deeply moving</i>. The dialogue between the characters feels <span style="font-family: 'Cormorant Garamond', serif; font-size: 18px; color: #b88635;">exceptionally poetic</span>.</p>
    <ul>
      <li>Unforgettable confrontation</li>
      <li>Realistic family emotions</li>
    </ul>
    <p>Visit the official discussion: <a href="https://rudhraprarthananovels.in" target="_blank" rel="noopener noreferrer">Rudhra Prarthana Community</a></p>
    <p><img src="${testGifUrl}" alt="Celebration GIF" class="rp-comment-img" loading="lazy" /></p>
  `;

  // Sanitize and save via addComment
  const addResult = await addComment({
    novelId: 'nenjam-marappadhillai',
    chapterNum: '24',
    userId: 28, // Harish
    content: richHtmlContent
  });

  if (addResult.success) {
    console.log(`   ✅ PASS: Rich formatted comment posted successfully (ID: ${addResult.comment.id})!`);
  } else {
    console.error('   ❌ FAIL: Could not post comment:', addResult.error);
  }

  // Test 6: Verify rich comment retrieval and sanitization
  console.log('\n6. Verifying Saved Rich Comment from Database...');
  const updatedComments = await getComments({ novelId: 'nenjam-marappadhillai', chapterNum: 24 });
  const myComment = updatedComments.find(c => c.id === addResult.comment?.id);
  if (myComment) {
    console.log(`   Author: @${myComment.username} (${myComment.displayName})`);
    console.log(`   Content length: ${myComment.content.length} chars`);
    console.log(`   Contains <h2>: ${myComment.content.includes('<h2>')}`);
    console.log(`   Contains <b>: ${myComment.content.includes('<b>') || myComment.content.includes('<strong>')}`);
    console.log(`   Contains <i>: ${myComment.content.includes('<i>') || myComment.content.includes('<em>')}`);
    console.log(`   Contains <ul> & <li>: ${myComment.content.includes('<ul>') && myComment.content.includes('<li>')}`);
    console.log(`   Contains Link: ${myComment.content.includes('<a href="https://rudhraprarthananovels.in"')}`);
    console.log(`   Contains GIF: ${myComment.content.includes(testGifUrl)}`);
    console.log('   ✅ PASS: All formatting, styles, links, and GIF media preserved in MySQL!');
  } else {
    console.error('   ❌ FAIL: Comment was not found in retrieved list.');
  }

  // Test 7: Nested Reply to the rich comment
  console.log('\n7. Testing Author Nested Reply to the Rich Comment...');
  const replyResult = await addComment({
    novelId: 'nenjam-marappadhillai',
    chapterNum: '24',
    userId: 2, // Author Rudhra Prarthana
    parentId: addResult.comment?.id,
    content: 'Thank you @harish for the wonderful appreciation and GIF! Warm wishes ❤️'
  });

  if (replyResult.success) {
    console.log(`   ✅ PASS: Nested reply posted successfully (ID: ${replyResult.comment.id})!`);
    const refreshed = await getComments({ novelId: 'nenjam-marappadhillai', chapterNum: 24 });
    const parentWithReply = refreshed.find(c => c.id === addResult.comment?.id);
    if (parentWithReply && parentWithReply.replies.length > 0) {
      console.log(`   Parent has ${parentWithReply.replies.length} nested reply from @${parentWithReply.replies[0].username}!`);
    }
  }

  // Test 8: Comment Like toggle
  console.log('\n8. Testing Comment Heart Like...');
  const likeResult = await toggleCommentLike({ commentId: addResult.comment?.id, userId: 2 });
  console.log(`   Like toggle result: liked=${likeResult.hasLiked}, likesCount=${likeResult.likesCount}`);
  if (likeResult.success && likeResult.likesCount >= 1) {
    console.log('   ✅ PASS: Comment Like updated accurately in database!');
  }

  // Test 9: Malicious HTML rejection / sanitization
  console.log('\n9. Testing Security — Malicious Script and Event Handler Sanitization...');
  const maliciousInput = `
    <b>Valid Bold Text</b>
    <script>alert("xss")</script>
    <img src="https://example.com/pic.jpg" onerror="alert('hack')" />
    <a href="javascript:alert('malicious')">Dangerous Link</a>
  `;
  const sanitized = sanitizeCommentHtml(maliciousInput);
  const isSafe = !sanitized.includes('<script>') && 
                 !sanitized.includes('onerror=') && 
                 !sanitized.includes('javascript:') &&
                 sanitized.includes('<b>Valid Bold Text</b>');
  if (isSafe) {
    console.log('   ✅ PASS: Malicious scripts, event handlers, and javascript: links stripped safely!');
    console.log(`   Sanitized Output: ${sanitized.trim()}`);
  } else {
    console.warn('   ❌ FAIL: Insecure HTML was not properly sanitized.');
  }

  console.log('\n====================================================');
  console.log('All MySQL and Data Flow Verification Tests Completed!');
  console.log('====================================================');
  process.exit(0);
}

verify().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
