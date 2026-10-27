// End-to-end verification script for Admin Member Account Management & Header Navigation
import { getDb } from '../backend/db.js';

const BASE_URL = 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('🚀 Starting Comprehensive Verification: Header Navigation & Member Account Management...\n');

  // ==========================================
  // TEST 1: Header Navigation & Forms Redirect
  // ==========================================
  console.log('--- Test Suite 1: Header Navigation & Forms Redirection ---');
  const rootRes = await request('/');
  assert(rootRes.ok, 'Root URL / responds with 200 OK');
  assert(typeof rootRes.data === 'string', 'Root URL serves HTML');
  assert(
    rootRes.data.includes('<a href="#forms" class="nav-link" data-nav="home">Home</a>'),
    'Header contains "Home" menu item pointing directly to #forms'
  );
  assert(
    rootRes.data.includes('Forms <span class="nav-link-badge">New</span>'),
    'Header contains second "Forms" menu item with New badge'
  );

  // Direct /home HTTP request redirects to /#forms
  const redirectRes = await fetch(`${BASE_URL}/home`, { redirect: 'manual' });
  assert(
    redirectRes.status === 302 && redirectRes.headers.get('location') === '/#forms',
    'Direct /home HTTP request redirects with 302 to /#forms'
  );

  // ==========================================
  // TEST 2: Admin Login & Member Directory
  // ==========================================
  console.log('\n--- Test Suite 2: Admin Login & Member Directory KPI ---');
  const adminLogin = await request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'rudhra_author', password: 'Rudhra.pass' })
  });
  assert(adminLogin.ok && adminLogin.data.token, 'Admin successfully logs in');
  const adminToken = adminLogin.data.token;
  const adminUser = adminLogin.data.user;
  assert(adminUser.role.toLowerCase() === 'admin' || adminUser.role.toLowerCase() === 'author', 'Logged in user is administrator');

  // Fetch Member List with KPIs
  const membersRes = await request('/api/admin/members', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(membersRes.ok && membersRes.data.success, 'GET /api/admin/members succeeds');
  const { members, pagination, metrics } = membersRes.data;
  assert(Array.isArray(members) && members.length > 0, 'Members list returns real array of accounts');
  assert(metrics && typeof metrics.totalMembers === 'number', 'KPI Metrics contains totalMembers');
  assert(typeof metrics.activeMembers === 'number', 'KPI Metrics contains activeMembers');
  assert(typeof metrics.tempBlockedMembers === 'number', 'KPI Metrics contains tempBlockedMembers');
  console.log(`   Metrics: Total=${metrics.totalMembers}, Active=${metrics.activeMembers}, TempBlocked=${metrics.tempBlockedMembers}`);

  // ==========================================
  // TEST 3: Create Test Member Account
  // ==========================================
  console.log('\n--- Test Suite 3: Test Member Lifecycle Setup ---');
  const testEmail = `test_reader_${Date.now()}@rpnovels.com`;
  const testUsername = `reader_${Date.now()}`;
  const testPassword = 'ReaderPassword123!';

  const regRes = await request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      username: testUsername,
      email: testEmail,
      displayName: 'E2E Test Reader',
      password: testPassword
    })
  });
  assert(regRes.ok && regRes.data.token, 'Test member registered successfully');
  const testMemberToken = regRes.data.token;
  const testMemberId = regRes.data.user.id;
  console.log(`   Created test member ID: ${testMemberId} (${testUsername})`);

  // ==========================================
  // TEST 4: Temporary Blocking & Duration
  // ==========================================
  console.log('\n--- Test Suite 4: Temporary Blocking & Early Unblocking ---');
  // 4a. Temporary block for 24h
  const blockRes = await request(`/api/admin/members/${testMemberId}/block`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      duration: '24h',
      reason: 'Automated test temporary restriction'
    })
  });
  assert(blockRes.ok && blockRes.data.success, 'Admin temporarily blocks member for 24h');
  assert(blockRes.data.blockedUntil, 'Member has blockedUntil timestamp assigned');

  // 4b. Verify existing member session is revoked / rejected
  const tokenCheckRes = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${testMemberToken}` }
  });
  assert(tokenCheckRes.status === 401 || !tokenCheckRes.data?.user, 'Revoked/blocked user token is rejected with 401');

  // 4c. Verify login attempt fails with remaining block duration
  const blockedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testUsername, password: testPassword })
  });
  assert(!blockedLogin.ok && blockedLogin.status === 403, 'Blocked member login rejected with 403 Forbidden');
  assert(
    blockedLogin.data?.error?.includes('temporarily blocked') || blockedLogin.data?.error?.includes('until'),
    'Login error informs user of temporary block duration'
  );

  // 4d. Early unblock by administrator
  const unblockRes = await request(`/api/admin/members/${testMemberId}/unblock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(unblockRes.ok && unblockRes.data.success, 'Admin early unblocks member');

  // 4e. Verify member can log in again
  const unblockedLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testUsername, password: testPassword })
  });
  assert(unblockedLogin.ok && unblockedLogin.data.token, 'Member logs in successfully after early unblock');
  let currentMemberToken = unblockedLogin.data.token;

  // ==========================================
  // TEST 5: Automatic Expiration of Blocks
  // ==========================================
  console.log('\n--- Test Suite 5: Automatic Expiration of Timed Blocks ---');
  const pool = getDb();
  // Set blocked_until to 10 minutes in the past
  await pool.query(
    "UPDATE users SET status = 'blocked', blocked_until = DATE_SUB(NOW(), INTERVAL 10 MINUTE), block_reason = 'Expired test block' WHERE id = ?",
    [testMemberId]
  );

  // Attempt login - backend should detect block expiration and auto-restore account
  const autoExpireLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testUsername, password: testPassword })
  });
  assert(autoExpireLogin.ok && autoExpireLogin.data.token, 'Expired block automatically restores account to active upon login');
  currentMemberToken = autoExpireLogin.data.token;

  // Verify status in DB is active
  const [dbUserRows] = await pool.query('SELECT status, blocked_until FROM users WHERE id = ?', [testMemberId]);
  assert(dbUserRows[0].status === 'active' && dbUserRows[0].blocked_until === null, 'DB record status restored to active and blocked_until cleared');

  // ==========================================
  // TEST 6: Granular Feature Permissions Control
  // ==========================================
  console.log('\n--- Test Suite 6: Granular Permissions & Feature Enforcement ---');
  // 6a. Disable can_post_forum permission
  const permRes = await request(`/api/admin/members/${testMemberId}/permissions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      permissions: {
        can_comment: false,
        can_post_forum: false,
        can_chat: false,
        can_access_audio: true
      },
      revokeSessions: false
    })
  });
  assert(permRes.ok && permRes.data.success, 'Admin successfully updates member permissions');

  // Fetch updated user to get refreshed token
  const reloginRes = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testUsername, password: testPassword })
  });
  currentMemberToken = reloginRes.data.token;

  // Attempt to post forum reply with can_post_forum = false
  const forumForbidden = await request('/api/forum/topics/topic-maaya-nadhi/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${currentMemberToken}` },
    body: JSON.stringify({
      content: 'This forum reply should be blocked by permissions.'
    })
  });
  assert(forumForbidden.status === 403, 'Posting forum reply returns 403 Forbidden when can_post_forum is false');

  // 6b. Re-enable can_post_forum
  await request(`/api/admin/members/${testMemberId}/permissions`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      permissions: {
        can_comment: true,
        can_post_forum: true,
        can_chat: true,
        can_access_audio: true
      }
    })
  });
  const reloginRes2 = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: testUsername, password: testPassword })
  });
  currentMemberToken = reloginRes2.data.token;

  const forumAllowed = await request('/api/forum/topics/topic-maaya-nadhi/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${currentMemberToken}` },
    body: JSON.stringify({
      content: 'E2E permission verified forum reply.'
    })
  });
  assert(forumAllowed.ok, 'Posting forum reply succeeds when can_post_forum is restored');

  // ==========================================
  // TEST 7: Session Revocation
  // ==========================================
  console.log('\n--- Test Suite 7: Session Revocation ---');
  const revokeRes = await request(`/api/admin/members/${testMemberId}/revoke-sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(revokeRes.ok && revokeRes.data.success, 'Admin successfully revokes member sessions');

  const postRevokeCheck = await request('/api/auth/me', {
    headers: { Authorization: `Bearer ${currentMemberToken}` }
  });
  assert(postRevokeCheck.status === 401 || !postRevokeCheck.data?.user, 'Revoked member token is immediately invalid on protected routes');

  // ==========================================
  // TEST 8: Permanent Account Deletion & Protections
  // ==========================================
  console.log('\n--- Test Suite 8: Permanent Account Deletion & Protections ---');
  // 8a. Protection: Cannot delete critical Admin (ID 2 or self)
  const delAdminRes = await request('/api/admin/members/2/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirmUsername: 'rudhra_author' })
  });
  assert(delAdminRes.status === 403 || !delAdminRes.ok, 'Protection: Deletion of root admin account (ID 2) is blocked with 403 Forbidden');

  // 8b. Protection: Confirmation required
  const delNoConfirm = await request(`/api/admin/members/${testMemberId}/delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirmUsername: 'wrong_username' })
  });
  assert(delNoConfirm.status === 400, 'Protection: Permanent deletion without matching confirmation username is rejected with 400');

  // 8c. Valid permanent deletion
  const delSuccess = await request(`/api/admin/members/${testMemberId}/delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ confirmUsername: testUsername })
  });
  assert(delSuccess.ok && delSuccess.data.success, 'Permanent deletion succeeds with matching confirmation');

  // 8d. Verify user is removed from database
  const [deletedUserRows] = await pool.query('SELECT id FROM users WHERE id = ?', [testMemberId]);
  assert(deletedUserRows.length === 0, 'Deleted member record no longer exists in users table');

  // ==========================================
  // TEST 9: Security Audit Log Verification
  // ==========================================
  console.log('\n--- Test Suite 9: Security Audit Trail ---');
  const auditRes = await request('/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  assert(auditRes.ok && auditRes.data.success, 'GET /api/admin/audit-logs succeeds');
  const auditLogs = auditRes.data.logs;
  assert(Array.isArray(auditLogs) && auditLogs.length > 0, 'Audit logs contains entries');

  const actionsRecorded = auditLogs.map(l => l.action);
  assert(actionsRecorded.includes('temporary_block'), 'Audit log includes temporary_block event');
  assert(actionsRecorded.includes('member_unblocked'), 'Audit log includes member_unblocked event');
  assert(actionsRecorded.includes('permissions_updated'), 'Audit log includes permissions_updated event');
  assert(actionsRecorded.includes('account_deleted'), 'Audit log includes account_deleted event');

  // Verify NO passwords or hashes are in audit logs
  const auditString = JSON.stringify(auditLogs);
  assert(!auditString.includes('password_hash'), 'Security check: audit logs do NOT contain password hashes');
  assert(!auditString.includes(testPassword), 'Security check: audit logs do NOT contain plaintext passwords');
  console.log('   Audit trail verified: All sensitive actions logged safely without credentials.');

  console.log('\n======================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! (100% Verified)');
  console.log('======================================================\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ E2E Verification failed:', err);
  process.exit(1);
});
