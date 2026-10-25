// The level editor (?levels): see the floor the game builds for a seed, floor and road, watch the reference bot
// skate it, and reshape each floor's hill (its recipe and its dials) with the floor redrawn as you go.
//
// Edits are per floor and live in src/gen/level-edits.json, which the generator reads over the code (hills.ts).
// Save writes that file through the dev server (npm run dev). Without one (the phone, the deployed site) it copies
// the edits as text instead, to paste to Claude. Unsaved edits stay in this browser, and ?leveldrafts plays them.
import { FIRST_ROAD, rollFork, type Road } from '../gen/roads';
import { floorRecipe, hillDials as hillOnly, recipe, type Beat } from '../gen/hills';
import { topDials } from '../gen/top-route';
import { SAVED_EDITS, floorEdit, useLevelEdits, type FloorEdit, type LevelEdits } from '../gen/level-edits';
import { buildFloor, type FloorOptions } from '../gen/descent';
import { validatedFloor } from '../gen/validate';
import { floorTwist } from '../gen/twists';
import { PIECES } from '../gen/pieces';
import { FloorSim } from '../sim/floor';
import { Pilot } from '../bot/pilot';
import { SCORE } from '../run/score';
import { spawnPlan } from '../traffic/traffic';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import { BEATS, formatLevelEdits, isLevelEdits, loadLevelDrafts, saveLevelDrafts } from './drafts';
import { floorSVG, silhouetteSVG, type BotLine } from './draw';
import './levels.css';

const FLOORS = 15;
const TYPES = ['POP', 'GRIND'] as const;

const BEAT_NAMES: Record<string, string> = {
  hill: 'hill',
  railHill: 'rail hill',
  stairs: 'stairs',
  drop: 'drop',
  gap: 'crest jump',
  kicker: 'kicker',
  chase: 'chase',
};
const BEAT_HELP: Record<string, string> = {
  hill: 'a block of street to bomb down',
  railHill: 'a block with a handrail down the sidewalk',
  stairs: 'a public stairway with a handrail',
  drop: 'a retaining wall down onto the next street',
  gap: 'jump the cross street onto the next block',
  kicker: 'a short climb that throws you into the air',
  chase: 'a flat stretch with traffic',
};

const ROADS: { id: string; name: string; road: Road }[] = [
  { id: 'b1', name: 'boon street · danger 1', road: { kind: 'boon', boonType: 'POP', danger: 1 } },
  { id: 'b2', name: 'boon street · danger 2', road: { kind: 'boon', boonType: 'POP', danger: 2 } },
  { id: 'hot', name: 'hot street · danger 3', road: { kind: 'hot', danger: 3 } },
  { id: 'stash', name: 'stash (short floor)', road: { kind: 'stash', danger: 1 } },
];

// the dials, as the editor shows them
type Pair = [number, number];
interface Dial {
  key: keyof FloorEdit;
  name: string;
  help: string;
  min: number;
  max: number;
  step: number;
  pair?: boolean;
}
const DIALS: Dial[] = [
  { key: 'top', name: 'start height', help: 'tiles above the street at the top of the hill', min: 6, max: 60, step: 1 },
  { key: 'grade', name: 'steepness', help: 'tiles down per tile along a block (SF\'s steepest is about 0.3)', min: 0.1, max: 0.6, step: 0.01 },
  { key: 'run', name: 'block length', help: 'tiles per block of hill', min: 4, max: 30, step: 1, pair: true },
  { key: 'crest', name: 'flat at the top', help: 'tiles of flat intersection between blocks', min: 2, max: 16, step: 1, pair: true },
  { key: 'gap', name: 'crest jump', help: 'tiles across the cross street', min: 1, max: 7, step: 1, pair: true },
  { key: 'midSet', name: 'stairway steps', help: 'steps in a stairway before the last', min: 2, max: 16, step: 1, pair: true },
  { key: 'finalSet', name: 'last stairway', help: 'the most steps in the floor\'s last (biggest) stairway', min: 4, max: 24, step: 1 },
  { key: 'chasePieces', name: 'chase length', help: 'street pieces in each flat chase between hills', min: 1, max: 8, step: 1 },
  { key: 'climbTop', name: 'cable car climb', help: 'tiles the cable car takes you up after a chase', min: 4, max: 40, step: 1 },
  { key: 'topStart', name: 'launch ramp', help: 'top route: how far down each hill the launch ramp sits, with the power line just past it (0 = the crest, 1 = the foot)', min: 0, max: 0.9, step: 0.05 },
  { key: 'roofGap', name: 'rooftop gaps', help: 'top route: tiles to ollie between rooftops', min: 1, max: 6, step: 1, pair: true },
  { key: 'flocks', name: 'pigeons', help: 'top route: chance of pigeons on each wire and long rooftop', min: 0, max: 1, step: 0.05 },
  { key: 'street', name: 'last street', help: 'street pieces after the last hill, up to the fork', min: 1, max: 8, step: 1 },
];

