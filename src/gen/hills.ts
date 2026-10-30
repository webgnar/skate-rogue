// Chicago's descents as a San Francisco hillside (docs/level-design-chicago.md). Instead of floating rooftops, you
// skate down the hill itself: steep blocks of street that fall away (banks flagged `hill`), a flat intersection at
// the top of each block, public stairways with handrails, retaining-wall drops, crest jumps over cross streets and
// the odd short climb that kicks you into the air. Everything under the line is solid hill (src/render/hillside.ts).
//
// Each floor is a phrase with a shape, not a random pile of sections: it opens on a block to bomb, builds, peaks on
// its biggest stairway, and runs out down a last block into the street finale. Each act has a signature: act 1
// learns the hill, act 2 is rails, act 3 is the long stairways, act 4 is bombing (crest jumps and kickers), and
// act 5 throws everything in. Blocks get steeper and sets bigger with every floor.
import { PHYS, TILE } from '../physics/constants';
import { CHUNK_W } from './layout';
import { CurvedRail } from '../physics/level';
import { coinArc, coinLine, DESCENT, maxSteps, PICKUPS, startHeight, stairs, terrace, yOf, type Builder } from './descent';
import { makeRng, randInt, type Rng } from './rng';
import { floorEdit } from './level-edits';

export type Beat = 'hill' | 'railHill' | 'stairs' | 'drop' | 'gap' | 'kicker' | 'chase' | 'cross' | 'skitch';

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
  // a street chase partway down: this many street pieces with traffic, then a cable car back up the next hill
  chasePieces: (floor: number) => Math.min(4, 2 + Math.floor(floor / 4)),
  climbTop: (floor: number) => Math.min(22, 10 + floor), // tiles the cable car takes you up
  climbGrade: 0.45,
  tow: 2.2, // the cable's speed, times cruising speed
  // power lines strung low over some blocks to grind (zack: "the player should be able to grind these at times")
  wire: { chance: 0.45, min: 10, height: 2, sag: 0.45 }, // tiles: the wire's height over the road at its poles
};

// Chinatown (zack, 2026-10-30): once an act, the stretch of hill after the cable car is a Chinatown block. Its
// intersections have cross traffic driving straight across them ('cross'), and one long flat has a cab you skitch
// for speed into a kicker ('skitch'): at the cab's speed an ollie and a flip off it reach the top route's power line,
// at your own you fall short and bomb the block below (src/traffic/hill-cross.ts, src/traffic/cab.ts)
export const CHINATOWN = {
  floors: [5, 8, 11, 14], // the middle floor of acts 2-5; Endless every third floor
  stretch: 1, // which stretch of hill (0 is the floor's first, 1 the one up the first cable car)
  recipe: [['cross'], ['skitch'], ['cross', 'railHill'], ['cross'], ['stairs']] as Beat[][],
  crest: [7, 8], // tiles: an intersection with cross traffic, the cross street across its middle
  flat: [28, 32], // tiles: the cab's flat, kicker and all
  cabFrom: 3, // tiles into the flat the cab waits, idling
  kicker: { len: 3, rise: 1.5, fromEnd: 6 }, // tiles: the kicker's run and lip, and how far from the flat's end it stands
  wireOverLip: 5, // tiles: the top route's power line starts this far over the kicker's lip
  wireHold: 14, // tiles: and holds that height this far on
};

// the stretch of a floor that's Chinatown, if any
export function chinatownStretch(floor: number): number | undefined {
  const on = floor <= RECIPES.length ? CHINATOWN.floors.includes(floor) : floor % 3 === 2;
  return on ? CHINATOWN.stretch : undefined;
}

