import { defineConfig } from 'vite';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fork } from 'node:child_process';

let backendProcess = null;

function backendPlugin() {
  return {
    name: 'backend-autostart',
    async configureServer() {
      const port = Number(process.env.PORT) || 3000;
      const isRunning = await new Promise(resolve => {
        const req = http.get(`http://127.0.0.1:${port}/api/health`, res => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(800, () => {
          req.destroy();
          resolve(false);
        });
      });

      if (!isRunning) {
        console.log(`[Vite] Starting backend server on port ${port}...`);
        try {
          const serverCandidates = [
            path.resolve(process.cwd(), '../backend/server.js'),
            path.resolve(process.cwd(), 'backend/server.js'),
            path.resolve(process.cwd(), '../server/server.js'),
            path.resolve(process.cwd(), 'server/server.js')
          ];
          const serverScript = serverCandidates.find(p => fs.existsSync(p));
          if (!serverScript) {
            console.error('[Vite] Could not locate backend server script to auto-start.');
            return;
          }

          backendProcess = fork(serverScript, [], {
            cwd: path.dirname(serverScript),
            stdio: 'inherit',
            env: { ...process.env, PORT: String(port) }
          });

          const cleanup = () => {
            if (backendProcess && !backendProcess.killed) {
              backendProcess.kill();
              backendProcess = null;
            }
          };

          process.on('exit', cleanup);
          process.on('SIGINT', () => { cleanup(); process.exit(); });
          process.on('SIGTERM', () => { cleanup(); process.exit(); });
        } catch (err) {
          console.error('[Vite] Failed to auto-start backend server:', err.message);
        }
      } else {
        console.log(`[Vite] Backend server is already running on port ${port}.`);
      }
    }
  };
}

export default defineConfig({
  plugins: [backendPlugin()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
