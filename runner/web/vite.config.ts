// runner/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  server: {
    port: 4318,
    proxy: {
      '/api': 'http://localhost:4317',
      '/files': 'http://localhost:4317',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
