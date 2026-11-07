const { query } = require('../backend/db.js');
const crypto = require('crypto');

async function testAuthFeatures() {
  console.log('Testing Authenticated Admin, Writer, and Member Features...');

  // Find admin user
  const adminUser = await query('SELECT id, username, role FROM users WHERE id = 2 OR role = "admin" LIMIT 1;');
  if (!adminUser.length) {
    console.error('No admin user found');
    process.exit(1);
  }

  const user = adminUser[0];
  console.log('Using Admin User:', user.username, 'ID:', user.id);

  // Generate a valid temporary session token in the database for testing
  const testToken = 'test_token_' + crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + 3600000);
  await query('INSERT INTO sessions (user_id, token, session_type, expires_at) VALUES (?, ?, "author", ?);', [user.id, testToken, expiresAt]);

  const headers = {
    'Authorization': `Bearer ${testToken}`,
    'Content-Type': 'application/json'
  };

  const tests = [
    { name: 'Admin Overview', url: 'http://localhost:3000/api/admin/overview' },
    { name: 'Admin Members List', url: 'http://localhost:3000/api/admin/members' },
    { name: 'Admin Trash Items', url: 'http://localhost:3000/api/admin/trash' },
    { name: 'Writer Trash Items', url: 'http://localhost:3000/api/writer/trash' },
    { name: 'Chat Conversations', url: 'http://localhost:3000/api/chat/conversations' },
    { name: 'Chat Settings', url: 'http://localhost:3000/api/chat/settings' },
    { name: 'Chat Eligible Users', url: 'http://localhost:3000/api/chat/users' },
    { name: 'Notifications', url: 'http://localhost:3000/api/notifications' },
    { name: 'Notification Preferences', url: 'http://localhost:3000/api/notifications/preferences' },
    { name: 'Dynamic Update Panels', url: 'http://localhost:3000/api/update-panels' },
    { name: 'Profile Posts', url: 'http://localhost:3000/api/profile-posts' },
    { name: 'Forum Hierarchy', url: 'http://localhost:3000/api/content/hierarchy' },
    { name: 'Forum Live Stats', url: 'http://localhost:3000/api/forum/stats' }
  ];

  let pass = 0;
  let fail = 0;

  for (const t of tests) {
    try {
      const res = await fetch(t.url, { headers });
      const text = await res.text();
      let data = {};
      try { data = JSON.parse(text); } catch (_) {}

      if (res.ok) {
        console.log(`[PASS] ${t.name} (Status: ${res.status})`);
        pass++;
      } else {
        console.error(`[FAIL] ${t.name} (Status: ${res.status}) -> ${text.slice(0, 100)}`);
        fail++;
      }
    } catch (e) {
      console.error(`[ERR] ${t.name} -> ${e.message}`);
      fail++;
    }
  }

  // Clean up test token
  await query('DELETE FROM sessions WHERE token = ?;', [testToken]);

  console.log(`\nAuthenticated Features Summary: ${pass} Passed | ${fail} Failed`);
  process.exit(fail === 0 ? 0 : 1);
}

testAuthFeatures().catch(e => {
  console.error(e);
  process.exit(1);
});
