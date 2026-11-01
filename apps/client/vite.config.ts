import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: '../../art/src',
  build: { target: 'es2022', chunkSizeWarningLimit: 1600 },
});
