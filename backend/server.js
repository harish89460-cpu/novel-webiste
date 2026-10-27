// Standalone Application Backend Server for Rudhra Prarthana Novels
// Consolidates API routing, database initialization, and static asset serving

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiMiddleware } from './api.js';
import { getDb, loadEnv, testDbConnection } from './db.js';
import { checkAndPublishDueEpisodes } from './episodes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.resolve(rootDir, 'frontend');
const distDir = path.resolve(frontendDir, 'dist');
const publicDir = path.resolve(frontendDir, 'public');
const uploadsDir = path.resolve(__dirname, 'uploads');

loadEnv();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.webm': 'audio/webm'
};

function serveStatic(req, res, targetDir, fallbackToIndex = false) {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(targetDir, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }

  // Fallback to index.html for client-side routing
  if (fallbackToIndex) {
    const indexPath = path.join(targetDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return true;
    }
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Auth-Token');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // API Route Dispatcher
  if (req.url.startsWith('/api/') || req.url === '/api') {
    req.url = req.url.replace(/^\/api/, '');
    if (!req.url.startsWith('/')) req.url = '/' + req.url;
    try {
      await apiMiddleware(req, res, () => {
        if (!res.headersSent) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
        }
      });
    } catch (err) {
      console.error('Unhandled API exception in server:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err.message || 'Internal server error' }));
      }
    }
    return;
  }

  // Direct pathname /home redirect to Forms landing page
  const cleanUrl = req.url.split('?')[0];
  if (cleanUrl === '/home') {
    res.writeHead(302, { 'Location': '/#forms' });
    return res.end();
  }

  // Direct Admin / Author / Writer Route Navigation (Serve index.html with strict no-cache headers)
  if (cleanUrl === '/admin' || cleanUrl.startsWith('/admin/') || cleanUrl === '/dashboard' || cleanUrl === '/writer' || cleanUrl.startsWith('/writer/')) {
    const indexPath = fs.existsSync(distDir) ? path.join(distDir, 'index.html') : path.join(frontendDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  // Uploaded User Assets from backend/uploads/ directory
  if (req.url.startsWith('/uploads/') || req.url === '/uploads') {
    let reqPath = req.url.split('?')[0].replace(/^\/uploads/, '');
    if (reqPath === '' || reqPath === '/') reqPath = '';
    const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(uploadsDir, safePath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    res.statusCode = 404;
    res.end('Upload not found');
    return;
  }

  // Static Assets from frontend public/ directory
  if (serveStatic(req, res, publicDir, false)) return;

  // Production Build assets from frontend dist/ directory (if built)
  if (fs.existsSync(distDir)) {
    if (serveStatic(req, res, distDir, true)) return;
  }

  // Fallback for frontend root files (index.html, profile.png, etc.)
  if (serveStatic(req, res, frontendDir, false)) return;
  if (serveStatic(req, res, rootDir, false)) return;

  res.statusCode = 404;
  res.end('Not Found');
});

// Verify MySQL connection and start server
async function startServer() {
  const dbHealth = await testDbConnection();
  if (dbHealth.ok) {
    console.log(`✓ MySQL Database Connected successfully [Host: ${dbHealth.host}:${dbHealth.port}, DB: ${dbHealth.database}, Ver: ${dbHealth.version}, Tables: ${dbHealth.tableCount}]`);
  } else {
    console.error('✗ DATABASE CONNECTION DIAGNOSTIC WARNING:');
    console.error(dbHealth.diagnostic);
  }

  server.listen(PORT, HOST, () => {
    console.log(`✓ Rudhra Prarthana Novels Backend running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  });

  // Run initial scheduled publishing check
  await checkAndPublishDueEpisodes().catch(e => console.warn('Scheduler initial run warning:', e.message));

  // Automated reliable publishing scheduler (runs every 30 seconds)
  setInterval(() => {
    checkAndPublishDueEpisodes().catch(e => console.warn('Scheduler interval warning:', e.message));
  }, 30000);
}

// Start if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

// Global process crash prevention guards
process.on('unhandledRejection', (reason) => {
  console.error('Global Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Global Uncaught Exception:', err);
});

export { server, startServer };
