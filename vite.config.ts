import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative asset paths so the build works from any static host sub-path.
  base: './',
  // Listen on all interfaces so the dev server is reachable from a phone on the same network.
  server: { host: true },
  build: {
    // Skin images stay separate files: inlined, every skin would end up in the bundle whether used or not.
    assetsInlineLimit: (file) => (file.replace(/\\/g, '/').includes('/skins/') ? false : undefined),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
