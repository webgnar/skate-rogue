// The one city's neighbourhoods (zack, 2026-10-24: no separate biomes; fuse every world's art into the one city).
// Along the street finale the city passes through quarters, each leaning on one of QFS's worlds: a park block
// (Clemente), an old town of temples and ruins (Greece), the waterfront with its coral (Atlantis), the museum
// block with murals on the walls (Museum), a tech block (High-Tech), a space port (Space), with plain Chicago
// between them. A quarter's world shows in its walls, some of its buildings, its scenery cards, its landmark and
// its smashables, so the mix reads as one place with neighbourhoods rather than noise.
import { makeRng } from '../gen/rng';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import type { BiomeId } from './biomes';

export const WORLDS: BiomeId[] = ['clemente', 'greece', 'atlantis', 'museum', 'hightech', 'space'];

export interface Quarter {
  x0: number; // tiles
  x1: number;
  world: BiomeId; // 'chicago' for plain city
}

export const QUARTER = { len: [22, 34], plain: [8, 16] };

const cache = new WeakMap<Level, Quarter[]>();

// the floor's quarters along the street, left to right: plain Chicago at the start, then a world, a plain
// stretch, another world... Each floor deals the worlds in its own order, so a run sees all of them.
export function quarters(level: Level): Quarter[] {
  const hit = cache.get(level);
  if (hit) return hit;
  const rng = makeRng(level.layout.seed * 41 + level.layout.floor * 977);
  const order = [...WORLDS];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const cols = level.street.length;
  const out: Quarter[] = [];
  let x = Math.round(level.finaleX / TILE);
  const span = (r: number[]) => r[0] + Math.floor(rng() * (r[1] - r[0] + 1));
  //the L stands over the start of the street: plain Chicago round it
  let plain = 26;
  let k = 0;
  while (x < cols + 20) {
    out.push({ x0: x, x1: x + plain, world: 'chicago' });
    x += plain;
    const len = span(QUARTER.len);
    out.push({ x0: x, x1: x + len, world: order[k++ % order.length] });
    x += len;
    plain = span(QUARTER.plain);
  }
  //the hill above the street is all San Francisco
  out.unshift({ x0: -Infinity, x1: Math.round(level.finaleX / TILE), world: 'chicago' });
  cache.set(level, out);
  return out;
}

// the world at x (tiles)
export function worldAt(level: Level, x: number): BiomeId {
  for (const q of quarters(level)) if (x >= q.x0 && x < q.x1) return q.world;
  return 'chicago';
}
