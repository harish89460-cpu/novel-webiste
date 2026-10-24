-- Migration 010: Persistent Unique Guest Visitor Tracking
-- Tracks anonymous unique guest visitors in a privacy-preserving manner
-- Excludes authenticated members

CREATE TABLE IF NOT EXISTS guest_visitors (
  visitor_id VARCHAR(64) NOT NULL PRIMARY KEY,
  first_visit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_visit_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  user_agent_hash VARCHAR(64) DEFAULT NULL,
  INDEX idx_last_visit (last_visit_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
