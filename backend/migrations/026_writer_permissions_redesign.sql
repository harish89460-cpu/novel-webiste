-- Migration 026: Writer Permissions & Content Assignment System Redesign
-- Rudhra Prarthana Novels — Pure MySQL Integration

-- 1. Extend writer_permissions with access_type, permission_status, and explicit flags
ALTER TABLE `writer_permissions`
  ADD COLUMN `access_type` VARCHAR(20) NOT NULL DEFAULT 'particular',
  ADD COLUMN `permission_status` VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN `can_publish_independently` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `can_schedule` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `can_create` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `can_edit` TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN `can_submit` TINYINT(1) NOT NULL DEFAULT 1;

-- Backfill access_type based on existing full_access column
UPDATE `writer_permissions` SET `access_type` = 'full' WHERE `full_access` = 1;
UPDATE `writer_permissions` SET `access_type` = 'particular' WHERE `full_access` = 0 OR `full_access` IS NULL;
UPDATE `writer_permissions` SET `can_publish_independently` = 1 WHERE `access_level` = 'independent_publish' OR `full_access` = 1;
UPDATE `writer_permissions` SET `can_schedule` = 1 WHERE `access_level` = 'independent_publish' OR `full_access` = 1;

-- 2. Modify writer_assignments to support all content types and configurable actions
ALTER TABLE `writer_assignments`
  MODIFY COLUMN `content_type` VARCHAR(50) NOT NULL,
  ADD COLUMN `actions` VARCHAR(255) NOT NULL DEFAULT 'create,edit,submit,publish,schedule';

ALTER TABLE `writer_assignments` ADD UNIQUE KEY `uq_writer_assignment` (`writer_id`, `content_type`, `content_id`);
