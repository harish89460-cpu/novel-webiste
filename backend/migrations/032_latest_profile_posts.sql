-- Migration 032: Latest Profile Posts System
-- Provides dedicated tables for user profile posts and comments, completely isolated from novels, threads, and articles.

CREATE TABLE IF NOT EXISTS profile_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_profile_posts_user (user_id),
  INDEX idx_profile_posts_created (created_at DESC),
  CONSTRAINT fk_profile_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profile_post_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_pp_comments_post (post_id),
  INDEX idx_pp_comments_user (user_id),
  INDEX idx_pp_comments_created (created_at ASC),
  CONSTRAINT fk_pp_comments_post FOREIGN KEY (post_id) REFERENCES profile_posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_pp_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

