// scripts/verify_standardized_forum_layout.js
import fs from 'node:fs';
import assert from 'node:assert';
import http from 'node:http';

console.log('================================================================');
console.log('VERIFYING STANDARDIZED FORUM-STYLE STATS & HEADER LAYOUT');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`✓ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

// 1. Verify Removal of Separate Section Statistics Panel
console.log('--- 1. Verifying Removal of Separate Section Statistics Panel ---');
['src/css/forum.css', 'frontend/src/css/forum.css'].forEach(file => {
  const css = fs.readFileSync(file, 'utf8');
  check(`${file}: Does NOT contain .forms-stats-panel`, () => {
    assert(!css.includes('.forms-stats-panel'), 'Found leftover .forms-stats-panel in CSS');
  });
  check(`${file}: Contains .forum-summary-bar`, () => {
    assert(css.includes('.forum-summary-bar'), 'Missing .forum-summary-bar');
  });
  check(`${file}: Contains .forum-table-card`, () => {
    assert(css.includes('.forum-table-card'), 'Missing .forum-table-card');
  });
  check(`${file}: Contains .forum-table-header`, () => {
    assert(css.includes('.forum-table-header'), 'Missing .forum-table-header');
  });
  check(`${file}: Contains .forum-table-row`, () => {
    assert(css.includes('.forum-table-row'), 'Missing .forum-table-row');
  });
});

// 2. Verify Client-Side App Logic in app.js
console.log('\n--- 2. Verifying Inline Forum Table Layout in App JS ---');
['src/js/app.js', 'frontend/src/js/app.js'].forEach(file => {
  const js = fs.readFileSync(file, 'utf8');
  check(`${file}: Dedicated Subtitle View renders forum-summary-bar`, () => {
    assert(js.includes('class="forum-summary-bar"'), 'Missing forum-summary-bar');
  });
  check(`${file}: Dedicated Subtitle View renders forum-table-card`, () => {
    assert(js.includes('class="forum-table-card"'), 'Missing forum-table-card');
  });
  check(`${file}: Dedicated Subtitle View renders forum-table-header-articles`, () => {
    assert(js.includes('forum-table-header-articles'), 'Missing forum-table-header-articles');
  });
  check(`${file}: General Subcategories render forum-table-card`, () => {
    assert(js.includes('forms-sub-title-link'), 'Missing forms-sub-title-link');
  });
  check(`${file}: Novel Categories render forum-table-header-novels`, () => {
    assert(js.includes('forum-table-header-novels'), 'Missing forum-table-header-novels');
  });
  check(`${file}: Novel Categories render forum-table-row-novels`, () => {
    assert(js.includes('forum-table-row-novels'), 'Missing forum-table-row-novels');
  });
  check(`${file}: Does NOT render sidebar forms-stats-panel`, () => {
    assert(!js.includes('class="forms-stats-panel"'), 'Found leftover forms-stats-panel in JS');
  });
});

// 3. Verify Header Navigation (Home as 1st link, Forms as 2nd link)
console.log('\n--- 3. Verifying Header Navigation Integrity ---');
['index.html', 'frontend/index.html', 'frontend/dist/index.html'].forEach(file => {
  const html = fs.readFileSync(file, 'utf8');
  check(`${file}: Desktop nav contains Home as first link with href="#forms"`, () => {
    assert(html.includes('<a href="#forms" class="nav-link" data-nav="home">Home</a>'), 'Missing Home nav link');
  });
  check(`${file}: Desktop nav contains Forms as second link with New badge`, () => {
    assert(html.includes('data-nav="forms"'), 'Missing Forms data-nav');
    assert(html.includes('Forms <span class="nav-link-badge">New</span>'), 'Missing Forms New badge');
  });
  check(`${file}: Mobile drawer contains Home with href="#forms"`, () => {
    assert(html.includes('data-nav="home" onclick="closeMobileDrawer()">Home</a>'), 'Missing mobile Home nav link');
  });
});

// 4. Test Live Server Endpoint
console.log('\n--- 4. Testing Live Backend Server (http://localhost:3000) ---');
async function testServer() {
  return new Promise((resolve) => {
    http.get('http://localhost:3000/', (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        check('Live Server returns HTTP 200', () => {
          assert.strictEqual(res.statusCode, 200);
        });
        check('Live Server serves Home as first nav link', () => {
          assert(body.includes('<a href="#forms" class="nav-link" data-nav="home">Home</a>'));
        });
        check('Live Server serves Forms as second nav link', () => {
          assert(body.includes('Forms <span class="nav-link-badge">New</span>'));
        });
        check('Live Server does NOT have two Forms in header', () => {
          const match = body.match(/<nav class="nav-desktop"[\s\S]*?<\/nav>/);
          assert(match, 'nav-desktop found');
          const navText = match[0];
          const formsMatches = navText.match(/>\s*Forms\s*</g) || [];
          // Should only have 1 Forms in desktop nav
          assert.strictEqual(formsMatches.length, 1, `Expected 1 Forms link, found ${formsMatches.length}`);
          const homeMatches = navText.match(/>\s*Home\s*</g) || [];
          assert.strictEqual(homeMatches.length, 1, `Expected 1 Home link, found ${homeMatches.length}`);
        });
        resolve();
      });
    }).on('error', (err) => {
      console.error(`✗ [FAIL] Server request failed: ${err.message}`);
      failed++;
      resolve();
    });
  });
}

await testServer();

console.log('\n================================================================');
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) process.exit(1);

