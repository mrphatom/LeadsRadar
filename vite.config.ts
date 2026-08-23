import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
    },
    server: {
      // Set DISABLE_HMR=true for constrained development environments where file watching is unavailable.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching with the same explicit flag to keep local resource use predictable.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
