# Rudhra Prarthana Novels — Production Deployment Guide

## 1. System Requirements

- **Operating System**: Linux (Ubuntu 22.04 LTS recommended) or Windows Server
- **Node.js**: v18.0.0 or v20+ LTS
- **MySQL**: 8.0+
- **Process Manager**: PM2 or Systemd
- **Web Server / Reverse Proxy**: Nginx

---

## 2. Server Setup & Repository Setup

### 2.1 Clone Repository & Install Dependencies
```bash
git clone <your-repo-url> rudhra-prarthana-novels
cd rudhra-prarthana-novels

# Install dependencies for root orchestrator, frontend, and backend
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
```

### 2.2 Configure Environment (`.env`)
Create a production `.env` file at the project root (and/or in `backend/`):
```ini
# MySQL 8.0 Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=rp_admin
DB_PASSWORD=YourStrongDatabasePassword!
DB_NAME=rp_novels_db

# Application Server Port
PORT=3000
HOST=127.0.0.1

# SMTP Email Configuration (Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=trendup089@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM="Rudhra Prarthana Novels" <trendup089@gmail.com>

# Web Push VAPID Keys
VAPID_PUBLIC_KEY=BCK-55p--iO8wkCpzGcGvdrYWp9ruekz8jnSSt--PErFZHasPhH6Vilu1HDinVejaYMfms8oHDsmjQ33PqUedwk
VAPID_PRIVATE_KEY=sHj0L9CjNVINju26MrfKOLV73SoIIU1npyaeNqrR0lo
VAPID_SUBJECT=mailto:admin@rpnovels.com
```

### 2.3 Initialize & Migrate Database
```bash
npm run migrate
```
Or import the complete baseline schema directly:
```bash
mysql -u rp_admin -p rp_novels_db < db/schema/full_schema.sql
```

## 2.4 GoDaddy Node.js Hosting (cPanel)

GoDaddy's Node.js application manager supplies the listening port through the
`PORT` environment variable. Configure the application as follows:

| Setting | Value |
|---|---|
| Node.js version | 18 or newer LTS |
| Application mode | Production |
| Application root | The repository root containing `package.json` |
| Application URL | Your domain or subdomain |
| Startup file | `backend/server.js` |
| Environment variable | `NODE_ENV=production` |
| Environment variable | `HOST=0.0.0.0` |

Do not set a fixed `PORT`; GoDaddy assigns it. Add the database, email, JWT,
and VAPID variables from your private production configuration in cPanel's
environment-variable section. Do not commit those values to Git.

After creating the application, open cPanel Terminal and run:

```bash
cd /home/CPANEL_USER/YOUR_APP_ROOT
npm install --omit=optional
npm run build
npm run migrate
```

The `build` command installs the locked frontend dependencies and creates
`frontend/dist/`, which `backend/server.js` serves. Restart the Node.js
application from cPanel after the build and whenever environment variables
change. Verify the deployment at `/api/health` before testing the website.

GoDaddy's Node.js application proxy handles HTTPS and forwards requests to the
assigned port, so PM2, Nginx, Cloudflare Tunnel, and a separate Vite server are
not required on the hosting account.

---

## 3. Production Frontend Build

Build the optimized client bundle:
```bash
npm run build
```
The production bundle will be generated into `frontend/dist/`. The backend server automatically detects and serves `frontend/dist/` in production.

---

## 4. Process Management (PM2)

Using PM2 ensures automatic restarts, clustering, and log rotation:

```bash
# Install PM2 globally
npm install -g pm2

# Start the Node.js backend
pm2 start backend/server.js --name "rp-novels-api"

# Save process list and enable on startup
pm2 save
pm2 startup
```

To monitor logs:
```bash
pm2 logs rp-novels-api
pm2 status
```

---

## 5. Nginx Reverse Proxy Configuration

Create an Nginx configuration file: `/etc/nginx/sites-available/rpnovels.conf`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Maximum file upload size (for 50MB audio and 10MB media)
    client_max_body_size 60M;

    # Static uploads served directly by Nginx (for highest performance)
    location /uploads/ {
        alias /var/www/rudhra-prarthana-novels/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # Pass all other traffic to Node.js backend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site and configure SSL:
```bash
sudo ln -s /etc/nginx/sites-available/rpnovels.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install free Let's Encrypt SSL
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 6. Backup & Recovery

Daily automated backup of MySQL and user uploads:
```bash
# Backup MySQL
mysqldump -u rp_admin -p rp_novels_db > /backups/db_$(date +%Y%m%d).sql

# Backup Uploads directory
tar -czf /backups/uploads_$(date +%Y%m%d).tar.gz backend/uploads/
```
