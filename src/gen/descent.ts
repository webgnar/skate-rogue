// Downhill floors (GDD: Floor shape). A floor starts high on the rooftops and works down to the street through
// terraces, stair sets, big handrails, drop-offs, rooftop gaps and a few banks, then finishes on a short street
// stretch built from QFS pieces (canals, curved rails, parked cars, traffic) with the exit gate.
import { placeGrass } from './grass';
import { placeProps } from './props';
import { addSideLine } from './sidelines';
import { applyTwist, districtPieces, type Twist } from './twists';
import { crossPlan } from '../traffic/cross';
import { doorPlan, stopPlan } from '../traffic/street';
import { bountyPlan } from '../run/bounty';
import { TILE } from '../physics/constants';
import { buildLevel, CurvedRail, type CabRun, type Level, type Pickup, type Surface } from '../physics/level';
import type { Fork } from './roads';
import { CHUNK_W, makeLayout, STREET_ROW } from './layout';
import { EL_PIECE, FORK_PIECE, HILL_PIECE, PIECES, RUNWAY_PIECE, type Piece } from './pieces';
import { makeRng, randInt, type Rng } from './rng';
import { addTopRoute, TOP } from './top-route';
import { addSkyBeats } from './sky-beats';
import { addSpinTokens, type SpinSpots } from './spin-tokens';
import { buildClimb, buildHills, editFloor, hillDials, stretches } from './hills';
import { floorEdit } from './level-edits';
import { elPlan } from '../traffic/el';

export const DESCENT = {
  stepRise: 16, // px per step
  stepRun: TILE,
  railHeight: 24, // handrail above the step nosing
  maxSections: 24,
};

export function startHeight(floor: number): number {
  return Math.min(30, 12 + 2 * floor); // tiles above the street
}

export function sectionCount(floor: number): number {
  return Math.min(DESCENT.maxSections, 9 + 2 * floor);
}

export function maxSteps(floor: number): number {
  return Math.min(16, 10 + floor);
}

function finaleCount(floor: number): number {
  return Math.min(4, 2 + Math.floor((floor - 1) / 3));
}

const range = (rng: Rng, lo: number, hi: number) => lo + randInt(rng, hi - lo + 1);

export interface Builder {
  x: number; // px, where the next section starts
  h: number; // tiles above the street
  surfaces: Surface[];
  rails: CurvedRail[];
  top: number; // tiles the floor starts above the street
  pickups: Pickup[];
  prng: Rng; // pickups roll on their own stream so they never change the floor's shape
  crossings?: { x: number; y: number }[]; // Chinatown's intersections with cross traffic: the cross street's middle, the ground's height
  cabs?: CabRun[]; // Chinatown's cab flats
  chinatown?: [number, number]; // the Chinatown block, px
}

export interface FloorOptions {
  short?: boolean; // a stash floor: fewer sections
  danger?: number; // traffic 1-3
  fork?: Fork; // where the roads at the end lead
  gravity?: number; // the district's (BIOME_GRAVITY): validation skates the floor in it
  twist?: Twist; // the district's twist (src/gen/twists.ts): validation skates that too
  hills?: boolean; // act 1's San Francisco hillside instead of rooftops (src/gen/hills.ts)
}

export const PICKUPS = {
  ride: 18, // coins float this far above a rail or ledge, where the skater's body passes
  arc: 46, // peak of a coin arc over a gap, above the line between its edges
  high: 92, // a Stoken up high: only a flip gets there
  fork: 2 * TILE, // the overpass: above a plain ollie (50 px), within ollie + flip
};

// a line of coins along a straight run, one per tile
export function coinLine(b: Builder, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(1, Math.round((x1 - x0) / TILE));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    b.pickups.push({ kind: 'cash', x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
  }
}

// an arc of coins from one edge to another, like the jump that clears it
export function coinArc(b: Builder, x0: number, y0: number, x1: number, y1: number, peak: number): void {
  const n = Math.max(3, Math.round((x1 - x0) / TILE));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    b.pickups.push({ kind: 'cash', x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t - peak * 4 * t * (1 - t) });
  }
}

export function yOf(streetY: number, h: number): number {
  return streetY - h * TILE;
}

