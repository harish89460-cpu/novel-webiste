-- 036_reactions_emoji_binary_collation.sql
-- Ensure reactions.emoji uses utf8mb4_bin collation so diverse emojis (👍, 😍, ❤️, 😂, etc.) are treated uniquely
ALTER TABLE reactions MODIFY emoji VARCHAR(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

