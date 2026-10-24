# Rudhra Prarthana Novels — Scripts Directory Catalog & Guide

This directory contains **54 automation, verification, testing, and maintenance scripts** for the platform.

For the full detailed breakdown and technical specifications, refer to [docs/SCRIPTS_CATALOG.md](../docs/SCRIPTS_CATALOG.md).

---

## 1. Quick-Reference Matrix

| Goal | Recommended Script | Command |
|---|---|---|
| **Verify System Integrity & Clean Data** | `verify_cleaned_production_system.js` | `node scripts/verify_cleaned_production_system.js` |
| **Test Admin Login & Email OTP Delivery** | `test_admin_auth_and_otp.js` | `node scripts/test_admin_auth_and_otp.js` |
| **Verify Full Application Architecture** | `verify_complete_application_audit.js` | `node scripts/verify_complete_application_audit.js` |
| **Test Novel Auto-Slug & Transliteration** | `test_auto_slug_generation.js` | `node scripts/test_auto_slug_generation.js` |
| **Verify Comment Hierarchy & Replies** | `verify_novel_comments_and_replies.js` | `node scripts/verify_novel_comments_and_replies.js` |
| **Verify Audio Novels Flow & Uploads** | `verify_audio_novels_flow.js` | `node scripts/verify_audio_novels_flow.js` |
| **Verify Writer Program & Approval Flow** | `verify_writers_flow.js` | `node scripts/verify_writers_flow.js` |
| **Test User Presence & Heartbeats** | `verify_presence_flow.js` | `node scripts/verify_presence_flow.js` |
| **Create Database JSON Backup** | `create_full_backup.js` | `node scripts/create_full_backup.js` |
| **Inspect MySQL Table Counts** | `audit_database_contents.js` | `node scripts/audit_database_contents.js` |
| **Check MySQL Connection & Charset** | `verify_mysql_connection.py` | `python scripts/verify_mysql_connection.py` |

---

## 2. Categories Overview

- **Database Backups, Migrations & Schema Audits** (9 scripts): `backup_db.py`, `create_full_backup.js`, `create_audit_backup.js`, `analyze_backup_json.js`, `inspect_schema.js`, `audit_database_contents.js`, `audit_content_details.js`, `apply_migration_008.js`, `print_target_tables.js`.
- **Data Cleanup & Sanitization** (6 scripts): `clean_database_fresh.py`, `inspect_all_data_for_cleanup.js`, `execute_safe_cleanup.js`, `execute_fake_data_cleanup.js`, `inspect_forum_and_comments.js`, `restore_genuine_data.js`.
- **Authentication, Security & OTP** (4 scripts): `test_admin_auth_and_otp.js`, `test_auth_access_control.py`, `update_author_credentials.js`, `verify_admin_security_flow.js`.
- **Novels, Episodes & Media Management** (6 scripts): `test_novel_creation_flow.js`, `test_auto_slug_generation.js`, `test_direct_cover_upload.js`, `test_image_browser_flow.js`, `verify_cover_fill_comprehensive.js`, `verify_browser_novel_navigation.js`.
- **Comments, Nested Replies & Rich Editor** (4 scripts): `verify_comment_toolbar_and_data.js`, `verify_latest_comments_first.js`, `verify_novel_comments_and_replies.js`, `verify_novel_reply_rich_editor.js`.
- **Community Forum & Discussion Workflows** (7 scripts): `verify_forum_comments_flow.js`, `verify_forum_e2e_browser.js`, `verify_forum_live_e2e.js`, `verify_forum_stats_api.js`, `verify_forum_stats_and_audio.js`, `verify_remove_start_discussion.js`, `test_stats_query.js`.
- **Audio Novels & Streaming** (1 script): `verify_audio_novels_flow.js`.
- **Writer Program & Editorial Dashboards** (4 scripts): `check_writers.js`, `test_writer_redesign_e2e.js`, `verify_writers_flow.js`, `verify_writer_redesign_browser.js`.
- **User Presence & Notifications** (3 scripts): `verify_presence_flow.js`, `verify_presence_responsive.js`, `verify_realtime_notifications_flow.js`.
- **System Health, Responsive & E2E Audits** (10 scripts): `test_system_health.py`, `verify_mysql_connection.py`, `verify_full_system.py`, `verify_cleaned_production_system.js`, `verify_complete_application_audit.js`, `verify_reader_novel_flow.js`, `verify_responsive_admin.js`, `capture_admin_screens.py`, `capture_reader_views.py`, `test_homepage_section_management_e2e.js`.
