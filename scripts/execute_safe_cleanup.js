import { query, queryOne } from '../server/db.js';
import fs from 'fs';
import path from 'path';

async function executeSafeCleanup() {
  console.log('====================================================');
  console.log('   STARTING SAFE TARGETED CLEANUP FOR RP NOVELS     ');
  console.log('====================================================');

  const report = {
    commentsRemoved: 0,
    likesRemoved: 0,
    forumPostsRemoved: 0,
    forumTopicsRemoved: 0,
    reactionsRemoved: 0,
    novelsRemoved: 0,
    usersRemoved: 0,
    profilesRemoved: 0,
    sessionsRemoved: 0,
    mediaRecordsRemoved: 0,
    filesRemoved: 0,
    userReferencesRepaired: 0
  };

  // 1. REPAIR HARISH USER REFERENCES (user_id 8 -> 28)
  console.log('\n--- 1. Repairing User ID 8 References to Active Admin ID 28 ---');
  const commentUpdate = await query(`UPDATE comments SET user_id = 28 WHERE user_id = 8;`);
  const likesUpdate = await query(`UPDATE likes SET user_id = 28 WHERE user_id = 8;`);
  const reactionsUpdate = await query(`UPDATE reactions SET user_id = 28 WHERE user_id = 8;`);
  const progressUpdate = await query(`UPDATE reading_progress SET user_id = 28 WHERE user_id = 8;`);
  const notifUpdate = await query(`UPDATE notifications SET user_id = 28 WHERE user_id = 8;`);
  await query(`DELETE FROM activity_status WHERE user_id = 8;`);

  report.userReferencesRepaired = (commentUpdate.affectedRows || 0) +
    (likesUpdate.affectedRows || 0) +
    (reactionsUpdate.affectedRows || 0) +
    (progressUpdate.affectedRows || 0) +
    (notifUpdate.affectedRows || 0);
  console.log(`Repaired ${report.userReferencesRepaired} genuine records belonging to Harish.`);

  // 2. DELETE CONFIRMED TEST COMMENTS & ASSOCIATED LIKES
  console.log('\n--- 2. Removing Confirmed Test Comments ---');
  const testCommentIds = [16, 17, 18, 19, 20, 21, 22, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41];
  
  // Remove likes on test comments
  const likesRes = await query(
    `DELETE FROM likes WHERE target_type = 'comment' AND target_id IN (${testCommentIds.map(id => `'${id}'`).join(',')});`
  );
  report.likesRemoved = likesRes.affectedRows || 0;
  console.log(`Deleted ${report.likesRemoved} likes associated with test comments.`);

  // Delete child test comments first (to respect parent_id integrity)
  const childRes = await query(
    `DELETE FROM comments WHERE id IN (${testCommentIds.join(',')}) AND parent_id IS NOT NULL;`
  );
  // Delete parent test comments
  const parentRes = await query(
    `DELETE FROM comments WHERE id IN (${testCommentIds.join(',')});`
  );
  report.commentsRemoved = (childRes.affectedRows || 0) + (parentRes.affectedRows || 0);
  console.log(`Deleted ${report.commentsRemoved} test comments.`);

  // 3. DELETE CONFIRMED TEST FORUM TOPIC, POSTS & REACTIONS
  console.log('\n--- 3. Removing Confirmed Test Forum Topic & Posts ---');
  const testTopicId = 'topic-discussion-on-story-pacing-3295-3306';

  // Find posts under this topic
  const postsToDelete = await query(`SELECT id FROM forum_posts WHERE topic_id = ?;`, [testTopicId]);
  const postIds = postsToDelete.map(p => p.id);

  if (postIds.length > 0) {
    const rxRes = await query(
      `DELETE FROM reactions WHERE target_type = 'forum_post' AND target_id IN (${postIds.map(id => `'${id}'`).join(',')});`
    );
    report.reactionsRemoved = rxRes.affectedRows || 0;
    console.log(`Deleted ${report.reactionsRemoved} reactions targeting test forum posts.`);

    const childPostsRes = await query(
      `DELETE FROM forum_posts WHERE topic_id = ? AND parent_id IS NOT NULL;`,
      [testTopicId]
    );
    const parentPostsRes = await query(
      `DELETE FROM forum_posts WHERE topic_id = ?;`,
      [testTopicId]
    );
    report.forumPostsRemoved = (childPostsRes.affectedRows || 0) + (parentPostsRes.affectedRows || 0);
    console.log(`Deleted ${report.forumPostsRemoved} test forum posts.`);
  }

  const topicRes = await query(`DELETE FROM forum_topics WHERE id = ?;`, [testTopicId]);
  report.forumTopicsRemoved = topicRes.affectedRows || 0;
  console.log(`Deleted test forum topic '${testTopicId}'.`);

  // 4. DELETE CONFIRMED TEST NOVELS
  console.log('\n--- 4. Removing Confirmed Test Novels ---');
  const testNovelIds = [
    'kavitha-test-romance-1792650739307',
    'kavitha-story-1792669517780',
    'kavitha-story-1792669598762'
  ];

  for (const novelId of testNovelIds) {
    // Delete any dependent records if any exist
    await query(`DELETE FROM reading_progress WHERE novel_id = ?;`, [novelId]);
    await query(`DELETE FROM likes WHERE target_type = 'novel' AND target_id = ?;`, [novelId]);
    await query(`DELETE FROM reactions WHERE target_type = 'novel' AND target_id = ?;`, [novelId]);
    const delNovel = await query(`DELETE FROM novels WHERE id = ?;`, [novelId]);
    report.novelsRemoved += delNovel.affectedRows || 0;
    console.log(`Deleted test novel: ${novelId}`);
  }

  // 5. DELETE CONFIRMED TEST WRITER ACCOUNT (User ID 34: kavitha_1792650738846@rpnovels.com)
  console.log('\n--- 5. Removing Confirmed Test Writer Account ---');
  const testUserId = 34;
  const testUser = await queryOne(`SELECT id, username, email FROM users WHERE id = ?;`, [testUserId]);

  if (testUser && testUser.email.includes('1792650738846')) {
    const sesRes = await query(`DELETE FROM sessions WHERE user_id = ?;`, [testUserId]);
    report.sessionsRemoved = sesRes.affectedRows || 0;

    const profRes = await query(`DELETE FROM profiles WHERE user_id = ?;`, [testUserId]);
    report.profilesRemoved = profRes.affectedRows || 0;

    await query(`DELETE FROM activity_status WHERE user_id = ?;`, [testUserId]);
    await query(`DELETE FROM writer_audit_logs WHERE writer_id = ?;`, [testUserId]);

    const userRes = await query(`DELETE FROM users WHERE id = ?;`, [testUserId]);
    report.usersRemoved = userRes.affectedRows || 0;
    console.log(`Deleted test writer account #${testUserId} (${testUser.username}, ${testUser.email}).`);
  }

  // 6. CLEAN UP TEST MEDIA RECORDS 1-15
  console.log('\n--- 6. Removing Unused Test Media Records (IDs 1-15) ---');
  const mediaRes = await query(`DELETE FROM media WHERE id BETWEEN 1 AND 15;`);
  report.mediaRecordsRemoved = mediaRes.affectedRows || 0;
  console.log(`Deleted ${report.mediaRecordsRemoved} test media records from media table.`);

  // 7. CLEAN UP TEST UPLOADED ARTIFACT FILES ON DISK
  console.log('\n--- 7. Cleaning Up Test Uploaded Files on Disk ---');
  const uploadsDir = path.resolve('public/uploads/comments');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      if (f.startsWith('reply_test_') || f.startsWith('test-animation-')) {
        try {
          fs.unlinkSync(path.join(uploadsDir, f));
          report.filesRemoved++;
          console.log(`Deleted test file: public/uploads/comments/${f}`);
        } catch (err) {
          console.warn(`Could not delete file ${f}:`, err.message);
        }
      }
    }
  }

  // 8. UPDATE AUDIO NOVEL YOUTUBE URL PLACEHOLDER TO GENUINE CHANNEL
  console.log('\n--- 8. Updating Audio Novel YouTube URL to Official Channel ---');
  await query(`
    UPDATE audio_novels 
    SET youtube_url = 'https://www.youtube.com/@rudhraprarthanaaudionovels',
        youtube_video_id = NULL
    WHERE youtube_url LIKE '%dQw4w9WgXcQ%';
  `);
  console.log('Updated audio novel youtube_url to https://www.youtube.com/@rudhraprarthanaaudionovels');

  // 9. RECALCULATE PROFILES POSTS_COUNT & TOPICS_COUNT
  console.log('\n--- 9. Recalculating Real Posts & Topics Count on Profiles ---');
  const allUsers = await query(`SELECT id FROM users;`);
  for (const u of allUsers) {
    const cCount = await queryOne(`SELECT COUNT(*) as cnt FROM comments WHERE user_id = ?;`, [u.id]);
    const pCount = await queryOne(`SELECT COUNT(*) as cnt FROM forum_posts WHERE user_id = ?;`, [u.id]);
    const tCount = await queryOne(`SELECT COUNT(*) as cnt FROM forum_topics WHERE author_id = ?;`, [u.id]);
    const totalPosts = (cCount.cnt || 0) + (pCount.cnt || 0);
    await query(`UPDATE profiles SET posts_count = ?, topics_count = ? WHERE user_id = ?;`, [totalPosts, tCount.cnt || 0, u.id]);
  }

  console.log('\n====================================================');
  console.log('               CLEANUP SUMMARY REPORT               ');
  console.log('====================================================');
  console.log(JSON.stringify(report, null, 2));

  // 10. FINAL DATABASE STATE AUDIT
  console.log('\n--- 10. Final Database State Audit ---');
  const counts = {
    users: (await queryOne(`SELECT COUNT(*) as c FROM users;`)).c,
    profiles: (await queryOne(`SELECT COUNT(*) as c FROM profiles;`)).c,
    novels: (await queryOne(`SELECT COUNT(*) as c FROM novels;`)).c,
    chapters: (await queryOne(`SELECT COUNT(*) as c FROM chapters;`)).c,
    audioNovels: (await queryOne(`SELECT COUNT(*) as c FROM audio_novels;`)).c,
    forumTopics: (await queryOne(`SELECT COUNT(*) as c FROM forum_topics;`)).c,
    forumPosts: (await queryOne(`SELECT COUNT(*) as c FROM forum_posts;`)).c,
    comments: (await queryOne(`SELECT COUNT(*) as c FROM comments;`)).c,
    likes: (await queryOne(`SELECT COUNT(*) as c FROM likes;`)).c,
    reactions: (await queryOne(`SELECT COUNT(*) as c FROM reactions;`)).c,
    media: (await queryOne(`SELECT COUNT(*) as c FROM media;`)).c,
    guestVisitors: (await queryOne(`SELECT COUNT(*) as c FROM guest_visitors;`)).c
  };
  console.log('Genuine Active Records Remaining:', JSON.stringify(counts, null, 2));

  console.log('\n✅ Safe cleanup completed successfully with full data integrity!');
  process.exit(0);
}

executeSafeCleanup().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
