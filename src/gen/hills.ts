// Chicago's descents as a San Francisco hillside (docs/level-design-chicago.md). Instead of floating rooftops, you
// skate down the hill itself: steep blocks of street that fall away (banks flagged `hill`), a flat intersection at
// the top of each block, public stairways with handrails, retaining-wall drops, crest jumps over cross streets and
// the odd short climb that kicks you into the air. Everything under the line is solid hill (src/render/hillside.ts).
//
// Each floor is a phrase with a shape, not a random pile of sections: it opens on a block to bomb, builds, peaks on
// its biggest stairway, and runs out down a last block into the street finale. Each act has a signature: act 1
// learns the hill, act 2 is rails, act 3 is the long stairways, act 4 is bombing (crest jumps and kickers), and
// act 5 throws everything in. Blocks get steeper and sets bigger with every floor.
import { TILE } from '../physics/constants';
import { CurvedRail } from '../physics/level';
import { coinArc, coinLine, DESCENT, maxSteps, PICKUPS, startHeight, stairs, terrace, yOf, type Builder } from './descent';
import { makeRng, randInt, type Rng } from './rng';
import { floorEdit } from './level-edits';

export type Beat = 'hill' | 'railHill' | 'stairs' | 'drop' | 'gap' | 'kicker';

export const HILLS = {
  grade: (floor: number) => Math.min(0.42, 0.2 + 0.018 * floor), // tiles down per tile along (SF's steepest: ~0.3)
  run: [8, 18], // tiles per block of hill
  extraTop: (floor: number) => Math.min(14, 2 + 2 * floor), // tiles over a rooftop floor's start height
  crest: [5, 8], // the flat intersection at the top of each block
  gap: (floor: number) => (floor <= 2 ? [2, 3] : [3, 4]), // crest jumps, tiles
  midSet: (floor: number) => [Math.min(10, 4 + floor), Math.min(14, 6 + floor)], // a stairway before the last
  finalSet: (floor: number) => Math.min(16, 6 + 2 * floor), // the most steps the last stairway can have
  lastBlock: 1.5, // tiles the last block falls into the street
  runOut: 10, // flat tiles at the bottom before the street, so the hill's speed is spent before the traffic
};

// every floor of a Chicago run, slot by slot; each slot picks one of its beats by seed. The last slot is always a
// stairway with a handrail (the floor's peak), then a last block runs out into the street.
export const RECIPES: Beat[][][] = [
  //act 1, learn the hill. 1: bomb a block, a small stairway, a rail down the next block, a drop, a set to finish
  [['hill'], ['stairs'], ['railHill', 'hill'], ['drop', 'hill'], ['stairs']],
  //2: the crest jump and the kicker come in, and the sets get bigger
  [['hill'], ['stairs', 'railHill'], ['gap'], ['railHill'], ['kicker'], ['drop', 'hill'], ['stairs']],
  //3: the act's big one: a rail down the first block, a crest jump, the longest sets yet
  [['railHill'], ['gap'], ['stairs'], ['hill', 'drop'], ['kicker', 'railHill'], ['hill'], ['stairs']],
  //act 2, rails: handrails down most blocks
  [['railHill'], ['stairs'], ['gap'], ['railHill'], ['drop', 'hill'], ['kicker'], ['railHill'], ['stairs']],
  [['hill'], ['railHill'], ['stairs'], ['gap'], ['railHill', 'stairs'], ['kicker'], ['railHill'], ['stairs']],
  [['railHill'], ['gap'], ['railHill'], ['stairs'], ['drop'], ['kicker'], ['railHill'], ['hill'], ['stairs']],
  //act 3, the steps: stairways back to back, landing to landing
  [['hill'], ['stairs'], ['stairs'], ['gap'], ['railHill'], ['stairs'], ['drop', 'kicker'], ['stairs']],
  [['stairs'], ['railHill'], ['stairs'], ['stairs'], ['kicker'], ['gap'], ['stairs'], ['stairs']],
  [['railHill'], ['stairs'], ['stairs'], ['gap'], ['stairs'], ['kicker'], ['railHill'], ['stairs'], ['stairs']],
  //act 4, bombing: crest jumps and kickers into them, the steepest blocks
  [['hill'], ['gap'], ['kicker'], ['gap'], ['railHill'], ['stairs'], ['kicker'], ['gap'], ['stairs']],
  [['railHill'], ['gap'], ['gap'], ['stairs'], ['kicker'], ['hill'], ['gap'], ['drop', 'railHill'], ['stairs']],
  [['hill'], ['kicker'], ['gap'], ['railHill'], ['gap'], ['stairs'], ['kicker'], ['gap'], ['hill'], ['stairs']],
  //act 5, everything, the longest floors
  [['railHill'], ['gap'], ['stairs'], ['kicker'], ['gap'], ['railHill'], ['stairs'], ['drop', 'hill'], ['gap'], ['stairs']],
  [['hill'], ['gap'], ['railHill'], ['stairs'], ['stairs'], ['kicker'], ['gap'], ['railHill'], ['drop'], ['stairs']],
  [['railHill'], ['gap'], ['stairs'], ['kicker'], ['gap'], ['railHill'], ['stairs'], ['gap'], ['kicker'], ['railHill'], ['stairs']],
];

