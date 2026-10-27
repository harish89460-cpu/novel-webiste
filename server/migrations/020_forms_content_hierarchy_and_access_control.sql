-- Migration 020: Forms, Novel Content, and Reading Management System
-- Implements 3-Level Hierarchy: Main Title -> Sub Title -> Content Title -> Reading Content
-- With dedicated comments and fine-grained individual member access control

-- 1. Extend forum_categories (Main Titles)
ALTER TABLE `forum_categories` 
  ADD COLUMN IF NOT EXISTS `status` VARCHAR(50) NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS `is_disabled` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `visibility` VARCHAR(50) NOT NULL DEFAULT 'public';

-- 2. Sub Titles Table
CREATE TABLE IF NOT EXISTS `content_subcategories` (
  `id` VARCHAR(100) NOT NULL PRIMARY KEY,
  `main_category_id` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `icon` VARCHAR(50) DEFAULT '📌',
  `novel_id` VARCHAR(100) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(50) NOT NULL DEFAULT 'published',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_disabled` TINYINT(1) NOT NULL DEFAULT 0,
  `visibility` VARCHAR(50) NOT NULL DEFAULT 'public',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_subcat_main` (`main_category_id`),
  KEY `idx_subcat_novel` (`novel_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Content Titles & Reading Content Table
CREATE TABLE IF NOT EXISTS `content_articles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `unique_slug` VARCHAR(150) NOT NULL UNIQUE,
  `main_category_id` VARCHAR(100) NOT NULL,
  `sub_category_id` VARCHAR(100) NOT NULL,
  `novel_id` VARCHAR(100) NULL,
  `chapter_num` VARCHAR(50) NULL,
  `title` VARCHAR(255) NOT NULL,
  `content` LONGTEXT NOT NULL,
  `summary` TEXT NULL,
  `cover_image` VARCHAR(500) NULL,
  `author_id` INT NOT NULL DEFAULT 2,
  `author_name` VARCHAR(100) DEFAULT 'Rudhra Prarthana',
  `status` VARCHAR(50) NOT NULL DEFAULT 'published',
  `is_published` TINYINT(1) NOT NULL DEFAULT 1,
  `is_disabled` TINYINT(1) NOT NULL DEFAULT 0,
  `visibility` VARCHAR(50) NOT NULL DEFAULT 'public',
  `views_count` INT NOT NULL DEFAULT 0,
  `comments_count` INT NOT NULL DEFAULT 0,
  `sort_order` INT NOT NULL DEFAULT 0,
  `published_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_article_hierarchy` (`main_category_id`, `sub_category_id`),
  KEY `idx_article_status` (`status`, `is_published`, `is_disabled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Dedicated Comments for Managed Content Items
CREATE TABLE IF NOT EXISTS `content_comments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `content_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `parent_id` INT NULL,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_content_comments` (`content_id`, `created_at`),
  KEY `idx_user_comments` (`user_id`),
  KEY `idx_parent_comment` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Individual Member Access Control Table
CREATE TABLE IF NOT EXISTS `content_access_rules` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `target_type` VARCHAR(32) NOT NULL,
  `target_id` VARCHAR(100) NOT NULL,
  `user_id` INT NULL,
  `rule_type` ENUM('block', 'allow', 'disable') NOT NULL DEFAULT 'block',
  `reason` VARCHAR(255) NULL,
  `expires_at` DATETIME NULL,
  `created_by_admin_id` INT NOT NULL DEFAULT 2,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_access_target` (`target_type`, `target_id`),
  KEY `idx_access_user` (`user_id`),
  KEY `idx_access_expiry` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
