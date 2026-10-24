-- MySQL Dump generated for fresh initialization
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

INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (2, 1, 1, '2026-10-21 14:53:22');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (8, 1, 0, '2026-10-21 14:55:52');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (9, 1, 1, '2026-10-18 11:42:50');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (10, 1, 1, '2026-10-18 11:51:27');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (11, 1, 1, '2026-10-20 08:14:43');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (12, 1, 1, '2026-10-20 08:16:43');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (13, 1, 1, '2026-10-20 08:20:43');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (14, 1, 1, '2026-10-21 14:34:26');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (15, 1, 1, '2026-10-21 14:35:47');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (16, 1, 1, '2026-10-21 14:37:00');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (17, 1, 1, '2026-10-21 14:45:49');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (18, 1, 0, '2026-10-21 14:48:05');
INSERT INTO `activity_status` (`user_id`, `is_enabled`, `is_online`, `last_seen`) VALUES (19, 1, 0, '2026-10-21 14:54:15');

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
) ENGINE=InnoDB AUTO_INCREMENT=47 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (1, 'nenjam-marappadhillai', NULL, '1', '1', 'Chapter 01 — Beginning of Dawn', 'Chapter 01 — Beginning of Dawn', 'The morning mist drifted lazily across the veranda as Varshini held her porcelain cup, listening to the quiet rhythm of the dawn. Though countless memories echoed within, her expression remained calm and poised.

Little did she know that today would mark the beginning of a decisive chapter in her journey. The distant hum of the morning express train seemed to announce a destiny already unfolding.

"Varshini, are you ready?" Her mother''s warm voice drew her back into the present. With a soft smile, she nodded. The next chapter of life was finally about to begin.', 1, 0, '2,450 words', '7 mins', '12 Oct 2025', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (2, 'nenjam-marappadhillai', NULL, '2', '2', 'Chapter 02 — Waves of Memory', 'Chapter 02 — Waves of Memory', 'The bustling train station was bathed in amber morning light. As the train rolled in with a metallic roar, Varshini stepped onto the platform, luggage in hand.

Memories of her childhood summers rushed back—the endless green fields, the ancestral home, and the promises made under the grand banyan tree. But the face she remembered most vividly was the one she had tried so hard to forget.

"Could he still be here?" she whispered quietly to herself, tightening her grip on her shawl as a sudden gust of wind swept through the platform.', 1, 0, '2,600 words', '8 mins', '19 Oct 2025', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (3, 'nenjam-marappadhillai', NULL, '3', '3', 'Chapter 03 — Unexpected Meeting', 'Chapter 03 — Unexpected Meeting', 'The village courtyard was alive with familiar laughter. Family members greeted her with warm embraces and traditional sweets. Yet across the courtyard, near the carved wooden doorway, stood a tall figure with sharp, thoughtful eyes.

Their eyes met across the crowded hall. Time seemed to pause for a breathless second. It was him—Devan. He had matured, but that intense gaze remained unchanged.

He offered a slow, courteous nod, acknowledging her return with an unspoken depth that made her pulse quicken.', 1, 0, '2,820 words', '8 mins', '26 Oct 2025', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (4, 'nenjam-marappadhillai', NULL, '24', '24', 'Chapter 24 — Truth in the Heart', 'Chapter 24 — Truth in the Heart', 'The rain poured down steadily outside the study window, drumming against the glass like a long-kept secret finally demanding release.

Varshini placed the old journal onto the table. "You knew all along, didn''t you, Devan?"

Devan turned, the dim desk lamp illuminating his resolute face. "Some truths are withheld not to deceive, Varshini, but to protect what matters most."

For the first time in ten years, the wall between them crumbled. In the silence that followed, both understood that life had given them a second chance.', 1, 0, '3,120 words', '10 mins', '08 Oct 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (5, 'kaadhal-konden-kanave', NULL, '1', '1', 'Chapter 01 — Dream Journey', 'Chapter 01 — Dream Journey', 'In the quiet glow of twilight, dreams often weave paths that reality hesitates to tread. Ananya sketched the riverbank in her notebook, watching the twilight colors blend into indigo.

She had always believed in the power of destiny. When an unfamiliar shadow crossed the pathway, she looked up, surprised to find someone admiring her artwork.

"You capture the light remarkably well," a voice murmured. That single sentence would change everything.', 1, 0, '2,200 words', '6 mins', '15 Jan 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (6, 'kaadhal-konden-kanave', NULL, '18', '18', 'Chapter 18 — Soft Touch', 'Chapter 18 — Soft Touch', 'Standing atop the hilltop temple stairs, the city lights spread beneath them like an ocean of fallen stars.

"Do you still doubt what we have?" Siddharth asked softly, reaching out to hold her hand in the cool night air.

Ananya looked into his eyes and felt the doubts of months evaporate into the night breeze. With a gentle nod, she knew they were ready to face whatever family challenges lay ahead.', 1, 0, '2,900 words', '9 mins', '07 Oct 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (7, 'uyire-unakkaga', NULL, '1', '1', 'Chapter 01 — Motherhood Lullaby', 'Chapter 01 — Motherhood Lullaby', 'The aroma of freshly ground spices filled the small kitchen where Meenakshi Amma worked tirelessly before the break of dawn.

Her three children slept soundly in the next room, oblivious to the financial burdens she bore alone since her husband''s untimely passing. Every sacrifice, every silent tear, was dedicated to ensuring their dignity and future.

"As long as I draw breath, my children will hold their heads high," she whispered as the morning sun crowned the horizon.', 1, 0, '3,100 words', '9 mins', '01 Mar 2025', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (8, 'uyire-unakkaga', NULL, '45', '45', 'Chapter 45 — Blissful Conclusion', 'Chapter 45 — Blissful Conclusion', 'The grand university auditorium was filled with thunderous applause as her son stepped forward to receive his doctorate, bowing low to touch Meenakshi''s feet.

Tears of profound joy rolled down her weathered cheeks. Her children had reached heights greater than she had ever dared to dream. The sacrifices of a lifetime had borne the sweetest fruit.', 1, 0, '4,000 words', '12 mins', '15 Dec 2025', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (9, 'vizhigalil-vizhundha-kavithai', NULL, '1', '1', 'Chapter 01 — Silence of the Eyes', 'Chapter 01 — Silence of the Eyes', 'Words are easy to utter, but silence holds the truest poetry of love. In the university library between rows of classical literature, their silent companionship had quietly grown over three years.

A single exchange of glances conveyed what entire volumes could not express.', 1, 0, '2,500 words', '8 mins', '10 Jun 2025', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (10, 'poongaatru-punnagaikka', NULL, '1', '1', 'Story 01 — Rainy Drizzle People', 'Story 01 — Rainy Drizzle People', 'Underneath the green tin awning of the roadside tea stall, seven strangers huddled together to escape a sudden torrential downpour.

As hot ginger tea was passed around in glass tumblers, stories began to flow. In those forty-five minutes of shared warmth, seven lives touched and enriched one another before the rain stopped and they went their separate ways.', 1, 0, '1,800 words', '5 mins', '14 Jul 2025', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (11, 'maaya-nadhi-theeram', NULL, '1', '1', 'Part 01 — Riverbank Shadows (Audio)', 'Part 01 — Riverbank Shadows (Audio)', 'The Kaveri riverbank was shrouded in thick river fog as midnight approached. Inspector Raghavan shone his flashlight across the abandoned boathouse, discovering an antique brass lock newly broken.

This audio episode is produced with ambient music and narration by author Rudhra Prarthana. Log in as a member to listen to the full episode.', 0, 1, 'Audio 22 mins', '22 mins', '01 Sep 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-18 10:55:10', '1.0000', '2026-10-18 10:55:10', '2026-10-20 07:50:25');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (12, 'test-novel-1792464274', NULL, '1', '1', 'Episode 01 — Golden Dawn', 'Episode 01 — Golden Dawn', '<p>Varshini looked at the golden rays spreading across the courtyard.</p>', 1, 0, '10 words', '1 min', 'Oct 20, 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-20 02:45:00', '1.0000', '2026-10-20 08:15:00', '2026-10-20 08:15:00');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (13, 'test-novel-1792464274', 12, '1.1', '1.1', 'Episode 1.1 — Memories of Mother', 'Episode 1.1 — Memories of Mother', '<p>A quiet melody reminded her of the past.</p>', 1, 0, '8 words', '1 min', 'Oct 20, 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-20 02:45:02', '1.1000', '2026-10-20 08:15:02', '2026-10-20 08:15:02');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (14, 'test-novel-1792464274', 12, '1.2', '1.2', 'Episode 1.2 — The Unwritten Letter', 'Episode 1.2 — The Unwritten Letter', '<p>She kept the sealed letter inside the wooden desk.</p>', 1, 0, '9 words', '1 min', 'Oct 20, 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-20 02:45:04', '1.2000', '2026-10-20 08:15:04', '2026-10-20 08:15:04');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (15, 'test-novel-1792464274', NULL, '2', '2', 'Episode 02 — The Distant Train', 'Episode 02 — The Distant Train', '<p>The morning express train whistle blew across the tracks.</p>', 1, 0, '9 words', '1 min', 'Oct 20, 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-20 02:45:06', '2.0000', '2026-10-20 08:15:06', '2026-10-20 08:15:06');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (16, 'test-novel-1792464274', 15, '2.1', '2.1', 'Episode 2.1 — A Chance Encounter', 'Episode 2.1 — A Chance Encounter', '<p>Two paths crossed unexpectedly at the platform.</p>', 1, 0, '7 words', '1 min', 'Oct 20, 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-20 02:45:08', '2.1000', '2026-10-20 08:15:08', '2026-10-20 08:15:08');
INSERT INTO `chapters` (`id`, `novel_id`, `parent_id`, `chapter_num`, `episode_number`, `title`, `title_ta`, `content`, `is_guest_allowed`, `is_audio`, `word_count`, `read_time`, `release_date`, `status`, `scheduled_at`, `timezone`, `published_at`, `sort_order`, `created_at`, `updated_at`) VALUES (18, 'test-novel-1792464274', NULL, '3', '3', 'Episode 03 — Tomorrow Skies (Scheduled)', 'Episode 03 — Tomorrow Skies (Scheduled)', '<p>This story will automatically release tomorrow morning.</p>', 1, 0, '7 words', '1 min', 'Oct 20, 2026', 'published', NULL, 'Asia/Kolkata', '2026-10-20 08:15:25', '3.0000', '2026-10-20 08:15:18', '2026-10-20 08:15:25');

DROP TABLE IF EXISTS `comments`;
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `novel_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `chapter_num` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT '0',
  `user_id` int NOT NULL,
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comments_target` (`novel_id`,`chapter_num`),
  KEY `idx_comments_user` (`user_id`),
  CONSTRAINT `fk_comments_novel` FOREIGN KEY (`novel_id`) REFERENCES `novels` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (1, 'nenjam-marappadhillai', '24', 8, 'What an incredible chapter! The emotional confrontation between Devan and Varshini was written with such mastery.', '2026-10-14 10:30:00', '2026-10-18 10:55:10');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (2, 'nenjam-marappadhillai', '24', 2, 'Thank you so much Harish! More exciting moments are in store for the upcoming chapters.', '2026-10-14 10:40:00', '2026-10-18 10:55:10');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (3, 'kaadhal-konden-kanave', '18', 8, 'Siddharth and Ananya have stolen our hearts. Wonderful story progression!', '2026-10-13 19:00:00', '2026-10-18 10:55:10');
INSERT INTO `comments` (`id`, `novel_id`, `chapter_num`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (4, 'nenjam-marappadhillai', '1', 8, 'Re-reading chapter 1 brings back all the nostalgic charm of how this wonderful story began.', '2026-10-15 12:00:00', '2026-10-18 10:55:10');

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
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_posts_topic` (`topic_id`),
  KEY `idx_posts_user` (`user_id`),
  CONSTRAINT `fk_posts_topic` FOREIGN KEY (`topic_id`) REFERENCES `forum_topics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_posts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (1, 'topic-nenjam-24', 2, 'Welcome, dear readers! Chapter 24 of ''Nenjam Marappadhillai'' is now live! Please share your thoughts and predictions right here! ❤️', '2026-10-14 09:30:00', '2026-10-18 10:55:10');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (2, 'topic-nenjam-24', 8, 'Chapter 24 moved at such an exciting pace! The revelation was breathtaking. Eagerly waiting for the next update!', '2026-10-14 10:15:00', '2026-10-18 10:55:10');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (3, 'topic-kaadhal-kanave-18', 2, 'How did you feel about the revelation in chapter 18? Drop your feedback below!', '2026-10-13 14:20:00', '2026-10-18 10:55:10');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (4, 'topic-review-style', 8, 'The nuanced family dynamics in RP''s novels make every character feel profoundly real. What stands out to you most?', '2026-10-12 11:00:00', '2026-10-18 10:55:10');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (5, 'topic-review-style', 2, 'Thank you so much Harish! Realistic emotional depth is the true compass of my writing.', '2026-10-14 08:20:00', '2026-10-18 10:55:10');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (6, 'topic-rain-coffee', 8, 'Perfect weather to curl up and read novels with a warm cup of coffee!', '2026-10-11 16:30:00', '2026-10-18 10:55:10');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (7, 'topic-short-story', 2, 'Thank you for all the lovely comments on our rainy-day special short story!', '2026-10-10 10:00:00', '2026-10-18 10:55:10');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (8, 'topic-tamil-kanave', 2, 'காதல் கொண்டேன் கனவே தொடரின் இந்த வார திருப்பங்கள் உங்களுக்கு பிடித்திருந்ததா? உங்கள் மேலான கருத்துக்களை இங்கே பகிருங்கள்! ❤️', '2026-10-14 10:45:00', '2026-10-18 10:55:10');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (9, 'topic-tamil-kanave', 8, 'கதைக்களம் மிகவும் அருமையாக செல்கிறது! அடுத்த பதிவிற்காக ஆவலுடன் காத்திருக்கிறோம்.', '2026-10-14 10:55:00', '2026-10-18 10:55:10');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (10, 'topic-nenjam-24', 2, 'Test automated verification reply at 1792303860.3186612', '2026-10-18 11:41:00', '2026-10-18 11:41:00');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (11, 'topic-nenjam-24', 2, 'Test automated verification reply at 1792304482.1046853', '2026-10-18 11:51:22', '2026-10-18 11:51:22');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (12, 'topic-nenjam-24', 2, 'Test automated verification reply at 1792571783.8980358', '2026-10-21 14:06:25', '2026-10-21 14:06:25');
INSERT INTO `forum_posts` (`id`, `topic_id`, `user_id`, `content`, `created_at`, `updated_at`) VALUES (13, 'topic-nenjam-24', 2, 'Test automated verification reply at 1792572550.8464286', '2026-10-21 14:19:12', '2026-10-21 14:19:12');

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

INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-kaadhal-kanave-18', 'ongoing-novels', 'ONGOING NOVELS', 'Kaadhal Konden Kanave — Chapter 18 Emotional Highlights', 2, 110, 1, 1, 'public', 2, '2026-10-13 18:45:00', '2026-10-13 14:20:00', '2026-10-13 18:45:00');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-nenjam-24', 'ongoing-novels', 'ONGOING NOVELS', 'Nenjam Marappadhillai — Your thoughts on Chapter 24?', 2, 145, 6, 1, 'public', 2, '2026-10-21 14:19:12', '2026-10-14 09:30:00', '2026-10-21 14:19:12');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-rain-coffee', 'tea-time', 'TEA TIME', 'Today''s rainfall and a hot cup of coffee ☕', 8, 195, 3, 1, 'public', 8, '2026-10-13 21:10:00', '2026-10-11 16:30:00', '2026-10-13 21:10:00');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-review-style', 'review-junction', 'REVIEW JUNCTION', 'A critical perspective on Rudhra Prarthana''s storytelling style', 8, 230, 4, 1, 'public', 2, '2026-10-14 08:20:00', '2026-10-12 11:00:00', '2026-10-14 08:20:00');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-short-story', 'short-stories', 'SHORT STORIES', 'Loved reading People of the Rain — Heartwarming story', 2, 155, 2, 1, 'public', 8, '2026-10-12 15:30:00', '2026-10-10 10:00:00', '2026-10-12 15:30:00');
INSERT INTO `forum_topics` (`id`, `category_id`, `category_title`, `title`, `author_id`, `views_count`, `replies_count`, `is_published`, `visibility`, `last_reply_author_id`, `last_reply_at`, `created_at`, `updated_at`) VALUES ('topic-tamil-kanave', 'ongoing-novels', 'ONGOING NOVELS', 'காதல் கொண்டேன் கனவே — வாசகர்களின் மனம் கவர்ந்த உணர்ச்சிப்பூர்வமான தருணங்கள்', 2, 178, 3, 1, 'public', 8, '2026-10-14 10:55:00', '2026-10-14 10:45:00', '2026-10-14 10:55:00');

DROP TABLE IF EXISTS `homepage_sections`;
CREATE TABLE `homepage_sections` (
  `section_key` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtitle` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_visible` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`section_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`) VALUES ('audio', 'Audio Novels', 'Listen & Enjoy', 1, 3, '2026-10-18 10:55:10');
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`) VALUES ('completed', 'Completed Novels', 'Completed Works', 1, 5, '2026-10-18 10:55:10');
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`) VALUES ('continue_reading', 'Continue Reading', 'Pick Up Where You Left Off', 1, 2, '2026-10-18 10:55:10');
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`) VALUES ('featured', 'Featured Ongoing Novels', 'Currently Releasing', 1, 1, '2026-10-18 10:55:10');
INSERT INTO `homepage_sections` (`section_key`, `title`, `subtitle`, `is_visible`, `sort_order`, `updated_at`) VALUES ('trending', 'Trending Novels', 'Reader Favorites', 1, 4, '2026-10-18 10:55:10');

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `likes` (`id`, `target_type`, `target_id`, `user_id`, `created_at`) VALUES (1, 'novel', 'nenjam-marappadhillai', 8, '2026-10-14 10:32:00');
INSERT INTO `likes` (`id`, `target_type`, `target_id`, `user_id`, `created_at`) VALUES (2, 'novel', 'kaadhal-konden-kanave', 8, '2026-10-13 19:05:00');
INSERT INTO `likes` (`id`, `target_type`, `target_id`, `user_id`, `created_at`) VALUES (3, 'chapter', 'nenjam-marappadhillai:24', 8, '2026-10-14 10:31:00');

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
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `media` (`id`, `filename`, `original_name`, `url`, `mime_type`, `size_bytes`, `uploaded_by`, `created_at`) VALUES (1, 'media-1792464329148-l0q9jt.png', 'cover_test.png', '/uploads/media/media-1792464329148-l0q9jt.png', 'image/png', 70, 2, '2026-10-20 08:15:29');

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'announcement',
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `link` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read` (`user_id`,`is_read`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `link`, `is_read`, `created_at`) VALUES (1, 8, 'chapter_release', 'New Chapter Released!', 'Rudhra Prarthana has published Chapter 24 of Nenjam Marappadhillai.', '#reader?novel=nenjam-marappadhillai&ch=24', 1, '2026-10-14 09:30:00');
INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `link`, `is_read`, `created_at`) VALUES (2, 8, 'announcement', 'Welcome to Rudhra Prarthana Novels', 'Experience distraction-free reading, audio novels, and our interactive community.', '#home', 1, '2026-10-01 10:00:00');
INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `message`, `link`, `is_read`, `created_at`) VALUES (3, 2, 'announcement', 'Welcome Rudhra Prarthana', 'Welcome to your official author portal. Your works are loved by hundreds of thousands of readers.', '#home', 0, '2026-10-01 10:00:00');

