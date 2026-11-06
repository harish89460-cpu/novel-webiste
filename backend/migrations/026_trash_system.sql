-- Migration 026: Trash / Recycle Bin System
-- Stores deleted items with original metadata and full snapshot data for restoration

CREATE TABLE IF NOT EXISTS trash_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_type VARCHAR(50) NOT NULL,
  item_id VARCHAR(150) NOT NULL,
  title VARCHAR(255) NOT NULL,
  owner_id INT NULL,
  deleted_by INT NOT NULL,
  deleted_by_name VARCHAR(100) NULL,
  original_location VARCHAR(255) NULL,
  item_data LONGTEXT NOT NULL,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_trash_type (item_type),
  INDEX idx_trash_owner (owner_id),
  INDEX idx_trash_deleted_by (deleted_by),
  INDEX idx_trash_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

