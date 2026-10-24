-- Rudhra Prarthana Novels — MySQL Database Backup
-- Created: 2026-10-23T13:08:55.247Z
SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS `activity_status`;
CREATE TABLE `activity_status` (
  `user_id` int NOT NULL,
  `is_enabled` tinyint(1) DEFAULT '1',
  `is_online` tinyint(1) DEFAULT '0',
  `last_seen` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_activity_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (2, 1, 1, '2026-10-23 18:38:48');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (28, 0, 1, '2026-10-23 17:19:14');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (36, 1, 1, '2026-10-22 18:38:32');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (37, 1, 1, '2026-10-23 18:01:17');

DROP TABLE IF EXISTS `audio_novels`;
CREATE TABLE `audio_novels` (
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
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `audio_novels` (`id`, `title`, `slug`, `novel_id`, `description`, `cover`, `source_type`, `youtube_url`, `youtube_video_id`, `audio_file_url`, `audio_duration`, `episode_number`, `part_number`, `language`, `status`, `sort_order`, `views`, `created_at`, `updated_at`) VALUES (1, 'Maaya Nadhi Theeram — Part 1', 'maaya-nadhi-theeram-part-1', 'maaya-nadhi-theeram', 'Official Audio Story of Maaya Nadhi Theeram. Experience the enchanting love story narrated with evocative background music and authentic emotional depth.', '/default-cover.jpg', 'youtube', 'https://www.youtube.com/@rudhraprarthanaaudionovels', NULL, NULL, '4h 25m', 'Part 1', 1, 'Tamil', 'published', 1, 1293, '2026-10-21 23:19:52', '2026-10-22 23:01:55');
INSERT INTO `audio_novels` (`id`, `title`, `slug`, `novel_id`, `description`, `cover`, `source_type`, `youtube_url`, `youtube_video_id`, `audio_file_url`, `audio_duration`, `episode_number`, `part_number`, `language`, `status`, `sort_order`, `views`, `created_at`, `updated_at`) VALUES (2, 'Maaya Nadhi Theeram — Part 2', 'maaya-nadhi-theeram-part-2', 'maaya-nadhi-theeram', 'Part 2 of Maaya Nadhi Theeram audio story. Continue the heartwarming emotional journey.', '/default-cover.jpg', 'youtube', 'https://www.youtube.com/@rudhraprarthanaaudionovels', NULL, NULL, '3h 50m', 'Part 2', 2, 'Tamil', 'published', 2, 946, '2026-10-21 23:19:52', '2026-10-22 23:01:55');

DROP TABLE IF EXISTS `chapters`;
CREATE TABLE `chapters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_id` int DEFAULT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `episode_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title_ta` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `content` mediumtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_guest_allowed` tinyint(1) DEFAULT '1',
  `is_audio` tinyint(1) DEFAULT '0',
  `word_count` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `read_time` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `release_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `scheduled_at` datetime DEFAULT NULL,
  `timezone` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Asia/Kolkata',
  `published_at` datetime DEFAULT NULL,
  `sort_order` decimal(10,4) NOT NULL DEFAULT '1.0000',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_novel_chapter` (`novel_id`,`chapter_num`),
  KEY `idx_chapter_novel` (`novel_id`),
  KEY `idx_chapter_num` (`chapter_num`),
  KEY `idx_chapters_parent` (`parent_id`),
  KEY `idx_chapters_status_sched` (`status`,`scheduled_at`),
  KEY `idx_chapters_sort` (`sort_order`),
  CONSTRAINT `fk_chapters_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (7, 'kaadhal-konden-kanave', NULL, '1', NULL, 'Chapter 01 — Dream Journey', 'Chapter 01 — Dream Journey', 'In the quiet glow of twilight, dreams often weave paths that reality hesitates to tread. Ananya sketched the riverbank in her notebook, watching the twilight colors blend into indigo.

She had always believed in the power of destiny. When an unfamiliar shadow crossed the pathway, she looked up, surprised to find someone admiring her artwork.

"You capture the light remarkably well," a voice murmured. That single sentence would change everything.', 1, 0, '2,200 words', '6 mins', '15 Jan 2026', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-21 22:13:55', '2026-10-21 22:13:55');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (8, 'kaadhal-konden-kanave', NULL, '18', NULL, 'Chapter 18 — Soft Touch', 'Chapter 18 — Soft Touch', 'Standing atop the hilltop temple stairs, the city lights spread beneath them like an ocean of fallen stars.

"Do you still doubt what we have?" Siddharth asked softly, reaching out to hold her hand in the cool night air.

Ananya looked into his eyes and felt the doubts of months evaporate into the night breeze. With a gentle nod, she knew they were ready to face whatever family challenges lay ahead.', 1, 0, '2,900 words', '9 mins', '07 Oct 2026', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-21 22:13:55', '2026-10-21 22:13:55');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (9, 'uyire-unakkaga', NULL, '1', NULL, 'Chapter 01 — Motherhood Lullaby', 'Chapter 01 — Motherhood Lullaby', 'The aroma of freshly ground spices filled the small kitchen where Meenakshi Amma worked tirelessly before the break of dawn.

Her three children slept soundly in the next room, oblivious to the financial burdens she bore alone since her husband\'s untimely passing. Every sacrifice, every silent tear, was dedicated to ensuring their dignity and future.

"As long as I draw breath, my children will hold their heads high," she whispered as the morning sun crowned the horizon.', 1, 0, '3,100 words', '9 mins', '01 Mar 2025', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-21 22:13:55', '2026-10-21 22:13:55');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (10, 'uyire-unakkaga', NULL, '45', NULL, 'Chapter 45 — Blissful Conclusion', 'Chapter 45 — Blissful Conclusion', 'The grand university auditorium was filled with thunderous applause as her son stepped forward to receive his doctorate, bowing low to touch Meenakshi\'s feet.

Tears of profound joy rolled down her weathered cheeks. Her children had reached heights greater than she had ever dared to dream. The sacrifices of a lifetime had borne the sweetest fruit.', 1, 0, '4,000 words', '12 mins', '15 Dec 2025', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-21 22:13:55', '2026-10-21 22:13:55');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (12, 'poongaatru-punnagaikka', NULL, '1', NULL, 'Story 01 — Rainy Drizzle People', 'Story 01 — Rainy Drizzle People', 'Underneath the green tin awning of the roadside tea stall, seven strangers huddled together to escape a sudden torrential downpour.

As hot ginger tea was passed around in glass tumblers, stories began to flow. In those forty-five minutes of shared warmth, seven lives touched and enriched one another before the rain stopped and they went their separate ways.', 1, 0, '1,800 words', '5 mins', '14 Jul 2025', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-21 22:13:55', '2026-10-21 22:13:55');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (13, 'maaya-nadhi-theeram', NULL, '1', NULL, 'Part 01 — Riverbank Shadows (Audio)', 'Part 01 — Riverbank Shadows (Audio)', 'The Kaveri riverbank was shrouded in thick river fog as midnight approached. Inspector Raghavan shone his flashlight across the abandoned boathouse, discovering an antique brass lock newly broken.

This audio episode is produced with ambient music and narration by author Rudhra Prarthana. Log in as a member to listen to the full episode.', 0, 1, 'Audio 22 mins', '22 mins', '01 Sep 2026', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-21 22:13:55', '2026-10-21 22:13:55');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (20, 'nenjam-marappadhillai', NULL, '1', NULL, 'Chapter 01 — Beginning of Dawn', 'Chapter 01 — Beginning of Dawn', 'The morning mist drifted lazily across the veranda as Varshini held her porcelain cup, listening to the quiet rhythm of the dawn. Though countless memories echoed within, her expression remained calm and poised.

Little did she know that today would mark the beginning of a decisive chapter in her journey. The distant hum of the morning express train seemed to announce a destiny already unfolding.

"Varshini, are you ready?" Her mother\'s warm voice drew her back into the present. With a soft smile, she nodded. The next chapter of life was finally about to begin.', 1, 0, '2,450 words', '7 mins', '12 Oct 2025', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-22 22:14:05', '2026-10-22 22:14:05');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (21, 'nenjam-marappadhillai', NULL, '2', NULL, 'Chapter 02 — Waves of Memory', 'Chapter 02 — Waves of Memory', 'The bustling train station was bathed in amber morning light. As the train rolled in with a metallic roar, Varshini stepped onto the platform, luggage in hand.

Memories of her childhood summers rushed back—the endless green fields, the ancestral home, and the promises made under the grand banyan tree. But the face she remembered most vividly was the one she had tried so hard to forget.

"Could he still be here?" she whispered quietly to herself, tightening her grip on her shawl as a sudden gust of wind swept through the platform.', 1, 0, '2,600 words', '8 mins', '19 Oct 2025', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-22 22:14:05', '2026-10-22 22:14:05');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (22, 'nenjam-marappadhillai', NULL, '3', NULL, 'Chapter 03 — Unexpected Meeting', 'Chapter 03 — Unexpected Meeting', 'The village courtyard was alive with familiar laughter. Family members greeted her with warm embraces and traditional sweets. Yet across the courtyard, near the carved wooden doorway, stood a tall figure with sharp, thoughtful eyes.

Their eyes met across the crowded hall. Time seemed to pause for a breathless second. It was him—Devan. He had matured, but that intense gaze remained unchanged.

He offered a slow, courteous nod, acknowledging her return with an unspoken depth that made her pulse quicken.', 1, 0, '2,820 words', '8 mins', '26 Oct 2025', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-22 22:14:05', '2026-10-22 22:14:05');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (23, 'nenjam-marappadhillai', NULL, '24', NULL, 'Chapter 24 — Truth in the Heart', 'Chapter 24 — Truth in the Heart', 'The rain poured down steadily outside the study window, drumming against the glass like a long-kept secret finally demanding release.

Varshini placed the old journal onto the table. "You knew all along, didn\'t you, Devan?"

Devan turned, the dim desk lamp illuminating his resolute face. "Some truths are withheld not to deceive, Varshini, but to protect what matters most."

For the first time in ten years, the wall between them crumbled. In the silence that followed, both understood that life had given them a second chance.', 1, 0, '3,120 words', '10 mins', '08 Oct 2026', 'published', NULL, 'Asia/Kolkata', NULL, '1.0000', '2026-10-22 22:14:05', '2026-10-22 22:14:05');

DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `user_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comments_target` (`novel_id`,`chapter_num`),
  KEY `idx_comments_user` (`user_id`),
  KEY `idx_comments_parent` (`parent_id`),
  CONSTRAINT `fk_comments_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=68 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (8, 'kaadhal-konden-kanave', '18', 28, NULL, 'Siddharth and Ananya have stolen our hearts. Wonderful story progression!', '2026-10-13 19:00:00', '2026-10-22 23:01:23');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (25, 'nenjam-marappadhillai', '24', 28, NULL, 'What an incredible chapter! The emotional confrontation between Devan and Varshini was written with such mastery.', '2026-10-14 10:30:00', '2026-10-14 10:30:00');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (26, 'nenjam-marappadhillai', '24', 2, 25, 'Thank you so much Harish! More exciting moments are in store for the upcoming chapters.', '2026-10-14 10:40:00', '2026-10-14 10:40:00');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (27, 'nenjam-marappadhillai', '1', 28, NULL, 'Re-reading chapter 1 brings back all the nostalgic charm of how this wonderful story began.', '2026-10-15 12:00:00', '2026-10-15 12:00:00');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (28, 'nenjam-marappadhillai', '0', 28, NULL, 'Two souls living in different worlds drawn together by the threads of fate. One of the best family drama novels!', '2026-10-15 14:00:00', '2026-10-15 14:00:00');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (29, 'nenjam-marappadhillai', '0', 2, 28, 'Thank you Harish! Devan and Varshini’s journey has so much more emotion to unfold.', '2026-10-15 14:30:00', '2026-10-15 14:30:00');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (30, 'nenjam-marappadhillai', '24', 28, NULL, '<h2>Impressive Story Progression!</h2>
    <p>This chapter is <b>truly powerful</b> and <i>deeply moving</i>. The dialogue between the characters feels <span style="font-family: \'Cormorant Garamond\', serif; color: #b88635; font-size: 18px">exceptionally poetic</span>.</p>
    <ul>
      <li>Unforgettable confrontation</li>
      <li>Realistic family emotions</li>
    </ul>
    <p>Visit the official discussion: <a href="https://rudhraprarthananovels.in" target="_blank" rel="noopener noreferrer" class="rp-comment-link">Rudhra Prarthana Community</a></p>
    <p><img src="/uploads/comments/test-animation-1792687927536.gif" alt="Celebration GIF" class="rp-comment-img" loading="lazy" /></p>', '2026-10-22 22:22:07', '2026-10-22 22:22:07');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (31, 'nenjam-marappadhillai', '24', 2, 30, 'Thank you @harish for the wonderful appreciation and GIF! Warm wishes ❤️', '2026-10-22 22:22:07', '2026-10-22 22:22:07');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (42, 'kaadhal-konden-kanave', '0', 28, NULL, 'hi', '2026-10-23 17:11:39', '2026-10-23 17:11:39');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (43, 'kaadhal-konden-kanave', '0', 28, 42, 'bjn<div><br></div>', '2026-10-23 17:12:06', '2026-10-23 17:12:06');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (44, 'nenjam-marappadhillai', '1', 36, NULL, 'Marvelous narrative chapter! Verified timestamp: 1792757895362', '2026-10-23 17:48:15', '2026-10-23 17:48:15');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (45, 'nenjam-marappadhillai', '1', 28, 44, 'I completely agree with you on this plot twist! @kavitha_ramasamy', '2026-10-23 17:48:15', '2026-10-23 17:48:15');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (46, 'nenjam-marappadhillai', '1', 36, NULL, 'Marvelous narrative chapter! Verified timestamp: 1792757937490', '2026-10-23 17:48:57', '2026-10-23 17:48:57');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (47, 'nenjam-marappadhillai', '1', 28, 46, 'I completely agree with you on this plot twist! @kavitha_ramasamy', '2026-10-23 17:48:57', '2026-10-23 17:48:57');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (48, 'nenjam-marappadhillai', '1', 36, NULL, 'Marvelous narrative chapter! Verified timestamp: 1792758083207', '2026-10-23 17:51:23', '2026-10-23 17:51:23');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (49, 'nenjam-marappadhillai', '1', 28, 48, 'I completely agree with you on this plot twist! @kavitha_ramasamy', '2026-10-23 17:51:23', '2026-10-23 17:51:23');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (50, 'nenjam-marappadhillai', '1', 36, NULL, 'Marvelous narrative chapter! Verified timestamp: 1792758172422', '2026-10-23 17:52:52', '2026-10-23 17:52:52');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (51, 'nenjam-marappadhillai', '1', 28, 50, 'I completely agree with you on this plot twist! @kavitha_ramasamy', '2026-10-23 17:52:52', '2026-10-23 17:52:52');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (52, 'nenjam-marappadhillai', '1', 28, 50, 'Live real-time SSE verification reply at 1792758172606', '2026-10-23 17:52:52', '2026-10-23 17:52:52');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (53, 'nenjam-marappadhillai', '1', 36, NULL, 'Marvelous narrative chapter! Verified timestamp: 1792758216878', '2026-10-23 17:53:36', '2026-10-23 17:53:36');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (54, 'nenjam-marappadhillai', '1', 28, 53, 'I completely agree with you on this plot twist! @kavitha_ramasamy', '2026-10-23 17:53:36', '2026-10-23 17:53:36');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (55, 'nenjam-marappadhillai', '1', 28, 53, 'Live real-time SSE verification reply at 1792758217051', '2026-10-23 17:53:37', '2026-10-23 17:53:37');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (56, 'nenjam-marappadhillai', '1', 36, NULL, 'Marvelous narrative chapter! Verified timestamp: 1792758280471', '2026-10-23 17:54:40', '2026-10-23 17:54:40');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (57, 'nenjam-marappadhillai', '1', 28, 56, 'I completely agree with you on this plot twist! @kavitha_ramasamy', '2026-10-23 17:54:40', '2026-10-23 17:54:40');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (58, 'nenjam-marappadhillai', '2', 36, NULL, 'Comment for real-time SSE stream test 1792758280648', '2026-10-23 17:54:40', '2026-10-23 17:54:40');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (59, 'nenjam-marappadhillai', '2', 28, 58, 'Live real-time SSE verification reply at 1792758280662', '2026-10-23 17:54:40', '2026-10-23 17:54:40');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (60, 'nenjam-marappadhillai', '1', 36, NULL, 'Marvelous narrative chapter! Verified timestamp: 1792759058628', '2026-10-23 18:07:38', '2026-10-23 18:07:38');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (61, 'nenjam-marappadhillai', '1', 28, 60, 'I completely agree with you on this plot twist! @kavitha_ramasamy', '2026-10-23 18:07:38', '2026-10-23 18:07:38');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (62, 'nenjam-marappadhillai', '2', 36, NULL, 'Comment for real-time SSE stream test 1792759058842', '2026-10-23 18:07:38', '2026-10-23 18:07:38');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (63, 'nenjam-marappadhillai', '2', 28, 62, 'Live real-time SSE verification reply at 1792759058856', '2026-10-23 18:07:38', '2026-10-23 18:07:38');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (64, 'nenjam-marappadhillai', '1', 36, NULL, 'Marvelous narrative chapter! Verified timestamp: 1792760513080', '2026-10-23 18:31:53', '2026-10-23 18:31:53');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (65, 'nenjam-marappadhillai', '1', 28, 64, 'I completely agree with you on this plot twist! @kavitha_ramasamy', '2026-10-23 18:31:53', '2026-10-23 18:31:53');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (66, 'nenjam-marappadhillai', '2', 36, NULL, 'Comment for real-time SSE stream test 1792760513525', '2026-10-23 18:31:53', '2026-10-23 18:31:53');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (67, 'nenjam-marappadhillai', '2', 28, 66, 'Live real-time SSE verification reply at 1792760513545', '2026-10-23 18:31:53', '2026-10-23 18:31:53');

DROP TABLE IF EXISTS `forum_categories`;
CREATE TABLE `forum_categories` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 0xF09F92AC,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `forum_categories` (`id`, `title`, `description`, `icon`, `sort_order`, `created_at`) VALUES ('general', 'General Discussions', 'General announcements, welcome area, and platform updates.', '💬', 5, '2026-10-18 10:55:10');
INSERT INTO `forum_categories` (`id`, `title`, `description`, `icon`, `sort_order`, `created_at`) VALUES ('ongoing-novels', 'Ongoing Novels Discussion', 'Episode updates, reader theories, character analysis, and lively discussions on current serials.', '📖', 1, '2026-10-18 10:55:10');
INSERT INTO `forum_categories` (`id`, `title`, `description`, `icon`, `sort_order`, `created_at`) VALUES ('review-junction', 'Review Junction', 'Detailed reader reviews, ratings, and critical literary perspectives on Rudhra Prarthana novels.', '✍️', 2, '2026-10-18 10:55:10');
INSERT INTO `forum_categories` (`id`, `title`, `description`, `icon`, `sort_order`, `created_at`) VALUES ('short-stories', 'Short Stories Hub', 'Discussions and feedback on standalone short stories, festive specials, and flash fiction.', '✨', 4, '2026-10-18 10:55:10');
INSERT INTO `forum_categories` (`id`, `title`, `description`, `icon`, `sort_order`, `created_at`) VALUES ('tea-time', 'Tea Time Chit-Chat', 'Casual conversations, daily greetings, life musings, and reader camaraderie.', '☕', 3, '2026-10-18 10:55:10');

DROP TABLE IF EXISTS `forum_posts`;
CREATE TABLE `forum_posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `topic_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `parent_id` int DEFAULT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_posts_topic` (`topic_id`),
  KEY `idx_posts_user` (`user_id`),
  KEY `idx_posts_parent` (`parent_id`),
  CONSTRAINT `fk_posts_parent` FOREIGN KEY (`parent_id`) REFERENCES `forum_posts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_posts_topic` FOREIGN KEY (`topic_id`) REFERENCES `forum_topics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (3, 'topic-nenjam-24', 2, NULL, 'Welcome, dear readers! Chapter 24 of \'Nenjam Marappadhillai\' is now live! Please share your thoughts and predictions right here! ❤️', '2026-10-14 09:30:00', '2026-10-21 22:13:55');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (4, 'topic-nenjam-24', 28, NULL, 'Chapter 24 moved at such an exciting pace! The revelation was breathtaking. Eagerly waiting for the next update!', '2026-10-14 10:15:00', '2026-10-22 23:03:12');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (5, 'topic-kaadhal-kanave-18', 2, NULL, 'How did you feel about the revelation in chapter 18? Drop your feedback below!', '2026-10-13 14:20:00', '2026-10-21 22:13:55');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (6, 'topic-review-style', 28, NULL, 'The nuanced family dynamics in RP\'s novels make every character feel profoundly real. What stands out to you most?', '2026-10-12 11:00:00', '2026-10-22 23:03:12');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (7, 'topic-review-style', 2, NULL, 'Thank you so much Harish! Realistic emotional depth is the true compass of my writing.', '2026-10-14 08:20:00', '2026-10-21 22:13:55');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (8, 'topic-rain-coffee', 28, NULL, 'Perfect weather to curl up and read novels with a warm cup of coffee!', '2026-10-11 16:30:00', '2026-10-22 23:03:12');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (9, 'topic-short-story', 2, NULL, 'Thank you for all the lovely comments on our rainy-day special short story!', '2026-10-10 10:00:00', '2026-10-21 22:13:55');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (10, 'topic-tamil-kanave', 2, NULL, 'காதல் கொண்டேன் கனவே தொடரின் இந்த வார திருப்பங்கள் உங்களுக்கு பிடித்திருந்ததா? உங்கள் மேலான கருத்துக்களை இங்கே பகிருங்கள்! ❤️', '2026-10-14 10:45:00', '2026-10-21 22:13:55');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (11, 'topic-tamil-kanave', 28, NULL, 'கதைக்களம் மிகவும் அருமையாக செல்கிறது! அடுத்த பதிவிற்காக ஆவலுடன் காத்திருக்கிறோம்.', '2026-10-14 10:55:00', '2026-10-22 23:03:12');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (17, 'topic-discussion-topic-by-author-1792757937577-7579', 2, NULL, 'Welcome to this official forum discussion!', '2026-10-23 17:48:57', '2026-10-23 17:48:57');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (18, 'topic-discussion-topic-by-author-1792757937577-7579', 36, NULL, 'Great discussion topic! Calling @harish to join this thread.', '2026-10-23 17:48:57', '2026-10-23 17:48:57');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (19, 'topic-discussion-topic-by-author-1792758083285-3286', 2, NULL, 'Welcome to this official forum discussion!', '2026-10-23 17:51:23', '2026-10-23 17:51:23');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (20, 'topic-discussion-topic-by-author-1792758083285-3286', 36, NULL, 'Great discussion topic! Calling @harish to join this thread.', '2026-10-23 17:51:23', '2026-10-23 17:51:23');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (21, 'topic-discussion-topic-by-author-1792758172501-2502', 2, NULL, 'Welcome to this official forum discussion!', '2026-10-23 17:52:52', '2026-10-23 17:52:52');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (22, 'topic-discussion-topic-by-author-1792758172501-2502', 36, NULL, 'Great discussion topic! Calling @harish to join this thread.', '2026-10-23 17:52:52', '2026-10-23 17:52:52');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (23, 'topic-discussion-topic-by-author-1792758216951-6953', 2, NULL, 'Welcome to this official forum discussion!', '2026-10-23 17:53:36', '2026-10-23 17:53:36');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (24, 'topic-discussion-topic-by-author-1792758216951-6953', 36, NULL, 'Great discussion topic! Calling @harish to join this thread.', '2026-10-23 17:53:36', '2026-10-23 17:53:36');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (25, 'topic-discussion-topic-by-author-1792758280551-0553', 2, NULL, 'Welcome to this official forum discussion!', '2026-10-23 17:54:40', '2026-10-23 17:54:40');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (26, 'topic-discussion-topic-by-author-1792758280551-0553', 36, NULL, 'Great discussion topic! Calling @harish to join this thread.', '2026-10-23 17:54:40', '2026-10-23 17:54:40');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (27, 'topic-discussion-topic-by-author-1792759058735-8737', 2, NULL, 'Welcome to this official forum discussion!', '2026-10-23 18:07:38', '2026-10-23 18:07:38');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (28, 'topic-discussion-topic-by-author-1792759058735-8737', 36, NULL, 'Great discussion topic! Calling @harish to join this thread.', '2026-10-23 18:07:38', '2026-10-23 18:07:38');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (29, 'topic-discussion-topic-by-author-1792760513407-3409', 2, NULL, 'Welcome to this official forum discussion!', '2026-10-23 18:31:53', '2026-10-23 18:31:53');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `parent_id`, `content`, `created_at`, `updated_at`) VALUES (30, 'topic-discussion-topic-by-author-1792760513407-3409', 36, NULL, 'Great discussion topic! Calling @harish to join this thread.', '2026-10-23 18:31:53', '2026-10-23 18:31:53');

DROP TABLE IF EXISTS `forum_topics`;
CREATE TABLE `forum_topics` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author_id` int NOT NULL,
  `views_count` int DEFAULT '0',
  `replies_count` int DEFAULT '0',
  `is_published` tinyint(1) DEFAULT '1',
  `visibility` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'public',
  `last_reply_author_id` int DEFAULT NULL,
  `last_reply_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_topics_last_author` (`last_reply_author_id`),
  KEY `idx_topics_category` (`category_id`),
  KEY `idx_topics_author` (`author_id`),
  KEY `idx_topics_updated` (`updated_at`),
  CONSTRAINT `fk_topics_author` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_topics_last_author` FOREIGN KEY (`last_reply_author_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-discussion-topic-by-author-1792757937577-7579', 'general', 'General Discussions', 'Discussion Topic by Author 1792757937577', 2, 1, 1, 1, 'public', 36, '2026-10-23 17:48:57', '2026-10-23 17:48:57', '2026-10-23 17:48:57');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-discussion-topic-by-author-1792758083285-3286', 'general', 'General Discussions', 'Discussion Topic by Author 1792758083285', 2, 1, 1, 1, 'public', 36, '2026-10-23 17:51:23', '2026-10-23 17:51:23', '2026-10-23 17:51:23');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-discussion-topic-by-author-1792758172501-2502', 'general', 'General Discussions', 'Discussion Topic by Author 1792758172501', 2, 1, 1, 1, 'public', 36, '2026-10-23 17:52:52', '2026-10-23 17:52:52', '2026-10-23 17:52:52');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-discussion-topic-by-author-1792758216951-6953', 'general', 'General Discussions', 'Discussion Topic by Author 1792758216951', 2, 1, 1, 1, 'public', 36, '2026-10-23 17:53:36', '2026-10-23 17:53:36', '2026-10-23 17:53:36');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-discussion-topic-by-author-1792758280551-0553', 'general', 'General Discussions', 'Discussion Topic by Author 1792758280551', 2, 1, 1, 1, 'public', 36, '2026-10-23 17:54:40', '2026-10-23 17:54:40', '2026-10-23 17:54:40');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-discussion-topic-by-author-1792759058735-8737', 'general', 'General Discussions', 'Discussion Topic by Author 1792759058735', 2, 1, 1, 1, 'public', 36, '2026-10-23 18:07:38', '2026-10-23 18:07:38', '2026-10-23 18:07:38');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-discussion-topic-by-author-1792760513407-3409', 'general', 'General Discussions', 'Discussion Topic by Author 1792760513407', 2, 1, 1, 1, 'public', 36, '2026-10-23 18:31:53', '2026-10-23 18:31:53', '2026-10-23 18:31:53');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-kaadhal-kanave-18', 'ongoing-novels', 'ONGOING NOVELS', 'Kaadhal Konden Kanave — Chapter 18 Emotional Highlights', 2, 110, 1, 1, 'public', 2, '2026-10-13 18:45:00', '2026-10-13 14:20:00', '2026-10-13 18:45:00');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-nenjam-24', 'ongoing-novels', 'ONGOING NOVELS', 'Nenjam Marappadhillai — Your thoughts on Chapter 24?', 2, 145, 2, 1, 'public', 8, '2026-10-14 10:15:00', '2026-10-14 09:30:00', '2026-10-14 10:15:00');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-rain-coffee', 'tea-time', 'TEA TIME', 'Today\'s rainfall and a hot cup of coffee ☕', 28, 195, 3, 1, 'public', 8, '2026-10-13 21:10:00', '2026-10-11 16:30:00', '2026-10-22 23:03:12');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-review-style', 'review-junction', 'REVIEW JUNCTION', 'A critical perspective on Rudhra Prarthana\'s storytelling style', 28, 230, 4, 1, 'public', 2, '2026-10-14 08:20:00', '2026-10-12 11:00:00', '2026-10-22 23:03:12');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-short-story', 'short-stories', 'SHORT STORIES', 'Loved reading People of the Rain — Heartwarming story', 2, 155, 2, 1, 'public', 8, '2026-10-12 15:30:00', '2026-10-10 10:00:00', '2026-10-12 15:30:00');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-tamil-kanave', 'ongoing-novels', 'ONGOING NOVELS', 'காதல் கொண்டேன் கனவே — வாசகர்களின் மனம் கவர்ந்த உணர்ச்சிப்பூர்வமான தருணங்கள்', 2, 182, 3, 1, 'public', 8, '2026-10-14 10:55:00', '2026-10-14 10:45:00', '2026-10-23 17:02:25');

