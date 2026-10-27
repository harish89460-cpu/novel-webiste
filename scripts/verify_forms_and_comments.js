import http from 'http';
import fs from 'fs';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

function post(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(`http://localhost:3000${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== RUNNING VERIFICATION SUITE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, desc) {
    if (condition) {
      console.log(`✓ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Check forum topics API
  try {
    const res = await get('/api/forum/topics');
    assert(res.status === 200, 'GET /api/forum/topics returns 200');
    assert(Array.isArray(res.data.topics) && res.data.topics.length > 0, `Returned ${res.data.topics?.length} topics`);
    
    // Check novel linking
    const sampleTopic = res.data.topics[0];
    assert(!!sampleTopic.novelId, `Topic "${sampleTopic.title}" has novelId: ${sampleTopic.novelId}`);
    assert(sampleTopic.novelLink && sampleTopic.novelLink.startsWith('#novel?id='), `Topic has novelLink: ${sampleTopic.novelLink}`);
  } catch (err) {
    console.error('Error fetching forum topics:', err);
    failed++;
  }

  // 2. Check comments API pagination & chronological ordering
  try {
    // nenjam-marappadhillai ch 24 has 14 comments in the database
    const res1 = await get('/api/comments?novel=nenjam-marappadhillai&ch=24&page=1&limit=7');
    assert(res1.status === 200, 'GET /api/comments page 1 returns 200');
    assert(res1.data.comments.length === 7, `Page 1 returns exactly 7 comments (got ${res1.data.comments.length})`);
    assert(res1.data.pagination && res1.data.pagination.page === 1, 'Pagination page = 1');
    assert(res1.data.pagination.limit === 7, 'Pagination limit = 7');
    assert(res1.data.pagination.total >= 14, `Pagination total >= 14 (got ${res1.data.pagination.total})`);
    assert(res1.data.pagination.totalPages >= 2, `Pagination totalPages >= 2 (got ${res1.data.pagination.totalPages})`);

    // Verify chronological order (oldest first): created_at must be monotonically increasing or equal
    const cList1 = res1.data.comments;
    let isChronological = true;
    for (let i = 1; i < cList1.length; i++) {
      const prev = new Date(cList1[i - 1].createdAt || cList1[i - 1].created_at).getTime();
      const curr = new Date(cList1[i].createdAt || cList1[i].created_at).getTime();
      if (curr < prev) {
        isChronological = false;
        console.error(`Chronology broken between idx ${i-1} (${cList1[i-1].createdAt}) and ${i} (${cList1[i].createdAt})`);
      }
    }
    assert(isChronological, 'Page 1 comments are in strict chronological order (oldest first)');

    // Page 2
    const res2 = await get('/api/comments?novel=nenjam-marappadhillai&ch=24&page=2&limit=7');
    assert(res2.status === 200, 'GET /api/comments page 2 returns 200');
    assert(res2.data.comments.length === 7, `Page 2 returns exactly 7 comments (got ${res2.data.comments.length})`);
    
    // Ensure no duplication between page 1 and page 2
    const p1Ids = new Set(cList1.map(c => c.id));
    const p2Ids = res2.data.comments.map(c => c.id);
    const hasOverlap = p2Ids.some(id => p1Ids.has(id));
    assert(!hasOverlap, 'Zero overlap/duplicate comments between Page 1 and Page 2');

    // Ensure page 2 starts AFTER page 1 in chronological sequence
    const p1LastTime = new Date(cList1[cList1.length - 1].createdAt || cList1[cList1.length - 1].created_at).getTime();
    const p2FirstTime = new Date(res2.data.comments[0].createdAt || res2.data.comments[0].created_at).getTime();
    assert(p2FirstTime >= p1LastTime, `Page 2 starts chronologically after Page 1 (P1 last: ${p1LastTime}, P2 first: ${p2FirstTime})`);

    // Verify replies contain parentAuthor context
    const allComments = [...cList1, ...res2.data.comments];
    const replies = allComments.filter(c => c.parentId || c.parent_id);
    assert(replies.length > 0, `Found ${replies.length} replies in global chronological timeline`);
    const allRepliesHaveContext = replies.every(r => r.parentAuthor && r.parentAuthor.length > 0);
    assert(allRepliesHaveContext, `All replies have parentAuthor populated (e.g. "${replies[0]?.parentAuthor}")`);

  } catch (err) {
    console.error('Error testing comments API:', err);
    failed++;
  }

  // 3. Verify Frontend Code & Templates for "Start Conversation" buttons and topic excerpt removal
  const appJs = fs.readFileSync('src/js/app.js', 'utf8');
  const commentsJs = fs.readFileSync('src/js/comments.js', 'utf8');

  // Verify Start Conversation / Start Discussion removal
  const hasStartDiscussionButton = /<button[^>]*>\+?\s*(?:Start|Create)\s+(?:Discussion|Conversation|Topic)/i.test(appJs);
  assert(!hasStartDiscussionButton, 'No "+ Start Discussion" or "+ Start Conversation" buttons in app.js');

  const hasNewTopicFormContainer = /#new-topic-form-container/.test(appJs);
  assert(!hasNewTopicFormContainer, 'No #new-topic-form-container form toggler in app.js');

  // Verify forms topic rows do not render excerpt or thumbnail
  const rendersTopicExcerpt = /forms-topic-excerpt/.test(appJs);
  assert(!rendersTopicExcerpt, 'forms-topic-excerpt has been removed from topic listing rendering in app.js');

  const rendersTopicThumb = /forms-topic-thumb/.test(appJs);
  assert(!rendersTopicThumb, 'forms-topic-thumb has been removed from topic listing rendering in app.js');

  // Verify topic links lead to novel
  const linksToNovelComments = /href="\$\{novelLink\}" class="forms-topic-title-link"/.test(appJs);
  assert(linksToNovelComments, 'Forms topics link directly to novel discussion (#novel?id=...#comments)');

  // Verify 7-item pagination in comments.js
  const has7ItemLimit = /limit\s*=\s*7/.test(commentsJs);
  assert(has7ItemLimit, 'Comments widget is configured for 7 comments per page');

  // Verify reply context indicator
  const hasReplyContextTag = /rp-ig-reply-context-tag/.test(commentsJs);
  assert(hasReplyContextTag, 'Comments widget renders rp-ig-reply-context-tag for replies in chronological stream');

  console.log(`\nTESTS COMPLETED: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
