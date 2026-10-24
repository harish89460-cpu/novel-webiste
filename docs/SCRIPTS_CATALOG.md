# Comprehensive Analysis & Catalog: `scripts/` Directory
## Rudhra Prarthana Novels — Automation, Verification & Maintenance Suite

This document provides a complete, in-depth architectural and operational analysis of the active **49 test, verification, audit, and utility scripts** located in the `scripts/` directory.

---

## 1. Overview & Directory Purpose

The `scripts/` directory is an automated engineering harness for the Rudhra Prarthana Novels platform. It provides:
1. **Database Lifecycle & Integrity**: Point-in-time backups, schema migration verifications, and data sanitization.
2. **Security & Cryptography Audits**: Role-based access control (RBAC), session tokens, PBKDF2/scrypt salting, and automated SMTP OTP password recovery.
3. **End-to-End Functional Verification**: Novel publishing, transliteration/slug generation, rich chapter reading, audio novels, nested comment hierarchies, and community forums.
4. **Visual & Responsive Testing**: Automated multi-viewport verification (mobile 360px–430px, tablet, and desktop) and screen captures.

All scripts interact directly with either the Node.js backend (`backend/`), the live MySQL database (`rp_novels_db`), or the frontend via headless browser automation.

---

## 2. Script Taxonomy & Categorization

The active 49 scripts are organized into **10 functional categories**:

| Category | Description | Count |
|---|---|---|
| **1. Database Backups, Migrations & Schema Audits** | Schema inspection, DDL checks, and point-in-time backups | 6 |
| **2. Data Cleanup & Sanitization** | Mock/test data purging and genuine author/reader restoration | 5 |
| **3. Authentication, Security & OTP** | Author authentication, RBAC, session isolation, and SMTP OTP | 4 |
| **4. Novels, Episodes & Media Management** | Novel CRUD, Tamil auto-slug generation, cover uploads, and asset browser | 6 |
| **5. Comments, Nested Replies & Rich Editor** | Comment hierarchies, HTML sanitization, toolbar actions, and mentions | 4 |
| **6. Community Forum & Discussion Workflows** | Forum categories, topic creation, replies, views, and stats queries | 6 |
| **7. Audio Novels & Streaming** | Audio uploads, duration formatting, and YouTube streaming integration | 1 |
| **8. Writer Program & Editorial Dashboards** | Writer applications, editorial review, draft submissions, and audits | 4 |
| **9. User Presence & Notifications** | Heartbeat polling, online status badges, and Web Push / VAPID delivery | 3 |
| **10. System Health, Responsive & E2E Audits** | Holistic end-to-end regression suites and multi-device screenshot captures | 10 |

---

## 3. In-Depth Script Catalog

---

### Category 1: Database Backups, Migrations & Schema Audits

#### 1.1 `scripts/backup_db.py`
- **Language**: Python (`mysql.connector` / `pymysql`)
- **Purpose**: Connects to the MySQL instance using `.env` credentials and dumps all base tables into structured JSON or SQL files in the `backups/` directory.
- **Target Tables**: All 26 tables in `rp_novels_db`.
- **Side Effects**: Creates timestamped backup files.
- **Execution**: `python scripts/backup_db.py`

#### 1.2 `scripts/create_full_backup.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Programmatically exports complete table snapshots as a formatted JSON document. Records column structures, data lengths, and total row counts.
- **Target Tables**: Entire active database schema.
- **Execution**: `node scripts/create_full_backup.js`

#### 1.3 `scripts/create_audit_backup.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Creates a focused backup specifically of user-generated content: novels, episodes, forum topics, forum replies, comments, and registered users.
- **Target Tables**: `novels`, `chapters`, `comments`, `forum_topics`, `forum_replies`, `users`.
- **Execution**: `node scripts/create_audit_backup.js`

#### 1.4 `scripts/inspect_schema.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Queries `information_schema.TABLES` and `information_schema.COLUMNS` to verify primary keys, unique constraints, foreign keys, and indexes across all tables.
- **Target Tables**: Information schema meta-tables.
- **Execution**: `node scripts/inspect_schema.js`

#### 1.5 `scripts/audit_database_contents.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Performs a quick health check printing an ASCII table of all 26 tables with their active row counts.
- **Execution**: `node scripts/audit_database_contents.js`

