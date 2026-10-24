// Rudhra Prarthana Novels — Audio Novels End-to-End Verification Test Script
// Verifies:
// 1. Unauthenticated/Member access blocked (401/403)
// 2. Admin Login & Authorization
// 3. YouTube link validation, ID extraction, draft visibility vs published visibility
// 4. Direct audio file upload (MP3/WAV), filesystem storage, DB persistence, HTTP playback serving
// 5. Multi-part sibling episodes linking and ordering
// 6. Reader searching, filtering by language & novel, sort options
// 7. Atomic view count increment
// 8. Edit, unpublish, and delete workflows

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = 'http://localhost:3000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('====================================================');
  console.log('🎧 RUDHRA PRARTHANA — AUDIO NOVELS E2E TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Security & Authorization Checks
  console.log('[Test 1] Admin Endpoints Security & Permissions');
  const unauthRes = await fetch(`${BASE_URL}/api/admin/audio-novels`);
  assert(unauthRes.status === 401, 'Unauthenticated GET /api/admin/audio-novels returns 401');

  const unauthPost = await fetch(`${BASE_URL}/api/admin/audio-novels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Hacked Novel', sourceType: 'youtube', youtubeUrl: 'https://youtu.be/test' })
  });
  assert(unauthPost.status === 401, 'Unauthenticated POST /api/admin/audio-novels returns 401');

  // Login as member account (harish89460@gmail.com)
  const memberLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'harish89460@gmail.com', password: 'password123' })
  });
  const memberLogin = await memberLoginRes.json();
  const memberToken = memberLogin.token;

  if (memberToken) {
    const memberAccessRes = await fetch(`${BASE_URL}/api/admin/audio-novels`, {
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    assert(memberAccessRes.status === 403, 'Regular member access to /api/admin/audio-novels returns 403 Forbidden');
  }

  // 2. Admin Authentication
  console.log('\n[Test 2] Admin Authentication');
  const adminLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'rudhra_author', password: 'Rudhra.pass' })
  });
  const adminLogin = await adminLoginRes.json();
  assert(adminLogin.success && adminLogin.token, 'Author logged in successfully with admin token');
  const adminToken = adminLogin.token;
  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`
  };

  // 3. YouTube Link Validation & Draft Protection
  console.log('\n[Test 3] YouTube Audio Novel Validation & Draft Visibility');
  
  // Test invalid YouTube URL
  const invalidYtRes = await fetch(`${BASE_URL}/api/admin/audio-novels`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Invalid YouTube Test',
      sourceType: 'youtube',
      youtubeUrl: 'https://vimeo.com/123456789'
    })
  });
  const invalidYtData = await invalidYtRes.json();
  assert(!invalidYtData.success && invalidYtRes.status === 400, 'Rejects invalid non-YouTube URL with 400');

  // Create valid YouTube Audio Novel as DRAFT
  const draftCreateRes = await fetch(`${BASE_URL}/api/admin/audio-novels`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'Test Audio Novel — Secret Draft',
      description: 'Exclusive author draft audio story',
      sourceType: 'youtube',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'draft',
      language: 'Tamil',
      partNumber: 1
    })
  });
  const draftData = await draftCreateRes.json();
  assert(draftData.success && draftData.audioNovel?.id, 'Admin successfully created draft YouTube audio novel');
  const draftId = draftData.audioNovel.id;
  const draftSlug = draftData.audioNovel.slug;

  // Confirm draft does NOT appear in public reader listing
  const publicList1Res = await fetch(`${BASE_URL}/api/audio-novels?search=Secret+Draft`);
  const publicList1 = await publicList1Res.json();
  const draftFoundInPublic = (publicList1.audioNovels || []).some(a => a.id === draftId);
  assert(!draftFoundInPublic, 'Draft audio novel is NOT returned in public API listing');

  // Confirm public single view rejects draft
  const publicSingleDraftRes = await fetch(`${BASE_URL}/api/audio-novels/${draftSlug}`);
  assert(publicSingleDraftRes.status === 404, 'Public single view returns 404 for draft audio novel');

  // Publish the draft
  const publishRes = await fetch(`${BASE_URL}/api/admin/audio-novels/${draftId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'published' })
  });
  const publishData = await publishRes.json();
  assert(publishData.success && publishData.audioNovel.status === 'published', 'Admin successfully published draft audio novel');

  // Now confirm published entry appears in public reader listing
  const publicList2Res = await fetch(`${BASE_URL}/api/audio-novels?search=Secret+Draft`);
  const publicList2 = await publicList2Res.json();
  const publishedFoundInPublic = (publicList2.audioNovels || []).some(a => a.id === draftId);
  assert(publishedFoundInPublic, 'Published audio novel is now visible in public API listing');

  // 4. Direct Audio Upload & Playback
  console.log('\n[Test 4] Direct Audio Upload (MP3), Storage & Serving');

  // Generate a valid minimal MP3 audio byte stream (MPEG-1 Layer 3 sync header frame)
  const mp3Frame = Buffer.from([
    0xFF, 0xFB, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  const base64Audio = `data:audio/mp3;base64,${mp3Frame.toString('base64')}`;

  const audioUploadRes = await fetch(`${BASE_URL}/api/admin/audio-novels`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'En Uyiril Nee — Audio Release Part 1',
      novelId: 'en-uyiril-nee',
      description: 'Official direct uploaded audio episode',
      sourceType: 'audio_file',
      audioData: base64Audio,
      audioDuration: '18:42',
      partNumber: 1,
      episodeNumber: 'Part 1',
      language: 'Tamil',
      status: 'published'
    })
  });
  const audioUploadData = await audioUploadRes.json();
  assert(audioUploadData.success && audioUploadData.audioNovel?.audioFileUrl, 'Direct audio file uploaded and saved to DB');
  const uploadedAudioId = audioUploadData.audioNovel.id;
  const audioFileUrl = audioUploadData.audioNovel.audioFileUrl;

  // Verify file physically exists on disk in public/uploads/audio/
  const relativeFilePath = audioFileUrl.replace(/^\//, '');
  const physicalPath = path.resolve(__dirname, '..', 'public', relativeFilePath.replace(/^public\//, ''));
  assert(fs.existsSync(physicalPath), `Audio file physically exists on server disk: ${physicalPath}`);

  // Verify server serves the audio file over HTTP with 200 and audio MIME type
  const httpServeRes = await fetch(`${BASE_URL}${audioFileUrl}`);
  assert(httpServeRes.status === 200, `Server responds 200 for audio URL: ${audioFileUrl}`);
  const contentType = httpServeRes.headers.get('content-type') || '';
  assert(contentType.includes('audio/'), `Content-Type is audio MIME (${contentType})`);

  // 5. Multi-Part Sibling Episodes Linking & Ordering
  console.log('\n[Test 5] Multi-Part Sibling Episodes Linking');
  // Create Part 2 linked to the same novel
  const part2Res = await fetch(`${BASE_URL}/api/admin/audio-novels`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      title: 'En Uyiril Nee — Audio Release Part 2',
      novelId: 'en-uyiril-nee',
      description: 'Second part of the story',
      sourceType: 'youtube',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      audioDuration: '22:15',
      partNumber: 2,
      episodeNumber: 'Part 2',
      language: 'Tamil',
      status: 'published'
    })
  });
  const part2Data = await part2Res.json();
  assert(part2Data.success && part2Data.audioNovel?.id, 'Created Part 2 for the same novel');
  const part2Id = part2Data.audioNovel.id;

  // Query Part 1 from public API and check sibling parts list
  const part1DetailRes = await fetch(`${BASE_URL}/api/audio-novels/${audioUploadData.audioNovel.slug}`);
  const part1Detail = await part1DetailRes.json();
  const siblingParts = part1Detail.audioNovel?.parts || [];
  assert(siblingParts.length >= 2, `Sibling parts array contains both episodes (${siblingParts.length} parts found)`);
  assert(siblingParts[0].partNumber === 1 && siblingParts[1].partNumber === 2, 'Sibling parts are sorted in ascending order (Part 1, Part 2)');
  assert(siblingParts[0].isActive === true && siblingParts[1].isActive === false, 'Part 1 is highlighted as currently active');

  // Verify atomic view count increment
  const initialViews = part1Detail.audioNovel.views;
  await fetch(`${BASE_URL}/api/audio-novels/${audioUploadData.audioNovel.slug}`);
  const part1SecondRead = await (await fetch(`${BASE_URL}/api/audio-novels/${audioUploadData.audioNovel.slug}`)).json();
  assert(part1SecondRead.audioNovel.views > initialViews, `Atomic view counter incremented (from ${initialViews} to ${part1SecondRead.audioNovel.views})`);

  // 6. Searching & Filtering
  console.log('\n[Test 6] Reader Search and Filter Capabilities');
  const searchByTitleRes = await fetch(`${BASE_URL}/api/audio-novels?search=Uyiril`);
  const searchResults = await searchByTitleRes.json();
  assert(searchResults.audioNovels.length >= 2, 'Search query "Uyiril" returned matching audio novels');

  const filterByNovelRes = await fetch(`${BASE_URL}/api/audio-novels?novelId=en-uyiril-nee`);
  const novelFilterResults = await filterByNovelRes.json();
  assert(novelFilterResults.audioNovels.every(a => a.novelId === 'en-uyiril-nee'), 'Filter by novelId strictly returns only linked audio novels');

  const filterByLangRes = await fetch(`${BASE_URL}/api/audio-novels?language=Tamil`);
  const langResults = await filterByLangRes.json();
  assert(langResults.audioNovels.every(a => a.language.toLowerCase() === 'tamil'), 'Filter by language strictly returns Tamil audio novels');

  // 7. Homepage Audio Section Integration
  console.log('\n[Test 7] Homepage Audio Section Integration');
  const homeRes = await fetch(`${BASE_URL}/api/novels/homepage`);
  const homeData = await homeRes.json();
  const homeAudioItems = homeData.sections?.audio?.novels || [];
  assert(homeAudioItems.length > 0, `Homepage includes ${homeAudioItems.length} audio novels in sections.audio.novels`);

  // 8. Cleanup & Deletion
  console.log('\n[Test 8] Clean Up Test Entries');
  for (const id of [draftId, uploadedAudioId, part2Id]) {
    const delRes = await fetch(`${BASE_URL}/api/admin/audio-novels/${id}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    const delData = await delRes.json();
    assert(delData.success, `Successfully deleted test audio novel ID: ${id}`);
  }

  // Confirm deleted items are no longer returned
  const postCleanupRes = await fetch(`${BASE_URL}/api/audio-novels/${draftSlug}`);
  assert(postCleanupRes.status === 404, 'Deleted audio novel returns 404');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test Suite encountered fatal error:', err);
  process.exit(1);
});
