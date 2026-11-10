-- Migration 035: Separate Novel Writing from Forum Threads in content_articles
-- Adds content_type column so Novel Management strictly displays only novels created through Novel Writing.

ALTER TABLE content_articles 
ADD COLUMN content_type VARCHAR(50) NOT NULL DEFAULT 'thread' AFTER parent_id;

CREATE INDEX idx_content_articles_content_type ON content_articles(content_type);

-- Existing data cleanup:
-- Mark novels created through the Novel Writing system as 'novel'
UPDATE content_articles 
SET content_type = 'novel' 
WHERE unique_slug LIKE 'novel-%' OR id = 257;

-- Ensure all other existing articles/threads are marked as 'thread'
UPDATE content_articles 
SET content_type = 'thread' 
WHERE unique_slug NOT LIKE 'novel-%' AND id != 257;
