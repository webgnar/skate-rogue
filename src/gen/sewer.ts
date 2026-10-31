// The sewer route (zack, 2026-10-31: "the sky route and a sewer route must be developed. sky surface ground. these
// are the three routes our game should have"). Under each street chase, where the street is clear, a construction
// spot (zack: "the ways down from surface to sewer are construction spots") drops you into a storm sewer: a tunnel
// under the street with pipes to grind and runoff whose current pushes you on (DOWNSTREAM), out of the traffic's way
// and out of the helicopter's sight, so the Heat cools (src/sim/floor.ts). At the foot of a hill the way in is a
// plank ramp you roll straight down off the hill. The street is its roof, low enough that a quick double tap bumps
// your head. Kick-outs (zack: "a quarterpipe up against a wall that shoots the player straight up through a one way
// platform to the street again") throw you back up through a grate unless you ollie them, so going further down there
// is a skill. Each tunnel can have one set piece (a rat pack, a flood surge, a full pipe bowl or a subway crossing),
// and sometimes a DIY stash or the sewer alligator. A storm outlet ramps you back up through a hole in the street
// further on; the last one before the gate comes up at the gate itself, the sewer road to the underground spot. All
// physics: you get in by rolling into the hole instead of ollieing it, and out by rolling up a ramp.
// Drawn by src/render/sewer-kit.ts; the moving pieces are src/sim/sewer.ts.
import { TILE } from '../physics/constants';
import { inHill, polyRail, type Level, type Sewer, type SewerKick, type SewerStairs, type Surface } from '../physics/level';
import type { Road } from './roads';
import { PICKUPS } from './descent';
import { makeRng, type Rng } from './rng';

export const SEWER = {
  depth: 5 * TILE, // the tunnel's floor under the street: an ollie fits under its roof, a quick double tap doesn't
  len: [30, 44], // tiles of tunnel, way in to outlet (shorter, down to min, where a long one doesn't fit)
  min: 16,
  drain: 3, // tiles of hole at the construction spot: an ollie clears it, rolling on takes you in
  ramp: 8, // tiles of outlet ramp, up from the floor to the street
  outlet: 3, // tiles of hole over the top of the ramp (lower down the street still covers it)
  clear: 1, // tiles either side of a hole kept clear of anything on the street
  runUp: 8, // tiles of clear street before the way in
  pitGap: 5, // tiles of street at least between a pit and a dig after it
  runOut: 6, // and after the outlet
  after: 10, // tiles off the foot of a hill before a dig (you come off a hill in the air)
  foot: 2, // or, for a plank ramp way in, this few: you roll off the hill and straight down it
  footRamp: 0.5, // the chance a street chase's way in is a plank ramp at the foot of the hill
  before: 6, // tiles left before the next climb or the gate after the outlet
  land: 4, // tiles past the way in to come down in before anything's in the way
  pipe: [6, 10], // tiles of pipe to grind
  pipeH: 1.1 * TILE, // its height over the floor: an ollie gets onto it
  pipes: 2, // at most this many
  wet: [4, 7], // tiles of runoff in a stretch: its current pushes you on (SEWER_FLOW in src/physics/level.ts)
  wets: 3, // at most this many stretches
  stoken: 0.4, // chance of a Stoken on a pipe
  coolPerSec: 4, // Heat lost per second down there, on top of the usual cooling (src/sim/floor.ts)
  // kick-outs: a quarterpipe kick tiles long rising kickUp tiles; roll off its top and kickPop throws you up through
  // a grate tiles wide over it, onto the street (it needs runOut tiles of street after the grate to come down on)
  kick: 1.5,
  kickUp: 1,
  kickPop: -9.5, // about 1.5 tiles over the street at the top
  grate: 4,
  kickRunOut: 10,
  kickClear: 4, // tiles of clear floor after one, to come down on if you ollie it
  kicks: [0.75, 0.35], // the chance of a first kick-out in a tunnel, and of a second
  pieceFrom: 2, // set pieces from this floor on
  piece: 0.85, // the chance a tunnel gets one
  rats: [4, 7], // rats in a pack
  bowl: 3, // tiles of each side of the full pipe's bowl, and of its bottom
  bowlDepth: 2 * TILE,
  bowlLip: 0.5 * TILE, // its far side comes up this far over the floor: you carve out of it into the air
  subway: 3, // tiles of gap over the subway line: an ollie clears it, or a train's roof under you does
  subwayPeriod: 150, // frames between trains (src/sim/sewer.ts)
  gator: 0.45, // the chance of the alligator on a floor, in one of its tunnels
  gatorFrom: 2,
  gatorLen: 2.5, // tiles nose to tail
  // the stair set (zack's ledges ref): you come down into the tunnel onto a raised landing stairH over its floor, and
  // stairDown tiles of steps take it down to the floor with a handrail railH over them. Steps are steps (zack,
  // 2026-10-31: "you shouldnt be able to push up stairs"): ollie the set or grind its rail, roll onto it and you slam
  stairs: 0.8,
  stairDown: 3,
  stairH: TILE,
  railH: 0.9 * TILE,
  stairOut: 5, // tiles of clear floor after its foot
  stash: 0.5, // the chance of a DIY stash on a floor, in one of its tunnels
  stashGear: 0.4, // and of it being a fresh gear part (else a spin token)
};

