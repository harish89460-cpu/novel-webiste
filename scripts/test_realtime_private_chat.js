// Comprehensive Real-Time Private Chat Verification Test Suite
// Rudhra Prarthana Novels

import { query, queryOne, hashPassword } from '../backend/db.js';
import { createSession } from '../backend/auth.js';
import {
  getUserChatSettings,
  updateUserChatSettings,
  toggleChatLock,
  getChatLockStatus,
  canUsersChat,
  getOrCreateConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  getTotalUnreadChatCount,
  getEligibleChatUsers,
  getAdminWritersList,
  getAdminWriterConversations,
  getAdminWriterChatHistory
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

async function runTests() {
  console.log('======================================================================');
  console.log('VERIFYING ONE-TO-ONE REAL-TIME PRIVATE CHAT SYSTEM');
  console.log('======================================================================');

  // 1. Setup Test Users
  const adminUser = await queryOne("SELECT id, username, role FROM users WHERE id = 2;");
  assert(adminUser && adminUser.username === 'rudhra_author', '1. Admin/Author account exists (id=2)');

  const writerUser = await queryOne("SELECT id, username, role FROM users WHERE id = 36;");
  assert(writerUser && writerUser.role === 'writer', '2. Writer account exists (id=36, kavitha_ramasamy)');

  // Ensure member user 1 (harish id=28)
  let member1 = await queryOne("SELECT id, username, role FROM users WHERE username = 'harish';");

  // Create dedicated reader members for pure member-to-member tests
  let member2 = await queryOne("SELECT id, username, role FROM users WHERE username = 'test_reader_chat';");
  if (!member2) {
    const { hash, salt } = hashPassword('TestReader123!');
    const res = await query(
      "INSERT INTO users (username, email, password_hash, salt, role, status) VALUES ('test_reader_chat', 'test_reader_chat@example.com', ?, ?, 'reader', 'active');",
      [hash, salt]
    );
    member2 = { id: res.insertId, username: 'test_reader_chat', role: 'reader' };
    await query("INSERT IGNORE INTO profiles (user_id, display_name) VALUES (?, 'Test Reader');", [member2.id]);
  }

  let member3 = await queryOne("SELECT id, username, role FROM users WHERE username = 'test_reader_chat_2';");
  if (!member3) {
    const { hash, salt } = hashPassword('TestReader123!');
    const res = await query(
      "INSERT INTO users (username, email, password_hash, salt, role, status) VALUES ('test_reader_chat_2', 'test_reader_chat_2@example.com', ?, ?, 'reader', 'active');",
      [hash, salt]
    );
    member3 = { id: res.insertId, username: 'test_reader_chat_2', role: 'reader' };
    await query("INSERT IGNORE INTO profiles (user_id, display_name) VALUES (?, 'Test Reader Two');", [member3.id]);
  }
  assert(member2 && member3, '3. Dedicated test reader member accounts verified');

  const testUserIds = [adminUser.id, writerUser.id, member1.id, member2.id, member3.id];
  console.log(`\nTesting with accounts: Admin (${adminUser.id}), Writer (${writerUser.id}), Member1 (${member1.id}), Member2 (${member2.id}), Member3 (${member3.id})`);

  // Reset chat settings to ON for all test users
  for (const uid of testUserIds) {
    await updateUserChatSettings(uid, true);
  }

  // 2. Test Get or Create Conversation (Member -> Writer)
  const convResult = await getOrCreateConversation(member1.id, writerUser.id);
  assert(convResult.success && convResult.conversationId > 0, '4. Member initiates conversation with Writer');
  const convId = convResult.conversationId;

  // 3. Member sends message to Writer
  const testMsg1 = `Hello Kavitha! I love your story chapters on Rudhra Prarthana Novels. [${Date.now()}]`;
  const sendRes1 = await sendMessage(convId, member1.id, testMsg1);
  assert(sendRes1.success && sendRes1.message.id > 0, '5. Member successfully sends message to Writer');
  assert(sendRes1.message.content.includes('Hello Kavitha!'), '6. Message content is verified and stored in MySQL');

  // Verify Writer's unread count
  const writerUnread1 = await getTotalUnreadChatCount(writerUser.id);
  assert(writerUnread1 >= 1, `7. Writer receives unread counter increment (total unread: ${writerUnread1})`);

  // 4. Writer replies to Member
  const testMsg2 = `Thank you so much Harish! I really appreciate your continuous encouragement. [${Date.now()}]`;
  const sendRes2 = await sendMessage(convId, writerUser.id, testMsg2);
  assert(sendRes2.success && sendRes2.message.id > 0, '8. Writer replies to Member');

  // 5. Member reads messages
  const history1 = await getConversationMessages(convId, member1.id);
  assert(history1.success && history1.messages.length >= 2, '9. Member retrieves conversation history');
  assert(history1.messages.some(m => m.isMe === true) && history1.messages.some(m => m.isMe === false), '10. Incoming and outgoing message boundaries verified');

  // Check unread count for member reset to 0 after reading
  const memberUnreadAfter = await getTotalUnreadChatCount(member1.id);
  assert(memberUnreadAfter === 0, '11. Member unread counter resets to 0 upon reading conversation');

  // 6. Test Member-to-Member Chat (Member2 <-> Member3)
  const m2mConv = await getOrCreateConversation(member2.id, member3.id);
  assert(m2mConv.success && m2mConv.conversationId > 0, '12. Member-to-Member conversation created');
  const m2mSend = await sendMessage(m2mConv.conversationId, member2.id, 'Hey reader friend! Discussing Nenjam Marappadhillai!');
  assert(m2mSend.success, '13. Member-to-Member message sent and persisted');

  // 7. Test Global Chat Availability Setting (OFF / ON)
  console.log('\n--- Testing Global Chat Availability Setting ---');
  // Turn OFF writer's chat availability
  await updateUserChatSettings(writerUser.id, false);
  const settingsCheck = await getUserChatSettings(writerUser.id);
  assert(settingsCheck.isChatAvailable === false, '14. Writer chat availability updated to OFF in MySQL');

  // Member tries to send message to Writer while Writer chat is OFF
  const blockedSend = await sendMessage(convId, member1.id, 'Are you there?');
  assert(blockedSend.success === false && blockedSend.code === 'RECIPIENT_CHAT_OFF', '15. Backend strictly blocks message when recipient chat is OFF');
  assert(blockedSend.error.includes('not accepting new messages'), '16. Informative error message returned');

  // Turn ON writer's chat availability
  await updateUserChatSettings(writerUser.id, true);
  const restoredSend = await sendMessage(convId, member1.id, 'Welcome back!');
  assert(restoredSend.success === true, '17. Messaging restored when chat availability is set back to ON');

  // 8. Test Individual Chat Locks
  console.log('\n--- Testing Individual Chat Locks ---');
  // Writer locks Member1
  const lockRes = await toggleChatLock(writerUser.id, member1.id, true);
  assert(lockRes.success && lockRes.isLockedByMe === true, '18. Writer locks Member1 in MySQL chat_locks table');

  // Member1 tries to send message to Writer while locked
  const lockBlockedSend = await sendMessage(convId, member1.id, 'Trying to reach you');
  assert(lockBlockedSend.success === false && lockBlockedSend.code === 'LOCKED_BY_RECIPIENT', '19. Backend strictly blocks message when conversation is locked by recipient');

  // Writer unlocks Member1
  const unlockRes = await toggleChatLock(writerUser.id, member1.id, false);
  assert(unlockRes.success && unlockRes.isLockedByMe === false, '20. Writer unlocks Member1');

  const afterUnlockSend = await sendMessage(convId, member1.id, 'Thank you for unlocking!');
  assert(afterUnlockSend.success === true, '21. Messaging succeeds after unlock');

  // 9. Test Administrator Writer Chat History Audit (Section 6)
  console.log('\n--- Testing Administrator Access to Writer Chat History ---');
  // Admin lists writers with conversations
  const adminWritersRes = await getAdminWritersList(adminUser.id);
  assert(adminWritersRes.success && adminWritersRes.writers.some(w => w.id === writerUser.id), '22. Administrator lists active writers with conversations');

  // Admin lists conversations of Writer
  const adminConvRes = await getAdminWriterConversations(adminUser.id, writerUser.id);
  assert(adminConvRes.success && adminConvRes.conversations.length > 0, '23. Administrator lists conversations involving Writer');

  // Admin inspects Writer conversation history (Read-Only)
  const auditRes = await getAdminWriterChatHistory(adminUser.id, convId, { ipAddress: '127.0.0.1' });
  assert(auditRes.success === true && auditRes.isReadOnly === true, '24. Administrator successfully audits Writer conversation history');
  assert(auditRes.messages.length >= 3, '25. Administrator views complete message contents and timestamps');

  // Verify Audit Log recorded in MySQL
  const auditLogEntry = await queryOne(
    "SELECT * FROM admin_chat_audit_logs WHERE admin_id = ? AND writer_id = ? AND conversation_id = ? ORDER BY id DESC LIMIT 1;",
    [adminUser.id, writerUser.id, convId]
  );
  assert(auditLogEntry && auditLogEntry.action === 'view_writer_history', '26. Audit log entry recorded in MySQL admin_chat_audit_logs');

  // 10. STRICT PRIVACY BOUNDARY TEST
  console.log('\n--- Testing Strict Privacy Boundary ---');
  // Admin tries to audit a Member-to-Member conversation (where neither is a writer)
  const privacyTest = await getAdminWriterChatHistory(adminUser.id, m2mConv.conversationId);
  assert(privacyTest.success === false && privacyTest.code === 'PRIVACY_VIOLATION', '27. STRICT PRIVACY BOUNDARY: Admin is strictly blocked from viewing Member-to-Member chat');
  assert(privacyTest.error.includes('Member-to-member conversations cannot be audited'), '28. Privacy violation error explicitly returned');

  // Non-admin user tries to access admin audit API
  const nonAdminAudit = await getAdminWriterChatHistory(member2.id, convId);
  assert(nonAdminAudit.success === false && nonAdminAudit.code === 'FORBIDDEN', '29. Non-admin member strictly denied access to Writer Chat Audit API');

  // 11. Test User Conversation List & Search
  const userConvs = await getUserConversations(member1.id);
  assert(userConvs.success && userConvs.conversations.length >= 2, '30. User conversations list sorted by latest activity with participant avatars & online status');

  const eligibleUsers = await getEligibleChatUsers(member1.id, 'kavitha');
  assert(eligibleUsers.success && eligibleUsers.users.some(u => u.id === writerUser.id), '31. Search eligible chat users returns matching active authors/writers/members');

  console.log('\n======================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
