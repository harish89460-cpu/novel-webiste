-- Migration: 011_novel_comments_nested_replies.sql
-- Add parent_id to comments table for Instagram-style nested threaded replies
-- Normalize chapter_num for novel-level comments

-- 1. Add parent_id column if not exists
SET @exist_parent := (
  SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'comments' 
    AND COLUMN_NAME = 'parent_id'
);

SET @sql_add_parent = IF(
  @exist_parent = 0,
  'ALTER TABLE comments ADD COLUMN parent_id INT NULL DEFAULT NULL AFTER user_id, ADD INDEX idx_comments_parent (parent_id);',
  'SELECT "Column parent_id already exists in comments";'
);
PREPARE stmt_add_parent FROM @sql_add_parent;
EXECUTE stmt_add_parent;
DEALLOCATE PREPARE stmt_add_parent;

-- 2. Normalize existing novel-level comments where chapter_num is empty string or NULL to '0'
UPDATE comments 
SET chapter_num = '0' 
WHERE chapter_num = '' OR chapter_num IS NULL;
