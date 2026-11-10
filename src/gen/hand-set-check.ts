// The bot gate for zack's hand-made sets (src/gen/hand-sets.ts; zack, 2026-11-10: a set goes into floors only if the
// plain bot clears it): a floor of the act's line with the set laid every other beat, skated by the plain sky bot (no
// boons) at cruising speed and in the gnar state (20% faster). Every time it comes round, the bot has to get from its
// start past its end without a slam and without coming down off the line (onto the street or the hill under it).
import { FLAT_STOKE } from '../heat/heat';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import { actGravity } from '../physics/feel';
import { SCORE } from '../run/score';
import { FloorSim } from '../sim/floor';
import { Pilot } from '../bot/pilot';
import { buildFloor } from './descent';
import { maxTier } from './layout';
import { PIECES } from './pieces';
import { rollFork } from './roads';
import { forceSet, type HandAct, type HandSet, type LaidSet } from './hand-sets';

// the floor each act's sets are tried on (not an act's first: act 3's opens on act 2's drones)
export const CHECK_FLOOR: Record<HandAct, number> = { 3: 8, 5: 14 };
export const CHECK_SEED = 2026;

export interface TracePoint {
  x: number; // px, from the set's start
  y: number; // px, up from the set's start (as the set is drawn)
  mode: string; // roll, air, grind, rail
}

export interface SetRun {
  speed: number; // 1 cruising, SCORE.gnarBoost the gnar state
  ok: boolean;
  reached: number; // times round the bot came to the set up on the line
  cleared: number; // and got through it clean
  why: string; // what went wrong the first time it did, or 'clean'
  trace: TracePoint[]; // its line through the set the first time it reached it
}

// the share of the times round the bot has to clear: a set comes after whatever the line laid before it, so it's
// met at all sorts of speeds and heights (the code sets miss now and then too: tests/station-line.test.ts)
export const CLEAR_SHARE = 0.75;

export interface SetCheck {
  act: HandAct;
  ok: boolean;
  laid: number; // how many times the set came round on the floor
  runs: SetRun[];
  level: Level;
  start: { x: number; y: number } | null; // the first one's start, px
}

// a floor of act's line with s laid every other beat (what the editor's "play it" opens, built the same way)
export function setFloor(s: HandSet, act: HandAct, seed = CHECK_SEED): Level {
  const floor = CHECK_FLOOR[act];
  forceSet(s);
  try {
    return buildFloor(seed, floor, PIECES.filter((p) => p.tier <= maxTier(floor)), { hills: true, fork: rollFork(seed, floor), gravity: actGravity(act) });
  } finally {
    forceSet(null);
  }
}

function skate(level: Level, sets: LaidSet[], speed: number): SetRun {
  const sim = new FloorSim(level);
  const pilot = new Pilot('sky');
  const sk = sim.skater;
  sk.boost = speed;
  sim.heat.slamFree = speed > 1;
  sim.heat.stoke = FLAT_STOKE;
  let trace: TracePoint[] | null = null;
  let tracing: TracePoint[] | null = null;
  let [reached, cleared] = [0, 0];
  let why = '';
  //the set it's in: its index, and whether it's still clean in it (null: not up on the line when it got there)
  let inSet = -1;
  let clean: boolean | null = null;
  const leave = () => {
    if (clean !== null) {
      reached++;
      if (clean) cleared++;
    }
    if (tracing && !trace) trace = tracing;
    tracing = null;
    inSet = -1;
  };
  for (let f = 0; f < 60 * 400 && sim.state === 'skate'; f++) {
    sim.step(pilot.input(sim));
    const i = sets.findIndex((at) => sk.x >= at.x0 && sk.x <= at.x1);
    if (i !== inSet) {
      if (inSet >= 0) leave();
      if (i >= 0) {
        inSet = i;
        //(come down off the line before it, or way under it: not the set's to judge)
        clean = sk.y < sets[i].y + 3 * TILE ? true : null;
        if (clean && !trace) tracing = [];
      }
    }
    if (inSet < 0 || clean === null) continue;
    const at = sets[inSet];
    tracing?.push({ x: sk.x - at.x0, y: at.y - sk.y, mode: sk.mode });
    if (!clean) continue;
    const where = `${Math.round((sk.x - at.x0) / TILE)} tiles in`;
    const on = sk.mode === 'rail' ? sk.rail : sk.surface;
    let bad = '';
    if (sim.events.some((e) => e.type === 'slam')) bad = `slams ${where}`;
    //(on something of the city's, not the line's: off the line)
    else if (sk.grounded && (!on || !on.sky)) bad = `falls off the line ${where}`;
    if (bad) {
      clean = false;
      why ||= bad;
    }
  }
  if (inSet >= 0) leave();
  const ok = reached >= 2 && cleared >= CLEAR_SHARE * reached;
  return { speed, ok, reached, cleared, why: why || (reached ? 'clean' : 'never reached it up on the line'), trace: trace ?? [] };
}

// does the plain sky bot clear s on act's line, at cruising speed and in the gnar state. It's tried on a few seeds'
// floors until it's been met up on the line a few times at each speed (the bot falls off the line elsewhere now and
// then, act 5's most, and a set it never reaches says nothing about the set)
export const CHECK_SEEDS = 4;
export function checkSet(s: HandSet, act: HandAct, seed = CHECK_SEED): SetCheck {
  const speeds = [1, SCORE.gnarBoost];
  const runs: SetRun[] = speeds.map((speed) => ({ speed, ok: false, reached: 0, cleared: 0, why: '', trace: [] }));
  let first: { level: Level; start: { x: number; y: number } } | null = null;
  let laid = 0;
  for (let k = 0; k < CHECK_SEEDS && runs.some((r) => r.reached < 3); k++) {
    const level = setFloor(s, act, seed + k * 7919);
    const sets = level.handSets ?? [];
    if (!sets.length) continue;
    laid += sets.length;
    first ??= { level, start: { x: sets[0].x0, y: sets[0].y } };
    speeds.forEach((v, i) => {
      const r = skate(level, sets, v);
      const all = runs[i];
      all.reached += r.reached;
      all.cleared += r.cleared;
      if (r.reached && (!all.why || all.why === 'clean')) all.why = r.why;
      if (!all.trace.length) all.trace = r.trace;
    });
  }
  for (const r of runs) {
    r.ok = r.reached >= 2 && r.cleared >= CLEAR_SHARE * r.reached;
    if (!r.why) r.why = 'never reached it up on the line';
  }
  const level = first?.level ?? setFloor(s, act, seed);
  return { act, ok: laid > 0 && runs.every((r) => r.ok), laid, runs, level, start: first?.start ?? null };
}
