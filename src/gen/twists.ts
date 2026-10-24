// Each district's twist (GDD: Biomes). Logged overnight (2026-10-24). A twist changes which street pieces come up,
// and some add something the physics reads, so the validator's bot skates every floor with its twist:
// - Clemente Park: ledges and long flat grinds. Rail pieces come up twice as often.
// - Ancient Greece: columns as curved rails. Curved-rail pieces come up three times as often.
// - Atlantis: currents. Stretches of street where the water pushes you forward or back while you're in the air.
// - Art Museum: indoors, low ceilings. Over the street there's a ceiling about a plain ollie above the highest thing
//   you can land on, so flips don't go higher; rail pieces come up twice as often (all grind lines).
// - High-Tech City: conveyor rails. Some flat rails run forward (faster) or back (slower) while you grind them.
// Chicago (the tutorial-friendly first act), Outer Space (its gravity is the twist) and the Hive have none yet.
import { PHYS, TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import type { BiomeId } from '../render/biomes';
import { makeRng } from './rng';
import type { Piece } from './pieces';

export type Twist = 'grinds' | 'columns' | 'currents' | 'ceiling' | 'conveyors';

export const DISTRICT_TWIST: Partial<Record<BiomeId, Twist>> = {
  clemente: 'grinds',
  greece: 'columns',
  atlantis: 'currents',
  museum: 'ceiling',
  hightech: 'conveyors',
};

export const TWIST = {
  current: { push: 0.04, min: 6 * TILE, max: 10 * TILE, gap: 6 * TILE, from: 8 * TILE }, // px/frame² in the air
  ceiling: { above: PHYS.height + 62, top: 4 * TILE }, // its underside: a body and a bit more than a plain ollie (50 px) over the highest landing
  conveyor: { chance: 0.6, speed: 1.5 }, // of flat rails; px/frame added to (or taken from) the grind
};

export interface Current {
  x0: number;
  x1: number;
  push: number; // + forward, - back
}

const hasRail = (p: Piece) => p.rows.some((r) => r.includes('='));
const curved = (p: Piece) => p.railCurve !== undefined;

// the street pieces a district draws from: its favourites more than once
export function districtPieces(library: Piece[], twist: Twist | undefined): Piece[] {
  const weight = (p: Piece) =>
    twist === 'columns' ? (curved(p) ? 3 : 1) : twist === 'grinds' || twist === 'ceiling' ? (hasRail(p) || curved(p) ? 2 : 1) : 1;
  return library.flatMap((p) => new Array<Piece>(weight(p)).fill(p));
}

// what a twist adds to a built floor
export function applyTwist(level: Level, twist: Twist | undefined, seed: number): void {
  const rng = makeRng(seed * 37 + level.layout.floor * 1051);
  if (twist === 'currents') {
    const c = TWIST.current;
    const currents: Current[] = [];
    for (let x = level.finaleX + c.from; ; ) {
      const len = c.min + Math.floor(rng() * ((c.max - c.min) / TILE + 1)) * TILE;
      if (x + len > level.exitX - 4 * TILE) break;
      currents.push({ x0: x, x1: x + len, push: rng() < 0.6 ? c.push : -c.push });
      x += len + c.gap + Math.floor(rng() * 4) * TILE;
    }
    level.currents = currents;
  } else if (twist === 'ceiling') {
    //one ceiling height per street piece, over the highest thing in it you can land on
    const w = 16 * TILE;
    const ceiling: { x0: number; x1: number; y: number }[] = [];
    for (let x0 = level.finaleX; x0 < level.width; x0 += w) {
      const x1 = x0 + w;
      let top = level.streetY;
      for (const s of level.surfaces) if (s.x1 > x0 && s.x0 < x1) top = Math.min(top, s.y, s.y1 ?? s.y);
      for (const r of level.rails) if (r.x1 > x0 && r.x0 < x1) top = Math.min(top, ...r.ys);
      for (const car of level.cars) if (car.x1 > x0 && car.x0 < x1) top = Math.min(top, car.roof);
      ceiling.push({ x0, x1, y: Math.min(top - TWIST.ceiling.above, level.streetY - TWIST.ceiling.top) });
    }
    level.ceiling = ceiling;
    //nothing to collect above it
    for (const p of level.pickups) {
      const c = ceiling.find((s) => p.x >= s.x0 && p.x < s.x1);
      if (c) p.y = Math.max(p.y, c.y + 14);
    }
  } else if (twist === 'conveyors') {
    for (const s of level.surfaces) {
      if (s.kind !== 'rail' || s.x0 < level.finaleX || rng() >= TWIST.conveyor.chance) continue;
      s.conveyor = rng() < 0.65 ? TWIST.conveyor.speed : -TWIST.conveyor.speed;
    }
  }
}
