# Rudhra Prarthana Novels (ருத்ரா பிரார்த்தனா நாவல்கள்)

A premium, elegant Tamil literary novel community and digital reading platform dedicated to author **Rudhra Prarthana**. Features distraction-free chapter reading, audio novels, an active reader forum, member directory, interactive comments, and emoji reactions.

![Rudhra Prarthana Novels](frontend/public/images/logo.png)

---

## 🌟 Key Features

### 📖 Distraction-Free Chapter Reader
- **Customizable Reading Themes:** Light (pristine white), Sepia (warm literary parchment), and Dark (deep navy) modes strictly scoped to the novel reader container.
- **Fluid Typography Engine:** Real-time font size scaling (A−, Reset, A+) with persistent local preferences and Tamil typography optimization (`Noto Sans Tamil`, `Plus Jakarta Sans`, and `Cormorant Garamond`).
- **Reading Progress & Protection:** Top viewport reading progress bar and right-click / selection content protection.

### 💬 Reader Engagement & Emoji Reactions
- **Dynamic Comments:** Registered users can post and edit comments on novels and individual chapters; guests can browse freely.
- **Interactive Emoji Reactions:** Real-time reactions (❤️, 👍, 😂, 😢, 😍, 🔥) with personal reaction toggling and duplicate prevention.
- **SQL Database Backed:** All comments, reactions, likes, reading progress, and topics are persisted in a relational MySQL database.

### 🌐 Dual-Language Support (தமிழ் & English)
- Instant, seamless language toggle across all pages, navigation, forum topics, and reading controls without page reloads.

### 🏛️ Literary Forum & Member Community
- **Community Forum:** Category streams, topic threads, reader reviews, and author interactions persisted in SQL.
- **Member Directory:** Authentic registered member list, activity statuses (online/offline indicators), and privacy controls.
- **User Profiles:** Custom avatars, biography editing, and activity tracking.

### 🔐 Secure Authentication & Password Recovery
- Session token authentication with cryptographic password hashing.
- Parameterized SQL queries preventing SQL injection across all endpoints.
- Role-based authorization (`admin`, `author`, `writer`, `reader`, `guest`).
- Password recovery via automated 6-digit OTP email verification with resend cooldowns and countdown timers.

### 📱 Responsive Design & Visual Excellence
- White-and-gold aesthetic (`#FFFFFF`, `#FFFDF8`, `#0B1F33`, `#C89B3C`).
- Tested across viewports (360px, 375px, 390px, 414px, 430px, tablet, and desktop) with zero horizontal overflow.
- Full-screen animated loading screen and comprehensive error handling (404, 403, 500, chapter unavailable).

---

## 🛠️ Technology Stack

- **Frontend:** Vanilla JavaScript (ES Modules), Modern CSS3 (Variables, Flexbox, CSS Grid), HTML5, Vite 6
- **Backend Application Server:** Node.js standalone HTTP server with modular REST API routing
- **Database Backend:** Relational MySQL 8.0+ (`mysql2/promise`) with versioned migrations
- **Email Service:** Nodemailer SMTP Integration for OTP Password Reset
- **Audio Service:** Direct audio uploads and streaming player

---

## 📂 Project Architecture

The codebase is organized into three decoupled folders:

```text
rudhra-prarthana-novels/
├── frontend/                 # Vite + Vanilla JS Client Application
│   ├── index.html            # SPA Entry Point
│   ├── vite.config.js        # Vite config with backend proxy and auto-start
│   ├── package.json          # Frontend build tooling
│   ├── public/               # Static assets (images, sw.js)
│   └── src/
│       ├── main.js           # Frontend entry bootstrap
│       ├── js/               # ES Modules (app, auth, reader, comments, forum, etc.)
│       └── css/              # Modular Vanilla CSS Design System
│
├── backend/                  # Node.js REST API Server
│   ├── server.js             # HTTP server & static upload server
│   ├── api.js                # Consolidated REST API router
│   ├── db.js                 # MySQL2 connection pooling & queries
│   ├── auth.js               # Cryptographic auth, sessions & password hashing
│   ├── novels.js             # Novel CRUD, views, and catalog
│   ├── episodes.js           # Episode scheduling & publishing engine
│   ├── comments.js           # Nested comments & replies engine
│   ├── audio.js              # Audio novels upload & YouTube player
│   ├── writers.js            # Writer application & review workflows
│   ├── admin.js              # Author & administrator dashboards
│   ├── presence.js           # Real-time user heartbeat & online tracking
│   ├── notifications.js      # In-app notifications & Web Push engine
│   ├── email.js              # Nodemailer SMTP & OTP delivery
│   ├── migrate.js            # Database migration runner
│   ├── migrations/           # 12 Versioned SQL migrations
│   ├── uploads/              # Uploaded user avatars, audio files, and media
│   └── package.json          # Node server dependencies
│
├── db/                       # Database Reference & Documentation
│   ├── schema/
│   │   └── full_schema.sql   # Complete current MySQL schema DDL
│   ├── migrations/           # Reference copies of schema migrations
│   └── README.md             # Comprehensive schema and tables documentation
│
├── docs/                     # Architecture & Operations Documentation
│   ├── ARCHITECTURE.md       # High-level architecture and data lifecycle
│   ├── API_DOCUMENTATION.md  # Complete REST API reference
│   └── DEPLOYMENT.md         # Production deployment guide
│
├── scripts/                  # Automated test & verification scripts
├── .env                      # Global environment credentials (DB, SMTP, VAPID)
├── .env.example              # Environment template
└── package.json              # Root orchestrator scripts
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MySQL Server 8.0+
- npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/harish89460-cpu/novel-webiste.git
   cd novel-webiste
   ```

2. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Configure your MySQL database credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=rp_novels_db
   ```

4. **Run Database Migrations:**
   ```bash
   npm run migrate
   ```

5. **Start Development Environment:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser. (The backend server on port 3000 will be auto-started and proxied automatically).

6. **Production Build & Execution:**
   ```bash
   # Build frontend bundle
   npm run build

   # Start standalone backend server (serves built frontend and API)
   npm start
   ```

---

## 📄 License & Copyright

© 2026 Rudhra Prarthana Novels. All Rights Reserved.  
Designed with literary elegance for Tamil novel lovers.
