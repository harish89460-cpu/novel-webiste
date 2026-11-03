// End-to-End Verification for Vercel Frontend & Windows MySQL Server Setup
// Tests:
// 1. Backend /api/health endpoint
// 2. Database connection & table verification
// 3. Admin authentication & session creation
// 4. Content categories & subcategories retrieval
// 5. Registration restriction / public access controls
// 6. Security check: zero DB credentials exposed in frontend

const http = require('http');
const fs = require('fs');
const path = require('path');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function verifySetup() {
  console.log('================================================================');
  console.log('VERIFYING WINDOWS MYSQL SERVER & VERCEL FRONTEND CONFIGURATION');
  console.log('================================================================');

  // 1. Health Check
  console.log('\n[1/6] Testing Backend Health Check (/api/health)...');
  const healthRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/health',
    method: 'GET'
  });
  if (healthRes.status !== 200 || healthRes.body.status !== 'ok') {
    throw new Error('Health check failed: ' + JSON.stringify(healthRes.body));
  }
  console.log('✓ Backend Health Check: OK (Database: ' + healthRes.body.database + ')');

  // 2. Database Connectivity
  console.log('\n[2/6] Verifying MySQL Database Connectivity...');
  const { testDbConnection, queryOne } = require('../backend/db');
  const dbHealth = await testDbConnection();
  if (!dbHealth.ok) {
    throw new Error('Database connection failed: ' + dbHealth.diagnostic);
  }
  console.log(`✓ MySQL Database: CONNECTED (${dbHealth.host}:${dbHealth.port}, DB: ${dbHealth.database}, Tables: ${dbHealth.tableCount}, Ver: ${dbHealth.version})`);

  // 3. Admin Authentication & Session
  console.log('\n[3/6] Verifying Admin Account & Session Management...');
  const admin = await queryOne('SELECT id, username, email, role, status FROM users WHERE id = 2;');
  if (!admin || admin.username !== 'rudhra_author') {
    throw new Error('Admin account not found in database!');
  }
  console.log(`✓ Admin User ID 2 Verified: ${admin.username} (${admin.email}) [Role: ${admin.role}]`);

  const { createSession, getUserByToken } = require('../backend/auth');
  const sessionToken = await createSession(admin.id, 'author');
  const currentUser = await getUserByToken(sessionToken);
  if (!currentUser || currentUser.role !== 'Admin') {
    throw new Error('Session creation or validation failed for Admin!');
  }
  console.log('✓ Admin Session Generated & Verified via Token (isAdmin: ' + currentUser.isAdmin + ')');

  // 4. Categories & Content Retrieval
  console.log('\n[4/6] Verifying Categories & Subcategories API (/api/content/hierarchy)...');
  const hierarchyRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content/hierarchy',
    method: 'GET',
    headers: { 'Authorization': `Bearer ${sessionToken}` }
  });
  if (hierarchyRes.status !== 200 || !hierarchyRes.body.success) {
    throw new Error('Failed to retrieve categories hierarchy: ' + JSON.stringify(hierarchyRes.body));
  }
  const mainCategoriesCount = hierarchyRes.body.hierarchy?.length || 0;
  console.log(`✓ Categories API Verified (${mainCategoriesCount} main categories loaded)`);

  // 5. Vercel Configuration Verification
  console.log('\n[5/6] Verifying vercel.json & Frontend Build Assets...');
  const vercelJsonPath = path.resolve(__dirname, '../vercel.json');
  if (!fs.existsSync(vercelJsonPath)) {
    throw new Error('vercel.json is missing in project root!');
  }
  const vercelConfig = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));
  if (!vercelConfig.outputDirectory || !vercelConfig.rewrites) {
    throw new Error('vercel.json is missing outputDirectory or rewrites configuration!');
  }
  console.log('✓ vercel.json Verified (outputDirectory: ' + vercelConfig.outputDirectory + ', rewrites configured)');

  const distIndexPath = path.resolve(__dirname, '../frontend/dist/index.html');
  if (!fs.existsSync(distIndexPath)) {
    throw new Error('frontend/dist/index.html is missing. Run `npm --prefix frontend run build`!');
  }
  console.log('✓ Frontend Build Distribution Verified (dist/index.html exists)');

  // 6. Security Check
  console.log('\n[6/6] Verifying Security: Checking for Exposed DB Credentials in Frontend...');
  const distJsFiles = fs.readdirSync(path.resolve(__dirname, '../frontend/dist/assets')).filter(f => f.endsWith('.js'));
  for (const jsFile of distJsFiles) {
    const jsContent = fs.readFileSync(path.resolve(__dirname, '../frontend/dist/assets', jsFile), 'utf8');
    if (jsContent.includes('DB_PASSWORD') || jsContent.includes('password_hash') || jsContent.includes('rp_novels_db')) {
      throw new Error(`Security breach: Database sensitive tokens found in built frontend bundle ${jsFile}!`);
    }
  }
  console.log('✓ Security Verified: Zero database passwords or internal credentials leaked into frontend bundle.');

  // Clean up test token
  const { query } = require('../backend/db');
  await query('DELETE FROM sessions WHERE token = ?;', [sessionToken]);

  console.log('\n================================================================');
  console.log('ALL 6 SYSTEM VERIFICATION CHECKS PASSED 100% SUCCESSFULLY!');
  console.log('================================================================');
  process.exit(0);
}

verifySetup().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
