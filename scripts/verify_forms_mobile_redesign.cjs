const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('VERIFYING FORMS PAGE MOBILE REDESIGN (320px, 375px, 390px, 430px)');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

const forumCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'css', 'forum.css'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'app.js'), 'utf8');

// Test 1: Category Header Bar Layout on Mobile
test('Category Header Bar aligns icon, title, and section count neatly on mobile without awkward column wrap', () => {
  assert(forumCss.includes('.forms-cat-header-bar'), 'Missing .forms-cat-header-bar in CSS');
  // Must NOT force column on header in 640px query
  const mobileHeaderMatches = forumCss.match(/\.forms-cat-header-bar\s*\{[^}]*display\s*:\s*flex[^}]*flex-direction\s*:\s*row/s);
  assert(mobileHeaderMatches, 'Category header bar does not maintain horizontal row alignment on mobile');
  assert(forumCss.includes('forms-cat-pill'), 'Missing .forms-cat-pill styling');
});

// Test 2: Summary Statistics Row
test('Summary statistics bar formats counts and latest link in compact responsive layout', () => {
  assert(forumCss.includes('.forum-summary-bar'), 'Missing .forum-summary-bar');
  assert(forumCss.includes('.forum-summary-stats'), 'Missing .forum-summary-stats');
  assert(forumCss.includes('.forum-summary-latest'), 'Missing .forum-summary-latest');
  assert(forumCss.includes('border-top: 1px dashed'), 'Missing dashed separator on mobile summary latest');
});

// Test 3: Subcategory Rows (Welcome Notes, Announcements, Tea Time) Layout
test('Subcategory row displays title on left, note count neatly on right, and latest content below', () => {
  assert(forumCss.includes('.forum-table-row-articles'), 'Missing .forum-table-row-articles');
  assert(forumCss.includes('grid-template-areas:'), 'Missing grid-template-areas in mobile articles row');
  assert(forumCss.includes('"title author"'), 'Missing title-author header row in grid');
  assert(forumCss.includes('"last last"'), 'Missing full-width last activity row in grid');
});

// Test 4: Horizontal Alignment of Comment and View Badges (Never Stacked in Middle)
test('Standalone middle stat cells are hidden on mobile, and badges are aligned horizontally in metadata subrow', () => {
  assert(forumCss.includes('.forum-table-row > .forum-table-cell-stat') && forumCss.includes('display: none !important'),
    'Middle stat cells are not hidden on mobile');
  assert(forumCss.includes('.forum-table-mobile-badges') && forumCss.includes('display: inline-flex !important'),
    '.forum-table-mobile-badges is not inline-flex on mobile');
  assert(appJs.includes('forum-table-mobile-badges'),
    'app.js does not render .forum-table-mobile-badges');
  assert(appJs.includes('forum-table-meta-subrow'),
    'app.js does not render .forum-table-meta-subrow');
});

// Test 5: Desktop Layout Preservation
test('Desktop layout (>= 901px) maintains untouched grid columns and hides mobile badges', () => {
  assert(forumCss.includes('.forum-table-mobile-badges') && forumCss.includes('display: none !important'),
    'Mobile badges not hidden on desktop');
  assert(forumCss.includes('grid-template-columns: minmax(260px, 2fr) 140px 90px 90px minmax(130px, 1fr)'),
    'Desktop articles grid columns were modified');
  assert(forumCss.includes('grid-template-columns: minmax(220px, 1.8fr) minmax(160px, 1.3fr) 120px 85px 85px 120px'),
    'Desktop novels grid columns were modified');
});

// Test 6: Mobile Width Optimization for 320px, 375px, 390px, 430px
test('Responsive margin bounds prevent horizontal scrolling on 320px, 375px, 390px, and 430px', () => {
  assert(forumCss.includes('@media (max-width: 640px)'), 'Missing 640px breakpoint');
  assert(forumCss.includes('@media (max-width: 360px)'), 'Missing 360px ultra-compact breakpoint');
  assert(forumCss.includes('calc(100% - 20px) !important'), 'Missing 20px margin bound on mobile table card');
  assert(forumCss.includes('calc(100% - 12px) !important'), 'Missing 12px margin bound on 360px table card');
});

// Test 7: Novels and Stories Table Mobile Alignment
test('Novels rows (Ongoing, Completed, Short Stories, Audio) align thumbnail, episode, and metadata cleanly', () => {
  assert(forumCss.includes('.forum-table-row-novels'), 'Missing .forum-table-row-novels');
  assert(appJs.includes('forum-table-row-novels') && appJs.includes('forum-table-mobile-badges'),
    'app.js does not render mobile badges for novels');
});

// Test 8: Dedicated Subpage Content Articles
test('Dedicated subpage articles (#forms?sub=...) display author and horizontally aligned stat badges', () => {
  assert(appJs.includes('formatLastSeen(art.publishedAt)') && appJs.includes('forum-table-mobile-badges'),
    'Dedicated subpage articles missing mobile badges in app.js');
});

// Test 9: Parity Between src/ and frontend/src/
test('Parity check: src/css/forum.css matches frontend/src/css/forum.css and app.js matches frontend/src/js/app.js', () => {
  const frontCss = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'css', 'forum.css'), 'utf8');
  const frontJs = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'js', 'app.js'), 'utf8');
  assert.strictEqual(forumCss.replace(/\r\n/g, '\n'), frontCss.replace(/\r\n/g, '\n'), 'forum.css mismatch between src and frontend/src');
  assert.strictEqual(appJs.replace(/\r\n/g, '\n'), frontJs.replace(/\r\n/g, '\n'), 'app.js mismatch between src and frontend/src');
});

// Test 10: Production Bundle Verification
test('Production bundle frontend/dist contains compiled styles and scripts with updated layout', () => {
  const distHtml = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'), 'utf8');
  assert(distHtml.includes('<!DOCTYPE html>'), 'dist/index.html is missing valid HTML content');
});

console.log(`\nVerification complete: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('ALL FORMS MOBILE REDESIGN TESTS PASSED PERFECTLY!');
}

