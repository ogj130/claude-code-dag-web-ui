import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5400,
    proxy: {
      '/ws': {
        target: 'ws://localhost:5300',
        ws: true,
        // 长连接超时 5 分钟，避免代理提前断开
        timeout: 300_000,
      }
    }
  }
})
