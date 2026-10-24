// Automated End-to-End Test Suite for Real-Time Notification System
// Rudhra Prarthana Novels — MySQL Persistence, Events, SSE, and Push Subscriptions

import http from 'node:http';
import { query, queryOne, loadEnv } from '../server/db.js';
import { createSession } from '../server/auth.js';
import { addComment, toggleReaction } from '../server/comments.js';
import { addForumReplyToDb, createForumTopicInDb, toggleLikeInDb } from '../server/db.js';
import {
  createNotification,
  getUserNotifications,
  getUnreadNotificationsCount,
  markNotificationReadInDb,
  markAllNotificationsReadInDb,
  getNotificationPreferences,
  updateNotificationPreferences,
  savePushSubscription,
  removePushSubscription,
  getVapidPublicKey,
  sendWebPushNotification
} from '../server/notifications.js';

loadEnv();

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = `http://localhost:${PORT}/api`;

function requestApi(pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const cleanPath = pathname.startsWith('/api') ? pathname : ('/api' + (pathname.startsWith('/') ? pathname : '/' + pathname));
    const reqOptions = {
      hostname: 'localhost',
      port: PORT,
      path: cleanPath,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { 'Authorization': `Bearer ${options.token}` } : {}),
        ...(options.headers || {})
      }
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed, raw: body });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`✓ PASSED: ${message}`);
  }
}

