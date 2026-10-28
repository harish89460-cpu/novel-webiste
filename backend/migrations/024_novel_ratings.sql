-- Migration 024: Create novel_ratings table
-- Enables authentic member 1-5 star ratings for novels, preventing duplicates per user and computing real average scores.

CREATE TABLE IF NOT EXISTS novel_ratings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  novel_id VARCHAR(100) NOT NULL,
  rating TINYINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_novel_rating (user_id, novel_id),
  KEY idx_novel_ratings_novel (novel_id),
  KEY idx_novel_ratings_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

