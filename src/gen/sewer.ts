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
import { hillGround, inHill, pits, polyRail, type Level, type Sewer, type SewerKick, type SewerStairs, type Surface } from '../physics/level';
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


// is the street clear to come down on after a kick-out's grate: street (or the outlet's hole, onto its ramp) all along
// (along the route, past the room's end too: a canal over the deep there is no place to come down)
function runOutAt(level: Level, s: Sewer, x: number): boolean {
  for (let c = Math.floor(x / TILE); c < x / TILE + SEWER.kickRunOut; c++) {
    if (c * TILE >= s.outlet[0] && s.outlet[1] > s.outlet[0]) return true;
    if (!level.street[c]) return false;
  }
  return true;
}

// what goes along a room, left to right from where you come down to its end: pipes (overhead, they don't block the
// floor), kick-outs (under the street only), the deep's walkways, and the set piece, each with clear floor after it
type Slot = { kind: 'pipe' | 'kick' | 'piece' | 'walk'; w: number };
type PieceKind = 'rats' | 'surge' | 'bowl' | 'subway';

// the deep (zack, 2026-10-31: the sewer is one route under the whole floor, not a dip under each street chase): where
// a tunnel reaches the end of its street chase it drops into the deep under the next hill, rooms of brick main with a
// fast channel down the middle and walkways along it, one set piece after another, no way up but on; at the hill's
// foot it climbs back up under the next street chase, where kick-outs can throw you out again
export const DEEP = {
  depth: 10 * TILE, // its floor under the street
  top: 4 * TILE, // its roof's underside under the street (the hill's above it)
  room: [30, 46], // tiles per room (each with its set piece)
  drop: 5, // tiles of the drop's room under the end of the street it drops from (the street's still its roof)
  under: 14, // tiles a stretch of street needs, past the climb, to have a storm drain under it on the way
  climb: 8, // tiles of bank up out of it, at the next street chase
  walk: [7, 12], // tiles of walkway
  walkH: 1.25 * TILE, // over the channel: an ollie gets you up
  walks: 2, // at most this many a room
  pipeH: 2.4 * TILE, // its pipes hang high: a grind from a walkway, not from the channel
  channel: [10, 18], // tiles of fast runoff in a stretch
  stoken: 0.6, // chance of a Stoken on one of its pipes (deeper pays)
};

// a room of the route as it's planned
interface Room {
  s: Sewer;
  shallow: boolean; // under a street chase (kick-outs), else the deep
  outlet: boolean; // it ends in the outlet ramp up to the street
  first: boolean; // nothing before it along the route (a stair set's landing can stand at its start)
  from?: number; // a climb: the deeper floor it climbs up from (px)
}

// is the street whole over columns [x0, x1) px: no holes, and not the hill
function whole(level: Level, x0: number, x1: number): boolean {
  for (let c = Math.floor(x0 / TILE); c < Math.ceil(x1 / TILE); c++) if (!level.street[c]) return false;
  return !inHill(level, x0) && !inHill(level, x1 - 1);
}

// a way in in the street chase [a, b] (px), from the first spot along from a random start that fits: a plank ramp at
// the foot of the hill or a dig further along, the street whole from there to `to` (px)
function wayIn(level: Level, a: number, b: number, to: number, rng: Rng, digOnly = false, after: number = SEWER.after): { c0: number; ramp: boolean } | null {
  const ramp = !digOnly && rng() < SEWER.footRamp;
  for (const r of digOnly ? [false] : [ramp, !ramp]) {
    const first = Math.ceil(a / TILE) + (r ? SEWER.foot : after);
    const last = Math.floor(b / TILE);
    if (last < first) continue;
    const tries = r ? 1 : last - first + 1;
    const from = Math.floor(rng() * tries);
    for (let k = 0; k < tries; k++) {
      const c0 = r ? first : first + ((from + k) % tries);
      if (!whole(level, c0 * TILE, to) || !clearAt(level, c0, c0 + SEWER.drain)) continue;
      const [r0, r1] = [(c0 - (r ? SEWER.foot : SEWER.runUp)) * TILE, c0 * TILE];
      if (level.surfaces.some((s) => s.x1 > r0 && s.x0 < r1 && !s.hill && (s.kind === 'bank' || s.kicker)) || level.cars.some((c) => c.x1 > r0 && c.x0 < r1)) continue;
      if (!r && level.street.slice(c0 - SEWER.pitGap, c0).some((s) => !s)) continue;
      return { c0, ramp: r };
    }
  }
  return null;
}

