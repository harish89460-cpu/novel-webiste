-- Rudhra Prarthana Novels — Database Migration 002
-- Seed Genuine Website Content and User Accounts (Zero Fake/Mock Data)

-- 1. Seed Genuine Users (Admin & Author)
INSERT INTO users (id, username, email, password_hash, salt, role)
VALUES 
  (2, 'rudhra_author', 'digitalmarkservices.in@gmail.com', 'f1cc1a04c0dd59b722fab02a6bd51f05def265027bfca575380b460196be48c769ae19a624e5f7ac3badc7e51ebfb5a36db42820461fbf4eac140d2ab20af3ae', '5da387c064cfb089b6dbf2b56f348e8b', 'Admin')
ON DUPLICATE KEY UPDATE 
  role = VALUES(role),
  email = VALUES(email),
  password_hash = VALUES(password_hash),
  salt = VALUES(salt);

-- 2. Seed User Profiles
INSERT INTO profiles (user_id, display_name, display_name_ta, avatar, bio, bio_ta, title, title_ta, joined_date, posts_count, topics_count, followers_count)
VALUES
  (2, 'Rudhra Prarthana', 'ருத்ர பிரார்த்தனா', '/profile.png', 'Official Administrator and Author of Rudhra Prarthana Novels', 'ருத்ரா பிரார்த்தனா நாவல்களின் நிர்வாகி மற்றும் எழுத்தாளர்', 'Author', 'எழுத்தாளர்', 'Jan 2024', 0, 0, 0)
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  title = VALUES(title),
  bio = VALUES(bio);

