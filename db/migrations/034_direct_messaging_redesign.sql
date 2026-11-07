-- Migration 034: Direct Messaging Redesign
-- Adds title, invite permissions, and creator tracking to conversations

SET @dbname = DATABASE();
SET @tablename = "conversations";

-- Add title column if not present
SET @colname = "title";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE conversations ADD COLUMN title VARCHAR(255) NULL AFTER id;"
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add allow_invite column if not present
SET @colname = "allow_invite";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE conversations ADD COLUMN allow_invite TINYINT(1) NOT NULL DEFAULT 1 AFTER is_locked;"
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add created_by column if not present
SET @colname = "created_by";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @colname
  ) > 0,
  "SELECT 1",
  "ALTER TABLE conversations ADD COLUMN created_by INT NULL AFTER allow_invite;"
));
PREPARE stmt FROM @preparedStatement;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
