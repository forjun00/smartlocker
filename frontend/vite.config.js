import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Subfolder deploys set the base, e.g. VITE_BASE=/smartlocker/ npm run build
  base: process.env.VITE_BASE || '/',
  // Inject the API base at build time (PHP no-rewrite hosts use api.php?p=)
  define: {
    'import.meta.env.VITE_API_BASE': JSON.stringify(process.env.VITE_API_BASE || ''),
  },
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
