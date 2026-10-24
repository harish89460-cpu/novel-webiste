# Database Migrations Reference

This directory contains versioned incremental SQL migrations for **Rudhra Prarthana Novels**.

## Migration Files

| Version | Migration File | Description |
|---|---|---|
| `001` | `001_initial_schema.sql` | Baseline database tables (users, novels, chapters, comments, forum, etc.) |
| `002` | `002_seed_genuine_data.sql` | Core default datasets, system admin, genuine seed records |
| `003` | `003_admin_episodes_scheduler.sql` | Scheduling capabilities, status columns, publishing timestamps |
| `004` | `004_session_separation.sql` | Secure token sessions, activity status isolation, cookie auth |
| `005` | `005_enlarge_avatar_cover.sql` | Expanded column limits for avatars and cover image URLs |
| `006` | `006_audio_novels.sql` | Audio novels table, duration, narrator, cover, audio uploads |
| `007` | `007_user_presence.sql` | Online presence, last heartbeat, active session tracking |
| `008` | `008_writer_management.sql` | Writer role, writer applications, approval statuses, audits |
| `009` | `009_homepage_sections_management.sql` | Dynamic carousel, featured lists, homepage section configs |
| `010` | `010_guest_visitors.sql` | Guest read permissions, guest comment restrictions |
| `011` | `011_novel_comments_nested_replies.sql` | Nested replies for novel chapters and forum discussions |
| `012` | `012_notifications_push_and_events.sql` | Web push subscriptions, in-app notification events |

## Running Migrations

To apply pending migrations, run from the project root:
```bash
npm run migrate
```
Or from the `backend/` directory:
```bash
cd backend
npm run migrate
```
Migrations are tracked in the `schema_migrations` table and will never run twice.
