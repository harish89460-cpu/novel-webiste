-- Migration 031: Novel Writing and Novel Management System
-- Allows main_category_id to have a clean default so standalone novel drafts save without category constraints

ALTER TABLE content_articles MODIFY COLUMN main_category_id VARCHAR(100) NULL DEFAULT 'rudhra_prarthana_tamil_novels';
