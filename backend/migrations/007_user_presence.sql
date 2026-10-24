-- Migration 007: Real-Time User & Guest Online Presence Tracking
-- Rudhra Prarthana Novels

CREATE TABLE IF NOT EXISTS user_presence (
  session_key VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id INT NULL,
  visitor_type ENUM('member', 'guest') NOT NULL DEFAULT 'guest',
  last_activity TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_presence_last_activity (last_activity),
  INDEX idx_presence_user (user_id),
  INDEX idx_presence_type (visitor_type),
  CONSTRAINT fk_user_presence_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
