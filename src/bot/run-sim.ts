// The playtest bot's runs without a screen: floor after floor as the game builds them, the bot picking boons and
// roads as it goes, with the game's per-step score and gnar-state coupling (which the floor validator leaves out).
// Every floor starts the way its test URL starts it (src/bot/repro.ts): fresh gear, no carried Heat, so a finding
// replays exactly from the link.
import { addBoon, type Held } from '../boons/defs';
import { skaterMods } from '../boons/mods';
import { offerBoons } from '../boons/offer';
import { DECK_SLOTS, FULL_LIBRARY, STOCK, withLoadout } from '../run/meta';
import { newBoard } from '../board/mods';
import { freshGear } from '../run/gear';
import { withGnar } from '../run/gnar';
import { RunScore, SCORE } from '../run/score';
import { ACTS, endsAct, ESCAPE } from '../gen/escape';
import { FIRST_ROAD, type Road } from '../gen/roads';
import { makeRng } from '../gen/rng';
import { TILE } from '../physics/constants';
import { FloorSim } from '../sim/floor';
import type { Level } from '../physics/level';
import { botRun } from '../gen/validate';
import { floorDistrict, floorLevel } from '../run/floor-level';
import { FloorChecks, CHECKS, type Finding } from './checks';
import { Pilot, type PilotStyle } from './pilot';
import { reproQuery, type Repro } from './repro';

export interface FloorReport {
  label: string; // "floor 4" or "escape 2"
  url: string; // the test URL's query, with ?bot
  repro: Repro;
  district: string;
  result: string; // exit, bail at col N, caught at col N, timeout
  seconds: number;
  slams: number;
  maxHeat: number;
  findings: Finding[];
  // why the reference bot didn't get through, when it didn't: the floor itself (the validator's bot can't clear it
  // either), the game's own coupling (the gnar state's speed, which the validator leaves out), the Gnar level's
  // rules, or the boons held
  cause?: 'unclearable' | 'game-coupling' | 'gnar-level' | 'boons';
}

export interface FloorPlay {
  seed: number;
  floor: number;
  road: Road;
  boons: Held[];
  gnar: number;
  pilot: PilotStyle;
}

export function playFloor(p: FloorPlay): FloorReport & { fork: 'high' | 'low' | null; nextHigh?: Road; nextLow?: Road } {
  const level = floorLevel({ seed: p.seed, floor: p.floor, road: p.road, library: FULL_LIBRARY, gnar: p.gnar });
  const rep = skate(level, p);
  if (p.pilot === 'ref' && rep.result !== 'exit') {
    //take things away until it clears: no boons, then no Gnar rules, then the validator's own run
    if (botRun(level).result !== 'exit') rep.cause = 'unclearable';
    else if (skate(level, { ...p, boons: [], gnar: 0 }).result !== 'exit') rep.cause = 'game-coupling';
    else if (p.gnar && skate(level, { ...p, boons: [] }).result !== 'exit') rep.cause = 'gnar-level';
    else rep.cause = 'boons';
  }
  return rep;
}

function skate(level: Level, p: FloorPlay): FloorReport & { fork: 'high' | 'low' | null; nextHigh?: Road; nextLow?: Road } {
  const mods = withGnar(withLoadout(skaterMods(p.boons), STOCK), p.gnar);
  const sim = new FloorSim(level, mods, p.road.kind === 'escape' ? ESCAPE.startHeat : 0, newBoard(DECK_SLOTS[STOCK.deck]), freshGear());
  //the game's score, stepped alongside: the gnar state speeds the skater up and makes slams free of Heat
  const run = new RunScore();
  run.scoreScale = mods.scoreScale;
  run.slamStoke = mods.slamStoke;
  run.stokenScale = mods.stokenScale;
  run.nearScale = mods.nearScale;
  const pilot = new Pilot(p.pilot, p.seed + p.floor);
  const checks = new FloorChecks(sim);
  let slams = 0;
  let maxHeat = 0;
  let f = 0;
  for (; f < CHECKS.maxFrames && sim.state === 'skate'; f++) {
    sim.skater.boost = run.gnar ? SCORE.gnarBoost : 1;
    sim.heat.slamFree = run.gnar;
    sim.combo = run.combo;
    checks.before();
    sim.step(pilot.input(sim));
    checks.after();
    run.step(sim.skater.mode);
    for (const e of sim.events) run.onEvent(e, sim.skater.hsp);
    slams += sim.events.filter((e) => e.type === 'slam').length;
    maxHeat = Math.max(maxHeat, sim.heat.value);
  }
  if (sim.state === 'skate') checks.after(); // the timeout
  const col = Math.floor(sim.skater.x / TILE);
  const result = sim.state === 'exit' ? 'exit' : sim.state === 'skate' ? 'timeout' : `${sim.state} at col ${col}`;
  const escape = p.road.kind === 'escape' ? p.road.act : undefined;
  const repro: Repro = { seed: p.seed, floor: p.floor, boons: p.boons, danger: p.road.danger, escape, gnar: p.gnar, bot: p.pilot };
  return {
    label: escape ? `escape ${escape}` : `floor ${p.floor}`,
    url: reproQuery(repro),
    repro,
    district: floorDistrict({ seed: p.seed, floor: p.floor, road: p.road }),
    result,
    seconds: Math.round((f / 60) * 10) / 10,
    slams,
    maxHeat: Math.round(maxHeat),
    findings: checks.findings,
    fork: sim.road,
    nextHigh: level.fork?.high,
    nextLow: level.fork?.low,
  };
}

export interface RunPlay {
  seed: number;
  pilot: PilotStyle;
  gnar?: number;
  floors?: number; // stop after this floor (15 is the whole run)
  keepGoing?: boolean; // skate the next floor after a bail, to cover the whole run anyway
}

// a run: floors with their escapes, a boon picked after each floor from the cards the game would offer
export function playRun(r: RunPlay): FloorReport[] {
  const rng = makeRng(r.seed * 3 + 17);
  const out: FloorReport[] = [];
  let boons: Held[] = [];
  let road: Road = FIRST_ROAD;
  const last = r.floors ?? ACTS * 3;
  for (let floor = 1; floor <= last; floor++) {
    const rep = playFloor({ seed: r.seed, floor, road, boons, gnar: r.gnar ?? 0, pilot: r.pilot });
    out.push(rep);
    if (rep.result !== 'exit' && !r.keepGoing) break;
    //the road taken, and the boon street's pick (shops and spots lead to a boon street too)
    const next = rep.fork === 'high' ? rep.nextHigh : rep.nextLow;
    road = next && next.kind !== 'escape' ? { kind: 'boon', boonType: 'boonType' in next ? next.boonType : 'POP', danger: next.danger } as Road : FIRST_ROAD;
    const offer = offerBoons(r.seed, { floor, boons, library: FULL_LIBRARY }, 3);
    if (offer.length) boons = addBoon(boons, offer[Math.floor(rng() * offer.length)].id);
    if (endsAct(floor)) {
      const act = floor / 3;
      const esc = playFloor({ seed: r.seed, floor, road: { kind: 'escape', act, danger: 3 }, boons, gnar: r.gnar ?? 0, pilot: r.pilot });
      out.push(esc);
      if (esc.result !== 'exit' && !r.keepGoing) break;
    }
  }
  return out;
}
