// Comprehensive End-to-End Automated Verification Test Suite
// Admin Member Management, Password Reset Without OTP, Access Controls, & Audit Logs
// Rudhra Prarthana Novels

import { createSession, loginUser } from '../backend/auth.js';
import { query, queryOne } from '../backend/db.js';

const BASE_URL = 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function api(method, path, body = null, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data = null;
  try {
    data = await res.json();
  } catch (_) {}

  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('================================================================');
  console.log('STARTING ADMIN MEMBER MANAGEMENT & SECURITY VERIFICATION SUITE');
  console.log('================================================================');

  let testUserId = null;
  const adminToken = await createSession(2, 'author');
  const readerToken = await createSession(28, 'reader'); // non-admin reader session

  try {
    // -----------------------------------------------------------
    // TEST 1: AUTHORIZATION & PERMISSION GUARDS
    // -----------------------------------------------------------
    console.log('\n--- 1. Testing Admin Authorization Protection ---');

    // 1a. Unauthenticated access
    const unauthRes = await api('GET', '/api/admin/members');
    assert(unauthRes.status === 401, 'Unauthenticated request to /api/admin/members returns 401 Unauthorized');

    // 1b. Regular member access (privilege escalation attempt)
    const readerRes = await api('GET', '/api/admin/members', null, readerToken);
    assert(readerRes.status === 403, 'Regular reader accessing /api/admin/members returns 403 Forbidden');

    const readerCreate = await api('POST', '/api/admin/members', { email: 'hack@test.com' }, readerToken);
    assert(readerCreate.status === 403, 'Regular reader cannot create member accounts (403 Forbidden)');

    // 1c. Authorized admin access
    const adminRes = await api('GET', '/api/admin/members', null, adminToken);
    assert(adminRes.status === 200 && adminRes.data.success, 'Authorized Admin successfully accesses /api/admin/members');
    assert(adminRes.data.metrics && adminRes.data.metrics.totalMembers > 0, 'Real database metrics returned');

    // -----------------------------------------------------------
    // TEST 2: ACCOUNT CREATION & PASSWORD HASHING
    // -----------------------------------------------------------
    console.log('\n--- 2. Testing Member Account Creation ---');

    const testEmail = `test.member.${Date.now()}@rpnovels-test.com`;
    const initialPassword = 'InitialSecurePass123!';

    const createRes = await api('POST', '/api/admin/members', {
      displayName: 'Test Automated Member',
      email: testEmail,
      username: `test_auto_${Date.now().toString().slice(-6)}`,
      password: initialPassword,
      confirmPassword: initialPassword,
      role: 'Member',
      status: 'active'
    }, adminToken);

    assert(createRes.status === 201 && createRes.data.success, 'Member account created successfully via Admin API (201 Created)');
    testUserId = createRes.data.member.id;
    assert(testUserId > 0, `Created member received valid database ID: #${testUserId}`);

    // Verify plaintext password is NEVER returned in response
    assert(!createRes.data.password && !createRes.data.member.password, 'Plaintext password is NOT exposed in API response');
    assert(!createRes.data.password_hash && !createRes.data.member.password_hash, 'Password hash is NOT exposed in API response');

    // Verify database record
    const userRow = await queryOne('SELECT * FROM users WHERE id = ?;', [testUserId]);
    assert(userRow !== null, 'Member record verified in MySQL users table');
    assert(userRow.email === testEmail.toLowerCase(), 'Registered email correctly stored in lowercase');
    assert(userRow.password_hash !== initialPassword, 'Password is cryptographically hashed (not stored in plaintext)');
    assert(userRow.salt && userRow.salt.length === 32, 'Cryptographic salt present');
    assert(userRow.status === 'active', 'Initial status set to active');
    assert(userRow.created_by === 2, 'Assigned created_by = 2 (Admin ID)');

    // Verify duplicate email rejection
    const duplicateRes = await api('POST', '/api/admin/members', {
      displayName: 'Duplicate Test',
      email: testEmail,
      password: 'AnotherPassword123!',
      role: 'Member'
    }, adminToken);
    assert(duplicateRes.status === 400 && !duplicateRes.data.success, 'Duplicate email address rejected with 400 Bad Request');

    // Verify initial login works
    const initialLogin = await loginUser({ identifier: testEmail, password: initialPassword });
    assert(initialLogin.success === true, 'New member can authenticate successfully with initial password');
    const initialToken = initialLogin.token;

    // -----------------------------------------------------------
    // TEST 3: EDIT MEMBER DETAILS & IMMUTABILITY
    // -----------------------------------------------------------
    console.log('\n--- 3. Testing Member Details Modification ---');

    const updatedName = 'Updated Member Name';
    const updatedEmail = `updated.${Date.now()}@rpnovels-test.com`;

    const editRes = await api('PUT', `/api/admin/members/${testUserId}`, {
      displayName: updatedName,
      email: updatedEmail,
      bio: 'Enthusiastic Tamil literature reader.'
    }, adminToken);

    assert(editRes.status === 200 && editRes.data.success, 'Admin updated member details successfully');

    // Verify persistence in MySQL
    const updatedUser = await queryOne('SELECT u.email, p.display_name, p.bio FROM users u LEFT JOIN profiles p ON u.id = p.user_id WHERE u.id = ?;', [testUserId]);
    assert(updatedUser.email === updatedEmail, 'Updated email persisted in database');
    assert(updatedUser.display_name === updatedName, 'Updated display name persisted in profiles');
    assert(updatedUser.bio === 'Enthusiastic Tamil literature reader.', 'Updated bio persisted in profiles');

    // -----------------------------------------------------------
    // TEST 4: ADMIN PASSWORD RESET WITHOUT MEMBER OTP
    // -----------------------------------------------------------
    console.log('\n--- 4. Testing Admin Password Reset (Without Member OTP) ---');

    const brandNewPassword = 'BrandNewSecret2026!#';

    const resetRes = await api('POST', `/api/admin/members/${testUserId}/reset-password`, {
      newPassword: brandNewPassword,
      confirmPassword: brandNewPassword
    }, adminToken);

    assert(resetRes.status === 200 && resetRes.data.success, 'Admin password reset succeeded without requiring member OTP');
    assert(resetRes.data.revokedSessionsCount !== undefined, 'Revoked sessions count reported');

    // Verify plaintext password or hash is NEVER returned
    assert(!resetRes.data.newPassword && !resetRes.data.password_hash, 'Password and hash strictly absent from response');

    // Verify NEW password works for login
    const newLogin = await loginUser({ identifier: updatedEmail, password: brandNewPassword });
    assert(newLogin.success === true, 'Member successfully logs in with NEW password set by Admin');

    // Verify OLD password is now REJECTED
    const oldLogin = await loginUser({ identifier: updatedEmail, password: initialPassword });
    assert(oldLogin.success === false, 'Old password is confirmed invalid and rejected');

    // -----------------------------------------------------------
    // TEST 5: ACCESS CONTROLS (SUSPEND / BLOCK / REACTIVATE)
    // -----------------------------------------------------------
    console.log('\n--- 5. Testing Account Access Controls & Session Invalidation ---');

    // Create an active session for the test member
    const activeMemberToken = await createSession(testUserId, 'reader');
    assert(activeMemberToken !== null, 'Active reader session token created for test member');

    // Suspend the account
    const suspendRes = await api('POST', `/api/admin/members/${testUserId}/status`, {
      status: 'suspended',
      reason: 'Security compliance test suspension'
    }, adminToken);
    assert(suspendRes.status === 200 && suspendRes.data.success, 'Account marked as suspended');

    // Verify suspended member CANNOT log in
    const suspendedLogin = await loginUser({ identifier: updatedEmail, password: brandNewPassword });
    assert(suspendedLogin.success === false, 'Suspended member CANNOT log in (rejected at authentication)');
    assert(suspendedLogin.error.includes('deactivated or suspended'), 'Appropriate suspension error message returned');

    // Verify prior active sessions were REVOKED
    const activeSessions = await query('SELECT * FROM sessions WHERE user_id = ?;', [testUserId]);
    assert(activeSessions.length === 0, 'All active sessions for suspended member were immediately revoked');

    // Reactivate account
    const reactivateRes = await api('POST', `/api/admin/members/${testUserId}/status`, {
      status: 'active'
    }, adminToken);
    assert(reactivateRes.status === 200 && reactivateRes.data.success, 'Account successfully reactivated');

    // Verify reactivated account CAN log in again
    const reactivatedLogin = await loginUser({ identifier: updatedEmail, password: brandNewPassword });
    assert(reactivatedLogin.success === true, 'Reactivated member can log in again');

    // -----------------------------------------------------------
    // TEST 6: PRIMARY ADMIN ACCOUNT PROTECTION
    // -----------------------------------------------------------
    console.log('\n--- 6. Testing Primary Administrator Protection ---');

    // Attempt to suspend primary admin (ID 2)
    const attackAdminSuspend = await api('POST', '/api/admin/members/2/status', {
      status: 'blocked'
    }, adminToken);
    assert(attackAdminSuspend.status === 400 && !attackAdminSuspend.data.success, 'Primary Administrator cannot be blocked or suspended');

    // Attempt to demote primary admin
    const attackAdminDemote = await api('PUT', '/api/admin/members/2', {
      role: 'Member'
    }, adminToken);
    assert(attackAdminDemote.status === 400 && !attackAdminDemote.data.success, 'Primary Administrator cannot be demoted');

    // -----------------------------------------------------------
    // TEST 7: AUDIT LOGS RECORDING & SENSITIVE DATA PROTECTION
    // -----------------------------------------------------------
    console.log('\n--- 7. Testing Security Audit Logs ---');

    const auditRes = await api('GET', `/api/admin/members/audit-logs?targetUserId=${testUserId}`, null, adminToken);
    assert(auditRes.status === 200 && auditRes.data.success, 'Audit logs retrieved successfully');
    const logs = auditRes.data.logs;
    assert(logs.length >= 3, `Recorded ${logs.length} audit log entries for target member`);

    const actions = logs.map(l => l.action);
    assert(actions.includes('member_created'), 'Audit log includes "member_created" event');
    assert(actions.includes('member_updated'), 'Audit log includes "member_updated" event');
    assert(actions.includes('password_reset'), 'Audit log includes "password_reset" event');

    // Verify NO passwords or hashes in audit log details or metadata
    for (const log of logs) {
      const logStr = JSON.stringify(log);
      assert(!logStr.includes(initialPassword), 'Audit log strictly does NOT contain initial password');
      assert(!logStr.includes(brandNewPassword), 'Audit log strictly does NOT contain reset password');
    }

    // -----------------------------------------------------------
    // TEST 8: SEARCH, FILTERING, & SORTING
    // -----------------------------------------------------------
    console.log('\n--- 8. Testing Search, Filtering, and Pagination ---');

    // Search by email prefix
    const searchRes = await api('GET', `/api/admin/members?search=${encodeURIComponent(updatedEmail.slice(0, 15))}`, null, adminToken);
    assert(searchRes.status === 200 && searchRes.data.total >= 1, 'Search by email prefix returns matching member');

    // Filter by role
    const roleFilterRes = await api('GET', '/api/admin/members?role=writer', null, adminToken);
    assert(roleFilterRes.status === 200, 'Filter by role=writer executed successfully');
    assert(roleFilterRes.data.members.every(m => m.role.toLowerCase() === 'writer'), 'All returned records have role="writer"');

    // Pagination
    const pageRes = await api('GET', '/api/admin/members?limit=2&page=1', null, adminToken);
    assert(pageRes.status === 200 && pageRes.data.members.length <= 2, 'Pagination limit=2 respected');

    // -----------------------------------------------------------
    // TEST 9: REGRESSION TESTING (EXISTING NOVELS & READERS)
    // -----------------------------------------------------------
    console.log('\n--- 9. Testing Regression & System Compatibility ---');

    const novelsRes = await api('GET', '/api/novels');
    assert(novelsRes.status === 200 && novelsRes.data.success, 'Public novels API functions normally');

    const episodesRes = await api('GET', '/api/novels/en-uyiril-nee/episodes');
    assert(episodesRes.status === 200 && episodesRes.data.success, 'Novel episodes API functions normally');

    console.log('\n================================================================');
    console.log('ALL ADMIN MEMBER MANAGEMENT & SECURITY TESTS PASSED SUCCESSFULLY');
    console.log('================================================================');
  } finally {
    // Cleanup test user and test audit logs safely
    if (testUserId) {
      console.log(`\nCleaning up test member #${testUserId}...`);
      await query('DELETE FROM admin_audit_logs WHERE target_user_id = ?;', [testUserId]);
      await query('DELETE FROM profiles WHERE user_id = ?;', [testUserId]);
      await query('DELETE FROM activity_status WHERE user_id = ?;', [testUserId]);
      await query('DELETE FROM users WHERE id = ?;', [testUserId]);
      console.log('✓ Test member deleted cleanly.');
    }
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
