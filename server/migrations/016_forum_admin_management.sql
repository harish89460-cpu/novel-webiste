-- Migration 016: Forum Admin Management & Categories Redesign
-- Adds category active state and color; adds topic content, image, is_pinned, and sort_order.

-- 1. Extend forum_categories
ALTER TABLE forum_categories
  ADD COLUMN IF NOT EXISTS is_active TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS color VARCHAR(50) NOT NULL DEFAULT '#2E1065';

-- 2. Extend forum_topics
ALTER TABLE forum_topics
  ADD COLUMN IF NOT EXISTS content TEXT NULL,
  ADD COLUMN IF NOT EXISTS image VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS is_pinned TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 3. Ensure the 5 primary requested categories exist and are ordered cleanly
UPDATE forum_categories 
SET title = 'General', icon = '💬', sort_order = 1, color = '#2E1065', is_active = 1 
WHERE id = 'general';

UPDATE forum_categories 
SET title = 'Ongoing Novels', icon = '📖', sort_order = 2, color = '#3B0764', is_active = 1 
WHERE id = 'ongoing-novels';

INSERT INTO forum_categories (id, title, description, icon, sort_order, is_active, color)
VALUES ('completed-novels', 'Completed Novels', 'Discussions, reviews, and reading experiences on completed novels and series.', '📚', 3, 1, '#4C1D95')
ON DUPLICATE KEY UPDATE 
  title = VALUES(title), 
  icon = VALUES(icon),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  color = VALUES(color);

UPDATE forum_categories 
SET title = 'Short Stories', icon = '✍️', sort_order = 4, color = '#581C87', is_active = 1 
WHERE id = 'short-stories';

INSERT INTO forum_categories (id, title, description, icon, sort_order, is_active, color)
VALUES ('audio-novels', 'Audio Novels', 'Listen, discuss, and review narrated audio novels and voice performances.', '🎧', 5, 1, '#6B21A8')
ON DUPLICATE KEY UPDATE 
  title = VALUES(title), 
  icon = VALUES(icon),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active),
  color = VALUES(color);

UPDATE forum_categories SET sort_order = 6 WHERE id = 'review-junction';
UPDATE forum_categories SET sort_order = 7 WHERE id = 'tea-time';
