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

-- 4. Create writer_permissions table
CREATE TABLE IF NOT EXISTS writer_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  writer_id INT NOT NULL,
  can_novels TINYINT(1) DEFAULT 1,
  can_short_stories TINYINT(1) DEFAULT 0,
  can_audio_novels TINYINT(1) DEFAULT 0,
  can_episodes TINYINT(1) DEFAULT 1,
  access_level ENUM('view_only','draft_only','review_required','independent_publish') DEFAULT 'review_required',
  full_access TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY writer_id (writer_id),
  CONSTRAINT fk_writer_perm_user FOREIGN KEY (writer_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Create writer_assignments table
CREATE TABLE IF NOT EXISTS writer_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  writer_id INT NOT NULL,
  content_type VARCHAR(50) NOT NULL,
  content_id VARCHAR(100) NOT NULL,
  title VARCHAR(255) DEFAULT NULL,
  instructions TEXT,
  deadline DATETIME DEFAULT NULL,
  status ENUM('active','completed','revoked') DEFAULT 'active',
  assigned_by INT DEFAULT 2,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_writer_status (writer_id, status),
  CONSTRAINT fk_writer_assign_user FOREIGN KEY (writer_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Create writer_submissions table
CREATE TABLE IF NOT EXISTS writer_submissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  writer_id INT NOT NULL,
  content_type ENUM('novel','short_story','audio_novel','chapter','episode','audio_episode') NOT NULL,
  content_id VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  parent_id VARCHAR(100) DEFAULT NULL,
  status ENUM('pending_review','approved','changes_requested','rejected','published') DEFAULT 'pending_review',
  admin_notes TEXT,
  scheduled_at DATETIME DEFAULT NULL,
  submitted_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME DEFAULT NULL,
  reviewed_by INT DEFAULT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_submission_status (status),
  KEY idx_writer (writer_id),
  CONSTRAINT fk_writer_sub_user FOREIGN KEY (writer_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
