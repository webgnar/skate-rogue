// The level editor (?levels): see the floor the game builds for a seed, floor and road, watch the reference bot
// skate it, and reshape each floor's hill (its recipe and its dials) with the floor redrawn as you go.
//
// Edits are per floor and live in src/gen/level-edits.json, which the generator reads over the code (hills.ts).
// Save writes that file through the dev server (npm run dev). Without one (the phone, the deployed site) it copies
// the edits as text instead, to paste to Claude. Unsaved edits stay in this browser, and ?leveldrafts plays them.
import { FIRST_ROAD, rollFork, type Road } from '../gen/roads';
import { floorRecipe, hillDials as hillOnly, recipe, type Beat } from '../gen/hills';
import { topDials } from '../gen/top-route';
import { skyDials, skyPick, skyRecipe, type SkyBeat } from '../gen/sky-beats';
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
import { BEATS, SKY_BEAT_LIST, formatLevelEdits, isLevelEdits, loadLevelDrafts, saveLevelDrafts } from './drafts';
import { floorSVG, inClouds, silhouetteSVG, type BotLine, type Layers } from './draw';
import { CLOUDS, type CloudBeat } from '../gen/clouds';
import { SEWER } from '../gen/sewer';
import type { LayerEdit } from '../gen/level-edits';
import { sewerAt } from '../physics/level';
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
  cross: 'cross traffic',
  skitch: 'cab + kicker',
};
const BEAT_HELP: Record<string, string> = {
  hill: 'a block of street to bomb down',
  railHill: 'a block with a handrail down the sidewalk',
  stairs: 'a public stairway with a handrail',
  drop: 'a retaining wall down onto the next street',
  gap: 'jump the cross street onto the next block',
  kicker: 'a short climb that throws you into the air',
  chase: 'a flat stretch with traffic',
  cross: 'a block down to an intersection with cars driving across it (Chinatown)',
  skitch: 'a long flat with a cab to skitch into a kicker up to the top route (Chinatown)',
};

const SKY_HELP: Record<SkyBeat, string> = {
  roofs: 'two rooftop decks with a gap to ollie between',
  billboard: 'the catwalk rail along the top of a billboard',
  tower: "a water tower's lid, a little higher than the rest",
  crane: "a crane's boom, a long grind falling with the hill",
  scaffold: 'three scaffold decks stepping down',
  gap: 'open sky, with a Stoken in it now and then',
  beam: 'a steel I-beam hoisted on a crane cable, a short grind falling a little',
  blimp: "set piece: an ad blimp's long back, bobbing (one set piece a floor)",
  rig: 'set piece: a window washer rig that drops under you; pop off onto the roof ahead',
  swing: "set piece: a tower crane's jib that swings out of the lane and back",
  bust: 'set piece: two decks with a paper billboard across the gap to burst through',
  lines: "Chinatown's clotheslines: short sagging wires to chain (Chinatown's stretch opens on them)",
};

