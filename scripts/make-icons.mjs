// Renders the home-screen icons (public/icons) from the HUD's SKATE ESCAPE mark: node scripts/make-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const font = readFileSync(new URL('../node_modules/@fontsource/bangers/files/bangers-latin-400-normal.woff2', import.meta.url)).toString('base64');
const page = (size) => `<style>
  @font-face { font-family: Bangers; src: url(data:font/woff2;base64,${font}); }
  html, body { margin: 0; width: ${size}px; height: ${size}px; overflow: hidden; }
  body { display: grid; place-items: center; background: radial-gradient(circle at 50% 40%, #4a2f80, #2a1d4a 70%); }
  .mark { font: ${size * 0.22}px/0.86 Bangers; text-align: center; transform: skewX(-8deg) rotate(-6deg);
    -webkit-text-stroke: ${size * 0.02}px #000; paint-order: stroke fill; text-shadow: ${size * 0.02}px ${size * 0.024}px 0 #000; }
  .gnar { color: #ffe23a; display: block; } .run { color: #ff2fb4; display: block; }
</style><div class="mark"><b class="gnar">SKATE</b><b class="run">ESCAPE</b></div>`;

const browser = await chromium.launch();
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(page(size));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: `public/icons/${name}` });
  await p.close();
}
await browser.close();
