-- Migration 033: Dynamic Updates / Announcement Panel System
-- Enables Admin to create custom update/announcement panels with category and novel visibility filters
-- and drag-and-drop unified sidebar panel ordering.

CREATE TABLE IF NOT EXISTS dynamic_update_panels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  badge VARCHAR(50) DEFAULT 'UPDATE',
  badge_color VARCHAR(50) DEFAULT '#B45309',
  badge_bg VARCHAR(50) DEFAULT 'rgba(217, 119, 6, 0.15)',
  icon VARCHAR(20) DEFAULT '📢',
  categories_json JSON NULL,
  novels_json JSON NULL,
  is_global TINYINT(1) DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active',
  sort_order INT DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status_order (status, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize default unified panel order in site_settings if not already present
INSERT INTO site_settings (setting_key, setting_value, updated_at)
VALUES (
  'forum_sidebar_panel_order',
  '["system_latest_updates","system_trending","system_profile_posts"]',
  NOW()
)
ON DUPLICATE KEY UPDATE setting_key = setting_key;