// the cloud layer's beats (src/gen/clouds.ts), and the route layers' dials: keys of CLOUDS and SEWER, overlaid per
// floor while it's built (withDials in level-edits.ts). `unit` is px per shown unit (TILE for a height kept in px)
const CLOUD_BEATS: CloudBeat[] = ['puff', 'thin', 'drift', 'rainbow', 'balloon', 'gap'];
const CLOUD_HELP: Record<CloudBeat, string> = {
  puff: 'a cloud to land on',
  thin: 'a thin cloud that puffs away a moment after you land',
  drift: 'a cloud drifting back and forth',
  rainbow: 'a rainbow to grind up and over',
  balloon: "a hot air balloon's basket, bobbing",
  gap: 'open sky to fly over, a Stoken in it now and then',
};
interface LayerDial {
  key: string;
  name: string;
  help: string;
  min: number;
  max: number;
  step: number;
  unit?: number;
  free?: boolean; // a pair that isn't a range (two chances): don't keep it in order
}
const CLOUD_DIALS: LayerDial[] = [
  { key: 'room', name: 'hill it needs', help: 'tiles of hill down from the crest a stretch needs to climb into the clouds', min: 30, max: 200, step: 5 },
  { key: 'stairAt', name: 'staircase starts', help: 'how far down the hill (0 = crest, 1 = foot) the sky beats give way to the staircase up', min: 0.05, max: 0.8, step: 0.01 },
  { key: 'climb', name: 'staircase climb', help: 'tiles the staircase climbs over the last sky beat, up to the clouds', min: 3, max: 24, step: 1 },
  { key: 'stairRise', name: 'step rise', help: 'tiles each step stands over the last (1.5 = an ollie and a flip at any speed)', min: 0.5, max: 2.5, step: 0.25 },
  { key: 'stairGap', name: 'step gap', help: 'tiles of open air between steps', min: 1, max: 5, step: 1 },
  { key: 'stair', name: 'step deck', help: 'tiles: each step\'s deck', min: 2, max: 8, step: 1 },
  { key: 'puff', name: 'cloud size', help: 'tiles: each cloud', min: 3, max: 16, step: 1 },
  { key: 'between', name: 'between clouds', help: 'tiles of open sky between beats, to ollie', min: 1, max: 6, step: 1 },
  { key: 'gap', name: 'open sky', help: 'tiles: a gap beat', min: 2, max: 10, step: 1 },
  { key: 'rainbow', name: 'rainbow length', help: 'tiles across a rainbow', min: 8, max: 30, step: 1 },
  { key: 'step', name: 'layer falls', help: 'tiles each beat drops under the last, falling gently with the hill', min: 0, max: 1.5, step: 0.1 },
  { key: 'stoken', name: 'Stoken in gaps', help: 'chance of a Stoken over each gap', min: 0, max: 1, step: 0.05 },
  { key: 'spin', name: 'spin token', help: 'chance the layer hides a spin token at the top of a rainbow', min: 0, max: 1, step: 0.05 },
];
const SEWER_DIALS: LayerDial[] = [
  { key: 'len', name: 'tunnel length', help: 'tiles from the drain to the outlet (the street chase has to fit it: on a short chase it shrinks down to 16)', min: 12, max: 60, step: 1 },
  { key: 'depth', name: 'depth', help: 'tiles under the street (5: an ollie fits under the roof, a double tap bonks)', min: 3, max: 9, step: 0.5, unit: TILE },
  { key: 'drain', name: 'drain width', help: 'tiles of hole at the construction dig: an ollie clears it, rolling on takes you in', min: 2, max: 6, step: 1 },
  { key: 'ramp', name: 'outlet ramp', help: 'tiles of ramp up from the floor to the street', min: 4, max: 14, step: 1 },
  { key: 'pipes', name: 'pipes', help: 'the most pipes to grind in a tunnel', min: 0, max: 5, step: 1 },
  { key: 'pipe', name: 'pipe length', help: 'tiles of each pipe', min: 3, max: 20, step: 1 },
  { key: 'pipeH', name: 'pipe height', help: 'tiles over the floor (an ollie gets onto 1.1)', min: 0.5, max: 2.5, step: 0.1, unit: TILE },
  { key: 'wets', name: 'runoff pools', help: 'the most stretches of runoff on the floor (soaks the deck)', min: 0, max: 5, step: 1 },
  { key: 'wet', name: 'runoff length', help: 'tiles of each stretch of runoff', min: 1, max: 6, step: 1 },
  { key: 'stoken', name: 'Stoken on pipes', help: 'chance of a Stoken on each pipe', min: 0, max: 1, step: 0.05 },
  { key: 'footRamp', name: 'plank ramp way in', help: 'chance a chase\'s way in is a plank ramp at the foot of the hill (else a construction dig)', min: 0, max: 1, step: 0.05 },
  { key: 'kicks', name: 'kick-outs', help: 'chance of a first quarterpipe kick-out in a tunnel, and of a second', min: 0, max: 1, step: 0.05, free: true },
  { key: 'kickPop', name: 'kick-out pop', help: 'how hard a kick-out throws you up (more negative = higher; -9.5 is about 1.5 tiles over the street)', min: -14, max: -6, step: 0.5 },
  { key: 'pieceFrom', name: 'set pieces from floor', help: 'the first floor with sewer set pieces (rats, flood surge, full pipe, subway)', min: 1, max: 15, step: 1 },
  { key: 'piece', name: 'set piece chance', help: 'chance a tunnel gets a set piece', min: 0, max: 1, step: 0.05 },
  { key: 'rats', name: 'rat pack', help: 'rats in a pack', min: 1, max: 12, step: 1 },
  { key: 'subwayPeriod', name: 'subway trains', help: 'frames between trains under the subway gap (60 = 1 s)', min: 60, max: 360, step: 10 },
  { key: 'gator', name: 'alligator', help: 'chance of the alligator on a floor', min: 0, max: 1, step: 0.05 },
  { key: 'gatorFrom', name: 'alligator from floor', help: 'the first floor the alligator can turn up on', min: 1, max: 15, step: 1 },
  { key: 'stash', name: 'DIY stash', help: 'chance of a stash crate on a floor, in one of its tunnels', min: 0, max: 1, step: 0.05 },
  { key: 'stashGear', name: 'stash is gear', help: 'chance the stash is a fresh gear part (else a spin token)', min: 0, max: 1, step: 0.05 },
  { key: 'runUp', name: 'clear run-up', help: 'tiles of clear street before the drain', min: 2, max: 16, step: 1 },
  { key: 'runOut', name: 'clear run-out', help: 'tiles of clear street after the outlet', min: 2, max: 16, step: 1 },
];

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
  { key: 'topStart', name: 'power line start', help: 'top route: how far down each hill the power line starts (0 = the crest, 1 = the foot)', min: 0, max: 0.9, step: 0.05 },
  { key: 'roofGap', name: 'rooftop gaps', help: 'top route: tiles to ollie between rooftops', min: 1, max: 6, step: 1, pair: true },
  { key: 'flocks', name: 'pigeons', help: 'top route: chance of pigeons on each wire and long rooftop', min: 0, max: 1, step: 0.05 },
  { key: 'skyHeight', name: 'sky height', help: 'sky beats: tiles over the highest ground behind (the power line is at 5)', min: 3, max: 9, step: 0.5 },
  { key: 'skyStart', name: 'sky start', help: 'sky beats: how far down each hill the first one stands (0 = the crest, 1 = the foot)', min: 0, max: 0.9, step: 0.05 },
  { key: 'street', name: 'last street', help: 'street pieces after the last hill, up to the fork', min: 1, max: 8, step: 1 },
];