export function terrace(b: Builder, streetY: number, tiles: number, rng: Rng, features: boolean): void {
  const y = yOf(streetY, b.h);
  b.surfaces.push({ kind: 'roof', x0: b.x, x1: b.x + tiles * TILE, y, row: -1 });
  if (features && tiles >= 8) {
    const roll = rng();
    const len = range(rng, 4, Math.min(8, tiles - 3));
    const at = b.x + range(rng, 2, tiles - len - 1) * TILE;
    if (roll < 0.35) {
      b.surfaces.push({ kind: 'rail', x0: at, x1: at + len * TILE, y: y - DESCENT.railHeight, row: -1 });
      coinLine(b, at + TILE, y - DESCENT.railHeight - PICKUPS.ride, at + (len - 1) * TILE, y - DESCENT.railHeight - PICKUPS.ride);
    } else if (roll < 0.55) {
      b.surfaces.push({ kind: 'ledge', x0: at, x1: at + len * TILE, y: y - TILE, row: -1 });
      coinLine(b, at + TILE, y - TILE - PICKUPS.ride, at + (len - 1) * TILE, y - TILE - PICKUPS.ride);
    }
  }
  b.x += tiles * TILE;
}

export function stairs(b: Builder, streetY: number, steps: number, rail: boolean): void {
  const y = yOf(streetY, b.h);
  const x1 = b.x + steps * DESCENT.stepRun;
  const y1 = y + steps * DESCENT.stepRise;
  b.surfaces.push({ kind: 'stairs', x0: b.x, x1, y, y1, row: -1 });
  //the handrail starts half a tile before the top step so you can ollie onto it from the landing
  if (rail) {
    b.rails.push(new CurvedRail(b.x - TILE / 2, y - DESCENT.railHeight, x1, y1 - DESCENT.railHeight, 0, 8));
    const r = DESCENT.railHeight + PICKUPS.ride;
    coinLine(b, b.x + TILE, y + DESCENT.stepRise - r, x1 - TILE, y1 - DESCENT.stepRise - r);
  } else {
    //no rail: the coins show the ollie down the set
    coinArc(b, b.x + TILE, y - PICKUPS.ride, x1 + TILE, y1 - PICKUPS.ride, PICKUPS.arc);
  }
  b.x = x1;
  b.h -= (steps * DESCENT.stepRise) / TILE;
}

export function buildDescent(seed: number, floor: number, streetY: number, short = false): Builder {
  const rng = makeRng(seed * 7 + floor * 104723);
  const top = short ? Math.ceil(startHeight(floor) * 0.6) : startHeight(floor);
  const b: Builder = { x: 0, h: top, top, surfaces: [], rails: [], pickups: [], prng: makeRng(seed * 11 + floor * 7477) };
  terrace(b, streetY, 10, rng, false);
  let hadStairs = false;
  let hadRail = false;
  let hadBank = false;
  const sections = short ? Math.ceil(sectionCount(floor) * 0.6) : sectionCount(floor);

  for (let i = 0; i < sections && b.h > 0; i++) {
    const left = sections - i;
    //drop faster when there is a lot of height left
    const need = b.h / left;
    const r = rng();
    const mustBank = !hadBank && sections >= 8 && i === Math.floor(sections / 2);
    if (mustBank || (r < 0.12 && b.h + 3 <= top && i > 1)) {
      //bank up to a higher roof; sometimes it kicks you over a gap instead
      const rise = range(rng, 1, 3);
      const len = range(rng, 4, 6);
      const y = yOf(streetY, b.h);
      b.surfaces.push({ kind: 'bank', x0: b.x, x1: b.x + len * TILE, y, y1: y - rise * TILE, row: -1 });
      b.x += len * TILE;
      b.h += rise;
      hadBank = true;
      if (rng() < 0.35) {
        const from = { x: b.x, y: yOf(streetY, b.h) };
        b.x += range(rng, 2, 3) * TILE;
        b.h = Math.max(0, b.h - range(rng, 1, 3));
        coinArc(b, from.x, from.y - PICKUPS.ride, b.x + TILE, yOf(streetY, b.h) - PICKUPS.ride, PICKUPS.arc + 20);
      } else if (b.prng() < 0.5) {
        //a Stoken over the lip of the bank: launch off it with a flip
        b.pickups.push({ kind: 'stoken', x: b.x + 2 * TILE, y: yOf(streetY, b.h) - PICKUPS.high });
      }
      terrace(b, streetY, range(rng, 6, 10), rng, true);
    } else if (r < 0.55 || !hadStairs) {
      const most = Math.min(maxSteps(floor), Math.floor(b.h * 2));
      if (most < 4) {
        b.h = 0;
        terrace(b, streetY, 6, rng, false);
        continue;
      }
      const steps = range(rng, 4, most);
      //sets the base ollie and flip can't clear always get a handrail
      const rail = steps > 8 || rng() < 0.7;
      stairs(b, streetY, steps, rail);
      hadStairs = true;
      hadRail ||= rail;
      terrace(b, streetY, range(rng, 6, 9), rng, false);
    } else if (r < 0.78) {
      //drop-off onto the next roof
      const from = { x: b.x, y: yOf(streetY, b.h) };
      b.h = Math.max(0, b.h - Math.min(b.h, range(rng, 2, Math.max(2, Math.min(10, Math.ceil(need * 1.5))))));
      coinArc(b, from.x - TILE, from.y - PICKUPS.ride, from.x + 3 * TILE, yOf(streetY, b.h) - PICKUPS.ride, 30);
      terrace(b, streetY, range(rng, 6, 12), rng, true);
    } else {
      //rooftop gap, maybe onto a lower roof
      const from = { x: b.x, y: yOf(streetY, b.h) };
      b.x += range(rng, 2, floor >= 3 ? 5 : 4) * TILE;
      b.h = Math.max(0, b.h - range(rng, 0, Math.min(4, Math.floor(b.h))));
      const to = { x: b.x + TILE, y: yOf(streetY, b.h) };
      coinArc(b, from.x - TILE, from.y - PICKUPS.ride, to.x, to.y - PICKUPS.ride, PICKUPS.arc);
      if (b.prng() < 0.4) b.pickups.push({ kind: 'stoken', x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - PICKUPS.high });
      terrace(b, streetY, range(rng, 6, 12), rng, true);
    }
  }
  //finish the way down: a handrail set if none yet, then drops to street level
  if (!hadRail && b.h >= 2) {
    const steps = Math.min(16, Math.floor(b.h * 2));
    stairs(b, streetY, steps, true);
    terrace(b, streetY, 6, rng, false);
  }
  while (b.h > 0) {
    b.h = Math.max(0, b.h - Math.min(b.h, 8));
    terrace(b, streetY, 6, rng, false);
  }
  return b;
}