DROP TABLE IF EXISTS `guest_visitors`;
CREATE TABLE `guest_visitors` (
  `visitor_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_visit_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_visit_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_agent_hash` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`visitor_id`),
  KEY `idx_last_visit` (`last_visit_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_09ruqonv_mvkwqsdx', '2026-10-23 17:19:43', '2026-10-23 17:32:56', '49a2e79638c6bc012d7f78b2a8bd3632');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_0k8ldyhn_mvkw241v', '2026-10-23 17:01:17', '2026-10-23 17:01:17', '49a2e79638c6bc012d7f78b2a8bd3632');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_8yjgqjas_mvjr920p', '2026-10-22 21:58:12', '2026-10-22 21:58:12', '28259e149ec2fbcca40613b392fc1e2a');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_bb37008838bafac9dca1f930c19c6cb3', '2026-10-22 21:24:21', '2026-10-22 21:24:21', '545ea538461003efdc8c81c244531b00');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_d536d31e61287314e746e70d3f79e8b3', '2026-10-22 21:23:52', '2026-10-22 21:23:52', '545ea538461003efdc8c81c244531b00');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_eb626a15504609035c186a857876aa84', '2026-10-22 21:25:51', '2026-10-22 21:25:51', '545ea538461003efdc8c81c244531b00');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_f22da95758c64dc894d5c9a0db99d463', '2026-10-22 21:24:21', '2026-10-22 21:24:21', '545ea538461003efdc8c81c244531b00');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_j0su76e4_mvjq60rj', '2026-10-22 21:27:50', '2026-10-22 21:29:20', '49a2e79638c6bc012d7f78b2a8bd3632');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_le8ekscy_mvky87n7', '2026-10-23 18:01:16', '2026-10-23 18:37:58', 'a65401ce10144fa0776ac85f0a136f9b');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_mfi7oz2t_mvjpo2n4', '2026-10-22 21:19:01', '2026-10-22 22:18:15', 'a65401ce10144fa0776ac85f0a136f9b');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_v1b8014t_mvjq4p3u', '2026-10-22 21:26:49', '2026-10-22 21:26:51', '28259e149ec2fbcca40613b392fc1e2a');
INSERT INTO `guest_visitors` (`visitor_id`, `first_visit_at`, `last_visit_at`, `user_agent_hash`) VALUES ('gst_xei1szdx_mvjma2cn', '2026-10-22 21:27:50', '2026-10-22 21:27:50', '49a2e79638c6bc012d7f78b2a8bd3632');

DROP TABLE IF EXISTS `homepage_section_items`;
CREATE TABLE `homepage_section_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `section_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sec_key` (`section_key`),
  KEY `idx_novel_id` (`novel_id`),
  CONSTRAINT `fk_hsi_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `homepage_sections`;
CREATE TABLE `homepage_sections` (
  `section_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtitle` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_visible` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `section_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'custom',
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `content_limit` int NOT NULL DEFAULT '6',
  `view_all_link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `display_style` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'grid',
  `settings` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_by` int DEFAULT NULL,
  PRIMARY KEY (`section_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`, `name`, `section_type`, `is_system`, `content_limit`, `view_all_link`, `display_style`, `settings`, `created_at`, `updated_by`) VALUES ('audio', 'Audio Novels', 'Listen & Enjoy', 1, 3, '2026-10-22 17:00:10', 'Audio Novels', 'audio', 1, 4, '#audio', 'grid', NULL, '2026-10-22 14:22:17', 2);
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`, `name`, `section_type`, `is_system`, `content_limit`, `view_all_link`, `display_style`, `settings`, `created_at`, `updated_by`) VALUES ('author_spotlight', 'Author Spotlight', 'Rudhra Prarthana', 1, 7, '2026-10-22 17:00:10', 'Featured Author Spotlight', 'author_spotlight', 1, 1, '#member?id=rudhra', 'spotlight', NULL, '2026-10-22 14:22:17', 2);
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`, `name`, `section_type`, `is_system`, `content_limit`, `view_all_link`, `display_style`, `settings`, `created_at`, `updated_by`) VALUES ('community_cta', 'Join Our Reader Community', 'Connect & Share', 1, 8, '2026-10-22 17:00:10', 'Community Call to Action', 'community_cta', 1, 1, '#forum', 'banner', NULL, '2026-10-22 14:22:17', 2);
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`, `name`, `section_type`, `is_system`, `content_limit`, `view_all_link`, `display_style`, `settings`, `created_at`, `updated_by`) VALUES ('completed', 'Completed Novels', 'Completed Works', 1, 5, '2026-10-22 17:00:10', 'Completed Works', 'completed', 1, 4, '#novels?status=completed', 'grid', NULL, '2026-10-22 14:22:17', 2);
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`, `name`, `section_type`, `is_system`, `content_limit`, `view_all_link`, `display_style`, `settings`, `created_at`, `updated_by`) VALUES ('continue_reading', 'Continue Reading', 'Pick Up Where You Left Off', 1, 2, '2026-10-22 17:00:10', 'Continue Reading', 'continue_reading', 1, 4, '#novels?status=ongoing', 'grid', NULL, '2026-10-22 14:22:17', 2);
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`, `name`, `section_type`, `is_system`, `content_limit`, `view_all_link`, `display_style`, `settings`, `created_at`, `updated_by`) VALUES ('featured', 'Featured Ongoing Novels', 'Currently Releasing', 1, 4, '2026-10-22 19:50:26', 'Featured Ongoing Novels', 'featured', 1, 4, '#novels?status=ongoing', 'grid', NULL, '2026-10-22 14:22:17', 2);
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`, `name`, `section_type`, `is_system`, `content_limit`, `view_all_link`, `display_style`, `settings`, `created_at`, `updated_by`) VALUES ('forum', 'Latest Discussions & Community', 'Reader Forum', 1, 6, '2026-10-22 17:00:10', 'Reader Discussions & Community', 'forum', 1, 5, '#forum', 'list', NULL, '2026-10-22 14:22:17', 2);
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`, `name`, `section_type`, `is_system`, `content_limit`, `view_all_link`, `display_style`, `settings`, `created_at`, `updated_by`) VALUES ('staff_picks', 'Staff Picks', 'Handpicked by our editors', 1, 9, '2026-10-22 17:00:10', 'Staff Picks', 'curated', 0, 3, NULL, 'grid', NULL, '2026-10-22 15:20:37', 2);
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`, `name`, `section_type`, `is_system`, `content_limit`, `view_all_link`, `display_style`, `settings`, `created_at`, `updated_by`) VALUES ('trending', 'Trending Novels', 'Reader Favorites', 1, 1, '2026-10-22 19:50:26', 'Trending Novels', 'trending', 1, 5, '#novels', 'list', NULL, '2026-10-22 14:22:17', 2);

DROP TABLE IF EXISTS `likes`;
CREATE TABLE `likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_likes` (`target_type`,`target_id`,`user_id`),
  KEY `fk_likes_user` (`user_id`),
  KEY `idx_likes_target` (`target_type`,`target_id`),
  CONSTRAINT `fk_likes_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `likes` (`id`, `target_type`, `target_id`, `user_id`, `created_at`) VALUES (1, 'novel', 'nenjam-marappadhillai', 28, '2026-10-14 10:32:00');
