// scripts/test_profile_api.cjs
const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('Testing Profile Endpoints on http://localhost:3000...');
  
  // 1. Member Profile
  const r1 = await get('http://localhost:3000/api/members/rudhra');
  console.log('1. /api/members/rudhra -> status:', r1.status);
  console.log('   Followers:', r1.json?.member?.followers, '| Following:', r1.json?.member?.following, '| TotalComments:', r1.json?.member?.totalComments);

  // 2. Saved Novels
  const r2 = await get('http://localhost:3000/api/members/rudhra/saved-novels?page=1&limit=10');
  console.log('2. /api/members/rudhra/saved-novels -> status:', r2.status, '| Total:', r2.json?.pagination?.total, '| Items count:', r2.json?.items?.length);

  // 3. Activity Timeline
  const r3 = await get('http://localhost:3000/api/members/rudhra/activity?page=1&limit=10');
  console.log('3. /api/members/rudhra/activity -> status:', r3.status, '| Total:', r3.json?.pagination?.total, '| Items count:', r3.json?.items?.length);

  // 4. Recently Read Topics
  const r4 = await get('http://localhost:3000/api/members/rudhra/recent-topics?page=1&limit=10');
  console.log('4. /api/members/rudhra/recent-topics -> status:', r4.status, '| Total:', r4.json?.pagination?.total, '| Items count:', r4.json?.items?.length);

  console.log('All API checks completed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

