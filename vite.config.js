import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5176,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          if (id.includes('node_modules/@radix-ui') || id.includes('node_modules/radix-ui')) return 'vendor-ui';
          if (id.includes('node_modules')) return 'vendor-misc';
        },
      },
    },
  },
})
