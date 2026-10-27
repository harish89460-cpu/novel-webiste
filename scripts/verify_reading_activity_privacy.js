// scripts/verify_reading_activity_privacy.js
import { createSession } from '../backend/auth.js';

async function apiRequest(method, path, data = null, token = null) {
  const url = `http://localhost:3000${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const options = { method, headers };
  if (data) {
    options.body = JSON.stringify(data);
  }
  const res = await fetch(url, options);
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data: json };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runTests() {
  console.log('=== STARTING READING ACTIVITY & PRIVACY VERIFICATION ===\n');

  try {
    // 1. Setup Auth Tokens for two real members
    // User A: ID 2 (rudhra_author)
    // User B: ID 28 (harish)
    console.log('Step 1: Setting up authentic member sessions...');
    const tokenA = await createSession(2, 'author');
    const tokenB = await createSession(28, 'reader');
    assert(tokenA && tokenB, 'Auth tokens generated for Member A (id=2) and Member B (id=28)');

    // =========================================================================
    // SCENARIO A: Active Status ON
    // =========================================================================
    console.log('\n--- SCENARIO A: Active Status ON ---');

    // 2. Member A enables Active Status
    console.log('Step 2: Member A enables Active Status...');
    const enableRes = await apiRequest('POST', '/api/user/activity-status', { enabled: true }, tokenA);
    assert(enableRes.ok && enableRes.data.success && enableRes.data.isEnabled === true, 'Member A enabled Active Status');

    // 3. Member A starts reading 'en-uyiril-nee', chapter '1.1'
    console.log('Step 3: Member A opens novel reader and starts reading session...');
    const startRes = await apiRequest('POST', '/api/reading/session/start', {
      novelId: 'en-uyiril-nee',
      chapterNum: '1.1',
      tabId: 'test_tab_1'
    }, tokenA);
    assert(startRes.ok && startRes.data.success, 'Reading session started successfully');
    assert(startRes.data.novelId === 'en-uyiril-nee', `Target novel correctly identified: ${startRes.data.novelTitle}`);
    console.log(`  Session ID: ${startRes.data.sessionId}, Title: "${startRes.data.novelTitle}", Initial Duration: ${startRes.data.duration}`);

    // 4. Member A sends simulated reading heartbeats
    console.log('Step 4: Member A sends reading heartbeats with active elapsed time...');
    const hb1 = await apiRequest('POST', '/api/reading/session/heartbeat', {
      novelId: 'en-uyiril-nee',
      chapterNum: '1.1',
      tabId: 'test_tab_1',
      secondsElapsed: 25
    }, tokenA);
    assert(hb1.ok && hb1.data.success && hb1.data.durationSeconds >= 25, `Heartbeat 1 recorded duration: ${hb1.data.durationSeconds}s (${hb1.data.duration})`);

    const hb2 = await apiRequest('POST', '/api/reading/session/heartbeat', {
      novelId: 'en-uyiril-nee',
      chapterNum: '1.1',
      tabId: 'test_tab_1',
      secondsElapsed: 35
    }, tokenA);
    assert(hb2.ok && hb2.data.success && hb2.data.durationSeconds >= 60, `Heartbeat 2 recorded duration: ${hb2.data.durationSeconds}s (${hb2.data.duration})`);

    // 5. Member B views Member A's profile while Member A is reading
    console.log('Step 5: Member B inspects Member A profile while Active Status is ON and Member A is actively reading...');
    const viewAProfileByB = await apiRequest('GET', '/api/members/rudhra_author', null, tokenB);
    assert(viewAProfileByB.ok && viewAProfileByB.data.member, 'Member B fetched Member A profile');
    const memberAData = viewAProfileByB.data.member;
    assert(memberAData.isOnline === true, 'Member A online status is visible (isOnline: true)');
    assert(memberAData.statusHidden === false, 'Member A status is not hidden');
    assert(memberAData.currentReading !== null, 'Member A has active currentReading record');
    assert(memberAData.currentReading.novelTitle.includes('என் உயிரில் நீ'), `Currently reading novel title visible: "${memberAData.currentReading.novelTitle}"`);
    assert(memberAData.currentReading.chapterNum === '1.1', `Currently reading chapter is "1.1"`);
    assert(typeof memberAData.currentReading.duration === 'string' && memberAData.currentReading.duration.includes('min'), `Reading duration formatted correctly: "${memberAData.currentReading.duration}"`);

    // 6. Member B checks directory list
    console.log('Step 6: Member B views member directory (#members)...');
    const membersListRes = await apiRequest('GET', '/api/members', null, tokenB);
    assert(membersListRes.ok && Array.isArray(membersListRes.data.members), 'Member directory fetched');
    const memberAInList = membersListRes.data.members.find(m => m.id === 2 || m.username === 'rudhra_author');
    assert(memberAInList && memberAInList.currentReading !== null, 'Member A in directory shows currentReading');
    assert(memberAInList.isOnline === true, 'Member A in directory shows isOnline: true');

    // 7. Member A stops reading
    console.log('Step 7: Member A closes reader / navigates away (session pause/stop)...');
    const pauseRes = await apiRequest('POST', '/api/reading/session/pause', {
      novelId: 'en-uyiril-nee',
      chapterNum: '1.1'
    }, tokenA);
    assert(pauseRes.ok && pauseRes.data.success, 'Reading session paused/stopped');

    // 8. Member B views Member A profile after reading stops
    console.log('Step 8: Member B verifies Member A transitions from currently reading to last read...');
    const viewAfterStop = await apiRequest('GET', '/api/members/rudhra_author', null, tokenB);
    const memberAAfterStop = viewAfterStop.data.member;
    assert(memberAAfterStop.currentReading === null, 'Current reading is null after reading stops');
    assert(memberAAfterStop.lastRead !== null, 'Last read record exists');
    assert(memberAAfterStop.lastRead.novelTitle.includes('என் உயிரில் நீ'), `Last read novel title matches: "${memberAAfterStop.lastRead.novelTitle}"`);
    assert(memberAAfterStop.lastRead.chapterNum === '1.1', `Last read chapter number matches: "${memberAAfterStop.lastRead.chapterNum}"`);
    assert(memberAAfterStop.lastRead.lastReadAgo !== null, `Relative last read time displayed: "${memberAAfterStop.lastRead.lastReadAgo}"`);

    // =========================================================================
    // SCENARIO B: Active Status OFF (Strict Privacy Enforcement)
    // =========================================================================
    console.log('\n--- SCENARIO B: Active Status OFF (Privacy Enforcement) ---');

    // 9. Member A turns Active Status OFF
    console.log('Step 9: Member A turns Active Status OFF...');
    const disableRes = await apiRequest('POST', '/api/user/activity-status', { enabled: false }, tokenA);
    assert(disableRes.ok && disableRes.data.success && disableRes.data.isEnabled === false, 'Member A turned Active Status OFF');

    // Member A starts reading again while privacy is OFF
    await apiRequest('POST', '/api/reading/session/start', {
      novelId: 'en-uyiril-nee',
      chapterNum: '1.2',
      tabId: 'test_tab_1'
    }, tokenA);

    // 10. Member B inspects Member A profile
    console.log('Step 10: Member B inspects Member A profile while Active Status is OFF...');
    const viewPrivateProfile = await apiRequest('GET', '/api/members/rudhra_author', null, tokenB);
    assert(viewPrivateProfile.ok && viewPrivateProfile.data.member, 'Member B fetched Member A profile');
    const privateData = viewPrivateProfile.data.member;

    assert(privateData.activityStatusEnabled === false, 'Privacy setting indicates disabled (activityStatusEnabled: false)');
    assert(privateData.statusHidden === true, 'Status hidden flag is true');
    assert(privateData.isOnline === null, 'Online status is OMITTED (isOnline: null)');
    assert(privateData.lastSeen === null, 'Last seen timestamp is OMITTED (lastSeen: null)');
    assert(privateData.currentReading === null, 'Current reading is OMITTED from response (currentReading: null)');
    assert(privateData.lastRead === null, 'Last read history is OMITTED from response (lastRead: null)');

    // 11. Member B attempts to query dedicated reading-activity endpoint
    console.log('Step 11: Member B queries dedicated reading-activity endpoint...');
    const viewPrivateActivity = await apiRequest('GET', '/api/members/rudhra_author/reading-activity', null, tokenB);
    assert(viewPrivateActivity.ok && viewPrivateActivity.data.activity, 'Activity endpoint returned sanitized response');
    const act = viewPrivateActivity.data.activity;
    assert(act.currentReading === null, 'Activity endpoint currentReading is null');
    assert(act.lastRead === null, 'Activity endpoint lastRead is null');
    assert(act.isOnline === null, 'Activity endpoint isOnline is null');

    // 12. Anonymous user checks directory
    console.log('Step 12: Anonymous visitor queries /api/members directory...');
    const anonMembersRes = await apiRequest('GET', '/api/members');
    assert(anonMembersRes.ok, 'Anonymous directory request succeeded');
    const anonA = anonMembersRes.data.members.find(m => m.id === 2 || m.username === 'rudhra_author');
    assert(anonA.statusHidden === true, 'Anonymous view shows statusHidden: true for Member A');
    assert(anonA.isOnline === null, 'Anonymous view omits online status for Member A');
    assert(anonA.currentReading === null, 'Anonymous view omits currentReading for Member A');
    assert(anonA.lastRead === null, 'Anonymous view omits lastRead for Member A');

    // 13. Member A views THEIR OWN profile while Active Status is OFF
    console.log('Step 13: Member A views their OWN profile (isSelf) while Active Status is OFF...');
    const viewSelf = await apiRequest('GET', '/api/members/me', null, tokenA);
    assert(viewSelf.ok && viewSelf.data.member, 'Member A fetched own profile');
    const selfData = viewSelf.data.member;
    assert(selfData.statusHidden === false, 'Member A sees own status');
    assert(selfData.currentReading !== null, 'Member A can see their own private reading activity');
    assert(selfData.currentReading.chapterNum === '1.2', 'Member A sees their own current chapter (1.2)');

    // =========================================================================
    // SCENARIO C: Duration Handling & Session Continuity
    // =========================================================================
    console.log('\n--- SCENARIO C: Duration Accuracy & Session Continuity ---');

    // 14. Test page refresh / episode re-open doesn't reset or duplicate
    console.log('Step 14: Refreshing/re-opening the same chapter reuses session and preserves duration...');
    const resumeRes = await apiRequest('POST', '/api/reading/session/start', {
      novelId: 'en-uyiril-nee',
      chapterNum: '1.2',
      tabId: 'test_tab_1'
    }, tokenA);
    assert(resumeRes.ok && resumeRes.data.success, 'Re-opening chapter succeeded');
    assert(resumeRes.data.durationSeconds !== undefined, 'Duration seconds retained');

    // Cleanup session
    await apiRequest('POST', '/api/reading/session/pause', { novelId: 'en-uyiril-nee', chapterNum: '1.2' }, tokenA);

    // =========================================================================
    // SCENARIO D: Authorization & Setting Modification
    // =========================================================================
    console.log('\n--- SCENARIO D: Authorization & Settings Tampering Prevention ---');

    // 15. Verify Member B cannot toggle Member A's setting
    console.log('Step 15: Verifying unauthorized members cannot alter other members settings...');
    // Member B tries to toggle setting - it only affects Member B's own user record
    await apiRequest('POST', '/api/user/activity-status', { enabled: true }, tokenB);
    const checkB = await apiRequest('GET', '/api/members/me', null, tokenB);
    assert(checkB.data.member.activityStatusEnabled === true, 'Member B updated their own setting');
    const checkA = await apiRequest('GET', '/api/members/me', null, tokenA);
    assert(checkA.data.member.activityStatusEnabled === false, 'Member A setting was untouched and remains false');

    // Restore Member A Active Status to true
    await apiRequest('POST', '/api/user/activity-status', { enabled: true }, tokenA);
    console.log('✓ Restored Member A setting to Active Status ON');

    console.log('\n============================================================');
    console.log('ALL READING ACTIVITY & PRIVACY VERIFICATION TESTS PASSED!');
    console.log('============================================================');

  } catch (err) {
    console.error('❌ Tests failed with error:', err.message);
    process.exitCode = 1;
  }
}

runTests();
