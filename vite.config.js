import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths let the same build work at any GitHub Pages sub-path.
  base: './',
  build: {
    target: 'es2022',
    // three.js alone is ~550 kB minified; splitting it would not make the first load faster.
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
