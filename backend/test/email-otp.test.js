import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmailOtp, hashEmailOtp, verifyEmailOtp } from '../lib/email-otp.js';

test('creates a six-digit email OTP', () => {
  assert.match(createEmailOtp(), /^\d{6}$/);
});

test('verifies a valid OTP against its salted hash', () => {
  const otp = '042891';
  const hash = hashEmailOtp(otp);

  assert.notEqual(hash, otp);
  assert.equal(verifyEmailOtp(otp, hash), true);
  assert.equal(verifyEmailOtp('042892', hash), false);
});

test('rejects malformed OTPs and hashes', () => {
  assert.throws(() => hashEmailOtp('12345'), TypeError);
  assert.equal(verifyEmailOtp('12345', 'not-a-hash'), false);
  assert.equal(verifyEmailOtp('123456', 'not-a-hash'), false);
});