// every floor, slot by slot; each slot picks one of its beats by seed. A 'chase' slot ends a stretch of hill: the
// floor runs out into a street chase with traffic, then a cable car takes you up the next hill and the next stretch
// starts. Each stretch ends on a stairway with a handrail; the floor's last one is its peak, then a last block runs
// out into the street finale.
export const RECIPES: Beat[][][] = [
  //act 1, learn the hill. 1: bomb a block, a small stairway, a rail down the next block, a set; the chase; then a
  //drop and a set to finish
  [['hill'], ['stairs'], ['railHill', 'hill'], ['stairs'], ['chase'], ['hill'], ['drop', 'hill'], ['stairs']],
  //2: the crest jump and the kicker come in, and the sets get bigger
  [['hill'], ['stairs', 'railHill'], ['gap'], ['railHill'], ['stairs'], ['chase'], ['kicker'], ['drop', 'hill'], ['railHill'], ['stairs']],
  //3: the act's big one: a rail down the first block, a crest jump, the longest sets yet
  [['railHill'], ['gap'], ['stairs'], ['hill', 'drop'], ['stairs'], ['chase'], ['kicker', 'railHill'], ['gap'], ['hill'], ['stairs']],
  //act 2, rails: handrails down most blocks; floor 6 has two chases
  [['railHill'], ['stairs'], ['gap'], ['railHill'], ['stairs'], ['chase'], ['railHill'], ['drop', 'hill'], ['kicker'], ['railHill'], ['stairs']],
  [['hill'], ['railHill'], ['stairs'], ['gap'], ['railHill', 'stairs'], ['chase'], ['kicker'], ['railHill'], ['stairs'], ['railHill'], ['stairs']],
  [['railHill'], ['gap'], ['railHill'], ['stairs'], ['chase'], ['drop'], ['kicker'], ['railHill'], ['stairs'], ['chase'], ['railHill'], ['hill'], ['stairs']],
  //act 3, the steps: stairways back to back, landing to landing; three stretches of hill from here
  [['hill'], ['stairs'], ['stairs'], ['gap'], ['stairs'], ['chase'], ['railHill'], ['stairs'], ['drop', 'kicker'], ['stairs'], ['chase'], ['stairs'], ['stairs']],
  [['stairs'], ['railHill'], ['stairs'], ['stairs'], ['chase'], ['kicker'], ['gap'], ['stairs'], ['stairs'], ['chase'], ['railHill'], ['stairs'], ['stairs']],
  [['railHill'], ['stairs'], ['stairs'], ['gap'], ['stairs'], ['chase'], ['kicker'], ['railHill'], ['stairs'], ['chase'], ['stairs'], ['gap'], ['stairs'], ['stairs']],
  //act 4, bombing: crest jumps and kickers into them, the steepest blocks
  [['hill'], ['gap'], ['kicker'], ['gap'], ['stairs'], ['chase'], ['railHill'], ['stairs'], ['kicker'], ['gap'], ['stairs'], ['chase'], ['hill'], ['gap'], ['stairs']],
  [['railHill'], ['gap'], ['gap'], ['stairs'], ['chase'], ['kicker'], ['hill'], ['gap'], ['stairs'], ['chase'], ['drop', 'railHill'], ['gap'], ['kicker'], ['stairs']],
  [['hill'], ['kicker'], ['gap'], ['railHill'], ['stairs'], ['chase'], ['gap'], ['stairs'], ['kicker'], ['gap'], ['stairs'], ['chase'], ['hill'], ['gap'], ['stairs']],
  //act 5, everything, the longest floors
  [['railHill'], ['gap'], ['stairs'], ['kicker'], ['stairs'], ['chase'], ['gap'], ['railHill'], ['stairs'], ['drop', 'hill'], ['stairs'], ['chase'], ['gap'], ['kicker'], ['stairs']],
  [['hill'], ['gap'], ['railHill'], ['stairs'], ['chase'], ['stairs'], ['kicker'], ['gap'], ['railHill'], ['stairs'], ['chase'], ['drop'], ['gap'], ['stairs']],
  [['railHill'], ['gap'], ['stairs'], ['kicker'], ['stairs'], ['chase'], ['gap'], ['railHill'], ['stairs'], ['gap'], ['stairs'], ['chase'], ['kicker'], ['railHill'], ['gap'], ['stairs']],
];

