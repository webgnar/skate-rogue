// A still of one spot on a floor, for checking a z-fight by eye:
//   node scripts/zfight/look.mjs --url http://localhost:5173/ --floor 1 --seed 1201 --at x,y,z [--from dx,dy,dz] [--game] --out f.png
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1] ?? true;
};
const at = String(opt('at')).split(',').map(Number);
const from = String(opt('from', '0,2,8')).split(',').map(Number);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${opt('url')}?seed=${opt('seed', 1201)}&floor=${opt('floor', 1)}&debug&unlockall${opt('extra', null) ? '&' + opt('extra') : ''}`);
await page.waitForFunction(() => window.game?.view?.currentKit && window.game.state === 'skate', null, { timeout: 120000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.requestAnimationFrame = () => 0;
  const st = document.createElement('style');
  st.textContent = 'body * { visibility: hidden !important } canvas { visibility: visible !important }';
  document.head.appendChild(st);
});
await page.waitForTimeout(200);
await page.evaluate(([at, from, game]) => {
  const v = window.game.view;
  if (game) {
    v.follow(at[0] * 32, window.game.level.streetY - at[1] * 32);
    v.render();
    return;
  }
  v.camera.position.set(at[0] + from[0], at[1] + from[1], at[2] + from[2]);
  v.camera.lookAt(at[0], at[1], at[2]);
  v.camera.updateMatrixWorld();
  v.renderer.setRenderTarget(null);
  v.renderer.clear();
  v.renderer.render(v.scene, v.camera);
}, [at, from, !!opt('game', false)]);
await page.screenshot({ path: opt('out', 'look.png') });
await browser.close();
