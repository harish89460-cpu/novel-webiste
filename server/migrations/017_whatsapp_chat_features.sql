-- Migration 017: WhatsApp-like Chat Features
-- Rudhra Prarthana Novels
-- Image Attachments, Voice Messages, Message Editing, Unsending, & Lock/Unlock Controls

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Enhance messages table with attachment, editing, and deletion fields
-- ALTER TABLE messages ADD COLUMN message_type VARCHAR(20) NOT NULL DEFAULT 'text';
-- ALTER TABLE messages ADD COLUMN attachment_url VARCHAR(500) NULL;
-- ALTER TABLE messages ADD COLUMN attachment_meta JSON NULL;
-- ALTER TABLE messages ADD COLUMN is_edited TINYINT(1) NOT NULL DEFAULT 0;
-- ALTER TABLE messages ADD COLUMN edited_at TIMESTAMP NULL;
-- ALTER TABLE messages ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0;
-- ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMP NULL;
-- ALTER TABLE messages ADD COLUMN deleted_by INT NULL;

-- 2. Enhance conversations table with conversation-level locking
-- ALTER TABLE conversations ADD COLUMN is_locked TINYINT(1) NOT NULL DEFAULT 0;
-- ALTER TABLE conversations ADD COLUMN locked_by INT NULL;
-- ALTER TABLE conversations ADD COLUMN locked_reason VARCHAR(255) NULL;
-- ALTER TABLE conversations ADD COLUMN locked_at TIMESTAMP NULL;

SET FOREIGN_KEY_CHECKS = 1;
