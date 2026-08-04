import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Dev: proxy API ke Django lokal (port sama dengan API_BASE_DEV di app RN)
    proxy: {
      '/api': 'http://localhost:8123',
      '/media': 'http://localhost:8123',
    },
  },
})
