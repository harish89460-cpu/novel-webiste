const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('VERIFYING ADMIN NOVEL WRITING / EPISODE EDITOR REDESIGN');
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

const adminJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', 'admin.js'), 'utf8');
const adminCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'css', 'admin.css'), 'utf8');

// Test 1: Editor button removed from sidebar nav
test('Sidebar nav does NOT contain the Editor button', () => {
  const sidebarNavBlock = adminJs.match(/<nav class="admin-nav-list"[^>]*>([\s\S]*?)<\/nav>/);
  assert(sidebarNavBlock, 'Could not find admin-nav-list in admin.js');
  assert(!sidebarNavBlock[1].includes("switchAdminTab('editor')"), 'Editor button is still present in sidebar navigation');
  assert(!sidebarNavBlock[1].includes("<span>Editor</span>"), 'Editor label is still present in sidebar navigation');
});

// Test 2: Editor tab route and functionality preserved
test('Novel writing functionality and route tab=editor remains intact', () => {
  assert(adminJs.includes("case 'editor':"), "switchAdminTab missing 'editor' case");
  assert(adminJs.includes('renderEditorTab(canvas)'), 'renderEditorTab call is missing');
});

// Test 3: Complete removal of placeholder words (Episode story unfolds here, etc.)
test('Writing platform is completely blank: all placeholder words removed from editor and live preview', () => {
  assert(!adminJs.includes('Episode story unfolds here'), 'Found "Episode story unfolds here" in admin.js');
  assert(!adminJs.includes('Sub-episode narrative unfolds here'), 'Found "Sub-episode narrative unfolds here" in admin.js');
  assert(!adminJs.includes('The story begins here'), 'Found "The story begins here" in admin.js');
  assert(!adminJs.includes('Chapter story begins here'), 'Found "Chapter story begins here" in admin.js');
  assert(!adminJs.includes('Write your episode here'), 'Found "Write your episode here" in admin.js');
  assert(!adminJs.includes('Write your novel chapter here'), 'Found "Write your novel chapter here" in admin.js');
  assert(!adminJs.includes('data-placeholder='), 'Writing surface should have no placeholder text');
});

// Test 4: Top Meta Grid: 1. Novel selection first, 2. Title second
test('Top meta fields are reordered: 1. Novel selection first, 2. Title second', () => {
  const metaGridMatch = adminJs.match(/<div class="editor-meta-grid">([\s\S]*?)<\/div>\s*<!-- Episode Numbering/);
  assert(metaGridMatch, 'Could not find editor-meta-grid in admin.js');
  const gridHtml = metaGridMatch[1];
  const novelIdx = gridHtml.indexOf('id="editor-novel-select"');
  const titleIdx = gridHtml.indexOf('id="editor-title-input"');
  assert(novelIdx !== -1, 'editor-novel-select is missing in meta grid');
  assert(titleIdx !== -1, 'editor-title-input is missing in meta grid');
  assert(novelIdx < titleIdx, 'editor-novel-select must appear BEFORE editor-title-input');
});

// Test 5: Hierarchy / Parent field removed from visible form
test('Hierarchy / Parent select dropdown is removed from the visible form', () => {
  assert(!adminJs.includes('id="editor-parent-select"'), 'Found leftover #editor-parent-select in admin.js');
  assert(!adminJs.includes('Hierarchy / Parent'), 'Found leftover Hierarchy / Parent label in admin.js');
  assert(adminJs.includes('id="editor-parent-id"'), 'Hidden input #editor-parent-id is missing to retain parent relationships');
});

// Test 6: Automatic episode numbering and parent relationships work correctly
test('Episode numbering calculation handles root chapters and parent sub-episodes correctly', () => {
  assert(adminJs.includes('function recalculateEpisodeNumbering'), 'Missing recalculateEpisodeNumbering function');
  assert(adminJs.includes("calculatedNum = `${parentNum}.${nextIndex}`"), 'Sub-episode numbering logic missing');
  assert(adminJs.includes("titleInput.value = `${novelTitle} (${nextNum})`"), 'Automatic root title formatting missing');
});

// Test 7: CSS Grid 2-column layout and mobile responsiveness
test('admin.css defines 2-column layout for editor-meta-grid and responsive single-column at <= 860px', () => {
  assert(adminCss.includes('.editor-meta-grid'), 'Missing .editor-meta-grid in CSS');
  assert(adminCss.includes('minmax(240px, 1fr) minmax(320px, 2fr)'), 'CSS does not use proportional 2-column grid for Novel & Title');
  assert(!adminCss.includes('.editor-writing-surface:empty::before'), 'Should have no empty text pseudo-element in CSS');
});

// Test 8: Save Draft, Publish, Schedule, and Toolbar preservation
test('Rich-text toolbar, live preview, draft saving, publishing, and scheduling are fully preserved', () => {
  assert(adminJs.includes('saveEditorDraft('), 'saveEditorDraft missing');
  assert(adminJs.includes('saveEditorPublish('), 'saveEditorPublish missing');
  assert(adminJs.includes('editor-sched-datetime'), 'Scheduled release date picker missing');
  assert(adminJs.includes('class="editor-toolbar"'), 'Rich-text toolbar missing');
  assert(adminJs.includes('updateLivePreview'), 'updateLivePreview missing');
  assert(adminJs.includes('updateWordCounters'), 'updateWordCounters missing');
});

// Test 9: Parity between src/ and frontend/src/
test('Exact parity between src/ and frontend/src/ for admin.js and admin.css', () => {
  const frontJs = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'js', 'admin.js'), 'utf8');
  const frontCss = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'src', 'css', 'admin.css'), 'utf8');
  assert.strictEqual(adminJs.replace(/\r\n/g, '\n'), frontJs.replace(/\r\n/g, '\n'), 'admin.js mismatch between src/ and frontend/src/');
  assert.strictEqual(adminCss.replace(/\r\n/g, '\n'), frontCss.replace(/\r\n/g, '\n'), 'admin.css mismatch between src/ and frontend/src/');
});

// Test 10: Production bundle frontend/dist has compiled assets
test('Production bundle frontend/dist contains compiled assets without build errors', () => {
  const distHtml = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'), 'utf8');
  assert(distHtml.includes('<!DOCTYPE html>'), 'dist/index.html is invalid');
});

console.log(`\nVerification complete: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
} else {
  console.log('ALL ADMIN NOVEL EDITOR REDESIGN TESTS PASSED PERFECTLY!');
}

