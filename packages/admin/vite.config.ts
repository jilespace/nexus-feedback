import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

const workspaceRoot = path.resolve(__dirname, '..');

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'widget-static',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Match both /nexus-feedback-widget.iife.js and /widget/nexus-feedback-widget.iife.js
          if (req.url === '/nexus-feedback-widget.iife.js' || req.url === '/widget/nexus-feedback-widget.iife.js') {
            const widgetPath = path.join(workspaceRoot, 'widget/dist/nexus-feedback-widget.iife.js');
            if (fs.existsSync(widgetPath)) {
              res.setHeader('Content-Type', 'application/javascript');
              res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              fs.createReadStream(widgetPath).pipe(res);
            } else {
              res.statusCode = 404;
              res.end('Widget not found. Run `pnpm --filter @nexus-feedback/widget build` first.');
            }
          } else {
            next();
          }
        });
      },
    },
  ],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
