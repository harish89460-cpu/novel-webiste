-- Migration 022: Nested Forms & Content Hierarchy, Access Permissions and Scheduling
-- Adds parent_id, access_permission, and scheduled_at to content_articles and content_subcategories

ALTER TABLE content_articles 
  ADD COLUMN parent_id INT NULL DEFAULT NULL AFTER sub_category_id,
  ADD COLUMN access_permission VARCHAR(50) NOT NULL DEFAULT 'admin_only' AFTER visibility,
  ADD COLUMN scheduled_at DATETIME NULL DEFAULT NULL AFTER published_at,
  ADD INDEX idx_content_articles_parent (parent_id);

ALTER TABLE content_subcategories
  ADD COLUMN parent_id VARCHAR(100) NULL DEFAULT NULL AFTER main_category_id,
  ADD COLUMN access_permission VARCHAR(50) NOT NULL DEFAULT 'admin_only' AFTER visibility,
  ADD INDEX idx_content_subs_parent (parent_id);

