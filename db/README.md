# Rudhra Prarthana Novels — Database Architecture

## 1. Overview
The database layer uses **MySQL 8.0** with strict UTF-8 multi-byte encoding (`utf8mb4`, collation `utf8mb4_unicode_ci`) to support Tamil typography and emojis. Connection pooling is managed using `mysql2/promise` with prepared statements and parameter binding.

- **Database Name**: `rp_novels_db`
- **Default Port**: `3306`
- **Charset**: `utf8mb4`
- **Collation**: `utf8mb4_unicode_ci`
- **Total Tables**: 26

---

## 2. Table Catalog & Groupings

### 2.1 Identity, Users & Roles
- **`users`**: System users (id, username, email, password_hash, role, display_name, avatar, bio, created_at, updated_at). Roles: `admin`, `author`, `writer`, `reader`.
- **`sessions`**: Server-managed cryptographic authentication tokens with expiry and device tracking.
- **`activity_status`**: Online presence and last seen timestamps.
- **`guest_visitors`**: IP/fingerprint tracking for guest reading counts.

### 2.2 Content Publishing & Literature
- **`novels`**: Novel catalog (id, title, title_ta, slug, synopsis, synopsis_ta, cover_image, banner_image, author, genre, status, visibility, sort_order, views_count).
- **`chapters`**: Episodes and chapters (id, novel_id, chapter_num, episode_number, title, title_ta, content, is_guest_allowed, status, scheduled_at, timezone, published_at, sort_order).
- **`audio_novels`**: Audio releases (id, novel_id, title, narrator, duration, audio_file_url, youtube_video_id, status, play_count).
- **`novel_tags`** & **`novel_tag_map`**: Many-to-many taxonomy tagging for novels.

### 2.3 Community, Comments & Reactions
- **`comments`**: Threaded comments on episodes/chapters with nested parent IDs, author info, attached images, and moderation status.
- **`reactions`**: Emoji reaction tallies (heart, clap, cry, fire) on novels and chapters.
- **`comment_likes`**: Per-user like tracking on individual comments.

### 2.4 Forum & Discussions
- **`forum_categories`**: Forum boards and topics (e.g. Novel Discussions, Reader Corner, Announcements).
- **`forum_topics`**: User-created discussion threads.
- **`forum_replies`**: Threaded replies within forum topics.
- **`forum_topic_views`**: View count deduplication.

### 2.5 Writer Program & Editorial Workflows
- **`writer_applications`**: Applications submitted by users requesting author/writer status.
- **`writer_audits`**: Audit logs tracking chapter submissions, edits, approvals, and status changes.
- **`writer_profiles`**: Extended biographical details, social handles, and pen names.

### 2.6 Homepage Management & System Config
- **`homepage_sections`**: Configurable homepage layout widgets (hero carousel, trending novels, latest episodes, audio releases, custom banners).
- **`media`**: Uploaded media library assets with MIME types and storage paths.
- **`notifications`**: In-app user notifications.
- **`push_subscriptions`**: Web Push API endpoint records and VAPID keys for browser push notifications.
- **`password_resets`**: 6-digit OTP codes and expiration tokens.
- **`schema_migrations`**: Migration history tracking applied database versions.

---

## 3. Schema Snapshots & Migrations

- Full DDL snapshot: [`schema/full_schema.sql`](schema/full_schema.sql)
- Incremental versioned migrations: [`migrations/`](migrations/)

### Applying Migrations
Run from project root:
```bash
npm run migrate
```
Or directly:
```bash
node backend/migrate.js
```
