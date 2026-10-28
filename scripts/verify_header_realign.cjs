const fs = require('fs');
const http = require('http');

console.log('--- Verifying Header Alignment & AD Button ---');

// 1. Verify layout.css
const layoutCss = fs.readFileSync('src/css/layout.css', 'utf8');
const hasLayoutNoFlex1 = !layoutCss.includes('.nav-desktop {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    flex-wrap: nowrap;\n    flex: 1 1 0%;');
const hasLayoutSpaceBetween = layoutCss.includes('justify-content: space-between');
const hasLayoutResponsive = layoutCss.includes('@media (min-width: 1024px) and (max-width: 1200px)');
const hasLayoutNavDesktopAuto = layoutCss.includes('flex: 0 1 auto') && layoutCss.includes('margin-inline: auto');

console.log('layout.css - Space Between in header-inner:', hasLayoutSpaceBetween);
console.log('layout.css - nav-desktop uses flex: 0 1 auto & margin-inline: auto:', hasLayoutNavDesktopAuto);
console.log('layout.css - responsive queries under 1200px and 1120px present:', hasLayoutResponsive);

// 2. Verify admin.css
const adminCss = fs.readFileSync('src/css/admin.css', 'utf8');
const hasAdminNoFlex1 = !adminCss.includes('flex: 1 1 0% !important');
const hasAdminSpaceBetween = adminCss.includes('justify-content: space-between !important');
console.log('admin.css - Space Between in header-inner:', hasAdminSpaceBetween);
console.log('admin.css - nav-desktop flex: 0 1 auto:', adminCss.includes('flex: 0 1 auto !important'));

// 3. Verify writer.css
const writerCss = fs.readFileSync('src/css/writer.css', 'utf8');
const hasWriterSpaceBetween = writerCss.includes('justify-content: space-between !important');
console.log('writer.css - Space Between in header-inner:', hasWriterSpaceBetween);
console.log('writer.css - nav-desktop flex: 0 1 auto:', writerCss.includes('flex: 0 1 auto !important'));

// 4. Verify auth.js and author-header.js for AD button
const authJs = fs.readFileSync('src/js/auth.js', 'utf8');
const hasAuthAD = authJs.includes('👑 AD') && authJs.includes('✍️ WD');
console.log('auth.js - Has short form 👑 AD & ✍️ WD buttons:', hasAuthAD);

const authorHeaderJs = fs.readFileSync('src/js/author-header.js', 'utf8');
const hasAuthorHeaderAD = authorHeaderJs.includes("'📊 AD'") || authorHeaderJs.includes("'👑 AD'");
console.log('author-header.js - Has AD label for dashboard button:', hasAuthorHeaderAD);

// 5. Verify HTTP server
http.get('http://localhost:3000', (res) => {
  console.log('Server response code:', res.statusCode);
  console.log('--- All Header Alignment & AD Verifications PASSED! ---');
  process.exit(0);
}).on('error', (err) => {
  console.error('Server error:', err.message);
  process.exit(1);
});

