// Automated End-to-End Verification: WhatsApp-like Chat Features
// Tests images, voice notes, emoji text, editing, unsending, locks, timestamps, and read status

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { query, queryOne } from '../backend/db.js';

const API_BASE = 'http://localhost:3000/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method, headers }, (res) => {
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
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    failedTests++;
  }
}

async function runTests() {
  console.log('=== STARTING E2E VERIFICATION: WHATSAPP-LIKE CHAT FEATURES ===\n');

  try {
    // 1. Setup test users and tokens
    console.log('--- Test Suite 1: User & Session Setup ---');
    const adminUser = await queryOne("SELECT id, username, email FROM users WHERE role = 'admin' LIMIT 1;");
    const reader1 = await queryOne("SELECT id, username, email FROM users WHERE role = 'member' LIMIT 1;");
    const writerUser = await queryOne("SELECT id, username, email FROM users WHERE role = 'writer' OR role = 'author' LIMIT 1;");

    assert(adminUser && reader1 && writerUser, 'Found admin, reader, and writer in database', `admin:${adminUser?.id}, reader:${reader1?.id}, writer:${writerUser?.id}`);

    // Create session tokens
    const adminToken = 'test-token-admin-' + Date.now();
    const readerToken = 'test-token-reader-' + Date.now();
    const writerToken = 'test-token-writer-' + Date.now();

    await query(`
      INSERT INTO sessions (user_id, token, expires_at, session_type)
      VALUES 
        (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 'author'),
        (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 'reader'),
        (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), 'author');
    `, [adminUser.id, adminToken, reader1.id, readerToken, writerUser.id, writerToken]);

    assert(true, 'Test session tokens provisioned successfully');

    // 2. Test Conversations Listing & Error Robustness
    console.log('\n--- Test Suite 2: Diagnostics & Null Safety ---');
    const convListRes = await request('GET', '/chat/conversations', null, readerToken);
    assert(convListRes.status === 200 && convListRes.data.success, 'GET /chat/conversations returns 200');
    assert(Array.isArray(convListRes.data.conversations), 'Conversations list is an array');

    // Check that every conversation has non-undefined otherUser and other_user
    let allHaveOtherUser = true;
    for (const c of convListRes.data.conversations) {
      if (!c.otherUser || !c.other_user || typeof c.otherUser !== 'object') {
        allHaveOtherUser = false;
        break;
      }
    }
    assert(allHaveOtherUser, 'All conversations safely include otherUser and other_user objects');

    // 3. Create or Get Conversation between Reader and Writer
    console.log('\n--- Test Suite 3: Conversation Creation ---');
    const createConvRes = await request('POST', '/chat/conversations', { targetUserId: writerUser.id }, readerToken);
    assert(createConvRes.status === 200 && createConvRes.data.success, 'Reader can initiate or get conversation with Writer');
    const convId = createConvRes.data.conversationId || createConvRes.data.id;
    assert(convId > 0, `Conversation ID established: ${convId}`);

    // 4. Test Image Upload & Attachment Sending
    console.log('\n--- Test Suite 4: Photo / Image Attachments ---');
    // 1x1 transparent PNG base64
    const tinyPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const uploadImageRes = await request('POST', '/chat/upload', {
      file: tinyPngBase64,
      fileType: 'image'
    }, readerToken);

    assert(uploadImageRes.status === 200 && uploadImageRes.data.success, 'Image upload succeeds', uploadImageRes.data?.url);
    assert(uploadImageRes.data.url?.startsWith('/uploads/chat/chat-image-'), 'Uploaded image path is in /uploads/chat/');

    // Verify file exists on disk
    const diskPath = path.resolve('backend', uploadImageRes.data.url.replace(/^\//, ''));
    assert(fs.existsSync(diskPath), 'Image file exists on backend disk', diskPath);

    // Send Image Message
    const sendImageRes = await request('POST', `/chat/conversations/${convId}/messages`, {
      messageType: 'image',
      attachmentUrl: uploadImageRes.data.url,
      content: 'Check out this novel cover sketch! 🎨'
    }, readerToken);

    assert(sendImageRes.status === 201 && sendImageRes.data.success, 'Image message sent successfully');
    const imageMsgId = sendImageRes.data.message?.id;
    assert(imageMsgId > 0, `Image Message ID: ${imageMsgId}`);
    assert(sendImageRes.data.message?.messageType === 'image', 'Message type is image');
    assert(sendImageRes.data.message?.attachmentUrl === uploadImageRes.data.url, 'Attachment URL matched');

    // 5. Test Voice Message Upload & Playback Metadata
    console.log('\n--- Test Suite 5: Voice Notes Recording & Playback ---');
    // Sample dummy webm audio base64 header
    const dummyWebmAudioBase64 = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAHTEU2bdLmaQHAnIEuAZwEAAAAAAAEVUYYBAYCQ0sCAB0Oaz54BA0KChYECAIWFmAEAAEEVUYEBgJDSwIAHQ5rPngEDQoKFgQIARYWYBA==';

    const uploadVoiceRes = await request('POST', '/chat/upload', {
      file: dummyWebmAudioBase64,
      fileType: 'audio',
      meta: { duration: 8 }
    }, readerToken);

    assert(uploadVoiceRes.status === 200 && uploadVoiceRes.data.success, 'Voice note upload succeeds', uploadVoiceRes.data?.url);
    assert(uploadVoiceRes.data.url?.startsWith('/uploads/chat/chat-audio-'), 'Uploaded voice file path is in /uploads/chat/');

    // Send Voice Message
    const sendVoiceRes = await request('POST', `/chat/conversations/${convId}/messages`, {
      messageType: 'audio',
      attachmentUrl: uploadVoiceRes.data.url,
      attachmentMeta: { duration: 8 }
    }, readerToken);

    assert(sendVoiceRes.status === 201 && sendVoiceRes.data.success, 'Voice message sent successfully');
    const voiceMsgId = sendVoiceRes.data.message?.id;
    assert(voiceMsgId > 0, `Voice Message ID: ${voiceMsgId}`);
    assert(sendVoiceRes.data.message?.messageType === 'audio', 'Message type is audio');
    assert(sendVoiceRes.data.message?.attachmentMeta?.duration === 8, 'Voice duration metadata preserved');

    // 6. Test Text Message with Emojis & Message Editing
    console.log('\n--- Test Suite 6: Text, Emojis & Message Editing ---');
    const sendTextRes = await request('POST', `/chat/conversations/${convId}/messages`, {
      messageType: 'text',
      content: 'Hello author, I really loved Chapter 14! 💖✨📚'
    }, readerToken);

    assert(sendTextRes.status === 201 && sendTextRes.data.success, 'Text message with emojis sent successfully');
    const textMsgId = sendTextRes.data.message?.id;

    // Edit message by sender
    const editRes = await request('PUT', `/chat/messages/${textMsgId}`, {
      content: 'Hello author, I really loved Chapter 14 and Chapter 15! 💖✨📚 (Updated)'
    }, readerToken);

    assert(editRes.status === 200 && editRes.data.success, 'Sender can edit their own message');
    assert(editRes.data.message?.isEdited === true, 'Message marked as isEdited');

    // Check unauthorized edit by another user
    const unauthEditRes = await request('PUT', `/chat/messages/${textMsgId}`, {
      content: 'Hacked edit attempt!'
    }, writerToken);

    assert(unauthEditRes.status === 403, 'Unauthorized user cannot edit someone else message');

    // 7. Test Message Unsending / Deleting
    console.log('\n--- Test Suite 7: Message Unsending / Deletion ---');
    // Reader sends a temporary message to delete
    const tempMsgRes = await request('POST', `/chat/conversations/${convId}/messages`, {
      content: 'This message will be unsent.'
    }, readerToken);
    const tempMsgId = tempMsgRes.data.message?.id;

    const unsendRes = await request('DELETE', `/chat/messages/${tempMsgId}`, null, readerToken);
    assert(unsendRes.status === 200 && unsendRes.data.success, 'Sender can unsend their message');

    // Verify when fetching messages, unsend message is marked deleted
    const fetchMsgsRes = await request('GET', `/chat/conversations/${convId}`, null, writerToken);
    assert(fetchMsgsRes.status === 200 && fetchMsgsRes.data.success, 'Recipient fetches conversation');
    const deletedInList = fetchMsgsRes.data.messages.find(m => m.id === tempMsgId);
    assert(deletedInList && deletedInList.isDeleted === true, 'Deleted message is marked isDeleted: true');
    assert(deletedInList?.content === 'This message was deleted', 'Deleted message content is masked');

    // 8. Test Read Receipts & Timestamps
    console.log('\n--- Test Suite 8: Delivery & Read Status ---');
    // When writer fetched conversation messages above, it automatically marks reader's incoming messages as read
    const fetchReaderMsgs = await request('GET', `/chat/conversations/${convId}`, null, readerToken);
    const textMsgAfterRead = fetchReaderMsgs.data.messages.find(m => m.id === textMsgId);
    assert(textMsgAfterRead?.isRead === true, 'Incoming messages are marked read upon recipient viewing');
    assert(Boolean(textMsgAfterRead?.readAt), 'readAt timestamp populated');

    // 9. Test Lock / Unlock Chat Controls
    console.log('\n--- Test Suite 9: Lock / Unlock Chat Controls ---');
    // User locks target user
    const lockRes = await request('POST', '/chat/lock', {
      targetUserId: writerUser.id,
      action: 'lock'
    }, readerToken);
    assert(lockRes.status === 200 && lockRes.data.success && lockRes.data.isLockedByMe, 'Reader can lock chat with Writer');

    // Attempt to send message while locked
    const lockedSendRes = await request('POST', `/chat/conversations/${convId}/messages`, {
      content: 'This should fail because it is locked'
    }, readerToken);
    assert(lockedSendRes.status === 400 && !lockedSendRes.data.success, 'Messaging blocked when chat is locked by user');

    // Unlock chat
    const unlockRes = await request('POST', '/chat/lock', {
      targetUserId: writerUser.id,
      action: 'unlock'
    }, readerToken);
    assert(unlockRes.status === 200 && unlockRes.data.success && !unlockRes.data.isLockedByMe, 'Reader can unlock chat');

    // Test conversation-level lock
    const convLockRes = await request('POST', `/chat/conversations/${convId}/lock`, {
      action: 'lock',
      reason: 'Administrative temporary hold'
    }, adminToken);
    assert(convLockRes.status === 200 && convLockRes.data.isLocked === true, 'Admin can lock entire conversation');

    // Attempt to send message while conversation is locked
    const convLockedSendRes = await request('POST', `/chat/conversations/${convId}/messages`, {
      content: 'This should fail because conversation is locked'
    }, readerToken);
    assert(convLockedSendRes.status === 400 && convLockedSendRes.data.code === 'CONVERSATION_LOCKED', 'Messaging blocked when conversation is locked');

    // Restore / unlock conversation
    const convRestoreRes = await request('POST', `/chat/conversations/${convId}/lock`, {
      action: 'unlock'
    }, adminToken);
    assert(convRestoreRes.status === 200 && convRestoreRes.data.isLocked === false, 'Admin can restore/unlock conversation');

    // Verify messaging works again
    const restoredSendRes = await request('POST', `/chat/conversations/${convId}/messages`, {
      content: 'Chat is restored and working great! 🎉'
    }, readerToken);
    assert(restoredSendRes.status === 201 && restoredSendRes.data.success, 'Messaging restored after unlocking');

    // Cleanup test sessions
    await query('DELETE FROM sessions WHERE token IN (?, ?, ?);', [adminToken, readerToken, writerToken]);
    console.log('\n--- Test cleanup completed ---');

    console.log(`\n========================================`);
    console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    console.log(`========================================\n`);

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
