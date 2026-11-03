-- Migration 028: Seed Official Category Subcategories
-- Rudhra Prarthana Novels — MySQL 8.0 Relational Architecture

INSERT INTO `content_subcategories` (
  `id`, `main_category_id`, `title`, `description`, `icon`, `sort_order`,
  `status`, `is_active`, `is_disabled`, `visibility`, `access_permission`
) VALUES
  ('welcome-to-rudhra-novels', 'general', 'Welcome to Rudhra Novels', 'Official welcome notes, guidelines, and introductions to Rudhra Prarthana Novels.', '🌸', 1, 'published', 1, 0, 'public', 'admin_only'),
  ('welcome-notes', 'general', 'Welcome Notes', 'Essential reading guides and official announcements.', '📌', 2, 'published', 1, 0, 'public', 'admin_only'),
  ('announcements', 'general', 'Announcements', 'Official platform news, special updates, and author announcements.', '📢', 3, 'published', 1, 0, 'public', 'admin_only'),
  ('tea-time-notes', 'general', 'Tea Time', 'Casual reading conversations and reflections.', '☕', 4, 'published', 1, 0, 'public', 'all_members'),
  ('ongoing-novels-discussion', 'ongoing-novels', 'Ongoing Novels Discussions & Updates', 'Discussions and episode updates for ongoing serials.', '📖', 1, 'published', 1, 0, 'public', 'all_members'),
  ('completed-novels-archive', 'completed-novels', 'Completed Novels Archive', 'Full novels archive and reader discussions.', '📚', 1, 'published', 1, 0, 'public', 'all_members'),
  ('short-stories-collection', 'short-stories', 'Short Stories Collection', 'Standalone short stories and literary pieces.', '🪶', 1, 'published', 1, 0, 'public', 'all_members'),
  ('audio-novels-releases', 'audio-novels', 'Audio Novels & Voice Releases', 'Narrated audio novels, voice episodes, and listener reviews.', '🎧', 1, 'published', 1, 0, 'public', 'all_members')
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  icon = VALUES(icon),
  sort_order = VALUES(sort_order),
  access_permission = VALUES(access_permission);
