// Trims dist-ios/ (npm run build:ios, docs/APP_STORE.md) before Capacitor copies it into the Xcode project. The app
// loads the game from its own bundle, so there is no download limit to meet; this only leaves out what the app never
// loads, to keep the install small. The music stays at its full 160 kbps and the models as they are.
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'dist-ios';

// the Meshy test skaters (DEV TOOLS only, off in this build), the home screen app's icons and manifest (the page tags
// are stripped by vite.config.ts; the app has its own icon), the web site's privacy and support pages, and notes
for (const p of ['models/meshy', 'icons', 'manifest.webmanifest', 'music/README.md', 'privacy.html', 'support.html']) rmSync(join(DIR, p), { recursive: true, force: true });
// the far backdrops of the old separate worlds, as in scripts/crazygames/pack.mjs (only the ?biome= dev flag shows them)
for (const b of ['atlantis_dragon', 'atlantis_wave', 'clemente', 'hightech', 'museum_city', 'space_stars']) rmSync(join(DIR, 'tex', `bkgd_${b}.png`), { force: true });

const files = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(DIR);
const total = files.reduce((n, f) => n + statSync(f).size, 0);
const html = readFileSync(join(DIR, 'index.html'), 'utf8');
// the app serves the page from capacitor://localhost/, so a path from the root would still work, but the build keeps
// relative ones like every other target (base: './')
const absolute = [...html.matchAll(/(?:src|href)="(\/[^"/][^"]*)"/g)].map((m) => m[1]);
if (absolute.length) {
  console.error(`absolute paths in index.html: ${absolute.join(', ')}`);
  process.exit(1);
}
if (/manifest\.webmanifest|apple-touch-icon/.test(html)) {
  console.error('index.html still links the home screen app files');
  process.exit(1);
}
console.log(`dist-ios: ${files.length} files, ${(total / 1048576).toFixed(1)} MB`);