const range = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

// is the street at columns [c0, c1) clear for a hole: street all along, nothing standing on it or parked over it
function clearAt(level: Level, c0: number, c1: number): boolean {
  const [x0, x1] = [(c0 - SEWER.clear) * TILE, (c1 + SEWER.clear) * TILE];
  for (let c = c0 - SEWER.clear; c < c1 + SEWER.clear; c++) if (!level.street[c]) return false;
  const low = (s: Surface) => !s.sewer && Math.max(s.y, s.y1 ?? s.y) > level.streetY - 3 * TILE;
  if (level.surfaces.some((s) => s.x1 > x0 && s.x0 < x1 && low(s))) return false;
  if (level.cars.some((c) => c.x1 > x0 && c.x0 < x1)) return false;
  if (level.glass.some((g) => g.x1 > x0 && g.x0 < x1)) return false;
  //(nor under the L, or its kicker's run-up: src/traffic/el.ts)
  if ((level.el ?? []).some((e) => (e.trigger > x0 && e.trigger < x1) || (e.x1 > x0 && e.x0 - 10 * TILE < x1))) return false;
  return true;
}

// one sewer in the street chase [a, b] (px), if one fits
function sewer(level: Level, a: number, b: number, rng: Rng, gate: boolean): Sewer | null {
  //a plank ramp at the foot of the hill, or a dig further along the street (the other where the one won't fit)
  const ramp = rng() < SEWER.footRamp;
  for (const opts of [{ ramp, gate }, { ramp: !ramp, gate }, ...(gate ? [{ ramp, gate: false }, { ramp: !ramp, gate: false }] : [])]) {
    for (let len = range(rng, SEWER.len); len >= SEWER.min; len -= 2) {
      const s = sewerOf(level, a, b, len, rng, opts);
      if (s) return s;
    }
  }
  return null;
}

