-- Migration 030: Completely Remove Audio Novels, Novels, and Short Stories modules
-- Dropping module-specific tables, foreign keys, and columns while strictly preserving Form Management, Users, Profiles, Forums, and Chat.

-- 1. Drop dependent tables referencing novels or chapters
DROP TABLE IF EXISTS homepage_section_items;
DROP TABLE IF EXISTS reading_progress;
DROP TABLE IF EXISTS reading_sessions;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS chapters;
DROP TABLE IF EXISTS audio_novels;
DROP TABLE IF EXISTS saved_novels;
DROP TABLE IF EXISTS novel_ratings;
DROP TABLE IF EXISTS short_story_comments;
DROP TABLE IF EXISTS short_stories;
DROP TABLE IF EXISTS novels;
DROP TABLE IF EXISTS novel_genres;

-- 2. Clean up legacy columns in content_subcategories and content_articles
ALTER TABLE content_subcategories DROP COLUMN novel_id;
ALTER TABLE content_articles DROP COLUMN novel_id;
ALTER TABLE content_articles DROP COLUMN novel_link;
ALTER TABLE content_articles DROP COLUMN chapter_num;

-- 3. Modify writer_submissions to support articles without legacy novel enum constraints
ALTER TABLE writer_submissions MODIFY COLUMN content_type VARCHAR(50) NOT NULL;

-- 4. Purge legacy novel/audio/short story rows from trash, homepage sections, assignments, and submissions
DELETE FROM trash_items WHERE item_type IN ('novel', 'chapter', 'short_story', 'audio_novel');
DELETE FROM homepage_sections WHERE section_key IN ('audio', 'completed', 'continue_reading', 'featured', 'trending') OR section_type IN ('audio', 'featured', 'completed', 'continue_reading', 'trending');
DELETE FROM writer_assignments WHERE content_type IN ('novel', 'short_story', 'audio_novel', 'chapter', 'episode', 'audio_episode');
DELETE FROM writer_submissions WHERE content_type IN ('novel', 'short_story', 'audio_novel', 'chapter', 'episode', 'audio_episode');
DELETE FROM content_access_rules WHERE target_type IN ('novel', 'audio_novel', 'short_story');
DELETE FROM notifications WHERE type IN ('chapter_release', 'audio_release', 'novel_update');