#### 1.6 `scripts/audit_content_details.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Deep content audit scanning novels and episodes. Flags empty chapter bodies, missing Tamil titles (`title_ta`), abnormal word counts, and invalid release dates.
- **Target Tables**: `novels`, `chapters`.
- **Execution**: `node scripts/audit_content_details.js`

---

### Category 2: Data Cleanup & Sanitization

#### 2.1 `scripts/inspect_all_data_for_cleanup.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Analyzes the database for mock, test, dummy, or development data (e.g., "test comment", "asdf", lorem ipsum, mock accounts) before running cleanups.
- **Execution**: `node scripts/inspect_all_data_for_cleanup.js`

#### 2.2 `scripts/execute_safe_cleanup.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Executes an atomic, safe transaction deleting test entries while protecting real author novels, authentic chapters, genuine user comments, and real forum topics.
- **Execution**: `node scripts/execute_safe_cleanup.js`

#### 2.3 `scripts/execute_fake_data_cleanup.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Purges remaining dummy comments, test reactions, and mock forum replies created during earlier development iterations.
- **Execution**: `node scripts/execute_fake_data_cleanup.js`

#### 2.4 `scripts/inspect_forum_and_comments.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Displays a consolidated preview of recent forum discussions and chapter comments to verify that only genuine reader content is active.
- **Execution**: `node scripts/inspect_forum_and_comments.js`

#### 2.5 `scripts/restore_genuine_data.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Restores authentic seed data from genuine backups for author Rudhra Prarthana, authentic readers (`harish`), genuine novels, chapters, and comments.
- **Execution**: `node scripts/restore_genuine_data.js`

---

### Category 3: Authentication, Security & OTP Testing

#### 3.1 `scripts/test_admin_auth_and_otp.js`
- **Language**: Node.js (`backend/db.js`, `backend/auth.js`)
- **Purpose**: Full 19-step cryptographic test verifying:
  1. Author email lookup and salted PBKDF2 hash verification.
  2. Author login using email and username.
  3. Role enforcement (readers blocked from author access).
  4. Real SMTP dispatch of 6-digit OTP to author email.
  5. OTP storage in MySQL with 5-minute TTL.
  6. Resend cooldown enforcement.
  7. Rejection of invalid OTPs and attempt counters.
  8. Issuance of 15-minute reset token.
  9. New password hashing and old password invalidation.
  10. Prevention of OTP reuse.
- **Execution**: `node scripts/test_admin_auth_and_otp.js`

#### 3.2 `scripts/test_auth_access_control.py`
- **Language**: Python (`requests`)
- **Purpose**: Negative testing suite verifying that unauthenticated or unauthorized requests to `/api/admin/*`, `/api/writer/*`, and protected user endpoints receive strict `401 Unauthorized` or `403 Forbidden`.
- **Execution**: `python scripts/test_auth_access_control.py`

#### 3.3 `scripts/update_author_credentials.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Safely updates the author account credentials and recalculates salted password hashes.
- **Execution**: `node scripts/update_author_credentials.js`

#### 3.4 `scripts/verify_admin_security_flow.js`
- **Language**: Node.js
- **Purpose**: End-to-end security verification verifying author session cookies, token expiration, header authorization, and direct route access protection.
- **Execution**: `node scripts/verify_admin_security_flow.js`

---

### Category 4: Novels, Episodes & Media Management

#### 4.1 `scripts/test_novel_creation_flow.js`
- **Language**: Node.js (`backend/db.js`, `backend/auth.js`)
- **Purpose**: Tests novel creation via the administrative API, ensuring mandatory fields (title, synopsis, author, genre) are validated and stored correctly in MySQL.
- **Execution**: `node scripts/test_novel_creation_flow.js`

#### 4.2 `scripts/test_auto_slug_generation.js`
- **Language**: Node.js (`backend/db.js`, `backend/novels.js`)
- **Purpose**: Tests automatic Tamil-to-English transliteration and URL slug generation:
  - English title -> standard hyphenated slug.
  - Pure Tamil title -> romanized phonetics (e.g. நெஞ்சம் மறப்பதில்லை -> `nenjam-marappadhillai`).
  - Collision handling: appends `-2`, `-3` for duplicates.
