-- Rudhra Prarthana Novels — Database Migration 003
-- Admin & Author Dashboard: Episodes Hierarchy, Publishing Scheduler, Media Management, Settings

USE rp_novels_db;

-- 1. Modify chapters table to support nested episode numbers (e.g. 1.1, 1.2), parent-child relationships, scheduling, and draft status
ALTER TABLE chapters
  MODIFY COLUMN chapter_num VARCHAR(50) NOT NULL,
  ADD COLUMN parent_id INT NULL DEFAULT NULL AFTER novel_id,
  ADD COLUMN episode_number VARCHAR(50) NULL DEFAULT NULL AFTER chapter_num,
  ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'published' AFTER release_date,
  ADD COLUMN scheduled_at DATETIME NULL DEFAULT NULL AFTER status,
  ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata' AFTER scheduled_at,
  ADD COLUMN published_at DATETIME NULL DEFAULT NULL AFTER timezone,
  ADD COLUMN sort_order DECIMAL(10,4) NOT NULL DEFAULT 1.0000 AFTER published_at,
  ADD INDEX idx_chapters_parent (parent_id),
  ADD INDEX idx_chapters_status_sched (status, scheduled_at),
  ADD INDEX idx_chapters_sort (sort_order);

-- Populate episode_number and published_at for existing rows
UPDATE chapters 
SET episode_number = chapter_num,
    published_at = created_at
WHERE episode_number IS NULL;

-- 2. Modify comments and reading_progress to support nested episode strings
ALTER TABLE comments
  MODIFY COLUMN chapter_num VARCHAR(50) DEFAULT '0';

ALTER TABLE reading_progress
  MODIFY COLUMN chapter_num VARCHAR(50) NOT NULL;

-- 3. Media Management Table
CREATE TABLE IF NOT EXISTS media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_media_created (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Settings Table
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prepopulate settings
INSERT INTO site_settings (setting_key, setting_value)
VALUES 
  ('author_name', 'Rudhra Prarthana'),
  ('default_timezone', 'Asia/Kolkata'),
  ('site_title', 'Rudhra Prarthana Novels'),
  ('editor_autosave_interval', '30')
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
