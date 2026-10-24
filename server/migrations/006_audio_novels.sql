-- Rudhra Prarthana Novels — Database Migration 006
-- Audio Novels Feature Schema

CREATE TABLE IF NOT EXISTS `audio_novels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `cover` mediumtext COLLATE utf8mb4_unicode_ci,
  `source_type` enum('audio_file','youtube') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'youtube',
  `youtube_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `youtube_video_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audio_file_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audio_duration` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `episode_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `part_number` int DEFAULT '1',
  `language` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Tamil',
  `status` enum('draft','published') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `sort_order` int DEFAULT '0',
  `views` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_audio_status` (`status`),
  KEY `idx_audio_novel` (`novel_id`),
  KEY `idx_audio_sort` (`sort_order`),
  CONSTRAINT `fk_audio_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