// how much of the floor's height each beat takes (a kicker climbs, so it's paid for by the others)
const WEIGHT: Record<Beat, number> = { hill: 1, railHill: 1.1, stairs: 1, drop: 0.6, gap: 1.2, kicker: 0 };

const range = (rng: Rng, [lo, hi]: number[]) => lo + randInt(rng, hi - lo + 1);

// a hill floor starts higher than a rooftop one: the blocks of street need the height to be steep
export function hillTop(floor: number): number {
  return floorEdit(editFloor(floor)).top ?? startHeight(floor) + HILLS.extraTop(floor);
}

// the floor whose edits (src/gen/level-edits.ts) a floor follows: itself, or for Endless the one its recipe reuses
export function editFloor(floor: number): number {
  return recipeIndex(floor) + 1;
}

// a floor's dials: its edits over the code's
export function hillDials(floor: number) {
  const e = floorEdit(editFloor(floor));
  return {
    grade: e.grade ?? HILLS.grade(floor),
    top: hillTop(floor),
    run: e.run ?? HILLS.run,
    crest: e.crest ?? HILLS.crest,
    gap: e.gap ?? HILLS.gap(floor),
    midSet: e.midSet ?? HILLS.midSet(floor),
    finalSet: e.finalSet ?? HILLS.finalSet(floor),
  };
}

// a floor's recipe: its edited one, or the code's
export function floorRecipe(floor: number): Beat[][] {
  return floorEdit(editFloor(floor)).recipe ?? RECIPES[recipeIndex(floor)];
}

// the recipe a floor follows: its own for floors 1-15; Endless cycles acts 4 and 5
export function recipeIndex(floor: number): number {
  return floor <= RECIPES.length ? Math.max(0, floor - 1) : 9 + ((floor - 1) % 6);
}

export function recipe(seed: number, floor: number): Beat[] {
  const rng = makeRng(seed * 13 + floor * 2087);
  return floorRecipe(floor).map((slot) => slot[randInt(rng, slot.length)]);
}

// a block of street falling `drop` tiles over `run` tiles, its coins skimming the road (or along its handrail)
function hill(b: Builder, streetY: number, run: number, drop: number, rail: boolean): void {
  const y = yOf(streetY, b.h);
  const x1 = b.x + run * TILE;
  const y1 = y + drop * TILE;
  b.surfaces.push({ kind: 'bank', x0: b.x, x1, y, y1, row: -1, hill: true });
  const r = DESCENT.railHeight;
  if (rail) {
    //the sidewalk handrail down the block, from half a tile over the crest like a stair rail
    const end = x1 - TILE;
    const yEnd = y + ((end - b.x) / (x1 - b.x)) * (y1 - y);
    b.rails.push(new CurvedRail(b.x - TILE / 2, y - r, end, yEnd - r, 0, 8));
    coinLine(b, b.x + TILE, y + (TILE / (x1 - b.x)) * (y1 - y) - r - PICKUPS.ride, end - TILE, yEnd - r - PICKUPS.ride);
  } else {
    coinLine(b, b.x + 2 * TILE, y + ((2 * TILE) / (x1 - b.x)) * (y1 - y) - PICKUPS.ride, x1 - 2 * TILE, y1 - ((2 * TILE) / (x1 - b.x)) * (y1 - y) - PICKUPS.ride);
  }
  b.x = x1;
  b.h -= drop;
}

