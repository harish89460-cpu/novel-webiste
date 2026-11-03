-- Migration 025: Ensure audio-novels category exists and categories have clear sort orders

UPDATE forum_categories SET id = 'short-stories' WHERE id = 'Short stories';

INSERT INTO forum_categories (id, title, icon, color, sort_order, is_active, status, is_disabled, visibility)
VALUES ('audio-novels', 'Audio Novels', '🎧', '#312E81', 5, 1, 'published', 0, 'public')
ON DUPLICATE KEY UPDATE 
  title = VALUES(title),
  icon = VALUES(icon);

