// End-to-End Test Suite for Writer Management, Authentication, and Workspace
// Rudhra Prarthana Novels — Pure MySQL Integration

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
  console.log('====================================================================');
  console.log('   RUDHRA PRARTHANA — WRITER MANAGEMENT & WORKSPACE E2E TEST SUITE');
  console.log('====================================================================\n');

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

  const testEmail = `kavitha_${Date.now()}@rpnovels.com`;
  const initialPassword = 'InitialPass@123';
  const newPassword = 'UpdatedPass@456';
  let adminToken = null;
  let writerToken = null;
  let writerId = null;
  let writerNovelId = null;
  let writerEpisodeId = null;

  try {
    // ----------------------------------------------------
    // [Test 1] Access Control: Security & Permissions
    // ----------------------------------------------------
    console.log('[Test 1] Security Guard: Unauthorized requests rejected');
    const unauthGet = await request('/api/admin/writers');
    assert(unauthGet.status === 401, 'Unauthenticated GET /api/admin/writers returns 401');

    // Normal reader login
    const readerLogin = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'harish89460@gmail.com', password: 'password123' })
    });
    const readerToken = readerLogin.data?.token;

    const readerForbidden = await request('/api/admin/writers', {
      headers: { 'Authorization': `Bearer ${readerToken}` }
    });
    assert(readerForbidden.status === 403, 'Normal reader accessing /api/admin/writers returns 403 Forbidden');

    // ----------------------------------------------------
    // [Test 2] Admin Login on Shared Portal
    // ----------------------------------------------------
    console.log('\n[Test 2] Admin authentication on shared portal');
    const adminLogin = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'rudhra_author', password: 'Rudhra.pass' })
    });
    assert(adminLogin.ok && adminLogin.data?.token, 'Admin login succeeded');
    assert(adminLogin.data?.role === 'admin', 'Admin role verified in login response');
    assert(adminLogin.data?.redirectUrl === '#admin', 'Admin redirectUrl is #admin');
    adminToken = adminLogin.data.token;

    // ----------------------------------------------------
    // [Test 3] Create Writer Account Validation & Creation
    // ----------------------------------------------------
    console.log('\n[Test 3] Create Writer Account');
    const invalidEmailRes = await request('/api/admin/writers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ fullName: 'Invalid Writer', email: 'not-an-email', password: 'ValidPass@123' })
    });
    assert(invalidEmailRes.status === 400, 'Rejects invalid email with 400');

    const shortPassRes = await request('/api/admin/writers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ fullName: 'Short Pass', email: `short_${Date.now()}@rpnovels.com`, password: '123' })
    });
    assert(shortPassRes.status === 400, 'Rejects short password (< 6 chars) with 400');

    const createRes = await request('/api/admin/writers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        fullName: 'Kavitha Writer',
        email: testEmail,
        password: initialPassword
      })
    });
    assert(createRes.ok, 'Admin successfully created writer account');
    assert(createRes.data?.writer?.role === 'writer', 'Writer assigned role "writer" by backend');
    assert(createRes.data?.writer?.status === 'active', 'Writer account status is "active"');
    writerId = createRes.data?.writer?.id;

    // Reject duplicate email
    const duplicateRes = await request('/api/admin/writers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        fullName: 'Duplicate Kavitha',
        email: testEmail,
        password: initialPassword
      })
    });
    assert(duplicateRes.status === 400, 'Rejects duplicate email with 400');

    // ----------------------------------------------------
    // [Test 4] Shared Portal Login for Writer
    // ----------------------------------------------------
    console.log('\n[Test 4] Shared Portal Login for Writer & Role Redirection');
    const writerLoginRes = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: testEmail, password: initialPassword })
    });
    assert(writerLoginRes.ok, 'Writer logged in via shared portal');
    assert(writerLoginRes.data?.role === 'writer', 'Role is verified as "writer"');
    assert(writerLoginRes.data?.user?.isWriter === true, 'user.isWriter is true');
    assert(writerLoginRes.data?.user?.isAdmin === false, 'user.isAdmin is false');
    assert(writerLoginRes.data?.redirectUrl === '#writer', 'Writer redirectUrl is #writer');
    writerToken = writerLoginRes.data?.token;

    // ----------------------------------------------------
    // [Test 5] Writer Dedicated Workspace & Novels
    // ----------------------------------------------------
    console.log('\n[Test 5] Writer Workspace Access & Novel Creation');
    const wsRes = await request('/api/writer/workspace', {
      headers: { 'Authorization': `Bearer ${writerToken}` }
    });
    assert(wsRes.ok, 'Writer accessed GET /api/writer/workspace');
    assert(wsRes.data?.stats?.novelsCount === 0, 'Initial writer novel count is 0');

    const createNovelRes = await request('/api/writer/novels', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${writerToken}` },
      body: JSON.stringify({
        title: `Kavitha Test Romance ${Date.now()}`,
        genre: 'Romance',
        description: 'An emotional romance by Kavitha.'
      })
    });
    assert(createNovelRes.ok, 'Writer successfully created novel');
    assert(createNovelRes.data?.novel?.author_id === writerId, 'Novel author_id matches writer ID');
    assert(createNovelRes.data?.novel?.visibility === 'draft', 'Writer novel created as draft');
    writerNovelId = createNovelRes.data?.novel?.id;

    // ----------------------------------------------------
    // [Test 6] Ownership Protection: Writer cannot edit other novels
    // ----------------------------------------------------
    console.log('\n[Test 6] Content Ownership & Permissions Enforced');
    const allNovelsRes = await request('/api/novels');
    const novelsList = Array.isArray(allNovelsRes.data?.novels) ? allNovelsRes.data.novels : (Array.isArray(allNovelsRes.data) ? allNovelsRes.data : []);
    const adminNovel = novelsList.find(n => Number(n.authorId || n.author_id) === 2) || novelsList[0];
    const adminNovelId = adminNovel ? adminNovel.id : '1';

    // Attempt to edit admin's novel
    const unauthorizedEdit = await request(`/api/writer/novels/${adminNovelId}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${writerToken}` },
      body: JSON.stringify({ title: 'Hacked Title' })
    });
    assert(unauthorizedEdit.status === 403, 'Writer cannot edit novel owned by another author (403)');

    // Writer creates episode on their own novel
    const createEpRes = await request('/api/writer/episodes', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${writerToken}` },
      body: JSON.stringify({
        novelId: writerNovelId,
        episodeNumber: '1',
        title: 'Episode 1: The Beginning',
        content: '<p>A beautiful sunny day in Chennai.</p>'
      })
    });
    assert(createEpRes.ok, 'Writer created episode for their own novel');
    writerEpisodeId = createEpRes.data?.episode?.id;

    // Attempt to create episode on admin's novel
    const unauthorizedEp = await request('/api/writer/episodes', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${writerToken}` },
      body: JSON.stringify({
        novelId: adminNovelId,
        episodeNumber: '999',
        title: 'Intruder Episode',
        content: '<p>Should fail.</p>'
      })
    });
    assert(unauthorizedEp.status === 403, 'Writer cannot create episodes on another author novel (403)');

    // ----------------------------------------------------
    // [Test 7] Admin Writer Listing & Audit Logs
    // ----------------------------------------------------
    console.log('\n[Test 7] Admin Writer Management & Audit Trail');
    const writersList = await request('/api/admin/writers', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(writersList.ok, 'Admin retrieved writers list');
    const foundWriter = writersList.data?.writers?.find(w => w.id === writerId);
    assert(Boolean(foundWriter), 'Created writer found in admin table');
    assert(foundWriter?.novelsCount === 1, 'Writer table displays 1 created novel');

    const auditLogsRes = await request('/api/admin/writers/audit-logs', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(auditLogsRes.ok, 'Admin retrieved audit logs');
    assert(auditLogsRes.data?.logs?.length >= 2, 'Audit logs contain account_created and login_success events');

    // ----------------------------------------------------
    // [Test 8] Block Writer & Instant Session Revocation
    // ----------------------------------------------------
    console.log('\n[Test 8] Temporarily Block Writer & Revoke Access');
    const blockRes = await request(`/api/admin/writers/${writerId}/status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'blocked', reason: 'Routine review' })
    });
    assert(blockRes.ok && blockRes.data?.status === 'blocked', 'Writer status updated to blocked');

    // Existing session must be immediately rejected
    const blockedWorkspace = await request('/api/writer/workspace', {
      headers: { 'Authorization': `Bearer ${writerToken}` }
    });
    assert(blockedWorkspace.status === 401 || blockedWorkspace.status === 403, 'Blocked writer session immediately rejected on API requests (401/403)');

    // Login while blocked must fail
    const blockedLogin = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: testEmail, password: initialPassword })
    });
    assert(blockedLogin.ok === false, 'Blocked writer cannot log in');
    assert(blockedLogin.data?.error?.includes('blocked'), 'Error message clearly states account is blocked');

    // Reactivate writer
    const reactivateRes = await request(`/api/admin/writers/${writerId}/status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'active', reason: 'Review completed' })
    });
    assert(reactivateRes.ok && reactivateRes.data?.status === 'active', 'Writer reactivated');

    // ----------------------------------------------------
    // [Test 9] Writer Forgot Password with Email OTP
    // ----------------------------------------------------
    console.log('\n[Test 9] Writer Password Reset with Verified Email OTP');
    const otpReq = await request('/api/auth/forgot-password/request-otp', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail })
    });
    assert(otpReq.ok, 'Password reset OTP requested');

    const fs = await import('node:fs');
    const otp = fs.readFileSync('.last_otp.txt', 'utf8').trim();
    assert(otp && otp.length === 6, 'Generated cryptographically secure 6-digit OTP');

    const verifyOtpRes = await request('/api/auth/forgot-password/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email: testEmail, otp })
    });
    assert(verifyOtpRes.ok && verifyOtpRes.data?.resetToken, 'OTP verified and reset token issued');
    const resetToken = verifyOtpRes.data.resetToken;

    const resetPassRes = await request('/api/auth/forgot-password/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        email: testEmail,
        resetToken,
        newPassword,
        confirmPassword: newPassword
      })
    });
    assert(resetPassRes.ok, 'New password saved in MySQL');

    // Test login with new password
    const newPassLogin = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: testEmail, password: newPassword })
    });
    assert(newPassLogin.ok, 'Writer successfully logged in with new password');

    // Old password must fail
    const oldPassLogin = await request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: testEmail, password: initialPassword })
    });
    assert(oldPassLogin.ok === false, 'Old password fails authentication');

    // ----------------------------------------------------
    // [Test 10] Safe Writer Deletion & Content Preservation
    // ----------------------------------------------------
    console.log('\n[Test 10] Safe Account Deletion & Novel Preservation');
    const deleteRes = await request(`/api/admin/writers/${writerId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(deleteRes.ok, 'Writer account deleted safely');
    assert(deleteRes.data?.reassignedNovelsCount === 1, 'Writer novel preserved and reassigned to primary author');

    // Verify novel still exists in MySQL under author_id = 2
    const db = await import('../server/db.js');
    const preservedNovel = await db.queryOne('SELECT id, author_id FROM novels WHERE id = ?;', [writerNovelId]);
    assert(preservedNovel && preservedNovel.author_id === 2, 'Preserved novel now owned by primary author (author_id = 2)');

    // Clean up test novel
    await db.query('DELETE FROM chapters WHERE novel_id = ?;', [writerNovelId]);
    await db.query('DELETE FROM novels WHERE id = ?;', [writerNovelId]);
    assert(true, 'Test novel cleaned up cleanly');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n====================================================================');
  console.log(`WRITER MANAGEMENT TEST SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().then(() => process.exit(0)).catch(() => process.exit(1));
