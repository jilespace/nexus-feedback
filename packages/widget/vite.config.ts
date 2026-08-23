import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-widget-to-admin',
      closeBundle() {
        // Copy the built widget to admin's dist folder for easy access
        const adminDist = path.join(__dirname, '../../admin/dist');
        const widgetIIFE = path.join(__dirname, 'dist/nexus-feedback-widget.iife.js');
        
        if (!fs.existsSync(adminDist)) {
          fs.mkdirSync(adminDist, { recursive: true });
        }
        
        fs.copyFileSync(widgetIIFE, path.join(adminDist, 'nexus-feedback-widget.iife.js'));
      },
    },
  ],
  build: {
    lib: {
      entry: 'src/index.tsx',
      name: 'NexusFeedbackWidget',
      formats: ['es', 'iife'],
      fileName: (format) => `nexus-feedback-widget.${format}.js`,
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
