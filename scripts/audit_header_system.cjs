// scripts/audit_header_system.cjs
const fs = require('fs');

console.log('====================================================');
console.log('AUDITING ALL PAGE HEADERS ACROSS RUDHRA PRARTHANA NOVELS');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log('[PASS] ' + message);
    passed++;
  } else {
    console.error('[FAIL] ' + message);
    failed++;
  }
}

// 1. Audit Public & Shared Header Rules (src/css/layout.css)
const layoutCss = fs.readFileSync('src/css/layout.css', 'utf8');
assert(layoutCss.includes('height: 72px;'), 'layout.css: Desktop header height is standardized to 72px');
assert(layoutCss.includes('order: 1;') && layoutCss.includes('flex: 0 0 auto;'), 'layout.css: brand-link has flex: 0 0 auto and order: 1 (cannot be overlapped)');
assert(layoutCss.includes('order: 2;') && layoutCss.includes('flex: 1 1 0%;'), 'layout.css: nav-desktop has flex: 1 1 0% and order: 2 (flexibly scaled)');
assert(layoutCss.includes('order: 3;') && layoutCss.includes('margin-left: auto;'), 'layout.css: header-actions has margin-left: auto and order: 3');
assert(layoutCss.includes('action-btn'), 'layout.css: defines .action-btn for search, bell, chat icons');

// 2. Audit Admin Header Rules (src/css/admin.css)
const adminCss = fs.readFileSync('src/css/admin.css', 'utf8');
assert(adminCss.includes('height: 72px !important;'), 'admin.css: Admin header height standardized to 72px');
assert(adminCss.includes('.site-header.admin-header-mode .brand-link') && adminCss.includes('order: 1 !important;'), 'admin.css: Admin brand-link has explicit order: 1');
assert(adminCss.includes('.site-header.admin-header-mode .nav-desktop') && adminCss.includes('order: 2 !important;'), 'admin.css: Admin nav-desktop has explicit order: 2');
assert(adminCss.includes('.site-header.admin-header-mode .header-actions') && adminCss.includes('order: 3 !important;'), 'admin.css: Admin header-actions has explicit order: 3');

// 3. Audit Writer / Author Header Rules (src/css/writer.css)
const writerCss = fs.readFileSync('src/css/writer.css', 'utf8');
assert(writerCss.includes('height: 72px !important;'), 'writer.css: Author header height standardized to 72px');
assert(writerCss.includes('body.author-page-view .site-header .brand-link') && writerCss.includes('order: 1 !important;'), 'writer.css: Author brand-link has explicit order: 1');
assert(writerCss.includes('body.author-page-view .site-header .nav-desktop') && writerCss.includes('order: 2 !important;'), 'writer.css: Author nav-desktop has explicit order: 2');
assert(writerCss.includes('body.author-page-view .site-header .header-actions') && writerCss.includes('order: 3 !important;'), 'writer.css: Author header-actions has explicit order: 3');

// 4. Audit Admin Header JS (src/js/author-header.js)
const authorJs = fs.readFileSync('src/js/author-header.js', 'utf8');
const adminAuthMatch = authorJs.match(/function getAdminAuthHtml[\s\S]*?return `([\s\S]*?)`;/);
const adminAuthHtml = adminAuthMatch ? adminAuthMatch[1] : '';
assert(!adminAuthHtml.includes('View Site'), 'author-header.js: Admin header does NOT render "View Site" button');
assert(adminAuthHtml.includes('author-profile-menu-btn'), 'author-header.js: Admin header renders Profile Menu button');

// 5. Audit Writer Header JS (src/js/author-header.js)
const writerAuthMatch = authorJs.match(/function getWriterAuthHtml[\s\S]*?return `([\s\S]*?)`;/);
const writerAuthHtml = writerAuthMatch ? writerAuthMatch[1] : '';
assert(writerAuthHtml.includes('author-profile-menu-btn'), 'author-header.js: Writer header renders Writer Profile Menu button');

// 6. Audit Frontend Synced Files
const fLayoutCss = fs.readFileSync('frontend/src/css/layout.css', 'utf8');
const fAdminCss = fs.readFileSync('frontend/src/css/admin.css', 'utf8');
const fWriterCss = fs.readFileSync('frontend/src/css/writer.css', 'utf8');
const fAuthorJs = fs.readFileSync('frontend/src/js/author-header.js', 'utf8');

assert(fLayoutCss === layoutCss, 'frontend/src/css/layout.css is identical to src/css/layout.css');
assert(fAdminCss === adminCss, 'frontend/src/css/admin.css is identical to src/css/admin.css');
assert(fWriterCss === writerCss, 'frontend/src/css/writer.css is identical to src/css/writer.css');
assert(fAuthorJs === authorJs, 'frontend/src/js/author-header.js is identical to src/js/author-header.js');

console.log('\n====================================================');
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('====================================================\n');

if (failed > 0) process.exit(1);

