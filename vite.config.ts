import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // /api/* 를 Firebase 호스팅 에뮬레이터로 넘긴다. 에뮬레이터가 firebase.json 의
      // /api/* → 함수 rewrite 를 적용한다. (이 머신은 5000이 macOS AirPlay 점유 → 5055)
      '/api': { target: 'http://127.0.0.1:5055', changeOrigin: true },
    },
  },
})
