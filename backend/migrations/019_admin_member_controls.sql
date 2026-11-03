-- Migration 019: Admin Member Account Controls & Granular Permissions
-- Rudhra Prarthana Novels — MySQL 8.0 Relational Architecture

-- 1. Add temporary block and permission columns to users table
ALTER TABLE `users`
ADD COLUMN `blocked_until` DATETIME NULL AFTER `status`,
ADD COLUMN `blocked_at` DATETIME NULL AFTER `blocked_until`,
ADD COLUMN `block_reason` VARCHAR(255) NULL AFTER `blocked_at`,
ADD COLUMN `permissions` JSON NULL AFTER `block_reason`;

