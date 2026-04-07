import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const slug = env.VITE_APP_SLUG || 'elpollocomilon';
  
  return {
    base: `/${slug}/`, // Ensure assets load correctly from the subpath
    plugins: [react()],
  server: {
    allowedHosts: ['.ngrok-free.app', '.loca.lt', 'all'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts': ['recharts'],
          'vendor-maps': ['leaflet', 'react-leaflet'],
          'vendor-flow': ['reactflow'],
          'vendor-ui': ['lucide-react', 'sonner', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
})
