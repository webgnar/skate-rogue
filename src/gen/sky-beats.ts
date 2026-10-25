// Sky beats (zack, 2026-10-25: "in later floors you have so much speed you fly above the power lines. i want to
// introduce a new kind of layer to the levels- where even up high like that, its using interestingly designed
// levels, like we have on the ground"). Over each stretch of hill, higher than the top route's power line, a run of
// things to land on, built beat by beat from a per-floor recipe the way the hill is (src/gen/hills.ts), and editable
// in the level editor (?levels) the same way:
// - roofs: two rooftop decks with a gap to ollie between
// - billboard: the catwalk rail along the top of a billboard
// - tower: a water tower's lid, a little higher than the rest
// - crane: a crane's boom, a long grind falling with the hill
// - scaffold: three scaffold decks stepping down
// - gap: open sky, with a Stoken in it now and then
// Physics only: nothing up here lifts you (zack rejected the launch ramps), you get here on your own air and land
// on it from above. Each piece stands `height` tiles over the highest ground behind it (as the power line does),
// so it falls with the hill, and keeps clear of the power line.
import { TILE } from '../physics/constants';
import { polyRail, type CurvedRail, type Level, type Surface } from '../physics/level';
import { PICKUPS } from './descent';
import { editFloor } from './hills';
import { floorEdit } from './level-edits';
import { makeRng, randInt, type Rng } from './rng';
import { busy, groundAt } from './top-route';

export type SkyBeat = 'roofs' | 'billboard' | 'tower' | 'crane' | 'scaffold' | 'gap';
export const SKY_BEATS: SkyBeat[] = ['roofs', 'billboard', 'tower', 'crane', 'scaffold', 'gap'];

export const SKY = {
  height: 4.5, // tiles over the highest ground behind: where a big ollie and a flip off a lip carries you at speed
  start: 0.1, // how far down each stretch of hill (0-1) the first beat stands
  behind: 8, // tiles of ground behind that counts, as for the power line
  between: [2, 3], // tiles of open sky between beats, to ollie
  roof: [6, 8], // a rooftop deck's tiles
  roofGap: [2, 3],
  billboard: [6, 8],
  tower: 3, // the water tower's lid
  towerUp: 1.5, // tiles higher than the rest
  crane: [12, 16],
  scaffold: 2.5, // each deck
  scaffoldDrop: 1, // tiles each deck stands under the last
  gap: [5, 7],
  stoken: 0.5, // a Stoken in a gap beat
};

// the code's recipes: none on act 1 (you don't fly that high yet); then simple, then mixed, then everything.
// Floors 1-15, as RECIPES; Endless reuses 10-15.
const R = (s: string) => s.split(' ').map((slot) => slot.split('/') as SkyBeat[]);
const SKY_RECIPES: SkyBeat[][][] = [
  [],
  [],
  [],
  R('roofs gap billboard gap roofs'),
  R('roofs/billboard gap tower gap billboard roofs'),
  R('billboard scaffold gap roofs gap crane'),
  R('roofs crane gap tower/billboard scaffold gap roofs'),
  R('crane gap billboard scaffold gap tower roofs'),
  R('tower gap crane roofs gap billboard/scaffold crane'),
  R('roofs billboard gap crane scaffold tower gap roofs crane'),
  R('crane tower gap scaffold billboard gap roofs crane'),
  R('scaffold crane gap tower roofs/billboard gap crane scaffold'),
  R('crane/roofs tower scaffold gap billboard crane gap tower roofs'),
  R('tower crane gap scaffold roofs billboard gap crane tower'),
  R('crane scaffold tower gap roofs crane billboard gap scaffold crane'),
];

export function skyRecipe(floor: number): SkyBeat[][] {
  const i = editFloor(floor) - 1;
  return floorEdit(editFloor(floor)).sky ?? SKY_RECIPES[i] ?? [];
}

export function skyDials(floor: number) {
  const e = floorEdit(editFloor(floor));
  return { skyHeight: e.skyHeight ?? SKY.height, skyStart: e.skyStart ?? SKY.start };
}

// the beats a stretch of hill gets: the recipe, each slot picked from the seed (each stretch its own pick)
export function skyPick(seed: number, floor: number, stretch: number): SkyBeat[] {
  const rng = makeRng(seed * 17 + floor * 3313 + stretch * 101);
  return skyRecipe(floor).map((slot) => slot[randInt(rng, slot.length)]);
}

const range = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

