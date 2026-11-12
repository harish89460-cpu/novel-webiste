-- 037_update_panels_dynamic_activities.sql
-- Allow content column to be NULL since Update Announcement Content is no longer required

ALTER TABLE dynamic_update_panels MODIFY COLUMN content LONGTEXT NULL DEFAULT NULL;

