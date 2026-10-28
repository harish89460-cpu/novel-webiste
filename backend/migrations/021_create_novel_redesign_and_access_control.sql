-- Migration 021: Admin Create Novel Form Redesign & Dynamic Categories with Access Control
-- Rudhra Prarthana Novels

-- 1. Create novel_genres lookup table
CREATE TABLE IF NOT EXISTS `novel_genres` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `slug` VARCHAR(100) NOT NULL UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Seed Standard & Existing Genres
INSERT IGNORE INTO `novel_genres` (`name`, `slug`) VALUES
  ('Romance / Drama', 'romance-drama'),
  ('Family Drama', 'family-drama'),
  ('Romantic Thriller', 'romantic-thriller'),
  ('Historical Fiction', 'historical-fiction'),
  ('Social / Contemporary', 'social-contemporary'),
  ('Mystery / Suspense', 'mystery-suspense'),
  ('Romance', 'romance'),
  ('Drama', 'drama'),
  ('Family', 'family'),
  ('Thriller', 'thriller'),
  ('Feel Good', 'feel-good'),
  ('Mystery / Thriller', 'mystery-thriller'),
  ('Family Drama / Romance', 'family-drama-romance'),
  ('Family Romance', 'family-romance'),
  ('Family / Emotional', 'family-emotional'),
  ('Romance / Poetry', 'romance-poetry');

-- 3. Extend novels table with content_type, access_permission, language, and scheduled_at
ALTER TABLE `novels`
  ADD COLUMN `content_type` VARCHAR(50) NOT NULL DEFAULT 'written_novel',
  ADD COLUMN `access_permission` VARCHAR(50) NOT NULL DEFAULT 'admin_only',
  ADD COLUMN `language` VARCHAR(50) NOT NULL DEFAULT 'Tamil',
  ADD COLUMN `scheduled_at` DATETIME NULL;

-- 4. Populate content_type for existing records
UPDATE `novels`
SET `content_type` = 'audio_novel'
WHERE `is_audio` = 1 OR `category` = 'Audio Novels';

UPDATE `novels`
SET `content_type` = 'short_story'
WHERE `category` = 'Short Stories';

