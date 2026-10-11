import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../dist/', import.meta.url);
function filesIn(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const name = `${prefix}${entry.name}`;
    return entry.isDirectory() ? filesIn(join(directory, entry.name), `${name}/`)
      : [name];
  });
}

const files = filesIn(fileURLToPath(root)).filter(file => file !== 'sw.js').sort();
const hash = createHash('sha256');
for (const file of files) {
  hash.update(file);
  hash.update(readFileSync(new URL(file, root)));
}
const cacheName = `stand-fronts-${hash.digest('hex').slice(0, 12)}`;
const precache = ['./', ...files.map(file => `./${file}`)];
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
  .replace("'__CACHE_NAME__'", JSON.stringify(cacheName))
  .replace('__PRECACHE__', JSON.stringify(precache));
writeFileSync(new URL('sw.js', root), serviceWorker);
