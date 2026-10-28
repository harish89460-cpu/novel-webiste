const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('RUNNING RESPONSIVE DESIGN & ALIGNMENT VERIFICATION');
console.log('====================================================\n');

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

const srcCssDir = path.join(__dirname, '..', 'src', 'css');
const frontendCssDir = path.join(__dirname, '..', 'frontend', 'src', 'css');

// Test 1: File synchronization
test('src/css and frontend/src/css files are bit-for-bit identical', () => {
  const files = fs.readdirSync(srcCssDir).filter(f => f.endsWith('.css'));
  assert(files.length > 0, 'No CSS files found');
  files.forEach(file => {
    const srcContent = fs.readFileSync(path.join(srcCssDir, file), 'utf8').replace(/\r\n/g, '\n');
    const frontContent = fs.readFileSync(path.join(frontendCssDir, file), 'utf8').replace(/\r\n/g, '\n');
    assert.strictEqual(srcContent, frontContent, `${file} in src/css and frontend/src/css are not identical!`);
  });
});

// Test 2: Audio grid fluid minmax
test('audio.css uses fluid minmax to prevent horizontal overflow on 320px screens', () => {
  const content = fs.readFileSync(path.join(srcCssDir, 'audio.css'), 'utf8');
  assert(content.includes('grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr))'),
    'audio.css does not use fluid minmax for .audio-grid');
});

// Test 3: Audio responsive breakpoints
test('audio.css contains responsive breakpoints for mobile & tablet (900px, 768px, 640px, 480px)', () => {
  const content = fs.readFileSync(path.join(srcCssDir, 'audio.css'), 'utf8');
  assert(content.includes('@media (max-width: 900px)'), 'Missing 900px breakpoint in audio.css');
  assert(content.includes('@media (max-width: 768px)'), 'Missing 768px breakpoint in audio.css');
  assert(content.includes('@media (max-width: 640px)'), 'Missing 640px breakpoint in audio.css');
  assert(content.includes('@media (max-width: 480px)'), 'Missing 480px breakpoint in audio.css');
});

// Test 4: Audio track banner responsive stacking
test('audio.css stacks track cover & banner cleanly on mobile (<= 480px)', () => {
  const content = fs.readFileSync(path.join(srcCssDir, 'audio.css'), 'utf8');
  assert(content.includes('.audio-track-banner {') && content.includes('flex-direction: column'),
    'Missing column stacking for .audio-track-banner on small screens');
});

// Test 5: Notifications dropdown width bound
test('modals.css restricts notifications dropdown width to min(380px, calc(100vw - 24px))', () => {
  const content = fs.readFileSync(path.join(srcCssDir, 'modals.css'), 'utf8');
  assert(content.includes('width: min(380px, calc(100vw - 24px))'),
    'modals.css does not constrain .notifications-dropdown fluidly');
  assert(content.includes('@media (max-width: 480px)') && content.includes('.notifications-dropdown'),
    'Missing 480px breakpoint for .notifications-dropdown');
});

// Test 6: Messaging drawer fluid width on mobile
test('messaging.css covers mobile drawer full-width and touch buttons for <= 480px and <= 360px', () => {
  const content = fs.readFileSync(path.join(srcCssDir, 'messaging.css'), 'utf8');
  assert(content.includes('max-width: 100vw !important') || content.includes('width: 100vw !important'),
    'messaging.css does not set 100vw on mobile drawer');
  assert(content.includes('@media (max-width: 360px)'),
    'Missing 360px ultra-compact breakpoint in messaging.css');
});

// Test 7: Members grid ultra-compact single column
test('members.css adapts to single-column card grid on <= 360px viewports', () => {
  const content = fs.readFileSync(path.join(srcCssDir, 'members.css'), 'utf8');
  assert(content.includes('@media (max-width: 360px)') && content.includes('grid-template-columns: 1fr'),
    'members.css does not adapt to 1 column on <= 360px');
});

// Test 8: Admin table touch scroll wrapper
test('admin.css provides touch-scrolling and scrollbar styling on .admin-table-wrapper', () => {
  const content = fs.readFileSync(path.join(srcCssDir, 'admin.css'), 'utf8');
  assert(content.includes('.admin-table-wrapper') && content.includes('-webkit-overflow-scrolling: touch'),
    'admin.css missing touch scrolling on table wrapper');
});

// Test 9: Universal overflow-x prevention in layout.css
test('layout.css enforces overflow-x: hidden and universal word-break safety', () => {
  const content = fs.readFileSync(path.join(srcCssDir, 'layout.css'), 'utf8');
  assert(content.includes('overflow-x: hidden'), 'layout.css does not enforce overflow-x: hidden');
  assert(content.includes('overflow-wrap: anywhere') || content.includes('word-break: break-word'),
    'layout.css does not enforce overflow-wrap safety');
});

// Test 10: Production build artifacts exist
test('frontend/dist contains compiled production assets (index.html, dist/assets/*.js, *.css)', () => {
  const distHtml = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
  const distAssets = path.join(__dirname, '..', 'frontend', 'dist', 'assets');
  assert(fs.existsSync(distHtml), 'frontend/dist/index.html is missing');
  assert(fs.existsSync(distAssets), 'frontend/dist/assets is missing');
  const assetFiles = fs.readdirSync(distAssets);
  assert(assetFiles.some(f => f.endsWith('.js')), 'No compiled JS asset in dist');
  assert(assetFiles.some(f => f.endsWith('.css')), 'No compiled CSS asset in dist');
});

console.log(`\nVerification complete: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('ALL RESPONSIVE DESIGN TESTS PASSED SUCCESSFULLY!');
}
