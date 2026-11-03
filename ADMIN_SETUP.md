# Administrator Setup & Migration Reference

**Rudhra Prarthana Novels (ருத்ரா பிரார்த்தனா நாவல்கள்)**

---

## 1. Designated Administrator Account

The platform retains exactly **one** authorized production administrator and author account:

| Attribute | Production Value |
| :--- | :--- |
| **User ID** | `2` |
| **Username** | `rudhra_author` |
| **Registered Email** | `digitalmarkservices.in@gmail.com` |
| **Role** | `Admin` (Author & System Administrator) |
| **Portal URL** | `/#auth?mode=author` or direct navigation to `/admin` |
| **Password Storage** | Cryptographic salted Scrypt hash (`crypto.scryptSync(password, salt, 64)`) |

---

## 2. Authentication Architecture & Access Control

1. **Server-Side Enforcement:**
   - Author and administrator rights are strictly verified on the backend (`backend/auth.js`, `backend/api.js`).
   - Session tokens are stored in the MySQL `sessions` table (`session_type = 'author'`) with 30-day automatic expiration.
   - Client-side modifications of role or localStorage parameters are rejected by server API middleware (`403 Forbidden`).

2. **Dual-Factor Reset Workflow:**
   - The admin account is protected by live SMTP email OTP verification.
   - If the password needs to be changed or recovered, navigating to `/#auth?mode=forgot` triggers an automated 6-digit cryptographic OTP dispatched to `digitalmarkservices.in@gmail.com`.
   - The OTP expires in 5 minutes with cooldown timers and maximum retry protection.

---

## 3. Production Server Migration & Environment Configuration

When moving to a **new production server and new MySQL database**:

1. Copy the application repository to the new production server.
2. Create `.env` in the root directory (based on `.env.example`) and configure your new database credentials:
   ```env
   NODE_ENV=production
   PORT=3000
   HOST=0.0.0.0

   DB_HOST=your-production-db-host
   DB_PORT=3306
   DB_USER=your-db-username
   DB_PASSWORD=your-db-password
   DB_NAME=your-production-db-name

   # Optional for cloud providers requiring SSL:
   # DB_SSL=true

   # SMTP for password recovery
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=your_smtp_email@gmail.com
   SMTP_PASS=your_app_password
   SMTP_FROM="Rudhra Prarthana Novels" <your_smtp_email@gmail.com>
   ```
3. Run `npm install` and `npm run build` (or `npm --prefix frontend run build`).
4. Start the server with `node backend/server.js` or `npm start` (or process manager like PM2 / systemd).
5. **Automatic Schema Initialization:** On startup, the server automatically executes `runMigrations()`. If the database is clean or empty, all 49 tables, indexes, relationships, site configurations, and the authorized Admin account (`rudhra_author` / `digitalmarkservices.in@gmail.com`) with its verified password hash are automatically initialized.
6. The Admin can immediately log in using their existing email `digitalmarkservices.in@gmail.com` (or username `rudhra_author`) and their existing password.

---

## 4. Resetting or Updating the Administrator Password

### Option A: Via the Web Portal (Self-Service)
1. Go to `/#auth?mode=forgot`.
2. Enter the administrator email: `digitalmarkservices.in@gmail.com`.
3. Check email inbox for the 6-digit OTP code.
4. Enter the OTP code and supply a new strong password.

### Option B: Via Command Line (Direct Script on the New Server)
Run the built-in password reset script that automatically reads `.env` configuration:
```bash
node -e "
const { query, hashPassword, getDbConfig } = require('./backend/db');
(async () => {
  const newPassword = process.argv[1] || 'YourNewStrongPassword';
  const { hash, salt } = hashPassword(newPassword);
  await query('UPDATE users SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 2;', [hash, salt]);
  console.log('✓ Administrator password updated successfully for rudhra_author (User ID: 2).');
  process.exit(0);
})();
" "YourNewPassword"
```
