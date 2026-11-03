-- Rudhra Prarthana Novels — Database Migration 005
-- Enlarge avatar and cover columns to MEDIUMTEXT to accommodate base64 uploads

ALTER TABLE profiles MODIFY avatar MEDIUMTEXT;
ALTER TABLE novels MODIFY cover MEDIUMTEXT;
