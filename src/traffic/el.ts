// The L (GDD: Biome traffic, "Chicago has the L overhead; its girders are grindable"). On Chicago's street, a
// stretch of elevated track runs over the skate lane. Its running rails are a flat rail to grind: hop up from the
// parked car under its start (or a bus roof), grind the stretch, and drop back to the street at the end. At each end
// the track bends away into the city behind, and trains come round the bend and run along the stretch your way,
// then bend off again, cycling like the cross traffic: the first one timed from the floor seed against your
// arrival, so sometimes it's just ahead of you on the stretch (hop onto its roof), sometimes it pulls in as you
// get there, and sometimes it's gone. You see it coming round the bend before it reaches the lane. Pure.
import { makeRng } from '../gen/rng';
import { PHYS, TILE } from '../physics/constants';
import { isStreetAt, type Car, type Level } from '../physics/level';

export const EL = {
  under: 2.6, // tiles: the structure's underside over the street (a bus fits under; a car roof plus an ollie reaches)
  head: 0.44, // tiles: the running rails' heads over the underside (art/street.py ElSpan)
  lane: 0.2, // z: the middle of the track, between the running rails
  len: [14, 20], // tiles of straight track over the street
  bend: 5, // tiles: the radius of the bend at each end
  lead: 8, // tiles of track running back into the city past each bend
  cars: 2,
  carLen: 4 * TILE,
  coupling: 0.25 * TILE,
  carH: 1.7 * TILE, // roof over the rail heads
  speed: 0.75 * PHYS.baseSpeed, // px/frame, your way: slower than you skate, so you catch it
  period: 720, // frames between trains once it cycles
  stopPast: 30 * TILE, // no more trains once the skater is this far past the stretch
  access: 2 * TILE, // the parked car just before the start: its roof plus an ollie and a flip gets you up
  first: 12, // tiles into the street the first stretch starts (over EL_PIECE, the block after the start piece)
  from: 1, // floors with the L
  second: 4, // a second stretch from this floor
};

export interface ElStretch {
  x0: number; // px, the straight part
  x1: number;
  y: number; // px, the rail heads (y down)
  under: number; // px, the underside
  trigger: number; // trains start cycling when the skater passes this x
}

// ---------------------------------------------------------------------------------------------- the track's path

// the track as seen from above, in tiles: back from the city, round the bend, along the street, round and back
export interface PathPoint {
  x: number; // tiles
  z: number;
  heading: number; // radians: 0 = +x (your way), -PI/2 = coming toward the camera (+z)
}

export function pathLength(s: ElStretch): number {
  return 2 * EL.lead + Math.PI * EL.bend + (s.x1 - s.x0) / TILE;
}

// where along the track `d` tiles from its far back end is
export function pathAt(s: ElStretch, d: number): PathPoint {
  const R = EL.bend;
  const X0 = s.x0 / TILE;
  const X1 = s.x1 / TILE;
  const arc = (Math.PI / 2) * R;
  const straight = X1 - X0;
  const zc = EL.lane - R; // the bends' centres
  if (d < EL.lead) return { x: X0 - R, z: zc - EL.lead + d, heading: -Math.PI / 2 };
  d -= EL.lead;
  if (d < arc) {
    const th = Math.PI - d / R;
    return { x: X0 + R * Math.cos(th), z: zc + R * Math.sin(th), heading: -Math.PI / 2 + d / R };
  }
  d -= arc;
  if (d < straight) return { x: X0 + d, z: EL.lane, heading: 0 };
  d -= straight;
  if (d < arc) {
    const th = Math.PI / 2 - d / R;
    return { x: X1 + R * Math.cos(th), z: zc + R * Math.sin(th), heading: d / R };
  }
  d -= arc;
  return { x: X1 + R, z: zc - Math.min(d, EL.lead), heading: Math.PI / 2 };
}

// frames from a train setting off to its nose reaching the stretch
const ARRIVE = ((EL.lead + (Math.PI / 2) * EL.bend) * TILE) / EL.speed;

// --------------------------------------------------------------------------------------------- the placement