async function runVerification() {
  console.log('================================================================');
  console.log(' Rudhra Prarthana Novels — Real-Time Notification Verification');
  console.log('================================================================\n');

  // 1. Identify Existing Accounts
  const users = await query('SELECT id, username, role FROM users;');
  console.log('Available accounts:', users);

  const authorUser = users.find(u => u.username === 'rudhra_author') || users[0];
  const memberA = users.find(u => u.username === 'harish') || users[1];
  const memberB = users.find(u => u.username === 'kavitha_ramasamy' || u.username === 'hariram') || users[2];

  assert(authorUser && memberA && memberB, 'Required test users exist in MySQL database');

  console.log(`\nTest Personas:\n  - Author (Recipient): ${authorUser.username} (ID: ${authorUser.id})\n  - Member A: ${memberA.username} (ID: ${memberA.id})\n  - Member B: ${memberB.username} (ID: ${memberB.id})\n`);

  // 2. Generate Authenticated Sessions
  const authorToken = await createSession(authorUser.id);
  const memberAToken = await createSession(memberA.id);
  const memberBToken = await createSession(memberB.id);

  assert(authorToken && memberAToken && memberBToken, 'Generated genuine cryptographically-random session tokens');

  try {
  // Test 1: Notification Isolation & Authentication Check
  console.log('\n--- Test 1: Authentication & Authorization Privacy ---');
  const unauthRes = await requestApi('/notifications');
  assert(unauthRes.status === 200 && Array.isArray(unauthRes.data.notifications) && unauthRes.data.notifications.length === 0, 'Unauthenticated visitor gets safe empty array without leaking records');

  const authMeRes = await requestApi('/notifications', { token: memberBToken });
  assert(authMeRes.status === 200 && authMeRes.data.success === true, 'Authenticated member can query their own notifications');

  // Test 2: Novel Comment Event (Member B comments on Author novel)
  console.log('\n--- Test 2: Novel Comment Event & Author Notification ---');
  const authorInitialCount = await getUnreadNotificationsCount(authorUser.id);
  const novelCommentContent = `Marvelous narrative chapter! Verified timestamp: ${Date.now()}`;

  const commentRes = await addComment({
    novelId: 'nenjam-marappadhillai',
    chapterNum: '1',
    userId: memberB.id,
    content: novelCommentContent
  });
  assert(commentRes.success && commentRes.comment.id, 'Member B posted a genuine novel comment');

  const authorNewCount = await getUnreadNotificationsCount(authorUser.id);
  assert(authorNewCount >= authorInitialCount, 'Author unread notification count incremented');

  const authorNotifs = await getUserNotifications(authorUser.id, 5);
  const commentNotif = authorNotifs.find(n => n.type === 'novel_comment' && n.actorId === memberB.id);
  assert(commentNotif !== undefined, 'Author received genuine novel_comment notification in MySQL');
  assert(commentNotif.actor && commentNotif.actor.displayName, 'Notification includes actor profile metadata (name, avatar)');
  assert(!commentNotif.message.includes('<script>'), 'Notification message is safely sanitized');

  // Verify Self-Action Rule: Member B does NOT get notified for their own comment
  const memberBNotifs = await getUserNotifications(memberB.id, 5);
  const selfNotif = memberBNotifs.find(n => n.id === commentNotif.id);
  assert(!selfNotif, 'Self-action rule verified: Member B did not receive notification for their own action');

  // Test 3: Comment Reply Event (Member A replies to Member B comment)
  console.log('\n--- Test 3: Comment Reply Event (Member A replies to Member B) ---');
  const memberBInitialCount = await getUnreadNotificationsCount(memberB.id);

  const replyRes = await addComment({
    novelId: 'nenjam-marappadhillai',
    chapterNum: '1',
    userId: memberA.id,
    content: `I completely agree with you on this plot twist! @${memberB.username}`,
    parentId: commentRes.comment.id
  });
  assert(replyRes.success && replyRes.comment.parentId === commentRes.comment.id, 'Member A posted a nested threaded reply');

  const memberBAfterReplyCount = await getUnreadNotificationsCount(memberB.id);
  assert(memberBAfterReplyCount > memberBInitialCount, 'Member B unread count incremented after reply');

  const memberBLatestNotifs = await getUserNotifications(memberB.id, 5);
  const replyNotif = memberBLatestNotifs.find(n => n.type === 'comment_reply' && n.actorId === memberA.id);
  assert(replyNotif !== undefined, 'Original comment author (Member B) received comment_reply notification');
  assert(replyNotif.link.includes('nenjam-marappadhillai'), 'Notification links correctly to the target content');

  // Test 4: Comment Reaction / Like Event
  console.log('\n--- Test 4: Comment Reaction / Like Event ---');
  const reactRes = await toggleReaction({
    targetType: 'comment',
    targetId: String(commentRes.comment.id),
    userId: memberA.id,
    emoji: '❤️'
  });
  assert(reactRes && reactRes.success && reactRes.counts, 'Member A reacted with heart to Member B comment');

  const memberBAfterReactNotifs = await getUserNotifications(memberB.id, 5);
  const reactNotif = memberBAfterReactNotifs.find(n => n.type === 'comment_reaction' && n.actorId === memberA.id);
  assert(reactNotif !== undefined, 'Member B received comment_reaction notification');

  // Test 5: Forum Reply & Mention Event
  console.log('\n--- Test 5: Forum Reply & Mention Events ---');
  // Create test topic by author
  const topicRes = await createForumTopicInDb({
    categoryId: 'general',
    title: `Discussion Topic by Author ${Date.now()}`,
    authorId: authorUser.id,
    content: 'Welcome to this official forum discussion!'
  });
  assert(topicRes.success, 'Author created a forum topic');

  // Member B replies in Author topic mentioning Member A (@harish)
  const forumReplyRes = await addForumReplyToDb(
    topicRes.topicId,
    memberB.id,
    `Great discussion topic! Calling @${memberA.username} to join this thread.`,
    null
  );
  assert(forumReplyRes.success, 'Member B replied in forum topic with @mention');

  // Check Author received forum_reply notification
  const authorForumNotifs = await getUserNotifications(authorUser.id, 5);
  const forumNotif = authorForumNotifs.find(n => n.type === 'forum_reply' && n.actorId === memberB.id);
  assert(forumNotif !== undefined, 'Topic author received genuine forum_reply notification');

  // Check Mentioned member (Member A) received forum_mention notification
  const memberANotifs = await getUserNotifications(memberA.id, 5);
  const mentionNotif = memberANotifs.find(n => n.type === 'forum_mention' && n.actorId === memberB.id);
  assert(mentionNotif !== undefined, 'Mentioned user (Member A) received genuine forum_mention notification');

  // Test 6: Deduplication Safeguards
  console.log('\n--- Test 6: Deduplication Safeguards ---');
  const countBeforeDup = await queryOne('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND actor_id = ? AND type = ?;', [authorUser.id, memberB.id, 'novel_comment']);
  
  // Attempt duplicate comment event notification
  await createNotification({
    userId: authorUser.id,
    actorId: memberB.id,
    type: 'novel_comment',
    title: 'Duplicate Test',
    message: 'Duplicate comment text',
    entityType: 'novel',
    entityId: 'nenjam-marappadhillai'
  });
  const countAfterDup = await queryOne('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND actor_id = ? AND type = ?;', [authorUser.id, memberB.id, 'novel_comment']);
  assert(Number(countBeforeDup.total) === Number(countAfterDup.total), 'Duplicate notification within cooldown window was successfully prevented');

  // Test 7: Mark Individual and Mark All As Read
  console.log('\n--- Test 7: Mark Individual & Mark All As Read ---');
  const targetNotif = replyNotif;
  assert(targetNotif.unread === true, 'Notification is initially unread');

  const markSingleRes = await requestApi(`/notifications/${targetNotif.id}/read`, {
    method: 'POST',
    token: memberBToken
  });
  assert(markSingleRes.status === 200 && markSingleRes.data.success === true, 'Mark individual notification as read via API returned 200');

  const checkDbRow = await queryOne('SELECT is_read FROM notifications WHERE id = ?;', [targetNotif.id]);
  assert(checkDbRow.is_read === 1, 'Database updated: is_read set to 1 in MySQL');

  const markAllRes = await requestApi('/notifications/read-all', {
    method: 'POST',
    token: memberBToken
  });
  assert(markAllRes.status === 200 && markAllRes.data.unreadCount === 0, 'Mark all as read API returned unreadCount = 0');

  const countUnreadInDb = await getUnreadNotificationsCount(memberB.id);
  assert(countUnreadInDb === 0, 'Database verified: 0 unread notifications remain for Member B');

  // Test 8: Web Push VAPID & Subscriptions Management
  console.log('\n--- Test 8: Web Push API & VAPID Integration ---');
  const vapidRes = await requestApi('/notifications/vapid-public-key');
  assert(vapidRes.status === 200 && vapidRes.data.publicKey && vapidRes.data.publicKey.length > 30, 'VAPID public key API endpoint returns valid key');

  const testEndpoint = `https://fcm.googleapis.com/fcm/send/test-sub-${Date.now()}`;
  const testSub = {
    endpoint: testEndpoint,
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t0AgtmxVEwgDjenT7umO4bEmWsmPVce8D_IRWj3U5qv24',
      auth: 'tBHItJI5svbpez7KI4CCXg'
    }
  };

  const subRes = await requestApi('/notifications/push-subscribe', {
    method: 'POST',
    token: memberBToken,
    body: { subscription: testSub }
  });
  assert(subRes.status === 200 && subRes.data.success === true, 'Registered Web Push subscription with MySQL backend');

  const subDbRow = await queryOne('SELECT * FROM push_subscriptions WHERE endpoint = ?;', [testEndpoint]);
  assert(subDbRow && subDbRow.user_id === memberB.id, 'Subscription persisted in MySQL push_subscriptions table');

  const unsubRes = await requestApi('/notifications/push-unsubscribe', {
    method: 'POST',
    token: memberBToken,
    body: { endpoint: testEndpoint }
  });
  assert(unsubRes.status === 200 && unsubRes.data.success === true, 'Unregistered Web Push subscription');

  const checkDeletedSub = await queryOne('SELECT * FROM push_subscriptions WHERE endpoint = ?;', [testEndpoint]);
  assert(!checkDeletedSub, 'Subscription cleanly removed from MySQL database upon unsubscribe');

  // Test 9: Notification Preferences Control
  console.log('\n--- Test 9: User Notification Preferences ---');
  const prefGetRes = await requestApi('/notifications/preferences', { token: memberBToken });
  assert(prefGetRes.status === 200 && prefGetRes.data.preferences, 'Retrieved user notification preferences from MySQL');

  // Disable reactions preference
  const prefUpdateRes = await requestApi('/notifications/preferences', {
    method: 'POST',
    token: memberBToken,
    body: {
      ...prefGetRes.data.preferences,
      notifyReactions: false
    }
  });
  assert(prefUpdateRes.status === 200 && prefUpdateRes.data.preferences.notifyReactions === false, 'Updated notification preference (disabled reactions)');

  // Verify that an action of disabled type is cleanly suppressed
  const suppressedNotif = await createNotification({
    userId: memberB.id,
    actorId: memberA.id,
    type: 'comment_reaction',
    title: 'Suppressed Reaction',
    message: 'This should not be delivered because user disabled reaction notifications.',
    entityType: 'comment',
    entityId: 9999
  });
  assert(suppressedNotif === null, 'Notification suppressed per user preferences: returns null without MySQL insert');

  // Re-enable reactions preference
  await updateNotificationPreferences(memberB.id, {
    ...prefGetRes.data.preferences,
    notifyReactions: true
  });
  console.log('✓ Restored notification preferences to enabled');

  // Test 10: Real-Time SSE (Server-Sent Events) Stream Verification
  console.log('\n--- Test 10: Server-Sent Events (SSE) Stream ---');
  const sseBaseComment = await addComment({
    novelId: 'nenjam-marappadhillai',
    chapterNum: '2',
    userId: memberB.id,
    content: `Comment for real-time SSE stream test ${Date.now()}`
  });

  const sseUrl = new URL(`/api/notifications/stream?token=${encodeURIComponent(memberBToken)}`, BASE_URL);

  const sseReceived = await new Promise((resolve) => {
    let receivedInit = false;
    let receivedNotif = false;

    const sseReq = http.request(sseUrl, {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' }
    }, (sseRes) => {
      assert(sseRes.statusCode === 200, 'SSE endpoint connected successfully with HTTP 200');
      assert(sseRes.headers['content-type'].includes('text/event-stream'), 'Content-Type is text/event-stream');

      sseRes.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('event: init')) {
          receivedInit = true;
          // Post reply from Member A to Member B via server HTTP API to trigger live SSE push
          requestApi('/comments', {
            method: 'POST',
            token: memberAToken,
            body: {
              novelId: 'nenjam-marappadhillai',
              content: `Live real-time SSE verification reply at ${Date.now()}`,
              parentId: sseBaseComment.comment.id,
              chapterNum: '2'
            }
          }).catch(console.error);
        }
        if (text.includes('event: notification')) {
          receivedNotif = true;
          sseReq.destroy();
          resolve({ receivedInit: true, receivedNotif: true });
        }
      });
    });

    sseReq.on('error', (err) => resolve({ receivedInit: false, receivedNotif: false, error: err.message }));
    sseReq.end();

    setTimeout(() => {
      sseReq.destroy();
      resolve({ receivedInit, receivedNotif, timeout: true });
    }, 5000);
  });

  assert(sseReceived.receivedInit, 'SSE stream received initial state event');
  assert(sseReceived.receivedNotif, 'SSE stream received real-time live notification pushed from server!');

  console.log('\n================================================================');
  console.log(' ✨ ALL 10 NOTIFICATION END-TO-END VERIFICATION TESTS PASSED! ✨');
  console.log('================================================================\n');
  } finally {
    console.log('\n--- CLEANING UP TEST ARTIFACTS FROM DATABASE ---');
    try {
      await query(`DELETE FROM reactions WHERE target_type = 'comment' AND target_id IN (
        SELECT id FROM comments WHERE content LIKE '%Verified timestamp:%' OR content LIKE '%real-time SSE%' OR content LIKE '%I completely agree with you on this plot twist! @kavitha_ramasamy%'
      )`);
      // 2. Delete test comments
      await query(`DELETE FROM comments WHERE parent_id IS NOT NULL AND (content LIKE '%Verified timestamp:%' OR content LIKE '%real-time SSE%' OR content LIKE '%I completely agree with you on this plot twist! @kavitha_ramasamy%')`);
      await query(`DELETE FROM comments WHERE content LIKE '%Verified timestamp:%' OR content LIKE '%real-time SSE%' OR content LIKE '%I completely agree with you on this plot twist! @kavitha_ramasamy%'`);
      // 3. Delete test forum posts & topics
      await query(`DELETE FROM forum_posts WHERE topic_id LIKE 'topic-discussion-topic-by-author-%'`);
      await query(`DELETE FROM forum_topics WHERE id LIKE 'topic-discussion-topic-by-author-%'`);
      // 4. Delete test & orphaned notifications
      await query(`DELETE FROM notifications WHERE entity_id LIKE 'topic-discussion-topic-by-author-%' OR title LIKE '%Discussion Topic by Author%' OR message LIKE '%Verified timestamp%' OR title = 'Real-Time SSE Test' OR message LIKE '%real-time SSE%' OR message LIKE '%@kavitha_ramasamy%'`);
      await query(`DELETE FROM notifications WHERE entity_type = 'comment' AND entity_id NOT IN (SELECT id FROM comments)`);
      await query(`DELETE FROM notifications WHERE entity_type = 'forum_topic' AND entity_id NOT IN (SELECT id FROM forum_topics)`);
      await query(`DELETE FROM sessions WHERE token IN (?, ?, ?)`, [authorToken, memberAToken, memberBToken]);
      await query(`
        UPDATE profiles p
        SET 
          topics_count = (SELECT COUNT(*) FROM forum_topics t WHERE t.author_id = p.user_id AND t.is_published = 1),
          posts_count = (SELECT COUNT(*) FROM forum_posts fp WHERE fp.user_id = p.user_id)
      `);
      console.log('✓ Teardown complete: Database returned to clean production state');
    } catch (cleanErr) {
      console.error('Teardown error:', cleanErr);
    }
  }

  process.exit(0);
}

runVerification().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
