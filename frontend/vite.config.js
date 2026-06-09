import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: {
    target: 'es2020',
    cssTarget: 'firefox100',
  },
  plugins: [
    react(),
    {
      name: 'history-api-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && !req.url.startsWith('/@') && !req.url.startsWith('/api') && !req.url.includes('.')) {
            req.url = '/index.html'
          }
          next()
        })
      },
    },
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