// where a Chicago street floor's L goes, and the parked car under each start; none on escapes or the tutorial
export function elPlan(level: Level, seed: number): ElStretch[] {
  const floor = level.layout.floor;
  if (floor < EL.from || level.escape || level.tutorial) return [];
  const rng = makeRng(seed * 23 + floor * 4219);
  const want = floor >= EL.second ? 2 : 1;
  const y = level.streetY - (EL.under + EL.head) * TILE;
  const under = level.streetY - EL.under * TILE;
  //it stays clear of anything that stands up under it, and of the fork and the gate
  const end = (level.fork ? level.fork.x0 - 8 * TILE : level.exitX - 10 * TILE);
  const tall = (x0: number, x1: number) =>
    level.surfaces.some((s) => s.x1 > x0 && s.x0 < x1 && Math.min(s.y, s.y1 ?? s.y) < level.streetY - 1.4 * TILE) ||
    level.rails.some((r) => r.x1 > x0 && r.x0 < x1 && Math.min(...r.ys) < level.streetY - 1.4 * TILE) ||
    level.cars.some((c) => c.x1 > x0 && c.x0 < x1 && c.model);
  const out: ElStretch[] = [];
  const place = (x: number, len: number) => {
    //trains from the seed against your arrival, as cross traffic is: -60 = just ahead of you on the stretch,
    //0-120 = pulling in as you get there, past 200 = long gone round the far bend
    const k = -60 + Math.floor(rng() * 300);
    out.push({ x0: x, x1: x + len, y, under, trigger: x - PHYS.baseSpeed * (ARRIVE + k) });
    level.surfaces.push({ kind: 'rail', x0: x, x1: x + len, y, row: -1, el: true });
  };
  const street = (a: number, b: number) => {
    for (let p = a; p <= b; p += TILE / 2) if (!isStreetAt(level, p)) return false;
    return true;
  };
  const lenOf = () => (EL.len[0] + Math.floor(rng() * (EL.len[1] - EL.len[0] + 1))) * TILE;
  //the first over the plain block after the start (EL_PIECE), its parked car just before it
  const block = level.layout.pieces.findIndex((p) => p.name === 'el');
  if (block > 0) {
    const x = level.finaleX + EL.first * TILE;
    level.cars.push({ x0: x - TILE - EL.access, x1: x - TILE, roof: level.streetY - 40, bottom: level.streetY });
    place(x, lenOf());
  }
  //more wherever the street is clear under it, each over a parked car or room for one
  let x = (out.length ? out[0].x1 + 24 * TILE : level.finaleX + 12 * TILE);
  while (out.length < want && x < end) {
    const len = lenOf();
    const carX = x - TILE - EL.access;
    const parked = level.cars.find((c) => !c.model && c.x0 <= x && c.x1 >= x - TILE);
    const room = street(carX - TILE, x) && !level.cars.some((c) => c.x1 > carX - TILE && c.x0 < x + TILE);
    if (x + len < end && !tall(x - 2 * TILE, x + len + 2 * TILE) && (parked || room)) {
      if (!parked) level.cars.push({ x0: carX, x1: carX + EL.access, roof: level.streetY - 40, bottom: level.streetY });
      place(x, len);
      x += len + (24 + Math.floor(rng() * 20)) * TILE;
    } else x += 2 * TILE;
  }
  //the L's columns stand in the back lane, so no cross street or bus stop under them matters
  return out;
}

// -------------------------------------------------------------------------------------------------- trains

export class ElTrain {
  t = -1; // frames since the first train set off; -1 waiting
  stopped = false;
  readonly boxes: Car[]; // each car's box while it's on the stretch (off it, it's out of the lane)

  constructor(readonly stretch: ElStretch) {
    this.boxes = Array.from({ length: EL.cars }, () => ({ x0: 0, x1: 0, roof: stretch.y - EL.carH, bottom: stretch.y }));
  }

  // the nose's distance along the path, tiles (negative: not out yet); null between trains
  get nose(): number | null {
    if (this.t < 0 || this.stopped) return null;
    const d = ((this.t % EL.period) * EL.speed) / TILE;
    const trainLen = (EL.cars * EL.carLen + (EL.cars - 1) * EL.coupling) / TILE;
    return d - trainLen < pathLength(this.stretch) ? d : null;
  }

  // each car's back and front along the path, tiles
  cars(): [number, number][] {
    const n = this.nose;
    if (n === null) return [];
    const len = EL.carLen / TILE;
    const gap = EL.coupling / TILE;
    return Array.from({ length: EL.cars }, (_, i) => [n - len - i * (len + gap), n - i * (len + gap)]);
  }

  // the cars on the stretch, as boxes in the skate lane
  get inLane(): Car[] {
    const s = this.stretch;
    const into = EL.lead + (Math.PI / 2) * EL.bend; // where the straight starts along the path
    const out: Car[] = [];
    this.cars().forEach(([a, b], i) => {
      const x0 = s.x0 + (a - into) * TILE;
      const x1 = s.x0 + (b - into) * TILE;
      if (x1 <= s.x0 || x0 >= s.x1) return;
      const box = this.boxes[i];
      box.x0 = Math.max(s.x0, x0);
      box.x1 = Math.min(s.x1, x1);
      out.push(box);
    });
    return out;
  }

  step(skaterX: number): void {
    if (this.t < 0) {
      if (skaterX >= this.stretch.trigger) this.t = 0;
      return;
    }
    this.t++;
    //a new train sets off only while the skater is still near
    if (this.t % EL.period === 0 && skaterX > this.stretch.x1 + EL.stopPast) this.stopped = true;
  }
}
