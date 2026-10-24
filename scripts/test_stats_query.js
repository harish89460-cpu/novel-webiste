import { queryOne } from '../backend/db.js';

async function test() {
  const membersRow = await queryOne("SELECT COUNT(*) as count FROM users WHERE status = 'active';");
  const repliesRow = await queryOne("SELECT COALESCE(SUM(replies_count), 0) as count FROM forum_topics WHERE is_published = 1 AND visibility = 'public';");
  const guestsRow = await queryOne("SELECT COUNT(*) as count FROM guest_visitors;");
  console.log('Stats:', {
    members: Number(membersRow?.count || 0),
    replies: Number(repliesRow?.count || 0),
    guests: Number(guestsRow?.count || 0)
  });
  process.exit(0);
}

test();
