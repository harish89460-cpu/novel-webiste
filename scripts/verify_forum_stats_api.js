import { query, queryOne } from '../backend/db.js';
import { createSession } from '../backend/auth.js';

async function verify() {
  try {
    console.log('--- 1. Testing GET /api/forum/stats directly ---');
    const res1 = await fetch('http://localhost:3000/api/forum/stats');
    const setCookie = res1.headers.get('set-cookie');
    const data1 = await res1.json();
    console.log('Response 1:', data1);
    console.log('Set-Cookie header:', setCookie);

    const cookieMatch = setCookie ? setCookie.match(/rp_visitor_id=([^;]+)/) : null;
    const visitorId = cookieMatch ? cookieMatch[1] : null;
    console.log('Extracted visitorId:', visitorId);

    console.log('\n--- 2. Checking MySQL actual counts ---');
    const m = await queryOne("SELECT COUNT(*) AS c FROM users WHERE status = 'active'");
    const r = await queryOne("SELECT COALESCE(SUM(replies_count), 0) AS c FROM forum_topics WHERE is_published = 1 AND visibility = 'public'");
    const g = await queryOne("SELECT COUNT(*) AS c FROM guest_visitors");
    console.log('MySQL counts:', { members: Number(m.c), replies: Number(r.c), guests: Number(g.c) });

    const stats1 = data1.stats || data1;
    if (
      Number(stats1.totalMembers) === Number(m.c) &&
      Number(stats1.totalReplies) === Number(r.c) &&
      Number(stats1.totalGuests) === Number(g.c)
    ) {
      console.log('SUCCESS: API counts match MySQL ground truth perfectly!');
    } else {
      console.error('MISMATCH between API and MySQL counts!', { data1, m, r, g });
      process.exit(1);
    }

    console.log('\n--- 3. Testing idempotency with same visitor cookie ---');
    const res2 = await fetch('http://localhost:3000/api/forum/stats', {
      headers: { 'Cookie': 'rp_visitor_id=' + (visitorId || 'gst_test_id') }
    });
    const data2 = await res2.json();
    console.log('Response 2 with same visitorId:', data2);
    const g2 = await queryOne("SELECT COUNT(*) AS c FROM guest_visitors");
    console.log('Guest count after repeat visit:', Number(g2.c));
    if (Number(g2.c) === Number(g.c)) {
      console.log('SUCCESS: Repeat guest visit correctly did NOT increment unique guest count!');
    } else {
      console.error('FAILURE: Duplicate guest visitor recorded!');
      process.exit(1);
    }

    console.log('\n--- 4. Testing that authenticated members are NOT counted as guests ---');
    const testUser = await queryOne("SELECT id FROM users LIMIT 1");
    const sessionToken = await createSession(testUser.id);
    const guestCountBefore = Number((await queryOne("SELECT COUNT(*) AS c FROM guest_visitors")).c);
    const res3 = await fetch('http://localhost:3000/api/forum/stats', {
      headers: { 'Authorization': 'Bearer ' + sessionToken }
    });
    const data3 = await res3.json();
    const guestCountAfter = Number((await queryOne("SELECT COUNT(*) AS c FROM guest_visitors")).c);
    console.log('Auth check - Before:', guestCountBefore, 'After:', guestCountAfter, 'Stats:', data3);
    if (guestCountBefore === guestCountAfter) {
      console.log('SUCCESS: Authenticated member request excluded from guest tracking!');
    } else {
      console.error('FAILURE: Authenticated member was counted as a guest!');
      process.exit(1);
    }

    console.log('\nALL STATS API & DB INTEGRATION TESTS PASSED!');
    process.exit(0);
  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  }
}

verify();