export function buildHills(seed: number, floor: number, streetY: number, short = false): Builder {
  const rng = makeRng(seed * 7 + floor * 104723);
  const dials = hillDials(floor);
  const grade = dials.grade;
  const top = Math.ceil(dials.top * (short ? 0.6 : 1));
  const b: Builder = { x: 0, h: top, top, surfaces: [], rails: [], pickups: [], prng: makeRng(seed * 11 + floor * 7477) };
  let beats = recipe(seed, floor);
  //a stash floor keeps the opening block and the last stairway
  if (short) beats = [beats[0], ...beats.slice(-2)];
  //the top of the hill: a flat run-up to get rolling
  terrace(b, streetY, 10, rng, false);
  const crest = (features: boolean) => terrace(b, streetY, range(rng, dials.crest), rng, features && floor > 1);
  //the height is planned up front: the last stairway (the floor's peak) gets its set, a short block runs out into
  //the street, and the beats between share the rest by weight, so no beat is left with nothing to drop
  //an edited last stairway can go past the floor's usual stair cap; the height still limits it
  const cap = floorEdit(editFloor(floor)).finalSet !== undefined ? dials.finalSet : maxSteps(floor);
  const finalSteps = Math.min(cap, dials.finalSet, Math.floor((top - 2) * 2 * 0.45));
  const rises = beats.map((beat) => (beat === 'kicker' ? range(rng, [1, 2]) : 0));
  let budget = top - finalSteps / 2 - HILLS.lastBlock + rises.reduce((a, r) => a + r, 0);
  let weights = beats.slice(0, -1).reduce((a, beat) => a + WEIGHT[beat], 0);
  const runFor = (drop: number) => Math.min(dials.run[1] + 4, Math.max(dials.run[0], Math.round(drop / grade)));

  beats.forEach((beat, i) => {
    const last = i === beats.length - 1;
    const plan = last ? 0 : weights > 0 ? (budget * WEIGHT[beat]) / weights : 0;
    const before = b.h;
    if (beat === 'hill' || beat === 'railHill') {
      const drop = Math.max(1, Math.min(b.h - 1, plan));
      hill(b, streetY, runFor(drop), drop, beat === 'railHill');
      crest(true);
    } else if (beat === 'stairs') {
      const [lo, hi] = dials.midSet;
      const steps = last ? finalSteps : Math.min(hi, Math.max(lo, Math.round(plan * 2)));
      //sets the base ollie and flip can't clear always get a handrail; floor 1's always do, to learn on
      const rail = steps > 8 || floor === 1 || last || rng() < 0.7;
      stairs(b, streetY, Math.min(steps, Math.floor(b.h * 2)), rail);
      crest(false);
    } else if (beat === 'drop') {
      //a retaining wall down onto the next street
      const drop = Math.min(b.h - 1, Math.max(1.5, Math.min(floor >= 3 ? 4 : 3, plan)));
      const from = { x: b.x, y: yOf(streetY, b.h) };
      b.h -= drop;
      coinArc(b, from.x - TILE, from.y - PICKUPS.ride, from.x + 3 * TILE, yOf(streetY, b.h) - PICKUPS.ride, 30);
      crest(true);
    } else if (beat === 'gap') {
      //a crest jump: off the flat intersection, over the cross street, onto the next block falling away under you
      const from = { x: b.x, y: yOf(streetY, b.h) };
      b.x += range(rng, dials.gap) * TILE;
      b.h -= 1;
      const to = { x: b.x + TILE, y: yOf(streetY, b.h) };
      coinArc(b, from.x - TILE, from.y - PICKUPS.ride, to.x, to.y - PICKUPS.ride, PICKUPS.arc);
      if (b.prng() < 0.5) b.pickups.push({ kind: 'stoken', x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - PICKUPS.high });
      const drop = Math.max(1, Math.min(b.h - 1, plan - 1));
      hill(b, streetY, runFor(drop), drop, false);
      crest(true);
    } else {
      //kicker: a short climb up to the next corner that throws you into the air at the top
      const rise = rises[i];
      const y = yOf(streetY, b.h);
      const len = range(rng, [4, 5]);
      b.surfaces.push({ kind: 'bank', x0: b.x, x1: b.x + len * TILE, y, y1: y - rise * TILE, row: -1 });
      b.x += len * TILE;
      b.h += rise;
      if (b.prng() < 0.6) b.pickups.push({ kind: 'stoken', x: b.x + 2 * TILE, y: yOf(streetY, b.h) - PICKUPS.high });
      crest(true);
    }
    if (!last) {
      budget -= before - b.h + rises[i];
      weights -= WEIGHT[beat];
    }
  });
  //the run-out: the last block down to the street
  if (b.h > 0) {
    const run = Math.max(8, Math.ceil(b.h / grade));
    hill(b, streetY, run, b.h, false);
    terrace(b, streetY, HILLS.runOut, rng, false);
  }
  return b;
}
