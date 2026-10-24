// Wanted posters (GDD: Risk and reward inside a floor). Logged overnight (2026-10-24): from floor 2, about one floor
// in three has an AI wanted poster where the street starts. It offers a bounty: reach the gate with Heat at 50 or more and
// the Stoken you grabbed on that floor pays double (at least 3). Playing hot means the cruiser is close; the
// reward is meta currency, so it's a choice between this run and the unlock tree. Pure.
import { makeRng } from '../gen/rng';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';

export const BOUNTY = {
  from: 2,
  chance: 0.33,
  heat: 50, // Heat at the gate to claim it
  min: 3, // Stoken paid at least, even on a floor with none grabbed
  at: 6 * TILE, // the poster stands this far along the street, once the descent is done
};

export function bountyPlan(level: Level, seed: number): { x: number } | null {
  const floor = level.layout.floor;
  if (floor < BOUNTY.from || level.escape) return null;
  const rng = makeRng(seed * 37 + floor * 1597);
  return rng() < BOUNTY.chance ? { x: Math.max(level.startX, level.finaleX) + BOUNTY.at } : null;
}

// the bounty for a floor: the Stoken grabbed on it again, if Heat at the gate was high enough
export function bountyPay(grabbed: number, heat: number): number {
  return heat >= BOUNTY.heat ? Math.max(BOUNTY.min, grabbed) : 0;
}
