// scripts/verify_chapter_hierarchy_and_like_button.js
// Verification suite for Chapter Count, Hierarchy, Dedicated Chapter Page, Like Button, and Header Navigation

import http from 'http';
import fs from 'fs';

function get(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- STARTING VERIFICATION SUITE ---');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  // 1. Verify Header Navigation in index.html
  const homeRes = await get('/');
  assert(homeRes.status === 200, 'Landing page HTTP status 200');
  
  const navMatch = homeRes.body.match(/<nav class="nav-desktop"[\s\S]*?<\/nav>/);
  assert(Boolean(navMatch), 'Desktop navigation exists in HTML');
  if (navMatch) {
    const navHtml = navMatch[0];
    assert(navHtml.includes('data-nav="home">Home</a>'), 'First navigation link is named "Home" with data-nav="home"');
    assert(!navHtml.match(/data-nav="home">Forms/i), 'First navigation link is NOT named Forms');
    assert(navHtml.includes('data-nav="forms"'), 'Second navigation link has data-nav="forms"');
    assert(navHtml.includes('Forms <span class="nav-link-badge">New</span>'), 'Second navigation link is named "Forms" with "New" badge');
    assert(navHtml.includes('href="#forms" class="nav-link" data-nav="home"'), 'Home link targets #forms without creating a separate home page');
  }

  // 2. Verify Novel API chapters count for Vaanavil Ninaivugal
  const novelRes = await get('/api/novels/test-novel-1792464274');
  assert(novelRes.status === 200, 'Novel API status 200');
  try {
    const novelData = JSON.parse(novelRes.body);
    const novel = novelData.novel || novelData;
    assert(novel.chaptersCount === 3, `Novel chaptersCount is dynamically 3 (Actual: ${novel.chaptersCount})`);
    
    const rootChapters = (novel.chapters || []).filter(c => !c.parentId && !c.parent_id);
    assert(rootChapters.length === 3, `Novel has exactly 3 root chapters (Actual: ${rootChapters.length})`);
    
    const childEpisodes = (novel.chapters || []).filter(c => c.parentId || c.parent_id);
    assert(childEpisodes.length === 3, `Novel has exactly 3 child episodes/sub-episodes (Actual: ${childEpisodes.length})`);
  } catch (err) {
    assert(false, `Failed to parse novel API response: ${err.message}`);
  }

  // 3. Verify Episodes API returns 3-level hierarchical structure
  const epsRes = await get('/api/novels/test-novel-1792464274/chapters');
  assert(epsRes.status === 200, 'Episodes API status 200');
  try {
    const epsData = JSON.parse(epsRes.body);
    const chapters = epsData.chapters || epsData;
    assert(Array.isArray(chapters), 'Chapters is an array');

    const rootChapters = chapters.filter(c => !c.parentId && !c.parent_id);
    assert(rootChapters.length === 3, `Novel has 3 root chapters (Actual: ${rootChapters.length})`);
    
    // Check Chapter 1 has 2 child episodes (1.1, 1.2)
    const ch1 = rootChapters.find(e => String(e.chapterNum) === '1');
    assert(Boolean(ch1), 'Chapter 1 exists');
    const ch1Children = chapters.filter(c => Number(c.parentId) === Number(ch1?.id));
    assert(ch1Children.length === 2, `Chapter 1 has 2 child episodes: 1.1 and 1.2 (Actual: ${ch1Children.length})`);

    // Check Chapter 2 has 1 child episode (2.1)
    const ch2 = rootChapters.find(e => String(e.chapterNum) === '2');
    assert(Boolean(ch2), 'Chapter 2 exists');
    const ch2Children = chapters.filter(c => Number(c.parentId) === Number(ch2?.id));
    assert(ch2Children.length === 1, `Chapter 2 has 1 child episode: 2.1 (Actual: ${ch2Children.length})`);

    // Check Chapter 3 has 0 child episodes
    const ch3 = rootChapters.find(e => String(e.chapterNum) === '3');
    assert(Boolean(ch3), 'Chapter 3 exists');
    const ch3Children = chapters.filter(c => Number(c.parentId) === Number(ch3?.id));
    assert(ch3Children.length === 0, `Chapter 3 has 0 child episodes (Actual: ${ch3Children.length})`);
  } catch (err) {
    assert(false, `Failed to parse episodes API response: ${err.message}`);
  }

  // 4. Verify Built JavaScript code has Dedicated Chapter View and Thumbs-up Like Button
  const bundleFiles = fs.readdirSync('frontend/dist/assets').filter(f => f.endsWith('.js'));
  assert(bundleFiles.length > 0, `Bundle files exist (${bundleFiles.join(', ')})`);

  let bundleContent = '';
  for (const bf of bundleFiles) {
    bundleContent += fs.readFileSync(`frontend/dist/assets/${bf}`, 'utf8') + '\n';
  }

  assert(bundleContent.includes('Chapter Episodes') || bundleContent.includes('Back to All Chapters'), 'Dedicated chapter view logic compiled in bundle');
  assert(bundleContent.includes('View Episodes') || bundleContent.includes('View Episodes ('), 'Main novel view shows View Episodes button on chapter cards');
  assert(bundleContent.includes('👍') && bundleContent.includes('rp-thumb-btn'), 'Thumbs-up Like button (👍 Like) compiled in bundle');

  console.log(`\n--- TEST SUMMARY: ${passed}/${total} PASSED ---`);
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
