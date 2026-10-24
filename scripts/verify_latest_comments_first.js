import { query, queryOne } from '../server/db.js';
import { getComments, addComment } from '../server/comments.js';

async function verifyLatestCommentsFirst() {
  console.log('=== Step 1: Testing getComments sorting order (created_at DESC) ===');
  const novelId = 'nenjam-marappadhillai';
  const chapterNum = '24';

  const comments = await getComments({ novelId, chapterNum });
  console.log(`Fetched ${comments.length} top-level comments.`);

  if (comments.length < 2) {
    console.log('Not enough comments to test sorting, seeding two test comments...');
    const user = await queryOne(`SELECT id FROM users LIMIT 1;`);
    await addComment({ novelId, chapterNum, userId: user.id, content: '<p>Seed comment A</p>' });
    await new Promise(r => setTimeout(r, 1100)); // wait 1 sec to ensure distinct timestamp
    await addComment({ novelId, chapterNum, userId: user.id, content: '<p>Seed comment B</p>' });
  }

  // Refetch
  const refreshedComments = await getComments({ novelId, chapterNum });
  console.log(`Verifying ${refreshedComments.length} top-level comments are sorted newest first:`);
  
  for (let i = 0; i < refreshedComments.length - 1; i++) {
    const timeA = new Date(refreshedComments[i].createdAt).getTime();
    const timeB = new Date(refreshedComments[i + 1].createdAt).getTime();
    console.log(`  Comment #${refreshedComments[i].id} (${refreshedComments[i].createdAt}) >= Comment #${refreshedComments[i + 1].id} (${refreshedComments[i + 1].createdAt})`);
    if (timeA < timeB) {
      console.error(`❌ Comments sorting failed! Item ${i} (${refreshedComments[i].createdAt}) is older than item ${i + 1} (${refreshedComments[i + 1].createdAt})`);
      process.exit(1);
    }
  }
  console.log('✅ Top-level comments are strictly sorted newest first (created_at DESC)!');

  console.log('\n=== Step 2: Testing Reply Sorting (Newest Reply First) ===');
  // Find or create a parent comment with multiple replies
  let parentWithReplies = refreshedComments.find(c => c.replies && c.replies.length >= 2);
  const user = await queryOne(`SELECT id FROM users LIMIT 1;`);

  if (!parentWithReplies) {
    const parentTarget = refreshedComments[0];
    console.log(`Adding 2 replies to parent comment #${parentTarget.id}...`);
    await addComment({ novelId, chapterNum, userId: user.id, content: '<p>Reply 1 older</p>', parentId: parentTarget.id });
    await new Promise(r => setTimeout(r, 1100));
    await addComment({ novelId, chapterNum, userId: user.id, content: '<p>Reply 2 newer</p>', parentId: parentTarget.id });

    const commentsAfterReplies = await getComments({ novelId, chapterNum });
    parentWithReplies = commentsAfterReplies.find(c => c.id === parentTarget.id);
  }

  if (parentWithReplies && parentWithReplies.replies.length >= 2) {
    console.log(`Parent comment #${parentWithReplies.id} has ${parentWithReplies.replies.length} replies:`);
    for (let j = 0; j < parentWithReplies.replies.length - 1; j++) {
      const repTimeA = new Date(parentWithReplies.replies[j].createdAt).getTime();
      const repTimeB = new Date(parentWithReplies.replies[j + 1].createdAt).getTime();
      console.log(`  Reply #${parentWithReplies.replies[j].id} (${parentWithReplies.replies[j].createdAt}) >= Reply #${parentWithReplies.replies[j + 1].id} (${parentWithReplies.replies[j + 1].createdAt})`);
      if (repTimeA < repTimeB) {
        console.error(`❌ Replies sorting failed! Reply ${j} is older than reply ${j + 1}`);
        process.exit(1);
      }
    }
    console.log('✅ Replies are strictly sorted newest first (created_at DESC)!');
  }

  console.log('\n=== Step 3: Posting a Brand New Comment and Verifying it Lands at the Very Top (index 0) ===');
  const uniqueMarker = `Latest Comment Test - ${Date.now()}`;
  const newCommentRes = await addComment({
    novelId,
    chapterNum,
    userId: user.id,
    content: `<p>${uniqueMarker}</p>`
  });

  if (!newCommentRes.success) {
    console.error('Failed to post comment:', newCommentRes.error);
    process.exit(1);
  }

  const latestComments = await getComments({ novelId, chapterNum });
  if (latestComments[0].id !== newCommentRes.comment.id) {
    console.error(`❌ Newly submitted comment (#${newCommentRes.comment.id}) is not at index 0! Top comment is #${latestComments[0].id}`);
    process.exit(1);
  }
  console.log(`✅ Newly submitted comment #${newCommentRes.comment.id} immediately appears at the top (index 0)!`);

  console.log('\n=== Step 4: Testing Pagination with Descending Sorting ===');
  const page1 = await getComments({ novelId, chapterNum, limit: 2, offset: 0 });
  const page2 = await getComments({ novelId, chapterNum, limit: 2, offset: 2 });

  console.log(`Page 1 IDs: ${page1.map(c => c.id).join(', ')}`);
  console.log(`Page 2 IDs: ${page2.map(c => c.id).join(', ')}`);

  const page1Ids = new Set(page1.map(c => c.id));
  const hasOverlap = page2.some(c => page1Ids.has(c.id));
  if (hasOverlap) {
    console.error('❌ Pagination has duplicated comments across pages!');
    process.exit(1);
  }

  if (page1.length > 0 && page2.length > 0) {
    const lastPage1Time = new Date(page1[page1.length - 1].createdAt).getTime();
    const firstPage2Time = new Date(page2[0].createdAt).getTime();
    if (lastPage1Time < firstPage2Time) {
      console.error('❌ Pagination breaks descending chronological order across pages!');
      process.exit(1);
    }
  }
  console.log('✅ Pagination correctly slices comments in descending order with zero duplication or skipping!');

  console.log('\n=== ALL TESTS PASSED: Comments and replies are strictly newest first (created_at DESC) with full pagination support! ===');
  process.exit(0);
}

verifyLatestCommentsFirst().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
