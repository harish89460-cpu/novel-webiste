-- Migration 008: Writer Management System, Novel Ownership & Audit Logs
-- Rudhra Prarthana Novels

-- 1. Extend users table
ALTER TABLE users ADD COLUMN status ENUM('active', 'blocked', 'pending_deletion') NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN created_by INT NULL;
ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL;

ALTER TABLE users ADD INDEX idx_users_status (status);

-- 2. Extend novels table with author_id (user ownership reference)
ALTER TABLE novels ADD COLUMN author_id INT NULL;
ALTER TABLE novels ADD INDEX idx_novels_author_id (author_id);

-- Backfill existing novels to be owned by author Rudhra (user_id = 2)
UPDATE novels SET author_id = 2 WHERE author_id IS NULL;

-- 3. Create writer_audit_logs table for administrative tracking
CREATE TABLE IF NOT EXISTS writer_audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  writer_id INT NULL,
  actor_id INT NULL,
  action VARCHAR(60) NOT NULL,
  details TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_writer (writer_id),
  INDEX idx_audit_actor (actor_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at),
  CONSTRAINT fk_audit_writer FOREIGN KEY (writer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
