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
      // Two independent pages: the lesson stage and the daily-task card. Separate entries rather
      // than one page with a mode flag — they share nothing but the capture contract, and a
      // shared bundle would make each capture load the other's code.
      input: {
        index: path.resolve(__dirname, 'index.html'),
        task: path.resolve(__dirname, 'task.html'),
      },
      output: {
        // Deterministic names — each capture loads exactly one script.
        manualChunks: undefined,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
