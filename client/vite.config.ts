import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Spring Boot backend. Everything under /api (REST + WebSocket) and /uploads is proxied to it,
// so the browser only ever talks to the Vite server and we don't need CORS.
const backend = process.env.BACKEND_URL ?? 'http://localhost:5000'

const proxy = {
  '/api': { target: backend, changeOrigin: true, ws: true },
  '/uploads': { target: backend, changeOrigin: true },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
})