- **Execution**: `node scripts/test_auto_slug_generation.js`

#### 4.3 `scripts/test_direct_cover_upload.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Tests direct image uploading for novel covers and banners. Validates file size limits (10MB), MIME types (JPEG, PNG, WebP), disk storage in `backend/uploads/media`, and URL generation.
- **Execution**: `node scripts/test_direct_cover_upload.js`

#### 4.4 `scripts/test_image_browser_flow.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Tests the admin media library browser: listing uploaded media assets, filtering by MIME type, searching by filename, and inserting into chapter content.
- **Execution**: `node scripts/test_image_browser_flow.js`

#### 4.5 `scripts/verify_cover_fill_comprehensive.js`
- **Language**: Node.js
- **Purpose**: Visual and DOM verification that novel cover cards maintain consistent aspect ratios (2:3), use `object-fit: cover`, and display fallbacks when artwork is unavailable.
- **Execution**: `node scripts/verify_cover_fill_comprehensive.js`

#### 4.6 `scripts/verify_browser_novel_navigation.js`
- **Language**: Node.js
- **Purpose**: Simulates browser navigation: homepage -> novel detail page -> chapter list -> episode reader.
- **Execution**: `node scripts/verify_browser_novel_navigation.js`

---

### Category 5: Comments, Nested Replies & Rich Editor

#### 5.1 `scripts/verify_comment_toolbar_and_data.js`
- **Language**: Node.js (`backend/comments.js`)
- **Purpose**: Tests the comment editor toolbar (bold, italic, bullet list, quote, image insertion) and verifies HTML sanitization against XSS attacks.
- **Execution**: `node scripts/verify_comment_toolbar_and_data.js`

#### 5.2 `scripts/verify_latest_comments_first.js`
- **Language**: Node.js (`backend/comments.js`)
- **Purpose**: Validates comment sorting order (`created_at DESC` for top-level comments, `created_at ASC` for nested replies) ensuring newest feedback appears first.
- **Execution**: `node scripts/verify_latest_comments_first.js`

#### 5.3 `scripts/verify_novel_comments_and_replies.js`
- **Language**: Node.js (`backend/db.js`, `backend/auth.js`)
- **Purpose**: End-to-end verification of the 2-level threaded commenting system on novel chapters. Tests posting top-level comments, replying as author, reply counters, and author badge display.
- **Execution**: `node scripts/verify_novel_comments_and_replies.js`

#### 5.4 `scripts/verify_novel_reply_rich_editor.js`
- **Language**: Node.js (`backend/comments.js`)
- **Purpose**: Verifies that the nested reply modal supports rich-text formatting, emoji selection, and user mentions (`@username`).
- **Execution**: `node scripts/verify_novel_reply_rich_editor.js`

---

### Category 6: Community Forum & Discussion Workflows

#### 6.1 `scripts/verify_forum_comments_flow.js`
- **Language**: Node.js (`backend/db.js`, `backend/auth.js`)
- **Purpose**: Tests forum category browsing, thread creation, reply submissions, and view counts.
- **Execution**: `node scripts/verify_forum_comments_flow.js`

#### 6.2 `scripts/verify_forum_e2e_browser.js`
- **Language**: Node.js
- **Purpose**: Browser-based E2E test verifying forum interactions, form validation, category navigation, and reply rendering.
- **Execution**: `node scripts/verify_forum_e2e_browser.js`

#### 6.3 `scripts/verify_forum_live_e2e.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Live HTTP test verifying that newly created forum topics immediately appear in the topic list and trigger user notifications.
- **Execution**: `node scripts/verify_forum_live_e2e.js`

#### 6.4 `scripts/verify_forum_stats_api.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Tests `/api/forum/stats` aggregating total discussions, total replies, active members, and category breakdown.
- **Execution**: `node scripts/verify_forum_stats_api.js`

#### 6.5 `scripts/verify_forum_stats_and_audio.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Combined test verifying both forum statistical summaries and audio novel releases catalog.
- **Execution**: `node scripts/verify_forum_stats_and_audio.js`

#### 6.6 `scripts/verify_remove_start_discussion.js`
- **Language**: Node.js
- **Purpose**: UI regression verification confirming that "Start Discussion" buttons are hidden or replaced with login prompts for unauthenticated guests.
- **Execution**: `node scripts/verify_remove_start_discussion.js`

