import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { pwa } from './pwa/plugin.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './', // relative paths, so the built app also works from a sub-folder
  plugins: [svelte(), pwa()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: { include: ['src/**/*.test.js', 'pwa/**/*.test.js'] }
});
