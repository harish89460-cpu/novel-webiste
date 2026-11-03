-- ===================================================================
-- Rudhra Prarthana Novels — Complete Authoritative MySQL Schema DDL
-- Generated on: 2026-10-29T10:43:39.922Z
-- Database: rp_novels_db (MySQL 8.0+)
-- Total Tables: 49
-- ===================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- -------------------------------------------------------------
-- Table: activity_status
-- -------------------------------------------------------------
DROP TABLE IF EXISTS activity_status;
CREATE TABLE `activity_status` (
  `user_id` int NOT NULL,
  `is_enabled` tinyint(1) DEFAULT '1',
  `is_online` tinyint(1) DEFAULT '0',
  `last_seen` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `current_novel_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `current_chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reading_session_start` timestamp NULL DEFAULT NULL,
  `reading_last_active` timestamp NULL DEFAULT NULL,
  `reading_duration_seconds` int DEFAULT '0',
  `is_reading` tinyint(1) DEFAULT '0',
  `last_read_novel_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_read_chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_read_at` timestamp NULL DEFAULT NULL,
  `last_read_duration_seconds` int DEFAULT '0',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: admin_audit_logs
-- -------------------------------------------------------------
DROP TABLE IF EXISTS admin_audit_logs;
CREATE TABLE `admin_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` int NOT NULL,
  `target_user_id` int DEFAULT NULL,
  `action` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'success',
  `details` text COLLATE utf8mb4_unicode_ci,
  `metadata` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_audit_admin` (`admin_id`),
  KEY `idx_admin_audit_target` (`target_user_id`),
  KEY `idx_admin_audit_action` (`action`),
  KEY `idx_admin_audit_created` (`created_at`),
  CONSTRAINT `fk_admin_audit_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=205 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: admin_chat_audit_logs
-- -------------------------------------------------------------
DROP TABLE IF EXISTS admin_chat_audit_logs;
CREATE TABLE `admin_chat_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `admin_id` int NOT NULL,
  `writer_id` int NOT NULL,
  `conversation_id` int NOT NULL,
  `action` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'view_writer_history',
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `viewed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_admin` (`admin_id`),
  KEY `idx_audit_writer` (`writer_id`),
  KEY `idx_audit_conv` (`conversation_id`),
  CONSTRAINT `fk_audit_admin_user` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_audit_conv` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_audit_writer_user` FOREIGN KEY (`writer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: audio_novels
-- -------------------------------------------------------------
DROP TABLE IF EXISTS audio_novels;
CREATE TABLE `audio_novels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `cover` mediumtext COLLATE utf8mb4_unicode_ci,
  `source_type` enum('audio_file','youtube') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'youtube',
  `youtube_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `youtube_video_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audio_file_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audio_duration` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `episode_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `part_number` int DEFAULT '1',
  `language` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Tamil',
  `status` enum('draft','published') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `sort_order` int DEFAULT '0',
  `views` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `author_id` int DEFAULT NULL,
  `review_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'published',
  `admin_feedback` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_audio_status` (`status`),
  KEY `idx_audio_novel` (`novel_id`),
  KEY `idx_audio_sort` (`sort_order`),
  CONSTRAINT `fk_audio_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: chapters
-- -------------------------------------------------------------
DROP TABLE IF EXISTS chapters;
CREATE TABLE `chapters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` int DEFAULT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `episode_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title_ta` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_guest_allowed` tinyint(1) DEFAULT '1',
  `is_audio` tinyint(1) DEFAULT '0',
  `audio_file_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `youtube_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `youtube_video_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audio_duration` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_type` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'audio_file',
  `thumbnail` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `word_count` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `read_time` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `release_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `scheduled_at` datetime DEFAULT NULL,
  `timezone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Asia/Kolkata',
  `published_at` datetime DEFAULT NULL,
  `sort_order` decimal(10,4) NOT NULL DEFAULT '1.0000',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `author_id` int DEFAULT NULL,
  `review_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'published',
  `admin_feedback` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_novel_chapter` (`novel_id`,`chapter_num`),
  KEY `idx_chapter_novel` (`novel_id`),
  KEY `idx_chapter_num` (`chapter_num`),
  KEY `idx_chapters_parent` (`parent_id`),
  KEY `idx_chapters_status_sched` (`status`,`scheduled_at`),
  KEY `idx_chapters_sort` (`sort_order`),
  CONSTRAINT `fk_chapters_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=227 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: chat_locks
-- -------------------------------------------------------------
DROP TABLE IF EXISTS chat_locks;
CREATE TABLE `chat_locks` (
  `user_id` int NOT NULL,
  `target_user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`target_user_id`),
  KEY `idx_chat_lock_target` (`target_user_id`),
  CONSTRAINT `fk_chat_lock_target` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_lock_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: chat_settings
-- -------------------------------------------------------------
DROP TABLE IF EXISTS chat_settings;
CREATE TABLE `chat_settings` (
  `user_id` int NOT NULL,
  `is_chat_available` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_chat_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: comments
-- -------------------------------------------------------------
DROP TABLE IF EXISTS comments;
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `user_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comments_target` (`novel_id`,`chapter_num`),
  KEY `idx_comments_user` (`user_id`),
  KEY `idx_comments_parent` (`parent_id`),
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=135 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: contact_submissions
-- -------------------------------------------------------------
DROP TABLE IF EXISTS contact_submissions;
CREATE TABLE `contact_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subject` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: content_access_rules
-- -------------------------------------------------------------
DROP TABLE IF EXISTS content_access_rules;
CREATE TABLE `content_access_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target_type` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int DEFAULT NULL,
  `rule_type` enum('block','allow','disable') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'block',
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `created_by_admin_id` int NOT NULL DEFAULT '2',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_access_target` (`target_type`,`target_id`),
  KEY `idx_access_user` (`user_id`),
  KEY `idx_access_expiry` (`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: content_articles
-- -------------------------------------------------------------
DROP TABLE IF EXISTS content_articles;
CREATE TABLE `content_articles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `unique_slug` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `main_category_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sub_category_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` int DEFAULT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `summary` text COLLATE utf8mb4_unicode_ci,
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_id` int NOT NULL DEFAULT '2',
  `author_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Rudhra Prarthana',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `is_disabled` tinyint(1) NOT NULL DEFAULT '0',
  `visibility` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'public',
  `access_permission` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin_only',
  `views_count` int NOT NULL DEFAULT '0',
  `comments_count` int NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `published_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `scheduled_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_slug` (`unique_slug`),
  KEY `idx_article_hierarchy` (`main_category_id`,`sub_category_id`),
  KEY `idx_article_status` (`status`,`is_published`,`is_disabled`),
  KEY `idx_content_articles_parent` (`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: content_comments
-- -------------------------------------------------------------
DROP TABLE IF EXISTS content_comments;
CREATE TABLE `content_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `content_id` int NOT NULL,
  `user_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_content_comments` (`content_id`,`created_at`),
  KEY `idx_user_comments` (`user_id`),
  KEY `idx_parent_comment` (`parent_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: content_subcategories
-- -------------------------------------------------------------
DROP TABLE IF EXISTS content_subcategories;
CREATE TABLE `content_subcategories` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `main_category_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 0xF09F938C,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `is_disabled` tinyint(1) NOT NULL DEFAULT '0',
  `visibility` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'public',
  `access_permission` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin_only',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_subcat_main` (`main_category_id`),
  KEY `idx_subcat_novel` (`novel_id`),
  KEY `idx_content_subs_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: conversation_participants
-- -------------------------------------------------------------
DROP TABLE IF EXISTS conversation_participants;
CREATE TABLE `conversation_participants` (
  `conversation_id` int NOT NULL,
  `user_id` int NOT NULL,
  `last_read_at` timestamp NULL DEFAULT NULL,
  `unread_count` int NOT NULL DEFAULT '0',
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`,`user_id`),
  KEY `idx_cp_user` (`user_id`,`conversation_id`),
  CONSTRAINT `fk_cp_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: conversations
-- -------------------------------------------------------------
DROP TABLE IF EXISTS conversations;
CREATE TABLE `conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_message_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_locked` tinyint(1) NOT NULL DEFAULT '0',
  `locked_by` int DEFAULT NULL,
  `locked_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `locked_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_conv_updated` (`updated_at`),
  KEY `idx_conv_last_msg` (`last_message_at`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: follows
-- -------------------------------------------------------------
DROP TABLE IF EXISTS follows;
CREATE TABLE `follows` (
  `id` int NOT NULL AUTO_INCREMENT,
  `follower_id` int NOT NULL,
  `following_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_follower_following` (`follower_id`,`following_id`),
  KEY `idx_following` (`following_id`),
  KEY `idx_follower` (`follower_id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: forum_categories
-- -------------------------------------------------------------
DROP TABLE IF EXISTS forum_categories;
CREATE TABLE `forum_categories` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 0xF09F92AC,
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '#2E1065',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `is_disabled` tinyint(1) NOT NULL DEFAULT '0',
  `visibility` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'public',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: forum_posts
-- -------------------------------------------------------------
DROP TABLE IF EXISTS forum_posts;
CREATE TABLE `forum_posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `topic_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_posts_topic` (`topic_id`),
  KEY `idx_posts_user` (`user_id`),
  KEY `idx_posts_parent` (`parent_id`),
  CONSTRAINT `fk_posts_parent` FOREIGN KEY (`parent_id`) REFERENCES `forum_posts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_posts_topic` FOREIGN KEY (`topic_id`) REFERENCES `forum_topics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: forum_topics
-- -------------------------------------------------------------
DROP TABLE IF EXISTS forum_topics;
CREATE TABLE `forum_topics` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci,
  `image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author_id` int NOT NULL,
  `views_count` int DEFAULT '0',
  `replies_count` int DEFAULT '0',
  `is_published` tinyint(1) DEFAULT '1',
  `visibility` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'public',
  `is_pinned` tinyint(1) NOT NULL DEFAULT '0',
  `sort_order` int NOT NULL DEFAULT '0',
  `last_reply_author_id` int DEFAULT NULL,
  `last_reply_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_topics_last_author` (`last_reply_author_id`),
  KEY `idx_topics_category` (`category_id`),
  KEY `idx_topics_author` (`author_id`),
  KEY `idx_topics_updated` (`updated_at`),
  CONSTRAINT `fk_topics_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_topics_last_author` FOREIGN KEY (`last_reply_author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: guest_visitors
-- -------------------------------------------------------------
DROP TABLE IF EXISTS guest_visitors;
CREATE TABLE `guest_visitors` (
  `visitor_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_visit_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_visit_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_agent_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`visitor_id`),
  KEY `idx_last_visit` (`last_visit_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: homepage_section_items
-- -------------------------------------------------------------
DROP TABLE IF EXISTS homepage_section_items;
CREATE TABLE `homepage_section_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `section_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sec_key` (`section_key`),
  KEY `idx_novel_id` (`novel_id`),
  CONSTRAINT `fk_hsi_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: homepage_sections
-- -------------------------------------------------------------
DROP TABLE IF EXISTS homepage_sections;
CREATE TABLE `homepage_sections` (
  `section_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtitle` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_visible` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `section_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'custom',
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `content_limit` int NOT NULL DEFAULT '6',
  `view_all_link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_style` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'grid',
  `settings` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`section_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: likes
-- -------------------------------------------------------------
DROP TABLE IF EXISTS likes;
CREATE TABLE `likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_likes` (`target_type`,`target_id`,`user_id`),
  KEY `fk_likes_user` (`user_id`),
  KEY `idx_likes_target` (`target_type`,`target_id`),
  CONSTRAINT `fk_likes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: media
-- -------------------------------------------------------------
DROP TABLE IF EXISTS media;
CREATE TABLE `media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` int NOT NULL,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_created` (`created_at` DESC)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: messages
-- -------------------------------------------------------------
DROP TABLE IF EXISTS messages;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `conversation_id` int NOT NULL,
  `sender_id` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `message_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'text',
  `attachment_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachment_meta` json DEFAULT NULL,
  `is_edited` tinyint(1) NOT NULL DEFAULT '0',
  `edited_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `deleted_by` int DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT '0',
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messages_conv` (`conversation_id`,`created_at`),
  KEY `idx_messages_sender` (`sender_id`),
  CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: notification_preferences
-- -------------------------------------------------------------
DROP TABLE IF EXISTS notification_preferences;
CREATE TABLE `notification_preferences` (
  `user_id` int NOT NULL,
  `notify_comments` tinyint(1) DEFAULT '1',
  `notify_replies` tinyint(1) DEFAULT '1',
  `notify_reactions` tinyint(1) DEFAULT '1',
  `notify_forum` tinyint(1) DEFAULT '1',
  `notify_chapters` tinyint(1) DEFAULT '1',
  `notify_system` tinyint(1) DEFAULT '1',
  `browser_enabled` tinyint(1) DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_notif_pref_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: notifications
-- -------------------------------------------------------------
DROP TABLE IF EXISTS notifications;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `actor_id` int DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'announcement',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read` (`user_id`,`is_read`),
  KEY `idx_notif_user_created` (`user_id`,`created_at`),
  KEY `idx_notif_actor` (`actor_id`),
  CONSTRAINT `fk_notifications_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=177 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: novel_genres
-- -------------------------------------------------------------
DROP TABLE IF EXISTS novel_genres;
CREATE TABLE `novel_genres` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=97 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: novel_ratings
-- -------------------------------------------------------------
DROP TABLE IF EXISTS novel_ratings;
CREATE TABLE `novel_ratings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rating` tinyint NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_novel_rating` (`user_id`,`novel_id`),
  KEY `idx_novel_ratings_novel` (`novel_id`),
  KEY `idx_novel_ratings_user` (`user_id`),
  CONSTRAINT `novel_ratings_chk_1` CHECK (((`rating` >= 1) and (`rating` <= 5)))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: novels
-- -------------------------------------------------------------
DROP TABLE IF EXISTS novels;
CREATE TABLE `novels` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Rudhra Prarthana',
  `genre` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Ongoing',
  `badge` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Ongoing',
  `cover` mediumtext COLLATE utf8mb4_unicode_ci,
  `description` text COLLATE utf8mb4_unicode_ci,
  `chapters_count` int DEFAULT '0',
  `views` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `rating` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '5.0',
  `updated_date` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `featured` tinyint(1) DEFAULT '0',
  `continue_reading` tinyint(1) DEFAULT '0',
  `is_audio` tinyint(1) DEFAULT '0',
  `audio_available` tinyint(1) DEFAULT '0',
  `audio_duration` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audio_voice` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `youtube_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trending_rank` int DEFAULT '0',
  `sort_order` int DEFAULT '0',
  `is_published` tinyint(1) DEFAULT '1',
  `visibility` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'public',
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `author_id` int DEFAULT NULL,
  `content_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'written_novel',
  `access_permission` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'admin_only',
  `language` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Tamil',
  `scheduled_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_novels_status` (`status`),
  KEY `idx_novels_featured` (`featured`),
  KEY `idx_novels_published` (`is_published`,`visibility`),
  KEY `idx_novels_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: password_resets
-- -------------------------------------------------------------
DROP TABLE IF EXISTS password_resets;
CREATE TABLE `password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_salt` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int DEFAULT '0',
  `max_attempts` int DEFAULT '5',
  `expires_at` datetime NOT NULL,
  `resend_after` datetime NOT NULL,
  `reset_token` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_resets_user` (`user_id`),
  KEY `idx_resets_email` (`email`),
  KEY `idx_resets_token` (`reset_token`),
  CONSTRAINT `fk_resets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: profiles
-- -------------------------------------------------------------
DROP TABLE IF EXISTS profiles;
CREATE TABLE `profiles` (
  `user_id` int NOT NULL,
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name_ta` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` mediumtext COLLATE utf8mb4_unicode_ci,
  `bio` text COLLATE utf8mb4_unicode_ci,
  `bio_ta` text COLLATE utf8mb4_unicode_ci,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Member',
  `title_ta` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Member',
  `joined_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `posts_count` int DEFAULT '0',
  `topics_count` int DEFAULT '0',
  `followers_count` int DEFAULT '0',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: push_subscriptions
-- -------------------------------------------------------------
DROP TABLE IF EXISTS push_subscriptions;
CREATE TABLE `push_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `endpoint` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `p256dh` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_push_endpoint` (`endpoint`),
  KEY `idx_push_user` (`user_id`),
  CONSTRAINT `fk_push_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: reactions
-- -------------------------------------------------------------
DROP TABLE IF EXISTS reactions;
CREATE TABLE `reactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `emoji` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reaction` (`target_type`,`target_id`,`user_id`),
  KEY `fk_reactions_user` (`user_id`),
  KEY `idx_reactions_target` (`target_type`,`target_id`),
  CONSTRAINT `fk_reactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=35 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: reading_progress
-- -------------------------------------------------------------
DROP TABLE IF EXISTS reading_progress;
CREATE TABLE `reading_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `progress_percentage` int DEFAULT '0',
  `last_read_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reading_progress` (`user_id`,`novel_id`),
  KEY `fk_progress_novel` (`novel_id`),
  KEY `idx_progress_user` (`user_id`),
  CONSTRAINT `fk_progress_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=190 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: reading_sessions
-- -------------------------------------------------------------
DROP TABLE IF EXISTS reading_sessions;
CREATE TABLE `reading_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `session_start` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_active_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ended_at` timestamp NULL DEFAULT NULL,
  `duration_seconds` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `tab_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reading_sessions_user_active` (`user_id`,`is_active`),
  KEY `idx_reading_sessions_last_active` (`user_id`,`last_active_at`),
  CONSTRAINT `fk_reading_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: saved_novels
-- -------------------------------------------------------------
DROP TABLE IF EXISTS saved_novels;
CREATE TABLE `saved_novels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_novel` (`user_id`,`novel_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_novel` (`novel_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: schema_migrations
-- -------------------------------------------------------------
DROP TABLE IF EXISTS schema_migrations;
CREATE TABLE `schema_migrations` (
  `version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: sessions
-- -------------------------------------------------------------
DROP TABLE IF EXISTS sessions;
CREATE TABLE `sessions` (
  `token` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `session_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reader',
  PRIMARY KEY (`token`),
  KEY `idx_sessions_user` (`user_id`),
  KEY `idx_sessions_expires` (`expires_at`),
  KEY `idx_sessions_type` (`session_type`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: short_stories
-- -------------------------------------------------------------
DROP TABLE IF EXISTS short_stories;
CREATE TABLE `short_stories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title_ta` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `author` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Rudhra Prarthana',
  `genre` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Romance / Feel Good',
  `description` text COLLATE utf8mb4_unicode_ci,
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `word_count` int DEFAULT '0',
  `read_time` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '5 mins',
  `status` enum('draft','scheduled','published','disabled') COLLATE utf8mb4_unicode_ci DEFAULT 'published',
  `is_disabled` tinyint(1) DEFAULT '0',
  `visibility` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'public',
  `scheduled_at` datetime DEFAULT NULL,
  `timezone` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Asia/Kolkata',
  `views_count` int DEFAULT '0',
  `comments_count` int DEFAULT '0',
  `likes_count` int DEFAULT '0',
  `sort_order` int DEFAULT '1',
  `published_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `author_id` int DEFAULT NULL,
  `review_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'published',
  `admin_feedback` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_slug` (`slug`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: short_story_comments
-- -------------------------------------------------------------
DROP TABLE IF EXISTS short_story_comments;
CREATE TABLE `short_story_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `story_id` int NOT NULL,
  `user_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_story` (`story_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: site_settings
-- -------------------------------------------------------------
DROP TABLE IF EXISTS site_settings;
CREATE TABLE `site_settings` (
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: topic_reads
-- -------------------------------------------------------------
DROP TABLE IF EXISTS topic_reads;
CREATE TABLE `topic_reads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `topic_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_read_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_topic` (`user_id`,`topic_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_topic` (`topic_id`),
  KEY `idx_last_read` (`last_read_at`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: user_presence
-- -------------------------------------------------------------
DROP TABLE IF EXISTS user_presence;
CREATE TABLE `user_presence` (
  `session_key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int DEFAULT NULL,
  `visitor_type` enum('member','guest') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'guest',
  `last_activity` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_key`),
  KEY `idx_presence_last_activity` (`last_activity`),
  KEY `idx_presence_user` (`user_id`),
  KEY `idx_presence_type` (`visitor_type`),
  CONSTRAINT `fk_user_presence_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: users
-- -------------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `salt` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Member',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('active','blocked','suspended','disabled','pending_deletion') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `blocked_until` datetime DEFAULT NULL,
  `blocked_at` datetime DEFAULT NULL,
  `block_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `permissions` json DEFAULT NULL,
  `email_verified` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_username` (`username`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=90 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: writer_assignments
-- -------------------------------------------------------------
DROP TABLE IF EXISTS writer_assignments;
CREATE TABLE `writer_assignments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `writer_id` int NOT NULL,
  `content_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `instructions` text COLLATE utf8mb4_unicode_ci,
  `deadline` datetime DEFAULT NULL,
  `status` enum('active','completed','revoked') COLLATE utf8mb4_unicode_ci DEFAULT 'active',
  `assigned_by` int DEFAULT '2',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `actions` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'create,edit,submit,publish,schedule',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_writer_assignment` (`writer_id`,`content_type`,`content_id`),
  KEY `idx_writer_status` (`writer_id`,`status`),
  CONSTRAINT `writer_assignments_ibfk_1` FOREIGN KEY (`writer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: writer_audit_logs
-- -------------------------------------------------------------
DROP TABLE IF EXISTS writer_audit_logs;
CREATE TABLE `writer_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `writer_id` int DEFAULT NULL,
  `actor_id` int DEFAULT NULL,
  `action` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_writer` (`writer_id`),
  KEY `idx_audit_actor` (`actor_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_audit_writer` FOREIGN KEY (`writer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: writer_permissions
-- -------------------------------------------------------------
DROP TABLE IF EXISTS writer_permissions;
CREATE TABLE `writer_permissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `writer_id` int NOT NULL,
  `can_novels` tinyint(1) DEFAULT '1',
  `can_short_stories` tinyint(1) DEFAULT '0',
  `can_audio_novels` tinyint(1) DEFAULT '0',
  `can_episodes` tinyint(1) DEFAULT '1',
  `access_level` enum('view_only','draft_only','review_required','independent_publish') COLLATE utf8mb4_unicode_ci DEFAULT 'review_required',
  `full_access` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `access_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'particular',
  `permission_status` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `can_publish_independently` tinyint(1) NOT NULL DEFAULT '0',
  `can_schedule` tinyint(1) NOT NULL DEFAULT '0',
  `can_create` tinyint(1) NOT NULL DEFAULT '1',
  `can_edit` tinyint(1) NOT NULL DEFAULT '1',
  `can_submit` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `writer_id` (`writer_id`),
  CONSTRAINT `writer_permissions_ibfk_1` FOREIGN KEY (`writer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------
-- Table: writer_submissions
-- -------------------------------------------------------------
DROP TABLE IF EXISTS writer_submissions;
CREATE TABLE `writer_submissions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `writer_id` int NOT NULL,
  `content_type` enum('novel','short_story','audio_novel','chapter','episode','audio_episode') COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('pending_review','approved','changes_requested','rejected','published') COLLATE utf8mb4_unicode_ci DEFAULT 'pending_review',
  `admin_notes` text COLLATE utf8mb4_unicode_ci,
  `scheduled_at` datetime DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` datetime DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_submission_status` (`status`),
  KEY `idx_writer` (`writer_id`),
  CONSTRAINT `writer_submissions_ibfk_1` FOREIGN KEY (`writer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
