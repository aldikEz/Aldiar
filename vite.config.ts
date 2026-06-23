import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('node_modules') === -1) return undefined;
          if (id.indexOf('react') !== -1 || id.indexOf('react-dom') !== -1) return 'react-vendor';
          if (id.indexOf('@supabase') !== -1) return 'supabase-vendor';
          if (id.indexOf('framer-motion') !== -1) return 'motion-vendor';
          if (id.indexOf('lucide-react') !== -1) return 'icons-vendor';
          if (id.indexOf('gsap') !== -1) return 'animation-vendor';
          return 'vendor';
        },
      },
    },
  },
});
