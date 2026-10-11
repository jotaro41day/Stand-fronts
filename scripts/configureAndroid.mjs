import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const source = new URL('./android/', import.meta.url);
const native = new URL('../android/app/src/main/', import.meta.url);
const manifestFile = new URL('AndroidManifest.xml', native);
if (!existsSync(manifestFile)) throw new Error('Projeto Android ausente; rode npx cap add android.');

const java = new URL('java/com/standfronts/app/', native);
mkdirSync(java, { recursive: true });
for (const name of ['MainActivity.java', 'GameScreenPlugin.java']) {
  copyFileSync(new URL(name, source), new URL(name, java));
}

const manifest = readFileSync(manifestFile, 'utf8');
if (!manifest.includes('android:name=".MainActivity"')) {
  throw new Error('MainActivity não encontrada no AndroidManifest.xml.');
}
if (!manifest.includes('android:screenOrientation="landscape"')) {
  writeFileSync(manifestFile, manifest.replace('android:name=".MainActivity"',
    'android:name=".MainActivity"\n            android:screenOrientation="landscape"'));
}
