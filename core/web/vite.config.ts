import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The lesson page is built to a static bundle and served from disk during capture.
// No dev server in the capture path: HMR and lazy chunks are nondeterminism.
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // One chunk, deterministic names — the capture loads exactly one script.
        manualChunks: undefined,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
