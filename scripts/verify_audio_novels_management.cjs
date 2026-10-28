/**
 * verify_audio_novels_management.cjs
 * Comprehensive verification for Chapter-Wise & Episode-Wise Audio Novel Management.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

function request(method, pathUrl, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const reqHeaders = { ...headers };
    let postData = '';
    if (body) {
      postData = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: reqHeaders,
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// 1-second silent MP3 base64 stub for audio file upload verification
const DUMMY_BASE64_MP3 = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA////////////////////////////////////////////////////////////////';

async function runVerification() {
  console.log('=====================================================');
  console.log('🚀 RUNNING AUDIO NOVELS MANAGEMENT VERIFICATION SUITE');
  console.log('=====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: ${testName} - ${details}`);
    }
  }

  // Obtain admin session token directly from auth module
  const { createSession } = await import('../backend/auth.js');
  const adminToken = await createSession(2, 'author');
  const adminHeaders = {
    'Authorization': `Bearer ${adminToken}`
  };

  let testNovelId = null;
  let ch1Id = null;
  let ep1_1Id = null;
  let sub1_1_1Id = null;
  let sub1_1_2Id = null;

  try {
    // TEST 1: GET /api/admin/audio-novels
    console.log('\n--- Step 1: Admin Audio Novels List ---');
    const initialNovels = await request('GET', '/api/admin/audio-novels', null, adminHeaders);
    assert(initialNovels.status === 200 && Array.isArray(initialNovels.body.audioNovels), 'GET /api/admin/audio-novels returns 200 with audioNovels array', JSON.stringify(initialNovels.body));

    // TEST 2: CREATE AUDIO NOVEL
    console.log('\n--- Step 2: Create Audio Novel ---');
    const novelPayload = {
      title: 'E2E Test Audio Novel En Uyirile Nee ' + Date.now(),
      author: 'Rudhra Prarthana',
      voice: 'Soundarya & Team',
      description: 'A test romantic audio novel for hierarchy verification',
      status: 'published',
      duration: '45 mins'
    };
    const createNovelRes = await request('POST', '/api/admin/audio-novels', novelPayload, adminHeaders);
    assert(createNovelRes.status === 201 && createNovelRes.body.audioNovel && createNovelRes.body.audioNovel.id, 'POST /api/admin/audio-novels creates novel', JSON.stringify(createNovelRes.body));
    testNovelId = createNovelRes.body.audioNovel ? createNovelRes.body.audioNovel.id : null;

    // TEST 3: CREATE ROOT CHAPTER 1
    console.log('\n--- Step 3: Create Chapter 1 ---');
    const ch1Payload = {
      novel_id: testNovelId,
      level: 'chapter',
      title: 'Kaadhal Thodakkam',
      status: 'published'
    };
    const ch1Res = await request('POST', '/api/admin/audio-episodes', ch1Payload, adminHeaders);
    assert(ch1Res.status === 201 && ch1Res.body.episode && String(ch1Res.body.episode.chapter_num) === '1', 'POST /api/admin/audio-episodes creates Chapter 1 with chapter_num = 1', JSON.stringify(ch1Res.body));
    ch1Id = ch1Res.body.episode ? ch1Res.body.episode.id : null;

    // TEST 4: CREATE EPISODE 1.1 UNDER CHAPTER 1
    console.log('\n--- Step 4: Create Episode 1.1 ---');
    const ep1_1Payload = {
      novel_id: testNovelId,
      parent_id: ch1Id,
      level: 'episode',
      title: 'Muthal Paarvai',
      status: 'published',
      duration: '12:30'
    };
    const ep1_1Res = await request('POST', '/api/admin/audio-episodes', ep1_1Payload, adminHeaders);
    assert(ep1_1Res.status === 201 && ep1_1Res.body.episode && ep1_1Res.body.episode.episode_number === '1.1', 'POST /api/admin/audio-episodes creates Episode 1.1 with episode_number = "1.1"', JSON.stringify(ep1_1Res.body));
    ep1_1Id = ep1_1Res.body.episode ? ep1_1Res.body.episode.id : null;

    // TEST 5: CREATE SUB-EPISODE 1.1.1 UNDER EPISODE 1.1
    console.log('\n--- Step 5: Create Sub-episode 1.1.1 with YouTube URL ---');
    const sub1_1_1Payload = {
      novel_id: testNovelId,
      parent_id: ep1_1Id,
      level: 'sub_episode',
      title: 'Sannegam',
      source_type: 'youtube',
      youtube_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'published',
      duration: '03:32'
    };
    const sub1_1_1Res = await request('POST', '/api/admin/audio-episodes', sub1_1_1Payload, adminHeaders);
    assert(sub1_1_1Res.status === 201 && sub1_1_1Res.body.episode && sub1_1_1Res.body.episode.episode_number === '1.1.1' && sub1_1_1Res.body.episode.youtube_video_id === 'dQw4w9WgXcQ', 'Creates Sub-episode 1.1.1 with extracted YouTube ID dQw4w9WgXcQ', JSON.stringify(sub1_1_1Res.body));
    sub1_1_1Id = sub1_1_1Res.body.episode ? sub1_1_1Res.body.episode.id : null;

    // TEST 6: CREATE SUB-EPISODE 1.1.2 WITH BASE64 AUDIO FILE UPLOAD
    console.log('\n--- Step 6: Create Sub-episode 1.1.2 with Audio Upload ---');
    const sub1_1_2Payload = {
      novel_id: testNovelId,
      parent_id: ep1_1Id,
      level: 'sub_episode',
      title: 'Nijam',
      source_type: 'audio_file',
      audio_data: DUMMY_BASE64_MP3,
      audio_filename: 'test_sub_episode.mp3',
      status: 'published',
      duration: '01:00'
    };
    const sub1_1_2Res = await request('POST', '/api/admin/audio-episodes', sub1_1_2Payload, adminHeaders);
    assert(sub1_1_2Res.status === 201 && sub1_1_2Res.body.episode && sub1_1_2Res.body.episode.episode_number === '1.1.2' && sub1_1_2Res.body.episode.audio_file_url && sub1_1_2Res.body.episode.audio_file_url.includes('/uploads/audio/'), 'Creates Sub-episode 1.1.2 with uploaded audio file', JSON.stringify(sub1_1_2Res.body));
    sub1_1_2Id = sub1_1_2Res.body.episode ? sub1_1_2Res.body.episode.id : null;

    // TEST 7: VERIFY STATIC AUDIO FILE IS ACCESSIBLE VIA HTTP
    console.log('\n--- Step 7: Verify Audio File Static Serving ---');
    if (sub1_1_2Res.body.episode && sub1_1_2Res.body.episode.audio_file_url) {
      const audioUrl = sub1_1_2Res.body.episode.audio_file_url;
      const staticRes = await request('GET', audioUrl);
      assert(staticRes.status === 200, `Audio file is served statically at ${audioUrl} with 200 OK`);
    }

    // TEST 8: GET ADMIN HIERARCHY TREE
    console.log('\n--- Step 8: Admin Hierarchy Tree ---');
    const treeRes = await request('GET', `/api/admin/audio-episodes?novel=${testNovelId}`, null, adminHeaders);
    assert(treeRes.status === 200 && Array.isArray(treeRes.body.episodes) && treeRes.body.episodes.length === 1, 'Admin tree has 1 root chapter', JSON.stringify(treeRes.body));
    const chTree = (treeRes.body.episodes && treeRes.body.episodes[0]) || null;
    const episodes = (chTree && (chTree.children || chTree.subEpisodes)) || [];
    assert(episodes.length === 1, 'Chapter has 1 episode child (Episode 1.1)', `Actual: ${episodes.length}`);
    const epTree = episodes[0] || null;
    const subEpisodes = (epTree && (epTree.children || epTree.subEpisodes)) || [];
    assert(subEpisodes.length === 2, 'Episode 1.1 has 2 sub-episode children (1.1.1 and 1.1.2)', `Actual: ${subEpisodes.length}`);

    // TEST 9: TOGGLE EPISODE STATUS
    console.log('\n--- Step 9: Toggle Episode Status (Published -> Disabled) ---');
    const toggleRes = await request('POST', `/api/admin/audio-episodes/${sub1_1_1Id}/toggle-status`, { status: 'disabled' }, adminHeaders);
    assert(toggleRes.status === 200 && (toggleRes.body.status === 'disabled' || toggleRes.body.newStatus === 'disabled'), 'Status toggled to disabled', JSON.stringify(toggleRes.body));

    // TEST 10: PUBLIC AUDIO NOVEL API
    console.log('\n--- Step 10: Public Audio Novel View API ---');
    const publicNovelRes = await request('GET', `/api/audio-novels/${testNovelId}`);
    assert(publicNovelRes.status === 200 && publicNovelRes.body.audioNovel, 'GET /api/audio-novels/:id returns 200 with audioNovel details');
    const audioNovelObj = publicNovelRes.body.audioNovel || {};
    // Disabled episode sub1_1_1 should NOT be in playlist
    const playlistIds = (audioNovelObj.playlist || []).map(item => item.id);
    assert(!playlistIds.includes(sub1_1_1Id), 'Disabled sub-episode 1.1.1 is omitted from public playlist');
    assert(playlistIds.includes(sub1_1_2Id), 'Published sub-episode 1.1.2 is present in public playlist');

    // TEST 11: CONTENT HIERARCHY / FORMS INTEGRATION
    console.log('\n--- Step 11: Content Hierarchy Audio Integration ---');
    const hierarchyRes = await request('GET', '/api/content/hierarchy');
    assert(hierarchyRes.status === 200 && Array.isArray(hierarchyRes.body.hierarchy), 'GET /api/content/hierarchy returns 200');
    const audioCat = (hierarchyRes.body.hierarchy || []).find(c => c.id === 'audio-novels');
    assert(audioCat && (audioCat.novels || []).some(n => n.link && n.link.startsWith('#audio?novel=')), 'Audio Novels category in Hierarchy has #audio?novel= links');

    // TEST 12: WRITTEN NOVELS REMAIN INTACT
    console.log('\n--- Step 12: Integrity of Written Novels ---');
    const writtenNovelsRes = await request('GET', '/api/novels');
    const writtenNovels = (writtenNovelsRes.body && writtenNovelsRes.body.novels) || [];
    assert(writtenNovelsRes.status === 200 && Array.isArray(writtenNovels), 'GET /api/novels returns written novels');
    const sampleWritten = writtenNovels.find(n => !n.isAudio && !n.is_audio);
    assert(sampleWritten && sampleWritten.title, `Written novel "${sampleWritten ? sampleWritten.title : 'None'}" remains intact and accessible`);

    // TEST 13: CLEAN UP TEST NOVEL AND ALL NESTED CHAPTERS & FILES
    console.log('\n--- Step 13: Clean up test audio novel ---');
    const deleteRes = await request('DELETE', `/api/admin/audio-novels/${testNovelId}`, null, adminHeaders);
    assert(deleteRes.status === 200 && deleteRes.body.success, 'DELETE /api/admin/audio-novels deletes test novel and cascades');

    // Verify novel deleted
    const verifyDel = await request('GET', `/api/admin/audio-novels/${testNovelId}`, null, adminHeaders);
    assert(verifyDel.status === 404, 'Deleted audio novel returns 404 Not Found');

  } catch (err) {
    console.error('Unexpected error during verification:', err);
    totalTests++;
  }

  console.log('\n=====================================================');
  console.log(`VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('=====================================================');

  if (passedTests === totalTests && totalTests >= 14) {
    console.log('🎉 ALL AUDIO NOVEL MANAGEMENT TESTS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}

runVerification();
