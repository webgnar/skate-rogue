// The playtest bot in the real game: headless Chromium opens test URLs with ?bot, the autopilot skates, and this
// watches what a player would see. It reads game.playtest (the sim checks, floors and runs) and the rig's feet,
// and catches page errors, assets that 404, models that fell back to the code-built version, feet off the board,
// stretched legs and the skater leaving the screen. Screenshots go with each finding and each new floor.
//
//   node scripts/playtest/browser.mjs [--url http://localhost:5173/] [--quick] [--only floor] [--headed] [--video]
//
// Without --url it starts its own Vite dev server. Writes playtest-report/browser.json and playtest-report/shots/.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { platform } from 'node:os';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? fallback : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
};
const QUICK = !!opt('quick', false);
//--video records each scenario at real speed (turbo off, one page at a time) to playtest-report/videos, as mp4 when
//ffmpeg is installed
const VIDEO = !!opt('video', false);
const OUT = 'playtest-report';
const SHOTS = `${OUT}/shots`;

// the scenarios: a whole run, the start of every act (each in its own district), every escape, a button-masher,
// and the other skaters on the shared rig. secs is wall-clock time; turbo runs the game faster than that.
const SCENARIOS = [
  { id: 'run-1', q: 'seed=1201&floor=1', secs: 150, turbo: 3, what: 'a whole run from floor 1' },
  { id: 'act-2', q: 'seed=2207&floor=4&danger=2', secs: 50, turbo: 3, what: 'act 2 from its first floor' },
  { id: 'act-3', q: 'seed=3301&floor=7&danger=2', secs: 50, turbo: 3, what: 'act 3 from its first floor' },
  { id: 'act-4', q: 'seed=4409&floor=10&danger=2', secs: 50, turbo: 3, what: 'act 4 from its first floor' },
  { id: 'act-5', q: 'seed=5503&floor=13&danger=3', secs: 50, turbo: 3, what: 'act 5 from its first floor' },
  ...[1, 2, 3, 4, 5].map((act) => ({ id: `escape-${act}`, q: `seed=${act * 911}&escape=${act}`, secs: 45, turbo: 2, what: `act ${act}'s escape` })),
  { id: 'mash', q: 'seed=777&floor=2', bot: 'mash', secs: 50, turbo: 2, what: 'a button-masher on floor 2' },
  { id: 'boons', q: 'seed=4242&floor=5&boons=bigPop,bigPop,grease,floatyFlip,railMagnet,slingshot,tripleThreat', secs: 50, turbo: 3, what: 'a strong POP and GRIND build' },
  ...['webster', 'keanu', 'roxy', 'goldie'].map((s, i) => ({ id: `skater-${s}`, q: `seed=${60 + i}&floor=${2 + i}`, skater: s, secs: 30, turbo: 2, what: `${s} on the rig` })),
];

// clips where both feet ride the deck; push has one on the street
const ON_DECK = new Set(['ride', 'land', 'grind1', 'grind2', 'smith', 'feeble', 'fiveO', 'manual', 'noseManual', 'crooked']);
const FOOT = { up: [-0.03, 0.09], along: 0.46, across: 0.2 }; // the deck top, in rig units (riding sits at up 0.015)
const STRETCH = 1.03;

function urlFor(base, s) {
  const bot = s.bot === 'mash' ? 'bot=mash' : 'bot';
  return `${base}?${s.q}&unlockall&skater=${s.skater ?? 'lou-gnar'}&${bot}&turbo=${VIDEO ? 1 : s.turbo}`;
}

async function startVite() {
  const port = 5178;
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], shell: platform() === 'win32' });
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('vite did not start in 60 s')), 60000);
    vite.stdout.on('data', (d) => {
      if (String(d).includes('Local')) {
        clearTimeout(t);
        ok();
      }
    });
    vite.on('exit', (c) => fail(new Error(`vite exited with ${c}`)));
  });
  return { base: `http://localhost:${port}/`, stop: () => vite.kill() };
}