// the hill's dials and the top route's, as the editor shows them
const hillDials = (f: number) => ({ ...hillOnly(f), ...topDials(f) });

interface Built {
  level: Level;
  tries: number;
  tierDrops: number;
  cruise: { result: string; frames: number; bot: BotLine; grind: number; air: number };
  gnar: { result: string };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function ride(level: Level, boost: number, record: boolean): Built['cruise'] {
  const sim = new FloorSim(level);
  sim.skater.boost = boost;
  sim.heat.slamFree = boost > 1;
  const pilot = new Pilot('ref');
  const bot: BotLine = { path: [], slams: [] };
  let grind = 0;
  let air = 0;
  let f = 0;
  for (; f < 60 * 120; f++) {
    sim.step(pilot.input(sim));
    const sk = sim.skater;
    for (const e of sim.events) if (e.type === 'slam') bot.slams.push([sk.x, sk.y]);
    if (sk.mode === 'grind' || sk.mode === 'rail') grind++;
    if (sk.mode === 'air') air++;
    if (record && f % 2 === 0) bot.path.push([sk.x, sk.y, sk.mode]);
    if (sim.state !== 'skate') break;
  }
  return { result: sim.state === 'skate' ? 'timeout' : sim.state, frames: f, bot, grind, air };
}

export function startLevels(): void {
  document.getElementById('app')?.remove();
  document.title = 'Gnar Run · level editor';
  const params = new URLSearchParams(location.search);

  // ---------- state ----------
  let edits: LevelEdits = loadLevelDrafts() ?? clone(SAVED_EDITS);
  let seed = Math.max(1, Math.floor(Number(params.get('seed')) || 2026));
  let floor = Math.min(FLOORS, Math.max(1, Math.floor(Number(params.get('floor')) || 1)));
  let roadId = 'b1';
  let zoom = 0.3;
  let showBot = true;
  let built: Built | null = null;
  useLevelEdits(edits);

  const edit = (): FloorEdit => (edits.floors[String(floor)] ??= {});
  const dirty = () => formatLevelEdits(edits) !== formatLevelEdits(SAVED_EDITS);
  const codeDials = (f: number) => {
    useLevelEdits({ floors: {} });
    const d = hillDials(f);
    useLevelEdits(edits);
    return d;
  };
  const codeStreet = (f: number) => Math.min(4, 2 + Math.floor((f - 1) / 3));
  const road = (): Road => (floor === 1 && roadId === 'b1' ? FIRST_ROAD : ROADS.find((r) => r.id === roadId)!.road);
  const options = (f: number, r: Road): FloorOptions => ({
    fork: rollFork(seed, f, [...TYPES]),
    danger: r.danger,
    short: r.kind === 'stash',
    twist: floorTwist(seed, f),
    hills: true,
  });

  // ---------- page ----------
  const root = document.createElement('div');
  root.id = 'levels';
  root.innerHTML = `
    <header class="lv-bar">
      <b class="lv-title">LEVELS</b>
      <label>seed <input id="lv-seed" type="number" min="1" step="1"></label>
      <label>floor <select id="lv-floor">${Array.from({ length: FLOORS }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select></label>
      <label>road <select id="lv-road">${ROADS.map((r) => `<option value="${r.id}">${r.name}</option>`).join('')}</select></label>
      <label><input id="lv-bot" type="checkbox" checked> bot line</label>
      <label>zoom <input id="lv-zoom" type="range" min="0.12" max="0.6" step="0.02"></label>
      <span class="lv-grow"></span>
      <button id="lv-play" type="button">play in game</button>
      <button id="lv-copy" type="button">copy edits</button>
      <button id="lv-save" type="button" class="hot">save</button>
    </header>
    <div class="lv-view" id="lv-view"></div>
    <div class="lv-result" id="lv-result"></div>
    <div class="lv-panels">
      <section class="lv-panel">
        <div class="lv-head"><h2>Recipe · floor <span class="lv-fl"></span></h2><span class="lv-tag" id="lv-rtag"></span><button id="lv-rrevert" type="button">use code recipe</button></div>
        <p class="lv-help">The hill is built slot by slot, top to bottom. Each slot picks one of its lit beats from the seed (the outlined one is this seed's pick). The last slot is the floor's peak, its biggest stairway.</p>
        <ol class="lv-slots" id="lv-slots"></ol>
        <button id="lv-add" type="button">+ add a slot</button>
      </section>
      <section class="lv-panel">
        <div class="lv-head"><h2>Dials · floor <span class="lv-fl"></span></h2><span class="lv-tag" id="lv-dtag"></span><button id="lv-drevert" type="button">use code dials</button></div>
        <div class="lv-dials" id="lv-dials"></div>
      </section>
    </div>
    <section class="lv-panel lv-stripwrap">
      <div class="lv-head"><h2>Floors 1–15</h2><span class="lv-help">first roll of each floor for this seed, one scale; tap one to edit it</span></div>
      <div class="lv-strip" id="lv-strip"></div>
    </section>
    <div class="lv-toast" id="lv-toast" hidden></div>
    <textarea id="lv-out" class="lv-out" hidden readonly></textarea>
  `;
  document.body.appendChild(root);
  const $ = <T extends HTMLElement>(id: string) => root.querySelector(`#${id}`) as T;
  const seedIn = $<HTMLInputElement>('lv-seed');
  const floorIn = $<HTMLSelectElement>('lv-floor');
  const roadIn = $<HTMLSelectElement>('lv-road');
  const zoomIn = $<HTMLInputElement>('lv-zoom');
  seedIn.value = String(seed);
  floorIn.value = String(floor);
  zoomIn.value = String(zoom);

  let toastT = 0;
  const toast = (msg: string) => {
    const t = $('lv-toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = window.setTimeout(() => (t.hidden = true), 3500);
  };

  // ---------- building ----------
  function build(): void {
    useLevelEdits(edits);
    const v = validatedFloor(seed, floor, options(floor, road()));
    built = {
      level: v.level,
      tries: v.tries,
      tierDrops: v.tierDrops,
      cruise: ride(v.level, 1, true),
      gnar: ride(v.level, SCORE.gnarBoost, false),
    };
  }

  function drawView(): void {
    if (!built) return;
    const L = built.level;
    const view = $('lv-view');
    const keep = view.scrollLeft;
    view.innerHTML = floorSVG(L, zoom, { bot: showBot ? built.cruise.bot : null, spawns: spawnPlan(L, L.layout.seed) });
    //a scroll box in the page's grid collapses without a height of its own
    view.style.height = `${Number(view.querySelector('svg')?.getAttribute('height') ?? 0) + 14}px`;
    view.scrollLeft = keep;
    const tiles = Math.round(L.width / TILE);
    const hill = Math.round((L.hillSpans ?? [[0, L.finaleX]]).reduce((n, [a, b]) => n + b - a, 0) / TILE);
    const chases = Math.max(0, (L.hillSpans?.length ?? 1) - 1);
    const ok = (r: string) => (r === 'exit' ? '<span class="ok">reaches the gate</span>' : `<span class="bad">${esc(r)}</span>`);
    const c = built.cruise;
    const pct = (n: number) => Math.round((100 * n) / Math.max(1, c.frames));
    const warn =
      built.tierDrops < 0
        ? '<div class="bad">The bot couldn\'t clear any roll of this floor. The game would still use it, so it can strand a player. Ease it off.</div>'
        : built.tries > 1
          ? `<div class="warn">The first ${built.tries - 1} roll${built.tries > 2 ? 's' : ''} failed the bot, so the game rerolled${built.tierDrops ? ' and used easier street pieces' : ''}. Floors that pass first time hold their shape best.</div>`
          : '';
    $('lv-result').innerHTML = `
      <span><b>${tiles}</b> tiles (${hill} hill, ${tiles - hill} street${chases ? `, ${chases} chase${chases > 1 ? 's' : ''} + cable car${chases > 1 ? 's' : ''}` : ''})</span>
      <span>starts <b>${Math.round((L.streetY - L.startY) / TILE)}</b> up</span>
      <span>bot ${ok(c.result)} in <b>${(c.frames / 60).toFixed(1)}s</b> · ${pct(c.grind)}% grinding · ${pct(c.air)}% in the air · ${c.bot.slams.length} slams</span>
      <span>at gnar speed ${ok(built.gnar.result)}</span>
      <span>tries ${built.tries}</span>${warn}`;
  }

  // ---------- recipe ----------
  function drawRecipe(): void {
    const slots = floorRecipe(floor);
    const picked = recipe(seed, floor);
    const edited = !!floorEdit(floor).recipe;
    $('lv-rtag').textContent = edited ? 'edited' : 'from code';
    $('lv-rtag').classList.toggle('on', edited);
    $<HTMLButtonElement>('lv-rrevert').disabled = !edited;
    $('lv-slots').innerHTML = slots
      .map((slot, i) => {
        const last = i === slots.length - 1;
        const chips = BEATS.map((b) => {
          const lit = slot.includes(b);
          const pick = picked[i] === b;
          return `<button type="button" class="beat${lit ? ' lit' : ''}${pick ? ' pick' : ''}" data-slot="${i}" data-beat="${b}" title="${BEAT_HELP[b] ?? b}"${last ? ' disabled' : ''}>${BEAT_NAMES[b] ?? b}</button>`;
        }).join('');
        const tools = last
          ? '<span class="lv-peak">peak</span>'
          : `<button type="button" class="tool" data-up="${i}" title="move up"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="tool" data-down="${i}" title="move down"${i >= slots.length - 2 ? ' disabled' : ''}>↓</button><button type="button" class="tool" data-del="${i}" title="remove"${slots.length <= 2 ? ' disabled' : ''}>✕</button>`;
        return `<li><span class="n">${i + 1}</span><span class="beats">${chips}</span><span class="tools">${tools}</span></li>`;
      })
      .join('');
  }

  function setRecipe(fn: (r: Beat[][]) => void): void {
    const r = clone(floorRecipe(floor));
    fn(r);
    edit().recipe = r;
    changed();
  }

  $('lv-slots').addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest('button');
    if (!t || t.disabled) return;
    if (t.dataset.beat) {
      const i = Number(t.dataset.slot);
      const b = t.dataset.beat as Beat;
      setRecipe((r) => {
        const has = r[i].includes(b);
        if (has && r[i].length === 1) return; // a slot keeps at least one beat
        r[i] = has ? r[i].filter((x) => x !== b) : [...r[i], b];
      });
    } else if (t.dataset.up) {
      const i = Number(t.dataset.up);
      setRecipe((r) => ([r[i - 1], r[i]] = [r[i], r[i - 1]]));
    } else if (t.dataset.down) {
      const i = Number(t.dataset.down);
      setRecipe((r) => ([r[i + 1], r[i]] = [r[i], r[i + 1]]));
    } else if (t.dataset.del) {
      const i = Number(t.dataset.del);
      setRecipe((r) => r.splice(i, 1));
    }
  });
  $('lv-add').addEventListener('click', () => setRecipe((r) => r.splice(r.length - 1, 0, ['hill'])));
  $('lv-rrevert').addEventListener('click', () => {
    delete edit().recipe;
    changed();
  });

