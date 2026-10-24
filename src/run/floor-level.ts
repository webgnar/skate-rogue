// The floor a run is on: the tutorial, an act's escape, or a validated floor with its twist (one fused world: no
// districts, so no district gravity).
// Pure, so the game and the playtest bot build exactly the same floor for a seed, floor and road.
import type { Level } from '../physics/level';
import type { Road } from '../gen/roads';
import { rollFork } from '../gen/roads';
import { validatedFloor } from '../gen/validate';
import { validatedEscape } from '../gen/escape';
import { tutorialLevel } from '../gen/tutorial';
import { floorTwist } from '../gen/twists';
import { gnarDanger } from './gnar';
import type { Library } from './meta';

export interface FloorSpec {
  seed: number;
  floor: number;
  road: Road;
  library: Library;
  gnar: number;
  tutorial?: boolean;
}

export function floorLevel(s: FloorSpec): Level {
  if (s.tutorial) return tutorialLevel(s.seed);
  if (s.road.kind === 'escape') return validatedEscape(s.seed, s.road.act);
  return validatedFloor(s.seed, s.floor, {
    fork: rollFork(s.seed, s.floor, s.library.types),
    danger: gnarDanger(s.road.danger, s.gnar),
    short: s.road.kind === 'stash',
    twist: floorTwist(s.seed, s.floor),
    hills: true,
  }).level;
}
