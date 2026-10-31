// The top route (zack, 2026-10-25: get the player on a "top" or "bottom" route through the whole level, "vertically
// not horizontally"; "the upper power lines that are just there for decoration, could be a new layer of stuff as a
// top route"). Over each stretch of hill, from partway down, a power line hangs high, out of
// an ollie's reach, falling slower than the hill does (how you get up there is open: zack is working it out); stay on
// by grinding pole to pole, and once you're off you're on the street. Over the street chases and the run to
// the gate, a row of rooftop ledges carries it on at a height only the top route (or a bus roof, the L's trains and
// a flip) reaches, with pigeons in the way (src/sim/sky.ts); the overpass gate at the end stands at the same height, so the height you reach the gate at is
// your road. Up there there's no traffic, but the helicopter sees you (src/sim/floor.ts).
import { TILE } from '../physics/constants';
import { polyRail, isStreetAt, surfaceY, type CurvedRail, type Level, type Surface } from '../physics/level';
import { PICKUPS } from './descent';
import { makeRng, type Rng } from './rng';
import { SKY, type FlockSite } from '../sim/sky';
import { CHINATOWN, editFloor } from './hills';
import { floorEdit } from './level-edits';

export const TOP = {
  height: 5 * TILE, // the rooftops' and the gate's height over the street: over an L train's roof, past a flip
  high: 5 * TILE, // the wire's lowest over the ground behind it: out of an ollie and a flip's reach
  behind: 8, // tiles of ground behind that counts (so a terrace's edge doesn't bring it in reach)
  start: 0.45, // how far down a stretch of hill (from its top) the power line starts
  pole: 7, // tiles between the poles it hangs from
  roof: [9, 12], // tiles of rooftop ledge: off the end of one at the speed off a wire, an ollie lands on the next
  gap: [2, 3], // tiles between them, to ollie
  clear: 1.5 * TILE, // keep this far off anything else up there
  stoken: 0.25, // chance of a Stoken over a gap between rooftops
  wear: 0.3, // share of the usual truck and wheel wear grinding the power line costs
  flocks: 0.35, // chance of a flock of pigeons on a rooftop, or along a wire's stretch (src/sim/sky.ts)
  heatPerSec: 2.5, // the helicopter's Heat while you're up there, where clean skating and grinding don't cool it; tricks still do (src/heat/heat.ts)
};

// a floor's top route dials: its edits (the level editor) over TOP's
export function topDials(floor: number) {
  const e = floorEdit(editFloor(floor));
  return { topStart: e.topStart ?? TOP.start, roofGap: e.roofGap ?? TOP.gap, flocks: e.flocks ?? TOP.flocks };
}

const range = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

// the hill's ground at x (px, y down): the highest of its surfaces there, or the street; undefined over a gap
export function groundAt(level: Level, x: number): number | undefined {
  let y: number | undefined = isStreetAt(level, x) ? level.streetY : undefined;
  for (const s of level.surfaces) {
    if (s.side || s.el || s.top || s.kicker || s.kind === 'overpass' || s.kind === 'rail' || s.kind === 'ledge') continue;
    if (x < s.x0 || x > s.x1) continue;
    const sy = surfaceY(s, x);
    if (y === undefined || sy < y) y = sy;
  }
  return y;
}

// one stretch of hill [a, b]: from partway down, a power line high over the ground (never lower than `high` under the
// highest ground behind it), falling straight to the rooftops'
// height at the foot, and never rising (a grind doesn't climb); smoothed, it's one long grind (the poles it hangs
// from are scenery: a wire per span between them kicked you off at every pole)
function wire(level: Level, a: number, b: number, from = TOP.start, lip?: { x: number; y: number }): CurvedRail | null {
  const xs: number[] = [];
  const gs: number[] = [];
  for (let x = a; x <= b; x += TILE / 2) {
    const g = groundAt(level, x);
    if (g === undefined) continue;
    xs.push(x);
    gs.push(g);
  }
  if (xs.length < 8) return null;
  //from the peak (the top of the cable car's climb, or the hill's top)
  let p = 0;
  for (let i = 1; i < gs.length; i++) if (gs[i] < gs[p]) p = i;
  //it starts partway down (zack, 2026-10-25: "it should start higher than the street and the beginning of where you
  //can get to the high part can start like halfway down the hill"), and it never reaches down low ("dont have the
  //upper levels power lines reach down low"). How you get up there is still open: zack took the launch ramps out
  //("the ramps are bad... it should be all physics based")
  //(on a Chinatown block it starts over its cab flat's kicker, high enough that only the cab's speed gets you there)
  const start = lip ? lip.x : xs[p] + from * (b - xs[p]);
  //under it, the highest ground of the last few tiles
  const env = xs.map((x, i) => {
    let g = gs[i];
    for (let j = i; j >= 0 && xs[j] > x - TOP.behind * TILE; j--) g = Math.min(g, gs[j]);
    return g;
  });
  const k0 = xs.findIndex((x) => x >= start);
  if (k0 < 0 || xs.length - k0 < 6) return null;
  const x0 = xs[k0];
  const y0 = lip ? Math.min(env[k0] - TOP.high, lip.y - CHINATOWN.wireOverLip * TILE) : env[k0] - TOP.high;
  const yEnd = level.streetY - TOP.height;
  //(over a kicker it holds its height a while, past where an ollie and a flip off the lip at your own speed reach)
  const hold = lip ? Math.min(CHINATOWN.wireHold * TILE, (b - x0) / 2) : 0;
  const line = (x: number) => (x <= x0 + hold ? y0 : y0 + ((x - x0 - hold) / (b - x0 - hold)) * (yEnd - y0));
  const px = xs.slice(k0);
  const ys = px.map((x, i) => Math.min(line(x), env[k0 + i] - TOP.high));
  //smooth it (a kink is a jolt), then from the end back never higher further on, and never closer to the ground
  const smooth = ys.map((_, i) => {
    const w = ys.slice(Math.max(0, i - 4), i + 5);
    return w.reduce((t, v) => t + v, 0) / w.length;
  });
  const pts = px.map((x, i): [number, number] => [x, Math.min(smooth[i], env[k0 + i] - TOP.high)]);
  for (let i = pts.length - 2; i >= 0; i--) pts[i][1] = Math.min(pts[i][1], pts[i + 1][1]);
  if (pts.length < 4) return null;
  const w = polyRail(pts);
  w.wire = true;
  w.top = true;
  return w;
}