  // ---------- dials ----------
  function dialValue(d: Dial, f: number, code: boolean): number | Pair {
    if (d.key === 'street') return code ? codeStreet(f) : (floorEdit(f).street ?? codeStreet(f));
    const src = code ? codeDials(f) : hillDials(f);
    const v = src[d.key as keyof typeof src] as number | number[];
    return Array.isArray(v) ? ([v[0], v[1]] as Pair) : v;
  }

  function drawDials(): void {
    const e = floorEdit(floor);
    const any = DIALS.some((d) => e[d.key] !== undefined);
    $('lv-dtag').textContent = any ? 'edited' : 'from code';
    $('lv-dtag').classList.toggle('on', any);
    $<HTMLButtonElement>('lv-drevert').disabled = !any;
    $('lv-dials').innerHTML = DIALS.map((d) => {
      const v = dialValue(d, floor, false);
      const code = dialValue(d, floor, true);
      const fmt = (x: number) => (d.step < 1 ? x.toFixed(2) : String(Math.round(x)));
      const codeText = Array.isArray(code) ? `${fmt(code[0])}–${fmt(code[1])}` : fmt(code);
      const on = e[d.key] !== undefined;
      const inputs = Array.isArray(v)
        ? `<input type="number" data-dial="${d.key}" data-i="0" min="${d.min}" max="${d.max}" step="${d.step}" value="${fmt(v[0])}"> to <input type="number" data-dial="${d.key}" data-i="1" min="${d.min}" max="${d.max}" step="${d.step}" value="${fmt(v[1])}">`
        : `<input type="range" data-dial="${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}"><output>${fmt(v as number)}</output>`;
      return `<div class="dial${on ? ' on' : ''}"><div class="dn"><b>${d.name}</b><span>code ${codeText}${on ? ` · <button type="button" class="link" data-reset="${d.key}">reset</button>` : ''}</span></div><div class="dv">${inputs}</div><div class="dh">${d.help}</div></div>`;
    }).join('');
  }

