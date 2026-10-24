// Comprehensive Verification Script: Real-Time Members Online and Guest Counter
// Rudhra Prarthana Novels

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('=================================================================');
  console.log('   VERIFYING REAL-TIME MEMBERS ONLINE AND GUEST COUNTER FLOW');
  console.log('=================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  const testGuestId1 = `gst_${Date.now()}_a1b2c3`;
  const testGuestId2 = `gst_${Date.now()}_d4e5f6`;

  try {
    // 1. Initial State Check
    console.log('[TEST 1] Initial GET /api/presence endpoint structure');
    const initRes = await request('/api/presence');
    assert(initRes.ok, 'GET /api/presence returns 200 OK');
    assert(typeof initRes.data?.membersOnline === 'number', 'membersOnline is a number');
    assert(typeof initRes.data?.guestsOnline === 'number', 'guestsOnline is a number');
    assert(typeof initRes.data?.totalOnline === 'number', 'totalOnline is a number');
    assert(initRes.data.totalOnline === initRes.data.membersOnline + initRes.data.guestsOnline, 'totalOnline equals members + guests');
    assert(Array.isArray(initRes.data?.visibleMembers), 'visibleMembers is an array');

    const baselineGuests = initRes.data.guestsOnline;
    const baselineMembers = initRes.data.membersOnline;

    // 2. Guest 1 Heartbeat Ping
    console.log('\n[TEST 2] Guest 1 Heartbeat Ping');
    const g1Ping = await request('/api/presence/ping', {
      method: 'POST',
      body: JSON.stringify({ guestId: testGuestId1 })
    });
    assert(g1Ping.ok, 'Guest 1 ping returns 200 OK');
    assert(g1Ping.data.guestsOnline === baselineGuests + 1, `Guest count incremented by 1 (${baselineGuests} -> ${g1Ping.data.guestsOnline})`);
    assert(g1Ping.data.totalOnline === g1Ping.data.membersOnline + g1Ping.data.guestsOnline, 'Total online matches sum');

    // 3. Guest 1 Deduplication Check (multiple pings from same guest)
    console.log('\n[TEST 3] Guest 1 repeated pings deduplication');
    for (let i = 0; i < 4; i++) {
      await request('/api/presence/ping', {
        method: 'POST',
        body: JSON.stringify({ guestId: testGuestId1 })
      });
    }
    const dedupRes = await request('/api/presence');
    assert(dedupRes.data.guestsOnline === baselineGuests + 1, `Repeated pings did not inflate guest count (still ${dedupRes.data.guestsOnline})`);

    // 4. Guest 2 Heartbeat Ping
    console.log('\n[TEST 4] Guest 2 Heartbeat Ping (second distinct visitor)');
    const g2Ping = await request('/api/presence/ping', {
      method: 'POST',
      body: JSON.stringify({ guestId: testGuestId2 })
    });
    assert(g2Ping.ok, 'Guest 2 ping returns 200 OK');
    assert(g2Ping.data.guestsOnline === baselineGuests + 2, `Guest count is now baseline + 2 (${g2Ping.data.guestsOnline})`);

    // 5. Authenticated Member Login
    console.log('\n[TEST 5] Authenticated Member Login & Presence');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'harish89460@gmail.com',
        password: 'password123'
      })
    });
    assert(loginRes.ok && loginRes.data?.token, 'Member login succeeded with token');
    const memberToken = loginRes.data.token;
    const memberUser = loginRes.data.user;

    // 6. Member Heartbeat Ping (transitioning from guest 1 to member)
    console.log('\n[TEST 6] Member ping with guestId transition');
    const memPing = await request('/api/presence/ping', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${memberToken}` },
      body: JSON.stringify({ guestId: testGuestId1 })
    });
    assert(memPing.ok, 'Member ping returns 200 OK');
    assert(memPing.data.isMember === true, 'Response identifies client as authenticated member');
    assert(memPing.data.membersOnline >= 1, `Members online is at least 1 (${memPing.data.membersOnline})`);
    assert(memPing.data.guestsOnline === baselineGuests + 1, `Guest 1 was transitioned to member and deduplicated (guests back to baseline + 1: ${memPing.data.guestsOnline})`);
    assert(memPing.data.totalOnline === memPing.data.membersOnline + memPing.data.guestsOnline, 'Total online matches members + guests');

    // 7. Privacy & Profile Visibility Verification
    console.log('\n[TEST 7] Privacy & Safe Member Display');
    const visibleMember = memPing.data.visibleMembers.find(m => m.id === memberUser.id);
    assert(Boolean(visibleMember), 'Logged-in member is included in visibleMembers');
    if (visibleMember) {
      assert(visibleMember.displayName && typeof visibleMember.displayName === 'string', 'Member has valid displayName');
      assert(visibleMember.avatar && typeof visibleMember.avatar === 'string', 'Member has safe avatar reference');
      assert(visibleMember.isOnline === true, 'Member has isOnline === true');
      // Crucial privacy checks:
      assert(!visibleMember.email, 'CRITICAL PRIVACY: Member email is NOT exposed');
      assert(!visibleMember.password_hash, 'CRITICAL PRIVACY: Member password_hash is NOT exposed');
      assert(!visibleMember.salt, 'CRITICAL PRIVACY: Member salt is NOT exposed');
      assert(!visibleMember.token, 'CRITICAL PRIVACY: Session token is NOT exposed');
      assert(!visibleMember.ip, 'CRITICAL PRIVACY: IP address is NOT exposed');
    }

    // 8. Deduplication Across Tabs for Member
    console.log('\n[TEST 8] Member repeated pings across multiple simulated tabs');
    const beforeMemberCount = memPing.data.membersOnline;
    for (let i = 0; i < 5; i++) {
      await request('/api/presence/ping', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${memberToken}` },
        body: JSON.stringify({})
      });
    }
    const memDedupRes = await request('/api/presence');
    assert(memDedupRes.data.membersOnline === beforeMemberCount, `Member count did not inflate with repeated requests (still ${memDedupRes.data.membersOnline})`);

    // 9. Logout and Real-Time Presence Invalidation
    console.log('\n[TEST 9] Member Logout and Presence Invalidation');
    const logoutRes = await request('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    assert(logoutRes.ok, 'POST /api/auth/logout succeeded');

    const afterLogoutRes = await request('/api/presence');
    const memberAfterLogout = afterLogoutRes.data.visibleMembers.find(m => m.id === memberUser.id);
    assert(!memberAfterLogout, 'Logged-out member is immediately removed from visible online members');
    assert(afterLogoutRes.data.membersOnline === beforeMemberCount - 1, `Member count decremented by 1 after logout (${beforeMemberCount} -> ${afterLogoutRes.data.membersOnline})`);

    // 10. Database Cleanup
    console.log('\n[TEST 10] Cleanup test presence records');
    const db = await import('../server/db.js');
    await db.query('DELETE FROM user_presence WHERE session_key IN (?, ?)', [
      `guest_${testGuestId1}`,
      `guest_${testGuestId2}`
    ]);
    assert(true, 'Test presence records cleaned up cleanly from MySQL database');

  } catch (err) {
    console.error('Test run error:', err);
    failed++;
  }

  console.log('\n=================================================================');
  console.log(`PRESENCE VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('=================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().then(() => process.exit(0)).catch(() => process.exit(1));
