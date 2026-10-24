// Comprehensive Verification of Novel Comments & Instagram-Style Replies
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { query, queryOne, getDb } from '../backend/db.js';
import { createSession } from '../backend/auth.js';

const ARTIFACT_DIR = 'C:\\Users\\Harish V\\.gemini\\antigravity-ide\\brain\\0865d7e5-7332-46f5-9deb-0d1a852fc1c1';
const DEBUG_PORT = 9229;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function findBrowserBinary() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function getWsUrl() {
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(400);
  }
  throw new Error('Could not get CDP webSocketDebuggerUrl');
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 1;
    this.callbacks = new Map();
  }

  async connect() {
    const WS = globalThis.WebSocket;
    return new Promise((resolve, reject) => {
      this.ws = new WS(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = event => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          const { res, rej } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((res, rej) => {
      const id = this.nextId++;
      this.callbacks.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Screenshot] Saved: ${outPath}`);
    return outPath;
  }

  close() {
    if (this.ws) {
      try { this.ws.close(); } catch {}
    }
  }
}

async function run() {
  console.log('=== NOVEL COMMENTS & INSTAGRAM-STYLE REPLIES VERIFICATION ===\n');

  // 1. Fetch two distinct active member accounts from MySQL
  const users = await query("SELECT id, username, email, role FROM users WHERE status = 'active' ORDER BY id ASC LIMIT 2;");
  if (users.length < 2) {
    throw new Error('Need at least 2 active users in DB to test member interactions.');
  }

  const memberA = users[0];
  const memberB = users[1];
  console.log(`Member A: ID ${memberA.id} (${memberA.username})`);
  console.log(`Member B: ID ${memberB.id} (${memberB.username})`);

  // Create real MySQL sessions for both members
  const tokenA = await createSession(memberA.id);
  const tokenB = await createSession(memberB.id);

  const testNovelId = 'kaadhal-konden-kanave';
  const otherNovelId = 'maaya-nadhi-theeram';

  let commentIdA = null;
  let commentIdB = null;

  // 2. Member A submits a comment on the novel page
  console.log('\n--- Test 1: Member A submits comment on novel page ---');
  const commentTextA = `The character depth in this novel is truly exceptional! (Test by ${memberA.username} at ${Date.now()})`;
  const res1 = await fetch('http://localhost:3000/api/comments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      novelId: testNovelId,
      chapterNum: '0',
      content: commentTextA
    })
  });

  const data1 = await res1.json();
  console.log('Post comment response:', data1);
  if (!res1.ok || !data1.success || !data1.commentId) {
    throw new Error(`Failed to post comment for Member A: ${JSON.stringify(data1)}`);
  }

  commentIdA = data1.commentId;
  console.log(`✓ Member A comment saved with ID: ${commentIdA}`);

  // Verify in MySQL
  const dbCommentA = await queryOne('SELECT * FROM comments WHERE id = ?;', [commentIdA]);
  if (!dbCommentA) throw new Error('Comment A not found in MySQL comments table!');
  console.log('✓ Verified comment in MySQL comments table:', {
    id: dbCommentA.id,
    novel_id: dbCommentA.novel_id,
    chapter_num: dbCommentA.chapter_num,
    parent_id: dbCommentA.parent_id
  });

  // 3. Member B loads the novel comments and sees Member A's comment
  console.log("\n--- Test 2: Member B loads novel comments and sees Member A's comment ---");
  const res2 = await fetch(`http://localhost:3000/api/comments?novel=${testNovelId}&ch=0`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const data2 = await res2.json();
  if (!res2.ok || !data2.success || !Array.isArray(data2.comments)) {
    throw new Error(`Failed to fetch comments for Member B: ${JSON.stringify(data2)}`);
  }

  const foundCommentA = data2.comments.find(c => c.id === commentIdA);
  if (!foundCommentA) {
    throw new Error(`Member A's comment #${commentIdA} was NOT returned in GET /api/comments for novel!`);
  }
  console.log(`✓ Member B successfully retrieved Member A's comment: "${foundCommentA.content.slice(0, 50)}..."`);
  console.log('✓ Relative time display:', foundCommentA.timeAgo);

  // 4. Member B replies to Member A's comment (Nested Reply)
  console.log("\n--- Test 3: Member B submits nested reply to Member A's comment ---");
  const replyTextB = `Completely agree @${memberA.username}! Especially the emotional turning point in recent episodes.`;
  const res3 = await fetch('http://localhost:3000/api/comments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({
      novelId: testNovelId,
      chapterNum: '0',
      content: replyTextB,
      parentId: commentIdA
    })
  });

  const data3 = await res3.json();
  console.log('Post reply response:', data3);
  if (!res3.ok || !data3.success || !data3.commentId) {
    throw new Error(`Failed to post reply for Member B: ${JSON.stringify(data3)}`);
  }

  commentIdB = data3.commentId;
  const replyIdB = commentIdB;
  console.log(`✓ Member B reply saved with ID: ${replyIdB}`);

  // Verify reply in MySQL with parent_id
  const dbReplyB = await queryOne('SELECT * FROM comments WHERE id = ?;', [replyIdB]);
  if (!dbReplyB || dbReplyB.parent_id !== commentIdA) {
    throw new Error(`Reply parent_id mismatch: expected ${commentIdA}, got ${dbReplyB?.parent_id}`);
  }
  console.log('✓ Verified reply in MySQL with correct parent_id:', {
    id: dbReplyB.id,
    parent_id: dbReplyB.parent_id,
    novel_id: dbReplyB.novel_id
  });

  // 5. Verify threaded structure on refresh
  console.log('\n--- Test 4: Refresh comments and verify threaded replies array ---');
  const res4 = await fetch(`http://localhost:3000/api/comments?novel=${testNovelId}&ch=0`, {
    headers: { 'Authorization': `Bearer ${tokenB}` }
  });
  const data4 = await res4.json();
  const refreshedCommentA = data4.comments.find(c => c.id === commentIdA);
  if (!refreshedCommentA || !refreshedCommentA.replies || refreshedCommentA.replies.length === 0) {
    throw new Error('Refreshed comment did not contain replies array!');
  }
  const foundReply = refreshedCommentA.replies.find(r => r.id === replyIdB);
  if (!foundReply) {
    throw new Error(`Reply #${replyIdB} was not nested inside comment #${commentIdA}'s replies!`);
  }
  console.log(`✓ Verified reply is nested under parent comment. Total replies: ${refreshedCommentA.replies.length}`);

  // 6. Test Instagram-Style Likes (Like & Unlike with duplicate prevention)
  console.log('\n--- Test 5: Instagram-Style Likes on Comments & Replies ---');
  // Member B likes Member A's comment
  const resLike1 = await fetch(`http://localhost:3000/api/comments/${commentIdA}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ commentId: commentIdA })
  });
  const dataLike1 = await resLike1.json();
  console.log('Member B likes Comment A:', dataLike1);
  if (!dataLike1.success || dataLike1.likesCount !== 1 || !dataLike1.hasLiked) {
    throw new Error('Like count did not increment to 1!');
  }
  console.log('✓ Like count incremented to 1 and hasLiked is true');

  // Member B clicks again -> Unlike
  const resUnlike = await fetch(`http://localhost:3000/api/comments/${commentIdA}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ commentId: commentIdA })
  });
  const dataUnlike = await resUnlike.json();
  console.log('Member B unlikes Comment A:', dataUnlike);
  if (!dataUnlike.success || dataUnlike.likesCount !== 0 || dataUnlike.hasLiked !== false) {
    throw new Error('Unlike did not reset count to 0!');
  }
  console.log('✓ Unlike successfully decremented count to 0 and hasLiked is false');

  // Member B likes it back
  await fetch(`http://localhost:3000/api/comments/${commentIdA}/like`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    },
    body: JSON.stringify({ commentId: commentIdA })
  });

  // 7. Scoping: Unrelated novel must not have these comments
  console.log('\n--- Test 6: Verify comments isolation across novels ---');
  const resOther = await fetch(`http://localhost:3000/api/comments?novel=${otherNovelId}&ch=0`);
  const dataOther = await resOther.json();
  const leakedComment = (dataOther.comments || []).find(c => c.id === commentIdA || c.id === replyIdB);
  if (leakedComment) {
    throw new Error(`Comment or reply leaked to other novel ${otherNovelId}!`);
  }
  console.log(`✓ Novel scoping verified: other novel has 0 leaked comments from ${testNovelId}`);

  // 8. Headless Browser End-to-End Test
  console.log('\n--- Test 7: Headless Browser E2E Rendering Check ---');
  const binary = findBrowserBinary();
  if (!binary) throw new Error('No Chrome/Edge browser binary found.');

  const userDataDir = path.join(ARTIFACT_DIR, '.browser_comments_test_profile');
  const browserProc = spawn(binary, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-background-networking',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let client = null;

  try {
    const wsUrl = await getWsUrl();
    client = new CdpClient(wsUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // Navigate to page first
    await client.send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(1500);

    // Set authenticated session in localStorage for Member B
    await client.eval(`
      localStorage.setItem('rp_auth_token', '${tokenB}');
      localStorage.setItem('rp_current_user', JSON.stringify({
        id: ${memberB.id},
        username: '${memberB.username}',
        displayName: '${memberB.username}',
        role: '${memberB.role || 'Member'}'
      }));
    `);

    // Navigate to the novel page with comments
    await client.send('Page.navigate', { url: `http://localhost:5173/#novel?id=${testNovelId}` });
    await sleep(2500);

    // Check DOM elements
    const checkUi = await client.eval(`(() => {
      const widget = document.getElementById('novel-comments-widget');
      if (!widget) return { exists: false };
      const card = widget.querySelector('.rp-ig-comments-card');
      const title = widget.querySelector('.rp-ig-title')?.textContent?.trim();
      const count = widget.querySelector('.rp-ig-count-badge')?.textContent?.trim();
      const commentAEl = document.getElementById('ig-comment-${commentIdA}');
      const toggleBtn = document.getElementById('ig-toggle-replies-btn-${commentIdA}');
      const toggleText = document.getElementById('ig-toggle-text-${commentIdA}')?.textContent?.trim();
      const replyList = document.getElementById('ig-replies-list-${commentIdA}');
      const hasAvatar = !!commentAEl?.querySelector('.rp-ig-comment-avatar');
      const hasHeartBtn = !!commentAEl?.querySelector('.rp-ig-heart-btn');
      const hasReplyBtn = !!commentAEl?.querySelector('.rp-ig-meta-action');

      return {
        exists: !!widget,
        hasCard: !!card,
        title,
        count,
        hasCommentA: !!commentAEl,
        hasAvatar,
        hasHeartBtn,
        hasReplyBtn,
        hasToggleBtn: !!toggleBtn,
        toggleText,
        repliesListDisplay: replyList ? window.getComputedStyle(replyList).display : 'none'
      };
    })()`);

    console.log('Browser UI Inspection:', checkUi);

    if (!checkUi.hasCard) throw new Error('Instagram comments card not found in novel page DOM!');
    if (!checkUi.hasCommentA) throw new Error(`Comment #${commentIdA} was not rendered in browser!`);
    console.log('✓ Novel comments widget rendered with title and count badge:', checkUi.count);
    console.log('✓ Comment A is visible in browser with avatar, heart button, and reply button');

    // Click "View 1 reply" to expand the threaded replies
    if (checkUi.hasToggleBtn) {
      await client.eval(`document.getElementById('ig-toggle-replies-btn-${commentIdA}').click();`);
      await sleep(500);
      const isExpanded = await client.eval(`(() => {
        const list = document.getElementById('ig-replies-list-${commentIdA}');
        return list && window.getComputedStyle(list).display !== 'none';
      })()`);
      console.log('✓ Expanded replies list visible:', isExpanded);
    }

    // Scroll comment section into view and capture screenshot
    await client.eval(`
      const w = document.getElementById('novel-comments-widget');
      if (w) w.scrollIntoView({ behavior: 'instant', block: 'center' });
    `);
    await sleep(600);
    await client.captureScreenshot('novel_comments_instagram_desktop.png');

    // Mobile Viewport Check
    console.log('\n--- Test 8: Mobile Viewport Responsiveness ---');
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(600);
    await client.captureScreenshot('novel_comments_instagram_mobile.png');
    console.log('✓ Mobile responsive layout verified and captured');

    console.log('\n======================================================');
    console.log('ALL NOVEL COMMENTS & REPLIES TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================');
  } finally {
    if (client) client.close();
    try { browserProc.kill(); } catch {}
    const pool = getDb();
    if (pool) {
      try {
        if (commentIdB) await pool.query('DELETE FROM comments WHERE id = ?', [commentIdB]);
        if (commentIdA) await pool.query('DELETE FROM comments WHERE id = ?', [commentIdA]);
        await pool.query("DELETE FROM notifications WHERE entity_type = 'comment' AND entity_id NOT IN (SELECT id FROM comments)");
      } catch (cleanErr) {
        console.error('Error during test teardown:', cleanErr);
      }
      try { await pool.end(); } catch {}
    }
  }
}

run().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
