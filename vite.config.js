import { defineConfig } from 'vite';
import { apiMiddleware } from './server/api.js';

export default defineConfig({
  server: {
    port: 3000,
    host: true
  },
  plugins: [
    {
      name: 'local-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api', apiMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api', apiMiddleware);
      }
    }
  ]
});
