// Z-fighting audit: opens floors in headless Chromium, finds coplanar overlapping surfaces in the built scene
// (detect.js) and takes a close still of each spot.
//
//   node scripts/zfight/run.mjs [--url http://localhost:5173/] [--floors 1,2,5] [--seed 1201] [--shots 12] [--out dir]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1];
};
const OUT = opt('out', 'zfight-report');
const FLOORS = String(opt('floors', '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15')).split(',').map(Number);
const SEED = Number(opt('seed', 1201));
const SHOTS = Number(opt('shots', 8));
// --join: wait for the next floor's kit to build past the end, show it, and check only round the join
const JOIN = args.includes('--join');
const DETECT = readFileSync(new URL('./detect.js', import.meta.url), 'utf8').trim().replace(/;$/, '');
mkdirSync(`${OUT}/shots`, { recursive: true });

async function startVite() {
  const port = 5179;
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('vite did not start')), 60000);
    vite.stdout.on('data', (d) => String(d).includes('Local') && (clearTimeout(t), ok()));
  });
  return { base: `http://localhost:${port}/`, stop: () => vite.kill() };
}

const server = opt('url', null) ? { base: opt('url'), stop: () => {} } : await startVite();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = [];
for (const floor of FLOORS) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.log('  page error', e.message.slice(0, 200)));
  await page.goto(`${server.base}?seed=${SEED}&floor=${floor}&debug&unlockall${opt('extra', '') ? '&' + opt('extra') : ''}`);
  await page.waitForFunction(() => window.game?.view?.currentKit && window.game.state === 'skate', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  let joinX = null;
  if (JOIN) {
    await page.waitForFunction(() => [...window.game.view.aheads.values()].some((a) => a.kit), null, { timeout: 180000 });
    joinX = await page.evaluate(() => {
      const v = window.game.view;
      const [key, a] = [...v.aheads.entries()].find(([, a]) => a.kit);
      v.showAhead(key);
      return a.at.x;
    });
  }
  // freeze the game where it is and hide the HUD, so the stills show only the level
  await page.evaluate(() => {
    window.requestAnimationFrame = () => 0; // the loop stops after this frame
    const st = document.createElement('style');
    st.textContent = 'body * { visibility: hidden !important } canvas { visibility: visible !important }';
    document.head.appendChild(st);
  });
  // the cameras that might see a spot: the game's, following a skater on the street over it, and one on the spot's
  // own level (down in a sewer, up on a roof); null when the spot is off that camera's screen
  const r = await page.evaluate(`(${DETECT})({ scene: window.game.view.scene, epsD: ${Number(opt('eps', 0.004))}, cams: (p) => {
    const v = window.game.view, L = window.game.level, out = [];
    for (const y of [0, p[1] + 0.3]) {
      v.follow(p[0] * 32, L.streetY - y * 32);
      v.camera.updateMatrixWorld();
      v.camera.updateProjectionMatrix();
      const q = v.camera.position.clone().set(p[0], p[1], p[2]).project(v.camera);
      out.push(Math.abs(q.x) < 1 && Math.abs(q.y) < 1 && q.z < 1 ? v.camera.position.toArray() : null);
    }
    return out;
  } })`);
  const level = await page.evaluate(() => {
    const L = window.game.level;
    return { streetY: L.streetY, startX: L.startX, exitX: L.exitX, grass: L.grass?.map((g) => [g.x0, g.x1]) ?? [], sewers: L.sewers?.map((s) => [s.x0 ?? s.in, s.x1 ?? s.out]) ?? [] };
  }).catch(() => ({}));
  const top = r.clusters.filter((c) => !c.same && c.seen && (joinX === null || Math.abs(c.at[0] - joinX) < 30));
  if (joinX !== null) console.log(`  join at x ${joinX.toFixed(1)}`);
  console.log(`floor ${floor}: ${r.meshes} meshes, ${r.tris} tris, ${r.clusters.length} clusters (${r.clusters.filter((c) => !c.same).length} with different materials, ${top.length} of them in the game camera's view)`);
  const shown = [];
  for (const [i, c] of top.slice(0, SHOTS).entries()) {
    const file = `shots/f${floor}${JOIN ? 'j' : ''}-${i}.png`;
    // the game's own camera, following a skater standing at the spot, and a ring round it
    await page.evaluate(([at, i]) => {
      const v = window.game.view;
      const L = window.game.level;
      v.follow(at[0] * 32, L.streetY - at[1] * 32);
      v.camera.updateMatrixWorld();
      v.render();
      const p = { x: at[0], y: at[1], z: at[2] };
      const q = v.camera.position.clone().set(p.x, p.y, p.z).project(v.camera);
      let ring = document.getElementById('zf-ring');
      if (!ring) {
        ring = document.createElement('div');
        ring.id = 'zf-ring';
        ring.style.cssText = 'position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border:3px solid #ff2bd6;border-radius:50%;z-index:99999;pointer-events:none;visibility:visible !important';
        document.body.appendChild(ring);
      }
      ring.style.left = `${((q.x + 1) / 2) * innerWidth}px`;
      ring.style.top = `${((1 - q.y) / 2) * innerHeight}px`;
    }, [c.at, i]);
    await page.screenshot({ path: `${OUT}/${file}` });
    shown.push(file);
  }
  const fam = {};
  for (const c of top) {
    const k = c.mats.map((m) => `${r.mats[m].type.replace('Mesh', '').replace('Material', '')}:${r.mats[m].surface || ''}:${r.mats[m].color}`).join(' + ') + ` n=${c.n.map((x) => Math.round(x)).join(',')}`;
    fam[k] = fam[k] ?? { area: 0, n: 0, at: [] };
    fam[k].area += c.area;
    fam[k].n++;
    if (fam[k].at.length < 6) fam[k].at.push(c.at.map((x) => +x.toFixed(1)));
  }
  for (const [k, f] of Object.entries(fam).sort((a, b) => b[1].area - a[1].area).slice(0, 25)) console.log(`  ${f.area.toFixed(1).padStart(7)} ${String(f.n).padStart(4)}  ${k}  ${JSON.stringify(f.at.slice(0, 3))}`);
  report.push({ floor, fam, level, mats: r.mats, clusters: r.clusters.map((c) => ({ ...c, at: c.at.map((x) => +x.toFixed(2)), min: c.min.map((x) => +x.toFixed(2)), max: c.max.map((x) => +x.toFixed(2)), area: +c.area.toFixed(3), mats: c.mats.map((m) => r.mats[m]) })), shots: shown });
  await page.close();
  writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 1));
}
await browser.close();
server.stop();
