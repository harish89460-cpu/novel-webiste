# Rudhra Prarthana Novels (ருத்ரா பிரார்த்தனா நாவல்கள்)

A premium, elegant Tamil literary novel community and digital reading platform dedicated to author **Rudhra Prarthana**. Features distraction-free chapter reading, audio novels, an active reader forum, member directory, interactive comments, and emoji reactions.

![Rudhra Prarthana Novels](logo.png)

---

## 🌟 Key Features

### 📖 Distraction-Free Chapter Reader
- **Customizable Reading Themes:** Light (pristine white), Sepia (warm literary parchment), and Dark (deep navy) modes strictly scoped to the novel reader container.
- **Fluid Typography Engine:** Real-time font size scaling (A−, Reset, A+) with persistent local preferences and Tamil typography optimization (`Noto Sans Tamil`, `Plus Jakarta Sans`, and `Cormorant Garamond`).
- **Reading Progress & Protection:** Top viewport reading progress bar and right-click / selection content protection.

### 💬 Reader Engagement & Emoji Reactions
- **Dynamic Comments:** Registered users can post and edit comments on novels and individual chapters; guests can browse freely.
- **Interactive Emoji Reactions:** Real-time reactions (❤️, 👍, 😂, 😢, 😍, 🔥) with personal reaction toggling and duplicate prevention.
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
- Session token authentication with scrypt/crypto password hashing.
- Parameterized SQL queries preventing SQL injection across all endpoints.
- Role-based authorization for administrative and editorial functions.
- Password recovery via automated 6-digit OTP email verification with resend cooldowns and countdown timers.

### 📱 Responsive Design & Visual Excellence
- White-and-gold aesthetic (`#FFFFFF`, `#FFFDF8`, `#0B1F33`, `#C89B3C`).
- Tested across viewports (360px, 375px, 390px, 414px, 430px, tablet, and desktop) with zero horizontal overflow.
- Full-screen animated loading screen and comprehensive error handling (404, 403, 500, chapter unavailable).

---

## 🛠️ Technology Stack

- **Frontend:** Vanilla JavaScript (ES Modules), Modern CSS3 (Variables, Flexbox, CSS Grid), HTML5
- **Bundler & Dev Server:** Vite 6
- **Backend Application Server:** Consolidated Node.js server with Connect / HTTP API middleware
- **Database Backend:** Relational MySQL 8.0+ (`mysql2/promise`) with versioned migrations
- **Email Service:** Nodemailer SMTP Integration for OTP Password Reset

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v20 or higher)
- MySQL Server 8.0+
- npm

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/harish89460-cpu/novel-webiste.git
   cd novel-webiste
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy the `.env.example` file to `.env`:
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

5. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

6. **Build for Production:**
   ```bash
   npm run build
   ```

7. **Run Standalone Production Server:**
   ```bash
   npm start
   ```

---

## 📂 Project Structure

```
├── index.html                   # Single-Page Application entry with early loader
├── logo.png                     # Official Rudhra Prarthana brand crest
├── profile.png                  # Default member avatar
├── desktopview.png              # Desktop hero artwork background
├── mobileview.png               # Mobile hero artwork background
├── package.json                 # Project dependencies and npm scripts
├── vite.config.js               # Vite configuration and API proxy
├── .env.example                 # Environment variables template
├── .gitignore                   # Excluded dependencies, builds, and secrets
├── server/                      # Consolidated Node.js backend API & MySQL database layer
│   ├── api.js                   # REST API routing & RBAC middleware
│   ├── auth.js                  # Authentication, sessions, profiles, and OTP reset
│   ├── comments.js              # Comments & emoji reaction controller
│   ├── content.js               # Chapter reading evaluation & content security
│   ├── db.js                    # MySQL connection pool, query helpers, and data access
│   ├── email.js                 # Nodemailer SMTP OTP service
│   ├── migrate.js               # Database migration runner with tracking
│   ├── migrations/              # Versioned SQL migrations (schema & genuine seed)
│   │   ├── 001_initial_schema.sql
│   │   └── 002_seed_genuine_data.sql
│   ├── novels.js                # MySQL CRUD for novels, chapters, and homepage sections
│   └── server.js                # Consolidated standalone Node server
├── src/                         # Frontend application source
│   ├── main.js                  # App bootstrap and global error boundaries
│   ├── css/                     # Centralized design system & modular stylesheets
│   │   ├── variables.css        # Colors, typography, spacing tokens
│   │   ├── reset.css            # Base resets and typography wrapping
│   │   ├── layout.css           # Header, mobile drawer, footer, containers
│   │   ├── hero.css             # Hero section and statistics strip
│   │   ├── reader.css           # Novel reading page & isolated themes
│   │   ├── novel-cards.css      # Book cards, grids, and detail views
│   │   ├── forum.css            # Community categories, topics, and replies
│   │   ├── members.css          # Member directory, profiles, activity status
│   │   ├── comments.css         # Novel comments and emoji reactions
│   │   ├── modals.css           # Auth, OTP, search, and notification modals
│   │   └── loading-errors.css   # Skeleton shimmers, route bar, error pages
│   └── js/                      # Modular application controllers
│       ├── app.js               # Main application router and view renderers
│       ├── auth.js              # Authentication, user state, and OTP
│       ├── comments.js          # Comment posting, reaction toggling, and UI
│       ├── content-service.js   # Dynamic SQL API client service
│       ├── data.js              # Static fallback and author metadata
│       ├── errors.js            # Error boundaries, skeletons, and network alerts
│       ├── forum.js             # Forum interaction controller
│       ├── i18n.js              # English/Tamil translation dictionary & switcher
│       ├── messaging.js         # Direct reader messaging drawer
│       ├── notifications.js     # User notifications controller
│       ├── reader.js            # Chapter reader engine (themes, font sizes)
│       └── search.js            # Live global modal search
```

---

## 📄 License & Copyright

© 2026 Rudhra Prarthana Novels. All Rights Reserved.  
Designed with literary elegance for Tamil novel lovers.