// the outlet: the last column (px) of a tunnel from x0 that comes up in the street chase ending at b, as far along as
// fits (the gate's comes up at the gate itself); null if none
function outletAt(level: Level, x0: number, b: number, gate: boolean, min: number): number | null {
  for (let c1 = Math.floor(b / TILE) - (gate ? 0 : SEWER.before); c1 * TILE >= x0 + min * TILE; c1--) {
    if (gate && c1 * TILE !== b) return null;
    if (!whole(level, x0, c1 * TILE) || !clearAt(level, c1 - SEWER.outlet, c1)) continue;
    const [o0, o1] = [c1 * TILE, (c1 + SEWER.runOut) * TILE];
    if (!gate && (level.street.slice(c1, c1 + SEWER.runOut).some((s) => !s) || level.cars.some((c) => c.x1 > o0 && c.x0 < o1) || level.glass.some((g) => g.x1 > o0 && g.x0 < o1))) continue;
    return c1 * TILE;
  }
  return null;
}

// dig the sewer route under a built floor: a way in at the first stretch of whole street that fits one, and from there
// one route on to the floor's end. Under each stretch of whole street long enough, a storm drain with kick-outs up
// through its grates; under everything else (the hills, the canals, the short bits of street between) the deep. It
// comes up for good at an outlet in the last stretch that fits one (the gate's comes up at the gate itself)
function addSewerRoute(level: Level, seed: number): Sewer[] {
  const spans = level.hillSpans!;
  const rng = makeRng(seed * 61 + level.layout.floor * 5821);
  const more = makeRng(seed * 67 + level.layout.floor * 7151 + 3); // what's along each room
  const floor = level.layout.floor;
  const gating = !!level.fork && !level.escape;
  const end = gating ? level.exitX : (level.fork?.x0 ?? level.exitX);
  //the stretches of whole street after the opening descent: [a, b) px, the hill or a canal either side
  const runs: { a: number; b: number; gate: boolean; foot: boolean }[] = [];
  let a0 = -1;
  for (let c = Math.ceil(spans[0][1] / TILE); c <= Math.ceil(end / TILE); c++) {
    const ok = c * TILE < end && !!level.street[c] && !inHill(level, c * TILE);
    if (ok && a0 < 0) a0 = c * TILE;
    if (!ok && a0 >= 0) {
      runs.push({ a: a0, b: c * TILE, gate: gating && c * TILE >= end, foot: inHill(level, a0 - 1) });
      a0 = -1;
    }
  }
  const drop = DEEP.drop * TILE;
  const up = (DEEP.climb + SEWER.land + 2 + SEWER.ramp) * TILE; // a climb and an outlet
  const through = (DEEP.climb + SEWER.land + DEEP.under) * TILE + drop; // a climb, room to skate, and the drop on
  const y = level.streetY + SEWER.depth;
  const gateOf = (r: (typeof runs)[number], x1: number) => (r.gate && x1 >= end ? { gate: true } : {});
  //the route from a way in at x0 in stretch i, coming up for good in stretch `last` (its outlet's end at out); null
  //if the deep before it would be too short to read (a dip under a canal)
  const plan = (i: number, x0: number, entry: 'dig' | 'ramp', last: number, out: number): Room[] | null => {
    const rooms: Room[] = [];
    const shallow = (s: Sewer, outlet: boolean, isFirst: boolean, from?: number) => rooms.push({ s, shallow: true, outlet, first: isFirst, ...(from !== undefined ? { from } : {}) });
    const first = runs[i];
    shallow({ x0, x1: first.b - drop, y, drain: [x0, x0 + SEWER.drain * TILE], outlet: [first.b - drop, first.b - drop], wet: [], entry }, false, true);
    let deep0 = first.b - drop; // where the deep starts (its drop, under the street)
    let open = first.b; // its roof comes down from here
    for (let k = i + 1; k <= last; k++) {
      const r = runs[k];
      const fin = k === last;
      //(a stretch too short for a storm drain of its own, or after too little of the deep, has the deep under it)
      if (r.a - deep0 < DEEP.room[0] * TILE) {
        if (fin) return null;
        continue;
      }
      //(nor one with only a canal after it: the deep goes on under both)
      if (!fin && (r.b - r.a < through || runs[k + 1].a - (r.b - drop) < DEEP.room[0] * TILE)) continue;
      //the deep up to here (deeper where the hill over it dips), and the climb out of it: room for both?
      const deepest = deepSpan(level, deep0, r.a, open, more);
      const climb = climbLen(deepest.y - y);
      const x1 = fin ? out : r.b - drop;
      if ((x1 - r.a) / TILE < climb + SEWER.land + (fin ? 2 + SEWER.ramp : DEEP.under) + (fin ? 0 : DEEP.drop)) {
        if (fin) return null;
        continue;
      }
      rooms.push(...deepest.rooms);
      const dy = deepest.y;
      const s: Sewer = { x0: r.a, x1, y, drain: [r.a, r.a], outlet: fin ? [x1 - SEWER.outlet * TILE, x1] : [x1, x1], wet: [], entry: 'climb', climb: [r.a, r.a + climb * TILE], ...(fin ? gateOf(r, x1) : {}) };
      //a way in of its own along it: the tunnel splits there into two rooms
      const lo = s.climb![1] + (SEWER.land + 8) * TILE;
      const w = wayIn(level, lo, x1 - (SEWER.min + 2) * TILE - (fin ? SEWER.ramp * TILE : 0), x1, rng, true);
      if (w) {
        const at = w.c0 * TILE;
        const head: Sewer = { ...s, x1: at, outlet: [at, at] };
        delete head.gate;
        const rest: Sewer = { ...s, x0: at, drain: [at, at + SEWER.drain * TILE], entry: 'dig' };
        delete rest.climb;
        shallow(head, false, false, dy);
        shallow(rest, fin, false);
      } else shallow(s, fin, false, dy);
      deep0 = r.b - drop;
      open = r.b;
    }
    return rooms;
  };
  //the way in at the first stretch that fits one, on to the last stretch that can take it up again; failing that, a
  //tunnel of its own under one stretch, up an outlet further along it
  let rooms: Room[] = [];
  const ways = runs.map((r) => {
    //(off a hill you come down in the air, well along; after a canal, past its far side)
    const after = r.foot ? SEWER.after : SEWER.pitGap;
    const w = wayIn(level, r.a, r.b - (SEWER.min + 2) * TILE, Math.min(r.b, r.a + (after + SEWER.min) * TILE), rng, !r.foot, after);
    return w && { x0: w.c0 * TILE, entry: (w.ramp ? 'ramp' : 'dig') as 'ramp' | 'dig' };
  });
  for (let i = 0; i < runs.length && !rooms.length; i++) {
    const w = ways[i];
    //(the first stretch has to leave room to drop on)
    if (!w || runs[i].b - drop - w.x0 < (SEWER.drain + SEWER.land + 3) * TILE) continue;
    for (let k = runs.length - 1; k > i && !rooms.length; k--) {
      const q = runs[k];
      if (q.b - q.a < up || !whole(level, q.a, q.a + up - SEWER.ramp * TILE)) continue;
      const out = outletAt(level, q.a, q.b, q.gate, up / TILE);
      if (out !== null) rooms = plan(i, w.x0, w.entry, k, out) ?? [];
    }
  }
  for (let i = 0; i < runs.length && !rooms.length; i++) {
    const w = ways[i];
    const o = w && outletAt(level, w.x0, runs[i].b, runs[i].gate, SEWER.min);
    if (w && o) rooms = [{ s: { x0: w.x0, x1: o, y, drain: [w.x0, w.x0 + SEWER.drain * TILE], outlet: [o - SEWER.outlet * TILE, o], wet: [], entry: w.entry, ...gateOf(runs[i], o) }, shallow: true, outlet: true, first: true }];
  }
  if (!rooms.length) return [];
  //the set pieces: the deep's rooms each get one, shuffled so a run of them doesn't repeat; a street chase's now and then
  const bag: PieceKind[] = [];
  const draw = (): PieceKind => {
    if (!bag.length) bag.push(...shuffled<PieceKind>(['rats', 'bowl', 'subway', 'surge', 'rats', 'subway'], more));
    return bag.pop()!;
  };
  //(no surge where you come in slow, up the climb or down the drop: it'd have you before you got going)
  const pick = (r: Room): PieceKind => {
    const p = draw();
    if (p !== 'surge' || (r.s.entry !== 'climb' && r.s.entry !== 'drop')) return p;
    const q = draw();
    bag.unshift(p);
    return q === 'surge' ? 'rats' : q;
  };
  for (const r of rooms) furnish(level, r, more, rng, r.shallow ? (floor >= SEWER.pieceFrom && more() < SEWER.piece ? pick(r) : null) : pick(r));
  return rooms.map((r) => r.s);
}

