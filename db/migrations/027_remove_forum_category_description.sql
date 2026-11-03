-- Migration 027: Remove Description column from forum_categories
ALTER TABLE `forum_categories` DROP COLUMN `description`;