---

### Category 7: Audio Novels & Streaming

#### 7.1 `scripts/verify_audio_novels_flow.js`
- **Language**: Node.js
- **Purpose**: Comprehensive test verifying:
  - Audio novel catalog retrieval.
  - Direct audio file upload (MP3, M4A, WAV up to 50MB) to `backend/uploads/audio`.
  - YouTube channel links and embed IDs.
  - Streaming playback duration formatting and narrator metadata.
- **Execution**: `node scripts/verify_audio_novels_flow.js`

---

### Category 8: Writer Program & Editorial Dashboards

#### 8.1 `scripts/check_writers.js`
- **Language**: Node.js (`backend/db.js`, `backend/writers.js`)
- **Purpose**: Inspects writer accounts in MySQL, verifies role assignments (`writer`), and tests account creation functions.
- **Execution**: `node scripts/check_writers.js`

#### 8.2 `scripts/test_writer_redesign_e2e.js`
- **Language**: Node.js
- **Purpose**: Tests the redesigned writer application and dashboard UI, validating application submissions, chapter drafting, and word counter tools.
- **Execution**: `node scripts/test_writer_redesign_e2e.js`

#### 8.3 `scripts/verify_writers_flow.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Tests the full lifecycle of the writer program:
  1. Reader submits application (`/api/writer/apply`).
  2. Admin reviews and approves application.
  3. User role upgraded to `writer`.
  4. Writer logs in and submits draft chapter.
  5. Admin reviews draft, publishes chapter, and audit log is recorded in `writer_audits`.
- **Execution**: `node scripts/verify_writers_flow.js`

#### 8.4 `scripts/verify_writer_redesign_browser.js`
- **Language**: Node.js
- **Purpose**: Headless browser verification of the writer dashboard across desktop and mobile screens.
- **Execution**: `node scripts/verify_writer_redesign_browser.js`

---

### Category 9: User Presence & Real-Time Notifications

#### 9.1 `scripts/verify_presence_flow.js`
- **Language**: Node.js (`backend/db.js`)
- **Purpose**: Tests the real-time presence system:
  - Heartbeat endpoint (`/api/presence/heartbeat`).
  - Online toggle in `activity_status`.
  - Automatic transition to "offline" when no heartbeat is received within 15 minutes.
- **Execution**: `node scripts/verify_presence_flow.js`

#### 9.2 `scripts/verify_presence_responsive.js`
- **Language**: Node.js
- **Purpose**: Checks the visual display of the green online badge and last seen text in the desktop header and mobile navigation drawer.
- **Execution**: `node scripts/verify_presence_responsive.js`

#### 9.3 `scripts/verify_realtime_notifications_flow.js`
- **Language**: Node.js (`backend/db.js`, `backend/notifications.js`)
- **Purpose**: Tests in-app notification triggers and Web Push:
  - Notifications triggered on comment replies, topic responses, and new episode releases.
  - VAPID key validation and web-push payload delivery.
  - Marking notifications as read and unread counter badge updates.
- **Execution**: `node scripts/verify_realtime_notifications_flow.js`

---

### Category 10: System Health, Responsive Design & E2E Audits

#### 10.1 `scripts/test_system_health.py`
- **Language**: Python
- **Purpose**: Quick ping script testing MySQL connectivity, Node.js HTTP server availability, response times, and CORS headers.
- **Execution**: `python scripts/test_system_health.py`

#### 10.2 `scripts/verify_mysql_connection.py`
- **Language**: Python
- **Purpose**: Connects to MySQL and validates `utf8mb4` encoding, collation, table count, and user privileges.
- **Execution**: `python scripts/verify_mysql_connection.py`

#### 10.3 `scripts/verify_full_system.py`
- **Language**: Python
- **Purpose**: High-level integration test suite testing all primary API endpoints and static assets.
- **Execution**: `python scripts/verify_full_system.py`

#### 10.4 `scripts/verify_cleaned_production_system.js`
- **Language**: Node.js (`backend/db.js`, `backend/comments.js`)
- **Purpose**: Comprehensive data integrity audit confirming zero fake/mock data remains:
  - Exactly 4 registered users.
  - Exactly 4 novels and 46 chapters.
  - Exactly 6 genuine forum topics.
  - Exactly 13 genuine comments.
  - Audio novels linked to official YouTube channel.
