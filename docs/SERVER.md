# Rudhra Prarthana Novels — Server Architecture & Operational Manual

A comprehensive guide to activating, managing, monitoring, troubleshooting, and inactivating the servers for the **Rudhra Prarthana Novels** platform.

---

## 1. System Architecture Overview

The system consists of coordinated server components:

```
[CLIENT BROWSER / USER]
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 1. BACKEND HTTP & API SERVER (backend/server.js)                      │
│    • Default Port: 3000 (configurable via process.env.PORT)            │
│    • REST API endpoints (/api/*)                                       │
│    • Production SPA static file serving (frontend/dist)                │
│    • Uploads & media asset streaming (/uploads/*)                      │
│    • Automated chapter publishing scheduler (runs every 30s)           │
│    • Auto-migrations runner on startup                                 │
└───────────────────┬──────────────────────────────────┬─────────────────┘
                    │                                  │
                    ▼                                  ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│ 2. MYSQL DATABASE SERVER             │  │ 3. FRONTEND DEV SERVER (OPT) │
│    • Default Port: 3306              │  │    • Default Port: 5173      │
│    • Database: rp_novels_db          │  │    • Vite Hot Reload (HMR)   │
└──────────────────────────────────────┘  └──────────────────────────────┘
                    ▲
                    │
┌───────────────────┴────────────────────────────────────────────────────┐
│ 4. CLOUDFLARE PUBLIC TUNNEL (Optional, cloudflared)                    │
│    • Bridges http://localhost:3000 to a public HTTPS domain            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Prerequisites & Environment Configuration

### Software Requirements
- **Node.js**: v18.0.0 or later (v20+ / v24+ recommended)
- **MySQL Server**: 8.0 or later running on port `3306`
- **npm**: Package manager (installed with Node.js)

### Environment File (`backend/.env` or `.env`)
```ini
PORT=3000
HOST=0.0.0.0
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=rp_novels_db
JWT_SECRET=your_jwt_secret_key
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password
```

---

## 3. How to Activate (Start) the Server

### 3.1. Standard Mode (Backend & Production Web Server — Port 3000)
In standard production mode, the Node.js server serves both the API and the compiled frontend single-page application.

1. Navigate to the project root:
   ```powershell
   cd "d:\novel website development\novel website development"
   ```
2. Build the frontend production bundle (required once or after frontend edits):
   ```powershell
   npm run build
   ```
3. Start the server:
   ```powershell
   npm start
   # or: node backend/server.js
   ```

**Expected Console Output:**
```
[Migration] All migrations completed successfully.
✓ MySQL Database Connected successfully [Host: localhost:3306, DB: rp_novels_db, Tables: 50]
✓ Rudhra Prarthana Novels Backend running on http://localhost:3000
```

**Access URLs:**
- **Website & Forum:** [http://localhost:3000/#forms](http://localhost:3000/#forms)
- **Admin Management:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **API Health & Hierarchy:** [http://localhost:3000/api/content/hierarchy](http://localhost:3000/api/content/hierarchy)

---

### 3.2. Full-Stack Development Mode (Backend + Vite Hot Reload)
Use this mode when making rapid CSS or UI changes:

- **Terminal 1 (Backend API on Port 3000):**
  ```powershell
  npm start
  ```
- **Terminal 2 (Frontend Dev Server on Port 5173):**
  ```powershell
  npm run dev
  ```
- **Access URL:** [http://localhost:5173](http://localhost:5173)

---

### 3.3. Background Daemon Mode (Windows PowerShell)
To run the server in the background so it remains active after closing the terminal:

```powershell
Start-Process -FilePath 'node' -ArgumentList 'backend/server.js' -WorkingDirectory 'd:\novel website development\novel website development' -WindowStyle Hidden
```

Verify it is running:
```powershell
Get-NetTCPConnection -LocalPort 3000
```

---

### 3.4. Production Process Manager (PM2)
PM2 ensures auto-restart on crashes and startup on system boot:

```powershell
# Install PM2 globally (one-time)
npm install -g pm2

# Start the server
pm2 start backend/server.js --name "rp-novels-backend"

# Save configuration
pm2 save

