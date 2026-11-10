// Packs dist-crazygames/ (npm run build:crazygames) into dist-crazygames.zip for the CrazyGames developer portal,
// and checks it against their limits (docs/CRAZYGAMES.md): at most 1,500 files, 250 MB in all, and no absolute
// paths in the page (they serve the game from their own CDN folder, so every path must be relative).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { compressAll } from './meshopt.mjs';

const DIR = 'dist-crazygames';
const ZIP = 'dist-crazygames.zip';
const MAX_FILES = 1500;
const MAX_TOTAL = 250 * 1024 * 1024;
const MAX_INITIAL = 50 * 1024 * 1024; // what loads before the first gameplayStart
const MOBILE_HOME = 20 * 1024 * 1024; // their mobile homepage wants the initial download under this

// what the portal build never loads: the Meshy test skaters (DEV TOOLS only, off in this build), the home screen
// app's icons and manifest (the page tags are stripped by vite.config.ts), the site's privacy and support pages, and notes
for (const p of ['models/meshy', 'icons', 'manifest.webmanifest', 'music/README.md', 'privacy.html', 'support.html']) rmSync(join(DIR, p), { recursive: true, force: true });
// and the far backdrops of the old separate worlds (src/render/biomes.ts BACKDROPS): the one city only draws Chicago's
// skyline, planets and sculptures; the rest show only with the ?biome= dev flag, which leaves out a layer that's missing.
// About 0.7 MB, room for the hand-drawn card art (public/sprites/cards/art)
const OLD_BACKDROPS = ['atlantis_dragon', 'atlantis_wave', 'clemente', 'hightech', 'museum_city', 'space_stars'];
for (const b of OLD_BACKDROPS) rmSync(join(DIR, 'tex', `bkgd_${b}.png`), { force: true });

// the music at 96 kbps for the portal (160 on Vercel): the two tracks drop from 5 to 3 MB, which brings the build under
// CrazyGames' 20 MB mobile homepage mark. Needs ffmpeg; without it the tracks stay as they are.
const MUSIC_KBPS = '96k';
for (const name of readdirSync(join(DIR, 'music')).filter((n) => n.endsWith('.mp3'))) {
  const src = join(DIR, 'music', name);
  const tmp = `${src}.tmp.mp3`;
  try {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-b:a', MUSIC_KBPS, tmp]);
    renameSync(tmp, src);
  } catch {
    rmSync(tmp, { force: true });
    console.warn(`ffmpeg unavailable or failed: ${name} kept at its full bitrate`);
  }
}

// the models' meshes, losslessly compressed (EXT_meshopt_compression, scripts/crazygames/meshopt.mjs); the game decodes
// them through src/render/gltf.ts. About half the models' size
const squeezed = await compressAll(join(DIR, 'models'));
console.log(`meshes compressed: ${(squeezed.before / 1048576).toFixed(1)} MB -> ${(squeezed.after / 1048576).toFixed(1)} MB`);

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

console.log(`${files.length} files, ${mb(total)}${total > MOBILE_HOME ? ` (over the ${mb(MOBILE_HOME)} mobile homepage mark)` : ' (under the mobile homepage mark)'}`);
if (problems.length) {
  console.error(`not uploadable:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
rmSync(ZIP, { force: true });
// zip from inside the folder so index.html sits at the root of the zip, as the portal wants
execFileSync('zip', ['-qr9X', relative(DIR, ZIP), '.', '-x', '.*'], { cwd: DIR, stdio: 'inherit' });
console.log(`wrote ${ZIP} (${mb(statSync(ZIP).size)})`);
