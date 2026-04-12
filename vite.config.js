import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    port: 5176,
    hmr: {
      host: 'localhost',
      port: 5176,
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    chunkSizeWarningLimit: 800,
    target: 'es2020',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-router')) return 'vendor-router';
          if (id.includes('node_modules/date-fns')) return 'vendor-datefns';
          if (id.includes('node_modules/axios')) return 'vendor-axios';
          if (id.includes('node_modules/socket.io')) return 'vendor-socket';
          // recharts/d3 and @radix-ui MUST stay in vendor-misc with React
          // to avoid circular chunk "Cannot access before initialization" errors.
          if (id.includes('node_modules')) return 'vendor-misc';
        },
      },
    },
  },
})