function sewerOf(level: Level, a: number, b: number, len: number, rng: Rng, opts: { ramp: boolean; gate: boolean }): Sewer | null {
  const first = Math.ceil(a / TILE) + (opts.ramp ? SEWER.foot : SEWER.after);
  const last = Math.floor(b / TILE) - (opts.gate ? 0 : SEWER.before) - len;
  if (last < first) return null;
  //from a random start, the first spot where both holes fit and the street runs unbroken between
  //(the gate's runs right up to the gate; a ramp way in starts right at the foot of the hill)
  const tries = opts.gate || opts.ramp ? 1 : last - first + 1;
  const from = Math.floor(rng() * tries);
  for (let k = 0; k < tries; k++) {
    const c0 = opts.gate ? last : opts.ramp ? first : first + ((from + k) % tries);
    const c1 = c0 + len;
    if (level.street.slice(c0, c1).some((s) => !s) || inHill(level, c0 * TILE) || inHill(level, c1 * TILE)) continue;
    //(and clear street to come out onto: the ramp throws you up the street at speed)
    if (!clearAt(level, c0, c0 + SEWER.drain) || !clearAt(level, c1 - SEWER.outlet, c1)) continue;
    const [o0, o1] = [c1 * TILE, (c1 + SEWER.runOut) * TILE];
    if (level.street.slice(c1, c1 + SEWER.runOut).some((s) => !s) || level.cars.some((c) => c.x1 > o0 && c.x0 < o1) || level.glass.some((g) => g.x1 > o0 && g.x0 < o1)) continue;
    //and no ramp or car in the run-up to throw you over the hole (off a hill: the hill is the run-up)
    const [r0, r1] = [(c0 - (opts.ramp ? SEWER.foot : SEWER.runUp)) * TILE, c0 * TILE];
    if (level.surfaces.some((s) => s.x1 > r0 && s.x0 < r1 && !s.hill && (s.kind === 'bank' || s.kicker)) || level.cars.some((c) => c.x1 > r0 && c.x0 < r1)) continue;
    //(nor, at the gate, a pit just before a dig: you come off it in the air, over the way in)
    if (opts.gate && !opts.ramp && level.street.slice(c0 - SEWER.pitGap, c0).some((s) => !s)) continue;
    return {
      x0: c0 * TILE,
      x1: c1 * TILE,
      y: level.streetY + SEWER.depth,
      drain: [c0 * TILE, (c0 + SEWER.drain) * TILE],
      outlet: [(c1 - SEWER.outlet) * TILE, c1 * TILE],
      wet: [],
      entry: opts.ramp ? 'ramp' : 'dig',
      ...(opts.gate ? { gate: true } : {}),
    };
  }
  return null;
}

// is the street clear to come down on after a kick-out's grate: street (or the outlet's hole, onto its ramp) all along
function runOutAt(level: Level, s: Sewer, x: number): boolean {
  for (let c = Math.floor(x / TILE); c < x / TILE + SEWER.kickRunOut; c++) {
    if (c * TILE >= s.outlet[0]) return true;
    if (!level.street[c]) return false;
  }
  return true;
}

// what goes along a tunnel, left to right from where you come down to the foot of the outlet ramp: pipes (overhead,
// they don't block the floor), kick-outs and the set piece, each with clear floor after it
type Slot = { kind: 'pipe' | 'kick' | 'piece'; w: number };

