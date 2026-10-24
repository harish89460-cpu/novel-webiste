// Email Service for Rudhra Prarthana Novels
// SMTP Delivery using Gmail App Password & Nodemailer

import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');

// Simple native .env loader to ensure environment variables are always kept up-to-date
export function loadEnv() {
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            // Always overwrite so live modifications to .env take immediate effect
            process.env[key] = val;
          }
        }
      });
    }
  } catch (err) {
    console.warn('[EMAIL ENV] Could not load .env file:', err.message);
  }
}

loadEnv();

let transporterInstance = null;
let lastUsedConfig = '';

export function getTransporter() {
  loadEnv();
  const smtpUser = (process.env.SMTP_USER || 'trendup089@gmail.com').trim();
  const rawPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').trim();
  // Strip all whitespace from Gmail App Passwords (e.g. "qdto coiq zhpx dddo" -> "qdtocoiqzhpxdddo")
  const smtpPass = rawPass.replace(/\s+/g, '');
  const smtpHost = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const smtpPort = Number(process.env.SMTP_PORT) || 465;
  const isSecure = process.env.SMTP_SECURE !== 'false';

  const configSignature = `${smtpUser}:${smtpPass}:${smtpHost}:${smtpPort}:${isSecure}`;

  if (!transporterInstance || lastUsedConfig !== configSignature) {
    lastUsedConfig = configSignature;
    const isGmail = smtpHost.includes('gmail') || smtpUser.endsWith('@gmail.com');

    const transportOptions = isGmail
      ? {
          service: 'gmail',
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        }
      : {
          host: smtpHost,
          port: smtpPort,
          secure: isSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass
          },
          tls: {
            rejectUnauthorized: false
          }
        };

    transporterInstance = nodemailer.createTransport(transportOptions);
  }

  return { transporter: transporterInstance, smtpUser, smtpPass };
}

/**
 * Sends a 6-digit OTP email for password reset
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.username - Recipient username or display name
 * @param {string} params.otp - 6-digit OTP code
 */
export async function sendOtpEmail(param1, param2) {
  let to, username, otp;
  if (typeof param1 === 'object' && param1 !== null) {
    to = param1.to;
    username = param1.username || 'Author';
    otp = param1.otp;
  } else {
    to = param1;
    otp = param2;
    username = 'Author';
  }
  const { transporter, smtpUser, smtpPass } = getTransporter();
  const senderEmail = smtpUser || 'trendup089@gmail.com';
  const senderName = 'Rudhra Prarthana Novels';
  const fromAddress = `"${senderName}" <${senderEmail}>`;

  const subject = `Rudhra Prarthana Novels — Your Password Reset OTP: ${otp}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset OTP</title>
      <style>
        body { margin: 0; padding: 0; background-color: #F8F5EE; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
        .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #E5E0D5; }
        .header { background: #0B1F33; padding: 32px 24px; text-align: center; }
        .logo-title { color: #C89B3C; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: 0.5px; font-family: Georgia, serif; }
        .logo-subtitle { color: #EFE3C2; font-size: 13px; margin-top: 6px; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 36px 28px; color: #202020; line-height: 1.6; }
        .greeting { font-size: 17px; font-weight: 600; color: #0B1F33; margin-bottom: 12px; }
        .message-en { font-size: 14px; color: #4B5563; margin-bottom: 16px; }
        .otp-box { background: #FDF9F0; border: 2px dashed #C89B3C; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
        .otp-label { font-size: 12px; font-weight: 700; text-transform: uppercase; color: #8A6418; letter-spacing: 1.5px; margin-bottom: 8px; }
        .otp-code { font-size: 38px; font-weight: 800; color: #0B1F33; letter-spacing: 10px; margin: 6px 0; font-family: 'Courier New', Courier, monospace; }
        .otp-timer { font-size: 13px; color: #DC2626; font-weight: 600; margin-top: 8px; }
        .warning-box { background: #FEF2F2; border-left: 4px solid #EF4444; padding: 12px 16px; border-radius: 4px; font-size: 12px; color: #991B1B; margin: 24px 0; }
        .footer { background: #F4EFE6; padding: 20px 24px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E0D5; }
        .footer a { color: #C89B3C; text-decoration: none; font-weight: 600; }
      </style>
    </head>
    <body>
      <div style="padding: 24px 12px;">
        <div class="wrapper">
          <div class="header">
            <h1 class="logo-title">👑 Rudhra Prarthana Novels</h1>
            <div class="logo-subtitle">Novels & Community</div>
          </div>
          <div class="content">
            <div class="greeting">Hello ${username || 'Reader'},</div>
            
            <p class="message-en">
              We received a request to reset the password for your Rudhra Prarthana Novels account. Please use the verification code below:
            </p>

            <div class="otp-box">
              <div class="otp-label">Password Reset Code</div>
              <div class="otp-code">${otp}</div>
              <div class="otp-timer">⏱ Valid for 5 minutes only</div>
            </div>

            <div class="warning-box">
              <strong>Security Warning:</strong><br>
              Never share this OTP with anyone. Rudhra Prarthana Novels support will never ask for your OTP. If you did not request this code, you can safely ignore this email.
            </div>

            <p style="font-size: 13px; color: #6B7280; margin-top: 24px;">
              If you did not request this password reset, your account remains secure and no further action is required.
            </p>
          </div>
          <div class="footer">
            © 2026 Rudhra Prarthana Novels. All Rights Reserved.<br>
            Sent from: <a href="mailto:${senderEmail}">${senderEmail}</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Rudhra Prarthana Novels — Password Reset OTP
----------------------------------------------------
Hello ${username || 'Reader'},

We received a request to reset your password.
Your 6-digit verification code (OTP) is: ${otp}

This code is valid for 5 minutes only.
DO NOT share this OTP with anyone.

If you did not make this request, please ignore this email.

Sender: ${senderEmail}
© 2026 Rudhra Prarthana Novels
  `.trim();

  // Log to server console for complete development tracking and verification
  console.log(`\n==================================================`);
  console.log(`[EMAIL DISPATCH] Password Reset OTP`);
  console.log(`From:    ${fromAddress}`);
  console.log(`To:      ${to}`);
  console.log(`OTP:     ${otp} (Valid: 5 minutes)`);
  console.log(`==================================================\n`);

  // Write to .last_otp.txt for local test suites
  try {
    fs.writeFileSync(path.resolve(__dirname, '../.last_otp.txt'), otp, 'utf8');
  } catch {}

  if (!smtpPass) {
    console.warn(`[EMAIL WARNING] SMTP_PASS is empty in .env. Real SMTP delivery requires a Gmail App Password.`);
    console.info(`[EMAIL SETUP] To enable real SMTP delivery, generate a 16-character App Password at: https://myaccount.google.com/apppasswords and set SMTP_PASS in .env`);
    return {
      success: false,
      delivered: false,
      error: 'Email service credentials (SMTP_PASS) not configured.',
      to,
      otp
    };
  }

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: textContent,
      html: htmlContent
    });
    console.log(`[EMAIL SUCCESS] OTP email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return {
      success: true,
      delivered: true,
      messageId: info.messageId,
      to
    };
  } catch (err) {
    console.error(`[EMAIL ERROR] SMTP delivery failed to ${to}:`, err.message);
    // Don't crash the server if Gmail rejects credentials; provide detailed diagnostic
    return {
      success: false,
      delivered: false,
      error: err.message,
      to
    };
  }
}