  $('lv-dials').addEventListener('input', (ev) => {
    const t = ev.target as HTMLInputElement;
    const key = t.dataset.dial as keyof FloorEdit | undefined;
    if (!key) return;
    const d = DIALS.find((x) => x.key === key)!;
    const n = Math.min(d.max, Math.max(d.min, Number(t.value)));
    if (!isFinite(n)) return;
    if (d.pair) {
      const cur = dialValue(d, floor, false) as Pair;
      const next: Pair = [cur[0], cur[1]];
      next[Number(t.dataset.i)] = n;
      if (next[0] > next[1]) next[Number(t.dataset.i) === 0 ? 1 : 0] = n;
      (edit() as Record<string, unknown>)[key] = next;
    } else {
      (edit() as Record<string, unknown>)[key] = n;
      const out = t.nextElementSibling;
      if (out) out.textContent = d.step < 1 ? n.toFixed(2) : String(n);
    }
    changed(false);
  });
  $('lv-dials').addEventListener('change', () => drawDials());
  $('lv-dials').addEventListener('click', (ev) => {
    const key = (ev.target as HTMLElement).dataset.reset as keyof FloorEdit | undefined;
    if (!key) return;
    delete edit()[key];
    changed();
  });
  $('lv-drevert').addEventListener('click', () => {
    const e = edit();
    for (const d of DIALS) delete e[d.key];
    changed();
  });