// dig the sewer route under a built floor's street chases
export function addSewer(level: Level, seed: number): void {
  const spans = level.hillSpans;
  if (!spans?.length) return;
  const rng = makeRng(seed * 61 + level.layout.floor * 5821);
  const more = makeRng(seed * 67 + level.layout.floor * 7151 + 3); // the pieces along each tunnel
  const sewers: Sewer[] = [];
  const floor = level.layout.floor;
  spans.forEach(([, b], i) => {
    const lastChase = i + 1 >= spans.length;
    //the last street chase's tunnel runs to the gate, when there's a fork there: the sewer road
    const gate = lastChase && !!level.fork && !level.escape;
    const end = !lastChase ? spans[i + 1][0] : gate ? level.exitX : (level.fork?.x0 ?? level.exitX);
    const s = sewer(level, b, end, rng, gate);
    if (!s) return;
    if (s.gate && s.x1 !== level.exitX) delete s.gate;
    sewers.push(s);
    for (let c = s.drain[0] / TILE; c < s.drain[1] / TILE; c++) level.street[c] = false;
    for (let c = s.outlet[0] / TILE; c < s.outlet[1] / TILE; c++) level.street[c] = false;
    const ramp = s.x1 - SEWER.ramp * TILE;
    //the stair set: the way in comes down onto its landing, and its steps go down to the floor
    const landing = s.entry === 'ramp' ? s.drain[1] : s.x0;
    const top = s.drain[1] + SEWER.land * TILE;
    const foot = top + SEWER.stairDown * TILE;
    const st: SewerStairs | null = more() < SEWER.stairs && foot + (SEWER.stairOut + 4) * TILE <= ramp - 2 * TILE ? { x0: landing, up: landing, top, x1: foot, h: SEWER.stairH } : null;
    if (st) {
      s.stairs = [st];
      const rail = polyRail([[st.top - TILE / 2, s.y - st.h - SEWER.railH], [st.x1 + TILE / 2, s.y - SEWER.railH]]);
      rail.sewer = true;
      level.rails.push(rail);
      for (let c = st.top + TILE / 2; c < st.x1; c += TILE) level.pickups.push({ kind: 'cash', x: c, y: s.y - st.h * (1 - (c - st.top) / (st.x1 - st.top)) - SEWER.railH - PICKUPS.ride });
    }
    //the way in: a plank ramp down into the dig, or just the hole
    if (s.entry === 'ramp') level.surfaces.push({ kind: 'bank', x0: s.drain[0], x1: s.drain[1], y: level.streetY, y1: s.y - (st?.h ?? 0), row: -1, sewer: true });
    //what's along it
    const slots: Slot[] = [];
    const pipes = 1 + (more() < 0.75 ? 1 : 0);
    for (let p = 0; p < Math.min(pipes, SEWER.pipes); p++) slots.push({ kind: 'pipe', w: range(more, SEWER.pipe) });
    if (more() < SEWER.kicks[0]) slots.push({ kind: 'kick', w: SEWER.kick + SEWER.kickClear });
    if (more() < SEWER.kicks[1]) slots.push({ kind: 'kick', w: SEWER.kick + SEWER.kickClear });
    const roll = more();
    const piece = floor >= SEWER.pieceFrom && more() < SEWER.piece ? (roll < 0.3 ? 'rats' : roll < 0.48 ? 'surge' : roll < 0.74 ? 'bowl' : 'subway') : null;
    if (piece === 'rats') slots.push({ kind: 'piece', w: 8 });
    if (piece === 'bowl') slots.push({ kind: 'piece', w: 3 * SEWER.bowl + 3 });
    if (piece === 'subway') slots.push({ kind: 'piece', w: SEWER.subway + 4 });
    //(the surge needs no floor of its own: it comes from the storm gate behind you)
    if (piece === 'surge') s.piece = { kind: 'surge', x: s.x0 };
    //shuffle, but pipes first and last where there are two, so the tunnel opens and closes on a grind
    for (let k = slots.length - 1; k > 0; k--) {
      const j = Math.floor(more() * (k + 1));
      [slots[k], slots[j]] = [slots[j], slots[k]];
    }
    //(the set piece goes first or second, so it gets its room)
    const at = slots.findIndex((sl) => sl.kind === 'piece');
    if (at > 1) slots.unshift(...slots.splice(at, 1));
    //(after the stair set, room to come down from ollieing it before anything else)
    let x = st ? st.x1 + SEWER.stairOut * TILE : s.drain[1] + SEWER.land * TILE;
    const stop = ramp - 2 * TILE;
    const floors: [number, number, number][] = []; // pieces of floor that dip, break or stand up: [x0, x1, kind 0 bowl / 1 gap / 2 stairs]
    if (st) floors.push([st.x0, st.x1, 2]);
    for (const slot of slots) {
      const w = slot.w * TILE;
      if (x + w > stop) continue;
      if (slot.kind === 'pipe') {
        const y = s.y - SEWER.pipeH;
        const pipe = polyRail([[x, y], [x + w / 2, y], [x + w, y]]);
        pipe.sewer = true;
        level.rails.push(pipe);
        for (let c = x + TILE; c < x + w - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y - PICKUPS.ride });
        if (more() < SEWER.stoken) level.pickups.push({ kind: 'stoken', x: x + w - TILE, y: y - PICKUPS.ride });
        x += w + range(more, [3, 5]) * TILE;
      } else if (slot.kind === 'kick') {
        //the grate over it has to be clear street (no car over it, nothing standing on it) with street to land on after:
        //the first spot along from here where it is
        const fits = (k0: number) => {
          const g1 = k0 + SEWER.grate * TILE;
          //(ledges and rails on the street are one-way, you come up through them: only a car or the L's stop is in the way)
          const over = (a: { x0: number; x1: number }) => a.x1 > k0 - TILE && a.x0 < g1 + TILE;
          return g1 < s.outlet[0] - TILE && !level.cars.some(over) && !level.glass.some(over) && !(level.el ?? []).some((e) => e.x1 > k0 - TILE && e.x0 - 10 * TILE < g1 + TILE) && runOutAt(level, s, g1);
        };
        let k0 = x;
        while (k0 + w <= stop && !fits(k0)) k0 += TILE;
        if (k0 + w > stop) continue;
        const k1 = k0 + SEWER.kick * TILE;
        const kick: SewerKick = { x0: k0, x1: k1, grate: [k0, k0 + SEWER.grate * TILE] };
        (s.kicks ??= []).push(kick);
        level.surfaces.push({ kind: 'bank', x0: k0, x1: k1, y: s.y, y1: s.y - SEWER.kickUp * TILE, row: -1, launch: SEWER.kickPop, sewer: true });
        x = k0 + w;
      } else if (piece === 'rats') {
        const n = range(more, SEWER.rats);
        s.piece = { kind: 'rats', x: x + w, n };
        x += w;
      } else if (piece === 'bowl') {
        const b0 = x;
        const b1 = x + 3 * SEWER.bowl * TILE;
        s.piece = { kind: 'bowl', x0: b0, x1: b1, depth: SEWER.bowlDepth };
        floors.push([b0, b1, 0]);
        //coins down into it and up out of it
        for (let c = 0.5; c < 3 * SEWER.bowl; c += 1) {
          const t = c / (3 * SEWER.bowl);
          level.pickups.push({ kind: 'cash', x: b0 + c * TILE, y: s.y + SEWER.bowlDepth * Math.sin(Math.PI * t) * 0.8 - PICKUPS.ride });
        }
        x += w;
      } else if (piece === 'subway') {
        const g0 = x + TILE;
        const g1 = g0 + SEWER.subway * TILE;
        s.piece = { kind: 'subway', x0: g0, x1: g1, phase: Math.floor(more() * SEWER.subwayPeriod) };
        floors.push([g0, g1, 1]);
        level.pickups.push({ kind: 'cash', x: (g0 + g1) / 2, y: s.y - 1.5 * TILE });
        x += w;
      }
    }
    //the floor, broken round the bowl and the subway, then the outlet ramp
    let f0 = s.entry === 'ramp' ? s.drain[1] : s.x0;
    const roof = (a: number, c: number, y = s.y) => c > a && level.surfaces.push({ kind: 'roof', x0: a, x1: c, y, row: -1, sewer: true });
    for (const [a, c, kind] of floors.sort((p, q) => p[0] - q[0])) {
      roof(f0, a);
      if (kind === 2) {
        roof(a, st!.top, s.y - st!.h);
        level.surfaces.push({ kind: 'stairs', x0: st!.top, x1: c, y: s.y - st!.h, y1: s.y, row: -1, sewer: true });
      }
      if (kind === 0) {
        const d = SEWER.bowl * TILE;
        level.surfaces.push({ kind: 'bank', x0: a, x1: a + d, y: s.y, y1: s.y + SEWER.bowlDepth, row: -1, sewer: true });
        roof(a + d, c - d, s.y + SEWER.bowlDepth);
        level.surfaces.push({ kind: 'bank', x0: c - d, x1: c, y: s.y + SEWER.bowlDepth, y1: s.y - SEWER.bowlLip, row: -1, sewer: true });
      }
      f0 = c;
    }
    roof(f0, ramp);
    level.surfaces.push({ kind: 'bank', x0: ramp, x1: s.x1, y: s.y, y1: level.streetY, row: -1, sewer: true });
    //runoff on the floor, on the flat (not in the bowl or over the gap, nor on a kick-out)
    const blocked = (a: number, c: number) => floors.some(([f, g]) => c > f - TILE && a < g + TILE) || (s.kicks ?? []).some((k) => c > k.x0 - TILE && a < k.x1 + TILE);
    for (let k = 0; k < SEWER.wets * 3 && s.wet.length < SEWER.wets; k++) {
      const w = range(rng, SEWER.wet) * TILE;
      const lo = st ? st.x1 + TILE : s.entry === 'ramp' ? s.drain[1] : s.drain[1] + SEWER.land * TILE;
      const hi = ramp - w - TILE;
      if (hi <= lo) break;
      const at = lo + Math.floor(rng() * ((hi - lo) / TILE)) * TILE;
      if (blocked(at, at + w) || s.wet.some(([w0, w1]) => at < w1 + 2 * TILE && at + w > w0 - 2 * TILE)) continue;
      s.wet.push([at, at + w]);
    }
    s.wet.sort((p, q) => p[0] - q[0]);
    //coins down the way in
    level.pickups.push({ kind: 'cash', x: (s.drain[0] + s.drain[1]) / 2, y: level.streetY + SEWER.depth / 2 });
  });
  if (!sewers.length) return;
  level.sewers = sewers;
  //the alligator, now and then, on clear floor in one of the tunnels
  if (floor >= SEWER.gatorFrom && more() < SEWER.gator) {
    const len = SEWER.gatorLen * TILE;
    for (const s of shuffled(sewers, more)) {
      const spot = clearFloor(s, len + 5 * TILE, more);
      if (spot === null) continue;
      s.gator = [spot + 2 * TILE, spot + 2 * TILE + len];
      break;
    }
  }
  //the sewer road: the tunnel to the gate comes up into the underground spot
  const gateway = sewers.find((s) => s.gate);
  if (gateway && level.fork) level.fork.sewer = spotRoad(level.fork.low, level.fork.high);
}

