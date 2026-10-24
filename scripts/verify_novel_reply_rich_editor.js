import { query, queryOne } from '../backend/db.js';
import { sanitizeCommentHtml, addComment, getComments } from '../backend/comments.js';
import fs from 'fs';
import path from 'path';

async function verifyReplyRichEditor() {
  console.log('=== Step 1: Querying a Parent Novel Comment ===');
  const novelId = 'nenjam-marappadhillai';
  
  // Find an existing top-level comment for this novel
  let parentComment = await queryOne(
    `SELECT id, novel_id, chapter_num, user_id, content FROM comments WHERE novel_id = ? AND parent_id IS NULL ORDER BY id ASC LIMIT 1;`,
    [novelId]
  );

  if (!parentComment) {
    console.log('No parent comment found, creating one...');
    const user = await queryOne(`SELECT id FROM users LIMIT 1;`);
    const res = await query(
      `INSERT INTO comments (novel_id, chapter_num, user_id, content) VALUES (?, '0', ?, '<p>Parent novel comment for rich reply test</p>');`,
      [novelId, user.id]
    );
    parentComment = { id: res.insertId, novel_id: novelId, user_id: user.id };
  }

  console.log(`Parent comment ID: ${parentComment.id}`);

  console.log('\n=== Step 2: Preparing Test Image and GIF Attachments ===');
  const uploadsDir = path.resolve('public/uploads/comments');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // 1x1 transparent PNG & GIF
  const testPngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const testGifBuffer = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

  const testImgName = `reply_test_img_${Date.now()}.png`;
  const testGifName = `reply_test_gif_${Date.now()}.gif`;

  fs.writeFileSync(path.join(uploadsDir, testImgName), testPngBuffer);
  fs.writeFileSync(path.join(uploadsDir, testGifName), testGifBuffer);

  const imgUrl = `/uploads/comments/${testImgName}`;
  const gifUrl = `/uploads/comments/${testGifName}`;
  console.log(`Uploaded Image URL: ${imgUrl}`);
  console.log(`Uploaded GIF URL: ${gifUrl}`);

  console.log('\n=== Step 3: Posting Rich-Text Reply with All Features ===');
  const richReplyContent = `
    <h3>A Masterpiece Episode Response!</h3>
    <p>This episode was <strong>exceptionally heartfelt</strong> and <em>deeply moving</em>, with <u>vivid imagery</u> and <del>no dull moments</del>.</p>
    <ul>
      <li>Spellbinding narrative pacing</li>
      <li>Phenomenal emotional resonance</li>
    </ul>
    <p>Visit the official community: <a href="https://rudhraprarthananovels.in" target="_blank" rel="noopener noreferrer" class="rp-comment-link">Rudhra Prarthana Novels</a></p>
    <p><img src="${imgUrl}" alt="Test Scene Snapshot" class="rp-comment-img" loading="lazy" /></p>
    <p><img src="${gifUrl}" alt="Animated Reaction" class="rp-comment-img" loading="lazy" /></p>
  `.trim();

  // Pick a user to post the reply
  const replyUser = await queryOne(`SELECT id, username FROM users WHERE role = 'admin' OR role = 'author' LIMIT 1;`) || 
                    await queryOne(`SELECT id, username FROM users LIMIT 1;`);

  const replyResult = await addComment({
    novelId,
    chapterNum: '0',
    userId: replyUser.id,
    content: richReplyContent,
    parentId: parentComment.id
  });

  if (!replyResult.success) {
    console.error('Failed to post reply:', replyResult.error);
    process.exit(1);
  }

  const replyId = replyResult.comment.id;
  console.log(`Reply successfully posted! Reply ID: ${replyId}, Parent ID: ${replyResult.comment.parentId}`);

  console.log('\n=== Step 4: Verifying Data Retrieval & Threaded Structure in MySQL ===');
  const allComments = await getComments({ novelId, chapterNum: parentComment.chapter_num });
  
  const parentInTree = allComments.find(c => c.id === parentComment.id);
  if (!parentInTree) {
    console.error('Could not find parent comment in retrieved comment tree!');
    process.exit(1);
  }

  const replyInTree = parentInTree.replies.find(r => r.id === replyId);
  if (!replyInTree) {
    console.error(`Reply ${replyId} not found under parent ${parentComment.id}!`);
    console.log('Parent replies:', parentInTree.replies);
    process.exit(1);
  }

  console.log('✅ Reply correctly nested under parent comment in database tree!');
  console.log('Author Display Name:', replyInTree.displayName);
  console.log('Author Avatar:', replyInTree.avatar);
  console.log('Timestamp Display:', replyInTree.timeAgo);
  console.log('Likes count:', replyInTree.likesCount);

  console.log('\n=== Step 5: Validating HTML Content Preserved ===');
  const storedContent = replyInTree.content;
  
  const checks = [
    { name: 'Heading (h3)', pass: storedContent.includes('<h3>A Masterpiece Episode Response!</h3>') },
    { name: 'Bold tag (strong)', pass: storedContent.includes('<strong>exceptionally heartfelt</strong>') },
    { name: 'Italic tag (em)', pass: storedContent.includes('<em>deeply moving</em>') },
    { name: 'Underline tag (u)', pass: storedContent.includes('<u>vivid imagery</u>') },
    { name: 'Strikethrough tag (del)', pass: storedContent.includes('<del>no dull moments</del>') },
    { name: 'Bulleted list (ul/li)', pass: storedContent.includes('<ul>') && storedContent.includes('<li>Spellbinding narrative pacing</li>') },
    { name: 'Hyperlink (a with href)', pass: storedContent.includes('href="https://rudhraprarthananovels.in"') },
    { name: 'Uploaded Image (img)', pass: storedContent.includes(`src="${imgUrl}"`) },
    { name: 'Animated GIF (img)', pass: storedContent.includes(`src="${gifUrl}"`) }
  ];

  let allPassed = true;
  for (const c of checks) {
    if (c.pass) {
      console.log(`  ✅ [PASS] ${c.name}`);
    } else {
      console.error(`  ❌ [FAIL] ${c.name}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error('Stored content did not preserve all rich-text attributes:');
    console.log(storedContent);
    process.exit(1);
  }

  console.log('\n=== SUCCESS: All rich-text novel reply features verified with MySQL persistence! ===');
  process.exit(0);
}

verifyReplyRichEditor().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
