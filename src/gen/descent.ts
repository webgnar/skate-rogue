// Downhill floors (GDD: Floor shape). A floor starts high on the rooftops and works down to the street through
// terraces, stair sets, big handrails, drop-offs, rooftop gaps and a few banks, then finishes on a short street
// stretch built from QFS pieces (canals, curved rails, parked cars, traffic) with the exit gate.
import { TILE } from '../physics/constants';
import { buildLevel, CurvedRail, type Level, type Surface } from '../physics/level';
import { makeLayout } from './layout';
import { PIECES, type Piece } from './pieces';
import { makeRng, randInt, type Rng } from './rng';

export const DESCENT = {
  stepRise: 16, // px per step
  stepRun: TILE,
  railHeight: 24, // handrail above the step nosing
  maxSections: 24,
};

export function startHeight(floor: number): number {
  return Math.min(30, 12 + 2 * floor); // tiles above the street
}

export function sectionCount(floor: number): number {
  return Math.min(DESCENT.maxSections, 9 + 2 * floor);
}

export function maxSteps(floor: number): number {
  return Math.min(16, 10 + floor);
}

function finaleCount(floor: number): number {
  return Math.min(4, 2 + Math.floor((floor - 1) / 3));
}

const range = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

interface Builder {
  x: number; // px, where the next section starts
  h: number; // tiles above the street
  surfaces: Surface[];
  rails: CurvedRail[];
}

function yOf(streetY: number, h: number): number {
  return streetY - h * TILE;
}

function terrace(b: Builder, streetY: number, tiles: number, rng: Rng, features: boolean): void {
  const y = yOf(streetY, b.h);
  b.surfaces.push({ kind: 'roof', x0: b.x, x1: b.x + tiles * TILE, y, row: -1 });
  if (features && tiles >= 8) {
    const roll = rng();
    const len = range(rng, 4, Math.min(8, tiles - 3));
    const at = b.x + range(rng, 2, tiles - len - 1) * TILE;
    if (roll < 0.35) b.surfaces.push({ kind: 'rail', x0: at, x1: at + len * TILE, y: y - DESCENT.railHeight, row: -1 });
    else if (roll < 0.55) b.surfaces.push({ kind: 'ledge', x0: at, x1: at + len * TILE, y: y - TILE, row: -1 });
  }
  b.x += tiles * TILE;
}

function stairs(b: Builder, streetY: number, steps: number, rail: boolean): void {
  const y = yOf(streetY, b.h);
  const x1 = b.x + steps * DESCENT.stepRun;
  const y1 = y + steps * DESCENT.stepRise;
  b.surfaces.push({ kind: 'stairs', x0: b.x, x1, y, y1, row: -1 });
  //the handrail starts half a tile before the top step so you can ollie onto it from the landing
  if (rail) b.rails.push(new CurvedRail(b.x - TILE / 2, y - DESCENT.railHeight, x1, y1 - DESCENT.railHeight, 0, 8));
  b.x = x1;
  b.h -= (steps * DESCENT.stepRise) / TILE;
}

export function buildDescent(seed: number, floor: number, streetY: number): Builder {
  const rng = makeRng(seed * 7 + floor * 104723);
  const top = startHeight(floor);
  const b: Builder = { x: 0, h: top, surfaces: [], rails: [] };
  terrace(b, streetY, 10, rng, false);
  let hadStairs = false;
  let hadRail = false;
  let hadBank = false;
  const sections = sectionCount(floor);

  for (let i = 0; i < sections && b.h > 0; i++) {
    const left = sections - i;
    //drop faster when there is a lot of height left
    const need = b.h / left;
    const r = rng();
    const mustBank = !hadBank && sections >= 8 && i === Math.floor(sections / 2);
    if (mustBank || (r < 0.12 && b.h + 3 <= top && i > 1)) {
      //bank up to a higher roof; sometimes it kicks you over a gap instead
      const rise = range(rng, 1, 3);
      const len = range(rng, 4, 6);
      const y = yOf(streetY, b.h);
      b.surfaces.push({ kind: 'bank', x0: b.x, x1: b.x + len * TILE, y, y1: y - rise * TILE, row: -1 });
      b.x += len * TILE;
      b.h += rise;
      hadBank = true;
      if (rng() < 0.35) {
        b.x += range(rng, 2, 3) * TILE;
        b.h = Math.max(0, b.h - range(rng, 1, 3));
      }
      terrace(b, streetY, range(rng, 6, 10), rng, true);
    } else if (r < 0.55 || !hadStairs) {
      const most = Math.min(maxSteps(floor), Math.floor(b.h * 2));
      if (most < 4) {
        b.h = 0;
        terrace(b, streetY, 6, rng, false);
        continue;
      }
      const steps = range(rng, 4, most);
      //sets the base ollie and flip can't clear always get a handrail
      const rail = steps > 8 || rng() < 0.7;
      stairs(b, streetY, steps, rail);
      hadStairs = true;
      hadRail ||= rail;
      terrace(b, streetY, range(rng, 6, 9), rng, false);
    } else if (r < 0.78) {
      //drop-off onto the next roof
      b.h = Math.max(0, b.h - Math.min(b.h, range(rng, 2, Math.max(2, Math.min(10, Math.ceil(need * 1.5))))));
      terrace(b, streetY, range(rng, 6, 12), rng, true);
    } else {
      //rooftop gap, maybe onto a lower roof
      b.x += range(rng, 2, floor >= 3 ? 5 : 4) * TILE;
      b.h = Math.max(0, b.h - range(rng, 0, Math.min(4, Math.floor(b.h))));
      terrace(b, streetY, range(rng, 6, 12), rng, true);
    }
  }
  //finish the way down: a handrail set if none yet, then drops to street level
  if (!hadRail && b.h >= 2) {
    const steps = Math.min(16, Math.floor(b.h * 2));
    stairs(b, streetY, steps, true);
    terrace(b, streetY, 6, rng, false);
  }
  while (b.h > 0) {
    b.h = Math.max(0, b.h - Math.min(b.h, 8));
    terrace(b, streetY, 6, rng, false);
  }
  return b;
}

// the whole floor: descent, then the street finale (its start piece is the runway where the last roof meets the street)
export function buildFloor(seed: number, floor: number, library: Piece[] = PIECES): Level {
  const finale = buildLevel(makeLayout(seed, floor, library, finaleCount(floor)));
  const d = buildDescent(seed, floor, finale.streetY);
  const off = Math.ceil(d.x / TILE) * TILE;
  const cols = off / TILE;
  const shiftRail = (r: CurvedRail) => new CurvedRail(r.x0 + off, r.y0, r.x1 + off, r.y1, r.curve);
  return {
    ...finale,
    width: finale.width + off,
    street: [...new Array<boolean>(cols).fill(false), ...finale.street],
    surfaces: [...d.surfaces, ...finale.surfaces.map((s) => ({ ...s, x0: s.x0 + off, x1: s.x1 + off }))],
    rails: [...d.rails, ...finale.rails.map(shiftRail)],
    cars: finale.cars.map((c) => ({ ...c, x0: c.x0 + off, x1: c.x1 + off })),
    glass: finale.glass.map((g) => ({ x0: g.x0 + off, x1: g.x1 + off })),
    startX: 3 * TILE,
    startY: finale.streetY - startHeight(floor) * TILE,
    finaleX: off,
    exitX: finale.exitX + off,
  };
}
