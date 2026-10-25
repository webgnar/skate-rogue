// Side lines (GDD: Risk and reward inside a floor): an optional high line over the street, a chain of floating
// ledges climbing away from the traffic, with coins along it and a Stoken at the top. Ollie and flip up onto the
// first ledge, ollie from ledge to ledge, and the last one drops you back to the street. Missing it costs nothing.
// Logged overnight (2026-10-24).
import { TILE } from '../physics/constants';
import type { Level, Surface } from '../physics/level';
import { PICKUPS } from './descent';
import { makeRng } from './rng';

export const SIDE = {
  from: 2,
  chance: 0.65,
  steps: [2, 2.5, 3, 3], // each ledge's height over the street, tiles: the first needs an ollie and a flip
  len: [4, 5], // tiles per ledge: room to land, sit out the impact (no ollie for 350 ms) and ollie on
  gap: [2, 3], // tiles between ledges: a plain ollie
  clear: 1.4 * TILE, // nothing under the line may stand taller than this (a parked car's roof, 40 px, is fine: hop up from it)
};

const between = (rng: () => number, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

// the side line's ledges, added to the level (and its coins and Stoken to its pickups); none on early floors,
// escapes or the tutorial
export function addSideLine(level: Level, seed: number): Surface[] {
  const floor = level.layout.floor;
  if (floor < SIDE.from || level.escape || level.tutorial) return [];
  const rng = makeRng(seed * 41 + floor * 3313);
  if (rng() >= SIDE.chance) return [];
  const lens = SIDE.steps.map(() => between(rng, SIDE.len));
  const gaps = SIDE.steps.slice(1).map(() => between(rng, SIDE.gap));
  const width = (lens.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0)) * TILE;
  const top = level.streetY - SIDE.clear;
  const tall = (x0: number, x1: number) =>
    level.surfaces.some((s) => s.x1 > x0 && s.x0 < x1 && Math.min(s.y, s.y1 ?? s.y) < top) ||
    level.rails.some((r) => r.x1 > x0 && r.x0 < x1 && Math.min(...r.ys) < top) ||
    level.cars.some((c) => c.x1 > x0 && c.x0 < x1 && (c.model || c.roof < top));
  const first = level.finaleX + 8 * TILE;
  const last = (level.fork ? level.fork.x0 : level.exitX) - 6 * TILE - width;
  if (last <= first) return [];
  //from a random point, the first window that's clear (a tile of run-up before it too)
  const span = Math.floor((last - first) / TILE);
  const start = Math.floor(rng() * (span + 1));
  for (let k = 0; k <= span; k++) {
    const x0 = first + ((start + k) % (span + 1)) * TILE;
    if (tall(x0 - 3 * TILE, x0 + width)) continue;
    const ledges: Surface[] = [];
    let x = x0;
    SIDE.steps.forEach((h, i) => {
      const y = level.streetY - h * TILE;
      ledges.push({ kind: 'ledge', x0: x, x1: x + lens[i] * TILE, y, row: -1, side: true });
      for (let c = x + TILE / 2; c < x + lens[i] * TILE; c += TILE) level.pickups.push({ kind: 'cash', x: c, y: y - PICKUPS.ride });
      x += lens[i] * TILE + (gaps[i] ?? 0) * TILE;
    });
    const end = ledges[ledges.length - 1];
    level.pickups.push({ kind: 'stoken', x: end.x1 - TILE, y: end.y - PICKUPS.ride - 8 });
    level.surfaces.push(...ledges);
    return ledges;
  }
  return [];
}