// the whole floor: descent, then the street finale (its start piece is the runway where the last roof meets the street)
const STREET_Y = STREET_ROW * TILE;

export function buildFloor(seed: number, floor: number, library: Piece[] = PIECES, opts: FloorOptions = {}): Level {
  //a hill floor's later stretches of hill, each from the foot of the cable car up it (street chases come between)
  const climbs = opts.hills && !opts.short ? stretches(seed, floor).slice(1).map((_, i) => buildClimb(seed, floor, STREET_Y, i + 1)) : [];
  const chase = hillDials(floor).chasePieces;
  const breaks: [number, Piece[]][] = climbs.map((c, i) => [(i + 1) * chase, [...new Array<Piece>(c.x / (CHUNK_W * TILE)).fill(HILL_PIECE), RUNWAY_PIECE]]);
  //Chicago's street opens with a block of plain street for the L over it
  const finale = buildLevel(makeLayout(seed, floor, districtPieces(library, opts.twist), ((opts.hills ? floorEdit(editFloor(floor)).street : undefined) ?? finaleCount(floor)) + climbs.length * chase, opts.fork ? [FORK_PIECE] : [], opts.hills ? [EL_PIECE] : [], breaks));
  const d = opts.hills ? buildHills(seed, floor, finale.streetY, opts.short) : buildDescent(seed, floor, finale.streetY, opts.short);
  //every floor has a Stoken somewhere: if the sections rolled none, one goes up high over the first stair set
  if (!d.pickups.some((p) => p.kind === 'stoken')) {
    const set = d.surfaces.find((s) => s.kind === 'stairs')!;
    d.pickups.push({ kind: 'stoken', x: set.x0 + 2 * TILE, y: set.y - PICKUPS.high });
  }
  const off = Math.ceil(d.x / TILE) * TILE;
  const cols = off / TILE;
  const shiftRail = (r: CurvedRail, by = off) => Object.assign(new CurvedRail(r.x0 + by, r.y0, r.x1 + by, r.y1, r.curve), { wire: r.wire });
  //the later stretches of hill, each over its run of hill pieces
  const spans: [number, number][] = [[0, off]];
  const starts = finale.layout.pieces.flatMap((p, i) => (p.name === 'hill' && finale.layout.pieces[i - 1]?.name !== 'hill' ? [i * CHUNK_W * TILE + off] : []));
  const hillSurfaces: Surface[] = [];
  const hillRails: CurvedRail[] = [];
  const hillPickups: Pickup[] = [];
  const hillCross: { x: number; y: number }[] = [];
  const cabs: CabRun[] = [];
  const chinatown: [number, number][] = [];
  climbs.forEach((c, i) => {
    const at = starts[i];
    hillCross.push(...(c.crossings ?? []).map((k) => ({ x: k.x + at, y: k.y })));
    cabs.push(...(c.cabs ?? []).map((r) => ({ ...r, x: r.x + at, turnX: r.turnX + at, lip: { x: r.lip.x + at, y: r.lip.y } })));
    if (c.chinatown) chinatown.push([c.chinatown[0] + at, c.chinatown[1] + at]);
    spans.push([at, at + c.x]);
    hillSurfaces.push(...c.surfaces.map((s) => ({ ...s, x0: s.x0 + at, x1: s.x1 + at })));
    hillRails.push(...c.rails.map((r) => shiftRail(r, at)));
    hillPickups.push(...c.pickups.map((p) => ({ ...p, x: p.x + at })));
  });
  const rails = [...d.rails, ...hillRails, ...finale.rails.map((r) => shiftRail(r))];
  //coins along the street's curved rails
  const pickups = [...d.pickups, ...hillPickups];
  for (const r of rails.slice(d.rails.length + hillRails.length)) {
    for (let dd = TILE; dd < r.length - TILE / 2; dd += TILE) {
      const p = r.at(dd);
      pickups.push({ kind: 'cash', x: p.x, y: p.y - PICKUPS.ride });
    }
  }
  //the fork: an overpass over the last street piece up to just past the exit gate; ollie and flip up to take it
  const exitX = finale.exitX + off;
  let fork: Level['fork'] = null;
  if (opts.fork) {
    //starts 6 tiles into the runway piece and runs past the gate in the exit piece
    const x0 = finale.width + off - 26 * TILE;
    //(on a hill floor, up at the top route's height: you reach it along the rooftops)
    const y = finale.streetY - (opts.hills ? TOP.height : PICKUPS.fork);
    fork = { x0, x1: exitX + 4 * TILE, y, ...opts.fork };
    for (let x = x0 + 2 * TILE; x < exitX - TILE; x += 2 * TILE) pickups.push({ kind: 'cash', x, y: y - PICKUPS.ride });
  }
  const level: Level = {
    ...finale,
    width: finale.width + off,
    street: [...new Array<boolean>(cols).fill(false), ...finale.street],
    surfaces: [
      ...d.surfaces,
      ...hillSurfaces,
      ...finale.surfaces.map((s) => ({ ...s, x0: s.x0 + off, x1: s.x1 + off })),
      ...(fork ? [{ kind: 'overpass' as const, x0: fork.x0, x1: fork.x1, y: fork.y, row: -1 }] : []),
    ],
    rails,
    cars: finale.cars.map((c) => ({ ...c, x0: c.x0 + off, x1: c.x1 + off })),
    glass: finale.glass.map((g) => ({ x0: g.x0 + off, x1: g.x1 + off })),
    startX: 3 * TILE,
    startY: finale.streetY - d.top * TILE,
    finaleX: off,
    exitX,
    pickups,
    fork,
    danger: opts.danger ?? 2,
    ...(opts.hills ? { hills: true, hillSpans: spans } : {}),
    ...(chinatown.length ? { chinatown, hillCross, cabs } : {}),
    ...(opts.gravity !== undefined && opts.gravity !== 1 ? { gravity: opts.gravity } : {}),
  };
  //Chicago's L over the street, before the side line so the side line stays clear of it
  if (opts.hills) level.el = elPlan(level, level.layout.seed);
  const sideFrom = level.pickups.length;
  addSideLine(level, level.layout.seed);
  const topFrom = level.pickups.length;
  if (opts.hills && !opts.short) {
    addTopRoute(level, level.layout.seed);
    addSkyBeats(level, level.layout.seed);
  }
  const spinSpots: SpinSpots = { side: [sideFrom, topFrom], top: [topFrom, level.pickups.length] };
  applyTwist(level, opts.twist, level.layout.seed);
  level.crossings = crossPlan(level, level.layout.seed);
  level.busStops = stopPlan(level, level.layout.seed);
  level.doors = doorPlan(level, level.layout.seed, level.busStops);
  const bounty = bountyPlan(level, level.layout.seed);
  if (bounty && !opts.short) level.bounty = bounty;
  level.grass = placeGrass(level);
  level.props = placeProps(level);
  addSpinTokens(level, spinSpots);
  return level;
}
