import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['probe-*.test.jsx', 'probe-*.test.js', 'src/**/*.test.{js,jsx}'],
    setupFiles: ['./vitest.setup.js'],
    testTimeout: 20000,
  },
})