// tiles of bank to climb `rise` px (as steep as the climb out of the usual depth)
const climbLen = (rise: number) => Math.max(2, Math.ceil((DEEP.climb * rise) / (DEEP.depth - SEWER.depth)));

// the deep's floor under [x0, x1) px: DEEP.depth under the street, or deeper where the hill's ground over it (or a
// crest jump's pit) dips down, so its roof stays a tile under the ground (and over the drops into it either side)
function deepY(level: Level, x0: number, x1: number): number {
  const w = (DEEP.drop + 1) * TILE;
  let low = level.streetY;
  for (const g of hillGround(level)) if (g.x1 > x0 - w && g.x0 < x1 + w) low = Math.max(low, g.y, g.y1 ?? g.y);
  for (const p of pits(level)) if (p.x1 > x0 - w && p.x0 < x1 + w) low = Math.max(low, p.floor);
  return Math.max(level.streetY + DEEP.depth, Math.ceil((low + TILE + DEEP.depth - DEEP.top) / TILE) * TILE);
}

// the deep from x0 to x1 (px), in rooms of one set piece each: the first drops into it (its roof comes down to the
// deep's at `open`, past the end of the street it drops from). Under a dip in the hill a room goes deeper: a drop
// into it (the roof over the drop the last room's), and a bank back up out of it into the next
function deepSpan(level: Level, x0: number, x1: number, open: number, more: Rng): { rooms: Room[]; y: number } {
  const rooms: Room[] = [];
  let x = x0;
  let prev: Sewer | null = null;
  while (x < x1) {
    let len = range(more, DEEP.room) * TILE;
    if (x1 - (x + len) < DEEP.room[0] * TILE) len = x1 - x;
    const y = deepY(level, x, x + len);
    const top = y - (DEEP.depth - DEEP.top);
    const s: Sewer = { x0: x, x1: x + len, y, top, deep: true, drain: [x, x], outlet: [x + len, x + len], wet: [], entry: !prev || y > prev.y ? 'drop' : 'flat' };
    const room: Room = { s, shallow: false, outlet: false, first: false };
    if (!prev) s.topAt = open;
    else if (y > prev.y) {
      s.topAt = x + DEEP.drop * TILE;
      s.top0 = prev.top;
    } else if (y < prev.y) {
      s.climb = [x, x + climbLen(prev.y - y) * TILE];
      room.from = prev.y;
    }
    rooms.push(room);
    prev = s;
    x += len;
  }
  return { rooms, y: prev!.y };
}

