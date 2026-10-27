-- Migration 015: Admin Member Management & Security Audit Logs
-- Rudhra Prarthana Novels — MySQL 8.0

-- 1. Modify users table status enum to support suspended and disabled statuses
ALTER TABLE `users` 
MODIFY COLUMN `status` ENUM('active','blocked','suspended','disabled','pending_deletion') NOT NULL DEFAULT 'active';

-- 2. Create admin_audit_logs table for sensitive administrative operations
CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `admin_id` INT NOT NULL,
  `target_user_id` INT NULL,
  `action` VARCHAR(60) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'success',
  `details` TEXT NULL,
  `metadata` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_audit_admin` (`admin_id`),
  KEY `idx_admin_audit_target` (`target_user_id`),
  KEY `idx_admin_audit_action` (`action`),
  KEY `idx_admin_audit_created` (`created_at`),
  CONSTRAINT `fk_admin_audit_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
