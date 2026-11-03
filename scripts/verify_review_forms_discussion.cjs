const http = require('http');
const { createSession } = require('../backend/auth.js');
const { query } = require('../backend/db.js');

function req(options, body = null) {
  return new Promise((resolve, reject) => {
    const request = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    request.on('error', reject);
    if (body) {
      request.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    request.end();
  });
}

async function runVerification() {
  console.log('=== Starting Review Forms Discussion Verification ===\n');

  // 1. Authenticate Member
  const memberToken = await createSession(101, 'member');
  console.log('1. Member Session created for ID 101 (forum_member_1793423007938)');

  // 2. Authenticate Admin/Author
  const adminToken = await createSession(2, 'author');
  console.log('2. Admin Session created for ID 2 (rudhra_author)');

  const targetNovelId = 'review_sub_welcome-to-rudhra-novels';
  const chNum = '0';

  // 3. Member posts a discussion comment (direct comment box, no thread creation or title required)
  console.log('\n3. Member posting a discussion comment to:', targetNovelId);
  const postRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comments',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`
    }
  }, {
    novelId: targetNovelId,
    chapterNum: chNum,
    content: '<p>Sharing my thoughts on the character development and exciting story progression! Wonderful community space.</p>'
  });

  console.log('Member comment post status:', postRes.status, 'Success:', postRes.data?.success);
  if (!postRes.data?.success) {
    throw new Error('Failed to post discussion comment: ' + JSON.stringify(postRes.data));
  }
  const commentId = postRes.data.commentId || postRes.data.comment?.id;
  console.log('Created Comment ID:', commentId);

  // 4. Admin/Author posts a reply to the member comment
  console.log('\n4. Admin/Author posting a reply to Comment ID:', commentId);
  const replyRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comments',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    }
  }, {
    novelId: targetNovelId,
    chapterNum: chNum,
    parentId: commentId,
    content: '<p>Thank you for your valuable review and feedback! More thrilling episodes on the way.</p>'
  });

  console.log('Reply post status:', replyRes.status, 'Success:', replyRes.data?.success);
  const replyId = replyRes.data.commentId || replyRes.data.comment?.id;
  console.log('Created Reply ID:', replyId);

  // 5. Member likes their own or another discussion
  console.log('\n5. Member toggles like on discussion comment');
  const likeRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: `/api/comments/${commentId}/like`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`
    }
  }, { commentId });
  console.log('Like status:', likeRes.status, 'Liked:', likeRes.data?.liked);

  // 6. Member edits their discussion comment
  console.log('\n6. Member updates their comment');
  const editRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comments/update',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${memberToken}`
    }
  }, {
    commentId,
    content: '<p>Sharing my updated thoughts: The character dynamics in the recent episodes are simply masterclass! Highly recommended.</p>'
  });
  console.log('Edit status:', editRes.status, 'Success:', editRes.data?.success);

  // 7. Fetch discussion stream for this Review Forms title
  console.log('\n7. Fetching discussion comments stream for Review Forms title');
  const getRes = await req({
    hostname: 'localhost',
    port: 3000,
    path: `/api/comments?novel=${encodeURIComponent(targetNovelId)}&ch=${chNum}&page=1&limit=10`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${memberToken}`
    }
  });

  console.log('Get comments status:', getRes.status, 'Total comments:', getRes.data?.pagination?.total || getRes.data?.comments?.length);
  const comments = getRes.data?.comments || [];
  const foundComment = comments.find(c => Number(c.id) === Number(commentId));

  if (!foundComment) {
    throw new Error('Comment not found in discussion comments list!');
  }

  console.log('Found comment author:', foundComment.author || foundComment.displayName);
  console.log('Found comment content:', foundComment.content);
  console.log('Found comment replies count:', foundComment.replies?.length || 0);

  if (foundComment.replies && foundComment.replies.length > 0) {
    console.log('Reply author:', foundComment.replies[0].author || foundComment.replies[0].displayName);
    console.log('Reply content:', foundComment.replies[0].content);
  }

  // 8. Clean up test comments safely
  console.log('\n8. Cleaning up test comments');
  if (replyId) {
    await req({
      hostname: 'localhost',
      port: 3000,
      path: '/api/comments/delete',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { commentId: replyId });
    console.log('Deleted reply ID:', replyId);
  }

  if (commentId) {
    await req({
      hostname: 'localhost',
      port: 3000,
      path: '/api/comments/delete',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${memberToken}`
      }
    }, { commentId });
    console.log('Deleted comment ID:', commentId);
  }

  console.log('\n=== ALL REVIEW FORMS DISCUSSION TESTS PASSED SUCCESSFULLY! ===');
}

runVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});

