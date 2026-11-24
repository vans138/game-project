import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 最小化 Vite 配置：只用 React 插件
export default defineConfig({
  plugins: [react()],
});