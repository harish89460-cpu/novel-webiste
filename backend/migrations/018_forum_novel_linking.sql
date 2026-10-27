-- Migration 018: Add novel_id and chapter_num to forum_topics and link topics to novels
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS novel_id VARCHAR(100) NULL AFTER category_title;
ALTER TABLE forum_topics ADD COLUMN IF NOT EXISTS chapter_num VARCHAR(50) NULL AFTER novel_id;

UPDATE forum_topics SET novel_id = 'kaadhal-konden-kanave', chapter_num = '18' WHERE id = 'topic-kaadhal-kanave-18';
UPDATE forum_topics SET novel_id = 'nenjam-marappadhillai', chapter_num = '24' WHERE id = 'topic-nenjam-24';
UPDATE forum_topics SET novel_id = 'kaadhal-konden-kanave' WHERE id = 'topic-tamil-kanave';
UPDATE forum_topics SET novel_id = 'poongaatru-punnagaikka' WHERE id = 'topic-short-story';
UPDATE forum_topics SET novel_id = 'nenjam-marappadhillai' WHERE id = 'topic-review-style';
UPDATE forum_topics SET novel_id = 'nenjam-marappadhillai' WHERE id = 'topic-rain-coffee';
