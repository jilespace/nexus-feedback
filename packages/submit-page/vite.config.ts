import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 公开提交页把 /api 代理到本地 API 服务，保持页面与接口同源。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8081,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
