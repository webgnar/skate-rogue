// Lane switches: the fork, spread through the floor and partly luck (zack, 2026-10-24: "the Fork mechanic needs to
// be integrated into the level much earlier so the player can ... accidently or unknowingly choose one path or the
// other", and "certain spots will force you into either lane a or b, and we can disperse these so the player
// switches between them or not throughout the level"). From a quarter of the way down the street it runs as two
// depth lanes: lane A in front (the skate lane) and lane B at the back. The lane you're in at the gate is your road:
// A the low road, B the high road. Along the way there are three or four switches:
// - a hop switch: in the air as you cross it, you hop over to the other lane, like a car changing lanes; rolling,
//   you stay put. Placed just past a gap where there is one, so whether you're still in the air there comes down to
//   how you jumped it. The first switch is always a hop.
// - a forced switch: the other lane is closed off there, so everyone goes into its lane.
// Past the first switch each lane gets its own rails, ledges, parked cars and glass (lane B more of them, as moving
// traffic keeps to lane A); the street and the gaps are the same for both. The validator's bot clears the floor
// taking lane A at every hop, and again taking lane B.
import { TILE } from '../physics/constants';
import { inHill, isStreetAt, type Lane, type LaneSwitch, type Level } from '../physics/level';
import { makeRng } from './rng';

export const LANES = {
  from: 0.25, // the first switch, as a share of the street part
  to: 0.85, // and the last
  count: [3, 4],
  hop: 0.4, // chance of a later switch being a hop (else forced, to A or B evenly)
  afterGap: 1.5 * TILE, // past a gap's far edge: still in the air if you jumped it late, rolling if early
  clear: 2 * TILE, // nothing lane-only this close to a switch
  runway: 8 * TILE, // or this close to the exit
  front: 0.3, // chances of a thing going to lane A only, or to lane B only (else both)
  back: 0.4,
};

// the street part of the floor, without its stretches of hill: [x0, x1] runs, a tile at a time
function flats(level: Level): [number, number][] {
  const out: [number, number][] = [];
  for (let x = level.finaleX; x < level.exitX; x += TILE) {
    if (inHill(level, x) || inHill(level, x + TILE)) continue;
    const last = out[out.length - 1];
    if (last && last[1] === x) last[1] = x + TILE;
    else out.push([x, x + TILE]);
  }
  return out;
}

// the x a share d of the way along the flats; and the end of the flat run it's in
function alongFlats(runs: [number, number][], d: number): [number, number] {
  for (const [a, b] of runs) {
    if (d <= b - a) return [a + d, b];
    d -= b - a;
  }
  const [, b] = runs[runs.length - 1];
  return [b, b];
}

// a hop switch's spot in [x0, x1]: just past a gap if there's one, else the middle
function hopAt(level: Level, x0: number, x1: number): number {
  for (let x = x0; x < x1 - LANES.afterGap - TILE; x += TILE / 2) {
    if (!isStreetAt(level, x) && isStreetAt(level, x + TILE / 2)) return Math.round((x + TILE / 2 + LANES.afterGap) / TILE) * TILE;
  }
  return Math.round((x0 + x1) / 2 / TILE) * TILE;
}

// spread along the street, never on a stretch of hill (the hills of a longer floor run between street blocks)
export function laneSwitches(level: Level, seed: number): LaneSwitch[] {
  const rng = makeRng(seed * 41 + level.layout.floor * 523);
  const runs = flats(level);
  const len = runs.reduce((n, [a, b]) => n + b - a, 0);
  const n = LANES.count[0] + Math.floor(rng() * (LANES.count[1] - LANES.count[0] + 1));
  const step = ((LANES.to - LANES.from) * len) / n;
  const out: LaneSwitch[] = [];
  for (let i = 0; i < n; i++) {
    const [x0, runEnd] = alongFlats(runs, LANES.from * len + i * step);
    const x1 = Math.min(runEnd, x0 + step * 0.6);
    const r = rng();
    //the first and last are hops: how you get into the lanes, and the lane you leave in, are down to you (and luck)
    if (i === 0 || i === n - 1 || r < LANES.hop) out.push({ x: hopAt(level, x0, x1) });
    else out.push({ x: Math.round((x0 + Math.min(step * 0.3, (x1 - x0) / 2)) / TILE) * TILE, to: r < LANES.hop + (1 - LANES.hop) / 2 ? 0 : 1 });
  }
  return out;
}

// past the first switch, things go to one lane or both
export function assignLanes(level: Level, switches: LaneSwitch[], seed: number): void {
  const rng = makeRng(seed * 59 + level.layout.floor * 1531);
  const start = switches[0].x + LANES.clear;
  const end = level.exitX - LANES.runway;
  const free = (x0: number, x1: number) =>
    x0 >= start && x1 <= end && !inHill(level, x0) && !inHill(level, x1) && switches.every((s) => x1 < s.x - LANES.clear || x0 > s.x + LANES.clear);
  const roll = (): Lane | undefined => {
    const r = rng();
    return r < LANES.front ? 0 : r < LANES.front + LANES.back ? 1 : undefined;
  };
  for (const s of level.surfaces) {
    if (s.side || s.el || s.tow !== undefined || s.kind === 'overpass' || !free(s.x0, s.x1)) continue;
    const t = roll();
    if (t !== undefined) s.track = t;
  }
  for (const r of level.rails) {
    if (r.wire || !free(r.x0, r.x1)) continue;
    const t = roll();
    if (t !== undefined) r.track = t;
  }
  for (const c of level.cars) {
    if (c.model || !free(c.x0, c.x1)) continue;
    const t = roll();
    if (t !== undefined) c.track = t;
  }
  for (const g of level.glass) {
    if (!free(g.x0, g.x1)) continue;
    const t = roll();
    if (t !== undefined) g.track = t;
  }
  //pickups go with the thing they're over
  for (const p of level.pickups) {
    const under = level.surfaces.find((s) => s.track !== undefined && p.x >= s.x0 && p.x <= s.x1 && p.y < s.y && s.y - p.y < 3 * TILE);
    const rail = level.rails.find((r) => r.track !== undefined && p.x >= r.x0 && p.x <= r.x1);
    const t = under?.track ?? rail?.track;
    if (t !== undefined) p.track = t;
  }
}
