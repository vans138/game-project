import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite 配置：React 插件 + 开发服务器
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 允许局域网/手机同一网络访问，方便移动端调试
    port: 5173,
  },
})