// is anything else up near y over [x0, x1]? (the L, a finale piece's roofs, rails)
export function busy(level: Level, x0: number, x1: number, y: number): boolean {
  const near = (sy: number) => Math.abs(sy - y) < TOP.clear;
  for (const s of level.surfaces) if (s.x1 > x0 && s.x0 < x1 && s.kind !== 'overpass' && near(Math.min(s.y, s.y1 ?? s.y))) return true;
  for (const r of level.rails) if (r.x1 > x0 && r.x0 < x1 && r.ys.some(near)) return true;
  //and the L: its trains' roofs are a way along up there already (src/traffic/el.ts)
  if ((level.el ?? []).some((e) => e.x1 > x0 - 2 * TILE && e.x0 < x1 + 2 * TILE)) return true;
  return false;
}

// the nearest height to y, up or down by half tiles up to two tiles, where [x0, x1] is clear of everything up
// there (null: crowded all the way); up first, at each step
// (no higher than `highest`, if given)
export function clearAt(level: Level, x0: number, x1: number, y: number, highest = -Infinity): number | null {
  for (let k = 0; k <= 8; k++) {
    const dy = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (TILE / 2);
    if (y + dy >= highest && !busy(level, x0, x1, y + dy)) return y + dy;
  }
  return null;
}

// rooftop ledges at the top route's height over the street from x0 to x1, with gaps to ollie between
function roofs(level: Level, x0: number, x1: number, rng: Rng, gaps = TOP.gap): Surface[] {
  const y = level.streetY - TOP.height;
  const out: Surface[] = [];
  for (let x = x0; x < x1 - 3 * TILE; ) {
    const w = Math.min(range(rng, TOP.roof) * TILE, x1 - x);
    if (!busy(level, x, x + w, y)) {
      out.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, top: true });
      for (let c = x + TILE; c < x + w - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y - PICKUPS.ride });
      const gap = range(rng, gaps) * TILE;
      if (rng() < TOP.stoken) level.pickups.push({ kind: 'stoken', x: x + w + gap / 2, y: y - PICKUPS.arc });
      x += w + gap;
    } else x += 2 * TILE;
  }
  return out;
}

// lay the top route over a built floor: wires down each stretch of hill, rooftops over the streets between and on to
// the gate (the overpass, at the same height, takes over for the last stretch)
export function addTopRoute(level: Level, seed: number): void {
  const spans = level.hillSpans;
  if (!spans?.length) return;
  const rng = makeRng(seed * 97 + level.layout.floor * 7333);
  const birds = makeRng(seed * 89 + level.layout.floor * 4211); // its own, so the pigeons don't move the rooftops
  const t = topDials(level.layout.floor);
  const rails: CurvedRail[] = [];
  const surfaces: Surface[] = [];
  const flocks: FlockSite[] = [];
  spans.forEach(([a, b], i) => {
    const lip = (level.cabs ?? []).find((c) => c.lip.x > a && c.lip.x < b)?.lip;
    const w = wire(level, a, b, t.topStart, lip);
    if (w) {
      rails.push(w);
      //pigeons sitting on the wire, halfway down
      if (birds() < t.flocks) {
        const m = w.at(w.length / 2);
        flocks.push({ x: m.x, y: m.y - SKY.perch, rail: level.rails.length + rails.length - 1 });
      }
      for (let d = 2 * TILE; d < w.length - TILE; d += 2 * TILE) {
        const p = w.at(d);
        level.pickups.push({ kind: 'cash', x: p.x, y: p.y - PICKUPS.ride });
      }
    }
    //then the street to the next stretch's climb, or to the overpass
    const end = i + 1 < spans.length ? spans[i + 1][0] : (level.fork?.x0 ?? level.exitX);
    const rs = roofs(level, b, end - 2 * TILE, rng, t.roofGap);
    //and on the far end of a long rooftop, past where an ollie onto it lands
    for (const r of rs) if (r.x1 - r.x0 >= 10 * TILE && birds() < t.flocks) flocks.push({ x: r.x1 - 2.5 * TILE, y: r.y - SKY.perch });
    surfaces.push(...rs);
  });
  level.rails.push(...rails);
  level.surfaces.push(...surfaces);
  if (flocks.length) level.flocks = flocks;
}
