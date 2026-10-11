import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../node_modules/@capacitor/cli/dist/util/template.js', import.meta.url);
const source = readFileSync(file, 'utf8');
const oldCall = 'tar_1.default.extract';
const newCall = 'tar_1.extract';
if (!source.includes(oldCall) && !source.includes(newCall)) {
  throw new Error('A API de extração do Capacitor CLI mudou; revise o patch.');
}
if (source.includes(oldCall)) writeFileSync(file, source.replace(oldCall, newCall));