# View logs and live status
pm2 logs rp-novels-backend
pm2 monit
```

---

### 3.5. Public Cloudflare Tunnel
To share the local application publicly over HTTPS:

```powershell
npm run tunnel
# or: cloudflared tunnel --url http://localhost:3000
```

---

## 4. How to Inactivate (Stop / Deactivate) the Server

### 4.1. Foreground Terminal
If running in an interactive terminal, press:
```
Ctrl + C
```
and type `Y` if prompted to terminate batch job.

---

### 4.2. Port-Targeted Inactivation (PowerShell)
Safely kill the exact process listening on Port 3000 without affecting other apps:

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

To stop both Port 3000 (Backend) and Port 5173 (Vite):
```powershell
3000, 5173 | ForEach-Object {
  Get-NetTCPConnection -LocalPort $_ -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
}
```

---

### 4.3. Windows Command Prompt (CMD)
Find the process ID on Port 3000:
```cmd
netstat -ano | findstr :3000
```
Kill by PID:
```cmd
taskkill /F /PID <PID_NUMBER>
```

---

### 4.4. Termination by Process Name
> [!CAUTION]
> This command stops **all** Node.js processes running on your computer.

- **PowerShell:**
  ```powershell
  Stop-Process -Name node -Force
  ```
- **CMD:**
  ```cmd
  taskkill /F /IM node.exe
  ```

---

### 4.5. PM2 Inactivation
```powershell
# Stop temporarily
pm2 stop rp-novels-backend

# Delete from PM2 process list
pm2 delete rp-novels-backend
```

---

## 5. How to Restart the Server (Apply Code Changes)

When you make changes to backend files (`backend/forms-content.js`, `backend/api.js`, etc.), restart the backend server with this single command:

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; Start-Process -FilePath 'node' -ArgumentList 'backend/server.js' -WorkingDirectory 'd:\novel website development\novel website development'
```

When frontend files are modified (`frontend/src/...`), recompile the bundle:
```powershell
npm run build --prefix frontend
```
Then refresh your browser (`Ctrl + Shift + R`).

---

## 6. How to Monitor & Verify Server Status

### 6.1. Check Listening Ports
```powershell
Get-NetTCPConnection -LocalPort 3000, 5173, 3306 -ErrorAction SilentlyContinue | Select-Object LocalAddress, LocalPort, OwningProcess, State
```

### 6.2. Probe HTTP API Health
```powershell
Invoke-WebRequest -Uri 'http://localhost:3000/api/content/hierarchy' -UseBasicParsing | Select-Object StatusCode, StatusDescription
```

### 6.3. List Running Node Processes
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Select-Object Id, ProcessName, WorkingSet64, StartTime
```

---

## 7. Database (MySQL) Activation & Inactivation

`backend/server.js` automatically attempts to start a local MySQL daemon if Port 3306 is not open.

To manage MySQL manually:

- **Start MySQL Service:**
  ```powershell
  net start MySQL80
  # or: Start-Service -Name MySQL80
  ```
- **Stop MySQL Service:**
  ```powershell
  net stop MySQL80
  # or: Stop-Service -Name MySQL80
  ```
- **Verify MySQL Status:**
  ```powershell
  Get-Service -Name *mysql*
  ```

---

## 8. Automated Background Publishing Scheduler

Inside `backend/server.js`:
- An automated scheduler (`runAutomatedPublishingScheduler`) runs every **30 seconds**.
- Checks for scheduled chapters (`status = 'Scheduled'` and `scheduled_at <= NOW()`).
- Automatically transitions due chapters to `status = 'published'`.
- Broadcasts Web Push notifications to subscribed users.
- **Requirement:** Keep the backend server running to allow scheduled publishing to execute on time.

---

## 9. Troubleshooting & Quick Solutions

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `EADDRINUSE: address already in use :::3000` | Port 3000 already occupied by another Node process | Run: `Get-NetTCPConnection -LocalPort 3000 \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL server is stopped | Run: `net start MySQL80` and verify port 3306 is listening |
| `500 — SERVER ERROR` | Client-side routing exception or backend error | Check browser DevTools console (F12) for stack trace; re-run `npm run build` |
| CSS/JS changes do not reflect | Browser caching or unbuilt bundle | Run `npm run build` and do a hard refresh with `Ctrl + Shift + R` |

---

## 10. Quick Command Summary

```powershell
# 1. Start backend server
npm start

# 2. Build production frontend SPA
npm run build

# 3. Check if server is listening on port 3000
Get-NetTCPConnection -LocalPort 3000

# 4. Stop server on port 3000
Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# 5. One-line restart
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }; Start-Process node -ArgumentList 'backend/server.js' -WorkingDirectory 'd:\novel website development\novel website development'
```

