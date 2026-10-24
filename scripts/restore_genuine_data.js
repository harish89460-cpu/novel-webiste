import { getDb } from '../backend/db.js';

async function restore() {
  const db = getDb();

  // 1. Insert nenjam-marappadhillai into novels
  await db.query(`
    INSERT INTO novels (
      id, title, author, genre, category, status, badge, cover,
      description, chapters_count, views, rating, updated_date,
      featured, continue_reading, is_audio, audio_available,
      audio_duration, audio_voice, youtube_url, trending_rank,
      sort_order, is_published, visibility, link
    ) VALUES (
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
    ) ON DUPLICATE KEY UPDATE title = VALUES(title)
  `);

  // 2. Insert vizhigalil-vizhundha-kavithai into novels
  await db.query(`
    INSERT INTO novels (
      id, title, author, genre, category, status, badge, cover,
      description, chapters_count, views, rating, updated_date,
      featured, continue_reading, is_audio, audio_available,
      audio_duration, audio_voice, youtube_url, trending_rank,
      sort_order, is_published, visibility, link
    ) VALUES (
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
    ) ON DUPLICATE KEY UPDATE title = VALUES(title)
  `);

  // 3. Insert chapters for nenjam-marappadhillai
  await db.query(`
    INSERT INTO chapters (
      novel_id, chapter_num, title, title_ta, content,
      is_guest_allowed, is_audio, word_count, read_time, release_date
    ) VALUES
    (
      'nenjam-marappadhillai', 1, 'Chapter 01 — Beginning of Dawn', 'Chapter 01 — Beginning of Dawn',
      'The morning mist drifted lazily across the veranda as Varshini held her porcelain cup, listening to the quiet rhythm of the dawn. Though countless memories echoed within, her expression remained calm and poised.\\n\\nLittle did she know that today would mark the beginning of a decisive chapter in her journey. The distant hum of the morning express train seemed to announce a destiny already unfolding.\\n\\n\"Varshini, are you ready?\" Her mother\\'s warm voice drew her back into the present. With a soft smile, she nodded. The next chapter of life was finally about to begin.',
      1, 0, '2,450 words', '7 mins', '12 Oct 2025'
    ),
    (
      'nenjam-marappadhillai', 2, 'Chapter 02 — Waves of Memory', 'Chapter 02 — Waves of Memory',
      'The bustling train station was bathed in amber morning light. As the train rolled in with a metallic roar, Varshini stepped onto the platform, luggage in hand.\\n\\nMemories of her childhood summers rushed back—the endless green fields, the ancestral home, and the promises made under the grand banyan tree. But the face she remembered most vividly was the one she had tried so hard to forget.\\n\\n\"Could he still be here?\" she whispered quietly to herself, tightening her grip on her shawl as a sudden gust of wind swept through the platform.',
      1, 0, '2,600 words', '8 mins', '19 Oct 2025'
    ),
    (
      'nenjam-marappadhillai', 3, 'Chapter 03 — Unexpected Meeting', 'Chapter 03 — Unexpected Meeting',
      'The village courtyard was alive with familiar laughter. Family members greeted her with warm embraces and traditional sweets. Yet across the courtyard, near the carved wooden doorway, stood a tall figure with sharp, thoughtful eyes.\\n\\nTheir eyes met across the crowded hall. Time seemed to pause for a breathless second. It was him—Devan. He had matured, but that intense gaze remained unchanged.\\n\\nHe offered a slow, courteous nod, acknowledging her return with an unspoken depth that made her pulse quicken.',
      1, 0, '2,820 words', '8 mins', '26 Oct 2025'
    ),
    (
      'nenjam-marappadhillai', 24, 'Chapter 24 — Truth in the Heart', 'Chapter 24 — Truth in the Heart',
      'The rain poured down steadily outside the study window, drumming against the glass like a long-kept secret finally demanding release.\\n\\nVarshini placed the old journal onto the table. \"You knew all along, didn\\'t you, Devan?\"\\n\\nDevan turned, the dim desk lamp illuminating his resolute face. \"Some truths are withheld not to deceive, Varshini, but to protect what matters most.\"\\n\\nFor the first time in ten years, the wall between them crumbled. In the silence that followed, both understood that life had given them a second chance.',
      1, 0, '3,120 words', '10 mins', '08 Oct 2026'
    )
    ON DUPLICATE KEY UPDATE title = VALUES(title)
  `);

  // 4. Insert genuine comments for nenjam-marappadhillai if not already present
  const [existing] = await db.query('SELECT COUNT(*) as cnt FROM comments WHERE novel_id = ?', ['nenjam-marappadhillai']);
  if (existing[0].cnt === 0) {
    const [c1] = await db.query(
      'INSERT INTO comments (novel_id, chapter_num, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['nenjam-marappadhillai', '24', 28, 'What an incredible chapter! The emotional confrontation between Devan and Varshini was written with such mastery.', '2026-10-14 10:30:00', '2026-10-14 10:30:00']
    );

    await db.query(
      'INSERT INTO comments (novel_id, chapter_num, user_id, parent_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['nenjam-marappadhillai', '24', 2, c1.insertId, 'Thank you so much Harish! More exciting moments are in store for the upcoming chapters.', '2026-10-14 10:40:00', '2026-10-14 10:40:00']
    );

    await db.query(
      'INSERT INTO comments (novel_id, chapter_num, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['nenjam-marappadhillai', '1', 28, 'Re-reading chapter 1 brings back all the nostalgic charm of how this wonderful story began.', '2026-10-15 12:00:00', '2026-10-15 12:00:00']
    );

    const [cNovel] = await db.query(
      'INSERT INTO comments (novel_id, chapter_num, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['nenjam-marappadhillai', '0', 28, 'Two souls living in different worlds drawn together by the threads of fate. One of the best family drama novels!', '2026-10-15 14:00:00', '2026-10-15 14:00:00']
    );

    await db.query(
      'INSERT INTO comments (novel_id, chapter_num, user_id, parent_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['nenjam-marappadhillai', '0', 2, cNovel.insertId, 'Thank you Harish! Devan and Varshini’s journey has so much more emotion to unfold.', '2026-10-15 14:30:00', '2026-10-15 14:30:00']
    );
    console.log('Inserted genuine comments for nenjam-marappadhillai');
  }

  // 5. Hide the test forum topic by setting is_published = 0 (preserving the record)
  await db.query('UPDATE forum_topics SET is_published = 0 WHERE id = ?', ['topic-discussion-on-story-pacing-3295-3306']);
  console.log('Test topic preserved with is_published = 0');

  console.log('Restoration complete!');
  process.exit(0);
}

restore().catch(err => {
  console.error('Error during restore:', err);
  process.exit(1);
});
