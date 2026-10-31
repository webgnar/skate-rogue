// Frame cost at small-iPhone sizes (iPhone SE, upright and sideways): headless Chromium, the bot skating, and the
// game's own numbers per frame: CPU ms for the whole frame and for the render call, draw calls, and node matrices
// updated. SwiftShader draws on the CPU, so its frame rate isn't a phone's: compare CPU, draws and matrices.
//
//   npm run perf [-- --url http://localhost:5173/] [--secs 30] [--q "seed=1201&floor=1"]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const SECS = Number(opt('secs', 30));
const Q = opt('q', 'seed=1201&floor=1');
const PHONES = [
  { id: 'SE upright', width: 375, height: 667 },
  { id: 'SE sideways', width: 667, height: 375 },
];

async function startVite() {
  const port = 5177;
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('vite did not start in 60 s')), 60000);
    vite.stdout.on('data', (d) => String(d).includes('Local') && (clearTimeout(t), ok()));
    vite.on('exit', (c) => fail(new Error(`vite exited with ${c} (port ${port} taken? pass --url)`)));
  });
  return { base: `http://localhost:${port}/`, stop: () => vite.kill() };
}

async function measure(browser, base, phone) {
  //device scale 1: SwiftShader filling a phone's real pixel count would swamp the CPU numbers
  const context = await browser.newContext({ viewport: phone, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`${base}?${Q}&bot&fx=high&unlockall&turbo=2`);
  await page.waitForFunction(() => window.game?.playtest?.state === 'skate', null, { timeout: 120000 });
  //hold the resolution and lens: SwiftShader's slow frames would step them down
  await page.evaluate(() => (window.game.view.adapt = () => {}));
  await page.waitForTimeout(3000);
  const r = await page.evaluate(async (secs) => {
    const g = window.game;
    const v = g.view;
    const O = Object.getPrototypeOf(Object.getPrototypeOf(v.scene)); // Object3D.prototype
    let mats = 0;
    const um = O.updateMatrix;
    O.updateMatrix = function () {
      mats++;
      return um.call(this);
    };
    const frame = g.frame.bind(g);
    const render = v.render.bind(v);
    const cpu = [];
    const draws = [];
    let rms = 0;
    v.render = () => {
      const t = performance.now();
      render();
      rms += performance.now() - t;
      draws.push(v.renderer.info.render.calls);
    };
    g.frame = (n) => {
      const t = performance.now();
      frame(n);
      cpu.push(performance.now() - t);
    };
    await new Promise((ok) => setTimeout(ok, secs * 1000));
    g.frame = frame;
    v.render = render;
    O.updateMatrix = um;
    const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
    const p95 = [...cpu].sort((a, b) => a - b)[Math.floor(cpu.length * 0.95)];
    return { frames: cpu.length, cpu: avg(cpu), p95, render: rms / Math.max(1, cpu.length), draws: avg(draws), drawsMax: Math.max(...draws), matrices: mats / Math.max(1, cpu.length) };
  }, SECS);
  await context.close();
  const f = (x) => x.toFixed(1);
  return `${phone.id}: cpu ${f(r.cpu)} ms (p95 ${f(r.p95)}) · render ${f(r.render)} ms · ${Math.round(r.draws)} draws (max ${r.drawsMax}) · ${Math.round(r.matrices)} matrices · ${r.frames} frames`;
}

const url = opt('url', null);
const vite = url ? null : await startVite();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  for (const p of PHONES) console.log(await measure(browser, url ?? vite.base, p));
} finally {
  await browser.close();
  vite?.stop();
}
