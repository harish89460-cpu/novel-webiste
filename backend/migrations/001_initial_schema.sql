-- Rudhra Prarthana Novels — Database Migration 001
-- Initial Relational SQL Schema for MySQL 8.0+

CREATE DATABASE IF NOT EXISTS rp_novels_db 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE rp_novels_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(64) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'Member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username),
  INDEX idx_users_email (email),
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  user_id INT PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  display_name_ta VARCHAR(100),
  avatar VARCHAR(500),
  bio TEXT,
  bio_ta TEXT,
  title VARCHAR(100) DEFAULT 'Member',
  title_ta VARCHAR(100) DEFAULT 'Member',
  joined_date VARCHAR(50),
  posts_count INT DEFAULT 0,
  topics_count INT DEFAULT 0,
  followers_count INT DEFAULT 0,
  CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Activity Status Table
CREATE TABLE IF NOT EXISTS activity_status (
  user_id INT PRIMARY KEY,
  is_enabled TINYINT(1) DEFAULT 1,
  is_online TINYINT(1) DEFAULT 0,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_user (user_id),
  INDEX idx_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Password Resets (OTPs)
CREATE TABLE IF NOT EXISTS password_resets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  email VARCHAR(191) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  otp_salt VARCHAR(64) NOT NULL,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 5,
  expires_at DATETIME NOT NULL,
  resend_after DATETIME NOT NULL,
  reset_token VARCHAR(128),
  used TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_resets_email (email),
  INDEX idx_resets_token (reset_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Novels Table
CREATE TABLE IF NOT EXISTS novels (
  id VARCHAR(100) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(100) DEFAULT 'Rudhra Prarthana',
  genre VARCHAR(100),
  category VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Ongoing',
  badge VARCHAR(50) DEFAULT 'Ongoing',
  cover VARCHAR(500),
  description TEXT,
  chapters_count INT DEFAULT 0,
  views VARCHAR(50) DEFAULT '0',
  rating VARCHAR(20) DEFAULT '5.0',
  updated_date VARCHAR(100),
  featured TINYINT(1) DEFAULT 0,
  continue_reading TINYINT(1) DEFAULT 0,
  is_audio TINYINT(1) DEFAULT 0,
  audio_available TINYINT(1) DEFAULT 0,
  audio_duration VARCHAR(50),
  audio_voice VARCHAR(100),
  youtube_url VARCHAR(500),
  trending_rank INT DEFAULT 0,
  sort_order INT DEFAULT 0,
  is_published TINYINT(1) DEFAULT 1,
  visibility VARCHAR(50) DEFAULT 'public',
  link VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_novels_status (status),
  INDEX idx_novels_featured (featured),
  INDEX idx_novels_published (is_published, visibility),
  INDEX idx_novels_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Chapters Table
CREATE TABLE IF NOT EXISTS chapters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  novel_id VARCHAR(100) NOT NULL,
  chapter_num INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  title_ta VARCHAR(255),
  content MEDIUMTEXT NOT NULL,
  is_guest_allowed TINYINT(1) DEFAULT 1,
  is_audio TINYINT(1) DEFAULT 0,
  word_count VARCHAR(50),
  read_time VARCHAR(50),
  release_date VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_novel_chapter (novel_id, chapter_num),
  CONSTRAINT fk_chapters_novel FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
  INDEX idx_chapter_novel (novel_id),
  INDEX idx_chapter_num (chapter_num)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Comments Table
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  novel_id VARCHAR(100) NOT NULL,
  chapter_num INT DEFAULT 0,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_novel FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
  INDEX idx_comments_target (novel_id, chapter_num),
  INDEX idx_comments_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Emoji Reactions Table (target_type: 'novel', 'chapter', 'comment', 'content')
CREATE TABLE IF NOT EXISTS reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reaction (target_type, target_id, user_id),
  CONSTRAINT fk_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reactions_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Likes Table (Dedicated like tracking for items)
CREATE TABLE IF NOT EXISTS likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_likes (target_type, target_id, user_id),
  CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_likes_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Forum Categories Table
CREATE TABLE IF NOT EXISTS forum_categories (
  id VARCHAR(100) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT '💬',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Forum Topics Table
CREATE TABLE IF NOT EXISTS forum_topics (
  id VARCHAR(100) PRIMARY KEY,
  category_id VARCHAR(100) NOT NULL,
  category_title VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  author_id INT NOT NULL,
  views_count INT DEFAULT 0,
  replies_count INT DEFAULT 0,
  is_published TINYINT(1) DEFAULT 1,
  visibility VARCHAR(50) DEFAULT 'public',
  last_reply_author_id INT,
  last_reply_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_topics_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_topics_last_author FOREIGN KEY (last_reply_author_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_topics_category (category_id),
  INDEX idx_topics_author (author_id),
  INDEX idx_topics_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Forum Posts / Topic Replies Table
CREATE TABLE IF NOT EXISTS forum_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  topic_id VARCHAR(100) NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_posts_topic FOREIGN KEY (topic_id) REFERENCES forum_topics(id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_posts_topic (topic_id),
  INDEX idx_posts_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) DEFAULT 'announcement',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255),
  is_read TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_read (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Reading Progress Table
CREATE TABLE IF NOT EXISTS reading_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  novel_id VARCHAR(100) NOT NULL,
  chapter_num INT NOT NULL,
  progress_percentage INT DEFAULT 0,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reading_progress (user_id, novel_id),
  CONSTRAINT fk_progress_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_progress_novel FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE,
  INDEX idx_progress_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Homepage Sections Table
CREATE TABLE IF NOT EXISTS homepage_sections (
  section_key VARCHAR(100) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255) NOT NULL,
  is_visible TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
