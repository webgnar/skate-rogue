// The sewer route (zack, 2026-10-31: "the sky route and a sewer route must be developed. sky surface ground. these
// are the three routes our game should have"). Under each street chase, where the street is clear, an open drain
// drops you down into a storm sewer: a tunnel under the street with pipes to grind and runoff that soaks the deck,
// out of the traffic's way and out of the helicopter's sight, so the Heat cools (src/sim/floor.ts). The street is
// its roof, low enough that a quick double tap bumps your head. A storm outlet ramps you back up through a hole in
// the street further on. All physics: you get in by rolling into the drain instead of ollieing it, and out by
// rolling up the ramp. Drawn by src/render/sewer-kit.ts.
import { TILE } from '../physics/constants';
import { inHill, polyRail, type Level, type Sewer, type Surface } from '../physics/level';
import { PICKUPS } from './descent';
import { makeRng, type Rng } from './rng';

export const SEWER = {
  depth: 5 * TILE, // the tunnel's floor under the street: an ollie fits under its roof, a quick double tap doesn't
  len: [24, 34], // tiles of tunnel, drain to outlet (shorter, down to min, where a long one doesn't fit)
  min: 16,
  drain: 3, // tiles of open drain: an ollie clears it, rolling on drops you in
  ramp: 8, // tiles of outlet ramp, up from the floor to the street
  outlet: 3, // tiles of hole over the top of the ramp (lower down the street still covers it)
  clear: 1, // tiles either side of a hole kept clear of anything on the street
  runUp: 8, // tiles of clear street before the drain
  runOut: 6, // and after the outlet
  after: 10, // tiles off the foot of a hill before a drain (you come off a hill in the air)
  before: 6, // tiles left before the next climb or the gate after the outlet
  land: 5, // tiles past the drain to come down in before anything's in the way
  pipe: [6, 10], // tiles of pipe to grind
  pipeH: 1.1 * TILE, // its height over the floor: an ollie gets onto it
  pipes: 2, // at most this many
  wet: [2, 3], // tiles of runoff in a stretch
  wets: 2, // at most this many stretches
  stoken: 0.4, // chance of a Stoken on a pipe
  coolPerSec: 4, // Heat lost per second down there, on top of the usual cooling (src/sim/floor.ts)
};

const range = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

// is the street at columns [c0, c1) clear for a hole: street all along, nothing standing on it or parked over it
function clearAt(level: Level, c0: number, c1: number): boolean {
  const [x0, x1] = [(c0 - SEWER.clear) * TILE, (c1 + SEWER.clear) * TILE];
  for (let c = c0 - SEWER.clear; c < c1 + SEWER.clear; c++) if (!level.street[c]) return false;
  const low = (s: Surface) => Math.max(s.y, s.y1 ?? s.y) > level.streetY - 3 * TILE;
  if (level.surfaces.some((s) => s.x1 > x0 && s.x0 < x1 && low(s))) return false;
  if (level.cars.some((c) => c.x1 > x0 && c.x0 < x1)) return false;
  if (level.glass.some((g) => g.x1 > x0 && g.x0 < x1)) return false;
  if ((level.el ?? []).some((e) => e.trigger > x0 && e.trigger < x1)) return false;
  return true;
}

// one sewer in the street chase [a, b] (px), if one fits
function sewer(level: Level, a: number, b: number, rng: Rng): Sewer | null {
  for (let len = range(rng, SEWER.len); len >= SEWER.min; len -= 2) {
    const s = sewerOf(level, a, b, len, rng);
    if (s) return s;
  }
  return null;
}

