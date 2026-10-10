// SQLite Database Layer for Rudhra Prarthana Novels
// Uses Node 24 native node:sqlite DatabaseSync and node:crypto

import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, '../database.sqlite');

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initDatabase(dbInstance);
  }
  return dbInstance;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(derived, 'hex'));
  } catch {
    return false;
  }
}

function initDatabase(db) {
  // 1. Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'Registered Member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. User Profiles Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY,
      display_name TEXT NOT NULL,
      display_name_ta TEXT,
      avatar TEXT,
      bio TEXT,
      bio_ta TEXT,
      title TEXT,
      title_ta TEXT,
      joined_date TEXT,
      posts_count INTEGER DEFAULT 0,
      topics_count INTEGER DEFAULT 0,
      followers_count INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 3. User Activity Status Table (Enabled by default)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_status (
      user_id INTEGER PRIMARY KEY,
      is_enabled INTEGER DEFAULT 1,
      is_online INTEGER DEFAULT 0,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 4. Authenticated Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 5. Reading Access & Content Rules Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id TEXT NOT NULL,
      chapter_num INTEGER NOT NULL,
      is_guest_allowed INTEGER DEFAULT 0,
      is_audio INTEGER DEFAULT 0,
      title TEXT,
      title_ta TEXT,
      content TEXT,
      UNIQUE(novel_id, chapter_num)
    );
  `);

  // 6. Password Reset OTPs Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email TEXT NOT NULL COLLATE NOCASE,
      otp_hash TEXT NOT NULL,
      otp_salt TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 5,
      expires_at DATETIME NOT NULL,
      resend_after DATETIME NOT NULL,
      reset_token TEXT,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 7. Novel & Chapter Comments Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      novel_id TEXT NOT NULL,
      chapter_num INTEGER DEFAULT 0,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // 8. Content & Comment Reactions Table (Prevents duplicates per user)
  db.exec(`
    CREATE TABLE IF NOT EXISTS reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(target_type, target_id, user_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Migration: Ensure all text chapters have guest reading allowed (Audio availability preserved)
  try {
    db.exec(`UPDATE reading_access SET is_guest_allowed = 1 WHERE is_audio = 0;`);
  } catch (err) {
    console.warn('Reading access update warning:', err);
  }

  // Future WordPress Integration Columns (Non-breaking additive columns)
  try {
    db.exec(`ALTER TABLE reading_access ADD COLUMN status TEXT DEFAULT 'published';`);
  } catch {}
  try {
    db.exec(`ALTER TABLE reading_access ADD COLUMN access_level TEXT DEFAULT 'public';`);
  } catch {}
  try {
    db.exec(`ALTER TABLE reading_access ADD COLUMN wp_post_id INTEGER;`);
  } catch {}

  // Seed default data if empty
  seedDefaultData(db);
}

function seedDefaultData(db) {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users;').get().count;
  if (userCount === 0) {
    const defaultPassword = 'Password123!';
    const { hash, salt } = hashPassword(defaultPassword);

    const insertUser = db.prepare(`
      INSERT INTO users (username, email, password_hash, salt, role)
      VALUES (?, ?, ?, ?, ?);
    `);

    const insertProfile = db.prepare(`
      INSERT INTO profiles (user_id, display_name, display_name_ta, avatar, bio, bio_ta, title, title_ta, joined_date, posts_count, topics_count, followers_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `);

    const insertActivity = db.prepare(`
      INSERT INTO activity_status (user_id, is_enabled, is_online, last_seen)
      VALUES (?, ?, ?, ?);
    `);

    const seedUsers = [
      {
        username: 'rudhra_author',
        email: 'rudhra@rpnovels.com',
        role: 'Author',
        displayName: 'Rudhra Prarthana',
        displayNameTa: 'ருத்ரா பிரார்த்தனா',
        avatar: null,
        title: 'Lead Author & Founder',
        titleTa: 'தள நிறுவனர் & நாவலாசிரியர்',
        joined: 'Jan 2024',
        posts: 0,
        topics: 0,
        followers: 0,
        bio: 'Writing is my soul. Deeply grateful for the immense love of Tamil novel readers.',
        bioTa: 'எழுத்தே எனது சுவாசம். தமிழ் நாவல் வாசகர்களின் பேரன்பிற்கு தலைவணங்குகிறேன்.',
        isEnabled: 1,
        isOnline: 0,
        lastSeen: null
      }
    ];

    for (const u of seedUsers) {
      const res = insertUser.run(u.username, u.email, hash, salt, u.role);
      const userId = Number(res.lastInsertRowid);
      insertProfile.run(
        userId, u.displayName, u.displayNameTa, u.avatar,
        u.bio, u.bioTa, u.title, u.titleTa, u.joined,
        u.posts, u.topics, u.followers
      );
      insertActivity.run(userId, u.isEnabled, u.isOnline, u.lastSeen);
    }
  }

  // Seed reading access rules
  const accessCount = db.prepare('SELECT COUNT(*) as count FROM reading_access;').get().count;
  if (accessCount === 0) {
    const insertAccess = db.prepare(`
      INSERT INTO reading_access (novel_id, chapter_num, is_guest_allowed, is_audio, title, title_ta, content)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `);

    const sampleStoryText = `காலை நேரத்து மெல்லிய குளிர் காற்று ஜன்னல் வழியே வீசிக் கொண்டிருக்க, வர்ஷினி கையில் காபி கோப்பையுடன் அமைதியாக நின்றிருந்தாள். மனதிற்குள் ஆயிரம் எண்ணங்கள் அலைமோதினாலும், முகத்தில் அமைதியை மட்டுமே காட்ட பழகியிருந்தாள்.\n\nஅவளது வாழ்க்கையின் மிக முக்கியமான திருப்புமுனை இன்றுதான் நிகழவிருக்கிறது என்பதை விதியின் திட்டம் உணர்த்தியிருக்கவில்லை. தூரத்தில் கேட்ட ரயிலின் சத்தம், அவளது பழைய நினைவுகளை மீட்டெடுத்தது.\n\n"வர்ஷினி... கிளம்பலையா?" என்ற அம்மாவின் பாசமான குரல் அவளை நிகழ்காலத்திற்கு இழுத்து வந்தது. ஒரு மெல்லிய புன்னகையுடன் அவள் தலையசைத்தாள். வாழ்க்கைப் பயணத்தின் அடுத்த அத்தியாயம் இப்போதுதான் தொடங்குகிறது.`;

    const accessRules = [
      // 1. Nenjam Marappadhillai (Ongoing) -> Open for all readers
      { novel: 'nenjam-marappadhillai', ch: 1, guest: 1, audio: 0, title: 'Chapter 01 — Beginning of Dawn', titleTa: 'அத்தியாயம் 01 — விடியலின் தொடக்கம்', content: sampleStoryText },
      { novel: 'nenjam-marappadhillai', ch: 2, guest: 1, audio: 0, title: 'Chapter 02 — Waves of Memory', titleTa: 'அத்தியாயம் 02 — நினைவுகளின் அலைகள்', content: sampleStoryText },
      { novel: 'nenjam-marappadhillai', ch: 3, guest: 1, audio: 0, title: 'Chapter 03 — Unexpected Meeting', titleTa: 'அத்தியாயம் 03 — எதிர்பாராத சந்திப்பு', content: sampleStoryText },
      { novel: 'nenjam-marappadhillai', ch: 24, guest: 1, audio: 0, title: 'Chapter 24 — Truth in the Heart', titleTa: 'அத்தியாயம் 24 — நெஞ்சத்தில் உறைந்த உண்மை', content: sampleStoryText },

      // 2. Kaadhal Konden Kanave (Ongoing) -> Open for all readers
      { novel: 'kaadhal-konden-kanave', ch: 1, guest: 1, audio: 0, title: 'Chapter 01 — Dream Journey', titleTa: 'அத்தியாயம் 01 — கனவுப் பயணம்', content: sampleStoryText },
      { novel: 'kaadhal-konden-kanave', ch: 18, guest: 1, audio: 0, title: 'Chapter 18 — Soft Touch', titleTa: 'அத்தியாயம் 18 — மெல்லிய தீண்டல்', content: sampleStoryText },

      // 3. Uyire Unakkaga (Completed Novel) -> Open for all readers
      { novel: 'uyire-unakkaga', ch: 1, guest: 1, audio: 0, title: 'Chapter 01 — Motherhood Lullaby', titleTa: 'அத்தியாயம் 01 — தாய்மை தாலாட்டு', content: sampleStoryText },
      { novel: 'uyire-unakkaga', ch: 45, guest: 1, audio: 0, title: 'Chapter 45 — Blissful Conclusion', titleTa: 'அத்தியாயம் 45 — நிறைவு சுபம்', content: sampleStoryText },

      // 4. Vizhigalil Vizhundha Kavithai (Completed Novel) -> Open for all readers
      { novel: 'vizhigalil-vizhundha-kavithai', ch: 1, guest: 1, audio: 0, title: 'Chapter 01 — Silence of the Eyes', titleTa: 'அத்தியாயம் 01 — விழிகளின் மௌனம்', content: sampleStoryText },

      // 5. Poongaatru Punnagaikka (Complete Short Story) -> Open for all readers
      { novel: 'poongaatru-punnagaikka', ch: 1, guest: 1, audio: 0, title: 'Story 01 — Rainy Drizzle People', titleTa: 'கதை 01 — மழைச்சாரல் மனிதர்கள்', content: sampleStoryText },

      // 6. Maaya Nadhi Theeram (Full Audio Novel) -> Preserves independent audio settings
      { novel: 'maaya-nadhi-theeram', ch: 1, guest: 0, audio: 1, title: 'Part 01 — Riverbank Shadows (Audio)', titleTa: 'பாகம் 01 — நதிக்கரை நிழல்கள் (ஒலி நாவல்)', content: 'Audio stream content reserved for members.' }
    ];

    for (const r of accessRules) {
      insertAccess.run(r.novel, r.ch, r.guest, r.audio, r.title, r.titleTa, r.content);
    }
  }
}