async function play(browser, base, s) {
  const size = { width: 960, height: 540 };
  const context = await browser.newContext({ viewport: size, ...(VIDEO ? { recordVideo: { dir: `${OUT}/videos/raw`, size } } : {}) });
  const page = await context.newPage();
  const url = urlFor(base, s);
  const findings = [];
  const shots = [];
  const counts = {};
  const add = async (kind, message, extra = {}) => {
    counts[kind] = (counts[kind] ?? 0) + 1;
    const f = { kind, message, scenario: s.id, ...extra };
    //a picture of the first few of each kind
    if (counts[kind] <= 2) f.shot = await shot(`${kind}-${counts[kind]}`);
    findings.push(f);
  };
  const shot = async (name) => {
    const file = `shots/${s.id}-${name}.png`;
    await page.screenshot({ path: `${OUT}/${file}` }).catch(() => {});
    return file;
  };
  page.on('pageerror', (e) => findings.push({ kind: 'page-error', message: e.message.slice(0, 300), scenario: s.id }));
  page.on('console', (m) => {
    const text = m.text();
    //Chrome blocks vibration until the first tap; the bot never taps
    if (m.type() === 'error' && !text.includes('navigator.vibrate')) findings.push({ kind: 'console-error', message: text.slice(0, 300), scenario: s.id });
    else if (m.type() === 'warning' && /failed to load/i.test(text)) findings.push({ kind: 'model-fallback', message: text.slice(0, 200), scenario: s.id });
  });
  page.on('response', (r) => {
    if (r.status() >= 400) findings.push({ kind: 'asset-missing', message: `${r.status()} ${new URL(r.url()).pathname}`, scenario: s.id });
  });
  await page.goto(url);
  const ready = await page.waitForFunction(() => window.game?.playtest, null, { timeout: 60000 }).then(() => true, () => false);
  if (!ready) {
    await add('no-start', 'the game never started', { url });
    await page.close();
    return { ...s, url, findings, shots, fps: [], floors: [], runs: [] };
  }
  const fps = [];
  let lastLabel = '';
  let seen = 0; // sim findings already copied
  let offDeck = null; // the last sample's off-deck foot, to need two in a row
  let off = 0;
  let menuSince = Date.now();
  let lastMenu = '';
  const t0 = Date.now();
  while (Date.now() - t0 < s.secs * 1000) {
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const g = window.game;
      const p = g.sprite.mesh.position.clone().project(g.view.camera);
      return {
        pt: { ...g.playtest, findings: g.playtest.findings.slice() },
        foot: window.rig.footCheck(),
        screen: [p.x, p.y],
        fps: Number((document.getElementById('debug')?.textContent ?? '').split(' fps')[0]) || 0,
      };
    }).catch(() => null);
    if (!r) break;
    const { pt, foot } = r;
    if (r.fps) fps.push(r.fps);
    //a new floor: a picture once it's under way
    if (pt.label !== lastLabel && pt.state === 'skate') {
      lastLabel = pt.label;
      await page.waitForTimeout(1200);
      shots.push({ label: `${pt.label} · ${pt.district}`, file: await shot(pt.label.replace(' ', '')) });
    }
    //the sim's own checks, as the game ran them
    for (const f of pt.findings.slice(seen)) await add(f.kind, f.message, { label: f.label, url: f.url, col: f.col });
    seen = pt.findings.length;
    if (pt.state === 'skate') {
      //Lou's feet on the deck while riding and grinding
      const riding = (pt.mode === 'roll' || pt.mode === 'grind' || pt.mode === 'rail') && foot && !foot.fading;
      if (riding && (ON_DECK.has(foot.clip) || foot.clip === 'push')) {
        const bad = foot.feet.filter((f) => f.up < FOOT.up[0] || f.up > FOOT.up[1] || Math.abs(f.along) > FOOT.along || Math.abs(f.across) > FOOT.across);
        const wrong = foot.clip === 'push' ? bad.length === foot.feet.length : bad.length > 0;
        const key = wrong ? `${foot.clip}:${bad.map((f) => f.side).join()}` : null;
        if (wrong && key === offDeck) {
          const f = bad[0];
          const how = f.up < FOOT.up[0] ? `${Math.round(-f.up * 100)} cm into the deck` : f.up > FOOT.up[1] ? `${Math.round(f.up * 100)} cm above the deck` : 'off the end or side of the deck';
          await add(f.up < FOOT.up[0] ? 'feet-in-deck' : 'feet-off-board', `${f.side.toLowerCase()} foot ${how} during "${foot.clip}" (${pt.mode})`, { label: pt.label, url: urlFor(base, s), clip: foot.clip, foot: f });
        }
        offDeck = key;
      } else offDeck = null;
      if (foot && foot.stretch > STRETCH) await add('leg-stretch', `a leg bone stretched to ${Math.round(foot.stretch * 100)}% of its length during "${foot.clip}"`, { label: pt.label, clip: foot.clip });
      //the camera keeps the skater in view
      const out = Math.abs(r.screen[0]) > 1.05 || Math.abs(r.screen[1]) > 1.05;
      off = out ? off + 1 : 0;
      if (off === 3) await add('skater-offscreen', `the skater left the screen (${pt.mode} at x ${Math.round(pt.x)}, y ${Math.round(pt.y)})`, { label: pt.label });
    }
    //a menu the bot can't get out of
    if (pt.state !== lastMenu) {
      lastMenu = pt.state;
      menuSince = Date.now();
    } else if (!['skate', 'over', 'caught'].includes(pt.state) && Date.now() - menuSince > 15000) {
      await add('stuck-menu', `stuck on the ${pt.state} screen for 15 s`, { label: pt.label });
      menuSince = Date.now();
    }
  }
  const end = await page.evaluate(() => ({ floors: window.game.playtest.floors, runs: window.game.playtest.runs, missing: window.missingModels?.() })).catch(() => ({ floors: [], runs: [] }));
  if (end.missing?.files.length) await add('model-fallback', `models that didn't load: ${end.missing.files.join(', ')}`);
  if (end.missing?.parts.length) await add('model-fallback', `parts drawn with the code-built fallback: ${end.missing.parts.join(', ')}`);
  await page.close();
  await context.close();
  const video = VIDEO ? await saveVideo(page, s.id) : undefined;
  return { ...s, url, video, findings, shots, fps: fps.length ? { avg: Math.round(fps.reduce((a, b) => a + b) / fps.length), min: Math.min(...fps) } : null, floors: end.floors, runs: end.runs };
}

