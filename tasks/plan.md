# Implementation Plan: Full PHP/HTML Migration

## Overview
Create a standalone PHP 8.2+/HTML version of the Rudhra Prarthana Novels website under `php-version/`, using the existing MySQL schema and preserving the current frontend behavior and API contracts. The existing Node.js application remains unchanged until the PHP version passes feature and deployment checks.

## Architecture Decisions
- Use PHP 8.2+ with PDO MySQL and Apache rewrite rules for shared hosting.
- Preserve the existing `/api/...` JSON contract so the current frontend can be migrated with minimal request changes.
- Use PHP sessions or bearer tokens consistently; retain bearer-token compatibility for the existing frontend.
- Store uploads under a protected PHP-managed uploads directory and validate MIME, size, and ownership.
- Replace Node SSE/process schedulers with PHP polling, cron jobs, and database-backed events where GoDaddy does not support persistent workers.
- Keep secrets in cPanel environment variables or an untracked `.env`, never in the archive or repository.

## Task List

### Phase 1: Foundation and Authentication
- PHP front controller, Apache rewrites, config, PDO, JSON helpers, error handling.
- Health endpoint and database connectivity check.
- Registration, login, logout, current-user, token/session validation.
- Password reset OTP flow using PHP mail/SMTP integration.
- Frontend API base URL and authentication integration.

### Phase 2: Public Content and Reader Experience
- Content hierarchy, categories, articles, chapters, novels, audio metadata.
- Public homepage/forum/member/library routes.
- Reader progress, share metadata, link previews, and search.

### Phase 3: Community Features
- Profiles, follows, saved items, profile posts.
- Forum topics, replies, likes, reactions, nested comments.
- Presence and guest visitor tracking.

### Phase 4: Uploads, Messaging, and Notifications
- Secure image/audio uploads and media library.
- Private conversations, messages, locks, attachments, edit/unsend.
- Notification persistence, polling fallback, Web Push, and notification preferences.

### Phase 5: Admin, Writer, and Publishing Workflows
- Admin overview, settings, media, trash, member controls.
- Writer accounts, permissions, assignments, submissions, audit logs.
- Content authoring, scheduling, automated publication, and cron entry point.

### Phase 6: Frontend Conversion and Cutover
- Copy the existing visual frontend into `php-version/public/` and update API calls to the PHP endpoints.
- Replace Node-only build/runtime assumptions with deployable HTML/CSS/JS assets.
- Add PHP deployment instructions and a clean archive command.
- Run endpoint contract tests, browser smoke tests, security checks, and GoDaddy import validation.

## Acceptance Criteria
- Every frontend API call has a PHP endpoint with matching request and response behavior.
- Registration, login, reader content, comments, forum, uploads, chat, notifications, admin, writer, and scheduling flows work against the existing MySQL schema.
- No Node.js process is required for the PHP deployment.
- No `node_modules`, `.env`, generated build output, or local tunnel files are present in the deployment ZIP.
- PHP syntax, endpoint contract tests, and production browser smoke tests pass.

## Risks
- Persistent SSE and background schedulers need GoDaddy-compatible polling/cron replacements.
- The current frontend is a Vite-built JavaScript application; converting it to HTML/PHP does not mean JavaScript can be removed without rewriting all interactive behavior.
- Existing database migrations and role rules must remain compatible during the transition.