// how much of the floor's height each beat takes (a kicker climbs, so it's paid for by the others)
const WEIGHT: Record<Beat, number> = { hill: 1, railHill: 1.1, stairs: 1, drop: 0.6, gap: 1.2, kicker: 0, chase: 0, cross: 1, skitch: 0 };

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
    climbTop: e.climbTop ?? HILLS.climbTop(floor), // the cable car's climb (tiles) and the street pieces of each chase
    chasePieces: e.chasePieces ?? HILLS.chasePieces(floor),
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

// the floor's stretches of hill, split at its chases; a stash floor is one short stretch
export function stretches(seed: number, floor: number, short = false): Beat[][] {
  const out: Beat[][] = [[]];
  for (const beat of recipe(seed, floor)) {
    if (beat === 'chase') out.push([]);
    else out[out.length - 1].push(beat);
  }
  const kept = out.filter((s) => s.length);
  if (short) {
    const all = kept.flat();
    return [[all[0], ...all.slice(-2)]];
  }
  const ct = chinatownStretch(floor);
  if (ct !== undefined && ct < kept.length) {
    const rng = makeRng(seed * 19 + floor * 6151);
    kept[ct] = CHINATOWN.recipe.map((slot) => slot[randInt(rng, slot.length)]);
  }
  return kept;
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
  } else if (b.prng() < HILLS.wire.chance && run >= HILLS.wire.min) {
    //a power line strung low over the block from pole to pole, sagging between: ollie and flip up to grind it
    const w = HILLS.wire;
    const [xa, xb] = [b.x + TILE, x1 - TILE];
    const at = (x: number) => y + ((x - b.x) / (x1 - b.x)) * (y1 - y) - w.height * TILE;
    const line = new CurvedRail(xa, at(xa), xb, at(xb), w.sag * TILE);
    line.wire = true;
    b.rails.push(line);
    for (let d = 2 * TILE; d < line.length - TILE; d += TILE) {
      const p = line.at(d);
      b.pickups.push({ kind: 'cash', x: p.x, y: p.y - PICKUPS.ride });
    }
  } else {
    coinLine(b, b.x + 2 * TILE, y + ((2 * TILE) / (x1 - b.x)) * (y1 - y) - PICKUPS.ride, x1 - 2 * TILE, y1 - ((2 * TILE) / (x1 - b.x)) * (y1 - y) - PICKUPS.ride);
  }
  b.x = x1;
  b.h -= drop;
}

export function buildHills(seed: number, floor: number, streetY: number, short = false): Builder {
  const rng = makeRng(seed * 7 + floor * 104723);
  const top = Math.ceil(hillDials(floor).top * (short ? 0.6 : 1));
  const b: Builder = { x: 0, h: top, top, surfaces: [], rails: [], pickups: [], prng: makeRng(seed * 11 + floor * 7477) };
  //the top of the hill: a flat run-up to get rolling
  terrace(b, streetY, 10, rng, false);
  stretch(b, rng, stretches(seed, floor, short)[0], streetY, floor);
  return b;
}

// a later stretch of hill, from the street chase before it (x = 0 at its foot): the cable car up the hill, a crest,
// its beats down, and a run-out into the next street, padded to whole pieces
export function buildClimb(seed: number, floor: number, streetY: number, k: number): Builder {
  const rng = makeRng(seed * 7 + floor * 104723 + k * 7919);
  const top = hillDials(floor).climbTop;
  const b: Builder = { x: 0, h: 0, top, surfaces: [], rails: [], pickups: [], prng: makeRng(seed * 11 + floor * 7477 + k * 31) };
  //a few flat tiles off the street, then the cable car's slot up the hill
  terrace(b, streetY, 3, rng, false);
  const run = Math.ceil(top / HILLS.climbGrade);
  const y = yOf(streetY, 0);
  b.surfaces.push({ kind: 'bank', x0: b.x, x1: b.x + run * TILE, y, y1: y - top * TILE, row: -1, hill: true, tow: HILLS.tow * PHYS.baseSpeed });
  coinLine(b, b.x + 3 * TILE, y - 3 * HILLS.climbGrade * TILE - PICKUPS.ride, b.x + (run - 3) * TILE, y - (run - 3) * HILLS.climbGrade * TILE - PICKUPS.ride);
  b.x += run * TILE;
  b.h = top;
  //the top: a flat intersection to set up on
  terrace(b, streetY, 8, rng, false);
  if (k === chinatownStretch(floor)) b.chinatown = [b.x - 8 * TILE, 0];
  stretch(b, rng, stretches(seed, floor)[k] ?? ['hill', 'stairs'], streetY, floor);
  if (b.chinatown) b.chinatown[1] = b.x;
  //whole pieces: the run-out takes up the rest
  const pieces = Math.ceil(b.x / (CHUNK_W * TILE));
  const end = pieces * CHUNK_W * TILE;
  if (end > b.x) {
    b.surfaces.push({ kind: 'roof', x0: b.x, x1: end, y: streetY, row: -1 });
    b.x = end;
  }
  return b;
}

