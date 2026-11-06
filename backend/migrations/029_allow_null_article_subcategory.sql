-- Migration 029: Allow NULL sub_category_id for articles created directly under main categories
ALTER TABLE content_articles MODIFY COLUMN sub_category_id VARCHAR(100) NULL DEFAULT NULL;

