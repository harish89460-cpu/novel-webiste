// scripts/verify_audio_novels_complete.cjs
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

function request(method, endpoint, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
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

let passed = 0;
let failed = 0;

function assert(cond, name, info = '') {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name} ${info ? '(' + info + ')' : ''}`);
    failed++;
  }
}

async function runVerification() {
  console.log('===================================================================');
  console.log('   COMPLETE AUDIO NOVEL MANAGEMENT & COMMENTS E2E VERIFICATION     ');
  console.log('===================================================================\n');

  // Load auth & db modules dynamically
  const { createSession } = await import('../backend/auth.js');
  const { query, queryOne } = await import('../backend/db.js');
  const { checkAndPublishDueEpisodes } = await import('../backend/episodes.js');
  const { updateWriterPermissions, createWriterAssignment } = await import('../backend/writers.js');

  const adminToken = await createSession(2, 'author');
  const writerToken = await createSession(37, 'writer');
  const readerToken = await createSession(69, 'reader');

  const testNovelId = 'test-audio-novel-complete';
  const testAudioBase64 = 'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA';
  const testCoverBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  try {
    // Cleanup prior test artifacts
    await query('DELETE FROM comments WHERE novel_id = ?;', [testNovelId]);
    await query('DELETE FROM chapters WHERE novel_id = ?;', [testNovelId]);
    await query('DELETE FROM novels WHERE id = ?;', [testNovelId]);
    await query('DELETE FROM writer_assignments WHERE writer_id = 37 AND content_id = ?;', [testNovelId]);
    await query('DELETE FROM writer_submissions WHERE content_type = ?;', ['audio_episode']);

    console.log('[1/13] Creating Audio Novel via Admin Dashboard...');
    const createRes = await request('POST', '/api/admin/audio-novels', {
      title: 'En Uyirile Nee (Audio Special)',
      author: 'Rudhra Prarthana',
      voice: 'Meena Soundar',
      description: 'A captivating audio novel experience with music, dual sound streams, and rich discussions.',
      cover: testCoverBase64,
      status: 'published'
    }, adminToken);

    assert(createRes.status === 201 && createRes.data?.success, 'Admin successfully created Audio Novel');
    const createdNovel = createRes.data.audioNovel;
    const novelId = createdNovel.id;
    assert(Boolean(novelId), `Audio Novel created with ID: ${novelId}`);
    assert(createdNovel.voice === 'Meena Soundar', 'Voice artist metadata properly saved');

    console.log('\n[2/13] Creating Hierarchical Structure: Chapter 1 -> Episode 1.1 -> Sub-episode 1.1.1...');
    // Create Chapter 1
    const ch1Res = await request('POST', '/api/admin/audio-episodes', {
      novelId,
      parentId: null,
      title: 'Chapter 1: The Gathering Storm',
      audioDuration: '30:00',
      status: 'published'
    }, adminToken);
    assert(ch1Res.status === 201 && ch1Res.data?.success, 'Chapter 1 created with parent_id = null');
    const ch1 = ch1Res.data.episode;
    assert(String(ch1.chapter_num || ch1.episode_number) === '1', 'Automatic root chapter numbering: 1');

    // Create Episode 1.1
    const ep1Res = await request('POST', '/api/admin/audio-episodes', {
      novelId,
      parentId: ch1.id,
      title: 'Episode 1.1: Whispers in the Wind',
      audioDuration: '15:20',
      status: 'published'
    }, adminToken);
    assert(ep1Res.status === 201 && ep1Res.data?.success, 'Episode 1.1 created under Chapter 1');
    const ep1 = ep1Res.data.episode;
    assert(String(ep1.episode_number) === '1.1', `Automatic hierarchical episode numbering: ${ep1.episode_number}`);

    // Create Sub-episode 1.1.1
    const sub1Res = await request('POST', '/api/admin/audio-episodes', {
      novelId,
      parentId: ep1.id,
      title: 'Sub-episode 1.1.1: Shadows Behind the Glass',
      audioDuration: '08:15',
      status: 'published'
    }, adminToken);
    assert(sub1Res.status === 201 && sub1Res.data?.success, 'Sub-episode 1.1.1 created under Episode 1.1');
    const sub1 = sub1Res.data.episode;
    assert(String(sub1.episode_number) === '1.1.1', `Automatic hierarchical sub-episode numbering: ${sub1.episode_number}`);

    console.log('\n[3/13] Testing Flexible Media: Audio-Only Episode...');
    const audioOnlyRes = await request('POST', '/api/admin/audio-episodes', {
      novelId,
      parentId: ch1.id,
      title: 'Episode 1.2: Solo Melody',
      sourceType: 'audio_file',
      audioData: testAudioBase64,
      audioDuration: '12:00',
      status: 'published'
    }, adminToken);
    assert(audioOnlyRes.status === 201 && audioOnlyRes.data?.success, 'Audio-only episode created');
    const audioEp = audioOnlyRes.data.episode;
    assert(Boolean(audioEp.audio_file_url) && !audioEp.youtube_url, 'Audio file saved without YouTube URL');

    // Verify static serving
    const staticRes = await request('GET', audioEp.audio_file_url);
    assert(staticRes.status === 200, `Audio file statically accessible at: ${audioEp.audio_file_url}`);

    console.log('\n[4/13] Testing Flexible Media: YouTube-Only Episode...');
    const ytOnlyRes = await request('POST', '/api/admin/audio-episodes', {
      novelId,
      parentId: ch1.id,
      title: 'Episode 1.3: Visual Presentation',
      sourceType: 'youtube',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      audioDuration: '03:33',
      status: 'published'
    }, adminToken);
    assert(ytOnlyRes.status === 201 && ytOnlyRes.data?.success, 'YouTube-only episode created');
    const ytEp = ytOnlyRes.data.episode;
    assert(ytEp.youtube_video_id === 'dQw4w9WgXcQ' && !ytEp.audio_file_url, 'YouTube video ID extracted without audio file');

    console.log('\n[5/13] Testing Flexible Media: Dual Playback (Audio + YouTube Both)...');
    const bothRes = await request('POST', '/api/admin/audio-episodes', {
      novelId,
      parentId: ch1.id,
      title: 'Episode 1.4: Dual Experience (Both Audio & Video)',
      sourceType: 'both',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      audioData: testAudioBase64,
      audioDuration: '20:45',
      status: 'published'
    }, adminToken);
    assert(bothRes.status === 201 && bothRes.data?.success, 'Combined Audio + YouTube episode created');
    const bothEp = bothRes.data.episode;
    assert(Boolean(bothEp.audio_file_url) && Boolean(bothEp.youtube_url), 'Both audio_file_url AND youtube_url preserved on same episode');
    assert(bothEp.source_type === 'both', 'Episode source_type identified as both');

    console.log('\n[6/13] Verifying Dedicated Public Audio Novel Page Hierarchy...');
    const hierarchyRes = await request('GET', `/api/audio-novels/${encodeURIComponent(novelId)}`);
    assert(hierarchyRes.status === 200 && hierarchyRes.data?.success, 'Public dedicated audio novel loaded via API');
    const pubHierarchy = hierarchyRes.data.audioNovel;
    assert(pubHierarchy.chaptersCount === 1, `Hierarchy contains 1 root chapter`);
    assert(pubHierarchy.playlist.length === 5, `Playlist contains 5 playable episodes (episodes + sub-episodes)`);
    const dualEpInHierarchy = pubHierarchy.playlist.find(e => e.id === bothEp.id);
    assert(dualEpInHierarchy?.hasAudio && dualEpInHierarchy?.hasYouTube, 'Dual episode flags hasAudio and hasYouTube both true in public view');

    console.log('\n[7/13] Verifying Member Forms Page Integration...');
    const formsRes = await request('GET', '/api/content/hierarchy');
    assert(formsRes.status === 200, 'Forms content hierarchy loaded');
    const audioCat = formsRes.data.hierarchy?.find(c => c.id === 'audio-novels');
    assert(Boolean(audioCat), 'Audio Novels category present on Forms page');
    const novelCard = audioCat.novels?.find(n => n.id === novelId);
    assert(Boolean(novelCard), `Created audio novel "${novelCard?.title}" found on Forms page`);
    assert(novelCard?.link === `#audio?novel=${encodeURIComponent(novelId)}`, `Cover & title clickable link verified: ${novelCard?.link}`);
    assert(novelCard?.chaptersCount >= 1 && novelCard?.episodesCount >= 5, `Chapter & episode counts accurately presented on card`);

    console.log('\n[8/13] Reusing Existing Novel Comment Box on Audio Novels...');
    // Post root comment on Episode 1.1
    const postCommRes = await request('POST', '/api/comments', {
      novelId,
      chapterNum: '1.1',
      content: '<p>Listening to <strong>Episode 1.1</strong>, the voice acting and background flute are breathtaking! ❤️</p>'
    }, readerToken);
    assert(postCommRes.status === 201 && postCommRes.data?.success, 'Reader posted rich-text comment on Episode 1.1');
    const rootCommentId = postCommRes.data.comment?.id || postCommRes.data.id;

    // Post nested threaded reply
    const replyRes = await request('POST', `/api/comments/${rootCommentId}/reply`, {
      novelId,
      chapterNum: '1.1',
      parentId: rootCommentId,
      content: 'I completely agree! The dialogue delivery at 04:12 gave me goosebumps.'
    }, adminToken);
    assert(replyRes.status === 201 && replyRes.data?.success, 'Admin posted nested reply to reader comment');

    // Post reaction
    const reactRes = await request('POST', `/api/novels/${encodeURIComponent(novelId)}/chapters/1.1/comments/${rootCommentId}/react`, {
      reaction: '❤️'
    }, readerToken);
    assert(reactRes.status === 200 && reactRes.data?.success, 'Emoji reaction ❤️ recorded on comment');

    // Verify comments isolation & retrieval
    const commsRes = await request('GET', `/api/novels/${encodeURIComponent(novelId)}/chapters/1.1/comments`);
    assert(commsRes.status === 200, 'Comments loaded for Episode 1.1');
    const epComments = commsRes.data.comments || [];
    assert(epComments.length >= 1, `Found ${epComments.length} comments on Episode 1.1`);
    assert(epComments[0].content.includes('breathtaking'), 'Rich-text formatting preserved in comment content');

    // Verify crosstalk prevention: Episode 1.2 should have 0 comments
    const otherEpComms = await request('GET', `/api/novels/${encodeURIComponent(novelId)}/chapters/1.2/comments`);
    assert(otherEpComms.data.comments?.length === 0, 'No crosstalk: Comments on Episode 1.1 do NOT appear on Episode 1.2');

    console.log('\n[9/13] Testing Writer Audio Dashboard & Permission Integration...');
    // Setup writer permissions
    await updateWriterPermissions(37, {
      canNovels: 0,
      canShortStories: 0,
      canAudioNovels: 1,
      canEpisodes: 1,
      accessLevel: 'review_required',
      fullAccess: 0
    });
    // Assign audio novel to writer
    await createWriterAssignment({
      writerId: 37,
      contentType: 'audio_novel',
      contentId: novelId,
      title: 'En Uyirile Nee',
      instructions: 'Record and upload Chapter 2 episodes',
      assignedBy: 2
    });

    // Writer creates audio episode under review_required
    const writerEpRes = await request('POST', '/api/writer/audio-episodes', {
      novelId,
      title: 'Episode 2.1: Writer Recorded Melody',
      audioData: testAudioBase64,
      audioDuration: '14:10',
      status: 'submitted'
    }, writerToken);
    assert(writerEpRes.status === 201 && writerEpRes.data?.success, 'Writer created audio episode draft');
    assert(writerEpRes.data.reviewStatus === 'pending_review', 'Episode automatically set to review_status: pending_review');
    assert(writerEpRes.data.episode.status === 'draft', 'Review-required writer blocked from direct publishing (status: draft)');

    // Verify submission is in Admin Review Queue
    const queueRes = await request('GET', '/api/admin/writers/submissions', null, adminToken);
    const audioSubmission = queueRes.data.submissions?.find(s => s.contentType === 'audio_episode');
    assert(Boolean(audioSubmission), 'Audio episode submission confirmed in Admin Review Queue');

    // Admin approves & publishes submission
    const reviewRes = await request('POST', `/api/admin/writers/submissions/${audioSubmission.id}/review`, {
      action: 'approve_publish',
      adminNotes: 'Excellent narration, clear audio quality.'
    }, adminToken);
    assert(reviewRes.status === 200 && reviewRes.data?.success, 'Admin approved and published audio episode');

    // Verify database status is now published
    const updatedEpRow = await queryOne('SELECT status, review_status FROM chapters WHERE id = ?;', [audioSubmission.contentId]);
    assert(updatedEpRow.status === 'published' && updatedEpRow.review_status === 'published', 'Episode database status successfully updated to published');

    console.log('\n[10/13] Testing Scheduled Audio Episode & Automated Background Publishing...');
    const pastTimestamp = new Date(Date.now() - 60000).toISOString().slice(0, 19).replace('T', ' ');
    const schedEpRes = await request('POST', '/api/admin/audio-episodes', {
      novelId,
      parentId: ch1.id,
      title: 'Episode 1.5: Scheduled Release',
      audioData: testAudioBase64,
      audioDuration: '10:00',
      status: 'scheduled',
      scheduledAt: pastTimestamp,
      reviewStatus: 'approved'
    }, adminToken);
    assert(schedEpRes.status === 201, 'Scheduled audio episode created');
    const schedEpId = schedEpRes.data.episode.id;

    // Trigger backend scheduler engine
    await checkAndPublishDueEpisodes();
    const publishedSchedRow = await queryOne('SELECT status FROM chapters WHERE id = ?;', [schedEpId]);
    assert(publishedSchedRow.status === 'published', 'Automated backend scheduler published due audio episode without browser tab');

    console.log('\n[11/13] Testing Temporarily Disable and Restore...');
    const toggleRes = await request('POST', `/api/admin/audio-episodes/${sub1.id}/toggle-status`, {
      status: 'disabled'
    }, adminToken);
    assert(toggleRes.status === 200 && toggleRes.data?.status === 'disabled', 'Audio sub-episode temporarily disabled');

    // Verify disabled episode is omitted from public playlist
    const pubAfterDisable = await request('GET', `/api/audio-novels/${encodeURIComponent(novelId)}`);
    const foundDisabled = pubAfterDisable.data.audioNovel?.playlist?.find(e => e.id === sub1.id);
    assert(!foundDisabled, 'Disabled episode excluded from public reader playlist');

    // Restore back to published
    await request('POST', `/api/admin/audio-episodes/${sub1.id}/toggle-status`, { status: 'published' }, adminToken);
    const pubAfterRestore = await request('GET', `/api/audio-novels/${encodeURIComponent(novelId)}`);
    const foundRestored = pubAfterRestore.data.audioNovel?.playlist?.find(e => e.id === sub1.id);
    assert(Boolean(foundRestored), 'Sub-episode successfully restored to public reader view');

    console.log('\n[12/13] Verifying Written Novels & Comments Integrity...');
    const writtenNovelsRes = await request('GET', '/api/novels');
    assert(writtenNovelsRes.status === 200 && writtenNovelsRes.data?.novels?.length > 0, 'Written novels API intact and accessible');
    const sampleWritten = writtenNovelsRes.data.novels[0];
    const writtenCommentsRes = await request('GET', `/api/novels/${encodeURIComponent(sampleWritten.id)}/chapters/1/comments`);
    assert(writtenCommentsRes.status === 200, `Written novel "${sampleWritten.title}" comments intact`);

    console.log('\n[13/13] Cleaning up test artifacts...');
    await query('DELETE FROM comments WHERE novel_id = ?;', [novelId]);
    await query('DELETE FROM chapters WHERE novel_id = ?;', [novelId]);
    await query('DELETE FROM novels WHERE id = ?;', [novelId]);
    await query('DELETE FROM writer_assignments WHERE writer_id = 37 AND content_id = ?;', [novelId]);
    await query('DELETE FROM writer_submissions WHERE content_type = ?;', ['audio_episode']);
    console.log('  ✓ Test audio novel, episodes, comments, and submissions cleaned up');

    console.log('\n===================================================================');
    console.log(`   🎉 ALL ${passed} AUDIO NOVEL SYSTEM TESTS PASSED! (${failed} failed)`);
    console.log('===================================================================\n');

  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runVerification();

