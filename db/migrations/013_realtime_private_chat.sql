-- Migration 013: Real-Time One-to-One Private Chat System
-- Rudhra Prarthana Novels

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Conversations Table
CREATE TABLE IF NOT EXISTS `conversations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_message_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_conv_updated` (`updated_at`),
  INDEX `idx_conv_last_msg` (`last_message_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Conversation Participants Table (One-to-One)
CREATE TABLE IF NOT EXISTS `conversation_participants` (
  `conversation_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `last_read_at` TIMESTAMP NULL,
  `unread_count` INT NOT NULL DEFAULT 0,
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`conversation_id`, `user_id`),
  INDEX `idx_cp_user` (`user_id`, `conversation_id`),
  CONSTRAINT `fk_cp_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cp_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS `messages` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` INT NOT NULL,
  `sender_id` INT NOT NULL,
  `content` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `read_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_messages_conv` (`conversation_id`, `created_at`),
  INDEX `idx_messages_sender` (`sender_id`),
  CONSTRAINT `fk_messages_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Chat Settings (Global Chat Availability)
CREATE TABLE IF NOT EXISTS `chat_settings` (
  `user_id` INT PRIMARY KEY,
  `is_chat_available` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_chat_settings_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Individual Chat Locks (User-to-User Lock)
CREATE TABLE IF NOT EXISTS `chat_locks` (
  `user_id` INT NOT NULL,
  `target_user_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `target_user_id`),
  INDEX `idx_chat_lock_target` (`target_user_id`),
  CONSTRAINT `fk_chat_lock_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_lock_target` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Administrator Chat Audit Logs
CREATE TABLE IF NOT EXISTS `admin_chat_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id` INT NOT NULL,
  `writer_id` INT NOT NULL,
  `conversation_id` INT NOT NULL,
  `action` VARCHAR(60) NOT NULL DEFAULT 'view_writer_history',
  `ip_address` VARCHAR(45) NULL,
  `viewed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_admin` (`admin_id`),
  INDEX `idx_audit_writer` (`writer_id`),
  INDEX `idx_audit_conv` (`conversation_id`),
  CONSTRAINT `fk_audit_admin_user` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_audit_writer_user` FOREIGN KEY (`writer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_audit_conv` FOREIGN KEY (`conversation_id`) REFERENCES `conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initialize default chat settings (is_chat_available = 1) for all existing users
INSERT IGNORE INTO `chat_settings` (`user_id`, `is_chat_available`)
SELECT `id`, 1 FROM `users`;

SET FOREIGN_KEY_CHECKS = 1;
