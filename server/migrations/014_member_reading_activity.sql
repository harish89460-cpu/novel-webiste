-- Migration 014: Member Reading Activity & Reading Duration Tracking
-- Rudhra Prarthana Novels

-- 1. Create reading_sessions table for authentic tracking of reader sessions
CREATE TABLE IF NOT EXISTS `reading_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `novel_id` VARCHAR(100) NOT NULL,
  `chapter_num` VARCHAR(50) NOT NULL,
  `session_start` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_active_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `ended_at` TIMESTAMP NULL,
  `duration_seconds` INT DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `tab_id` VARCHAR(64) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_reading_sessions_user_active` (`user_id`, `is_active`),
  INDEX `idx_reading_sessions_last_active` (`user_id`, `last_active_at`),
  CONSTRAINT `fk_reading_session_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Enhance activity_status with reading state and last-read cache
ALTER TABLE `activity_status`
  ADD COLUMN `current_novel_id` VARCHAR(100) NULL AFTER `last_seen`,
  ADD COLUMN `current_chapter_num` VARCHAR(50) NULL AFTER `current_novel_id`,
  ADD COLUMN `reading_session_start` TIMESTAMP NULL AFTER `current_chapter_num`,
  ADD COLUMN `reading_last_active` TIMESTAMP NULL AFTER `reading_session_start`,
  ADD COLUMN `reading_duration_seconds` INT DEFAULT 0 AFTER `reading_last_active`,
  ADD COLUMN `is_reading` TINYINT(1) DEFAULT 0 AFTER `reading_duration_seconds`,
  ADD COLUMN `last_read_novel_id` VARCHAR(100) NULL AFTER `is_reading`,
  ADD COLUMN `last_read_chapter_num` VARCHAR(50) NULL AFTER `last_read_novel_id`,
  ADD COLUMN `last_read_at` TIMESTAMP NULL AFTER `last_read_chapter_num`,
  ADD COLUMN `last_read_duration_seconds` INT DEFAULT 0 AFTER `last_read_at`;

-- 3. Populate initial last-read info from existing reading_progress records if available
UPDATE `activity_status` a
JOIN (
  SELECT user_id, novel_id, chapter_num, last_read_at
  FROM (
    SELECT user_id, novel_id, chapter_num, last_read_at,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY last_read_at DESC) as rn
    FROM reading_progress
  ) ranked
  WHERE rn = 1
) r ON a.user_id = r.user_id
SET 
  a.last_read_novel_id = r.novel_id,
  a.last_read_chapter_num = r.chapter_num,
  a.last_read_at = r.last_read_at
WHERE a.last_read_novel_id IS NULL;
