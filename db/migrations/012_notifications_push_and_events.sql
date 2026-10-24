-- Rudhra Prarthana Novels — Database Migration 012
-- Complete Real-Time Notifications, Push Subscriptions, and Notification Preferences Schema

USE rp_novels_db;

-- 1. Extend notifications table with actor, entity metadata, and indexes
SET @exist_actor := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'notifications' 
    AND COLUMN_NAME = 'actor_id'
);

SET @sql_add_actor = IF(
  @exist_actor = 0,
  'ALTER TABLE notifications 
     ADD COLUMN actor_id INT NULL DEFAULT NULL AFTER user_id,
     ADD COLUMN entity_type VARCHAR(50) NULL DEFAULT NULL AFTER link,
     ADD COLUMN entity_id VARCHAR(100) NULL DEFAULT NULL AFTER entity_type,
     ADD INDEX idx_notif_user_created (user_id, created_at),
     ADD INDEX idx_notif_actor (actor_id),
     ADD CONSTRAINT fk_notifications_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL;',
  'SELECT "actor_id column already exists in notifications";'
);
PREPARE stmt_actor FROM @sql_add_actor;
EXECUTE stmt_actor;
DEALLOCATE PREPARE stmt_actor;

-- 2. Create Push Subscriptions Table for Web Push API & Chrome Background Delivery
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  endpoint VARCHAR(500) NOT NULL,
  p256dh VARCHAR(255) NOT NULL,
  auth VARCHAR(100) NOT NULL,
  user_agent VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_endpoint (endpoint),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_push_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create Notification Preferences Table
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INT PRIMARY KEY,
  notify_comments TINYINT(1) DEFAULT 1,
  notify_replies TINYINT(1) DEFAULT 1,
  notify_reactions TINYINT(1) DEFAULT 1,
  notify_forum TINYINT(1) DEFAULT 1,
  notify_chapters TINYINT(1) DEFAULT 1,
  notify_system TINYINT(1) DEFAULT 1,
  browser_enabled TINYINT(1) DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_pref_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Seed default preferences for existing users
INSERT INTO notification_preferences (user_id, notify_comments, notify_replies, notify_reactions, notify_forum, notify_chapters, notify_system, browser_enabled)
SELECT id, 1, 1, 1, 1, 1, 1, 0 FROM users
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
