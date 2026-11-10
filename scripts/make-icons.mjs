// Renders the iOS launch screen from the HUD's SKATE ESCAPE mark: node scripts/make-icons.mjs
// (the iOS app icon and the web home screen icons are the skater from the capsule art now:
//  python3 scripts/ios/app-icon.py)
//   ios/App/App/Assets.xcassets/Splash.imageset      the iOS launch screen (needs ffmpeg), 2732 px square, drawn like the loading
//                                                    screen in index.html so the hand-off to it doesn't jump
import { execFileSync } from 'node:child_process';
import { readFileSync, renameSync } from 'node:fs';
import { chromium } from 'playwright';

const font = readFileSync(new URL('../node_modules/@fontsource/bangers/files/bangers-latin-400-normal.woff2', import.meta.url)).toString('base64');
const face = `@font-face { font-family: Bangers; src: url(data:font/woff2;base64,${font}); }`;
// the launch screen fills the phone's screen from the middle (scaleAspectFill), so only about the middle 1260 px of
// the 2732 show on a phone, either way up: the mark sits well inside that
const splash = (size) => `<style>
  ${face}
  html, body { margin: 0; width: ${size}px; height: ${size}px; overflow: hidden; }
  body { display: grid; place-items: center;
    background: radial-gradient(circle, rgba(255, 47, 180, 0.16) 3px, transparent 4.2px) 0 0 / 18px 18px, radial-gradient(ellipse at 50% 40%, #2a1448, #120c1e 70%); }
  .mark { font: ${size * 0.06}px/0.9 Bangers; letter-spacing: 0.06em; white-space: nowrap; transform: skewX(-8deg) rotate(-3deg);
    -webkit-text-stroke: ${size * 0.0022}px #000; paint-order: stroke fill; text-shadow: ${size * 0.0045}px ${size * 0.0045}px 0 #000; }
  .gnar { color: #ffe23a; } .run { color: #ff2fb4; margin-left: 0.15em; }
</style><div class="mark"><b class="gnar">SKATE</b><b class="run">ESCAPE</b></div>`;

// a PNG with its alpha channel taken out (iOS wants its launch and icon images opaque)
const opaque = (path) => {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path, '-pix_fmt', 'rgb24', `${path}.rgb.png`]);
  renameSync(`${path}.rgb.png`, path);
};

const ASSETS = 'ios/App/App/Assets.xcassets';
const browser = await chromium.launch();
const shoot = async (html, size, path) => {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path });
  await p.close();
};
// one image for every screen scale (Splash.imageset/Contents.json): the launch screen is a backdrop, and three
// copies would be 5 MB more app for nothing
await shoot(splash(2732), 2732, `${ASSETS}/Splash.imageset/splash-2732x2732.png`);
opaque(`${ASSETS}/Splash.imageset/splash-2732x2732.png`);
await browser.close();
