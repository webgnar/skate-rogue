// In-game stills of the street cars (the Prius and the blender bot cars) clean and damaged, in the game's ink look.
//   npx vite --port 5181 &  then  node .claude/skills/blender-bot/car_shots.mjs http://localhost:5181/ <out prefix>
import { chromium } from 'playwright';
const base = process.argv[2]; const out = process.argv[3]; const night = process.argv[4] === 'night';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.goto(`${base}?seed=1201&floor=1&debug${night ? '&night' : ''}`);
await page.waitForFunction(() => window.game?.state === 'skate' || window.game?.playtest?.state === 'skate', null, { timeout: 180000 }).catch(() => {});
await page.waitForTimeout(1500);
const r = await page.evaluate(async () => {
  const THREE = await import('/node_modules/.vite/deps/three.js').catch(() => null);
  const kit = await import('/src/render/kit.ts');
  const toon = await import('/src/render/toon.ts');
  const dmg = await import('/src/render/car-damage.ts');
  const view = window.game.view;
  const lou = view.actor.children[0];
  const p = lou.getWorldPosition(lou.position.clone());
  const rows = [
    [['Sedan', ''], ['Wagon', ''], ['Coupe', ''], ['KeiVan', '']],
    [['Wagon', '_dent'], ['Coupe', '_bust'], ['KeiVan', '_wreck'], ['Wagon', '_wreck']],
  ];
  const paints = [0xe8c33a, 0x3a7be8, 0xd94a4a, 0x48b86a];
  const root = lou.parent.parent ? view.scene : view.scene;
  const made = [];
  rows.forEach((row, ri) => row.forEach(([kind, v], i) => {
    const x0 = p.x - 16 + i * (ri ? 3.6 : 3.1);
    const car = kit.makeCar(x0, x0 + 2, p.y, p.y + 1.25, paints[i], kind, v);
    if (v) dmg.damagedLook(car, kind, ['', '_dent', '_bust', '_wreck'].indexOf(v), i);
    car.position.z = 0;
    toon.inkify(car);
    view.scene.add(car);
    car.visible = ri === 0;
    made.push(car);
  }));
  for (const el of document.body.querySelectorAll('*')) if (el.tagName !== 'CANVAS' && !el.querySelector('canvas')) el.style.visibility = 'hidden';
  window.__shot = { p: { x: p.x, y: p.y }, row: 0 };
  const orig = view.render.bind(view);
  view.render = () => {
    const s = window.__shot;
    const cx = s.p.x - 16 + 1.5 * (s.row ? 3.6 : 3.1) + 1;
    const y = s.p.y;
    made.forEach((c, k) => (c.visible = (k < 4) === (s.row === 0)));
    view.lensK = 0;
    view.camera.fov = 30; view.camera.updateProjectionMatrix();
    view.camera.position.set(cx - 2.0, y + 3.2, s.row ? 13.5 : 12);
    view.camera.lookAt(cx, y + 0.55, 0);
    view.camera.updateMatrixWorld();
    orig();
  };
  return { p, cars: made.length, models: ['Wagon', 'Coupe', 'KeiVan'] };
});
console.log(JSON.stringify(r));
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}-clean.png` });
await page.evaluate(() => (window.__shot.row = 1));
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}-damage.png` });
await browser.close();
