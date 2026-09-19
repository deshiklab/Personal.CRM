import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.e2b.app', '.trycloudflare.com', '.pinggy.io', '.pinggy.link', '.pinggy.net', '.pinggy-free.link', 'localhost', '127.0.0.1'],
    hmr: { clientPort: 443 },
  },
  build: {
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
  },
})
