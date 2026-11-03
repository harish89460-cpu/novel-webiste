# Production Test & Verification Suites

**Rudhra Prarthana Novels (ருத்ரா பிரார்த்தனா நாவல்கள்)**

This directory contains the production-grade regression testing suites, automated verification scripts, and database maintenance utilities.

---

## Suite Catalog

| Script | Purpose & Scope | Execution Command |
| :--- | :--- | :--- |
| **`verify_production_readiness_e2e.cjs`** | Comprehensive Master E2E suite verifying health, authentication, reader registration, novel CRUD, chapter/episode hierarchy, comments, reactions, and clean state restoration. | `node scripts/verify_production_readiness_e2e.cjs` |
| **`verify_image_uploads.cjs`** | Tests unified image upload API (`/api/upload/image`), physical disk storage, MIME validation, file size limits, cover replacement with old file cleanup, profile avatar updates, and media gallery CRUD. | `node scripts/verify_image_uploads.cjs` |
| **`verify_chapter_episode_workflow.cjs`** | Verifies decoupled 2-step hierarchy: Admin/Writer creates root chapter (metadata only), then creates episodes (rich content) under the chapter. | `node scripts/verify_chapter_episode_workflow.cjs` |
| **`verify_chapter_edit_functionality.cjs`** | Verifies editing chapter title preserves all associated child episodes and rich story content without data loss or hierarchy distortion. | `node scripts/verify_chapter_edit_functionality.cjs` |
| **`verify_novel_auto_publishing.cjs`** | Tests future scheduled release and live background scheduler execution every 30 seconds independently without requiring an open browser. | `node scripts/verify_novel_auto_publishing.cjs` |
| **`test_admin_auth_and_otp.js`** | Validates Author Portal authentication, salted Scrypt password verification, and live SMTP email OTP password recovery. | `node scripts/test_admin_auth_and_otp.js` |
| **`verify_writer_access_system.cjs`** | Verifies writer permissions, granular novel assignments, independent publishing controls, and immediate access revocation. | `node scripts/verify_writer_access_system.cjs` |
| **`verify_whatsapp_chat.js`** | Verifies real-time messaging, photo attachments, voice notes, message editing, message unsending, and user/admin chat locks. | `node scripts/verify_whatsapp_chat.js` |
| **`execute_safe_production_cleanup.cjs`** | Transactional database cleanup utility that removes test content while preserving schemas, site settings, homepage sections, and the production admin account. | `node scripts/execute_safe_production_cleanup.cjs` |

---

## Running All Production Checks

To execute the complete production verification suite:

```bash
node scripts/verify_production_readiness_e2e.cjs
node scripts/verify_image_uploads.cjs
node scripts/verify_chapter_episode_workflow.cjs
node scripts/verify_chapter_edit_functionality.cjs
node scripts/verify_writer_access_system.cjs
node scripts/test_admin_auth_and_otp.js
node scripts/verify_whatsapp_chat.js
```
