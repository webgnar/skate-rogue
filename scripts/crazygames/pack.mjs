// Packs dist-crazygames/ (npm run build:crazygames) into dist-crazygames.zip for the CrazyGames developer portal,
// and checks it against their limits (docs/CRAZYGAMES.md): at most 1,500 files, 250 MB in all, and no absolute
// paths in the page (they serve the game from their own CDN folder, so every path must be relative).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIR = 'dist-crazygames';
const ZIP = 'dist-crazygames.zip';
const MAX_FILES = 1500;
const MAX_TOTAL = 250 * 1024 * 1024;
const MAX_INITIAL = 50 * 1024 * 1024; // what loads before the first gameplayStart
const MOBILE_HOME = 20 * 1024 * 1024; // their mobile homepage wants the initial download under this

// what the portal build never loads: the Meshy test skaters (DEV TOOLS only, off in this build), the home screen
// app's icons and manifest (the page tags are stripped by vite.config.ts), and notes
for (const p of ['models/meshy', 'icons', 'manifest.webmanifest', 'music/README.md']) rmSync(join(DIR, p), { recursive: true, force: true });

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
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
const problems = [];
if (files.length > MAX_FILES) problems.push(`${files.length} files (limit ${MAX_FILES})`);
if (total > MAX_TOTAL) problems.push(`${mb(total)} in all (limit ${mb(MAX_TOTAL)})`);
if (total > MAX_INITIAL) problems.push(`${mb(total)} could all load before play (limit ${mb(MAX_INITIAL)})`);
const html = readFileSync(join(DIR, 'index.html'), 'utf8');
const absolute = [...html.matchAll(/(?:src|href)="(\/[^"/][^"]*)"/g)].map((m) => m[1]);
if (absolute.length) problems.push(`absolute paths in index.html: ${absolute.join(', ')}`);
if (!html.includes('index-') && !html.includes('assets/')) problems.push('index.html has no bundled script');

console.log(`${files.length} files, ${mb(total)}${total > MOBILE_HOME ? ` (over the ${mb(MOBILE_HOME)} mobile homepage mark)` : ''}`);
if (problems.length) {
  console.error(`not uploadable:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
rmSync(ZIP, { force: true });
// zip from inside the folder so index.html sits at the root of the zip, as the portal wants
execFileSync('zip', ['-qr9X', relative(DIR, ZIP), '.', '-x', '.*'], { cwd: DIR, stdio: 'inherit' });
console.log(`wrote ${ZIP} (${mb(statSync(ZIP).size)})`);
