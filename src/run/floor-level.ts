// The floor a run is on: the tutorial, an act's escape, or a validated floor with its twist, in its act's gravity
// (ACT_GRAVITY: street gravity in the city acts, lighter at the top of the climb).
// Pure, so the game and the playtest bot build exactly the same floor for a seed, floor and road.
import type { Level } from '../physics/level';
import type { Road } from '../gen/roads';
import { rollFork } from '../gen/roads';
import { validatedFloor } from '../gen/validate';
import { actOf, FLOORS_PER_ACT, validatedEscape } from '../gen/escape';
import { cloudFloor } from '../gen/clouds';
import { huntSpots } from '../sim/drones';
import { makeRng } from '../gen/rng';
import { actGravity } from '../physics/feel';
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
  const level = validatedFloor(s.seed, s.floor, {
    fork: rollFork(s.seed, s.floor, s.library.types),
    danger: gnarDanger(s.road.danger, s.gnar),
    short: s.road.kind === 'stash',
    twist: floorTwist(s.seed, s.floor),
    hills: true,
    gravity: actGravity(actOf(s.floor)),
  }).level;
  //act 3's first floor: act 2's drones followed you up (src/sim/drones.ts huntSpots), over the clouds and steps
  if (cloudFloor(s.floor) && s.floor % FLOORS_PER_ACT === 1) {
    const pieces = level.surfaces.filter((p) => p.sky === 'cloud' || p.sky === 'step');
    level.hunt = huntSpots(pieces, level.startX, makeRng(s.seed * 17 + s.floor * 811));
  }
  return level;
}