INSERT INTO `likes` (`id`, `target_type`, `target_id`, `user_id`, `created_at`) VALUES (2, 'novel', 'kaadhal-konden-kanave', 28, '2026-10-13 19:05:00');
INSERT INTO `likes` (`id`, `target_type`, `target_id`, `user_id`, `created_at`) VALUES (3, 'chapter', 'nenjam-marappadhillai:24', 28, '2026-10-14 10:31:00');
INSERT INTO `likes` (`id`, `target_type`, `target_id`, `user_id`, `created_at`) VALUES (6, 'comment', '30', 2, '2026-10-22 22:22:07');
INSERT INTO `likes` (`id`, `target_type`, `target_id`, `user_id`, `created_at`) VALUES (8, 'comment', '42', 28, '2026-10-23 17:11:46');

DROP TABLE IF EXISTS `media`;
CREATE TABLE `media` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `original_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size_bytes` int NOT NULL,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_media_created` (`created_at` DESC)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `media` (`id`, `filename`, `original_name`, `url`, `mime_type`, `size_bytes`, `uploaded_by`, `created_at`) VALUES (16, 'media-1792593059059-1tf52e.png', 'Golden_Filigree_and_Feather_Banner.png', '/uploads/media/media-1792593059059-1tf52e.png', 'image/png', 2003283, 2, '2026-10-21 20:00:59');

DROP TABLE IF EXISTS `notification_preferences`;
CREATE TABLE `notification_preferences` (
  `user_id` int NOT NULL,
  `notify_comments` tinyint(1) DEFAULT '1',
  `notify_replies` tinyint(1) DEFAULT '1',
  `notify_reactions` tinyint(1) DEFAULT '1',
  `notify_forum` tinyint(1) DEFAULT '1',
  `notify_chapters` tinyint(1) DEFAULT '1',
  `notify_system` tinyint(1) DEFAULT '1',
  `browser_enabled` tinyint(1) DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_notif_pref_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `notification_preferences` (`user_id`, `notify_comments`, `notify_replies`, `notify_reactions`, `notify_forum`, `notify_chapters`, `notify_system`, `browser_enabled`, `updated_at`) VALUES (2, 1, 1, 1, 1, 1, 1, 1, '2026-10-23 18:01:10');
INSERT INTO `notification_preferences` (`user_id`, `notify_comments`, `notify_replies`, `notify_reactions`, `notify_forum`, `notify_chapters`, `notify_system`, `browser_enabled`, `updated_at`) VALUES (28, 1, 1, 1, 1, 1, 1, 0, '2026-10-23 17:15:52');
INSERT INTO `notification_preferences` (`user_id`, `notify_comments`, `notify_replies`, `notify_reactions`, `notify_forum`, `notify_chapters`, `notify_system`, `browser_enabled`, `updated_at`) VALUES (36, 1, 1, 1, 1, 1, 1, 0, '2026-10-23 18:31:53');
INSERT INTO `notification_preferences` (`user_id`, `notify_comments`, `notify_replies`, `notify_reactions`, `notify_forum`, `notify_chapters`, `notify_system`, `browser_enabled`, `updated_at`) VALUES (37, 1, 1, 1, 1, 1, 1, 0, '2026-10-23 17:15:52');

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `actor_id` int DEFAULT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'announcement',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read` (`user_id`,`is_read`),
  KEY `idx_notif_user_created` (`user_id`,`created_at`),
  KEY `idx_notif_actor` (`actor_id`),
  CONSTRAINT `fk_notifications_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (1, 28, NULL, 'chapter_release', 'New Chapter Released!', 'Rudhra Prarthana has published Chapter 24 of Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=24', NULL, NULL, 1, '2026-10-14 09:30:00');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (2, 28, NULL, 'announcement', 'Welcome to Rudhra Prarthana Novels', 'Experience distraction-free reading, audio novels, and our interactive community.', '#home', NULL, NULL, 1, '2026-10-01 10:00:00');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (3, 2, NULL, 'announcement', 'Welcome Rudhra Prarthana', 'Welcome to your official author portal. Your works are loved by hundreds of thousands of readers.', '#home', NULL, NULL, 1, '2026-10-01 10:00:00');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (4, 2, 36, 'novel_comment', 'New Comment on Nenjam Marappadhillai', 'Kavitha Ramasamy commented on Nenjam Marappadhillai (Chapter 1): "Marvelous narrative chapter! Verified timestamp: 1792757895362"', '#reader?novel=nenjam-marappadhillai&ch=1', 'novel', 'nenjam-marappadhillai', 1, '2026-10-23 17:48:15');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (5, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 1): "I completely agree with you on this plot twist! @kavitha_ramasamy"', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '44', 1, '2026-10-23 17:48:15');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (6, 36, 28, 'comment_reaction', 'Reaction on your Comment', 'Harish reacted ❤️ to your comment on Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '44', 1, '2026-10-23 17:48:15');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (7, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 1): "I completely agree with you on this plot twist! @kavitha_ramasamy"', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '46', 1, '2026-10-23 17:48:57');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (8, 36, 28, 'comment_reaction', 'Reaction on your Comment', 'Harish reacted ❤️ to your comment on Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '46', 1, '2026-10-23 17:48:57');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (9, 2, 36, 'forum_reply', 'New Reply in "Discussion Topic by Author 1792757937577"', 'Kavitha Ramasamy replied to your forum topic: "Great discussion topic! Calling @harish to join this thread."', '#forum?topic=topic-discussion-topic-by-author-1792757937577-7579', 'forum_topic', 'topic-discussion-topic-by-author-1792757937577-7579', 1, '2026-10-23 17:48:57');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (10, 28, 36, 'forum_mention', 'Mentioned in "Discussion Topic by Author 1792757937577"', 'Kavitha Ramasamy mentioned you in forum topic "Discussion Topic by Author 1792757937577".', '#forum?topic=topic-discussion-topic-by-author-1792757937577-7579', 'forum_topic', 'topic-discussion-topic-by-author-1792757937577-7579', 0, '2026-10-23 17:48:57');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (11, 36, 2, 'announcement', 'Real-Time SSE Test', 'Real-time SSE push test verified!', '#home', NULL, NULL, 1, '2026-10-23 17:48:57');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (12, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 1): "I completely agree with you on this plot twist! @kavitha_ramasamy"', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '48', 1, '2026-10-23 17:51:23');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (13, 36, 28, 'comment_reaction', 'Reaction on your Comment', 'Harish reacted ❤️ to your comment on Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '48', 1, '2026-10-23 17:51:23');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (14, 2, 36, 'forum_reply', 'New Reply in "Discussion Topic by Author 1792758083285"', 'Kavitha Ramasamy replied to your forum topic: "Great discussion topic! Calling @harish to join this thread."', '#forum?topic=topic-discussion-topic-by-author-1792758083285-3286', 'forum_topic', 'topic-discussion-topic-by-author-1792758083285-3286', 1, '2026-10-23 17:51:23');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (15, 28, 36, 'forum_mention', 'Mentioned in "Discussion Topic by Author 1792758083285"', 'Kavitha Ramasamy mentioned you in forum topic "Discussion Topic by Author 1792758083285".', '#forum?topic=topic-discussion-topic-by-author-1792758083285-3286', 'forum_topic', 'topic-discussion-topic-by-author-1792758083285-3286', 0, '2026-10-23 17:51:23');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (16, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 1): "I completely agree with you on this plot twist! @kavitha_ramasamy"', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '50', 1, '2026-10-23 17:52:52');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (17, 36, 28, 'comment_reaction', 'Reaction on your Comment', 'Harish reacted ❤️ to your comment on Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '50', 1, '2026-10-23 17:52:52');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (18, 2, 36, 'forum_reply', 'New Reply in "Discussion Topic by Author 1792758172501"', 'Kavitha Ramasamy replied to your forum topic: "Great discussion topic! Calling @harish to join this thread."', '#forum?topic=topic-discussion-topic-by-author-1792758172501-2502', 'forum_topic', 'topic-discussion-topic-by-author-1792758172501-2502', 1, '2026-10-23 17:52:52');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (19, 28, 36, 'forum_mention', 'Mentioned in "Discussion Topic by Author 1792758172501"', 'Kavitha Ramasamy mentioned you in forum topic "Discussion Topic by Author 1792758172501".', '#forum?topic=topic-discussion-topic-by-author-1792758172501-2502', 'forum_topic', 'topic-discussion-topic-by-author-1792758172501-2502', 0, '2026-10-23 17:52:52');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (20, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 1): "I completely agree with you on this plot twist! @kavitha_ramasamy"', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '53', 1, '2026-10-23 17:53:36');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (21, 36, 28, 'comment_reaction', 'Reaction on your Comment', 'Harish reacted ❤️ to your comment on Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '53', 1, '2026-10-23 17:53:36');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (22, 2, 36, 'forum_reply', 'New Reply in "Discussion Topic by Author 1792758216951"', 'Kavitha Ramasamy replied to your forum topic: "Great discussion topic! Calling @harish to join this thread."', '#forum?topic=topic-discussion-topic-by-author-1792758216951-6953', 'forum_topic', 'topic-discussion-topic-by-author-1792758216951-6953', 1, '2026-10-23 17:53:36');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (23, 28, 36, 'forum_mention', 'Mentioned in "Discussion Topic by Author 1792758216951"', 'Kavitha Ramasamy mentioned you in forum topic "Discussion Topic by Author 1792758216951".', '#forum?topic=topic-discussion-topic-by-author-1792758216951-6953', 'forum_topic', 'topic-discussion-topic-by-author-1792758216951-6953', 0, '2026-10-23 17:53:36');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (24, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 1): "I completely agree with you on this plot twist! @kavitha_ramasamy"', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '56', 1, '2026-10-23 17:54:40');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (25, 36, 28, 'comment_reaction', 'Reaction on your Comment', 'Harish reacted ❤️ to your comment on Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '56', 1, '2026-10-23 17:54:40');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (26, 2, 36, 'forum_reply', 'New Reply in "Discussion Topic by Author 1792758280551"', 'Kavitha Ramasamy replied to your forum topic: "Great discussion topic! Calling @harish to join this thread."', '#forum?topic=topic-discussion-topic-by-author-1792758280551-0553', 'forum_topic', 'topic-discussion-topic-by-author-1792758280551-0553', 1, '2026-10-23 17:54:40');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (27, 28, 36, 'forum_mention', 'Mentioned in "Discussion Topic by Author 1792758280551"', 'Kavitha Ramasamy mentioned you in forum topic "Discussion Topic by Author 1792758280551".', '#forum?topic=topic-discussion-topic-by-author-1792758280551-0553', 'forum_topic', 'topic-discussion-topic-by-author-1792758280551-0553', 0, '2026-10-23 17:54:40');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (28, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 2): "Live real-time SSE verification reply at 1792758280662"', '#reader?novel=nenjam-marappadhillai&ch=2', 'comment', '58', 1, '2026-10-23 17:54:40');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (29, 2, 36, 'novel_comment', 'New Comment on Nenjam Marappadhillai', 'Kavitha Ramasamy commented on Nenjam Marappadhillai (Chapter 1): "Marvelous narrative chapter! Verified timestamp: 1792759058628"', '#reader?novel=nenjam-marappadhillai&ch=1', 'novel', 'nenjam-marappadhillai', 1, '2026-10-23 18:07:38');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (30, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 1): "I completely agree with you on this plot twist! @kavitha_ramasamy"', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '60', 1, '2026-10-23 18:07:38');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (31, 36, 28, 'comment_reaction', 'Reaction on your Comment', 'Harish reacted ❤️ to your comment on Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '60', 1, '2026-10-23 18:07:38');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (32, 2, 36, 'forum_reply', 'New Reply in "Discussion Topic by Author 1792759058735"', 'Kavitha Ramasamy replied to your forum topic: "Great discussion topic! Calling @harish to join this thread."', '#forum?topic=topic-discussion-topic-by-author-1792759058735-8737', 'forum_topic', 'topic-discussion-topic-by-author-1792759058735-8737', 1, '2026-10-23 18:07:38');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (33, 28, 36, 'forum_mention', 'Mentioned in "Discussion Topic by Author 1792759058735"', 'Kavitha Ramasamy mentioned you in forum topic "Discussion Topic by Author 1792759058735".', '#forum?topic=topic-discussion-topic-by-author-1792759058735-8737', 'forum_topic', 'topic-discussion-topic-by-author-1792759058735-8737', 0, '2026-10-23 18:07:38');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (34, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 2): "Live real-time SSE verification reply at 1792759058856"', '#reader?novel=nenjam-marappadhillai&ch=2', 'comment', '62', 1, '2026-10-23 18:07:38');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (35, 2, 36, 'novel_comment', 'New Comment on Nenjam Marappadhillai', 'Kavitha Ramasamy commented on Nenjam Marappadhillai (Chapter 1): "Marvelous narrative chapter! Verified timestamp: 1792760513080"', '#reader?novel=nenjam-marappadhillai&ch=1', 'novel', 'nenjam-marappadhillai', 0, '2026-10-23 18:31:53');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (36, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 1): "I completely agree with you on this plot twist! @kavitha_ramasamy"', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '64', 1, '2026-10-23 18:31:53');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (37, 36, 28, 'comment_reaction', 'Reaction on your Comment', 'Harish reacted ❤️ to your comment on Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=1', 'comment', '64', 1, '2026-10-23 18:31:53');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (38, 2, 36, 'forum_reply', 'New Reply in "Discussion Topic by Author 1792760513407"', 'Kavitha Ramasamy replied to your forum topic: "Great discussion topic! Calling @harish to join this thread."', '#forum?topic=topic-discussion-topic-by-author-1792760513407-3409', 'forum_topic', 'topic-discussion-topic-by-author-1792760513407-3409', 0, '2026-10-23 18:31:53');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (39, 28, 36, 'forum_mention', 'Mentioned in "Discussion Topic by Author 1792760513407"', 'Kavitha Ramasamy mentioned you in forum topic "Discussion Topic by Author 1792760513407".', '#forum?topic=topic-discussion-topic-by-author-1792760513407-3409', 'forum_topic', 'topic-discussion-topic-by-author-1792760513407-3409', 0, '2026-10-23 18:31:53');
INSERT INTO `notifications` (`id`, `user_id`, `actor_id`, `type`, `title`, `message`, `link`, `entity_type`, `entity_id`, `is_read`, `created_at`) VALUES (40, 36, 28, 'comment_reply', 'New Reply to your Comment', 'Harish replied on Nenjam Marappadhillai (Chapter 2): "Live real-time SSE verification reply at 1792760513545"', '#reader?novel=nenjam-marappadhillai&ch=2', 'comment', '66', 0, '2026-10-23 18:31:53');

DROP TABLE IF EXISTS `novels`;
CREATE TABLE `novels` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Rudhra Prarthana',
  `genre` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Ongoing',
  `badge` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Ongoing',
  `cover` mediumtext COLLATE utf8mb4_unicode_ci,
  `description` text COLLATE utf8mb4_unicode_ci,
  `chapters_count` int DEFAULT '0',
  `views` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `rating` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT '5.0',
  `updated_date` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `featured` tinyint(1) DEFAULT '0',
  `continue_reading` tinyint(1) DEFAULT '0',
  `is_audio` tinyint(1) DEFAULT '0',
  `audio_available` tinyint(1) DEFAULT '0',
  `audio_duration` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `audio_voice` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `youtube_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `trending_rank` int DEFAULT '0',
  `sort_order` int DEFAULT '0',
  `is_published` tinyint(1) DEFAULT '1',
  `visibility` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'public',
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `author_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_novels_status` (`status`),
  KEY `idx_novels_featured` (`featured`),
  KEY `idx_novels_published` (`is_published`,`visibility`),
  KEY `idx_novels_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`, `author_id`) VALUES ('kaadhal-konden-kanave', 'Kaadhal Konden Kanave', 'Rudhra Prarthana', 'Romance', 'Ongoing Novels', 'Ongoing', 'Ongoing', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80', 'A romance that begins through shared dreams faces real-life trials and triumphs. A youth-filled emotional story of affection.', 2, '112,400', '4.8', 'Oct 22, 2026', 1, 1, 0, 0, NULL, NULL, NULL, 2, 2, 1, 'public', '#novel?id=kaadhal-konden-kanave', '2026-10-21 22:13:55', '2026-10-22 11:49:01', 2);
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`, `author_id`) VALUES ('maaya-nadhi-theeram', 'Maaya Nadhi Theeram', 'Rudhra Prarthana', 'Mystery / Thriller', 'Audio Novels', 'Ongoing', 'Audio Novel', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80', 'A gripping thriller set along a mysterious riverbank where uncovered secrets and suspense keep listeners captivated.', 12, '89,400', '4.8', 'Part 06 Released', 1, 0, 1, 1, '4h 25m', 'Rudhra Prarthana', 'https://www.youtube.com/@rudhraprarthanaaudionovels', 5, 5, 1, 'public', '#novel?id=maaya-nadhi-theeram', '2026-10-21 22:13:55', '2026-10-22 11:49:01', 2);
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`, `author_id`) VALUES ('malarin-ragasiyam-secret-of-the-flower', 'Malarin Ragasiyam (Secret of the Flower)', 'Kavitha Ramasamy', 'Romance / Drama', 'Ongoing Novels', 'Ongoing', 'Ongoing', '/default-cover.jpg', '', 0, '0', '5.0', 'Just added', 0, 0, 0, 0, NULL, NULL, NULL, 0, 0, 0, 'draft', '#novel?id=malarin-ragasiyam-secret-of-the-flower', '2026-10-22 17:24:48', '2026-10-22 17:24:48', 36);
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`, `author_id`) VALUES ('nenjam-marappadhillai', 'Nenjam Marappadhillai', 'Rudhra Prarthana', 'Family Drama / Romance', 'Ongoing Novels', 'Ongoing', 'Ongoing', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80', 'Two souls living in different worlds are drawn together by the threads of fate, embarking on an emotional journey of family bonds and deep devotion.', 24, '148,200', '4.9', 'Today (October 2026)', 1, 1, 0, 1, NULL, 'Rudhra Prarthana', 'https://www.youtube.com/@rudhraprarthanaaudionovels', 1, 1, 1, 'public', '#novel?id=nenjam-marappadhillai', '2026-10-22 22:14:05', '2026-10-22 22:14:05', NULL);
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`, `author_id`) VALUES ('poongaatru-punnagaikka', 'Poongaatru Punnagaikka', 'Rudhra Prarthana', 'Short Stories / Feel Good', 'Short Stories', 'Completed', 'Short Story', 'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?auto=format&fit=crop&w=600&q=80', 'Heartwarming short stories bringing the gentle joys and relatable warmth of everyday life to readers.', 8, '64,300', '4.7', 'Full Collection', 0, 0, 0, 0, NULL, NULL, NULL, 6, 6, 1, 'public', '#novel?id=poongaatru-punnagaikka', '2026-10-21 22:13:55', '2026-10-22 11:49:01', 2);
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`, `author_id`) VALUES ('uyire-unakkaga', 'Uyire Unakkaga', 'Rudhra Prarthana', 'Family / Emotional', 'Completed Novels', 'Completed', 'Completed', 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=600&q=80', 'The inspiring story of a mother whose devotion and sacrifice guide her children through life\'s most meaningful crossroads.', 45, '340,900', '5.0', 'Completed Novel', 1, 0, 0, 1, NULL, 'Rudhra Prarthana', 'https://www.youtube.com/@rudhraprarthanaaudionovels', 3, 3, 1, 'public', '#novel?id=uyire-unakkaga', '2026-10-21 22:13:55', '2026-10-22 11:49:01', 2);
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`, `author_id`) VALUES ('vizhigalil-vizhundha-kavithai', 'Vizhigalil Vizhundha Kavithai', 'Rudhra Prarthana', 'Romance / Poetry', 'Completed Novels', 'Completed', 'Completed', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80', 'A poetic tale where silent glances speak louder than words, chronicling a pure and enduring romance.', 36, '220,150', '4.9', 'Completed Novel', 0, 0, 0, 0, NULL, NULL, NULL, 4, 4, 1, 'public', '#novel?id=vizhigalil-vizhundha-kavithai', '2026-10-22 22:14:05', '2026-10-22 22:14:05', NULL);

DROP TABLE IF EXISTS `password_resets`;
CREATE TABLE `password_resets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `otp_salt` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int DEFAULT '0',
  `max_attempts` int DEFAULT '5',
  `expires_at` datetime NOT NULL,
  `resend_after` datetime NOT NULL,
  `reset_token` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_resets_user` (`user_id`),
  KEY `idx_resets_email` (`email`),
  KEY `idx_resets_token` (`reset_token`),
  CONSTRAINT `fk_resets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `password_resets` (`id`, `user_id`, `email`, `otp_hash`, `otp_salt`, `attempts`, `max_attempts`, `expires_at`, `resend_after`, `reset_token`, `used`, `created_at`) VALUES (5, 2, 'digitalmarkservices.in@gmail.com', '1f15322696190b54030e58c800b1ff753761c3f5b7999a9577268c577ce7f1fbea55c194d795d9d4bc699fdaea077d2d5b4298ff5f2d106d6cfae6f08c2e51bb', 'cc24c2cae1c1906d98c243ea01f90ed9', 1, 5, '2026-10-21 18:27:39', '2026-10-21 18:13:33', 'f37346e6a4f67e1687d42b5838b1d02368eedec953da190c98f84e02907046ee', 1, '2026-10-21 18:12:33');
INSERT INTO `password_resets` (`id`, `user_id`, `email`, `otp_hash`, `otp_salt`, `attempts`, `max_attempts`, `expires_at`, `resend_after`, `reset_token`, `used`, `created_at`) VALUES (8, 28, 'harish89460@gmail.com', 'd7fe3d88e138d489ee9965fdcdd34454e581a873621966c58e653923f8d667b65370c20cf266e00c83b17408dc6288e83b1fc23d0d8f60a80568c6ce0d1e3778', '0c04ba06d7967ffa6315736c31764115', 0, 5, '2026-10-22 21:44:03', '2026-10-22 21:29:11', '2e324651b58e2b58202958d780e3cc752753d09622b49ddd1005ef2250321a0e', 1, '2026-10-22 21:28:11');

DROP TABLE IF EXISTS `profiles`;
CREATE TABLE `profiles` (
  `user_id` int NOT NULL,
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name_ta` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` mediumtext COLLATE utf8mb4_unicode_ci,
  `bio` text COLLATE utf8mb4_unicode_ci,
  `bio_ta` text COLLATE utf8mb4_unicode_ci,
  `title` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Member',
  `title_ta` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Member',
  `joined_date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `posts_count` int DEFAULT '0',
  `topics_count` int DEFAULT '0',
  `followers_count` int DEFAULT '0',
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (2, 'Rudhra Prarthana', 'Rudhra Prarthana', '/profile.png', 'Writing is my soul. Deeply grateful for the immense love of novel readers.', 'Writing is my soul. Deeply grateful for the immense love of novel readers.', 'Author', 'எழுத்தாளர்', 'Jan 2024', 15, 11, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (28, 'Harish', 'Harish', NULL, '', '', 'Admin', 'Member', 'Oct 2026', 24, 2, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (36, 'Kavitha Ramasamy', NULL, '/profile.png', NULL, NULL, 'Author & Writer', 'Member', 'October 2026', 18, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (37, 'Hariram', NULL, '/profile.png', NULL, NULL, 'Author & Writer', 'Member', 'October 2026', 0, 0, 0);

DROP TABLE IF EXISTS `push_subscriptions`;
CREATE TABLE `push_subscriptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `endpoint` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `p256dh` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `auth` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_push_endpoint` (`endpoint`),
  KEY `idx_push_user` (`user_id`),
  CONSTRAINT `fk_push_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `push_subscriptions` (`id`, `user_id`, `endpoint`, `p256dh`, `auth`, `user_agent`, `created_at`, `updated_at`) VALUES (6, 2, 'https://fcm.googleapis.com/fcm/send/cmqgUWqn37Q:APA91bGWiCfnEywdfSjaBBqVZLGLmmRyl0zVJ2VwnZlaqQYA9q8C_7kh2o5ITzSfXV8p5ZGbdFAJ1Z7gfzhVZUrKbGFOWN2o0-RFCuaKvUenV5F7SR1eSLFuF3egNwMMopC4Z6AlX4XE', 'BJph_ARE_TJqzTj5DWu9q_x5zEVwFq6S5jxDhW3B3wbR5ism7SBi85OqI6ivFGhcMwqV12uPFeB78WCu9PCCElA', 'AR2C1HOgV1iRoMBriYgvpQ', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36', '2026-10-23 18:01:10', '2026-10-23 18:24:13');

DROP TABLE IF EXISTS `reactions`;
CREATE TABLE `reactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `emoji` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reaction` (`target_type`,`target_id`,`user_id`),
  KEY `fk_reactions_user` (`user_id`),
  KEY `idx_reactions_target` (`target_type`,`target_id`),
  CONSTRAINT `fk_reactions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (1, 'novel', 'en-uyiril-nee', 2, '👍', '2026-10-21 21:45:57');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (2, 'chapter', 'nenjam-marappadhillai:24', 28, '❤️', '2026-10-14 10:31:00');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (3, 'chapter', 'nenjam-marappadhillai:24', 2, '❤️', '2026-10-14 10:41:00');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (4, 'novel', 'nenjam-marappadhillai', 28, '👍', '2026-10-14 10:32:00');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (5, 'novel', 'kaadhal-konden-kanave', 28, '😍', '2026-10-13 19:05:00');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (10, 'comment', '44', 28, '❤️', '2026-10-23 17:48:15');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (11, 'comment', '46', 28, '❤️', '2026-10-23 17:48:57');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (12, 'comment', '48', 28, '❤️', '2026-10-23 17:51:23');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (13, 'comment', '50', 28, '❤️', '2026-10-23 17:52:52');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (14, 'comment', '53', 28, '❤️', '2026-10-23 17:53:36');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (15, 'comment', '56', 28, '❤️', '2026-10-23 17:54:40');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (16, 'comment', '60', 28, '❤️', '2026-10-23 18:07:38');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (17, 'comment', '64', 28, '❤️', '2026-10-23 18:31:53');

DROP TABLE IF EXISTS `reading_progress`;
CREATE TABLE `reading_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `progress_percentage` int DEFAULT '0',
  `last_read_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reading_progress` (`user_id`,`novel_id`),
  KEY `fk_progress_novel` (`novel_id`),
  KEY `idx_progress_user` (`user_id`),
  CONSTRAINT `fk_progress_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_progress_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=78 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `reading_progress` (`id`, `user_id`, `novel_id`, `chapter_num`, `progress_percentage`, `last_read_at`) VALUES (67, 28, 'kaadhal-konden-kanave', '18', 100, '2026-10-22 23:01:23');
INSERT INTO `reading_progress` (`id`, `user_id`, `novel_id`, `chapter_num`, `progress_percentage`, `last_read_at`) VALUES (68, 28, 'maaya-nadhi-theeram', '1', 100, '2026-10-21 23:06:03');
INSERT INTO `reading_progress` (`id`, `user_id`, `novel_id`, `chapter_num`, `progress_percentage`, `last_read_at`) VALUES (70, 2, 'nenjam-marappadhillai', '24', 100, '2026-10-22 23:04:17');

DROP TABLE IF EXISTS `schema_migrations`;
CREATE TABLE `schema_migrations` (
  `version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('001_initial_schema', '2026-10-18 10:55:10');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('002_seed_genuine_data', '2026-10-18 10:55:10');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('003_admin_episodes_scheduler', '2026-10-20 07:50:26');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('004_session_separation', '2026-10-21 14:24:27');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('005_enlarge_avatar_cover', '2026-10-21 16:58:19');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('006_audio_novels', '2026-10-21 23:19:52');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('007_user_presence', '2026-10-22 14:18:06');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('008_writer_management', '2026-10-22 14:18:22');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('009_homepage_sections_management', '2026-10-22 14:22:18');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('010_forum_nested_replies', '2026-10-22 19:54:52');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('010_guest_visitors', '2026-10-22 21:09:08');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('011_novel_comments_nested_replies', '2026-10-22 21:47:08');
INSERT INTO `schema_migrations` (`version`, `applied_at`) VALUES ('012_notifications_push_and_events', '2026-10-23 17:15:52');

DROP TABLE IF EXISTS `sessions`;
CREATE TABLE `sessions` (
  `token` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `session_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'reader',
  PRIMARY KEY (`token`),
  KEY `idx_sessions_user` (`user_id`),
  KEY `idx_sessions_expires` (`expires_at`),
  KEY `idx_sessions_type` (`session_type`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('047520d9a4b75fa42741780392c668fee9f941fe43751d4501ca923aaf41c547', 2, '2026-11-20 19:39:53', '2026-10-21 19:39:53', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('0b0ba89d0072bb985bf19b5cdf402e04846ec0ede6d202da8f833439cc4dee97', 36, '2026-11-21 17:30:38', '2026-10-22 17:30:38', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('120a435c81347bf51e136424f91c85e746c983911ea023c3dc60761d8690a0ae', 36, '2026-11-22 17:51:23', '2026-10-23 17:51:23', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('12565059ff4ffd5f8e6c94aa43ec985af2fb46961d77aec52df027ffb5761d07', 2, '2026-11-22 17:48:15', '2026-10-23 17:48:15', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('137a394590e57e31483f59a2ce7a04cd8efdbc9a479d302ad68c1071c2601de2', 2, '2026-11-20 22:55:20', '2026-10-21 22:55:20', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('140748ae903b5e2c526a28d14dff8d4e7e84ee7d2bb93afd6bdcef15df27bf2d', 2, '2026-11-20 19:22:29', '2026-10-21 19:22:29', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('1591519fc806f58ffb62942aa44d1f692400b1d02eaa6260ea739cd65c06dd85', 36, '2026-11-22 17:41:44', '2026-10-23 17:41:44', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('1844b7210bb3343466c1c4b356d9c4331d47471ffe3d21d2b52611c438c639a2', 36, '2026-11-21 17:30:07', '2026-10-22 17:30:07', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('1c7726b00c2081a11c76dc3b44f7e1b595cfa947613bd63a2c2c96697a609e10', 36, '2026-11-21 17:18:48', '2026-10-22 17:18:48', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('1d7ea19d03033adbab4e600b3cc0505ef880b76d5ac9556aa237ce08b1b62949', 2, '2026-11-20 18:55:53', '2026-10-21 18:55:53', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('1f06f6a720e3653de99312e8e05e5a4ee803de839e3efad773f9f191bc1be2e3', 2, '2026-11-21 16:50:21', '2026-10-22 16:50:21', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('24ffdad71691876cd645e7cc84815338a0dc136ebc1f866abc88668b853f88a6', 36, '2026-11-22 17:54:40', '2026-10-23 17:54:40', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('285b577abccd27b71a315cb8af3f65e1f7dff3f4c715a216a573b8cffe161ce6', 2, '2026-11-21 14:59:01', '2026-10-22 14:59:01', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('28ae67bd901f1936c8413762a85eca5beca10be741a6356fbf4ae2f70ad4b893', 2, '2026-11-21 12:02:17', '2026-10-22 12:02:17', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('2abb443c82d35dfa6aced24d3437d8e43c9ee409ee78dfc00e3e16bd3682df47', 2, '2026-11-21 16:51:28', '2026-10-22 16:51:28', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('324937272a313d7f5b7a5c85547a81d872a6b9c60d782b77aeb012a4a8a881b1', 2, '2026-11-20 20:53:21', '2026-10-21 20:53:21', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('34dceeb76247b0874fc065485339ebd504adbfd9c7fed8104261571f544e0855', 2, '2026-11-21 14:59:29', '2026-10-22 14:59:29', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('3dc0b4c9716131d69e23e81a4109985529e9e37f21d7d437f37b73a6e39c0aa4', 2, '2026-11-20 21:36:33', '2026-10-21 21:36:33', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('43703e8eac054fc1e6568797a935a17aa1ad0c7cf644533b808e484b1a9d1c48', 37, '2026-11-21 21:01:28', '2026-10-22 21:01:28', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('44c23939d69c1e9c07e8f6021bc7fc4136c5bd992f74c87e01bf66294638473e', 2, '2026-11-20 18:12:40', '2026-10-21 18:12:40', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('48146daeb47d95045755a26cd5bd931d8f9c9942bdfb025ac0a1ccffcc95cf3a', 2, '2026-11-21 14:53:56', '2026-10-22 14:53:56', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('49a6691479bf8af7dbf4a37c71b9007dfe0606bae2593d348ab41c150a1e652b', 2, '2026-11-22 17:48:57', '2026-10-23 17:48:57', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('49db5335167087d4d50d77a7a3f08aad8cd122613b32a6d384ae2696b62a1f6d', 2, '2026-11-20 19:45:51', '2026-10-21 19:45:51', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('4cdfa142365fa8b9cf6a4c265392f3dea13177cce2a6ae698c9d89899057806a', 2, '2026-11-21 21:02:38', '2026-10-22 21:02:38', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('4d60e18409658c04d93ca6b8eaef46f98216fd5b06e419752f5fb58b2ce7c9a6', 2, '2026-11-21 10:30:16', '2026-10-22 10:30:16', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('4dfdd560e9a09d5f5ab23b1ed5428e40c99bc9f31bb645a454c65e757893524d', 2, '2026-11-20 12:59:55', '2026-10-21 18:29:55', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('4eebd67d217190696161be40ddb1fe23b2c7608426f54248a0000a2a4367f7ef', 2, '2026-11-20 23:14:10', '2026-10-21 23:14:10', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('4f66eb31d9419a68faa9a24f9aec2dfcd71a51b85c2730cc5b747e835d93bf85', 2, '2026-11-20 19:45:09', '2026-10-21 19:45:09', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('4f8d54491a19bc839a2db49fa6dcd79d354599f291b91ac0515c4e42eafd14d3', 2, '2026-11-20 13:00:56', '2026-10-21 18:30:56', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('50b1eb9926a70c81951418749ae5a4ad2d43fa5279c345c1d843af246490cc60', 2, '2026-11-21 12:03:56', '2026-10-22 12:03:56', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('52adaa9a984ba65321dfafc4ad2b0dc36d280cd4f27ae02024408323e3e6195c', 28, '2026-11-22 17:48:57', '2026-10-23 17:48:57', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('5515c2c9599c1f4ae7d90ad38caa25ce0d3623da643683eb38508aa9ac74c36d', 37, '2026-11-21 13:51:28', '2026-10-22 13:51:28', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('592d09df3d899a6b8b0d84962dce30194e56a0dbbe8997dba2c87999b3c1ba0c', 28, '2026-11-22 17:01:18', '2026-10-23 17:01:18', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('5b8443f4b953cc10d1afc981e217801e8ee88a8dc2c2c3f7b574f87e27c9e6ae', 2, '2026-11-20 18:29:53', '2026-10-21 18:29:53', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('5d50e332adb402278eb7dda03758b913af2e4c44f8d1d0ed5774fcbf4b4e3252', 28, '2026-11-21 21:29:20', '2026-10-22 21:29:20', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('61c59c2b6bdfea292949f683e55c535db3198fbdd30ca25517c19f5590069523', 2, '2026-11-20 22:55:20', '2026-10-21 22:55:20', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('62e1f5a2b1c7df822a4b251aefe6514adc49ca0646fe766169c5c4f39a3d9220', 2, '2026-11-21 10:34:07', '2026-10-22 10:34:07', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('62f6b43c873417038723a851e368b97db2c40270b15925c75e4b9f8b270bf26f', 2, '2026-11-20 19:43:44', '2026-10-21 19:43:44', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('632064c6439ec9714097a14828ab62cb53757a89465cfeaffe16f597a4acb825', 2, '2026-11-20 18:45:56', '2026-10-21 18:45:56', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('632db0e2f0bf95f88c55bc11cfbafdf0fd8f9efa7a55a8119a6e1ee90c5b3775', 28, '2026-11-22 18:31:53', '2026-10-23 18:31:53', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('657bb23a33d0f07ab1aa7d8fa70d5908ff62cc4ed32d3b0b039bf5564e1fc524', 28, '2026-11-22 17:52:52', '2026-10-23 17:52:52', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('6623aa8c84cfe6c8174bca472b376d434e9977dbb6b8d8f9397d90ac4dd6b476', 36, '2026-11-21 17:32:05', '2026-10-22 17:32:05', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('73051b17fdbf2451607537d16ec2a5413e4393232bb70705369bf689faa0bcea', 36, '2026-11-22 17:51:37', '2026-10-23 17:51:37', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('74fe7723d8f5358f2987fe8452c666192484577d1c3ca84fd45c64cfd59a72f5', 2, '2026-11-21 10:31:18', '2026-10-22 10:31:18', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('753e4bf29bd2dfd1d7be5c15ee154793c996394efa2e646cb30f9856efd73018', 2, '2026-11-20 19:45:53', '2026-10-21 19:45:53', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('75c1d6c9e8edfae429596a484d17962e65e38e15763e9cac927e276a72b8e492', 28, '2026-11-22 17:54:40', '2026-10-23 17:54:40', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('76fa08fef91b981e406d71fd64d0f6e006e5937e63c322af8cddfc21e93e8abc', 2, '2026-11-20 18:12:40', '2026-10-21 18:12:40', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('82badffbf165a0ca785fcaae1230c476a4ce08a5c4eda6408d6f029992f8d35c', 37, '2026-11-21 19:53:30', '2026-10-22 19:53:30', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('840a7b0a63ff32d7e7fd1fef4663f7b889ad7ff809f41097fac8b3454e1a48e5', 2, '2026-11-21 20:22:51', '2026-10-22 20:22:51', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('846e51cbe0f0664ee5cc6e3d9df1266e96f0dc1b7c0383b4d057089525bbf04f', 2, '2026-11-22 18:31:53', '2026-10-23 18:31:53', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('848d8876f501af172ee472921e702ae68fd16fe2f49f37962381b64abeeb6440', 2, '2026-11-20 19:39:46', '2026-10-21 19:39:46', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('84d5ebd6d535911f2d79e997d193f8d8613e0ae844dda1474dab78c5609f27e5', 28, '2026-11-21 21:58:09', '2026-10-22 21:58:09', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('85be14bf2c5f19e50ebd56fcc53f69d92050863b67c5544e37662aafdf2479c5', 28, '2026-11-22 17:53:36', '2026-10-23 17:53:36', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('87ea55f131f8dbd53fef93c84ffe28e3f972d82621ccd419a26096dd3bf8bd47', 36, '2026-11-21 17:32:28', '2026-10-22 17:32:28', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('880981c05dadd8b16b367827d4f1e1cba93ece52d95c821602d2339add904aae', 36, '2026-11-22 17:48:15', '2026-10-23 17:48:15', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('895e3d795c7dd8c327c214d3ebfc1fb36104b947eb117ee6d076316b0c4d69ac', 2, '2026-11-20 19:21:59', '2026-10-21 19:21:59', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('899dcf0695f77746a8402897b66f5ba70c6130f13bf15a10b9145667390f0773', 2, '2026-11-20 23:11:20', '2026-10-21 23:11:20', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('8c738398e8cb3bb906cb8ce96fcc1e38ae2d2d3b8acfaf6612119916fab8c31a', 2, '2026-11-20 19:38:00', '2026-10-21 19:38:00', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('8e8a72b7441df3e6adfa96a06f387de9592bee7d95624272fa495492109c1c64', 2, '2026-11-20 19:22:02', '2026-10-21 19:22:02', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('8faf1cb7fe34ef95b00bf41cfc64fda300b8ff01455d68ba9f91be73ae27b911', 2, '2026-11-20 18:54:48', '2026-10-21 18:54:48', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('918d71e22dc3c462c9469b91a6a587a00166d46bd84ead68a4e816e1945a2933', 2, '2026-11-20 18:31:26', '2026-10-21 18:31:26', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('91bf887e58468c024f72b2e8c48947d3ba3535b14eb25dca1bef6dbcdc0da278', 2, '2026-11-20 19:46:49', '2026-10-21 19:46:49', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('91d8339d4c6baaa864a5b1b145f538d5264f462d53976b66aa3e95b1022b60c5', 2, '2026-11-20 19:43:42', '2026-10-21 19:43:42', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('91dfa96b0d04567e5259bdba7fa6d9f4cba71353e0dbbc6294e9dbf4d886ec67', 37, '2026-11-22 17:33:01', '2026-10-23 17:33:01', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('91e6ece345842a875b89fb46355734e948f465dabad447d8de28baef1769a033', 2, '2026-11-20 18:56:41', '2026-10-21 18:56:41', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('92340d3d0a6c574684e47b8696039c7c8a9cf7c54cdc902e91c792e582358179', 2, '2026-11-20 23:10:25', '2026-10-21 23:10:25', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('9365bb0804ecea1f728240be2bb61e689241b78f3762a919bef8ca677436dd41', 2, '2026-11-21 14:53:00', '2026-10-22 14:53:00', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('9446e06e2f0cd2fa0f84ac3b0dccd37c2ba3fc5192b535e2c2b4c9882a0039e1', 2, '2026-11-20 18:56:38', '2026-10-21 18:56:38', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('94f422a32ef05726f606de1d0ac94fe48b128dab386206f66884d556eb377716', 2, '2026-11-22 17:41:44', '2026-10-23 17:41:44', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('986e232bdce4294b7e702275c17b48107b33acbbfc4cb583e774fa0a9d6cef60', 2, '2026-11-20 20:53:47', '2026-10-21 20:53:47', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('9c7217a49395e7d57816173e8eb48b3f38c5042184b93510327d1b7d8551e8ee', 2, '2026-11-21 11:42:16', '2026-10-22 11:42:16', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('9fd24c10dda91b32ee8b3f12421a5bbac22eb548e64f9fb487c6bab34946cd29', 36, '2026-11-22 17:48:57', '2026-10-23 17:48:57', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('a0da4aa4dbf0474730da4d856ed1e000e590c630e5a3c1ddb7944dcf8164851a', 36, '2026-11-22 17:52:52', '2026-10-23 17:52:52', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('a3de7c53fa41110f7c73f31395456785d72b359cf50c27b95309ef5033e93405', 36, '2026-11-21 17:15:17', '2026-10-22 17:15:17', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('a6853db6d42869fb5e84c25c9d4f461a8488c97ff2aa976e198f535f4a311a46', 2, '2026-11-20 19:22:26', '2026-10-21 19:22:26', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('a7537a002e92297b189a46f3497cc9a0c1ba7473ca87f2e044b4b86b6f45ae57', 2, '2026-11-21 21:01:06', '2026-10-22 21:01:06', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('a8db72b9df1c4993b354ab5e2b47d41ad7b6aad7f5a48d35b9ec2a91bc0a4445', 36, '2026-11-22 17:53:36', '2026-10-23 17:53:36', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('a9e2ad3d28e14620add44613e7c7a4912de04451325be8a88304fa4043b3f8e9', 2, '2026-11-21 14:57:40', '2026-10-22 14:57:40', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('aa3e4366470ca8d60f220d512a399a6e9f06a355e16722797f0e0c896ea8761e', 2, '2026-11-21 11:57:46', '2026-10-22 11:57:46', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('aae984c58c143234b9c88c4e3295c57d9225312d8330b8c4c662ea10348cfcc4', 2, '2026-11-20 19:20:47', '2026-10-21 19:20:47', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('ade6a1ebe782dc428b1524acece6dfd66781be05abac232340880168b6faeb93', 2, '2026-11-21 15:01:38', '2026-10-22 15:01:38', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('b02e5130965a1fcdecd8c02d15bf43112e93babf897c792a72aa6de2c3692c80', 2, '2026-11-20 23:09:33', '2026-10-21 23:09:33', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('b072eab582f1b285d357684da712bc1cd48f57435faa847a314068201ede0557', 2, '2026-11-20 22:55:53', '2026-10-21 22:55:53', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('b1929f0c8944b89f7fd9545af4569ab4e0a404269c73dfd0e9e496bbd499bd39', 2, '2026-11-21 16:49:29', '2026-10-22 16:49:29', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('b25c754cadfec4a0614fa20a5488c2ec6a3ea9a511278d03fbf5bc034c02f477', 2, '2026-11-22 17:51:23', '2026-10-23 17:51:23', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('b62a127bbfbcf8c20bc848c7aa21ecc6cfdbb6bc05eec6e47b77a7feaf8264d0', 2, '2026-11-20 19:46:46', '2026-10-21 19:46:46', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('bb4fc4b2aa5a57dba7000d812b5c7a89e1f090a6a2d84ea8fa37f2401587e091', 2, '2026-11-20 18:55:50', '2026-10-21 18:55:50', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('bd0f1f08eaea0d552959e89bcaf7410062cd7fbdba53f63c0f6d6507a1236456', 2, '2026-11-21 12:02:19', '2026-10-22 12:02:19', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('bd9a8ac1346db96eb35b8b4a16c1ddfb826d51e5df31e7996ee36a4acb100d75', 36, '2026-11-22 18:31:53', '2026-10-23 18:31:53', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('c0cc464e623787905ffb7090eca5beae0c5f86d39be77dccbaafc17cb752972f', 2, '2026-11-20 19:19:22', '2026-10-21 19:19:22', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('c2d35774368b5b129425c3429c8946530ea43bad1de3ccb61e656b2935f21f89', 2, '2026-11-21 15:00:21', '2026-10-22 15:00:21', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('c385faa2a27340d661a63d9896524279967dfaf955366ef9d6703588e42b95bb', 2, '2026-11-20 18:53:31', '2026-10-21 18:53:31', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('c90a77f264ae0a8721966c4a086605335327cee8f9d68769576d1a0eae6dc9cf', 2, '2026-11-20 13:15:58', '2026-10-21 18:45:58', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('ca792cd5f62477ad7ff769ecaf4bc2931d08aabbf41cf7d0213bf53372a651f5', 2, '2026-11-21 21:58:09', '2026-10-22 21:58:09', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('ccc6c927325ee998044cd605bb0c13ee050565422af96ab88b002d4e97b4ffe9', 2, '2026-11-22 17:54:40', '2026-10-23 17:54:40', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('cd89328a46f35fb8ff4d88d91ce6e5f2e9c9eb25d2eecff87e62650300746993', 2, '2026-11-22 17:53:36', '2026-10-23 17:53:36', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('d21134605487e0cf71cb889d39f043d62f2800a4897f233427167b94a62dc2c2', 2, '2026-11-20 18:54:07', '2026-10-21 18:54:07', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('d2153e2b984d6a80f30f85f30a513a1b10df51c7f53326b001ebbd43ebf3b9ae', 2, '2026-11-20 18:52:44', '2026-10-21 18:52:44', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('d222b1ab45cd280d3d898c87fdcd67cb482f62096d4bab9d7f12b266c4580e2b', 37, '2026-11-21 21:25:51', '2026-10-22 21:25:51', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('d22448e7026f5d3bf502458ac46d8de1e2658bacb48621e1bf448f1cf90d3d03', 2, '2026-11-20 22:55:14', '2026-10-21 22:55:14', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('d4a32e63b59990fd93057412ab074e1b504c2cebf9c00371d9349491b1022729', 36, '2026-11-21 17:16:38', '2026-10-22 17:16:38', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('d6699b97c735f110b9e51977d42441517b259d64b4e659a1826f022b04cbd4a5', 37, '2026-11-21 21:24:21', '2026-10-22 21:24:21', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('d6b3103cd8e699e57aa7094ef694b2ff2be3c23fb7899c28f4cde1fcf19c04d3', 2, '2026-11-20 19:20:50', '2026-10-21 19:20:50', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('d9287c4f16458051ff89099c5d5347615e8c204637715cfa300675bf482c9287', 2, '2026-11-21 10:22:24', '2026-10-22 10:22:24', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('dab1dfd0bc56bb89c6709a9b9d4b21001bc81243445cd40b184cc6c89ed9efbf', 2, '2026-11-20 19:45:06', '2026-10-21 19:45:06', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('de2744dfdf0f0d2ed31b0ec2f451d9b346b49f6d505086ad55f991414525a614', 2, '2026-11-21 13:50:23', '2026-10-22 13:50:23', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('e279137be1a00c91bf8e940415af18b69b4cd83905376ac67c6c94933fd0899e', 2, '2026-11-20 18:50:08', '2026-10-21 18:50:08', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('e3b1d10c3997c73a0fd632af85e3d81469e29e5443e621ad312811d54f5f17d0', 2, '2026-11-20 18:47:19', '2026-10-21 18:47:19', '127.0.0.1');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('e81ea05b928854b10ddd846ce8bad7f15a809b0c84b796b4f873a995585eaa28', 2, '2026-11-20 19:19:25', '2026-10-21 19:19:25', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('e8f02af5b457956b8dc23a60d34d75ab972e6f53caf34399bdcbe81c941b9604', 2, '2026-11-20 20:22:04', '2026-10-21 20:22:04', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('e97699805582ac67bda11ca4ad8d51ad871dada5427e15c3767f7036a79c5780', 28, '2026-11-22 17:41:44', '2026-10-23 17:41:44', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('ef00480354241c838e0e9d5d33303e2b40596b947d4e09b1cf015171330a262d', 36, '2026-11-21 17:31:04', '2026-10-22 17:31:04', 'writer');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f00c4e079aa708903c2862733d6740c9ac573888e1904f74706701d1324f18a1', 2, '2026-11-22 18:07:38', '2026-10-23 18:07:38', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f0332f1e077d79a8e9fa674e58315d504d1c496eadb1cc0da19ab3040d40ea62', 2, '2026-11-20 18:53:10', '2026-10-21 18:53:10', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f059f9a5a6741b096b11e23e703b461481309409bbe2cebc5d34e06c8cc7eb29', 2, '2026-11-21 21:00:04', '2026-10-22 21:00:04', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f1bba89600058cc94c918167c9cd2c8f9221beb9231db42306f5f43194400863', 28, '2026-11-22 17:51:23', '2026-10-23 17:51:23', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f3caf07ac2e7cea64e2950e8452bf0adc65b01d6787669318ca781d5d7192522', 2, '2026-11-22 17:52:52', '2026-10-23 17:52:52', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f3efe333867829081115606e66cf55efa69c80c0fa325e3a7b58d17df0450c44', 2, '2026-11-20 18:48:41', '2026-10-21 18:48:41', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f6004db24544cbd426e2c144b61a407b1d88021245da92056c2dc132fb91eda2', 28, '2026-11-22 17:48:15', '2026-10-23 17:48:15', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f8b90332bed0e549f04e91993bac250c4578793b380d5d2f8133bafefeb48d97', 2, '2026-11-21 17:00:10', '2026-10-22 17:00:10', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('fa0beee6969dcbb79e79ef7eac0f8ce96fd4becf57568beb4f8c4e46d6d574f5', 2, '2026-11-21 10:38:24', '2026-10-22 10:38:24', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('fb4d787782583d9cd497f9d23c25daaea2573de1f1838134afa755d276594121', 28, '2026-11-22 18:07:38', '2026-10-23 18:07:38', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('fe4db76526f8f8e484170a017e28a91c95b8113959d5e96feb93b721bbaa3ccc', 2, '2026-11-20 20:53:50', '2026-10-21 20:53:50', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('fe827e79c93d1bbc6a89f6ce9ac3ea71b4e79fba30a0345f8661982f2ff72e53', 36, '2026-11-22 18:07:38', '2026-10-23 18:07:38', 'reader');

DROP TABLE IF EXISTS `site_settings`;
CREATE TABLE `site_settings` (
  `setting_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `updated_at`) VALUES ('author_name', 'Rudhra Prarthana', '2026-10-20 07:50:26');
INSERT INTO `site_settings` (`setting_key`, `setting_value`, `updated_at`) VALUES ('default_timezone', 'Asia/Kolkata', '2026-10-20 07:50:26');
INSERT INTO `site_settings` (`setting_key`, `setting_value`, `updated_at`) VALUES ('editor_autosave_interval', '30', '2026-10-20 07:50:26');
INSERT INTO `site_settings` (`setting_key`, `setting_value`, `updated_at`) VALUES ('site_title', 'Rudhra Prarthana Novels', '2026-10-20 07:50:26');

DROP TABLE IF EXISTS `user_presence`;
CREATE TABLE `user_presence` (
  `session_key` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int DEFAULT NULL,
  `visitor_type` enum('member','guest') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'guest',
  `last_activity` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`session_key`),
  KEY `idx_presence_last_activity` (`last_activity`),
  KEY `idx_presence_user` (`user_id`),
  KEY `idx_presence_type` (`visitor_type`),
  CONSTRAINT `fk_user_presence_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `user_presence` (`session_key`, `user_id`, `visitor_type`, `last_activity`, `created_at`) VALUES ('guest_gst_le8ekscy_mvky87n7', NULL, 'guest', '2026-10-23 18:37:58', '2026-10-23 18:01:16');
INSERT INTO `user_presence` (`session_key`, `user_id`, `visitor_type`, `last_activity`, `created_at`) VALUES ('member_2', 2, 'member', '2026-10-23 18:38:48', '2026-10-23 17:55:16');

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `salt` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Member',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status` enum('active','blocked','pending_deletion') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_by` int DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_username` (`username`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`, `status`, `created_by`, `last_login`) VALUES (2, 'rudhra_author', 'digitalmarkservices.in@gmail.com', '6d331e3e0946752c7b0756f4124a8583260a60adbb10fef6853e59ff9771f28c69fdb5a1998becfae26d357891c24166aaeb5503ae51749c78cebcf6a776ba77', '7b5b561ab95aeba10a2d9c3ace74ef16', 'Admin', '2026-10-18 10:55:10', '2026-10-23 17:32:28', 'active', NULL, '2026-10-23 17:32:28');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`, `status`, `created_by`, `last_login`) VALUES (28, 'harish', 'harish89460@gmail.com', '6e0f37a761f0b78becd87070444364cd0381b9e6183876935be8597c667dfddbd313ec9f9653353efac27a7cc34660d63ee0a251291d9b1edbd17595829853b2', '3215653cc83fc13951b547485e437552', 'Admin', '2026-10-21 17:07:57', '2026-10-22 21:29:15', 'active', NULL, NULL);
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`, `status`, `created_by`, `last_login`) VALUES (36, 'kavitha_ramasamy', 'kavitha.writer@rpnovels.com', 'bdb253f7f036edefecb7756c572320ba4168033003f327571735c4a37ef947d2a116751a263ba5c12a02799464902ef664051b349f8d52709225a7cdcbe8399a', '3f57cf320f342ec65cbbbbbf231a6958', 'writer', '2026-10-22 12:19:15', '2026-10-22 17:18:48', 'active', 2, '2026-10-22 17:18:48');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`, `status`, `created_by`, `last_login`) VALUES (37, 'hariram', 'trendup089@gmail.com', '3dfeb5d68606f0d0345a168b6736c753f2aa7dea73ba206ff8f47de24bfee54ca3e06d2720a56981318beebd8e1663033c5701863f548d34b49527de7d1b3a96', 'f3737e0b88f01811861e98bf645cbf4a', 'writer', '2026-10-22 13:49:11', '2026-10-23 17:33:01', 'active', 2, '2026-10-23 17:33:01');

DROP TABLE IF EXISTS `writer_audit_logs`;
CREATE TABLE `writer_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `writer_id` int DEFAULT NULL,
  `actor_id` int DEFAULT NULL,
  `action` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_writer` (`writer_id`),
  KEY `idx_audit_actor` (`actor_id`),
  KEY `idx_audit_action` (`action`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_audit_writer` FOREIGN KEY (`writer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (7, NULL, 2, 'account_deleted', 'Writer "kavitha_writer" (kavitha_1792650466362@rpnovels.com) deleted. 1 novel(s) preserved and reassigned to Author ID 2.', '2026-10-22 11:57:50');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (16, NULL, 2, 'account_deleted', 'Writer "kavitha_writer_1" (kavitha_1792650836654@rpnovels.com) deleted. 1 novel(s) preserved and reassigned to Author ID 2.', '2026-10-22 12:04:08');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (17, 36, 2, 'account_created', 'Writer account "Kavitha Ramasamy" (kavitha.writer@rpnovels.com) created by Admin.', '2026-10-22 12:19:15');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (18, 36, 36, 'login_success', 'Writer logged in successfully via shared Author & Writer portal.', '2026-10-22 12:21:24');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (19, 37, 2, 'account_created', 'Writer account "Hariram" (trendup089@gmail.com) created by Admin.', '2026-10-22 13:49:11');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (20, 37, 37, 'login_success', 'Writer logged in successfully via shared Author & Writer portal.', '2026-10-22 13:51:29');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (21, 36, 36, 'login_success', 'Writer logged in successfully via shared Author & Writer portal.', '2026-10-22 17:15:17');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (22, 36, 36, 'login_success', 'Writer logged in successfully via shared Author & Writer portal.', '2026-10-22 17:16:38');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (23, 36, 36, 'login_success', 'Writer logged in successfully via shared Author & Writer portal.', '2026-10-22 17:18:48');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (24, 37, 37, 'login_success', 'Writer logged in successfully via shared Author & Writer portal.', '2026-10-22 19:53:30');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (25, 28, 28, 'password_reset_completed', 'Password was updated successfully using verified email OTP.', '2026-10-22 21:29:15');
INSERT INTO `writer_audit_logs` (`id`, `writer_id`, `actor_id`, `action`, `details`, `created_at`) VALUES (26, 37, 37, 'login_success', 'Writer logged in successfully via shared Author & Writer portal.', '2026-10-23 17:33:01');

SET FOREIGN_KEY_CHECKS=1;