- **Execution**: `node scripts/verify_cleaned_production_system.js`

#### 10.5 `scripts/verify_complete_application_audit.js`
- **Language**: Node.js (`backend/db.js`, `backend/novels.js`, `backend/episodes.js`)
- **Purpose**: Complete system audit verifying novel CRUD, episode scheduler (future date publication), user sessions, and database consistency.
- **Execution**: `node scripts/verify_complete_application_audit.js`

#### 10.6 `scripts/verify_reader_novel_flow.js`
- **Language**: Node.js
- **Purpose**: Comprehensive chapter reader test:
  - Typography engine (A-, Reset, A+ font scaling).
  - Theme switching (Light, Sepia, Dark).
  - Chapter progress bar calculation.
  - Next/Previous chapter navigation.
- **Execution**: `node scripts/verify_reader_novel_flow.js`

#### 10.7 `scripts/verify_responsive_admin.js`
- **Language**: Node.js
- **Purpose**: Validates responsive styling of the admin dashboard on mobile (375px), tablet (768px), and desktop (1440px) viewports with zero horizontal overflow.
- **Execution**: `node scripts/verify_responsive_admin.js`

#### 10.8 `scripts/capture_admin_screens.py`
- **Language**: Python (`playwright` / `selenium`)
- **Purpose**: Headless browser automation that logs into the admin panel and captures full-page screenshots of analytics, content manager, and settings.
- **Execution**: `python scripts/capture_admin_screens.py`

#### 10.9 `scripts/capture_reader_views.py`
- **Language**: Python (`playwright` / `selenium`)
- **Purpose**: Captures visual proof of the chapter reader across light, sepia, and dark modes on desktop and mobile viewports.
- **Execution**: `python scripts/capture_reader_views.py`

#### 10.10 `scripts/test_homepage_section_management_e2e.js`
- **Language**: Node.js
- **Purpose**: Tests administrative configuration of homepage layout sections: hero carousel items, featured ongoing novels, latest releases, and audio banner.
- **Execution**: `node scripts/test_homepage_section_management_e2e.js`

---

## 4. Confirmed Obsolete Artifacts Removed During Audit

| File Path | Original Purpose | Reason for Safe Removal | Evidence |
|---|---|---|---|
| `scripts/print_target_tables.js` | Print historical backup tables | Hardcodes reading `db_backup_pre_cleanup_1792760935247.json`; obsolete | Standalone debug script, 0 imports, unreferenced |
| `scripts/analyze_backup_json.js` | Inspect historical backup tables | Hardcodes reading `db_backup_pre_cleanup_1792760935247.json`; obsolete | Standalone debug script, 0 imports, unreferenced |
| `scripts/apply_migration_008.js` | One-off runner for migration 008 | Migration 008 is permanently integrated in `backend/migrations/` and run via `npm run migrate` | Redundant patch script, 0 imports |
| `scripts/test_stats_query.js` | Raw SQL query snippet | 15-line scratch snippet; fully superseded by `verify_forum_stats_api.js` | Redundant scratch script, 0 imports |
| `scripts/clean_database_fresh.py` | Truncate database content | Dangerous script with hardcoded password `root`; superseded by transactional `execute_safe_cleanup.js` | Destructive one-off script, 0 imports |
| `frontend/src/css/admin-demo.css` & `src/css/admin-demo.css` | Placeholder stylesheet | Empty 68-byte file with comment `/* Obsolete Admin Demo Styles */` | 0 CSS rules, unreferenced across project |
| `.chrome_temp/` | Automated Chrome cache | Browser profile directory created by automated Chrome test sessions | Build/test cache, in `.gitignore` |
| `scratch/` | Temporary diagnostic profiles | Temporary Chrome profiles (`chrome_*`, `diag1-10`) and scratch files | Test cache, in `.gitignore` |
| `.last_otp.txt` | Temporary OTP output | Local test suite output artifact | In `.gitignore`, generated by test runners |
| Root `dist/` | Legacy build directory | Generated before restructuring; active build is in `frontend/dist/` | Obsolete build artifact |
