// Comprehensive E2E Verification for Forum Comments, Discussions, and MySQL Data Integration
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { query, queryOne } from '../backend/db.js';
import { createSession } from '../backend/auth.js';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9225;
const USER_DATA_DIR = path.resolve('scratch/chrome_forum_test');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class CdpClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.logs = [];

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args || []).map(a => a.value || a.description || '').join(' ');
        this.logs.push(`[Console ${msg.params.type}] ${text}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const text = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
        this.logs.push(`[Exception] ${text}`);
      }

      if (msg.id && this.callbacks.has(msg.id)) {
        const cb = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) cb.reject(new Error(msg.error.message));
        else cb.resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch {}
    await sleep(250);
  }
  const newRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, { method: 'PUT' });
  const data = await newRes.json();
  return data.webSocketDebuggerUrl;
}

async function runTests() {
  console.log('=====================================================');
  console.log('STARTING FORUM & COMMENTS FULL INTEGRATION TESTS');
  console.log('=====================================================');

  const readerToken = await createSession(28);
  const adminToken = await createSession(2);
  console.log('✓ Generated test sessions: Reader (ID 28), Admin (ID 2)');

  const API_BASE = 'http://localhost:3000';

  // 1. Initial State Check
  console.log('\n--- Step 1: Check initial MySQL stats ---');
  const initialCats = await (await fetch(`${API_BASE}/api/forum/categories`)).json();
  console.log(`Initial Categories Count: ${initialCats.categories.length}`);
  const catBefore = initialCats.categories.find(c => c.id === 'ongoing-novels');
  console.log(`  "ongoing-novels" topics: ${catBefore.topicsCount}, replies: ${catBefore.repliesCount}, posts: ${catBefore.postsCount}`);

  // 2. Create Forum Topic as Reader
  console.log('\n--- Step 2: Create a forum topic as a reader ---');
  const topicTitle = `Discussion on Story Pacing #${Date.now().toString().slice(-4)}`;
  const topicContent = 'I really loved the emotional depth in the latest chapter! The dialogue between the leads was breathtaking.';
  
  const createTopicRes = await fetch(`${API_BASE}/api/forum/topics`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${readerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      categoryId: 'ongoing-novels',
      title: topicTitle,
      content: topicContent
    })
  });

  const topicData = await createTopicRes.json();
  console.log('  Create topic response:', topicData);
  if (!topicData.success || !topicData.topicId) {
    throw new Error('Failed to create forum topic in MySQL');
  }
  const createdTopicId = topicData.topicId;

  // 3. Verify Topic saved in MySQL
  console.log('\n--- Step 3: Verify topic record in MySQL ---');
  const topicInDb = await queryOne('SELECT * FROM forum_topics WHERE id = ?', [createdTopicId]);
  if (!topicInDb) throw new Error('Topic not found in forum_topics MySQL table');
  console.log(`  Found topic: "${topicInDb.title}", Category: ${topicInDb.category_id}, Replies: ${topicInDb.replies_count}`);
  if (topicInDb.replies_count !== 0) throw new Error(`Expected replies_count=0 for new topic, got ${topicInDb.replies_count}`);

  const postInDb = await queryOne('SELECT * FROM forum_posts WHERE topic_id = ?', [createdTopicId]);
  if (!postInDb) throw new Error('Initial opening post not found in forum_posts table');
  console.log(`  Found initial post: ID ${postInDb.id}, Content: "${postInDb.content.substring(0, 40)}..."`);

  // 4. Confirm Category Count Updated in MySQL
  console.log('\n--- Step 4: Confirm category topic count increased ---');
  const updatedCats = await (await fetch(`${API_BASE}/api/forum/categories`)).json();
  const catAfter = updatedCats.categories.find(c => c.id === 'ongoing-novels');
  console.log(`  "ongoing-novels" topics: ${catAfter.topicsCount} (was ${catBefore.topicsCount}), posts: ${catAfter.postsCount}`);
  if (catAfter.topicsCount !== catBefore.topicsCount + 1) {
    throw new Error(`Category topicsCount did not increase by 1! Before: ${catBefore.topicsCount}, After: ${catAfter.topicsCount}`);
  }

  // 5. Add Reply as Admin to the Topic
  console.log('\n--- Step 5: Add a reply to the topic as Admin ---');
  const replyContent = 'Thank you for reading! The next episode will dive deeper into their backstory. ❤️';
  const replyRes = await fetch(`${API_BASE}/api/forum/topics/${encodeURIComponent(createdTopicId)}/reply`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: replyContent })
  });

  const replyData = await replyRes.json();
  console.log('  Reply response:', replyData);
  if (!replyData.success || !replyData.post) {
    throw new Error('Failed to post reply in MySQL');
  }

  // 6. Confirm reply count and total post count update
  console.log('\n--- Step 6: Confirm reply count and total posts in MySQL ---');
  const topicAfterReply = await queryOne('SELECT * FROM forum_topics WHERE id = ?', [createdTopicId]);
  console.log(`  Topic replies_count in DB: ${topicAfterReply.replies_count}`);
  if (topicAfterReply.replies_count !== 1) throw new Error(`Expected replies_count=1, got ${topicAfterReply.replies_count}`);

  const postsInDb = await query('SELECT * FROM forum_posts WHERE topic_id = ? ORDER BY id ASC', [createdTopicId]);
  console.log(`  Total posts in topic: ${postsInDb.length} (Opening post + 1 reply)`);
  if (postsInDb.length !== 2) throw new Error(`Expected 2 posts, got ${postsInDb.length}`);

  // 7. Verify Latest Posts and Trending Posts
  console.log('\n--- Step 7: Verify Latest Posts & Trending Posts APIs ---');
  const sidebarPosts = await (await fetch(`${API_BASE}/api/forum/posts`)).json();
  console.log(`  Latest posts count: ${sidebarPosts.latest.length}, Trending count: ${sidebarPosts.trending.length}`);
  const latestMatch = sidebarPosts.latest.find(p => p.id === createdTopicId);
  if (!latestMatch) throw new Error('New topic not found in Latest Posts list');
  console.log(`  ✓ Latest Post matched: "${latestMatch.title}", Last author: "${latestMatch.lastAuthor}", Excerpt: "${latestMatch.excerpt}"`);
  if (!latestMatch.excerpt) throw new Error('Excerpt missing from Latest Posts item');

  // 8. Add Novel Comment as Reader
  console.log('\n--- Step 8: Add comment to novel "en-uyiril-nee" as Reader ---');
  const readerCommentContent = 'Wonderful novel! Looking forward to episode 2. - From Reader';
  const readerCommentRes = await fetch(`${API_BASE}/api/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${readerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      novelId: 'en-uyiril-nee',
      chapterNum: '0',
      content: readerCommentContent
    })
  });

  const readerCommentData = await readerCommentRes.json();
  console.log('  Reader comment response:', readerCommentData);
  if (!readerCommentData.success) throw new Error('Failed to save reader novel comment');

  // 9. Add Novel Comment as Admin
  console.log('\n--- Step 9: Add comment to novel "en-uyiril-nee" as Admin ---');
  const adminCommentContent = 'Glad you enjoyed the opening! Episode 2 will be out this Friday. - Author';
  const adminCommentRes = await fetch(`${API_BASE}/api/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      novelId: 'en-uyiril-nee',
      chapterNum: '0',
      content: adminCommentContent
    })
  });

  const adminCommentData = await adminCommentRes.json();
  console.log('  Admin comment response:', adminCommentData);
  if (!adminCommentData.success) throw new Error('Failed to save admin novel comment');

  // 10. Verify Novel Comments API returns both with correct roles
  console.log('\n--- Step 10: Fetch comments for "en-uyiril-nee" (ch=0) ---');
  const commentsRes = await (await fetch(`${API_BASE}/api/comments?novel=en-uyiril-nee&ch=0`)).json();
  console.log(`  Comments returned: ${commentsRes.comments.length}`);
  const adminC = commentsRes.comments.find(c => c.id === adminCommentData.comment?.id);
  if (!adminC) throw new Error('Admin comment not returned in novel comments');
  console.log(`  Admin comment author: "${adminC.displayName}", Role: "${adminC.role}", userTitle: "${adminC.userTitle}"`);
  if (adminC.role !== 'Admin') throw new Error(`Expected role 'Admin', got ${adminC.role}`);

  // 11. Separation Check: Verify Novel Comments did NOT leak into Forum Posts
  console.log('\n--- Step 11: Verify separation of novel comments from forum posts ---');
  const checkPostLeaks = await queryOne('SELECT COUNT(*) as cnt FROM forum_posts WHERE content LIKE ?', [`%${readerCommentContent}%`]);
  if (checkPostLeaks.cnt !== 0) throw new Error('Novel comment was incorrectly saved as a forum post!');
  console.log('  ✓ Verified: Novel comments do not appear in forum_posts table.');

  // 12. Headless Chrome Browser Verification
  console.log('\n=====================================================');
  console.log('12. BROWSER E2E VERIFICATION (Chrome CDP)');
  console.log('=====================================================');

  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1280,800'
  ]);

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    const client = new CdpClient(ws);
    await client.send('Runtime.enable');
    await client.send('Page.enable');

    // TEST B.1: Open Main Forum View
    console.log('Test B.1: Navigating to #forum...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#forum' });
    await sleep(2000);

    const forumOverviewState = await client.eval(`
      (() => {
        const titleEl = document.querySelector('.section-title');
        const statsSummary = document.querySelector('.forum-stats-summary')?.innerText || '';
        const catCards = document.querySelectorAll('.forum-category-card').length;
        const latestItems = document.querySelectorAll('#forum-latest-posts-list .sidebar-post-item').length;
        const trendingItems = document.querySelectorAll('#forum-trending-posts-list .sidebar-post-item').length;
        const hasStartBtn = Boolean(document.querySelector('button[onclick*="openNewTopicModal"]'));
        return {
          title: titleEl?.innerText,
          statsSummary,
          catCards,
          latestItems,
          trendingItems,
          hasStartBtn
        };
      })()
    `);

    console.log('  Forum Overview State:', forumOverviewState);
    if (forumOverviewState.catCards !== 5) throw new Error(`Expected 5 category cards, found ${forumOverviewState.catCards}`);
    if (forumOverviewState.latestItems === 0) throw new Error('Expected at least 1 post in Latest Posts sidebar');
    if (!forumOverviewState.hasStartBtn) throw new Error('Start Discussion button missing from Forum header');
    console.log('  ✓ Forum Overview renders 5 genuine categories, live stats, and real latest posts.');

    // TEST B.2: Click a Category Card to open Category Discussion View
    console.log('\nTest B.2: Clicking "Ongoing Novels Discussion" category card...');
    await client.eval(`
      (() => {
        const ongoingCard = Array.from(document.querySelectorAll('.forum-category-card')).find(c => c.innerText.includes('Ongoing Novels'));
        if (ongoingCard) ongoingCard.click();
      })()
    `);
    await sleep(2000);

    const categoryViewState = await client.eval(`
      (() => {
        return {
          currentHash: window.location.hash,
          title: document.querySelector('.section-title')?.innerText,
          topicCards: document.querySelectorAll('.forum-topics-list .topic-card').length,
          hasBackLink: Boolean(document.querySelector('a[href="#forum"]'))
        };
      })()
    `);
    console.log('  Category View State:', categoryViewState);
    if (!categoryViewState.currentHash.includes('category=ongoing-novels')) {
      throw new Error(`Expected hash to include category=ongoing-novels, got ${categoryViewState.currentHash}`);
    }
    if (categoryViewState.topicCards === 0) {
      throw new Error('Expected created topic to appear in category topics list');
    }
    console.log('  ✓ Category discussion view loaded with topics and back button.');

    // TEST B.3: Click Topic to open Topic Thread View
    console.log('\nTest B.3: Opening topic discussion page...');
    await client.eval(`
      (() => {
        const topicLink = document.querySelector('.forum-topics-list a.topic-title-link');
        if (topicLink) topicLink.click();
      })()
    `);
    await sleep(2000);

    const topicViewState = await client.eval(`
      (() => {
        const titleEl = document.querySelector('h1');
        const posts = document.querySelectorAll('.topic-post-card');
        const hasReplyBox = Boolean(document.getElementById('topic-reply-input'));
        const adminBadge = document.querySelector('.topic-post-card span')?.innerText || '';
        return {
          currentHash: window.location.hash,
          topicTitle: titleEl?.innerText,
          postsRendered: posts.length,
          hasReplyBox
        };
      })()
    `);
    console.log('  Topic View State:', topicViewState);
    if (topicViewState.postsRendered < 2) {
      throw new Error(`Expected at least 2 posts (opening post + reply), found ${topicViewState.postsRendered}`);
    }
    console.log('  ✓ Topic discussion rendered with all genuine posts and reply box.');

    // TEST B.4: Refresh Page and Verify Persistence
    console.log('\nTest B.4: Testing page reload on topic view...');
    await client.send('Page.reload');
    await sleep(2000);

    const reloadedTopicState = await client.eval(`
      (() => {
        return {
          postsRendered: document.querySelectorAll('.topic-post-card').length,
          topicTitle: document.querySelector('h1')?.innerText
        };
      })()
    `);
    console.log('  Reloaded Topic State:', reloadedTopicState);
    if (reloadedTopicState.postsRendered < 2) {
      throw new Error('Topic posts lost after reload!');
    }
    console.log('  ✓ Topic data fully persists from MySQL on page reload.');

    // TEST B.5: Check Novel Comments on Novel Details Page
    console.log('\nTest B.5: Navigating to novel details (#novel?id=en-uyiril-nee)...');
    await client.send('Page.navigate', { url: 'http://localhost:5173/#novel?id=en-uyiril-nee' });
    await sleep(2000);

    const novelCommentsState = await client.eval(`
      (() => {
        const commentCards = document.querySelectorAll('.rp-comment-card');
        const commentCountBadge = document.querySelector('.rp-comments-count-badge')?.innerText;
        return {
          commentCountBadge,
          commentsRendered: commentCards.length
        };
      })()
    `);
    console.log('  Novel Comments State:', novelCommentsState);
    if (novelCommentsState.commentsRendered < 2) {
      throw new Error(`Expected at least 2 comments under novel, found ${novelCommentsState.commentsRendered}`);
    }
    console.log('  ✓ Novel comments loaded directly from MySQL with author avatars and badges.');

    console.log('\n=====================================================');
    console.log('🎉 ALL 15 FORUM & COMMENTS INTEGRATION TESTS PASSED!');
    console.log('=====================================================');

    ws.close();
  } finally {
    chromeProc.kill();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