DROP TABLE IF EXISTS `novels`;
CREATE TABLE `novels` (
  `id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `author` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT 'Rudhra Prarthana',
  `genre` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Ongoing',
  `badge` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'Ongoing',
  `cover` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
  PRIMARY KEY (`id`),
  KEY `idx_novels_status` (`status`),
  KEY `idx_novels_featured` (`featured`),
  KEY `idx_novels_published` (`is_published`,`visibility`),
  KEY `idx_novels_sort` (`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`) VALUES ('kaadhal-konden-kanave', 'Kaadhal Konden Kanave', 'Rudhra Prarthana', 'Romance', 'Ongoing Novels', 'Ongoing', 'Ongoing', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80', 'A romance that begins through shared dreams faces real-life trials and triumphs. A youth-filled emotional story of affection.', 18, '112,400', '4.8', 'Yesterday', 1, 1, 0, 0, NULL, NULL, NULL, 2, 2, 1, 'public', '#novel?id=kaadhal-konden-kanave', '2026-10-18 10:55:10', '2026-10-18 10:55:10');
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`) VALUES ('maaya-nadhi-theeram', 'Maaya Nadhi Theeram', 'Rudhra Prarthana', 'Mystery / Thriller', 'Audio Novels', 'Ongoing', 'Audio Novel', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80', 'A gripping thriller set along a mysterious riverbank where uncovered secrets and suspense keep listeners captivated.', 12, '89,400', '4.8', 'Part 06 Released', 1, 0, 1, 1, '4h 25m', 'Rudhra Prarthana', 'https://www.youtube.com/@rudhraprarthanaaudionovels', 5, 5, 1, 'public', '#novel?id=maaya-nadhi-theeram', '2026-10-18 10:55:10', '2026-10-18 10:55:10');
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`) VALUES ('nenjam-marappadhillai', 'Nenjam Marappadhillai', 'Rudhra Prarthana', 'Family Drama / Romance', 'Ongoing Novels', 'Ongoing', 'Ongoing', 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80', 'Two souls living in different worlds are drawn together by the threads of fate, embarking on an emotional journey of family bonds and deep devotion.', 24, '148,200', '4.9', 'Today (October 2026)', 1, 1, 0, 1, NULL, 'Rudhra Prarthana', 'https://www.youtube.com/@rudhraprarthanaaudionovels', 1, 1, 1, 'public', '#novel?id=nenjam-marappadhillai', '2026-10-18 10:55:10', '2026-10-18 10:55:10');
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`) VALUES ('poongaatru-punnagaikka', 'Poongaatru Punnagaikka', 'Rudhra Prarthana', 'Short Stories / Feel Good', 'Short Stories', 'Completed', 'Short Story', 'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?auto=format&fit=crop&w=600&q=80', 'Heartwarming short stories bringing the gentle joys and relatable warmth of everyday life to readers.', 8, '64,300', '4.7', 'Full Collection', 0, 0, 0, 0, NULL, NULL, NULL, 6, 6, 1, 'public', '#novel?id=poongaatru-punnagaikka', '2026-10-18 10:55:10', '2026-10-18 10:55:10');
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`) VALUES ('test-novel-1792464274', 'Vaanavil Ninaivugal', 'Rudhra Prarthana', 'Family Romance', 'Ongoing Novels', 'Ongoing', 'Ongoing', '/default-cover.jpg', 'A heart-touching tale of resilience and familial bond.', 6, '0', '5.0', 'Oct 20, 2026', 0, 0, 0, 0, NULL, NULL, NULL, 0, 0, 1, 'public', '#novel?id=test-novel-1792464274', '2026-10-20 08:14:49', '2026-10-20 08:15:25');
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`) VALUES ('uyire-unakkaga', 'Uyire Unakkaga', 'Rudhra Prarthana', 'Family / Emotional', 'Completed Novels', 'Completed', 'Completed', 'https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=600&q=80', 'The inspiring story of a mother whose devotion and sacrifice guide her children through life''s most meaningful crossroads.', 45, '340,900', '5.0', 'Completed Novel', 1, 0, 0, 1, NULL, 'Rudhra Prarthana', 'https://www.youtube.com/@rudhraprarthanaaudionovels', 3, 3, 1, 'public', '#novel?id=uyire-unakkaga', '2026-10-18 10:55:10', '2026-10-18 10:55:10');
INSERT INTO `novels` (`id`, `title`, `author`, `genre`, `category`, `status`, `badge`, `cover`, `description`, `chapters_count`, `views`, `rating`, `updated_date`, `featured`, `continue_reading`, `is_audio`, `audio_available`, `audio_duration`, `audio_voice`, `youtube_url`, `trending_rank`, `sort_order`, `is_published`, `visibility`, `link`, `created_at`, `updated_at`) VALUES ('vizhigalil-vizhundha-kavithai', 'Vizhigalil Vizhundha Kavithai', 'Rudhra Prarthana', 'Romance / Poetry', 'Completed Novels', 'Completed', 'Completed', 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80', 'A poetic tale where silent glances speak louder than words, chronicling a pure and enduring romance.', 36, '220,150', '4.9', 'Completed Novel', 0, 0, 0, 0, NULL, NULL, NULL, 4, 4, 1, 'public', '#novel?id=vizhigalil-vizhundha-kavithai', '2026-10-18 10:55:10', '2026-10-18 10:55:10');

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `profiles`;
CREATE TABLE `profiles` (
  `user_id` int NOT NULL,
  `display_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name_ta` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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

INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (2, 'Rudhra Prarthana', 'ருத்ர பிரார்த்தனா', '/profile.png', 'Writing is my soul. Deeply grateful for the immense love of novel readers.', 'எழுத்தே என் உயிர். நாவல் வாசகர்களின் பேரன்பிற்கு என்றும் நன்றியுடன்.', 'Author', 'எழுத்தாளர்', 'Jan 2024', 5, 4, 1250);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (8, 'Harish', 'ஹரிஷ்', '/profile.png', 'Administrator and passionate reader of Rudhra Prarthana Novels.', 'நாவல் பிரியர் மற்றும் நிர்வாகி.', 'Admin', 'நிர்வாகி', 'Feb 2024', 8, 2, 420);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (9, 'member_1792303970', 'member_1792303970', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (10, 'member_1792304487', 'member_1792304487', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (11, 'reader_1792464274', 'reader_1792464274', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (12, 'reader_1792464395', 'reader_1792464395', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (13, 'reader_1792464634', 'reader_1792464634', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (14, 'Reader User 1792573464', 'Reader User 1792573464', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (15, 'Reader User 1792573543', 'Reader User 1792573543', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (16, 'Reader User 1792573616', 'Reader User 1792573616', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (17, 'Kavitha Reader', 'Kavitha Reader', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (18, 'reader_1792574222', 'reader_1792574222', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);
INSERT INTO `profiles` (`user_id`, `display_name`, `display_name_ta`, `avatar`, `bio`, `bio_ta`, `title`, `title_ta`, `joined_date`, `posts_count`, `topics_count`, `followers_count`) VALUES (19, 'reader_1792574592', 'reader_1792574592', NULL, '', '', 'Member', 'Member', 'Oct 2026', 0, 0, 0);

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
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (1, 'chapter', 'nenjam-marappadhillai:24', 8, '❤️', '2026-10-14 10:31:00');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (3, 'novel', 'nenjam-marappadhillai', 8, '👍', '2026-10-14 10:32:00');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (4, 'novel', 'kaadhal-konden-kanave', 8, '😍', '2026-10-13 19:05:00');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (6, 'chapter', 'nenjam-marappadhillai:24', 2, '❤️', '2026-10-21 14:19:18');
INSERT INTO `reactions` (`id`, `target_type`, `target_id`, `user_id`, `emoji`, `created_at`) VALUES (7, 'chapter', 'nenjam-marappadhillai:1', 16, '❤️', '2026-10-21 14:37:35');

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
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `reading_progress` (`id`, `user_id`, `novel_id`, `chapter_num`, `progress_percentage`, `last_read_at`) VALUES (1, 8, 'nenjam-marappadhillai', '24', 100, '2026-10-21 14:42:20');
INSERT INTO `reading_progress` (`id`, `user_id`, `novel_id`, `chapter_num`, `progress_percentage`, `last_read_at`) VALUES (2, 8, 'kaadhal-konden-kanave', '18', 100, '2026-10-18 10:55:10');
INSERT INTO `reading_progress` (`id`, `user_id`, `novel_id`, `chapter_num`, `progress_percentage`, `last_read_at`) VALUES (3, 2, 'nenjam-marappadhillai', '24', 100, '2026-10-21 14:19:23');
INSERT INTO `reading_progress` (`id`, `user_id`, `novel_id`, `chapter_num`, `progress_percentage`, `last_read_at`) VALUES (7, 16, 'nenjam-marappadhillai', '1', 100, '2026-10-21 14:37:37');

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

INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('015051e15eb079fd3ebaf885d0973ebdd1d32abd560cd278fb320210ddf71500', 2, '2026-11-19 02:46:01', '2026-10-20 08:16:01', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('35d9aba893b4b3bf05c6c0da3b0471cda2cfb91bebc4441c1a2c05a1cef70bc3', 2, '2026-11-17 06:12:50', '2026-10-18 11:42:50', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('3c657d06928b1d83cadd664e3a1f94170e912baf5c31a29badcc0e222d643ef6', 2, '2026-11-20 09:23:22', '2026-10-21 14:53:22', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('3faa63746f9b994fd8f5806b94546f9537c59a43b706082568b4c3581370de63', 16, '2026-11-20 09:06:58', '2026-10-21 14:36:58', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('4338d9fe8e1312789c71d82779584752925971a557247190e4e6de8913288d83', 17, '2026-11-20 09:15:49', '2026-10-21 14:45:49', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('495036262739ab76b78e8ce63dfdf4bcbf460616ce40ebb51193ee0d2c7ccd83', 2, '2026-11-20 08:26:21', '2026-10-21 13:56:21', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('4d41032f16e8fb06012032d8a69d8ea8c675df5c610b148a16e6a0a19227b590', 2, '2026-11-20 08:28:54', '2026-10-21 13:58:54', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('54a6e2e5306d6d154ecbf7bedc32103caac2d8c0987c52d2f043008cbda9f820', 14, '2026-11-20 09:04:26', '2026-10-21 14:34:26', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('572a409d2ba15b1274e2cce7940d5b64d99f07abc8f56d4c00cb6e136396ba0e', 11, '2026-11-19 02:44:43', '2026-10-20 08:14:43', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('5aa54f9b43279ebbae9b6969434fec2d709b5287f101e67f81918ad0f3e8f4f4', 2, '2026-11-17 06:21:22', '2026-10-18 11:51:22', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('76bb1299d9c55677cca723ed8ae2d080dd26df66dbfcbce43b4d75a297542e9a', 2, '2026-11-17 06:21:27', '2026-10-18 11:51:27', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('82cc32390c784329f05d5917475ee64ff14237d551829e8357fafc0679e82124', 2, '2026-11-19 02:50:45', '2026-10-20 08:20:45', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('8a37c3cf77bae1e682069ca06a9655b39ca3b84cd9da1f891566efa943cc82c1', 2, '2026-11-20 09:17:12', '2026-10-21 14:47:12', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('8bc5d69d88502a16ba029786df5ff8e21951c6efcec566ca6c294a119ca3c049', 2, '2026-11-19 02:44:45', '2026-10-20 08:14:45', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('94d021aadde5b0cfdcb5efea6035e6e3c0a5823c506adad1adc92311564b3a7f', 2, '2026-11-20 08:48:37', '2026-10-21 14:18:37', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('9a0e0e8d89cad92bd433cc94b310d3285041ab6dfdcd46959bbfeb58cd4379ef', 2, '2026-11-20 08:36:17', '2026-10-21 14:06:17', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('9b8c718048dba8c334e8cdb1d3ea0b87093715c570505e95e7fb1307f587a10c', 9, '2026-11-17 06:12:50', '2026-10-18 11:42:50', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('9f9e6690ccd357f382b2aa345225eb0ad9a25278149c2a5536ecf39ca218fe7a', 2, '2026-11-17 06:11:00', '2026-10-18 11:41:00', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('a59651b6920e43a9de562645dad53f2ef2e00c6f97c68cd2c742f150dd0029bd', 2, '2026-11-20 09:07:18', '2026-10-21 14:37:18', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('bdd48404c89ebf27ea998960478833fd46f0178e4c269774091111692a722f58', 2, '2026-11-20 08:39:32', '2026-10-21 14:09:32', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('be80d02eb535436f8497a17b671e1c4e8b27617fab57cd4936dcc694f0d15ff7', 2, '2026-11-20 09:06:05', '2026-10-21 14:36:05', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('da438091d083c7cfa350756bf217a3a1afeb5030a04bf29c1d1e9a7f52535400', 15, '2026-11-20 09:05:45', '2026-10-21 14:35:45', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('db25fc039e95bfdf8879275e84eab99ed6f0a6c797e98205b3ed9277b6f707e9', 11, '2026-11-19 02:44:37', '2026-10-20 08:14:37', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('dd20738ee0a0fc48b8f620892790056f360fb4d0b864349a625413d81aa2f679', 15, '2026-11-20 09:05:47', '2026-10-21 14:35:47', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('df45ca24d4f3c18a8f7007ba94eb1a4731a2e090257db4550d1a6a2c5fdaecc2', 10, '2026-11-17 06:21:27', '2026-10-18 11:51:27', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('e1ce5aa78ca484410d536f4c62674f14028635c8f38907f1e3315614df000704', 12, '2026-11-19 02:46:43', '2026-10-20 08:16:43', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('e9625ef105335ba289999654f190311efcdae51b7e27d19b0168b175f1289703', 2, '2026-11-19 02:46:45', '2026-10-20 08:16:45', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('eda32d119dba154e1b89ec4384778b48dc13a50813dccd4ef96e104b733c042f', 13, '2026-11-19 02:50:43', '2026-10-20 08:20:43', 'reader');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f3d6ca242465f3d8d7d3805556560a306c360cefe6291874741c821059c5469a', 2, '2026-11-20 09:06:12', '2026-10-21 14:36:12', 'author');
INSERT INTO `sessions` (`token`, `user_id`, `expires_at`, `created_at`, `session_type`) VALUES ('f47e53c3680403108454a543444946ea689884c3a92f8ea2f13ed81a3bc4ba98', 2, '2026-11-20 08:49:04', '2026-10-21 14:19:04', 'reader');

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
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_username` (`username`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (2, 'rudhra_author', 'rudhra@rpnovels.com', '86a12240413a04fdf68a8f6efb3df2d2caed73dfbf0e63ec12efa28c1a44a52ff2832e6570903dec821af9374544edbc9fc7c87092fac14e65ac77190978a8f5', 'b60edbcbf0109167cb4a6ea61afca0de', 'Admin', '2026-10-18 10:55:10', '2026-10-18 10:55:10');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (8, 'harish', 'harish89460@gmail.com', 'f1e812a4bc07b437c19dc866d2b6e4b66ae5baa216fbb74015dda1e2e12078e10cd2f06673ecd162e425b9d2eeac6fcfcb1a32fba603f472b5a140eda7c04326', 'e29af6f5d5d3abccdcb551381e726f27', 'Admin', '2026-10-18 10:55:10', '2026-10-18 10:55:10');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (9, 'member_1792303970', 'member_1792303970@test.com', '8237933cf7f3728c2b428494ac5c3bcfc7a9969d81cfecc877ebb39fa0c5242d97904ddced726ed3556c7434047a108f05e5bae5d445bc43d59a51bc58d7ee24', 'f86ab47ce8e7ff2dd2978c47821c7c69', 'Member', '2026-10-18 11:42:50', '2026-10-18 11:42:50');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (10, 'member_1792304487', 'member_1792304487@test.com', 'ce8d900cd71eac419fdd2567db62867b8160a624e81f5f55bedb692a4b6918545a4768ab012fc32a85f178922c015d85a3c63099f37f512571877aef2ce1423d', '6b925290e2ef3a837a2364d9fbe33c3a', 'Member', '2026-10-18 11:51:27', '2026-10-18 11:51:27');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (11, 'reader_1792464274', 'reader_1792464274@test.com', '0b1b8afba45b635a63b20de588f544ed1ecd77230db8bb5b635d830593b930050516fa8f78309d782f24a7bcfb851ae2b4d0fda4b2c03fd13da6d8360347e806', 'ba4c03b2d351343f223827d7f53b6ee3', 'Member', '2026-10-20 08:14:37', '2026-10-20 08:14:37');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (12, 'reader_1792464395', 'reader_1792464395@test.com', '2b34d21b5b0f5678216439ce282fdbc0f2a5900df781d8eb8def760ca1b96cee9d17d3a52016ba75f33d610cd6e6eecf5ec4a7790d428540bc325d64908b18a0', '2fcaba3cf852dd520bbee609aa4a0bee', 'Member', '2026-10-20 08:16:37', '2026-10-20 08:16:37');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (13, 'reader_1792464634', 'reader_1792464634@test.com', '64c867dc3378c2fec276bb8e87e1e192313baca4858e211aa8f0b5579e3a7ad2c3b53087428214e7a00884a4300fe1db2af964022e9062b0969c20a78d37db5f', '85413bca6efd59b769412669386acc5a', 'Member', '2026-10-20 08:20:36', '2026-10-20 08:20:36');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (14, 'reader_1792573464', 'reader_1792573464@testmail.com', 'e096d538de91fa0485bf698687ffebd1784bfa3d3b642bfe3edb7c1cbd215d3824296e2325b4b78d0f43a98f1ff9f61bf875e9f00c49b908c828a494d34ce823', 'da3e716037c39f079437594dbdc757ca', 'Member', '2026-10-21 14:34:26', '2026-10-21 14:34:26');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (15, 'reader_1792573543', 'reader_1792573543@testmail.com', '1f43b2bf67cf2af8576fc4b3035a691a1f0418d28b4eb6cc746e1959371261ab2fddf1c144cdd5af327467b2f1353fc66204b5888fc3d550cad81f2e1542311c', '47055c2ef9c51f35d057e77d13b2a7bd', 'Member', '2026-10-21 14:35:45', '2026-10-21 14:35:45');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (16, 'reader_1792573616', 'reader_1792573616@testmail.com', 'f435757642d21fbcceb2d497c70498a95359f0d4a4929c7dfe262805b4e8324aa6b9053b6c91093deeede3ed98058f617055f318979e3c430469dc9929331dd1', '1be4fbd96efca4bcfb91531b1bf7ece0', 'Member', '2026-10-21 14:36:58', '2026-10-21 14:36:58');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (17, 'kavitha_reader', 'kavitha@example.com', '90628bc2df3968d930719ae512f622dc2af28100cfb4af030c9a68e94850177585421174188c7249daacc0a721305f9591ceb803d0dc70bc1b88b3f7bf108fb0', '70a80309a59f2221dcddb55d369c3077', 'Member', '2026-10-21 14:45:49', '2026-10-21 14:45:49');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (18, 'reader_1792574222', 'reader_1792574222@test.com', '7672e74bd905fe19a66b30ac80514f6e37ea58769ec8debdad40bbcbef5428f182236f2bda119515fe0da3fa38348bb51a93b78636d14c823f64497c8fbee072', 'dd94f24946df86c24d91c93fc7b161c3', 'Member', '2026-10-21 14:47:04', '2026-10-21 14:47:04');
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `salt`, `role`, `created_at`, `updated_at`) VALUES (19, 'reader_1792574592', 'reader_1792574592@test.com', 'fc1cac887ef7edf1e7b205de0c2b6373f364ed28aaf72277c41167afb39747198d0a214e1261d1194452de21e170fb728694443e85644d890c43a35cc17a3de8', '91c913b60699d0127f05775270da8ad0', 'Member', '2026-10-21 14:53:14', '2026-10-21 14:53:14');

SET FOREIGN_KEY_CHECKS=1;
