import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // 127.0.0.1, not "localhost": on Windows Node resolves localhost to IPv6
      // (::1) first, but Flask binds IPv4 only, so the proxy would 500.
      '/api': 'http://127.0.0.1:3001',
    },
  },
})
