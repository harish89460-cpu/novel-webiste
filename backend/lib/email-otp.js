import crypto from 'node:crypto';

const OTP_PATTERN = /^\d{6}$/;

export function createEmailOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

export function hashEmailOtp(otp) {
  if (typeof otp !== 'string' || !OTP_PATTERN.test(otp)) {
    throw new TypeError('Email OTP must contain exactly six digits.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(otp, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyEmailOtp(otp, storedHash) {
  if (typeof otp !== 'string' || !OTP_PATTERN.test(otp) || typeof storedHash !== 'string') {
    return false;
  }

  const [salt, expectedHash, ...extraParts] = storedHash.split(':');
  if (!salt || !expectedHash || extraParts.length > 0 || !/^[a-f\d]{32}$/.test(salt) || !/^[a-f\d]{128}$/.test(expectedHash)) {
    return false;
  }

  const actualHash = crypto.scryptSync(otp, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  return crypto.timingSafeEqual(actualHash, expectedBuffer);
}
