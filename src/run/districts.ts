// One district per run (zack, Oct 24 2026: "biomes should not change until the player has gotten to the end of the
// game for that biome"). All five acts of a run happen in the district picked before it; escaping the city there
// opens the next one in the GDD's biome order. A new save has Chicago only. The daily run draws its district from
// the day's seed, so everyone skates the same one.
import type { BiomeId } from '../render/biomes';
import { makeRng, randInt } from '../gen/rng';

export const DISTRICT_ORDER: BiomeId[] = ['chicago', 'clemente', 'greece', 'atlantis', 'museum', 'hightech', 'space', 'hive'];

export function isDistrict(id: unknown): id is BiomeId {
  return DISTRICT_ORDER.includes(id as BiomeId);
}

// the districts a save can start a run in: Chicago, plus the one after each escaped district
export function districtsOpen(cleared: BiomeId[]): BiomeId[] {
  let n = 1;
  DISTRICT_ORDER.forEach((d, i) => {
    if (cleared.includes(d)) n = Math.max(n, i + 2);
  });
  return DISTRICT_ORDER.slice(0, Math.min(n, DISTRICT_ORDER.length));
}

// the district that a win in this one opens, if it's new
export function nextDistrict(d: BiomeId, cleared: BiomeId[]): BiomeId | null {
  const next = DISTRICT_ORDER[DISTRICT_ORDER.indexOf(d) + 1];
  return next && !districtsOpen(cleared).includes(next) ? next : null;
}

export function dailyDistrict(seed: number): BiomeId {
  return DISTRICT_ORDER[randInt(makeRng(seed * 31 + 7), DISTRICT_ORDER.length)];
}
