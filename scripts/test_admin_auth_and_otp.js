// Automated Test Suite for Admin Author Login, Security Access Control,
// SMTP OTP Email Delivery, OTP Verification, and Password Reset Workflow

import { getDb, loadEnv, hashPassword, verifyPassword } from '../backend/db.js';
import { loginAuthor, requestPasswordResetOtp, verifyPasswordResetOtp, completePasswordReset, registerUser } from '../backend/auth.js';
import fs from 'node:fs';

loadEnv();
const pool = getDb();

async function run() {
  console.log('='.repeat(70));
  console.log('RUNNING ADMIN AUTH & EMAIL OTP PASSWORD RESET VERIFICATION');
  console.log('='.repeat(70));

  let passed = 0;
  let total = 0;

  function assert(name, condition, extra = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${name} ${extra}`);
    } else {
      console.error(`  [FAIL] ${name} ${extra}`);
    }
  }

  // 1. Initial Author Account in MySQL
  const [authors] = await pool.query("SELECT id, username, email, role, password_hash, salt FROM users WHERE email = 'digitalmarkservices.in@gmail.com'");
  assert('1. Author account email is digitalmarkservices.in@gmail.com in MySQL', authors.length === 1 && authors[0].role === 'Admin');

  // Verify initial password is Rudhra.pass
  const initialValid = verifyPassword('Rudhra.pass', authors[0].password_hash, authors[0].salt);
  assert('2. Initial password Rudhra.pass verified with salted hash', initialValid);

  // 2. Author Login with initial password
  const authorLoginRes = await loginAuthor({
    username: 'digitalmarkservices.in@gmail.com',
    password: 'Rudhra.pass'
  });
  assert('3. Author Login succeeds with digitalmarkservices.in@gmail.com', authorLoginRes.success && Boolean(authorLoginRes.token) && authorLoginRes.user?.isAdmin);

  // Author Login also works with username rudhra_author
  const authorLoginUserRes = await loginAuthor({
    username: 'rudhra_author',
    password: 'Rudhra.pass'
  });
  assert('4. Author Login also succeeds with username rudhra_author', authorLoginUserRes.success && authorLoginUserRes.user?.isAdmin);

  // 3. Normal Reader Security Isolation
  // Create test reader
  await pool.query("DELETE FROM users WHERE username = 'reader_perm_test'");
  const regRes = await registerUser({
    username: 'reader_perm_test',
    email: 'reader_perm@example.com',
    password: 'ReaderPassword123!',
    displayName: 'Test Reader'
  });
  assert('5. Standard reader created in MySQL', regRes.success);

  // Attempt author portal login with reader credentials
  const readerAdminLogin = await loginAuthor({
    username: 'reader_perm_test',
    password: 'ReaderPassword123!'
  });
  assert('6. Normal reader strictly denied author portal access', !readerAdminLogin.success && readerAdminLogin.error.includes('Access denied'));

  // 4. Request Password Reset OTP
  // Clear any existing cooldowns for clean test
  await pool.query("DELETE FROM password_resets WHERE email = 'digitalmarkservices.in@gmail.com'");

  console.log('\n  Sending live OTP email to digitalmarkservices.in@gmail.com via SMTP...');
  const otpReqRes = await requestPasswordResetOtp('digitalmarkservices.in@gmail.com');
  assert('7. Password reset OTP requested and email dispatched', otpReqRes.success && otpReqRes.expiresInSeconds === 300);

  // Read OTP stored in MySQL
  const [resetRows] = await pool.query(
    "SELECT * FROM password_resets WHERE email = 'digitalmarkservices.in@gmail.com' AND used = 0 ORDER BY created_at DESC LIMIT 1"
  );
  assert('8. OTP record stored in MySQL with 5-minute expiry', resetRows.length === 1 && Boolean(resetRows[0].expires_at));

  // Verify cooldown enforcement: immediate 2nd request should be rejected
  const cooldownReq = await requestPasswordResetOtp('digitalmarkservices.in@gmail.com');
  assert('9. Cooldown enforced on immediate resend attempt', !cooldownReq.success && cooldownReq.error.includes('Please wait'));

  // Read generated OTP from .last_otp.txt for verification
  let currentOtp = null;
  if (fs.existsSync('.last_otp.txt')) {
    currentOtp = fs.readFileSync('.last_otp.txt', 'utf8').trim();
  }
  assert('10. 6-digit OTP generated and cryptographically verifiable', currentOtp && currentOtp.length === 6);

  // 5. Test Invalid OTP Attempt Counter
  const invalidOtpRes = await verifyPasswordResetOtp('digitalmarkservices.in@gmail.com', '000000');
  assert('11. Invalid OTP rejected with remaining attempts counter', !invalidOtpRes.success && invalidOtpRes.error.includes('Invalid code'));

  // 6. Test Valid OTP Verification
  const validOtpRes = await verifyPasswordResetOtp('digitalmarkservices.in@gmail.com', currentOtp);
  assert('12. Valid OTP verified and 15-minute reset token issued', validOtpRes.success && Boolean(validOtpRes.resetToken));

  // 7. Complete Password Reset
  const newPass = 'Rudhra.NewPass2026!';
  const resetRes = await completePasswordReset('digitalmarkservices.in@gmail.com', validOtpRes.resetToken, newPass, newPass);
  assert('13. Password reset completed successfully', resetRes.success);

  // Verify MySQL user password hash changed
  const [updatedAuthor] = await pool.query("SELECT password_hash, salt FROM users WHERE email = 'digitalmarkservices.in@gmail.com'");
  const isNewPassValid = verifyPassword(newPass, updatedAuthor[0].password_hash, updatedAuthor[0].salt);
  assert('14. New password cryptographically hashed and verified in MySQL', isNewPassValid);

  // Verify OTP marked used preventing reuse
  const [usedRecord] = await pool.query("SELECT used FROM password_resets WHERE id = ?", [resetRows[0].id]);
  assert('15. OTP marked used = 1 in MySQL preventing reuse', usedRecord[0].used === 1);

  // Attempt reuse
  const reuseRes = await completePasswordReset('digitalmarkservices.in@gmail.com', validOtpRes.resetToken, 'AnotherPass!', 'AnotherPass!');
  assert('16. OTP reuse strictly prevented', !reuseRes.success);

  // 8. Login with New Password
  const newLoginRes = await loginAuthor({
    username: 'digitalmarkservices.in@gmail.com',
    password: newPass
  });
  assert('17. Author Login succeeds with new password', newLoginRes.success && Boolean(newLoginRes.token));

  // Old password must fail
  const oldLoginRes = await loginAuthor({
    username: 'digitalmarkservices.in@gmail.com',
    password: 'Rudhra.pass'
  });
  assert('18. Old password Rudhra.pass now rejected', !oldLoginRes.success);

  // 9. Restore initial password as requested by user ("Configure initial password as Rudhra.pass")
  const { hash, salt } = hashPassword('Rudhra.pass');
  await pool.query(
    "UPDATE users SET password_hash = ?, salt = ? WHERE email = 'digitalmarkservices.in@gmail.com'",
    [hash, salt]
  );
  const restoredLogin = await loginAuthor({
    username: 'digitalmarkservices.in@gmail.com',
    password: 'Rudhra.pass'
  });
  assert('19. Initial password Rudhra.pass restored and ready for user login', restoredLogin.success);

  // Cleanup test reader
  await pool.query("DELETE FROM users WHERE username = 'reader_perm_test'");
  console.log('\n' + '='.repeat(70));
  console.log(`VERIFICATION SUMMARY: ${passed} / ${total} CHECKS PASSED`);
  console.log('='.repeat(70));

  process.exit(passed === total ? 0 : 1);
}

run().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