// the underground spot (no floor), then a boon street of the type one of the other roads leads to
function spotRoad(...roads: Road[]): Road {
  for (const r of roads) if (r.kind === 'spot') return r;
  for (const r of roads) if (r.kind === 'boon' || r.kind === 'shop') return { kind: 'spot', boonType: r.boonType, danger: 1 };
  return { kind: 'spot', boonType: 'COOL', danger: 1 };
}

function shuffled<T>(xs: T[], rng: Rng): T[] {
  const out = xs.slice();
  for (let k = out.length - 1; k > 0; k--) {
    const j = Math.floor(rng() * (k + 1));
    [out[k], out[j]] = [out[j], out[k]];
  }
  return out;
}

// a stretch of plain floor w px long in the tunnel (no kick-out, bowl, gap, rats or runoff on it), its start; null if none
function clearFloor(s: Sewer, w: number, rng: Rng): number | null {
  const lo = s.drain[1] + SEWER.land * TILE;
  const hi = s.x1 - SEWER.ramp * TILE - 2 * TILE - w;
  if (hi <= lo) return null;
  const busy: [number, number][] = [...(s.kicks ?? []).map((k): [number, number] => [k.x0 - TILE, k.x1 + SEWER.kickClear * TILE]), ...s.wet];
  const p = s.piece;
  if (p?.kind === 'bowl' || p?.kind === 'subway') busy.push([p.x0 - 2 * TILE, p.x1 + 4 * TILE]);
  if (p?.kind === 'rats') busy.push([p.x - 10 * TILE, p.x + TILE]);
  if (s.gator) busy.push([s.gator[0] - 4 * TILE, s.gator[1] + 4 * TILE]);
  for (const t of s.stairs ?? []) busy.push([t.x0 - 2 * TILE, t.x1 + 3 * TILE]);
  const tries = Math.floor((hi - lo) / TILE) + 1;
  const from = Math.floor(rng() * tries);
  for (let k = 0; k < tries; k++) {
    const at = lo + ((from + k) % tries) * TILE;
    if (!busy.some(([a, b]) => at < b && at + w > a)) return at;
  }
  return null;
}

// a DIY stash in one of the tunnels, now and then (after the floor's props are placed, as the sky's): a tagged crate
// on the floor, smash it for a spin token or a fresh gear part
export function addSewerStash(level: Level, seed: number): void {
  if (!level.sewers?.length) return;
  const rng = makeRng(seed * 71 + level.layout.floor * 4093 + 5);
  if (rng() >= SEWER.stash) return;
  //(one spin token in the floor's props at most: the sky's stash or a lucky prop may have it already)
  const loot = rng() < SEWER.stashGear || level.props.some((p) => p.loot === 'spin') ? 'gear' : 'spin';
  for (const s of shuffled(level.sewers, rng)) {
    const at = clearFloor(s, 4 * TILE, rng);
    if (at === null) continue;
    level.props.push({ name: 'Crate', x: at + 2 * TILE, y: s.y, z: 0, yaw: -0.3, breaks: true, loot, stash: true });
    return;
  }
}
