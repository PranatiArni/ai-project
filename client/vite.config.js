import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API_URL lets the browser test run against its own API server.
      '/api': process.env.API_URL || 'http://localhost:3001',
    },
  },
})
