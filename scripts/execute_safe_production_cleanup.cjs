// Production Data Cleanup Script for Rudhra Prarthana Novels
// Removes all demo novel content, test chapters, test episodes, sample comments,
// dummy users, and test interactions while strictly preserving:
// - Schema and relationships
// - Exactly ONE required administrator account (User ID 2: rudhra_author)
// - System configuration and site settings
// - Homepage layout section configurations
// - Official forum categories and subcategories

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function executeCleanup() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
    database: 'rp_novels_db'
  });

  console.log('===================================================================');
  console.log('  STARTING SAFE PRODUCTION DATABASE CLEANUP');
  console.log('===================================================================');

  await conn.beginTransaction();

  try {
    // 1. Novel-dependent content and reader activity
    console.log('[1/8] Removing novel-dependent records...');
    await conn.query('DELETE FROM saved_novels;');
    await conn.query('DELETE FROM novel_ratings;');
    await conn.query('DELETE FROM novel_genres;');
    await conn.query('DELETE FROM reading_progress;');
    await conn.query('DELETE FROM reading_sessions;');
    await conn.query('DELETE FROM homepage_section_items;');
    await conn.query('DELETE FROM comments;');
    await conn.query('DELETE FROM short_story_comments;');
    await conn.query('DELETE FROM content_comments;');
    await conn.query('DELETE FROM reactions;');
    await conn.query('DELETE FROM likes;');
    await conn.query('DELETE FROM chapters;');
    await conn.query('DELETE FROM audio_novels;');
    await conn.query('DELETE FROM short_stories;');
    await conn.query('DELETE FROM content_articles;');
    await conn.query('DELETE FROM novels;');
    console.log('  ✓ Successfully removed all novels, chapters, stories, and reader interactions.');

    // 2. Forum topics and posts
    console.log('[2/8] Removing forum posts and discussion topics...');
    await conn.query('DELETE FROM forum_posts;');
    await conn.query('DELETE FROM topic_reads;');
    await conn.query('DELETE FROM forum_topics;');
    console.log('  ✓ Successfully cleared forum topics and posts.');

    // 3. Chat and conversations
    console.log('[3/8] Removing chat messages and conversations...');
    await conn.query('DELETE FROM messages;');
    await conn.query('DELETE FROM conversation_participants;');
    await conn.query('DELETE FROM admin_chat_audit_logs;');
    await conn.query('DELETE FROM conversations;');
    await conn.query('DELETE FROM chat_locks;');
    console.log('  ✓ Successfully cleared chat records.');

    // 4. Writer and admin activity logs
    console.log('[4/8] Removing writer assignments, submissions, and test logs...');
    await conn.query('DELETE FROM writer_audit_logs;');
    await conn.query('DELETE FROM writer_assignments;');
    await conn.query('DELETE FROM writer_permissions;');
    await conn.query('DELETE FROM writer_submissions;');
    await conn.query('DELETE FROM admin_audit_logs;');
    await conn.query('DELETE FROM notifications;');
    await conn.query('DELETE FROM notification_preferences WHERE user_id != 2;');
    await conn.query('DELETE FROM push_subscriptions WHERE user_id != 2;');
    await conn.query('DELETE FROM password_resets;');
    await conn.query('DELETE FROM guest_visitors;');
    await conn.query('DELETE FROM sessions;');
    await conn.query('DELETE FROM follows;');
    console.log('  ✓ Successfully cleared logs, sessions, and visitor records.');

    // 5. Users and profiles (keep ONLY designated administrator account: User ID 2)
    console.log('[5/8] Removing dummy users and retaining designated administrator account...');
    await conn.query('DELETE FROM activity_status WHERE user_id != 2;');
    await conn.query('DELETE FROM profiles WHERE user_id != 2;');
    await conn.query('DELETE FROM user_presence WHERE user_id != 2;');
    await conn.query('DELETE FROM users WHERE id != 2;');
    console.log('  ✓ Retained only designated administrator account (User ID 2).');

    // 6. Reset administrator profile and activity status to clean state
    console.log('[6/8] Resetting administrator profile metrics to zero...');
    await conn.query(`
      UPDATE profiles 
      SET posts_count = 0, topics_count = 0, followers_count = 0,
          bio = 'Official Administrator and Author of Rudhra Prarthana Novels',
          bio_ta = 'ருத்ரா பிரார்த்தனா நாவல்களின் நிர்வாகி மற்றும் எழுத்தாளர்',
          avatar = '/profile.png'
      WHERE user_id = 2;
    `);
    await conn.query('UPDATE activity_status SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE user_id = 2;');
    console.log('  ✓ Admin profile statistics cleanly reset.');

    // 7. Remove dummy test categories
    console.log('[7/8] Cleaning dummy categories...');
    await conn.query("DELETE FROM content_subcategories WHERE id = 'harish' OR main_category_id = 'writer novels';");
    await conn.query("DELETE FROM forum_categories WHERE id = 'writer novels';");
    console.log('  ✓ Removed test categories.');

    // 8. Delete test media upload
    console.log('[8/8] Cleaning test media uploads from DB...');
    await conn.query('DELETE FROM media WHERE id = 17;');
    console.log('  ✓ Cleaned test media record.');

    await conn.commit();
    console.log('===================================================================');
    console.log('  TRANSACTION COMMITTED: DATABASE CLEANUP SUCCESSFUL');
    console.log('===================================================================');

    // Verify remaining counts in MySQL
    const [users] = await conn.query('SELECT id, username, email, role FROM users;');
    console.log('Remaining User(s):', users);
    const [novels] = await conn.query('SELECT COUNT(*) as count FROM novels;');
    console.log('Remaining Novels count:', novels[0].count);
    const [chapters] = await conn.query('SELECT COUNT(*) as count FROM chapters;');
    console.log('Remaining Chapters count:', chapters[0].count);
    const [comments] = await conn.query('SELECT COUNT(*) as count FROM comments;');
    console.log('Remaining Comments count:', comments[0].count);
    const [topics] = await conn.query('SELECT COUNT(*) as count FROM forum_topics;');
    console.log('Remaining Forum Topics count:', topics[0].count);
    const [settings] = await conn.query('SELECT COUNT(*) as count FROM site_settings;');
    console.log('Preserved Site Settings count:', settings[0].count);
    const [sections] = await conn.query('SELECT COUNT(*) as count FROM homepage_sections;');
    console.log('Preserved Homepage Sections count:', sections[0].count);

  } catch (err) {
    await conn.rollback();
    console.error('FATAL ERROR DURING CLEANUP (ROLLED BACK):', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }

  // File system cleanup of orphaned uploads
  console.log('\n===================================================================');
  console.log('  CLEANING ORPHANED TEST FILES IN BACKEND UPLOADS');
  console.log('===================================================================');

  const uploadDirsToClean = [
    'backend/uploads/audio',
    'backend/uploads/comments',
    'backend/uploads/chat',
    'backend/uploads/covers',
    'server/uploads/comments',
    'server/uploads/covers'
  ];

  for (const dir of uploadDirsToClean) {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isFile()) {
          fs.unlinkSync(fullPath);
          console.log('  - Deleted orphaned upload file:', fullPath);
        }
      }
    }
  }

  // In backend/uploads/media, remove the test file Papaya_Disease_Analysis_Data_Pipeline.png
  const testMediaFile = 'backend/uploads/media/media-1792770861205-tsn29n.png';
  if (fs.existsSync(testMediaFile)) {
    fs.unlinkSync(testMediaFile);
    console.log('  - Deleted test media file:', testMediaFile);
  }

  console.log('✓ File cleanup completed successfully.');
}

executeCleanup().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});