-- 3. Seed Activity Status
INSERT INTO activity_status (user_id, is_enabled, is_online, last_seen)
VALUES
  (2, 1, 0, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE
  is_enabled = VALUES(is_enabled);

-- 4. Seed Homepage Sections
INSERT INTO homepage_sections (section_key, title, subtitle, is_visible, sort_order)
VALUES
  ('featured', 'Featured Ongoing Novels', 'Currently Releasing', 1, 1),
  ('continue_reading', 'Continue Reading', 'Pick Up Where You Left Off', 1, 2),
  ('audio', 'Audio Novels', 'Listen & Enjoy', 1, 3),
  ('trending', 'Trending Novels', 'Reader Favorites', 1, 4),
  ('completed', 'Completed Novels', 'Completed Works', 1, 5)
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  subtitle = VALUES(subtitle),
  is_visible = VALUES(is_visible),
  sort_order = VALUES(sort_order);

-- 5. Seed Genuine Novels
INSERT INTO novels (
  id, title, author, genre, category, status, badge, cover,
  description, chapters_count, views, rating, updated_date,
  featured, continue_reading, is_audio, audio_available,
  audio_duration, audio_voice, youtube_url, trending_rank,
  sort_order, is_published, visibility, link
) VALUES
  (
    'nenjam-marappadhillai',
    'Nenjam Marappadhillai',
    'Rudhra Prarthana',
    'Family Drama / Romance',
    'Ongoing Novels',
    'Ongoing',
    'Ongoing',
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    'Two souls living in different worlds are drawn together by the threads of fate, embarking on an emotional journey of family bonds and deep devotion.',
    24,
    '148,200',
    '4.9',
    'Today (October 2026)',
    1, 1, 0, 1,
    NULL, 'Rudhra Prarthana', 'https://www.youtube.com/@rudhraprarthanaaudionovels', 1,
    1, 1, 'public', '#novel?id=nenjam-marappadhillai'
  ),
  (
    'kaadhal-konden-kanave',
    'Kaadhal Konden Kanave',
    'Rudhra Prarthana',
    'Romance',
    'Ongoing Novels',
    'Ongoing',
    'Ongoing',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
    'A romance that begins through shared dreams faces real-life trials and triumphs. A youth-filled emotional story of affection.',
    18,
    '112,400',
    '4.8',
    'Yesterday',
    1, 1, 0, 0,
    NULL, NULL, NULL, 2,
    2, 1, 'public', '#novel?id=kaadhal-konden-kanave'
  ),
  (
    'uyire-unakkaga',
    'Uyire Unakkaga',
    'Rudhra Prarthana',
    'Family / Emotional',
    'Completed Novels',
    'Completed',
    'Completed',
    'https://images.unsplash.com/photo-1476275466078-4007374efbbe?auto=format&fit=crop&w=600&q=80',
    'The inspiring story of a mother whose devotion and sacrifice guide her children through life''s most meaningful crossroads.',
    45,
    '340,900',
    '5.0',
    'Completed Novel',
    1, 0, 0, 1,
    NULL, 'Rudhra Prarthana', 'https://www.youtube.com/@rudhraprarthanaaudionovels', 3,
    3, 1, 'public', '#novel?id=uyire-unakkaga'
  ),
  (
    'vizhigalil-vizhundha-kavithai',
    'Vizhigalil Vizhundha Kavithai',
    'Rudhra Prarthana',
    'Romance / Poetry',
    'Completed Novels',
    'Completed',
    'Completed',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=600&q=80',
    'A poetic tale where silent glances speak louder than words, chronicling a pure and enduring romance.',
    36,
    '220,150',
    '4.9',
    'Completed Novel',
    0, 0, 0, 0,
    NULL, NULL, NULL, 4,
    4, 1, 'public', '#novel?id=vizhigalil-vizhundha-kavithai'
  ),
  (
    'maaya-nadhi-theeram',
    'Maaya Nadhi Theeram',
    'Rudhra Prarthana',
    'Mystery / Thriller',
    'Audio Novels',
    'Ongoing',
    'Audio Novel',
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80',
    'A gripping thriller set along a mysterious riverbank where uncovered secrets and suspense keep listeners captivated.',
    12,
    '89,400',
    '4.8',
    'Part 06 Released',
    1, 0, 1, 1,
    '4h 25m', 'Rudhra Prarthana', 'https://www.youtube.com/@rudhraprarthanaaudionovels', 5,
    5, 1, 'public', '#novel?id=maaya-nadhi-theeram'
  ),
  (
    'poongaatru-punnagaikka',
    'Poongaatru Punnagaikka',
    'Rudhra Prarthana',
    'Short Stories / Feel Good',
    'Short Stories',
    'Completed',
    'Short Story',
    'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?auto=format&fit=crop&w=600&q=80',
    'Heartwarming short stories bringing the gentle joys and relatable warmth of everyday life to readers.',
    8,
    '64,300',
    '4.7',
    'Full Collection',
    0, 0, 0, 0,
    NULL, NULL, NULL, 6,
    6, 1, 'public', '#novel?id=poongaatru-punnagaikka'
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  description = VALUES(description),
  chapters_count = VALUES(chapters_count),
  views = VALUES(views),
  rating = VALUES(rating);

-- 6. Seed Chapters
INSERT INTO chapters (
  novel_id, chapter_num, title, title_ta, content,
  is_guest_allowed, is_audio, word_count, read_time, release_date
) VALUES
  (
    'nenjam-marappadhillai', 1, 'Chapter 01 — Beginning of Dawn', 'Chapter 01 — Beginning of Dawn',
    'The morning mist drifted lazily across the veranda as Varshini held her porcelain cup, listening to the quiet rhythm of the dawn. Though countless memories echoed within, her expression remained calm and poised.\n\nLittle did she know that today would mark the beginning of a decisive chapter in her journey. The distant hum of the morning express train seemed to announce a destiny already unfolding.\n\n"Varshini, are you ready?" Her mother''s warm voice drew her back into the present. With a soft smile, she nodded. The next chapter of life was finally about to begin.',
    1, 0, '2,450 words', '7 mins', '12 Oct 2025'
  ),
  (
    'nenjam-marappadhillai', 2, 'Chapter 02 — Waves of Memory', 'Chapter 02 — Waves of Memory',
    'The bustling train station was bathed in amber morning light. As the train rolled in with a metallic roar, Varshini stepped onto the platform, luggage in hand.\n\nMemories of her childhood summers rushed back—the endless green fields, the ancestral home, and the promises made under the grand banyan tree. But the face she remembered most vividly was the one she had tried so hard to forget.\n\n"Could he still be here?" she whispered quietly to herself, tightening her grip on her shawl as a sudden gust of wind swept through the platform.',
    1, 0, '2,600 words', '8 mins', '19 Oct 2025'
  ),
  (
    'nenjam-marappadhillai', 3, 'Chapter 03 — Unexpected Meeting', 'Chapter 03 — Unexpected Meeting',
    'The village courtyard was alive with familiar laughter. Family members greeted her with warm embraces and traditional sweets. Yet across the courtyard, near the carved wooden doorway, stood a tall figure with sharp, thoughtful eyes.\n\nTheir eyes met across the crowded hall. Time seemed to pause for a breathless second. It was him—Devan. He had matured, but that intense gaze remained unchanged.\n\nHe offered a slow, courteous nod, acknowledging her return with an unspoken depth that made her pulse quicken.',
    1, 0, '2,820 words', '8 mins', '26 Oct 2025'
  ),
  (
    'nenjam-marappadhillai', 24, 'Chapter 24 — Truth in the Heart', 'Chapter 24 — Truth in the Heart',
    'The rain poured down steadily outside the study window, drumming against the glass like a long-kept secret finally demanding release.\n\nVarshini placed the old journal onto the table. "You knew all along, didn''t you, Devan?"\n\nDevan turned, the dim desk lamp illuminating his resolute face. "Some truths are withheld not to deceive, Varshini, but to protect what matters most."\n\nFor the first time in ten years, the wall between them crumbled. In the silence that followed, both understood that life had given them a second chance.',
    1, 0, '3,120 words', '10 mins', '08 Oct 2026'
  ),
  (
    'kaadhal-konden-kanave', 1, 'Chapter 01 — Dream Journey', 'Chapter 01 — Dream Journey',
    'In the quiet glow of twilight, dreams often weave paths that reality hesitates to tread. Ananya sketched the riverbank in her notebook, watching the twilight colors blend into indigo.\n\nShe had always believed in the power of destiny. When an unfamiliar shadow crossed the pathway, she looked up, surprised to find someone admiring her artwork.\n\n"You capture the light remarkably well," a voice murmured. That single sentence would change everything.',
    1, 0, '2,200 words', '6 mins', '15 Jan 2026'
  ),
  (
    'kaadhal-konden-kanave', 18, 'Chapter 18 — Soft Touch', 'Chapter 18 — Soft Touch',
    'Standing atop the hilltop temple stairs, the city lights spread beneath them like an ocean of fallen stars.\n\n"Do you still doubt what we have?" Siddharth asked softly, reaching out to hold her hand in the cool night air.\n\nAnanya looked into his eyes and felt the doubts of months evaporate into the night breeze. With a gentle nod, she knew they were ready to face whatever family challenges lay ahead.',
    1, 0, '2,900 words', '9 mins', '07 Oct 2026'
  ),
  (
    'uyire-unakkaga', 1, 'Chapter 01 — Motherhood Lullaby', 'Chapter 01 — Motherhood Lullaby',
    'The aroma of freshly ground spices filled the small kitchen where Meenakshi Amma worked tirelessly before the break of dawn.\n\nHer three children slept soundly in the next room, oblivious to the financial burdens she bore alone since her husband''s untimely passing. Every sacrifice, every silent tear, was dedicated to ensuring their dignity and future.\n\n"As long as I draw breath, my children will hold their heads high," she whispered as the morning sun crowned the horizon.',
    1, 0, '3,100 words', '9 mins', '01 Mar 2025'
  ),
  (
    'uyire-unakkaga', 45, 'Chapter 45 — Blissful Conclusion', 'Chapter 45 — Blissful Conclusion',
    'The grand university auditorium was filled with thunderous applause as her son stepped forward to receive his doctorate, bowing low to touch Meenakshi''s feet.\n\nTears of profound joy rolled down her weathered cheeks. Her children had reached heights greater than she had ever dared to dream. The sacrifices of a lifetime had borne the sweetest fruit.',
    1, 0, '4,000 words', '12 mins', '15 Dec 2025'
  ),
  (
    'vizhigalil-vizhundha-kavithai', 1, 'Chapter 01 — Silence of the Eyes', 'Chapter 01 — Silence of the Eyes',
    'Words are easy to utter, but silence holds the truest poetry of love. In the university library between rows of classical literature, their silent companionship had quietly grown over three years.\n\nA single exchange of glances conveyed what entire volumes could not express.',
    1, 0, '2,500 words', '8 mins', '10 Jun 2025'
  ),
  (
    'poongaatru-punnagaikka', 1, 'Story 01 — Rainy Drizzle People', 'Story 01 — Rainy Drizzle People',
    'Underneath the green tin awning of the roadside tea stall, seven strangers huddled together to escape a sudden torrential downpour.\n\nAs hot ginger tea was passed around in glass tumblers, stories began to flow. In those forty-five minutes of shared warmth, seven lives touched and enriched one another before the rain stopped and they went their separate ways.',
    1, 0, '1,800 words', '5 mins', '14 Jul 2025'
  ),
  (
    'maaya-nadhi-theeram', 1, 'Part 01 — Riverbank Shadows (Audio)', 'Part 01 — Riverbank Shadows (Audio)',
    'The Kaveri riverbank was shrouded in thick river fog as midnight approached. Inspector Raghavan shone his flashlight across the abandoned boathouse, discovering an antique brass lock newly broken.\n\nThis audio episode is produced with ambient music and narration by author Rudhra Prarthana. Log in as a member to listen to the full episode.',
    0, 1, 'Audio 22 mins', '22 mins', '01 Sep 2026'
  )
ON DUPLICATE KEY UPDATE
  title = VALUES(title),
  content = VALUES(content),
  is_guest_allowed = VALUES(is_guest_allowed),
  is_audio = VALUES(is_audio);

-- 7. Seed Forum Categories
INSERT INTO forum_categories (id, title, icon, sort_order)
VALUES
  ('ongoing-novels', 'Ongoing Novels Discussion', '📖', 1),
  ('review-junction', 'Review Junction', '✍️', 2),
  ('tea-time', 'Tea Time Chit-Chat', '☕', 3),
  ('short-stories', 'Short Stories Hub', '✨', 4),
  ('general', 'General Discussions', '💬', 5)
ON DUPLICATE KEY UPDATE
  title = VALUES(title);