function sewerOf(level: Level, a: number, b: number, len: number, rng: Rng): Sewer | null {
  const first = Math.ceil(a / TILE) + SEWER.after;
  const last = Math.floor(b / TILE) - SEWER.before - len;
  if (last < first) return null;
  //from a random start, the first spot where both holes fit and the street runs unbroken between
  const tries = last - first + 1;
  const from = Math.floor(rng() * tries);
  for (let k = 0; k < tries; k++) {
    const c0 = first + ((from + k) % tries);
    const c1 = c0 + len;
    if (level.street.slice(c0, c1).some((s) => !s) || inHill(level, c0 * TILE) || inHill(level, c1 * TILE)) continue;
    //(and clear street to come out onto: the ramp throws you up the street at speed)
    if (!clearAt(level, c0, c0 + SEWER.drain) || !clearAt(level, c1 - SEWER.outlet, c1)) continue;
    const [o0, o1] = [c1 * TILE, (c1 + SEWER.runOut) * TILE];
    if (level.street.slice(c1, c1 + SEWER.runOut).some((s) => !s) || level.cars.some((c) => c.x1 > o0 && c.x0 < o1) || level.glass.some((g) => g.x1 > o0 && g.x0 < o1)) continue;
    //and no ramp or car in the run-up to throw you over the drain
    const [r0, r1] = [(c0 - SEWER.runUp) * TILE, c0 * TILE];
    if (level.surfaces.some((s) => s.x1 > r0 && s.x0 < r1 && (s.kind === 'bank' || s.kicker)) || level.cars.some((c) => c.x1 > r0 && c.x0 < r1)) continue;
    return {
      x0: c0 * TILE,
      x1: c1 * TILE,
      y: level.streetY + SEWER.depth,
      drain: [c0 * TILE, (c0 + SEWER.drain) * TILE],
      outlet: [(c1 - SEWER.outlet) * TILE, c1 * TILE],
      wet: [],
    };
  }
  return null;
}

// dig the sewer route under a built floor's street chases
export function addSewer(level: Level, seed: number): void {
  const spans = level.hillSpans;
  if (!spans?.length) return;
  const rng = makeRng(seed * 61 + level.layout.floor * 5821);
  const sewers: Sewer[] = [];
  spans.forEach(([, b], i) => {
    const end = i + 1 < spans.length ? spans[i + 1][0] : (level.fork?.x0 ?? level.exitX);
    const s = sewer(level, b, end, rng);
    if (!s) return;
    sewers.push(s);
    for (let c = s.drain[0] / TILE; c < s.drain[1] / TILE; c++) level.street[c] = false;
    for (let c = s.outlet[0] / TILE; c < s.outlet[1] / TILE; c++) level.street[c] = false;
    const ramp = s.x1 - SEWER.ramp * TILE;
    level.surfaces.push({ kind: 'roof', x0: s.x0, x1: ramp, y: s.y, row: -1, sewer: true });
    level.surfaces.push({ kind: 'bank', x0: ramp, x1: s.x1, y: s.y, y1: level.streetY, row: -1, sewer: true });
    //pipes along the tunnel, past where you come down from the drain and short of the ramp
    let x = s.drain[1] + SEWER.land * TILE;
    for (let p = 0; p < SEWER.pipes; p++) {
      const w = range(rng, SEWER.pipe) * TILE;
      if (x + w > ramp - 3 * TILE) break;
      const y = s.y - SEWER.pipeH;
      const pipe = polyRail([[x, y], [x + w / 2, y], [x + w, y]]);
      pipe.sewer = true;
      level.rails.push(pipe);
      for (let c = x + TILE; c < x + w - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y - PICKUPS.ride });
      if (rng() < SEWER.stoken) level.pickups.push({ kind: 'stoken', x: x + w - TILE, y: y - PICKUPS.ride });
      x += w + range(rng, [3, 5]) * TILE;
    }
    //runoff on the floor, between the pipes or under them
    for (let k = 0; k < SEWER.wets; k++) {
      const w = range(rng, SEWER.wet) * TILE;
      const lo = s.drain[1] + SEWER.land * TILE;
      const hi = ramp - w - TILE;
      if (hi <= lo) break;
      const at = lo + Math.floor(rng() * ((hi - lo) / TILE)) * TILE;
      if (s.wet.some(([w0, w1]) => at < w1 + 2 * TILE && at + w > w0 - 2 * TILE)) continue;
      s.wet.push([at, at + w]);
    }
    //coins down the drain's drop
    level.pickups.push({ kind: 'cash', x: (s.drain[0] + s.drain[1]) / 2, y: level.streetY + SEWER.depth / 2 });
  });
  if (sewers.length) level.sewers = sewers;
}
