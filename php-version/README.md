# PHP Version

This folder is the separate PHP migration target for shared hosting. It uses PHP 8.2+, Apache rewrite rules, PDO MySQL, and the existing MySQL schema.

## Current working slice

- `GET /api/health`
- `POST /api/auth/register`
- MySQL transactions for users, profiles, activity status, and sessions
- Environment-based database configuration

The existing Node.js application remains unchanged. The rest of the Node API modules must be migrated and tested one vertical slice at a time before this folder replaces production.

## GoDaddy setup

1. Set the domain document root to this folder.
2. Copy `.env.example` to `.env` and set the cPanel MySQL credentials.
3. Enable PHP 8.2 or newer and PDO MySQL.
4. Import the existing database schema and migrations.
5. Verify `/api/health` before connecting the frontend.