// over a stretch of hill [a, b]: the height a piece stands at over x, `height` tiles over the highest ground behind
function heightLine(level: Level, a: number, b: number, height: number): (x: number) => number {
  const xs: number[] = [];
  const gs: number[] = [];
  for (let x = a; x <= b; x += TILE / 2) {
    const g = groundAt(level, x);
    if (g === undefined) continue;
    xs.push(x);
    gs.push(g);
  }
  return (x: number) => {
    let g = Infinity;
    for (let i = 0; i < xs.length && xs[i] <= x; i++) if (xs[i] > x - SKY.behind * TILE) g = Math.min(g, gs[i]);
    if (g === Infinity) g = gs.find((_, i) => xs[i] >= x) ?? level.streetY;
    return g - height * TILE;
  };
}

// lay the sky beats over a built floor (after its top route, so they keep clear of its power line)
export function addSkyBeats(level: Level, seed: number): void {
  const spans = level.hillSpans;
  const floor = level.layout.floor;
  if (!spans?.length || !skyRecipe(floor).length) return;
  const d = skyDials(floor);
  const rng = makeRng(seed * 71 + floor * 6151);
  const surfaces: Surface[] = [];
  const rails: CurvedRail[] = [];
  const coins = (x0: number, x1: number, y: (x: number) => number) => {
    for (let c = x0 + TILE; c < x1 - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y(c) - PICKUPS.ride });
  };
  //a flat piece over [x0, x1], as high as its highest point needs (the hill falls away under the rest)
  const flat = (base: (x: number) => number, x0: number, x1: number, sky: SkyBeat, up = 0): boolean => {
    let y = Infinity;
    for (let x = x0; x <= x1; x += TILE / 2) y = Math.min(y, base(x));
    y -= up * TILE;
    if (busy(level, x0, x1, y)) return false;
    surfaces.push({ kind: sky === 'billboard' ? 'rail' : 'ledge', x0, x1, y, row: -1, sky, ...(sky === 'billboard' ? { material: 'metal' as const } : {}) });
    coins(x0, x1, () => y);
    return true;
  };
  spans.forEach(([a, b], i) => {
    const base = heightLine(level, a, b, d.skyHeight);
    const end = b - 4 * TILE;
    let x = a + d.skyStart * (b - a);
    for (const beat of skyPick(seed, floor, i)) {
      if (x >= end) break;
      const t = (n: number) => Math.min(n * TILE, end - x);
      if (beat === 'gap') {
        const w = t(range(rng, SKY.gap));
        if (rng() < SKY.stoken) level.pickups.push({ kind: 'stoken', x: x + w / 2, y: base(x + w / 2) - PICKUPS.arc });
        x += w;
        continue;
      }
      if (beat === 'roofs') {
        const w1 = t(range(rng, SKY.roof));
        flat(base, x, x + w1, 'roofs');
        x += w1 + range(rng, SKY.roofGap) * TILE;
        if (x < end) {
          const w2 = t(range(rng, SKY.roof));
          flat(base, x, x + w2, 'roofs');
          x += w2;
        }
      } else if (beat === 'billboard') {
        const w = t(range(rng, SKY.billboard));
        flat(base, x, x + w, 'billboard');
        x += w;
      } else if (beat === 'tower') {
        const w = t(SKY.tower);
        flat(base, x, x + w, 'tower', SKY.towerUp);
        x += w;
      } else if (beat === 'scaffold') {
        for (let k = 0; k < 3 && x < end; k++) {
          const w = t(SKY.scaffold);
          flat(base, x, x + w, 'scaffold', -k * SKY.scaffoldDrop);
          x += w + TILE;
        }
      } else if (beat === 'crane') {
        //the boom: falling with the hill, never rising (a grind doesn't climb), smoothed
        const w = t(range(rng, SKY.crane));
        const pts: [number, number][] = [];
        for (let px = x; px <= x + w; px += TILE / 2) pts.push([px, base(px) - TILE]);
        for (let k = 1; k < pts.length; k++) pts[k][1] = Math.max(pts[k][1], pts[k - 1][1]);
        const ok = pts.length >= 4 && !pts.some(([px, py]) => busy(level, px, px + TILE / 2, py));
        if (ok) {
          const r = polyRail(pts);
          r.sky = 'crane';
          rails.push(r);
          coins(x, x + w, (cx) => pts[Math.min(pts.length - 1, Math.round((cx - x) / (TILE / 2)))][1]);
        }
        x += w;
      }
      x += range(rng, SKY.between) * TILE;
    }
  });
  level.surfaces.push(...surfaces);
  level.rails.push(...rails);
}

