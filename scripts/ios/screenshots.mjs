// App Store screenshots of the iOS build (docs/APP_STORE.md): node scripts/ios/screenshots.mjs, after npm run build:ios.
// Serves dist-ios/, lets the autopilot skate a few places in the game on an iPhone-sized page, and saves each one at the
// sizes App Store Connect takes, portrait and landscape, into app-store/screenshots/ (or the folder given with --out).
//   6.9" iPhone  1320 x 2868 (440 x 956 points at 3x)   the one size App Store Connect requires; it scales it down
//   6.5" iPhone  1284 x 2778 (428 x 926 points at 3x)   kept as well, for the older slot
// Each shot also checks the store build's rules: no DEV TOOLS button, no FULL SCREEN switch, no SCORES button.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'app-store/screenshots';
const PORT = 5191;
const SIZES = [
  { name: '6.9', w: 440, h: 956 },
  { name: '6.5', w: 428, h: 926 },
];
// where the autopilot skates for each shot, and for how long (seconds at turbo 1) before the picture
const SHOTS = [
  { id: '1-title', q: '', secs: 6, title: true },
  { id: '2-street', q: 'seed=1201&floor=1&bot', secs: 14 },
  { id: '3-rooftops', q: 'seed=2207&floor=4&danger=2&bot', secs: 14 },
  { id: '4-clouds', q: 'seed=3301&floor=7&danger=2&bot', secs: 14 },
  { id: '5-station', q: 'seed=5503&floor=13&danger=3&bot', secs: 14 },
];

const server = spawn('npx', ['vite', 'preview', '--outDir', 'dist-ios', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('vite preview did not start')), 30000);
  server.stdout.on('data', (d) => String(d).includes('Local') && (clearTimeout(t), ok()));
});

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
try {
  for (const size of SIZES) {
    for (const landscape of [false, true]) {
      const viewport = landscape ? { width: size.h, height: size.w } : { width: size.w, height: size.h };
      const dir = `${OUT}/${size.name}-${landscape ? 'landscape' : 'portrait'}`;
      mkdirSync(dir, { recursive: true });
      for (const s of SHOTS) {
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
        const page = await ctx.newPage();
        page.on('pageerror', (e) => problems.push(`${s.id}: ${e.message}`));
        await page.goto(`http://localhost:${PORT}/?${s.q}`);
        // the loading screen fades and then leaves the page
        await page.waitForFunction(() => !document.getElementById('loading') || document.getElementById('loading')?.classList.contains('done'), null, { timeout: 90000 });
        await page.waitForTimeout(s.secs * 1000);
        const shown = await page.evaluate(() =>
          ['#devhead', '[data-fullscreen]', '[data-scores]'].filter((q) => {
            const el = document.querySelector(q);
            return el && !el.hidden && el.closest('[hidden]') === null && getComputedStyle(el).display !== 'none';
          }),
        );
        if (shown.length) problems.push(`${s.id}: the store build shows ${shown.join(', ')}`);
        await page.screenshot({ path: `${dir}/${s.id}.png` });
        await ctx.close();
        console.log(`${dir}/${s.id}.png`);
      }
    }
  }
} finally {
  await browser.close();
  server.kill();
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
