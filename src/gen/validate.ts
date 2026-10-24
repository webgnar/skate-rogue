// Makes sure every floor can be cleared with no boons: a simple reference bot skates each generated layout, and
// layouts it can't clear are re-rolled from a sub-seed, then generated one tier lower. Pure and deterministic.
import { RunScore, SCORE } from '../run/score';
import { TILE } from '../physics/constants';
import type { Lane, Level } from '../physics/level';
import { FloorSim } from '../sim/floor';
import type { Gear } from '../run/gear';
import { Pilot } from '../bot/pilot';
import { buildFloor, type FloorOptions } from './descent';
import { maxTier } from './layout';
import { PIECES } from './pieces';

const REROLLS = 8;

// the reference bot (src/bot/pilot.ts) skates a floor: ollies at canals and cars, rides rails to their ends, flips
// when falling short
const GNAR_BOOST = SCORE.gnarBoost;

export interface BotRun {
  result: string;
  slams: number;
  maxHeat: number;
  gear: Gear;
  frames: number; // how long it took
  cash: number; // coins picked up
  stoken: number;
}

// boost: skate in the gnar state, at its cruising speed (SCORE.gnarBoost) with slams free of Heat
// boost 'game': the gnar state comes and goes as the run's stoke meter fills and drains, as in the game
// lane: take that depth lane at every hop switch (src/gen/lanes.ts), whatever the bot is doing there
export function botRun(level: Level, boost: number | 'game' = 1, lane: Lane | null = null): BotRun {
  const sim = new FloorSim(level);
  sim.skater.laneLock = lane;
  const run = boost === 'game' ? new RunScore() : null;
  const fixed = (k: number) => {
    sim.skater.boost = k;
    sim.heat.slamFree = k > 1; // the gnar state: slams cost no Heat either
  };
  fixed(run ? 1 : (boost as number));
  const sk = sim.skater;
  const pilot = new Pilot('ref');
  let slams = 0;
  let maxHeat = 0;
  for (let f = 0; f < 60 * 120; f++) {
    if (run) {
      fixed(run.gnar ? GNAR_BOOST : 1);
      sim.combo = run.combo;
    }
    sim.step(pilot.input(sim));
    if (run) {
      run.step(sk.mode);
      for (const e of sim.events) run.onEvent(e, sk.hsp);
    }
    slams += sim.events.filter((e) => e.type === 'slam').length;
    maxHeat = Math.max(maxHeat, sim.heat.value);
    const end = (result: string): BotRun => {
      const took = (kind: string) => level.pickups.filter((p, i) => p.kind === kind && sim.taken[i]).length;
      return { result, slams, maxHeat, gear: sim.gear, frames: f, cash: took('cash'), stoken: took('stoken') };
    };
    if (sim.state === 'bail') return end(`bail at col ${Math.floor(sk.x / TILE)}`);
    if (sim.state === 'caught') return end(`caught at col ${Math.floor(sk.x / TILE)}`);
    if (sim.state === 'exit') return end('exit');
  }
  return { result: 'timeout', slams, maxHeat, gear: sim.gear, frames: 60 * 120, cash: 0, stoken: 0 };
}

// a floor has to be clearable at cruising speed, in the gnar state (full stoke skates 20% faster), and with the gnar
// state switching on and off mid-floor as it does in the game, so filling the stoke meter can never make a floor
// impossible. Logged 2026-10-24, from the playtest bot's findings.
export function clearable(level: Level): boolean {
  const ok = (boost: number | 'game', lane: Lane | null = null) => botRun(level, boost, lane).result === 'exit';
  //with lanes, every stretch has to go through in either lane the bot could end up in
  const lanes = level.fork?.switches ? ok(1, 0) && ok(1, 1) && ok(GNAR_BOOST, 0) && ok(GNAR_BOOST, 1) : true;
  return ok(1) && lanes && ok(GNAR_BOOST) && ok('game');
}

export interface Validated {
  level: Level;
  tries: number; // floors generated before one passed
  tierDrops: number;
}

export function validatedFloor(seed: number, floor: number, opts: FloorOptions = {}): Validated {
  let tries = 0;
  for (let top = maxTier(floor), drops = 0; top >= 1; top--, drops++) {
    const library = PIECES.filter((p) => p.tier <= top);
    for (let k = 0; k <= REROLLS; k++) {
      tries++;
      const level = buildFloor(seed + k * 15485863 + drops * 32452843, floor, library, opts);
      if (clearable(level)) return { level, tries, tierDrops: drops };
    }
  }
  //nothing passed (should not happen); hand back the original
  return { level: buildFloor(seed, floor, PIECES, opts), tries, tierDrops: -1 };
}
