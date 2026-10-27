import fs from 'node:fs';
import { getDb } from '../backend/db.js';

async function run() {
  const db = getDb();
  console.log('Running Migration 020: Forms, Novel Content, and Reading Management System...');

  // 1. Extend forum_categories
  try {
    await db.query(`
      ALTER TABLE forum_categories 
        ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'published',
        ADD COLUMN is_disabled TINYINT(1) NOT NULL DEFAULT 0,
        ADD COLUMN visibility VARCHAR(50) NOT NULL DEFAULT 'public';
    `);
    console.log('✓ Extended forum_categories columns');
  } catch (err) {
    if (err.message.includes('Duplicate column')) {
      console.log('✓ forum_categories columns already exist');
    } else {
      console.warn('forum_categories alter note:', err.message);
    }
  }

  // 2. content_subcategories
  await db.query(`
    CREATE TABLE IF NOT EXISTS content_subcategories (
      id VARCHAR(100) NOT NULL PRIMARY KEY,
      main_category_id VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT NULL,
      icon VARCHAR(50) DEFAULT '📌',
      novel_id VARCHAR(100) NULL,
      sort_order INT NOT NULL DEFAULT 0,
      status VARCHAR(50) NOT NULL DEFAULT 'published',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      is_disabled TINYINT(1) NOT NULL DEFAULT 0,
      visibility VARCHAR(50) NOT NULL DEFAULT 'public',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_subcat_main (main_category_id),
      KEY idx_subcat_novel (novel_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Created content_subcategories table');

  // 3. content_articles
  await db.query(`
    CREATE TABLE IF NOT EXISTS content_articles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      unique_slug VARCHAR(150) NOT NULL UNIQUE,
      main_category_id VARCHAR(100) NOT NULL,
      sub_category_id VARCHAR(100) NOT NULL,
      novel_id VARCHAR(100) NULL,
      chapter_num VARCHAR(50) NULL,
      title VARCHAR(255) NOT NULL,
      content LONGTEXT NOT NULL,
      summary TEXT NULL,
      cover_image VARCHAR(500) NULL,
      author_id INT NOT NULL DEFAULT 2,
      author_name VARCHAR(100) DEFAULT 'Rudhra Prarthana',
      status VARCHAR(50) NOT NULL DEFAULT 'published',
      is_published TINYINT(1) NOT NULL DEFAULT 1,
      is_disabled TINYINT(1) NOT NULL DEFAULT 0,
      visibility VARCHAR(50) NOT NULL DEFAULT 'public',
      views_count INT NOT NULL DEFAULT 0,
      comments_count INT NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_article_hierarchy (main_category_id, sub_category_id),
      KEY idx_article_status (status, is_published, is_disabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Created content_articles table');

  // 4. content_comments
  await db.query(`
    CREATE TABLE IF NOT EXISTS content_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      content_id INT NOT NULL,
      user_id INT NOT NULL,
      parent_id INT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_content_comments (content_id, created_at),
      KEY idx_user_comments (user_id),
      KEY idx_parent_comment (parent_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Created content_comments table');

  // 5. content_access_rules
  await db.query(`
    CREATE TABLE IF NOT EXISTS content_access_rules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      target_type ENUM('main', 'sub', 'content', 'novel', 'episode') NOT NULL,
      target_id VARCHAR(100) NOT NULL,
      user_id INT NULL,
      rule_type ENUM('block', 'allow', 'disable') NOT NULL DEFAULT 'block',
      reason VARCHAR(255) NULL,
      expires_at DATETIME NULL,
      created_by_admin_id INT NOT NULL DEFAULT 2,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_access_target (target_type, target_id),
      KEY idx_access_user (user_id),
      KEY idx_access_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('✓ Created content_access_rules table');

  // =========================================================================
  // SEED INITIAL HIERARCHY AS SPECIFIED IN USER PROMPT
  // =========================================================================
  console.log('Seeding initial subcategories and content items...');

  // A. Subcategories under General
  const generalSubs = [
    {
      id: 'welcome-notes',
      main_category_id: 'general',
      title: 'Welcome Notes',
      description: 'Official welcome greetings and essential guides for all Rudhra Prarthana readers.',
      icon: '🌸',
      sort_order: 1
    },
    {
      id: 'announcements',
      main_category_id: 'general',
      title: 'Announcements',
      description: 'Important updates regarding schedule releases, novel launches, and platform features.',
      icon: '📢',
      sort_order: 2
    },
    {
      id: 'tea-time-notes',
      main_category_id: 'general',
      title: 'Tea Time',
      description: 'Heart-to-heart conversations, casual thoughts, and friendly reader discussions.',
      icon: '☕',
      sort_order: 3
    }
  ];

  for (const s of generalSubs) {
    await db.query(`
      INSERT INTO content_subcategories (id, main_category_id, title, description, icon, sort_order, status, is_active, is_disabled)
      VALUES (?, ?, ?, ?, ?, ?, 'published', 1, 0)
      ON DUPLICATE KEY UPDATE 
        title = VALUES(title), 
        description = VALUES(description), 
        icon = VALUES(icon),
        sort_order = VALUES(sort_order);
    `, [s.id, s.main_category_id, s.title, s.description, s.icon, s.sort_order]);
  }
  console.log('✓ Seeded General subcategories');

  // B. Content Articles under General subcategories
  const generalArticles = [
    {
      unique_slug: 'hello-members',
      main_category_id: 'general',
      sub_category_id: 'welcome-notes',
      title: 'Hello Members',
      content: `<p>Dear beloved readers and cherished members,</p>
<p>A heartfelt and warmest welcome to all of you in our Rudhra Prarthana Novels literary family! Words cannot express how deeply grateful I am for the overwhelming love, affection, and immense encouragement you shower upon my novels every single day.</p>
<p>This reading platform was created with a single vision in mind: to provide each of you with a peaceful, elegant, and distraction-free sanctuary where stories come to life, emotions resonate deeply, and fellow readers can connect and share their thoughts with warmth and dignity.</p>
<p>Feel free to explore our ongoing episodes, discuss chapter twists, and leave your thoughts below. Happy reading!</p>
<p>With boundless love and gratitude,<br><strong>Rudhra Prarthana</strong></p>`,
      summary: 'A heartfelt welcome message from author Rudhra Prarthana to all readers.',
      author_id: 2,
      author_name: 'Rudhra Prarthana',
      sort_order: 1
    },
    {
      unique_slug: 'welcome-to-our-community',
      main_category_id: 'general',
      sub_category_id: 'welcome-notes',
      title: 'Welcome to Our Community',
      content: `<p>Welcome to the Rudhra Prarthana reader family!</p>
<p>Here are a few quick tips to help you make the most of your reading experience:</p>
<ul>
  <li><strong>Distraction-Free Reading:</strong> Adjust font sizing, background themes, and line spacing directly on any novel page.</li>
  <li><strong>Interactive Chapter Comments:</strong> Share your feelings and chapter predictions directly beneath every episode.</li>
  <li><strong>Private Reader Chat:</strong> Connect with fellow readers directly using our real-time messaging drawer.</li>
  <li><strong>Audio Experience:</strong> Tune in to our narrated audio adaptations for a soothing storytelling journey.</li>
</ul>
<p>We are delighted to have you with us!</p>`,
      summary: 'Essential reading platform guide and community features.',
      author_id: 2,
      author_name: 'Rudhra Prarthana',
      sort_order: 2
    },
    {
      unique_slug: 'important-announcement',
      main_category_id: 'general',
      sub_category_id: 'announcements',
      title: 'Important Announcement',
      content: `<p>Dear Readers,</p>
<p>We are excited to announce our upcoming weekly episode release schedule! All ongoing novel episodes will be published according to a regular, predictable timetable so you never miss an emotional highlight.</p>
<p>Additionally, our author Q&A session will take place every weekend in our community forum. Make sure your notifications are enabled so you receive real-time updates when new chapters go live!</p>
<p>Thank you for walking this literary journey with us.</p>`,
      summary: 'Weekly schedule updates and upcoming interactive reading events.',
      author_id: 2,
      author_name: 'Rudhra Prarthana',
      sort_order: 1
    },
    {
      unique_slug: 'lets-talk',
      main_category_id: 'general',
      sub_category_id: 'tea-time-notes',
      title: "Let's Talk",
      content: `<p>Hello everyone,</p>
<p>Grab a warm cup of coffee or tea ☕, sit back, and take a gentle breather from your busy day.</p>
<p>Which character from our ongoing novels made you smile, shed a tear, or ponder the most this week? What are your favorite life moments or weekend reading rituals?</p>
<p>Drop your thoughts in the comment section below—I read every single comment with a smiling heart!</p>`,
      summary: 'Casual weekend chit-chat and reflections with fellow novel lovers.',
      author_id: 2,
      author_name: 'Rudhra Prarthana',
      sort_order: 1
    }
  ];

  for (const a of generalArticles) {
    await db.query(`
      INSERT INTO content_articles (
        unique_slug, main_category_id, sub_category_id, title, content, 
        summary, author_id, author_name, status, is_published, is_disabled, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', 1, 0, ?)
      ON DUPLICATE KEY UPDATE 
        title = VALUES(title),
        content = VALUES(content),
        summary = VALUES(summary),
        author_name = VALUES(author_name),
        sort_order = VALUES(sort_order);
    `, [
      a.unique_slug, a.main_category_id, a.sub_category_id, a.title, 
      a.content, a.summary, a.author_id, a.author_name, a.sort_order
    ]);
  }
  console.log('✓ Seeded General content articles');

  console.log('\nMigration 020 completed successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration 020 failed:', err);
  process.exit(1);
});

