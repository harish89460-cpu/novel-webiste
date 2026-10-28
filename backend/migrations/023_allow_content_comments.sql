-- Migration 023: Allow comments table to support forms content and dynamic modules
-- Drops the foreign key constraint fk_comments_novel so novel_id can store content IDs like 'content_123'

ALTER TABLE comments DROP FOREIGN KEY fk_comments_novel;

