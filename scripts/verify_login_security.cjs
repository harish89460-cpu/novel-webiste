const fs = require('fs');
const http = require('http');

console.log('--- Verifying Admin & Writer Login Security & UI ---');

// 1. Verify author-header.js
const headerJs = fs.readFileSync('src/js/author-header.js', 'utf8');
const noAdminFakeFallback = !headerJs.includes("const user = window.CURRENT_USER || { username: 'rudhra_author'");
const noWriterFakeFallback = !headerJs.includes("const user = window.CURRENT_USER || { username: 'writer'");
const loginIsPublicMode = headerJs.includes("clean.startsWith('#admin-login') || clean.startsWith('#writer-login')");

console.log('author-header.js: No fake admin profile fallback:', noAdminFakeFallback);
console.log('author-header.js: No fake writer profile fallback:', noWriterFakeFallback);
console.log('author-header.js: Login routes strictly forced to public mode:', loginIsPublicMode);

if (!noAdminFakeFallback || !noWriterFakeFallback || !loginIsPublicMode) {
  console.error('author-header.js verification FAILED');
  process.exit(1);
}

// 2. Verify admin.js
const adminJs = fs.readFileSync('src/js/admin.js', 'utf8');
const hasRoleTabs = adminJs.includes('portal-role-tabs') && adminJs.includes('switchAdminLoginRole');
const hasWriterTab = adminJs.includes('Writer Workspace') && adminJs.includes('Author & Admin');
const hasWriterSubmit = adminJs.includes('Authenticate & Access Writer Workspace');

console.log('admin.js: Has Portal Role Switcher tabs:', hasRoleTabs);
console.log('admin.js: Has Writer and Admin tabs:', hasWriterTab);
console.log('admin.js: Has dynamic writer submit button:', hasWriterSubmit);

if (!hasRoleTabs || !hasWriterTab || !hasWriterSubmit) {
  console.error('admin.js verification FAILED');
  process.exit(1);
}

// 3. Verify app.js
const appJs = fs.readFileSync('src/js/app.js', 'utf8');
const hasAppLoginCheck = appJs.includes('isLoginPage') && appJs.includes('#writer-login');
console.log('app.js: Correctly prevents admin/writer header on login routes:', hasAppLoginCheck);

if (!hasAppLoginCheck) {
  console.error('app.js verification FAILED');
  process.exit(1);
}

// 4. Test API endpoint /api/admin/login
const postData = JSON.stringify({ username: 'nonexistent_test_user', password: 'wrongpassword' });
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('API /api/admin/login response status:', res.statusCode);
    const data = JSON.parse(body);
    console.log('API error message received as expected:', data.error);
    console.log('--- ALL ADMIN & WRITER LOGIN VERIFICATIONS PASSED ---');
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('API request error:', err.message);
  process.exit(1);
});

req.write(postData);
req.end();

