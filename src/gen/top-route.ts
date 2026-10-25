// The top route (zack, 2026-10-25: get the player on a "top" or "bottom" route through the whole level, "vertically
// not horizontally"; "the upper power lines that are just there for decoration, could be a new layer of stuff as a
// top route"). Over each stretch of hill a power line runs pole to pole from the crest down, falling slower than the
// hill does, so it soon hangs high over the street: you get on where it dips close over a crest (an ollie reaches),
// stay on by grinding pole to pole, and once you're off you're on the street. Over the street chases and the run to
// the gate, a row of rooftop ledges carries it on at a height only the top route (or a bus roof, the L's trains and
// a flip) reaches; the overpass gate at the end stands at the same height, so the height you reach the gate at is
// your road. Up there there's no traffic, but the helicopter sees you (src/sim/floor.ts).
import { TILE } from '../physics/constants';
import { polyRail, isStreetAt, surfaceY, type CurvedRail, type Level, type Surface } from '../physics/level';
import { PICKUPS } from './descent';
import { makeRng, type Rng } from './rng';

export const TOP = {
  height: 5 * TILE, // the rooftops' and the gate's height over the street: over an L train's roof, past a flip
  entry: 1.4 * TILE, // the wire's lowest over the ground: where it dips this close, an ollie gets you on
  pole: 7, // tiles between the poles it hangs from
  roof: [9, 12], // tiles of rooftop ledge: off the end of one at the speed off a wire, an ollie lands on the next
  gap: [2, 3], // tiles between them, to ollie
  clear: 1.5 * TILE, // keep this far off anything else up there
  stoken: 0.25, // chance of a Stoken over a gap between rooftops
  heatPerSec: 9, // the helicopter's Heat while you're up there: more than clean skating and grinding cool (src/heat/heat.ts)
};

const range = (rng: Rng, [lo, hi]: number[]) => lo + Math.floor(rng() * (hi - lo + 1));

// the hill's ground at x (px, y down): the highest of its surfaces there, or the street; undefined over a gap
function groundAt(level: Level, x: number): number | undefined {
  let y: number | undefined = isStreetAt(level, x) ? level.streetY : undefined;
  for (const s of level.surfaces) {
    if (s.side || s.el || s.top || s.kind === 'overpass' || s.kind === 'rail' || s.kind === 'ledge') continue;
    if (x < s.x0 || x > s.x1) continue;
    const sy = surfaceY(s, x);
    if (y === undefined || sy < y) y = sy;
  }
  return y;
}

// one stretch of hill [a, b]: from its peak down, a line no lower than `entry` over the ground, falling straight to
// the rooftops' height at the foot, and never rising (a grind doesn't climb); smoothed, it's one long grind (the
// poles it hangs from are scenery: a wire per span between them kicked you off at every pole)
function wire(level: Level, a: number, b: number): CurvedRail | null {
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
  //it starts over the end of the crest, where the street first falls away: ollie off the edge to catch it (rolling
  //off, you're on the street; that's the luck of it)
  let q = p;
  while (q < gs.length - 1 && gs[q] < gs[p] + TILE / 2) q++;
  const x0 = Math.max(xs[p], xs[q] - 2 * TILE);
  const y0 = gs[p] - TOP.entry;
  const yEnd = level.streetY - TOP.height;
  const line = (x: number) => y0 + ((x - x0) / (b - x0)) * (yEnd - y0);
  const k0 = xs.findIndex((x) => x >= x0);
  const px = xs.slice(k0);
  const ys = px.map((x, i) => Math.min(line(x), gs[k0 + i] - TOP.entry));
  //smooth it (a kink is a jolt), then from the end back never higher further on, and never into the ground
  const smooth = ys.map((_, i) => {
    const w = ys.slice(Math.max(0, i - 4), i + 5);
    return w.reduce((t, v) => t + v, 0) / w.length;
  });
  for (let i = smooth.length - 2; i >= 0; i--) smooth[i] = Math.min(smooth[i], smooth[i + 1]);
  const pts = px.map((x, i): [number, number] => [x, Math.min(smooth[i], gs[k0 + i] - TOP.entry)]);
  for (let i = pts.length - 2; i >= 0; i--) pts[i][1] = Math.min(pts[i][1], pts[i + 1][1]);
  if (pts.length < 4) return null;
  const w = polyRail(pts);
  w.wire = true;
  w.top = true;
  return w;
}

// is anything else up near y over [x0, x1]? (the L, a finale piece's roofs, rails)
function busy(level: Level, x0: number, x1: number, y: number): boolean {
  const near = (sy: number) => Math.abs(sy - y) < TOP.clear;
  for (const s of level.surfaces) if (s.x1 > x0 && s.x0 < x1 && s.kind !== 'overpass' && near(Math.min(s.y, s.y1 ?? s.y))) return true;
  for (const r of level.rails) if (r.x1 > x0 && r.x0 < x1 && r.ys.some(near)) return true;
  return false;
}

// rooftop ledges at the top route's height over the street from x0 to x1, with gaps to ollie between
function roofs(level: Level, x0: number, x1: number, rng: Rng): Surface[] {
  const y = level.streetY - TOP.height;
  const out: Surface[] = [];
  for (let x = x0; x < x1 - 3 * TILE; ) {
    const w = Math.min(range(rng, TOP.roof) * TILE, x1 - x);
    if (!busy(level, x, x + w, y)) {
      out.push({ kind: 'ledge', x0: x, x1: x + w, y, row: -1, top: true });
      for (let c = x + TILE; c < x + w - TILE / 2; c += 2 * TILE) level.pickups.push({ kind: 'cash', x: c, y: y - PICKUPS.ride });
      const gap = range(rng, TOP.gap) * TILE;
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
  const rails: CurvedRail[] = [];
  const surfaces: Surface[] = [];
  spans.forEach(([a, b], i) => {
    const w = wire(level, a, b);
    if (w) {
      rails.push(w);
      for (let d = 2 * TILE; d < w.length - TILE; d += 2 * TILE) {
        const p = w.at(d);
        level.pickups.push({ kind: 'cash', x: p.x, y: p.y - PICKUPS.ride });
      }
    }
    //then the street to the next stretch's climb, or to the overpass
    const end = i + 1 < spans.length ? spans[i + 1][0] : (level.fork?.x0 ?? level.exitX);
    surfaces.push(...roofs(level, b, end - 2 * TILE, rng));
  });
  level.rails.push(...rails);
  level.surfaces.push(...surfaces);
}
