import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';
import { pwa } from './pwa/plugin.js';
import { handle, memoryDb } from './api/_sync.js';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Local stand-in for the Vercel sync function, so sync works in `npm run dev` / `preview`
// without a database (data lives in memory until the server stops).
function devSync() {
  const db = memoryDb();
  const mw = async (req, res, next) => {
    if (!req.url.startsWith('/api/sync')) return next();
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const out = await handle(new Request(`http://local${req.url}`, { method: req.method, headers: req.headers, body: req.method === 'GET' ? undefined : body }), db);
    res.statusCode = out.status;
    out.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(await out.text());
  };
  return {
    name: 'weekgrid-dev-sync',
    configureServer(server) { server.middlewares.use(mw); },
    configurePreviewServer(server) { server.middlewares.use(mw); }
  };
}

export default defineConfig({
  base: './', // relative paths, so the built app also works from a sub-folder
  plugins: [svelte(), pwa(), devSync()],
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  test: { include: ['src/**/*.test.js', 'pwa/**/*.test.js', 'api/**/*.test.js'] }
});
