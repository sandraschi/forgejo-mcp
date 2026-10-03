import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 11132,
    strictPort: true,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:11133',
        changeOrigin: true
      },
      '/docs': {
        target: 'http://localhost:11133',
        changeOrigin: true
      },
      '/openapi.json': {
        target: 'http://localhost:11133',
        changeOrigin: true
      },
      '/redoc': {
        target: 'http://localhost:11133',
        changeOrigin: true
      }
    }
  }
})
