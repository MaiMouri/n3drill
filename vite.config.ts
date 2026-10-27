import { defineConfig } from 'vitest/config';

// base './' makes the built site work from any sub-path (GitHub Pages project sites).
export default defineConfig({
  base: './',
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