// the hill's dials, the top route's and the sky beats', as the editor shows them
const hillDials = (f: number) => ({ ...hillOnly(f), ...topDials(f), ...skyDials(f) });

interface Built {
  level: Level;
  tries: number;
  tierDrops: number;
  cruise: { result: string; frames: number; bot: BotLine; grind: number; air: number; sewer: number };
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
  let sewer = 0;
  let f = 0;
  for (; f < 60 * 120; f++) {
    sim.step(pilot.input(sim));
    const sk = sim.skater;
    for (const e of sim.events) if (e.type === 'slam') bot.slams.push([sk.x, sk.y]);
    if (sk.mode === 'grind' || sk.mode === 'rail') grind++;
    if (sk.mode === 'air') air++;
    if (sewerAt(level, sk.x) && sk.y > level.streetY + TILE) sewer++;
    if (record && f % 2 === 0) bot.path.push([sk.x, sk.y, sk.mode]);
    if (sim.state !== 'skate') break;
  }
  return { result: sim.state === 'skate' ? 'timeout' : sim.state, frames: f, bot, grind, air, sewer };
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
  const layers: Layers = { sky: params.get('sky') !== '0', clouds: params.get('clouds') !== '0', sewer: params.get('sewer') !== '0' };
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
      <span class="lv-layers">show <label class="ly-sky"><input data-layer="sky" type="checkbox"> sky</label><label class="ly-clouds"><input data-layer="clouds" type="checkbox"> clouds</label><label class="ly-sewer"><input data-layer="sewer" type="checkbox"> sewer</label></span>
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
        <div class="lv-head"><h2>Sky beats · floor <span class="lv-fl"></span></h2><span class="lv-tag" id="lv-stag"></span><button type="button" class="lv-goto" data-goto="sky">show me</button><button id="lv-srevert" type="button">use code sky</button></div>
        <p class="lv-help">Up high, over the power line: what's there to land on when you fly over it, laid down each hill slot by slot. Each slot picks one of its lit beats from the seed (each hill its own pick; the outlined one is the first hill's). No slots, no sky beats.</p>
        <ol class="lv-slots" id="lv-sslots"></ol>
        <button id="lv-sadd" type="button">+ add a sky slot</button>
      </section>
      <section class="lv-panel lv-layer" id="lv-clouds">
        <div class="lv-head"><h2>Cloud layer · floor <span class="lv-fl"></span></h2><span class="lv-tag" id="lv-ctag"></span><button type="button" class="lv-goto" data-goto="clouds">show me</button><button id="lv-crevert" type="button">use code clouds</button></div>
        <p class="lv-help">Way up over a long stretch of hill: a staircase off the sky beats climbs into a layer of clouds, rainbows and balloons. The code turns it on from floor ${CLOUDS.from}, on stretches with room for it.</p>
        <div class="lv-onoff" data-layer="clouds"></div>
        <div class="lv-mix" id="lv-cmix"></div>
        <div class="lv-dials" id="lv-cdials"></div>
      </section>
      <section class="lv-panel lv-layer" id="lv-sewer">
        <div class="lv-head"><h2>Sewer · floor <span class="lv-fl"></span></h2><span class="lv-tag" id="lv-wtag"></span><button type="button" class="lv-goto" data-goto="sewer">show me</button><button id="lv-wrevert" type="button">use code sewer</button></div>
        <p class="lv-help">Under each street chase: drop in at a construction dig or a plank ramp, ride the runoff downstream, skate the pipes, dodge rats, the flood surge and the alligator, and come up the outlet, a kick-out, or the sewer road at the gate. Out of the chopper's sight, so the Heat cools.</p>
        <div class="lv-onoff" data-layer="sewer"></div>
        <div class="lv-dials" id="lv-wdials"></div>
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
    view.innerHTML = floorSVG(L, zoom, { bot: showBot ? built.cruise.bot : null, spawns: spawnPlan(L, L.layout.seed), layers });
    //a scroll box in the page's grid collapses without a height of its own
    view.style.height = `${Number(view.querySelector('svg')?.getAttribute('height') ?? 0) + 14}px`;
    view.scrollLeft = keep;
    const tiles = Math.round(L.width / TILE);
    const hill = Math.round((L.hillSpans ?? [[0, L.finaleX]]).reduce((n, [a, b]) => n + b - a, 0) / TILE);
    const chases = Math.max(0, (L.hillSpans?.length ?? 1) - 1);
    const ok = (r: string) => (r === 'exit' ? '<span class="ok">reaches the gate</span>' : `<span class="bad">${esc(r)}</span>`);
    const c = built.cruise;
    const skyKinds = [...L.surfaces.map((s) => s.sky), ...L.rails.map((r) => r.sky), ...(L.skyMovers ?? []).map((m) => m.kind)].filter((k): k is string => !!k);
    const cloudN = skyKinds.filter((k) => inClouds(k) || k === 'cloud').length;
    const skyN = skyKinds.length - cloudN;
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
      <span>tries ${built.tries}</span>
      <span class="ly-sky">sky <b>${skyN}</b> pieces</span>
      <span class="ly-clouds">clouds <b>${cloudN}</b></span>
      <span class="ly-sewer">sewer <b>${(L.sewers ?? []).length}</b> tunnel${(L.sewers ?? []).length === 1 ? '' : 's'} · bot down there ${pct(c.sewer)}%</span>${warn}`;
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

  // ---------- sky beats ----------
  function drawSky(): void {
    const slots = skyRecipe(floor);
    const picked = skyPick(seed, floor, 0);
    const edited = !!floorEdit(floor).sky;
    $('lv-stag').textContent = edited ? 'edited' : 'from code';
    $('lv-stag').classList.toggle('on', edited);
    $<HTMLButtonElement>('lv-srevert').disabled = !edited;
    $('lv-sslots').innerHTML = slots
      .map((slot, i) => {
        const chips = SKY_BEAT_LIST.map((b) => {
          const lit = slot.includes(b);
          const pick = picked[i] === b;
          return `<button type="button" class="beat${lit ? ' lit' : ''}${pick ? ' pick' : ''}" data-slot="${i}" data-beat="${b}" title="${SKY_HELP[b]}">${b}</button>`;
        }).join('');
        const tools = `<button type="button" class="tool" data-up="${i}" title="move up"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="tool" data-down="${i}" title="move down"${i >= slots.length - 1 ? ' disabled' : ''}>↓</button><button type="button" class="tool" data-del="${i}" title="remove">✕</button>`;
        return `<li><span class="n">${i + 1}</span><span class="beats">${chips}</span><span class="tools">${tools}</span></li>`;
      })
      .join('') || '<li class="lv-none">no sky beats on this floor</li>';
  }

  function setSky(fn: (r: SkyBeat[][]) => void): void {
    const r = clone(skyRecipe(floor));
    fn(r);
    edit().sky = r;
    changed();
  }

  $('lv-sslots').addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest('button');
    if (!t || t.disabled) return;
    if (t.dataset.beat) {
      const i = Number(t.dataset.slot);
      const b = t.dataset.beat as SkyBeat;
      setSky((r) => {
        const has = r[i].includes(b);
        if (has && r[i].length === 1) return;
        r[i] = has ? r[i].filter((x) => x !== b) : [...r[i], b];
      });
    } else if (t.dataset.up) {
      const i = Number(t.dataset.up);
      setSky((r) => ([r[i - 1], r[i]] = [r[i], r[i - 1]]));
    } else if (t.dataset.down) {
      const i = Number(t.dataset.down);
      setSky((r) => ([r[i + 1], r[i]] = [r[i], r[i + 1]]));
    } else if (t.dataset.del) {
      const i = Number(t.dataset.del);
      setSky((r) => r.splice(i, 1));
    }
  });
  $('lv-sadd').addEventListener('click', () => setSky((r) => r.push(['roofs'])));
  $('lv-srevert').addEventListener('click', () => {
    delete edit().sky;
    changed();
  });

  // ---------- the cloud layer and the sewer ----------
  type LayerKey = 'clouds' | 'sewer';
  const LAYER = {
    clouds: { dials: CLOUD_DIALS, code: CLOUDS as unknown as Record<string, number | number[]>, tag: 'lv-ctag', box: 'lv-cdials', revert: 'lv-crevert' },
    sewer: { dials: SEWER_DIALS, code: SEWER as unknown as Record<string, number | number[]>, tag: 'lv-wtag', box: 'lv-wdials', revert: 'lv-wrevert' },
  };
  const layerEdit = (k: LayerKey): LayerEdit => (edit()[k] ??= {});
  const tidyLayer = (k: LayerKey) => {
    const e = edits.floors[String(floor)];
    if (e?.[k] && !Object.keys(e[k]!).length) delete e[k];
  };

  function drawLayer(k: LayerKey): void {
    const L = LAYER[k];
    const e = floorEdit(floor)[k] ?? {};
    const any = Object.keys(e).length > 0;
    $(L.tag).textContent = any ? 'edited' : 'from code';
    $(L.tag).classList.toggle('on', any);
    $<HTMLButtonElement>(L.revert).disabled = !any;
    const on = e.on;
    root.querySelector(`.lv-onoff[data-layer="${k}"]`)!.innerHTML = (['code', 'on', 'off'] as const)
      .map((v) => {
        const cur = v === 'code' ? on === undefined : v === 'on' ? on === true : on === false;
        const name = v === 'code' ? 'as the code builds it' : v === 'on' ? (k === 'clouds' ? 'on (any floor)' : 'on') : 'off on this floor';
        return `<button type="button" class="beat${cur ? ' lit pick' : ''}" data-on="${v}">${name}</button>`;
      })
      .join('');
    if (k === 'clouds') {
      const mix = (e.mix as string[] | undefined) ?? CLOUD_BEATS;
      $('lv-cmix').innerHTML = `<span class="lv-mixlab">beats it picks from</span>${CLOUD_BEATS.map((b) => `<button type="button" class="beat${mix.includes(b) ? ' lit' : ''}" data-mix="${b}" title="${CLOUD_HELP[b]}">${b}</button>`).join('')}`;
    }
    const fmt = (d: LayerDial, x: number) => (d.step < 1 ? (x / (d.unit ?? 1)).toFixed(2) : String(Math.round(x / (d.unit ?? 1))));
    $(L.box).innerHTML = L.dials
      .filter((d) => d.key in L.code)
      .map((d) => {
        const code = L.code[d.key];
        const v = (e[d.key] as number | number[] | undefined) ?? code;
        const edited = e[d.key] !== undefined;
        const codeText = Array.isArray(code) ? `${fmt(d, code[0])}–${fmt(d, code[1])}` : fmt(d, code);
        const inp = (x: number, i?: number) => `<input type="number" data-ldial="${d.key}"${i !== undefined ? ` data-i="${i}"` : ''} min="${d.min}" max="${d.max}" step="${d.step}" value="${fmt(d, x)}">`;
        const inputs = Array.isArray(v)
          ? `${inp(v[0], 0)} to ${inp(v[1], 1)}`
          : `<input type="range" data-ldial="${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${(v as number) / (d.unit ?? 1)}"><output>${fmt(d, v as number)}</output>`;
        return `<div class="dial${edited ? ' on' : ''}"><div class="dn"><b>${d.name}</b><span>code ${codeText}${edited ? ` · <button type="button" class="link" data-lreset="${d.key}">reset</button>` : ''}</span></div><div class="dv">${inputs}</div><div class="dh">${d.help}</div></div>`;
      })
      .join('');
  }

  for (const k of ['clouds', 'sewer'] as LayerKey[]) {
    const panel = $(`lv-${k}`);
    const L = LAYER[k];
    panel.addEventListener('click', (ev) => {
      const t = (ev.target as HTMLElement).closest('button');
      if (!t) return;
      if (t.dataset.on) {
        const e = layerEdit(k);
        if (t.dataset.on === 'code') delete e.on;
        else e.on = t.dataset.on === 'on';
        tidyLayer(k);
        changed();
      } else if (t.dataset.mix) {
        const e = layerEdit(k);
        const b = t.dataset.mix;
        const mix = (e.mix as string[] | undefined) ?? [...CLOUD_BEATS];
        const next = mix.includes(b) ? mix.filter((x) => x !== b) : [...mix, b];
        if (!next.length) return; // the layer keeps at least one beat
        if (next.length === CLOUD_BEATS.length) delete e.mix;
        else e.mix = CLOUD_BEATS.filter((x) => next.includes(x));
        tidyLayer(k);
        changed();
      } else if (t.dataset.lreset) {
        delete layerEdit(k)[t.dataset.lreset];
        tidyLayer(k);
        changed();
      } else if (t.id === L.revert) {
        delete edit()[k];
        changed();
      }
    });
    panel.addEventListener('input', (ev) => {
      const t = ev.target as HTMLInputElement;
      const key = t.dataset.ldial;
      if (!key) return;
      const d = L.dials.find((x) => x.key === key)!;
      const n = Math.min(d.max, Math.max(d.min, Number(t.value)));
      if (!isFinite(n)) return;
      const px = n * (d.unit ?? 1);
      const e = layerEdit(k);
      const code = L.code[key];
      if (Array.isArray(code)) {
        const cur = (e[key] as number[] | undefined) ?? code;
        const next: Pair = [cur[0], cur[1]];
        const i = Number(t.dataset.i);
        next[i] = px;
        if (!d.free && next[0] > next[1]) next[i === 0 ? 1 : 0] = px;
        e[key] = next;
      } else {
        e[key] = px;
        const out = t.nextElementSibling;
        if (out) out.textContent = d.step < 1 ? n.toFixed(2) : String(n);
      }
      changed(false);
    });
    panel.addEventListener('change', () => drawLayer(k));
  }

  // "show me": scroll the floor view to the first piece of a layer
  root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-goto]');
    if (!t || !built) return;
    const L = built.level;
    const want = t.dataset.goto;
    const xs =
      want === 'sewer'
        ? (L.sewers ?? []).map((s) => s.x0)
        : [...L.surfaces.filter((s) => s.sky && inClouds(s.sky) === (want === 'clouds')).map((s) => s.x0)];
    if (!xs.length) {
      toast(want === 'sewer' ? 'No sewer on this floor and road.' : want === 'clouds' ? 'No cloud layer on this floor.' : 'No sky beats on this floor.');
      return;
    }
    //(a hidden layer comes back on), then centre its name in the view and on the screen
    const k = want as keyof Layers;
    if (!layers[k]) {
      layers[k] = true;
      root.querySelector<HTMLInputElement>(`input[data-layer="${k}"]`)!.checked = true;
      drawView();
    }
    const view = $('lv-view');
    const a = view.querySelector<SVGTextElement>(`[data-anchor="${k}"]`);
    const ax = a ? Number(a.getAttribute('x')) : (Math.min(...xs) + TILE) * zoom;
    view.scrollLeft = Math.max(0, ax - view.clientWidth * 0.2);
    const ay = a ? a.getBoundingClientRect().top : view.getBoundingClientRect().top;
    root.scrollBy({ top: ay - window.innerHeight * 0.45, behavior: 'smooth' });
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
    drawSky();
    if (redrawPanels) {
      drawLayer('clouds');
      drawLayer('sewer');
    }
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
    drawSky();
    drawLayer('clouds');
    drawLayer('sewer');
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
  root.querySelectorAll<HTMLInputElement>('input[data-layer]').forEach((inp) => {
    const k = inp.dataset.layer as keyof Layers;
    inp.checked = layers[k];
    inp.addEventListener('change', () => {
      layers[k] = inp.checked;
      drawView();
    });
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

