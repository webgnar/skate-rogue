// Floor twists. They started as one per district (GDD: Biomes); since there's one fused world now (zack, Oct 24
// 2026: no separate biomes), any floor from act 2 on can roll one (floorTwist). A twist changes which street pieces
// come up, and some add something the physics reads, so the validator's bot skates every floor with its twist:
// - grinds: ledges and long flat grinds. Rail pieces come up twice as often.
// - columns: curved rails, and collapsing ruins. Curved-rail pieces come up three times as often, and most floating
//   ledges are ruins that fall a moment after you land on them: keep moving.
// - currents: stretches of street where the wind pushes you forward or back while you're in the air.
// - ceiling: a low ceiling (a tunnel) about a plain ollie above the highest thing you can land on, so flips don't go
//   higher; rail pieces come up twice as often (all grind lines).
// - conveyors: some flat rails run forward (faster) or back (slower) while you grind them.
import { PHYS, TILE } from '../physics/constants';
import { inHill, type Level } from '../physics/level';
import { makeRng } from './rng';
import type { Piece } from './pieces';

export type Twist = 'grinds' | 'columns' | 'currents' | 'ceiling' | 'conveyors';

export const TWISTS: Twist[] = ['grinds', 'columns', 'currents', 'ceiling', 'conveyors'];

// a floor's twist: none in act 1 (learning the street), then about half of the floors get one, by the seed
export function floorTwist(seed: number, floor: number): Twist | undefined {
  if (floor <= TWIST.plainFloors) return undefined;
  const rng = makeRng(seed * 13 + floor * 7919);
  return rng() < TWIST.chance ? TWISTS[Math.floor(rng() * TWISTS.length)] : undefined;
}

export const TWIST = {
  plainFloors: 3, // act 1 has none
  chance: 0.5, // of a later floor having one
  current: { push: 0.04, min: 6 * TILE, max: 10 * TILE, gap: 6 * TILE, from: 8 * TILE }, // px/frame² in the air
  ceiling: { above: PHYS.height + 62, top: 4 * TILE }, // its underside: a body and a bit more than a plain ollie (50 px) over the highest landing
  conveyor: { chance: 0.6, speed: 1.5 }, // of flat rails; px/frame added to (or taken from) the grind
  ruin: { chance: 0.7 }, // of the floor's floating ledges
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
      //the street chases only, not the stretches of hill between them
      if (inHill(level, x) || inHill(level, x + len)) {
        x += 2 * TILE;
        continue;
      }
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
      if (inHill(level, x0) || inHill(level, x1 - 1)) continue;
      //over its neighbours' too: a rail (or a Ghost Rail off its end) running up to the next piece mustn't go into
      //that piece's ceiling, which had the skater popping into it and re-landing on the rail's end forever
      const [a, b] = [x0 - w, x1 + w];
      let top = level.streetY;
      for (const s of level.surfaces) if (s.x1 > a && s.x0 < b) top = Math.min(top, s.y, s.y1 ?? s.y);
      for (const r of level.rails) if (r.x1 > a && r.x0 < b) top = Math.min(top, ...r.ys);
      for (const car of level.cars) if (car.x1 > a && car.x0 < b) top = Math.min(top, car.roof);
      ceiling.push({ x0, x1, y: Math.min(top - TWIST.ceiling.above, level.streetY - TWIST.ceiling.top) });
    }
    level.ceiling = ceiling;
    //nothing to collect above it
    for (const p of level.pickups) {
      const c = ceiling.find((s) => p.x >= s.x0 && p.x < s.x1);
      if (c) p.y = Math.max(p.y, c.y + 14);
    }
  } else if (twist === 'columns') {
    for (const s of level.surfaces) if (s.kind === 'ledge' && rng() < TWIST.ruin.chance) s.crumble = true;
  } else if (twist === 'conveyors') {
    for (const s of level.surfaces) {
      if (s.kind !== 'rail' || inHill(level, s.x0) || rng() >= TWIST.conveyor.chance) continue;
      s.conveyor = rng() < 0.65 ? TWIST.conveyor.speed : -TWIST.conveyor.speed;
    }
  }
}
