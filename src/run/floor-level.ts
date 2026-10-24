// The floor a run is on: the tutorial, an act's escape, or a validated floor in its district's gravity and twist.
// Pure, so the game and the playtest bot build exactly the same floor for a seed, floor and road.
import type { Level } from '../physics/level';
import type { Road } from '../gen/roads';
import { rollFork } from '../gen/roads';
import { validatedFloor } from '../gen/validate';
import { validatedEscape } from '../gen/escape';
import { tutorialLevel } from '../gen/tutorial';
import { DISTRICT_TWIST } from '../gen/twists';
import { gnarDanger } from './gnar';
import { BIOME_GRAVITY } from '../physics/feel';
import type { BiomeId } from '../render/biomes';
import type { Library } from './meta';

export interface FloorSpec {
  seed: number;
  floor: number;
  road: Road;
  library: Library;
  gnar: number;
  tutorial?: boolean;
  district?: BiomeId; // the run's district (src/run/districts.ts); Chicago if left out
}

export function floorLevel(s: FloorSpec): Level {
  if (s.tutorial) return tutorialLevel(s.seed);
  if (s.road.kind === 'escape') return validatedEscape(s.seed, s.road.act);
  const district = floorDistrict(s);
  return validatedFloor(s.seed, s.floor, {
    fork: rollFork(s.seed, s.floor, s.library.types),
    danger: gnarDanger(s.road.danger, s.gnar),
    short: s.road.kind === 'stash',
    gravity: BIOME_GRAVITY[district] ?? 1,
    twist: DISTRICT_TWIST[district],
  }).level;
}

// the district a floor is skated in: the run's, every act of it
export function floorDistrict(s: Pick<FloorSpec, 'district'>): BiomeId {
  return s.district ?? 'chicago';
}
