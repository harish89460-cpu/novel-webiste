// scripts/verify_contact_and_legal_pages.js
import http from 'node:http';
import fs from 'node:fs';
import { query } from '../backend/db.js';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = http.request(`http://localhost:3000${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, json: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('================================================================');
  console.log('VERIFYING CONTACT PAGE REDESIGN & LEGAL PAGES (PRIVACY, DISCLAIMER, TERMS, COPYRIGHT)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Backend Contact Form API Tests
  console.log('--- 1. Testing Backend /api/contact API Endpoint ---');
  
  // Test missing fields
  const missingRes = await request('POST', '/api/contact', { name: 'Test', email: 'test@example.com' });
  assert(missingRes.status === 400, 'Missing fields rejected with HTTP 400');
  assert(missingRes.json?.success === false, 'Missing fields reports success: false');

  // Test invalid email
  const invalidEmailRes = await request('POST', '/api/contact', {
    name: 'Test User',
    email: 'not-an-email',
    subject: 'Test Subject',
    message: 'Test Message'
  });
  assert(invalidEmailRes.status === 400, 'Invalid email rejected with HTTP 400');
  assert(invalidEmailRes.json?.error?.includes('valid email'), 'Invalid email error message is descriptive');

  // Test valid submission
  const testSubj = `E2E Test Message ${Date.now()}`;
  const validRes = await request('POST', '/api/contact', {
    name: 'Harish Reader',
    email: 'reader@example.com',
    subject: testSubj,
    message: 'Testing contact form submission.'
  });
  assert(validRes.status === 200, 'Valid submission returns HTTP 200');
  assert(validRes.json?.success === true, 'Valid submission returns success: true');
  assert(typeof validRes.json?.submissionId === 'number', `Received submission ID: ${validRes.json?.submissionId}`);

  // Verify persistence in MySQL database
  const dbRows = await query('SELECT * FROM contact_submissions WHERE subject = ?', [testSubj]);
  assert(dbRows.length === 1, 'Submission successfully stored in MySQL contact_submissions table');
  assert(dbRows[0]?.name === 'Harish Reader', 'Stored contact name matches');
  assert(dbRows[0]?.email === 'reader@example.com', 'Stored contact email matches');

  // Safe cleanup of test entry
  await query('DELETE FROM contact_submissions WHERE subject = ?', [testSubj]);
  console.log('✓ Cleaned up test contact submission');

  // 2. Contact Page Design & Content Verification in app.js
  console.log('\n--- 2. Testing Contact Page Design & Content in app.js ---');
  ['src/js/app.js', 'frontend/src/js/app.js'].forEach(p => {
    const code = fs.readFileSync(p, 'utf8');
    assert(code.includes('CONTACT'), `${p}: Has small uppercase CONTACT label`);
    assert(code.includes('Contact Us'), `${p}: Has Contact Us title`);
    assert(code.includes('placeholder="Your Name"'), `${p}: Form has Your Name field`);
    assert(code.includes('placeholder="name@example.com"'), `${p}: Form has Email Address field`);
    assert(code.includes('placeholder="Subject of your message"'), `${p}: Form has Subject field`);
    assert(code.includes('placeholder="Write your message here..."'), `${p}: Form has Message field`);
    assert(code.includes('Send Message'), `${p}: Form has full-width Send Message button`);
    assert(code.includes('window.handleContactSubmit'), `${p}: Form is connected to live handleContactSubmit handler`);
    
    // Supplied contact content below form
    assert(code.includes('We’d love to hear from you! ❤️'), `${p}: Contains "We’d love to hear from you! ❤️"`);
    assert(code.includes('Website-related questions'), `${p}: Contains inquiry bullet points`);
    assert(code.includes('rudraprarthananovels@gmail.com'), `${p}: Displays correct contact email address`);
    assert(code.includes('We will try our best to respond as soon as possible.'), `${p}: Displays response timeframe note`);
    assert(code.includes('Rudhra Prarthana Novels'), `${p}: Contains signature Rudhra Prarthana Novels`);
  });

  // 3. Legal Content Verification
  console.log('\n--- 3. Testing Legal Content (Privacy Policy, Disclaimer, Terms, Copyright) ---');
  ['src/js/app.js', 'frontend/src/js/app.js'].forEach(p => {
    const code = fs.readFileSync(p, 'utf8');

    // Privacy Policy
    assert(code.includes('renderPrivacyView'), `${p}: Implements renderPrivacyView`);
    assert(code.includes('1. Information We Collect'), `${p}: Privacy Policy includes section 1`);
    assert(code.includes('Google AdSense and Advertising Cookies'), `${p}: Privacy Policy includes Google AdSense cookies`);
    assert(code.includes('10. Contact Us'), `${p}: Privacy Policy includes section 10`);

    // Disclaimer
    assert(code.includes('renderDisclaimerView'), `${p}: Implements renderDisclaimerView`);
    assert(code.includes('1. Fictional Content'), `${p}: Disclaimer includes section 1`);
    assert(code.includes('Any resemblance to actual persons'), `${p}: Disclaimer includes resemblance disclaimer`);
    assert(code.includes('8. Contact'), `${p}: Disclaimer includes section 8`);

    // Terms & Conditions
    assert(code.includes('renderTermsView'), `${p}: Implements renderTermsView`);
    assert(code.includes('1. Website Usage'), `${p}: Terms includes section 1`);
    assert(code.includes('3. Forum Rules'), `${p}: Terms includes Forum Rules`);
    assert(code.includes('10. Contact'), `${p}: Terms includes section 10`);

    // Copyright
    assert(code.includes('renderCopyrightView'), `${p}: Implements renderCopyrightView`);
    assert(code.includes('© 2026 Rudhra Prarthana Novels. All Rights Reserved.'), `${p}: Copyright includes rights statement`);
    assert(code.includes('No part of the content may be copied'), `${p}: Copyright includes reproduction warning`);
  });

  // 4. Router Connections
  console.log('\n--- 4. Testing Client-Side Routing ---');
  ['src/js/app.js', 'frontend/src/js/app.js'].forEach(p => {
    const code = fs.readFileSync(p, 'utf8');
    assert(code.includes("hash.startsWith('#contact')"), `${p}: Router handles #contact`);
    assert(code.includes("hash.startsWith('#privacy')"), `${p}: Router handles #privacy`);
    assert(code.includes("hash.startsWith('#disclaimer')"), `${p}: Router handles #disclaimer`);
    assert(code.includes("hash.startsWith('#terms')"), `${p}: Router handles #terms`);
    assert(code.includes("hash.startsWith('#copyright')"), `${p}: Router handles #copyright`);
  });

  // 5. Footer Links Verification
  console.log('\n--- 5. Testing Footer Links in HTML ---');
  ['index.html', 'frontend/index.html', 'frontend/dist/index.html'].forEach(p => {
    const html = fs.readFileSync(p, 'utf8');
    assert(html.includes('href="#privacy" class="footer-link-item">Privacy Policy</a>'), `${p}: Privacy Policy links to #privacy`);
    assert(html.includes('href="#disclaimer" class="footer-link-item">Disclaimer</a>'), `${p}: Disclaimer links to #disclaimer`);
    assert(html.includes('href="#terms" class="footer-link-item">Terms &amp; Conditions</a>'), `${p}: Terms links to #terms`);
    assert(html.includes('href="#contact" class="footer-link-item">Contact Us</a>'), `${p}: Contact Us links to #contact`);
    assert(html.includes('href="#copyright" class="footer-link-item">Copyright</a>'), `${p}: Copyright links to #copyright`);
  });

  // 6. Header Navigation Integrity (Ensuring no regression from previous task)
  console.log('\n--- 6. Verifying Header Navigation Integrity ---');
  ['index.html', 'frontend/index.html', 'frontend/dist/index.html'].forEach(p => {
    const html = fs.readFileSync(p, 'utf8');
    assert(html.includes('data-nav="home">Home</a>'), `${p}: Header first link is Home`);
    assert(html.includes('Forms <span class="nav-link-badge">New</span>'), `${p}: Header second link is Forms New`);
  });

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

