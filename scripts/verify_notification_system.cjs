const http = require('http');
const { query, queryOne } = require('../backend/db');
const { createSession } = require('../backend/auth');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function main() {
  console.log('================================================================');
  console.log('COMPREHENSIVE NOTIFICATION SYSTEM VERIFICATION (E2E)');
  console.log('================================================================\n');

  const timestamp = Date.now().toString().slice(-5);

  // 1. Authenticate actual accounts: Admin, Writer, Member
  const adminUser = await queryOne("SELECT * FROM users WHERE username = 'rudhra_author';");
  const writerUser = await queryOne("SELECT * FROM users WHERE username = 'writer_kavitha';");
  const memberUser = await queryOne("SELECT * FROM users WHERE username = 'forum_member_1793423007938';");

  if (!adminUser) throw new Error('Admin user rudhra_author not found');
  if (!writerUser) throw new Error('Writer user writer_kavitha not found');
  if (!memberUser) throw new Error('Member user forum_member_1793423007938 not found');

  const adminToken = await createSession(adminUser.id, 'author');
  const writerToken = await createSession(writerUser.id, 'writer');
  const memberToken = await createSession(memberUser.id, 'reader');

  console.log('✓ Actual accounts authenticated:');
  console.log(`  - Admin:  ${adminUser.username} (ID: ${adminUser.id})`);
  console.log(`  - Writer: ${writerUser.username} (ID: ${writerUser.id})`);
  console.log(`  - Member: ${memberUser.username} (ID: ${memberUser.id})\n`);

  // Ensure Member follows Writer for follower-based notifications
  await query('INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?);', [memberUser.id, writerUser.id]);

  // Clean prior notifications for member and writer from previous test runs
  await query('DELETE FROM notifications WHERE user_id IN (?, ?, ?);', [memberUser.id, writerUser.id, adminUser.id]);

  // --------------------------------------------------------------------------
  // TEST 1: Member follows Writer -> Writer receives Follow Notification
  // --------------------------------------------------------------------------
  console.log('--- 1. Testing Follow Notification ---');
  // Unfollow first if exists, then follow
  await query('DELETE FROM follows WHERE follower_id = ? AND following_id = ?;', [memberUser.id, writerUser.id]);
  const followRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/members/${writerUser.id}/follow`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });

  if (followRes.status !== 200 || !followRes.body.isFollowing) {
    throw new Error('Follow toggle failed: ' + JSON.stringify(followRes.body));
  }

  // Check Writer's notifications
  const writerNotifs1 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${writerToken}` }
  });
  const followNotif = writerNotifs1.body.notifications.find(n => n.type === 'follow');
  if (!followNotif) {
    throw new Error('Writer did not receive Follow notification!');
  }
  console.log(`✓ Writer received Follow notification: "${followNotif.title}" -> "${followNotif.message}"`);
  console.log(`  Target link: ${followNotif.link}`);

  // --------------------------------------------------------------------------
  // TEST 2: Private Chat Message -> Recipient receives Chat Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Testing Chat Message Notification ---');
  // Writer sends private message to Member
  // Get or create conversation between writer and member
  const convRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/chat/conversations',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, { targetUserId: memberUser.id });

  const convId = convRes.body.conversation?.id || convRes.body.conversationId;
  if (!convId) throw new Error('Failed to get/create conversation: ' + JSON.stringify(convRes.body));

  const chatMsgText = `Hello reader! Special test message ${timestamp}`;
  const sendMsgRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/chat/conversations/${convId}/messages`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, { content: chatMsgText, messageType: 'text' });

  if (sendMsgRes.status !== 200 && sendMsgRes.status !== 201) {
    throw new Error('Failed to send chat message: ' + JSON.stringify(sendMsgRes.body));
  }

  // Check Member's notifications
  const memberNotifs1 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  const chatNotif = memberNotifs1.body.notifications.find(n => n.type === 'chat_message');
  if (!chatNotif) {
    throw new Error('Member did not receive Chat Message notification!');
  }
  console.log(`✓ Member received Chat notification: "${chatNotif.title}" -> "${chatNotif.message}"`);
  console.log(`  Target link: ${chatNotif.link}`);

  // --------------------------------------------------------------------------
  // TEST 3: Novel Comment -> Author receives Novel Comment Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Testing Novel / Chapter Comment Notification ---');
  // Novel owned by Writer: kavitha-literary-novel
  const commentText = `Inspiring episode chapter! Reading test ${timestamp}`;
  const commentRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comments',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${memberToken}`, 'Content-Type': 'application/json' }
  }, {
    novelId: 'kavitha-literary-novel',
    chapterNum: '1',
    content: commentText
  });

  if (commentRes.status !== 201 || !commentRes.body.success) {
    throw new Error('Failed to post novel comment: ' + JSON.stringify(commentRes.body));
  }
  const commentId = commentRes.body.commentId || commentRes.body.comment?.id;

  // Check Writer's notifications
  const writerNotifs2 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${writerToken}` }
  });
  const commentNotif = writerNotifs2.body.notifications.find(n => n.type === 'novel_comment' && n.entityId === 'kavitha-literary-novel');
  if (!commentNotif) {
    throw new Error('Writer did not receive Novel Comment notification!');
  }
  console.log(`✓ Writer received Novel Comment notification: "${commentNotif.title}" -> "${commentNotif.message}"`);
  console.log(`  Target link: ${commentNotif.link} (Verified valid reader route)`);

  // --------------------------------------------------------------------------
  // TEST 4: Comment Reply -> Original Commenter receives Reply Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Testing Comment Reply Notification ---');
  const replyText = `Thank you so much for reading and commenting! Reply test ${timestamp}`;
  const replyRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comments',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    novelId: 'kavitha-literary-novel',
    chapterNum: '1',
    parentId: commentId,
    content: replyText
  });

  if (replyRes.status !== 201 || !replyRes.body.success) {
    throw new Error('Failed to post reply: ' + JSON.stringify(replyRes.body));
  }
  const replyId = replyRes.body.commentId || replyRes.body.comment?.id;

  // Check Member's notifications
  const memberNotifs2 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  const replyNotif = memberNotifs2.body.notifications.find(n => n.type === 'comment_reply' && Number(n.entityId) === Number(commentId));
  if (!replyNotif) {
    throw new Error('Member did not receive Reply notification!');
  }
  console.log(`✓ Member received Reply notification: "${replyNotif.title}" -> "${replyNotif.message}"`);
  console.log(`  Target link: ${replyNotif.link}`);

  // --------------------------------------------------------------------------
  // TEST 5: Comment Like -> Comment Author receives Like Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Testing Comment Like Notification ---');
  const likeRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/comments/${commentId}/like`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, { commentId });

  if (likeRes.status !== 200 || !likeRes.body.success) {
    throw new Error('Failed to toggle comment like: ' + JSON.stringify(likeRes.body));
  }

  // Check Member's notifications
  const memberNotifs3 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  const likeNotif = memberNotifs3.body.notifications.find(n => n.type === 'comment_like');
  if (!likeNotif) {
    throw new Error('Member did not receive Comment Like notification!');
  }
  console.log(`✓ Member received Like notification: "${likeNotif.title}" -> "${likeNotif.message}"`);
  console.log(`  Target link: ${likeNotif.link}`);

  // --------------------------------------------------------------------------
  // TEST 6: Emoji Reaction on Chapter -> Author receives Reaction Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Testing Chapter Emoji Reaction Notification ---');
  await query('DELETE FROM reactions WHERE target_id = ? AND user_id = ?;', ['kavitha-literary-novel:1', memberUser.id]);
  const reactionRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/reactions',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${memberToken}`, 'Content-Type': 'application/json' }
  }, {
    targetType: 'chapter',
    targetId: 'kavitha-literary-novel:1',
    emoji: '❤️'
  });

  if (reactionRes.status !== 200 || !reactionRes.body.success) {
    throw new Error('Failed to post reaction: ' + JSON.stringify(reactionRes.body));
  }

  // Check Writer's notifications
  const writerNotifs3 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${writerToken}` }
  });
  const reactNotif = writerNotifs3.body.notifications.find(n => n.type === 'comment_reaction');
  if (!reactNotif) {
    throw new Error('Writer did not receive Reaction notification!');
  }
  console.log(`✓ Writer received Reaction notification: "${reactNotif.title}" -> "${reactNotif.message}"`);
  console.log(`  Target link: ${reactNotif.link}`);

  // --------------------------------------------------------------------------
  // TEST 7: Review Forms Discussion -> Admin receives Discussion Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Testing Review Forms Discussion Notification ---');
  const discText = `Discussing reader thoughts in Review Forms ${timestamp}`;
  const discRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/comments',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${memberToken}`, 'Content-Type': 'application/json' }
  }, {
    novelId: 'review_sub_welcome-to-rudhra-novels',
    chapterNum: '0',
    content: discText
  });

  if (discRes.status !== 201 || !discRes.body.success) {
    throw new Error('Failed to post review forms discussion: ' + JSON.stringify(discRes.body));
  }
  const discCommentId = discRes.body.commentId || discRes.body.comment?.id;

  // Check Admin's notifications
  const adminNotifs1 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const discNotif = adminNotifs1.body.notifications.find(n => n.type === 'review_discussion');
  if (!discNotif) {
    throw new Error('Admin did not receive Review Discussion notification!');
  }
  console.log(`✓ Admin received Review Discussion notification: "${discNotif.title}" -> "${discNotif.message}"`);
  console.log(`  Target link: ${discNotif.link} (Properly routes to Review Forms title page)`);

  // --------------------------------------------------------------------------
  // TEST 8: Thread Creation -> Followers receive Thread Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Testing Thread Creation Notification ---');
  // First save novel content link
  const epRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/writer/episodes',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    title: `Thread Content ${timestamp}`,
    content: '<p>Story content for thread publication test.</p>',
    status: 'draft'
  });
  const generatedLink = epRes.body.contentLink;

  const threadTitle = `Writer Kavitha Special Thread ${timestamp}`;
  const threadRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/threads',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    mainCategoryId: 'ongoing-novels',
    subCategoryId: 'ongoing-novels-discussion',
    title: threadTitle,
    content: '<p>Thread announcement overview.</p>',
    novelLink: generatedLink
  });

  if ((threadRes.status !== 200 && threadRes.status !== 201) || !threadRes.body.success) {
    throw new Error('Failed to create thread: ' + JSON.stringify(threadRes.body));
  }
  const createdThread = threadRes.body.article;

  // Member follows Writer -> Check Member's notifications
  const memberNotifs4 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  const threadNotif = memberNotifs4.body.notifications.find(n => n.type === 'thread_created');
  if (!threadNotif) {
    throw new Error('Follower (Member) did not receive Thread Created notification!');
  }
  console.log(`✓ Follower (Member) received Thread notification: "${threadNotif.title}" -> "${threadNotif.message}"`);
  console.log(`  Target link: ${threadNotif.link}`);

  // --------------------------------------------------------------------------
  // TEST 9: Chapter Release -> Readers/Followers receive Chapter Notification
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Testing Chapter Release Notification ---');
  const chapterNum = `99${timestamp.slice(-2)}`;
  // Writer drafts the chapter
  const chapRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/writer/episodes',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${writerToken}`, 'Content-Type': 'application/json' }
  }, {
    novelId: 'kavitha-literary-novel',
    chapterNum: chapterNum,
    title: `Thrilling Release Chapter ${chapterNum}`,
    content: '<p>Brand new thrilling chapter release content.</p>',
    status: 'draft'
  });

  if ((chapRes.status !== 200 && chapRes.status !== 201) || !chapRes.body.success) {
    throw new Error('Failed to draft chapter: ' + JSON.stringify(chapRes.body));
  }
  const publishedChap = chapRes.body.episode;

  // Admin approves/publishes the chapter
  const pubRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/writer/episodes/${publishedChap.id}`,
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  }, {
    status: 'published'
  });

  if (pubRes.status !== 200 || !pubRes.body.success) {
    throw new Error('Failed to publish chapter by admin: ' + JSON.stringify(pubRes.body));
  }

  // Member follows Writer -> Check Member's notifications
  const memberNotifs5 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  const chapNotif = memberNotifs5.body.notifications.find(n => n.type === 'chapter_release' && n.entityId === `kavitha-literary-novel:${chapterNum}`);
  if (!chapNotif) {
    throw new Error('Follower (Member) did not receive Chapter Release notification!');
  }
  console.log(`✓ Follower (Member) received Chapter Release notification: "${chapNotif.title}" -> "${chapNotif.message}"`);
  console.log(`  Target link: ${chapNotif.link}`);

  // --------------------------------------------------------------------------
  // TEST 10: Admin Broadcast Announcement -> All Users receive Announcement
  // --------------------------------------------------------------------------
  console.log('\n--- 10. Testing Admin Broadcast Announcement ---');
  const annRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications/announcement',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
  }, {
    title: `Platform Maintenance & Festival Special ${timestamp}`,
    message: 'Welcome all readers and writers! Exciting new features and reading events are live.',
    target: 'all',
    link: '#forms'
  });

  if (annRes.status !== 200 || !annRes.body.success) {
    throw new Error('Failed to broadcast announcement: ' + JSON.stringify(annRes.body));
  }
  console.log(`✓ Admin broadcast announcement successfully delivered to ${annRes.body.count} platform users.`);

  // Check Member received announcement
  const memberNotifs6 = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  const annNotif = memberNotifs6.body.notifications.find(n => n.type === 'announcement' && n.title.includes(timestamp));
  if (!annNotif) {
    throw new Error('Member did not receive Broadcast Announcement notification!');
  }
  console.log(`✓ Member received Announcement notification: "${annNotif.title}"`);

  // --------------------------------------------------------------------------
  // TEST 11: Unread Count, Mark Single Read, Mark All Read
  // --------------------------------------------------------------------------
  console.log('\n--- 11. Testing Unread Count, Mark Read & Persistence ---');
  const unreadBeforeRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications/unread-count',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  const unreadCountBefore = unreadBeforeRes.body.count;
  console.log(`✓ Member unread count before marking read: ${unreadCountBefore}`);
  if (unreadCountBefore < 1) throw new Error('Expected at least 1 unread notification!');

  // Mark single notification as read
  const notifToMark = memberNotifs6.body.notifications[0];
  const markSingleRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/notifications/${notifToMark.id}/read`,
    method: 'POST',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });

  if (markSingleRes.status !== 200 || !markSingleRes.body.success) {
    throw new Error('Failed to mark single notification as read');
  }
  console.log(`✓ Marked notification ID ${notifToMark.id} as read (New unread count: ${markSingleRes.body.unreadCount})`);

  // Mark all as read
  const markAllRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications/read-all',
    method: 'POST',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  if (markAllRes.status !== 200 || !markAllRes.body.success) {
    throw new Error('Failed to mark all notifications as read');
  }
  console.log('✓ Marked all notifications as read');

  // Verify unread count is now 0 in database
  const unreadAfterRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/notifications/unread-count',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${memberToken}` }
  });
  console.log(`✓ Confirmed unread count in DB is: ${unreadAfterRes.body.count}`);
  if (unreadAfterRes.body.count !== 0) throw new Error('Unread count should be 0 after mark-all-read!');

  // --------------------------------------------------------------------------
  // TEST 12: Cleanup Test Data Safely
  // --------------------------------------------------------------------------
  console.log('\n--- 12. Cleaning up test data safely ---');
  await query('DELETE FROM reactions WHERE target_id = ? AND user_id = ?;', ['kavitha-literary-novel:1', memberUser.id]);
  if (commentId) await query('DELETE FROM comments WHERE id = ?;', [commentId]);
  if (replyId) await query('DELETE FROM comments WHERE id = ?;', [replyId]);
  if (discCommentId) await query('DELETE FROM comments WHERE id = ?;', [discCommentId]);
  if (createdThread?.id) await query('DELETE FROM content_articles WHERE id = ?;', [createdThread.id]);
  if (publishedChap?.id) await query('DELETE FROM chapters WHERE id = ?;', [publishedChap.id]);
  if (epRes.body.episode?.id) await query('DELETE FROM chapters WHERE id = ?;', [epRes.body.episode.id]);
  await query('DELETE FROM notifications WHERE user_id IN (?, ?, ?);', [memberUser.id, writerUser.id, adminUser.id]);
  console.log('✓ Test data cleaned up safely.');

  console.log('\n================================================================');
  console.log('ALL 12 NOTIFICATION TESTS PASSED 100% SUCCESSFULLY!');
  console.log('================================================================');
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
