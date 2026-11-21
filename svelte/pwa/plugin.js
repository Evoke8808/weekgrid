// Vite plugin: after a production build, write dist/sw.js from pwa/sw.js with the list
// of built files and a version hash, so each deploy gets a fresh offline cache.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const TEMPLATE = fileURLToPath(new URL('./sw.js', import.meta.url));
// Personal or editor-only files that must not be precached
const SKIP = [/^sw\.js$/, /^my-timetable\.js$/, /\.map$/, /(^|\/)\./];

export function listFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.filter((f) => !SKIP.some((re) => re.test(f))).sort();
}

export function buildSw(dir) {
  const files = listFiles(dir);
  const hash = createHash('sha256');
  for (const f of files) hash.update(f).update(readFileSync(join(dir, f)));
  const version = hash.digest('hex').slice(0, 10);
  const src = readFileSync(TEMPLATE, 'utf8')
    .replace("'__VERSION__'", JSON.stringify(version))
    .replace('__FILES__', JSON.stringify(files));
  writeFileSync(join(dir, 'sw.js'), src);
  return { version, files };
}

export function pwa() {
  let outDir;
  return {
    name: 'weekgrid-sw',
    apply: 'build',
    configResolved(c) { outDir = join(c.root, c.build.outDir); },
    closeBundle() {
      const { version, files } = buildSw(outDir);
      this.info?.(`sw.js ${version}: ${files.length} files precached`);
    }
  };
}
