# Rudhra Prarthana Novels — System Architecture

## 1. High-Level Architecture Overview

Rudhra Prarthana Novels is a high-performance web platform for Tamil novels and episodic literature with interactive reader engagement, audio novels, user communities, rich comments, and writer/author management.

```
┌────────────────────────────────────────────────────────┐
│                   Client Browser                       │
│  - Vanilla JavaScript ES Modules                       │
│  - Modular CSS Design System                           │
│  - Single Page Routing & View Transitions              │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP / REST / Server Events
                            ▼
┌────────────────────────────────────────────────────────┐
│             Vite / Node.js Reverse Proxy               │
│  - Port 5173 (Dev Proxy) / Port 3000 (Production)      │
│  - Proxies: /api/*  → Backend API Router               │
│  - Proxies: /uploads/* → Backend Static Media Engine   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│            Node.js HTTP Application Server             │
│  - `backend/server.js`: Dispatcher & Security Headers  │
│  - `backend/api.js`: REST Endpoints & Authorization   │
│  - `backend/auth.js`: Crypto Sessions & Passwords      │
│  - `backend/novels.js` & `episodes.js`: Publishing    │
│  - `backend/comments.js` & `audio.js`: Media & Forum   │
│  - `backend/writers.js` & `admin.js`: Editorial Flow   │
└───────────────────────────┬────────────────────────────┘
                            │ Prepared Queries / Connection Pool
                            ▼
┌────────────────────────────────────────────────────────┐
│               MySQL 8.0 Relational DB                  │
│  - 26 Normalized Tables                                │
│  - Full UTF-8 Multi-byte support (`utf8mb4`)           │
│  - Foreign Key Cascades & Indexed Search               │
└────────────────────────────────────────────────────────┘
```

---

## 2. Directory Layout & Module Separation

```text
rudhra-prarthana-novels/
├── frontend/                 # Client Application
│   ├── index.html            # Main HTML Entry Point
│   ├── vite.config.js        # Vite dev server & proxy config
│   ├── package.json          # Frontend build tooling (Vite)
│   ├── public/               # Static client assets (favicons, logos, sw.js)
│   └── src/
│       ├── main.js           # Frontend entry bootstrap
│       ├── js/               # ES Modules (app, auth, reader, comments, forum, etc.)
│       └── css/              # Pure Vanilla CSS Design System
│
├── backend/                  # Application Backend
│   ├── server.js             # HTTP server & static upload server
│   ├── api.js                # Consolidated REST API endpoints
│   ├── db.js                 # MySQL2 connection pooling & queries
│   ├── auth.js               # Cryptographic auth, sessions & password hashing
│   ├── novels.js             # Novel CRUD, views, and catalog
│   ├── episodes.js           # Episode scheduling & publishing engine
│   ├── comments.js           # Nested comments & replies engine
│   ├── audio.js              # Audio novels upload & YouTube embed provider
│   ├── writers.js            # Writer application & review workflows
│   ├── admin.js              # Author & administrator dashboards
│   ├── presence.js           # Real-time user heartbeat & online tracking
│   ├── notifications.js      # In-app notifications & Web Push engine
│   ├── email.js              # Nodemailer SMTP & OTP delivery
│   ├── migrate.js            # Versioned migration runner
│   ├── migrations/           # 12 Versioned SQL migrations
│   ├── uploads/              # Uploaded user avatars, audio files, and media
│   └── package.json          # Node server dependencies (mysql2, nodemailer, web-push)
│
├── db/                       # Database Reference & Documentation
│   ├── schema/
│   │   └── full_schema.sql   # Complete current MySQL schema DDL
│   ├── migrations/           # Reference copies of schema migrations
│   └── README.md             # Comprehensive schema and tables documentation
│
├── docs/                     # Architecture & Operations Documentation
│   ├── ARCHITECTURE.md       # This file
│   ├── API_DOCUMENTATION.md  # Complete REST API reference
│   └── DEPLOYMENT.md         # Production deployment guide
│
├── scripts/                  # Automated test & verification scripts
├── .env                      # Global environment credentials (DB, SMTP, VAPID)
├── .env.example              # Environment template
└── package.json              # Root orchestrator scripts
```

---

## 3. Data Lifecycle & Request Routing

### 3.1 Client Routing
- Handled dynamically via `frontend/src/js/app.js` using browser hash and history state.
- Primary views:
  - `home`: Hero carousel, trending novels, latest episodes, audio releases.
  - `novel`: Novel details, synopsis, episode list, and comment section.
  - `reader`: Reader view with typography controls, dark/sepia/light themes, font sizing, and nested comments.
  - `audio`: Audio novel stream player.
  - `forum`: Community discussions, topic categories, thread creation, and replies.
  - `admin`: Author analytics, content manager, episode scheduler, user moderation.
  - `writer`: Writer application portal and author submission dashboard.

### 3.2 Media & Upload Storage
- Uploaded assets (avatars, audio novels, media library, comment attachments) are written to `backend/uploads/` and served under `/uploads/`.
- Sanitized filenames prevent directory traversal and overwrite attacks.
- Direct audio uploads support MP3, M4A, and WAV up to 50MB.

### 3.3 Security & Role-Based Access Control
- **Roles**:
  - `admin`: Superuser access to system settings, users, and content.
  - `author`: Administrative publishing access over novels, chapters, and scheduler.
  - `writer`: Can create drafts and submit episodes for review.
  - `reader`: Read published chapters, comment, participate in forums, and manage profile.
  - `guest`: Read guest-enabled chapters; prompted to register for interactive features.
- **Session Tokens**: 64-character cryptographic random hex tokens stored in `sessions` table.
- **Passwords**: Hashed with cryptographic PBKDF2/SHA-256 with per-user salt.