// the recording, renamed for its scenario; mp4 (plays on a phone) when ffmpeg is there, else Chromium's webm
async function saveVideo(page, id) {
  const raw = await page.video()?.path();
  if (!raw) return undefined;
  const webm = `videos/${id}.webm`;
  renameSync(raw, `${OUT}/${webm}`);
  const mp4 = `videos/${id}.mp4`;
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}/${webm}`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', `${OUT}/${mp4}`]);
  if (ff.status !== 0) return webm;
  rmSync(`${OUT}/${webm}`);
  return mp4;
}

async function main() {
  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });
  rmSync(`${OUT}/videos`, { recursive: true, force: true });
  let base = opt('url', null);
  const server = base ? null : await startVite();
  base = base || server.base;
  if (!base.endsWith('/')) base += '/';
  const only = opt('only', null);
  let list = SCENARIOS.filter((s) => !only || s.id.includes(only));
  if (QUICK) list = list.filter((s) => ['run-1', 'escape-2', 'mash', 'skater-webster'].includes(s.id)).map((s) => ({ ...s, secs: Math.min(s.secs, 40) }));
  //WebGL in software on Linux (CI and the cloud have no GPU); a Mac uses its own
  const gl = platform() === 'linux' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [];
  const browser = await chromium.launch({ headless: !opt('headed', false), args: gl });
  const t0 = Date.now();
  const results = [];
  //two pages at a time (one when recording, so the video plays at full speed)
  const queue = list.slice();
  const workers = Array.from({ length: Math.min(VIDEO ? 1 : 2, queue.length) }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      process.stdout.write(`  ${s.id}: ${s.what}…\n`);
      const r = await play(browser, base, s);
      results.push(r);
      process.stdout.write(`  ${s.id}: ${r.findings.length} findings, ${r.floors.length} floors, ${r.fps ? r.fps.avg + ' fps' : ''}\n`);
    }
  });
  await Promise.all(workers);
  await browser.close();
  server?.stop();
  results.sort((a, b) => list.indexOf(list.find((s) => s.id === a.id)) - list.indexOf(list.find((s) => s.id === b.id)));
  writeFileSync(`${OUT}/browser.json`, JSON.stringify({ at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), base, scenarios: results }, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
