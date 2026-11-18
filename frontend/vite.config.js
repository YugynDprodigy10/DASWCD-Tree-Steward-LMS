import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Inside Docker Compose the API is reached at http://api:3000.
    proxy: {
      '/api': process.env.API_PROXY_TARGET || 'http://localhost:3000',
    },
    // File change events don't always cross into Docker containers, so poll there.
    watch: process.env.VITE_USE_POLLING === 'true' ? { usePolling: true, interval: 300 } : undefined,
  },
})