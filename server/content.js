// Content Reading Access & WordPress Integration Architecture
// Manages reading availability for novels and chapters
// Guest reading restrictions removed for all text chapters (Novels, Episodes, Completed stories)
// Independent audio availability settings preserved

import { getDb } from './db.js';

/**
 * Retrieve novel chapter content with access evaluation
 * Architecture designed for future WordPress REST API / Admin Dashboard integration:
 * In a future WordPress setup, this function can effortlessly interface with:
 * - WP Custom Post Types ('novel', 'chapter')
 * - WP Post Meta ('_rp_access_level', '_rp_is_audio', '_rp_wp_post_id')
 * - WP Publication Status ('publish', 'draft', 'private')
 */
export function getChapterContent({ novelId, chNum, user }) {
  const db = getDb();
  const num = parseInt(chNum || '1', 10);
  const isAuthenticated = user && user.role !== 'Guest';

  const record = db.prepare(`
    SELECT is_guest_allowed, is_audio, title, title_ta, content
    FROM reading_access
    WHERE novel_id = ? AND chapter_num = ?;
  `).get(novelId, num);

  // 1. Audio Novel Protection: Preserve independent audio availability settings
  if (record && record.is_audio === 1) {
    if (!isAuthenticated) {
      return {
        allowed: false,
        restricted: true,
        isAudio: true,
        novelId,
        chapterNum: num,
        message: 'Please log in to listen to full audio novels.',
        messageTa: 'முழு ஒலி நாவல்களைக் கேட்க உள்நுழையவும்.',
        reason: 'audio_restricted_for_guest',
        redirectHash: `#reader?novel=${encodeURIComponent(novelId)}&ch=${num}`
      };
    }
  }

  // 2. Text Chapters & Episodes:
  // Guests can freely read all available novels, daily updates, previous episodes, and completed stories
  const defaultSampleStory = `காலை நேரத்து மெல்லிய குளிர் காற்று ஜன்னல் வழியே வீசிக் கொண்டிருக்க, வர்ஷினி கையில் காபி கோப்பையுடன் அமைதியாக நின்றிருந்தாள். மனதிற்குள் ஆயிரம் எண்ணங்கள் அலைமோதினாலும், முகத்தில் அமைதியை மட்டுமே காட்ட பழகியிருந்தாள்.\n\nஅவளது வாழ்க்கையின் மிக முக்கியமான திருப்புமுனை இன்றுதான் நிகழவிருக்கிறது என்பதை விதியின் திட்டம் உணர்த்தியிருக்கவில்லை. தூரத்தில் கேட்ட ரயிலின் சத்தம், அவளது பழைய நினைவுகளை மீட்டெடுத்தது.\n\n"வர்ஷினி... கிளம்பலையா?" என்ற அம்மாவின் பாசமான குரல் அவளை நிகழ்காலத்திற்கு இழுத்து வந்தது. ஒரு மெல்லிய புன்னகையுடன் அவள் தலையசைத்தாள். வாழ்க்கைப் பயணத்தின் அடுத்த அத்தியாயம் இப்போதுதான் தொடங்குகிறது.`;

  const content = record?.content || defaultSampleStory;
  const title = record?.title || `Chapter ${num}`;
  const titleTa = record?.title_ta || `அத்தியாயம் ${num}`;

  return {
    allowed: true,
    restricted: false,
    novelId,
    chapterNum: num,
    title,
    titleTa,
    content,
    isAudio: record?.is_audio === 1,
    isGuest: !isAuthenticated
  };
}

/**
 * Retrieve Audio Story Access
 * Preserves independent audio settings configured for members
 */
export function getAudioAccess({ audioId, user }) {
  const isAuthenticated = user && user.role !== 'Guest';

  if (isAuthenticated) {
    return {
      allowed: true,
      audioId,
      title: 'Maaya Nadhi Theeram (Full Audio Story)',
      titleTa: 'மாய நதி தீரம் (முழு ஒலி நாவல்)',
      duration: '4h 25m',
      audioUrl: 'https://www.youtube.com/@rudhraprarthanaaudionovels'
    };
  }

  return {
    allowed: false,
    restricted: true,
    audioId,
    message: 'Please log in to listen to full audio stories.',
    messageTa: 'முழு ஆடியோ கதைகளையும் கேட்க உள்நுழையவும்.',
    reason: 'audio_restricted_for_guest',
    redirectHash: `#audio?id=${encodeURIComponent(audioId || 'maaya-nadhi-theeram')}`
  };
}