// what's in a room: its way in, stair set, kick-outs, pipes, walkways and set piece, its floor and its runoff
function furnish(level: Level, room: Room, more: Rng, rng: Rng, piece: PieceKind | null): void {
  const s = room.s;
  for (let c = s.drain[0] / TILE; c < s.drain[1] / TILE; c++) level.street[c] = false;
  for (let c = s.outlet[0] / TILE; c < s.outlet[1] / TILE; c++) level.street[c] = false;
  const end = room.outlet ? s.x1 - SEWER.ramp * TILE : s.x1;
  //the stair set: the way in comes down onto its landing, and its steps go down to the floor (only where the tunnel
  //starts: along the route its landing would stand in your way)
  const holed = s.entry === 'dig' || s.entry === 'ramp';
  const top = s.drain[1] + SEWER.land * TILE;
  const foot = top + SEWER.stairDown * TILE;
  const st: SewerStairs | null = holed && room.first && more() < SEWER.stairs && foot + (SEWER.stairOut + 4) * TILE <= end - 2 * TILE ? { x0: s.entry === 'ramp' ? s.drain[1] : s.x0, up: s.entry === 'ramp' ? s.drain[1] : s.x0, top, x1: foot, h: SEWER.stairH } : null;
  if (st) {
    s.stairs = [st];
    const rail = polyRail([[st.top - TILE / 2, s.y - st.h - SEWER.railH], [st.x1 + TILE / 2, s.y - SEWER.railH]]);
    rail.sewer = true;
    level.rails.push(rail);
    for (let c = st.top + TILE / 2; c < st.x1; c += TILE) level.pickups.push({ kind: 'cash', x: c, y: s.y - st.h * (1 - (c - st.top) / (st.x1 - st.top)) - SEWER.railH - PICKUPS.ride });
  }
  //the way in: a plank ramp down into the dig (onto the landing, if there is one), or just the hole
  if (s.entry === 'ramp') level.surfaces.push({ kind: 'bank', x0: s.drain[0], x1: s.drain[1], y: level.streetY, y1: s.y - (st?.h ?? 0), row: -1, sewer: true });
  //what's along it
  const slots: Slot[] = [];
  const deep = !room.shallow;
  const pipes = 1 + (more() < 0.75 ? 1 : 0);
  for (let p = 0; p < Math.min(pipes, SEWER.pipes); p++) slots.push({ kind: 'pipe', w: range(more, SEWER.pipe) });
  if (room.shallow && more() < SEWER.kicks[0]) slots.push({ kind: 'kick', w: SEWER.kick + SEWER.kickClear });
  if (room.shallow && more() < SEWER.kicks[1]) slots.push({ kind: 'kick', w: SEWER.kick + SEWER.kickClear });
  if (deep) for (let k = 0; k < DEEP.walks; k++) if (more() < 0.8) slots.push({ kind: 'walk', w: range(more, DEEP.walk) + 3 });
  if (piece === 'rats') slots.push({ kind: 'piece', w: 8 });
  if (piece === 'bowl') slots.push({ kind: 'piece', w: 3 * SEWER.bowl + 3 });
  if (piece === 'subway') slots.push({ kind: 'piece', w: SEWER.subway + 4 });
  //(the surge needs no floor of its own: it comes from behind you, out of the storm gate at the room's start)
  if (piece === 'surge') s.piece = { kind: 'surge', x: s.x0 };
  for (let k = slots.length - 1; k > 0; k--) {
    const j = Math.floor(more() * (k + 1));
    [slots[k], slots[j]] = [slots[j], slots[k]];
  }
  //(the set piece goes first or second, so it gets its room)
  const at = slots.findIndex((sl) => sl.kind === 'piece');
  if (at > 1) slots.unshift(...slots.splice(at, 1));
  const start = st ? st.x1 + SEWER.stairOut * TILE : s.climb ? s.climb[1] + SEWER.land * TILE : s.entry === 'flat' ? s.x0 + 2 * TILE : s.entry === 'drop' ? (s.topAt ?? s.x0) + (SEWER.land + 2) * TILE : holed ? s.drain[1] + SEWER.land * TILE : s.x0 + SEWER.land * TILE;
  let x = start;
  const stop = end - 2 * TILE;
  const floors: [number, number, number][] = []; // floor that dips, breaks or stands up: [x0, x1, kind 0 bowl / 1 gap / 2 stairs]
  if (st) floors.push([st.x0, st.x1, 2]);
  for (const slot of slots) {
    const w = slot.kind === 'pipe' && deep ? slot.w * TILE : slot.w * TILE;
    if (x + w > stop) continue;
    if (slot.kind === 'pipe') {
      const y = s.y - (deep ? DEEP.pipeH : SEWER.pipeH);
      const pipe = polyRail([[x, y], [x + w / 2, y], [x + w, y]]);
      pipe.sewer = true;
      level.rails.push(pipe);
      for (let c = x + TILE; c < x + w - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y - PICKUPS.ride });
      if (more() < (deep ? DEEP.stoken : SEWER.stoken)) level.pickups.push({ kind: 'stoken', x: x + w - TILE, y: y - PICKUPS.ride });
      x += w + range(more, [3, 5]) * TILE;
    } else if (slot.kind === 'walk') {
      //a walkway along the channel, up a step from it; a pipe hangs on from its end now and then, a grind from it
      const w0 = x + TILE;
      const w1 = x + w - 2 * TILE;
      (s.walks ??= []).push([w0, w1]);
      level.surfaces.push({ kind: 'ledge', x0: w0, x1: w1, y: s.y - DEEP.walkH, row: -1, sewer: true });
      for (let c = w0 + TILE; c < w1; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: s.y - DEEP.walkH - PICKUPS.ride });
      x += w;
      if (more() < 0.6 && x + 7 * TILE < stop) {
        const y = s.y - DEEP.pipeH;
        const pipe = polyRail([[w1 - 2 * TILE, y], [w1 + 2 * TILE, y], [w1 + 6 * TILE, y]]);
        pipe.sewer = true;
        level.rails.push(pipe);
        level.pickups.push({ kind: 'cash', x: w1 + 2 * TILE, y: y - PICKUPS.ride });
        x = w1 + 9 * TILE;
      }
    } else if (slot.kind === 'kick') {
      //the grate over it has to be clear street (no car over it, nothing standing on it) with street to land on after:
      //the first spot along from here where it is
      const fits = (k0: number) => {
        const g1 = k0 + SEWER.grate * TILE;
        //(ledges and rails on the street are one-way, you come up through them: only a car or the L's stop is in the way)
        const over = (a: { x0: number; x1: number }) => a.x1 > k0 - TILE && a.x0 < g1 + TILE;
        return g1 < (room.outlet ? s.outlet[0] : s.x1) - TILE && !level.cars.some(over) && !level.glass.some(over) && !(level.el ?? []).some((e) => e.x1 > k0 - TILE && e.x0 - 10 * TILE < g1 + TILE) && runOutAt(level, s, g1);
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
      const n = range(more, SEWER.rats) + (deep ? 2 : 0);
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
  //the floor, broken round the bowl, the subway and the stair set, then the outlet ramp (or on into the next room)
  let f0 = s.entry === 'ramp' && !st ? s.drain[1] : s.x0;
  const roof = (a: number, c: number, y = s.y) => c > a && level.surfaces.push({ kind: 'roof', x0: a, x1: c, y, row: -1, sewer: true });
  if (s.climb) {
    const [c0, c1] = s.climb;
    level.surfaces.push({ kind: 'bank', x0: c0, x1: c1, y: room.from!, y1: s.y, row: -1, sewer: true });
    f0 = c1;
  }
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
  roof(f0, end);
  if (room.outlet) level.surfaces.push({ kind: 'bank', x0: end, x1: s.x1, y: s.y, y1: level.streetY, row: -1, sewer: true });
  //runoff on the floor, on the flat (not in the bowl or over the gap, nor on a kick-out): in the deep, the channel
  const blocked = (a: number, c: number) => floors.some(([f, g]) => c > f - TILE && a < g + TILE) || (s.kicks ?? []).some((k) => c > k.x0 - TILE && a < k.x1 + TILE);
  const lo = start - TILE;
  const span = deep ? DEEP.channel : SEWER.wet;
  //(the deep's flood main: a surge room's channel runs its whole length, the current all that outruns the water)
  if (deep && piece === 'surge') s.wet.push([lo + TILE, end - TILE]);
  for (let k = 0; k < SEWER.wets * 3 && s.wet.length < SEWER.wets && !(deep && piece === 'surge'); k++) {
    const w = range(rng, span) * TILE;
    const hi = end - w - TILE;
    if (hi <= lo) break;
    const at = lo + Math.floor(rng() * ((hi - lo) / TILE)) * TILE;
    if (blocked(at, at + w) || s.wet.some(([w0, w1]) => at < w1 + 2 * TILE && at + w > w0 - 2 * TILE)) continue;
    s.wet.push([at, at + w]);
  }
  s.wet.sort((p, q) => p[0] - q[0]);
  //coins down the way in, and down the drop into the deep
  if (holed) level.pickups.push({ kind: 'cash', x: (s.drain[0] + s.drain[1]) / 2, y: level.streetY + SEWER.depth / 2 });
  if (s.entry === 'drop') for (let k = 1; k <= 3; k++) level.pickups.push({ kind: 'cash', x: s.x0 + k * TILE, y: s.y - (DEEP.depth - SEWER.depth) * (1 - k / 4) - PICKUPS.ride });
}

// dig the sewer route under a built floor's street chases (and, along it, the deep under the hills)
export function addSewer(level: Level, seed: number): void {
  if (!level.hillSpans?.length) return;
  const floor = level.layout.floor;
  const more = makeRng(seed * 73 + floor * 9187 + 11);
  const sewers = addSewerRoute(level, seed);
  if (!sewers.length) return;
  level.sewers = sewers;
  //the alligator, now and then, on clear floor in one of the rooms (the deep's first)
  if (floor >= SEWER.gatorFrom && more() < SEWER.gator) {
    const len = SEWER.gatorLen * TILE;
    for (const s of [...sewers.filter((w) => w.deep), ...shuffled(sewers.filter((w) => !w.deep), more)]) {
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
  const lo = Math.max(s.drain[1] + SEWER.land * TILE, s.climb ? s.climb[1] + SEWER.land * TILE : 0, s.entry === 'drop' ? (s.topAt ?? s.x0) + (SEWER.land + 2) * TILE : 0);
  const hi = (s.outlet[1] > s.outlet[0] ? s.x1 - SEWER.ramp * TILE : s.x1) - 2 * TILE - w;
  if (hi <= lo) return null;
  const busy: [number, number][] = [...(s.kicks ?? []).map((k): [number, number] => [k.x0 - TILE, k.x1 + SEWER.kickClear * TILE]), ...s.wet];
  const p = s.piece;
  if (p?.kind === 'bowl' || p?.kind === 'subway') busy.push([p.x0 - 2 * TILE, p.x1 + 8 * TILE]); // (you land from it locked out of an ollie)
  if (p?.kind === 'rats') busy.push([p.x - 10 * TILE, p.x + TILE]);
  if (s.gator) busy.push([s.gator[0] - 4 * TILE, s.gator[1] + 4 * TILE]);
  for (const t of s.stairs ?? []) busy.push([t.x0 - 2 * TILE, t.x1 + 3 * TILE]);
  for (const [a, b] of s.walks ?? []) busy.push([a - TILE, b + TILE]);
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
