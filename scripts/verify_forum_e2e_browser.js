// End-to-End Browser & MySQL Verification for Rudhra Prarthana Novels Forum
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createSession } from '../server/auth.js';
import { queryOne, query } from '../server/db.js';

const ARTIFACT_DIR = 'C:\\Users\\Harish V\\.gemini\\antigravity-ide\\brain\\0865d7e5-7332-46f5-9deb-0d1a852fc1c1';
const DEBUG_PORT = 9225;

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
    const r = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    return r.result?.value;
  }

  async screenshot(filename) {
    const r = await this.send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(r.data, 'base64'));
    console.log(`📸 Screenshot saved: ${filename}`);
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function runBrowserVerification() {
  const binary = findBrowserBinary();
  if (!binary) throw new Error('No Chrome or Edge browser found');

  const userDataDir = path.join(ARTIFACT_DIR, '.browser_forum_test_profile');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  console.log('🚀 Launching headless Chrome for Forum E2E tests...');
  const proc = spawn(binary, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--headless=new',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1400,900',
    'about:blank'
  ], { detached: false });

  proc.on('error', err => console.error('Browser process error:', err));

  try {
    const wsUrl = await getWsUrl();
    const cdp = new CdpClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('\n--- TEST 1: Default Landing Page is Forum ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
    await sleep(2000);

    const initialHash = await cdp.eval('window.location.hash');
    console.log(`👉 Initial route hash: "${initialHash}" (Expected: "#forum")`);
    if (initialHash !== '#forum') {
      throw new Error(`Default landing page is "${initialHash}", expected "#forum"`);
    }

    const navStates = await cdp.eval(`(() => {
      const forumLink = document.querySelector('a.nav-link[href="#forum"]');
      const homeLink = document.querySelector('a.nav-link[href="#home"]');
      return {
        forumActive: forumLink ? forumLink.classList.contains('active') : false,
        homeActive: homeLink ? homeLink.classList.contains('active') : false
      };
    })()`);
    console.log('👉 Nav Active States:', navStates);
    if (!navStates.forumActive || navStates.homeActive) {
      throw new Error('Forum nav link is not active or Home is active');
    }

    const categoriesCount = await cdp.eval('document.querySelectorAll(".forum-category-card").length');
    console.log(`👉 Rendered Forum Categories on Landing Page: ${categoriesCount}`);
    if (categoriesCount === 0) throw new Error('No forum categories rendered on landing page');

    await cdp.screenshot('forum_default_landing_page.png');

    console.log('\n--- TEST 2: Navigate to Home and Return to Forum ---');
    await cdp.eval('window.location.hash = "#home"');
    await sleep(1500);

    const homeHash = await cdp.eval('window.location.hash');
    const homeNavStates = await cdp.eval(`(() => {
      const forumLink = document.querySelector('a.nav-link[href="#forum"]');
      const homeLink = document.querySelector('a.nav-link[href="#home"]');
      return {
        forumActive: forumLink ? forumLink.classList.contains('active') : false,
        homeActive: homeLink ? homeLink.classList.contains('active') : false
      };
    })()`);
    console.log(`👉 Switched to Home route: "${homeHash}", Nav states:`, homeNavStates);
    if (homeHash !== '#home' || !homeNavStates.homeActive || homeNavStates.forumActive) {
      throw new Error('Failed to switch to Home route properly');
    }

    // Return to Forum
    await cdp.eval('window.location.hash = "#forum"');
    await sleep(1500);
    const returnHash = await cdp.eval('window.location.hash');
    console.log(`👉 Returned to Forum route: "${returnHash}"`);

    console.log('\n--- TEST 3: Forum Category Page & Threads List ---');
    // Open Ongoing Novels Category
    await cdp.eval('window.location.hash = "#forum?category=ongoing-novels"');
    await sleep(2000);

    const categoryTitle = await cdp.eval('document.querySelector(".section-title")?.textContent?.trim()');
    const topicCardsCount = await cdp.eval('document.querySelectorAll(".topic-card").length');
    const breadcrumbText = await cdp.eval('document.querySelector(".forum-breadcrumbs")?.textContent?.replace(/\\s+/g, " ")?.trim()');
    console.log(`👉 Category Title: "${categoryTitle}", Topics: ${topicCardsCount}`);
    console.log(`👉 Breadcrumbs: "${breadcrumbText}"`);

    if (!categoryTitle.includes('Ongoing Novels') || topicCardsCount === 0) {
      throw new Error('Failed to load category threads properly');
    }

    await cdp.screenshot('forum_category_threads_view.png');

    console.log('\n--- TEST 4: Topic Thread Details, OP, Replies & Reactions ---');
    // Open a specific topic thread
    await cdp.eval('window.location.hash = "#topic?id=topic-discussion-on-story-pacing-3295-3306"');
    await sleep(2000);

    const topicHeading = await cdp.eval('document.querySelector("h1")?.textContent?.trim()');
    const postCardsCount = await cdp.eval('document.querySelectorAll(".topic-post-card").length');
    const topicBreadcrumbs = await cdp.eval('document.querySelector(".forum-breadcrumbs")?.textContent?.replace(/\\s+/g, " ")?.trim()');
    console.log(`👉 Topic Heading: "${topicHeading}"`);
    console.log(`👉 Total Post Cards Rendered: ${postCardsCount}`);
    console.log(`👉 Breadcrumbs: "${topicBreadcrumbs}"`);

    if (!topicHeading || postCardsCount === 0) {
      throw new Error('Failed to render topic details');
    }

    // Check reaction buttons rendered on OP and replies
    const reactionButtonsCount = await cdp.eval('document.querySelectorAll(".reaction-btn").length');
    console.log(`👉 Total Reaction Buttons Rendered: ${reactionButtonsCount}`);
    if (reactionButtonsCount === 0) {
      throw new Error('No emoji reaction buttons rendered');
    }

    await cdp.screenshot('forum_topic_thread_view.png');

    console.log('\n--- TEST 5: Authenticated User Reply & Emoji Reaction ---');
    // Find an existing member user in MySQL to authenticate
    const memberUser = await queryOne('SELECT u.id, u.username, u.email, u.role FROM users u LIMIT 1');
    console.log('👉 Testing with user:', memberUser.username, `(${memberUser.email})`);

    const token = await createSession(memberUser.id);

    // Inject token into localStorage and trigger auth update
    await cdp.eval(`(() => {
      localStorage.setItem('rp_auth_token', '${token}');
      window.IS_LOGGED_IN = true;
      window.CURRENT_USER = ${JSON.stringify(memberUser)};
      if (typeof window.renderTopicView === 'function') {
        window.renderTopicView();
      }
    })()`);
    await sleep(1500);

    // Verify reply input is now available for authenticated user
    const hasReplyInput = await cdp.eval('Boolean(document.getElementById("topic-reply-input"))');
    console.log(`👉 Reply Box available for authenticated user: ${hasReplyInput}`);
    if (!hasReplyInput) throw new Error('Reply box missing for authenticated user');

    // Submit a live reply
    const testReplyContent = `Live automated E2E reply test [${Date.now()}]`;
    const replyResult = await cdp.eval(`(async () => {
      const input = document.getElementById('topic-reply-input');
      input.value = ${JSON.stringify(testReplyContent)};
      try {
        await window.submitForumReply('topic-discussion-on-story-pacing-3295-3306');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    })()`);
    console.log('👉 submitForumReply result:', replyResult);
    await sleep(2000);

    // Verify reply persisted in MySQL
    const savedPost = await queryOne('SELECT id, topic_id, user_id, content FROM forum_posts WHERE topic_id = ? AND content = ?', [
      'topic-discussion-on-story-pacing-3295-3306',
      testReplyContent
    ]);
    console.log('👉 MySQL verified saved post:', savedPost ? `Post #${savedPost.id}` : 'NOT FOUND');
    if (!savedPost) throw new Error('Reply was not persisted to MySQL');

    // Test Emoji Reaction on this newly created post
    console.log('👉 Testing toggleReaction with ❤️ on post #' + savedPost.id);
    await cdp.eval(`window.toggleReaction('topic-discussion-on-story-pacing-3295-3306', ${savedPost.id}, '❤️')`);
    await sleep(1500);

    // Verify reaction in MySQL
    const dbReaction = await queryOne('SELECT target_type, target_id, user_id, emoji FROM reactions WHERE target_type = "forum_post" AND target_id = ? AND user_id = ?', [
      String(savedPost.id),
      memberUser.id
    ]);
    console.log('👉 MySQL verified saved reaction:', dbReaction);
    if (!dbReaction || dbReaction.emoji !== '❤️') {
      throw new Error('Reaction was not persisted to MySQL reactions table');
    }

    // Toggle reaction again to remove it
    console.log('👉 Testing reaction toggle removal...');
    await cdp.eval(`window.toggleReaction('topic-discussion-on-story-pacing-3295-3306', ${savedPost.id}, '❤️')`);
    await sleep(1500);

    const dbReactionRemoved = await queryOne('SELECT target_type, target_id, user_id, emoji FROM reactions WHERE target_type = "forum_post" AND target_id = ? AND user_id = ?', [
      String(savedPost.id),
      memberUser.id
    ]);
    console.log('👉 MySQL reaction after toggle removal:', dbReactionRemoved ? 'STILL EXISTS' : 'REMOVED ✅');
    if (dbReactionRemoved) throw new Error('Reaction toggle removal failed');

    // Clean up test post from DB so database remains clean
    await query('DELETE FROM forum_posts WHERE id = ?', [savedPost.id]);
    await query('UPDATE forum_topics SET replies_count = replies_count - 1 WHERE id = ?', ['topic-discussion-on-story-pacing-3295-3306']);
    console.log('🧹 Cleaned up test post from MySQL');

    await cdp.screenshot('forum_final_verified_state.png');

    console.log('\n🎉 ALL 5 BROWSER & MYSQL VERIFICATION SUITES PASSED FLAWLESSLY!');

    cdp.close();
  } finally {
    proc.kill();
  }
}

runBrowserVerification().catch(err => {
  console.error('❌ Browser verification error:', err);
  process.exit(1);
});
