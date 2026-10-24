import { defineConfig } from 'vite';
import http from 'node:http';

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
          const { startServer } = await import('./server/server.js');
          await startServer();
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
