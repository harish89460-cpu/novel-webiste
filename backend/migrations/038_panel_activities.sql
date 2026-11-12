-- 038_panel_activities.sql
-- Create panel_activities table for tracking real-time activities across categories and novels

CREATE TABLE IF NOT EXISTS panel_activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id VARCHAR(100) NOT NULL,
  sub_category_id VARCHAR(100) DEFAULT NULL,
  novel_id VARCHAR(100) DEFAULT NULL,
  user_id INT NOT NULL,
  user_name VARCHAR(150) NOT NULL,
  user_avatar VARCHAR(500) DEFAULT '/profile.png',
  activity_type VARCHAR(50) NOT NULL,
  title VARCHAR(300) NOT NULL,
  preview VARCHAR(500) DEFAULT NULL,
  emoji VARCHAR(20) DEFAULT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  url VARCHAR(300) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cat (category_id),
  INDEX idx_subcat (sub_category_id),
  INDEX idx_novel (novel_id),
  INDEX idx_target (target_type, target_id),
  INDEX idx_user_target (user_id, target_type, target_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill existing published content_articles
INSERT INTO panel_activities (
  category_id, sub_category_id, novel_id, user_id, user_name, user_avatar,
  activity_type, title, preview, emoji, target_type, target_id, url, created_at
)
SELECT 
  ca.main_category_id,
  ca.sub_category_id,
  CAST(ca.id AS CHAR),
  ca.author_id,
  COALESCE(p.display_name, u.username, ca.author_name, 'Member'),
  COALESCE(p.avatar, '/profile.png'),
  IF(ca.content_type = 'novel', 'novel_published', 'thread_created'),
  ca.title,
  LEFT(REGEXP_REPLACE(ca.content, '<[^>]+>', ''), 120),
  NULL,
  IF(ca.content_type = 'novel', 'novel', 'thread'),
  CAST(ca.id AS CHAR),
  CONCAT('#thread?id=', COALESCE(ca.unique_slug, CAST(ca.id AS CHAR))),
  ca.created_at
FROM content_articles ca
LEFT JOIN users u ON ca.author_id = u.id
LEFT JOIN profiles p ON u.id = p.user_id
WHERE ca.is_published = 1 AND ca.is_disabled = 0;

-- Backfill comments
INSERT INTO panel_activities (
  category_id, sub_category_id, novel_id, user_id, user_name, user_avatar,
  activity_type, title, preview, emoji, target_type, target_id, url, created_at
)
SELECT 
  COALESCE(ca.main_category_id, 'general'),
  ca.sub_category_id,
  COALESCE(CAST(ca.id AS CHAR), c.novel_id),
  c.user_id,
  COALESCE(p.display_name, u.username, 'Member'),
  COALESCE(p.avatar, '/profile.png'),
  IF(c.parent_id IS NOT NULL, 'reply_created', 'comment_created'),
  COALESCE(ca.title, 'Discussion Thread'),
  LEFT(REGEXP_REPLACE(c.content, '<[^>]+>', ''), 120),
  NULL,
  IF(c.parent_id IS NOT NULL, 'reply', 'comment'),
  CAST(c.id AS CHAR),
  COALESCE(
    IF(ca.id IS NOT NULL, CONCAT('#thread?id=', COALESCE(ca.unique_slug, CAST(ca.id AS CHAR)), '#comment-', c.id), NULL),
    CONCAT('#thread?id=', c.novel_id)
  ),
  c.created_at
FROM comments c
JOIN users u ON c.user_id = u.id
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN content_articles ca ON (
  c.novel_id = CONCAT('content_', ca.id) 
  OR c.novel_id = CAST(ca.id AS CHAR) 
  OR c.novel_id = ca.unique_slug
);

-- Backfill reactions
INSERT INTO panel_activities (
  category_id, sub_category_id, novel_id, user_id, user_name, user_avatar,
  activity_type, title, preview, emoji, target_type, target_id, url, created_at
)
SELECT 
  COALESCE(ca.main_category_id, 'general'),
  ca.sub_category_id,
  COALESCE(CAST(ca.id AS CHAR), CAST(r.target_id AS CHAR)),
  r.user_id,
  COALESCE(p.display_name, u.username, 'Member'),
  COALESCE(p.avatar, '/profile.png'),
  'reaction_added',
  COALESCE(ca.title, 'Discussion Thread'),
  CONCAT('Reacted with ', r.emoji),
  r.emoji,
  r.target_type,
  CAST(r.target_id AS CHAR),
  COALESCE(
    IF(ca.id IS NOT NULL, CONCAT('#thread?id=', COALESCE(ca.unique_slug, CAST(ca.id AS CHAR))), NULL),
    CONCAT('#thread?id=', r.target_id)
  ),
  r.created_at
FROM reactions r
JOIN users u ON r.user_id = u.id
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN content_articles ca ON (
  (r.target_type = 'content' AND (r.target_id = CAST(ca.id AS CHAR) OR r.target_id = ca.unique_slug))
);
