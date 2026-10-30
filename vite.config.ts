import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works from any static host sub-path.
  base: './',
  build: {
    // Skin images stay separate files: inlined, every skin would end up in the bundle whether used or not.
    assetsInlineLimit: (file) => (file.replace(/\\/g, '/').includes('/skins/') ? false : undefined),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