  // ---------- floors 1-15 ----------
  let stripToken = 0;
  function drawStrip(): void {
    const token = ++stripToken;
    const strip = $('lv-strip');
    const rows: { f: number; L: Level }[] = [];
    let f = 1;
    let r: Road = FIRST_ROAD;
    const step = () => {
      if (token !== stripToken) return;
      if (f > FLOORS) {
        const maxW = Math.max(...rows.map((x) => x.L.width));
        const top = Math.max(...rows.map((x) => x.L.streetY - x.L.startY));
        const scale = 1 / 12;
        strip.innerHTML = rows
          .map(({ f: n, L }) => {
            const e = edits.floors[String(n)];
            const mark = e && Object.keys(e).length ? '<i>edited</i>' : '';
            return `<button type="button" class="row${n === floor ? ' cur' : ''}" data-floor="${n}"><span class="lab"><b>F${n}</b> ${Math.round(L.width / TILE)} tiles · ${Math.round((L.streetY - L.startY) / TILE)} up ${mark}</span>${silhouetteSVG(L, scale, maxW, top)}</button>`;
          })
          .join('');
        return;
      }
      useLevelEdits(edits);
      rows.push({ f, L: buildFloor(seed, f, PIECES, options(f, r)) });
      r = { kind: 'boon', boonType: 'POP', danger: 1 + (f % 2) };
      f++;
      setTimeout(step, 0);
    };
    step();
  }
  $('lv-strip').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button');
    if (!b?.dataset.floor) return;
    floor = Number(b.dataset.floor);
    floorIn.value = String(floor);
    refresh();
    root.scrollTo?.({ top: 0, behavior: 'smooth' });
  });

  // ---------- refresh ----------
  let buildT = 0;
  let stripT = 0;
  function changed(redrawPanels = true): void {
    for (const k of Object.keys(edits.floors)) if (!Object.keys(edits.floors[k]).length) delete edits.floors[k];
    saveLevelDrafts(dirty() ? edits : null);
    useLevelEdits(edits);
    if (redrawPanels) {
      drawRecipe();
      drawDials();
    } else drawRecipe();
    markDirty();
    clearTimeout(buildT);
    buildT = window.setTimeout(() => {
      build();
      drawView();
    }, 120);
    clearTimeout(stripT);
    stripT = window.setTimeout(drawStrip, 700);
  }

  function markDirty(): void {
    $<HTMLButtonElement>('lv-save').textContent = dirty() ? 'save •' : 'save';
  }

  function refresh(): void {
    root.querySelectorAll('.lv-fl').forEach((e) => (e.textContent = String(floor)));
    useLevelEdits(edits);
    drawRecipe();
    drawDials();
    markDirty();
    build();
    drawView();
    drawStrip();
  }

  seedIn.addEventListener('change', () => {
    seed = Math.max(1, Math.floor(Number(seedIn.value) || 1));
    seedIn.value = String(seed);
    refresh();
  });
  floorIn.addEventListener('change', () => {
    floor = Number(floorIn.value);
    refresh();
  });
  roadIn.addEventListener('change', () => {
    roadId = roadIn.value;
    build();
    drawView();
  });
  zoomIn.addEventListener('input', () => {
    zoom = Number(zoomIn.value);
    drawView();
  });
  $<HTMLInputElement>('lv-bot').addEventListener('change', (ev) => {
    showBot = (ev.target as HTMLInputElement).checked;
    drawView();
  });

  // ---------- saving ----------
  const text = () => formatLevelEdits(edits);
  async function copy(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text());
      return true;
    } catch {
      const out = $<HTMLTextAreaElement>('lv-out');
      out.value = text();
      out.hidden = false;
      out.select();
      return false;
    }
  }
  $('lv-copy').addEventListener('click', async () => {
    toast((await copy()) ? 'Edits copied. Paste them to Claude to put them in the game.' : 'Copy the edits from the box below.');
  });
  $('lv-save').addEventListener('click', async () => {
    try {
      const res = await fetch('./__level-edits', { method: 'POST', body: text() });
      if (!res.ok) throw new Error(await res.text());
      const saved = JSON.parse(text()) as unknown;
      if (isLevelEdits(saved)) Object.assign(SAVED_EDITS, saved);
      saveLevelDrafts(null);
      markDirty();
      toast('Saved to src/gen/level-edits.json. Commit it to keep it.');
    } catch {
      //no dev server here (a phone, the deployed site): hand the edits over as text
      toast((await copy()) ? 'No dev server here, so the edits were copied instead. Paste them to Claude.' : 'No dev server here: copy the edits from the box below and paste them to Claude.');
    }
  });
  $('lv-play').addEventListener('click', () => {
    saveLevelDrafts(edits);
    const r = ROADS.find((x) => x.id === roadId)!.road;
    location.href = `${location.pathname}?seed=${seed}&floor=${floor}&danger=${r.danger}&leveldrafts`;
  });
  window.addEventListener('keydown', (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key === 's') {
      ev.preventDefault();
      $('lv-save').click();
    }
  });

  refresh();
}

