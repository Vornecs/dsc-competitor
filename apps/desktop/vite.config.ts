import { defineConfig } from 'vite';

export default defineConfig({
  root: 'harness',
  base: './',
  build: {
    emptyOutDir: false,
    outDir: '../dist/renderer',
  },
});
