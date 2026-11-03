const { query, queryOne } = require('../backend/db');

async function seedSubcategories() {
  console.log('--- Ensuring Category Titles Exist Across All Sections ---');

  const subcategoriesToEnsure = [
    // 1. Ongoing Novels
    {
      id: 'ongoing-novels-discussion',
      main_category_id: 'ongoing-novels',
      title: 'Ongoing Novels Discussions & Updates',
      description: 'Official discussions, reader theories, and latest chapter updates for ongoing novel series.',
      icon: '📖',
      novel_id: null,
      sort_order: 1
    },
    {
      id: 'rudhra-ongoing-releases',
      main_category_id: 'ongoing-novels',
      title: 'Rudhra Ongoing Releases & Feedback',
      description: 'Dedicated discussion threads and reader reviews for author releases in progress.',
      icon: '🌟',
      novel_id: null,
      sort_order: 2
    },
    {
      id: 'hello-ongoing',
      main_category_id: 'ongoing-novels',
      title: 'Hello — Episodes & Discussion',
      description: 'Episodes and reader discussions for the novel series "Hello".',
      icon: '✨',
      novel_id: 'hello',
      sort_order: 3
    },
    {
      id: 'kathais-surukkam-ongoing',
      main_category_id: 'ongoing-novels',
      title: 'கதைச் சுருக்கம்: — Episodes & Discussion',
      description: 'Episodes and reader discussions for the novel series "கதைச் சுருக்கம்:".',
      icon: '🌺',
      novel_id: 'kathais-surukkam',
      sort_order: 4
    },
    {
      id: 'kavitha-literary-discussions',
      main_category_id: 'ongoing-novels',
      title: 'Kavitha Literary Novel — Episodes & Discussion',
      description: 'Episodes and discussions for Kavitha Literary Novel series.',
      icon: '✍️',
      novel_id: 'kavitha-literary-novel-87261',
      sort_order: 5
    },

    // 2. Completed Novels
    {
      id: 'completed-novels-archive',
      main_category_id: 'completed-novels',
      title: 'Completed Novels Archive & Discussions',
      description: 'Complete family sagas and romance stories available for full uninterrupted reading.',
      icon: '📚',
      novel_id: null,
      sort_order: 1
    },
    {
      id: 'rudhra-completed-classics',
      main_category_id: 'completed-novels',
      title: 'Rudhra Completed Classics & Reviews',
      description: 'In-depth reviews and discussions of completed masterworks by Rudhra Prarthana.',
      icon: '🏆',
      novel_id: null,
      sort_order: 2
    },

    // 3. Short Stories
    {
      id: 'short-stories-collection',
      main_category_id: 'short-stories',
      title: 'Short Stories & Standalone Releases',
      description: 'Complete one-sitting literary stories, emotional vignettes, and standalone pieces.',
      icon: '🪶',
      novel_id: null,
      sort_order: 1
    },
    {
      id: 'literary-short-fiction',
      main_category_id: 'short-stories',
      title: 'Literary Short Fiction & Reviews',
      description: 'Reader thoughts, analysis, and discussions on contemporary short stories.',
      icon: '✍️',
      novel_id: null,
      sort_order: 2
    },

    // 4. Audio Novels
    {
      id: 'audio-novels-releases',
      main_category_id: 'audio-novels',
      title: 'Audio Novels & Voice Releases',
      description: 'Listen to narrated novel releases, dramatic voice adaptations, and audio episodes.',
      icon: '🎙️',
      novel_id: null,
      sort_order: 1
    },
    {
      id: 'audio-episodes-discussion',
      main_category_id: 'audio-novels',
      title: 'Audio Episodes & Listener Discussions',
      description: 'Listener reactions, audio episode discussions, and voice feedback.',
      icon: '🎧',
      novel_id: null,
      sort_order: 2
    },

    // 5. Tamil Novels
    {
      id: 'tamil-novels-discussions',
      main_category_id: 'tamil-novels',
      title: 'தமிழ் நாவல்கள் கலந்துரையாடல்',
      description: 'தமிழ் நாவல்கள், புதிய அத்தியாயங்கள் மற்றும் வாசகர்களின் கருத்துப் பகிர்வுகள்.',
      icon: '🌺',
      novel_id: null,
      sort_order: 1
    },
    {
      id: 'tamil-literary-releases',
      main_category_id: 'tamil-novels',
      title: 'தமிழ் இலக்கியப் படைப்புகள்',
      description: 'சிறப்பு அத்தியாயங்கள், சிறுகதைகள் மற்றும் இலக்கிய உரையாடல்கள்.',
      icon: '📜',
      novel_id: null,
      sort_order: 2
    }
  ];

  for (const s of subcategoriesToEnsure) {
    const existing = await queryOne(`SELECT id FROM content_subcategories WHERE id = ?;`, [s.id]);
    if (!existing) {
      await query(`
        INSERT INTO content_subcategories (
          id, main_category_id, title, description, icon, novel_id, sort_order,
          status, is_active, is_disabled, visibility, access_permission, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'published', 1, 0, 'public', 'all_members', NOW(), NOW());
      `, [s.id, s.main_category_id, s.title, s.description, s.icon, s.novel_id, s.sort_order]);
      console.log(`+ Added category title: "${s.title}" (${s.id}) under [${s.main_category_id}]`);
    } else {
      console.log(`= Already exists: "${s.title}" (${s.id})`);
    }
  }

  console.log('✓ All category titles verified and ready!');
}

seedSubcategories().then(() => process.exit(0)).catch(err => {
  console.error('Error seeding subcategories:', err);
  process.exit(1);
});

