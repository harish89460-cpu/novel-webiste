// Comprehensive Verification for Chat Box Error Fix:
// Cannot read properties of undefined (reading 'other_user')

import { query, queryOne } from '../backend/db.js';
import { createSession } from '../backend/auth.js';
import {
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage
} from '../backend/chat.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runChatVerification() {
  console.log('======================================================================');
  console.log('VERIFYING CHAT FIX: "Cannot read properties of undefined (reading other_user)"');
  console.log('======================================================================');

  // 1. Setup Two Real Test Accounts
  const user1 = await queryOne("SELECT id, username, role FROM users WHERE username = 'rudhra_author';");
  assert(user1 && user1.id, `1. Account 1 (rudhra_author) found with ID ${user1?.id}`);

  let user2 = await queryOne("SELECT id, username, role FROM users WHERE username = 'harish';");
  if (!user2) {
    user2 = await queryOne("SELECT id, username, role FROM users WHERE id != ? LIMIT 1;", [user1.id]);
  }
  assert(user2 && user2.id, `2. Account 2 (${user2?.username}) found with ID ${user2?.id}`);

  // Create session tokens for HTTP API verification
  const token1 = await createSession(user1.id, 'author');
  const token2 = await createSession(user2.id, 'reader');
  assert(token1 && token2, '3. Auth sessions generated successfully');

  // 2. Start or get conversation between user1 and user2
  const startConv = await getOrCreateConversation(user1.id, user2.id);
  assert(startConv && startConv.success && (startConv.conversationId || startConv.id), `4. Conversation created/retrieved with ID: ${startConv.conversationId || startConv.id}`);
  assert(startConv.conversation && startConv.conversation.id, '5. getOrCreateConversation returns conversation object with id');
  const convId = startConv.conversationId || startConv.id;

  // 3. Backend function: getUserConversations
  const convsRes1 = await getUserConversations(user1.id);
  assert(convsRes1.success && Array.isArray(convsRes1.conversations), '6. getUserConversations returns success and array');
  const user1Conv = convsRes1.conversations.find(c => Number(c.id || c.conversationId) === Number(convId));
  assert(user1Conv !== undefined, '7. Target conversation is found in user1 conversation list');
  assert(user1Conv?.other_user !== undefined && user1Conv?.otherUser !== undefined, '8. Conversation object contains both other_user and otherUser');
  assert(user1Conv?.other_user?.username === user2.username, `9. other_user identifies recipient: @${user1Conv?.other_user?.username}`);
  assert(user1Conv?.unreadCount !== undefined && user1Conv?.unread_count !== undefined, '10. Conversation object contains unreadCount and unread_count');

  // 4. Backend function: getConversationMessages
  const msgHistory = await getConversationMessages(convId, user1.id);
  assert(msgHistory.success === true, '11. getConversationMessages succeeds for participant');
  assert(msgHistory.conversation !== undefined, '12. getConversationMessages contains conversation object (prevents undefined reading other_user)');
  assert(msgHistory.conversation?.other_user !== undefined, '13. msgHistory.conversation.other_user is defined');
  assert(msgHistory.other_user !== undefined && msgHistory.otherUser !== undefined, '14. msgHistory top-level has other_user and otherUser');
  assert(Array.isArray(msgHistory.messages), '15. msgHistory.messages is an array');

  // 5. Send message from user1 to user2
  const sendRes = await sendMessage(convId, user1.id, 'Automated verification message from user1: ' + Date.now());
  assert(sendRes.success === true && sendRes.message && sendRes.message.id, '16. Message sent successfully from user1 to user2');

  // 6. User2 loads conversation messages
  const user2History = await getConversationMessages(convId, user2.id);
  assert(user2History.success === true, '17. User2 loads conversation successfully');
  assert(user2History.conversation?.other_user?.username === user1.username, `18. User2 sees other_user as @${user1.username}`);
  assert(user2History.messages.length > 0, '19. User2 receives message history');
  const lastMsg = user2History.messages[user2History.messages.length - 1];
  assert(lastMsg.isMe === false && lastMsg.is_me === false, '20. Incoming message correctly identified as incoming (isMe=false)');

  // 7. User2 replies to user1
  const replyRes = await sendMessage(convId, user2.id, 'Automated reply from user2: ' + Date.now());
  assert(replyRes.success === true && replyRes.message?.id, '21. Reply sent successfully from user2 to user1');

  // 8. HTTP API Tests against Live Backend (http://localhost:3000)
  const headers1 = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token1}`,
    'X-Auth-Token': token1,
    'Cookie': `auth_token=${token1}`
  };
  const headers2 = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token2}`,
    'X-Auth-Token': token2,
    'Cookie': `auth_token=${token2}`
  };

  // Test GET /api/chat/conversations
  const apiConvsRes = await fetch('http://localhost:3000/api/chat/conversations', { headers: headers1 });
  assert(apiConvsRes.status === 200, '22. HTTP GET /api/chat/conversations returns 200 OK');
  const apiConvsData = await apiConvsRes.json();
  assert(apiConvsData.success && Array.isArray(apiConvsData.conversations), '23. API conversations array returned');
  const apiConvItem = apiConvsData.conversations.find(c => Number(c.id || c.conversationId) === Number(convId));
  assert(apiConvItem?.other_user !== undefined, '24. API conversation item includes other_user');
  assert(apiConvItem?.otherUser !== undefined, '25. API conversation item includes otherUser');

  // Test GET /api/chat/conversations/:id
  const apiConvDetailRes = await fetch(`http://localhost:3000/api/chat/conversations/${convId}`, { headers: headers1 });
  assert(apiConvDetailRes.status === 200, '26. HTTP GET /api/chat/conversations/:id returns 200 OK');
  const apiConvDetail = await apiConvDetailRes.json();
  assert(apiConvDetail.conversation !== undefined, '27. API detail response includes conversation object');
  assert(apiConvDetail.conversation.other_user !== undefined, '28. API conversation.other_user is defined (No TypeError!)');
  assert(apiConvDetail.other_user !== undefined, '29. API top-level other_user is defined');
  assert(apiConvDetail.otherUser !== undefined, '30. API top-level otherUser is defined');
  assert(Array.isArray(apiConvDetail.messages), '31. API detail response includes messages array');

  // Test POST /api/chat/conversations/:id/messages
  const apiSendRes = await fetch(`http://localhost:3000/api/chat/conversations/${convId}/messages`, {
    method: 'POST',
    headers: headers1,
    body: JSON.stringify({ content: 'HTTP API test message ' + Date.now() })
  });
  assert(apiSendRes.status === 201, '32. HTTP POST message returns 201 Created');
  const apiSendData = await apiSendRes.json();
  assert(apiSendData.success && apiSendData.message?.id, '33. Sent message payload contains ID');

  // 9. Negative & Privacy Tests
  // A) Unauthorized user access (user with no participation)
  let nonParticipant = await queryOne("SELECT id, username, role FROM users WHERE id NOT IN (?, ?) LIMIT 1;", [user1.id, user2.id]);
  if (nonParticipant) {
    const nonPartToken = await createSession(nonParticipant.id, 'reader');
    const unauthRes = await fetch(`http://localhost:3000/api/chat/conversations/${convId}`, {
      headers: { 'Authorization': `Bearer ${nonPartToken}`, 'X-Auth-Token': nonPartToken, 'Cookie': `auth_token=${nonPartToken}` }
    });
    assert(unauthRes.status === 403, `34. Unauthorized member (@${nonParticipant.username}) blocked with 403 Forbidden`);
  }

  // B) Unauthenticated access
  const unauthNoToken = await fetch(`http://localhost:3000/api/chat/conversations/${convId}`);
  assert(unauthNoToken.status === 401, '35. Request without authentication blocked with 401 Unauthorized');

  // C) Invalid conversation ID
  const invalidConvRes = await fetch('http://localhost:3000/api/chat/conversations/99999999', { headers: headers1 });
  assert(invalidConvRes.status === 403 || invalidConvRes.status === 404, '36. Non-existent conversation handled safely without crash');

  console.log('======================================================================');
  console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('======================================================================');

  try {
    const { getDb } = await import('../backend/db.js');
    await getDb().end();
  } catch {}
}

runChatVerification().catch(err => {
  console.error('[Verification Error]', err);
  process.exit(1);
});
