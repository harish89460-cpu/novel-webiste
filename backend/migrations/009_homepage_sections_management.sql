-- Migration 009: Homepage Sections & Priority Management System
-- Rudhra Prarthana Novels

-- 1. Extend homepage_sections table with rich configuration attributes
ALTER TABLE homepage_sections
  ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN section_type VARCHAR(50) NOT NULL DEFAULT 'custom',
  ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN content_limit INT NOT NULL DEFAULT 6,
  ADD COLUMN view_all_link VARCHAR(255) NULL,
  ADD COLUMN display_style VARCHAR(50) NOT NULL DEFAULT 'grid',
  ADD COLUMN settings TEXT NULL,
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_by INT NULL;

-- 2. Populate metadata for existing 5 default system sections
UPDATE homepage_sections SET
  name = 'Featured Ongoing Novels',
  section_type = 'featured',
  is_system = 1,
  content_limit = 4,
  view_all_link = '#novels?status=ongoing',
  display_style = 'grid'
WHERE section_key = 'featured';

UPDATE homepage_sections SET
  name = 'Continue Reading',
  section_type = 'continue_reading',
  is_system = 1,
  content_limit = 4,
  view_all_link = '#novels?status=ongoing',
  display_style = 'grid'
WHERE section_key = 'continue_reading';

UPDATE homepage_sections SET
  name = 'Audio Novels',
  section_type = 'audio',
  is_system = 1,
  content_limit = 4,
  view_all_link = '#audio',
  display_style = 'grid'
WHERE section_key = 'audio';

UPDATE homepage_sections SET
  name = 'Trending Novels',
  section_type = 'trending',
  is_system = 1,
  content_limit = 5,
  view_all_link = '#novels',
  display_style = 'list'
WHERE section_key = 'trending';

UPDATE homepage_sections SET
  name = 'Completed Works',
  section_type = 'completed',
  is_system = 1,
  content_limit = 4,
  view_all_link = '#novels?status=completed',
  display_style = 'grid'
WHERE section_key = 'completed';

-- 3. Register additional core homepage sections (forum, spotlight, CTA) to achieve complete admin priority control
INSERT INTO homepage_sections (section_key, name, title, subtitle, section_type, is_system, is_visible, sort_order, content_limit, view_all_link, display_style)
VALUES
  ('forum', 'Reader Discussions & Community', 'Latest Discussions & Community', 'Reader Forum', 'forum', 1, 1, 6, 5, '#forum', 'list'),
  ('author_spotlight', 'Featured Author Spotlight', 'Author Spotlight', 'Rudhra Prarthana', 'author_spotlight', 1, 1, 7, 1, '#member?id=rudhra', 'spotlight'),
  ('community_cta', 'Community Call to Action', 'Join Our Reader Community', 'Connect & Share', 'community_cta', 1, 1, 8, 1, '#forum', 'banner')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  section_type = VALUES(section_type),
  is_system = VALUES(is_system);

-- 4. Create homepage_section_items table for custom curated collections
CREATE TABLE IF NOT EXISTS homepage_section_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  section_key VARCHAR(100) NOT NULL,
  novel_id VARCHAR(100) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sec_key (section_key),
  INDEX idx_novel_id (novel_id),
  CONSTRAINT fk_hsi_novel FOREIGN KEY (novel_id) REFERENCES novels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
