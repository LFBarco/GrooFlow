/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/grooflow/',
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/grooflow/api': {
        target: 'http://127.0.0.1:8091',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/grooflow\/api/, '') || '/',
      },
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-')) return 'recharts';
          if (id.includes('xlsx')) return 'xlsx';
          if (id.includes('date-fns')) return 'date-fns';
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('/react/') ||
            id.includes('\\react\\')
          ) {
            return 'react-vendor';
          }
        },
      },
    },
  },
})
