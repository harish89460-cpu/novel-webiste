// Verification Script: Real-Time Messaging & Inline Chat Images
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { query, queryOne } from '../backend/db.js';

const LOCAL_API = 'http://localhost:3000';
const TUNNEL_API = 'https://association-consecutive-rip-incident.trycloudflare.com';

function httpRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        let parsed = null;
        try {
          parsed = JSON.parse(buf.toString('utf8'));
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
          raw: buf
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(cond, title, details = '') {
  if (cond) {
    console.log(`  ✓ [PASS] ${title}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${title} ${details ? '— ' + details : ''}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== REAL-TIME MESSAGING & INLINE IMAGE DELIVERY TEST ===\n');

  let adminUser = null;
  let partnerUser = null;
  let adminToken = null;
  let partnerToken = null;
  let testUploadedFiles = [];
  let testMessageIds = [];

  try {
    // 1. Verify Users & Create Test Sessions
    console.log('--- Step 1: User & Session Preparation ---');
    adminUser = await queryOne("SELECT id, username, email FROM users WHERE role = 'admin' LIMIT 1;");
    partnerUser = await queryOne("SELECT id, username, email FROM users WHERE id != ? LIMIT 1;", [adminUser?.id || 0]);

    assert(adminUser && partnerUser, 'Found Admin and partner user in MySQL', `Admin ID: ${adminUser?.id}, Partner ID: ${partnerUser?.id}`);

    adminToken = 'test-realtime-admin-' + Date.now();
    partnerToken = 'test-realtime-partner-' + Date.now();

    await query(`
      INSERT INTO sessions (user_id, token, expires_at, session_type)
      VALUES 
        (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), 'author'),
        (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR), 'reader');
    `, [adminUser.id, adminToken, partnerUser.id, partnerToken]);

    assert(true, 'Temporary test sessions established in database');

    // 2. Test Backend Health on Tunnel
    console.log('\n--- Step 2: Cloudflare Tunnel Public Connectivity ---');
    const tunnelHealth = await httpRequest(`${TUNNEL_API}/api/health`);
    assert(tunnelHealth.status === 200 && tunnelHealth.data?.database === 'mysql', 'Cloudflare tunnel serves /api/health with mysql status');

    // 3. Test Image Upload to /api/chat/upload
    console.log('\n--- Step 3: Image Upload & Inline Asset Resolution ---');
    // 2x2 green PNG
    const testPngBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M9Qz8DAwMTAwAAACf8B9aV/3BMAAAAASUVORK5CYII=';

    const uploadRes = await httpRequest(`${TUNNEL_API}/api/chat/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: {
        file: testPngBase64,
        fileType: 'image'
      }
    });

    assert(uploadRes.status === 200 && uploadRes.data?.success, 'POST /api/chat/upload succeeds via tunnel', JSON.stringify(uploadRes.data));
    const uploadedUrl = uploadRes.data?.url;
    assert(uploadedUrl && uploadedUrl.startsWith('/uploads/chat/'), 'Upload returned valid relative chat URL', uploadedUrl);

    // Verify file exists on backend disk
    const diskPath = path.resolve('backend', uploadedUrl.replace(/^\//, ''));
    testUploadedFiles.push(diskPath);
    assert(fs.existsSync(diskPath), 'Uploaded image saved on local disk', diskPath);

    // 4. Test Fetching Image Asset via Public Tunnel with CORS
    console.log('\n--- Step 4: Asset HTTP Retrieval & CORS Verification ---');
    const assetRes = await httpRequest(`${TUNNEL_API}${uploadedUrl}`);
    assert(assetRes.status === 200, 'HTTP GET on uploaded asset returns 200');
    assert(assetRes.headers['content-type']?.includes('image/png'), 'Content-Type header is image/png', assetRes.headers['content-type']);
    assert(assetRes.headers['access-control-allow-origin'] === '*', 'Access-Control-Allow-Origin header is present (*)', assetRes.headers['access-control-allow-origin']);
    assert(assetRes.raw.length > 0, `Asset binary received (${assetRes.raw.length} bytes)`);

    // 5. Establish Conversation and Send Image Message
    console.log('\n--- Step 5: Send Image Message in Conversation ---');
    const startConvRes = await httpRequest(`${TUNNEL_API}/api/chat/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: { targetUserId: partnerUser.id }
    });

    assert(startConvRes.status === 200 && startConvRes.data?.success, 'Conversation opened/retrieved between Admin and partner');
    const convId = startConvRes.data?.conversationId || startConvRes.data?.id;
    assert(convId > 0, `Conversation ID is ${convId}`);

    const sendMsgRes = await httpRequest(`${TUNNEL_API}/api/chat/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: {
        messageType: 'image',
        attachmentUrl: uploadedUrl,
        content: 'Verification photo test for inline chat display'
      }
    });

    assert(sendMsgRes.status === 201 && sendMsgRes.data?.success, 'Image message posted successfully');
    const sentMsg = sendMsgRes.data?.message;
    if (sentMsg?.id) testMessageIds.push(sentMsg.id);
    assert(sentMsg?.message_type === 'image' || sentMsg?.messageType === 'image', 'Message type is image');
    assert((sentMsg?.attachment_url || sentMsg?.attachmentUrl) === uploadedUrl, 'Attachment URL matches uploaded file URL');

    // 6. Partner Retrieves Conversation (Simulating Real-Time Active Sync)
    console.log('\n--- Step 6: Recipient Retrieval & Sync (Simulating Active Polling) ---');
    const convDataRes = await httpRequest(`${TUNNEL_API}/api/chat/conversations/${convId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${partnerToken}` }
    });

    assert(convDataRes.status === 200 && convDataRes.data?.success, 'Recipient fetches conversation messages');
    const receivedMessages = convDataRes.data?.messages || [];
    const targetMsg = receivedMessages.find(m => m.id === sentMsg?.id);
    assert(Boolean(targetMsg), 'Image message is present in recipient message history');
    assert(targetMsg?.attachmentUrl === uploadedUrl || targetMsg?.attachment_url === uploadedUrl, 'Recipient message includes attachmentUrl');

    // 7. Verify Real-time Polling Delivery of Successive Messages Without Reload
    console.log('\n--- Step 7: Real-Time Polling Dynamic Arrival Test ---');
    const followUpMsgRes = await httpRequest(`${TUNNEL_API}/api/chat/conversations/${convId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: {
        messageType: 'text',
        content: 'Dynamic real-time follow-up message check'
      }
    });

    const followUpId = followUpMsgRes.data?.message?.id;
    if (followUpId) testMessageIds.push(followUpId);
    assert(followUpMsgRes.status === 201, 'Admin sent follow-up message');

    // Simulate next poller tick for partner
    const pollSyncRes = await httpRequest(`${TUNNEL_API}/api/chat/conversations/${convId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${partnerToken}` }
    });
    const polledMessages = pollSyncRes.data?.messages || [];
    const foundFollowUp = polledMessages.find(m => m.id === followUpId);
    assert(Boolean(foundFollowUp), 'Recipient poller immediately retrieved new message without manual page reload');

    // 8. Verify Unread Badge Logic
    console.log('\n--- Step 8: Unread Badge Sync Test ---');
    const unreadRes = await httpRequest(`${TUNNEL_API}/api/chat/unread-count`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${partnerToken}` }
    });
    assert(unreadRes.status === 200 && unreadRes.data?.totalUnread !== undefined, 'Unread badge endpoint returns valid numeric count', `totalUnread: ${unreadRes.data?.totalUnread}`);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    // Cleanup test records
    console.log('\n--- Cleanup: Purging Temporary Test Records & Files ---');
    try {
      if (adminToken || partnerToken) {
        await query('DELETE FROM sessions WHERE token IN (?, ?);', [adminToken || '', partnerToken || '']);
        console.log('  ✓ Cleaned up test sessions');
      }
      if (testMessageIds.length > 0) {
        const placeholders = testMessageIds.map(() => '?').join(',');
        await query(`DELETE FROM messages WHERE id IN (${placeholders});`, testMessageIds);
        console.log(`  ✓ Cleaned up ${testMessageIds.length} test messages`);
      }
      for (const f of testUploadedFiles) {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
          console.log(`  ✓ Removed test upload file: ${path.basename(f)}`);
        }
      }
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