// Chinatown's cab flat: a long flat with a cab rolling your way at its start (roll into its back bumper and you're
// skitching it), a kicker ramp standing near its end, and a corner just before the kicker where the cab turns off and
// lets you go. The kicker throws you along its face at whatever speed you hit it with (src/physics/skater.ts)
function skitch(b: Builder, rng: Rng, streetY: number): void {
  const len = range(rng, CHINATOWN.flat);
  const y = yOf(streetY, b.h);
  const k = CHINATOWN.kicker;
  const kx = b.x + (len - k.fromEnd - k.len) * TILE;
  const lip = { x: kx + k.len * TILE, y: y - k.rise * TILE };
  b.surfaces.push({ kind: 'bank', x0: kx, x1: lip.x, y, y1: lip.y, row: -1, kicker: true });
  (b.cabs ??= []).push({ x: b.x + CHINATOWN.cabFrom * TILE, y, turnX: kx + TILE / 2, lip });
  //coins along the cab's line, then up off the lip toward the wire
  coinLine(b, b.x + (CHINATOWN.cabFrom + 4) * TILE, y - PICKUPS.ride, kx - 2 * TILE, y - PICKUPS.ride);
  coinArc(b, lip.x - TILE, lip.y - PICKUPS.ride, lip.x + 7 * TILE, lip.y - CHINATOWN.wireOverLip * TILE - PICKUPS.ride, PICKUPS.arc);
  terrace(b, streetY, len, rng, false);
}

// one stretch of hill from the builder's height down to the street: its beats, the last a stairway, then a last
// block and the run-out
function stretch(b: Builder, rng: Rng, beats: Beat[], streetY: number, floor: number): void {
  const dials = hillDials(floor);
  const grade = dials.grade;
  const crest = (features: boolean) => terrace(b, streetY, range(rng, dials.crest), rng, features && floor > 1);
  //the height is planned up front: the last stairway (the stretch's peak) gets its set, a short block runs out into
  //the street, and the beats between share the rest by weight, so no beat is left with nothing to drop
  //an edited last stairway can go past the floor's usual stair cap; the height still limits it
  const cap = floorEdit(editFloor(floor)).finalSet !== undefined ? dials.finalSet : maxSteps(floor);
  const finalSteps = Math.min(cap, dials.finalSet, Math.floor((b.h - 2) * 2 * 0.45));
  const rises = beats.map((beat) => (beat === 'kicker' ? range(rng, [1, 2]) : 0));
  let budget = b.h - finalSteps / 2 - HILLS.lastBlock + rises.reduce((a, r) => a + r, 0);
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
    } else if (beat === 'cross') {
      //Chinatown: a block down to an intersection with cars driving straight across it
      const drop = Math.max(1, Math.min(b.h - 1, plan));
      hill(b, streetY, runFor(drop), drop, false);
      const len = range(rng, CHINATOWN.crest);
      const y = yOf(streetY, b.h);
      (b.crossings ??= []).push({ x: b.x + (len / 2) * TILE, y });
      terrace(b, streetY, len, rng, false);
    } else if (beat === 'skitch') {
      skitch(b, rng, streetY);
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
}
