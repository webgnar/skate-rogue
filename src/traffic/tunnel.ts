// Tunnels through the hills (zack, 2026-10-25: "the cop car emerges from a tunnel at the bottom of the hill, if
// it's chasing the player, instead of straight through the side of the hill"). Traffic and the Heat cruiser run on
// the street, never up a hill, so every stretch of hill has a tunnel under it: its mouths face the street from the
// back of the road, one at the foot of each cable car climb (in) and one at the foot of each descent (out).
// Vehicles heading into a hill turn into the nearest mouth instead of driving into the hillside, and the cruiser
// drives through: it pulls in when you ride up a climb, and comes out behind you once you're down the other side.
// Pure: the sim, the cruiser and the hillside's portals all read the same mouths.
import { TILE } from '../physics/constants';
import { inHill, isStreetAt, type Level } from '../physics/level';
import { STREET_Z } from './traffic';

export const TUNNEL = {
  w: 3, // tiles: a mouth's width, outside to outside (the opening is narrower)
  open: [0.6, 2.4] as [number, number], // tiles from the mouth's left edge: the opening
  height: 3.4, // tiles: the headwall's top
  spring: 1.4, // the arch springs from here...
  rise: 1.3, // ...and peaks this much higher
  face: -3.6, // z: the headwall's face, at the back of the hill's sidewalk (hillside.ts HILLSIDE.backWalk)
  deep: -8.5, // z: where a vehicle is out of sight inside
  flat: 0.05, // tiles: ground this low is street height
  turnFrames: 36, // a vehicle's turn into or out of a mouth
  early: 3, // tiles: the cruiser starts swinging out this far before where it wants to be passes the mouth
};

export interface Mouth {
  x0: number; // px
  x1: number;
  way: 'in' | 'out'; // in: at the foot of a climb, traffic going your way turns in; out: at the foot of a descent
}

// the hill's ground height at x, tiles above the street: hill surfaces where there are some, otherwise 0 on the
// street and null over a canal (not street and not hill)
export function groundAt(level: Level, x: number): number | null {
  if (!inHill(level, x)) return isStreetAt(level, x) ? 0 : null;
  //(off the ends of the hill's ground, or between two pieces of it: the nearer one's height, as hillside.ts draws it)
  let best: number | null = null;
  let near = Infinity;
  let nearH = 0;
  for (const s of level.surfaces) {
    if (s.side || (s.kind !== 'roof' && s.kind !== 'bank' && s.kind !== 'stairs') || !inHill(level, s.x0)) continue;
    const h = (y: number) => (level.streetY - y) / TILE;
    if (x < s.x0 || x > s.x1) {
      const d = x < s.x0 ? s.x0 - x : x - s.x1;
      if (d < near) [near, nearH] = [d, h(x < s.x0 ? s.y : (s.y1 ?? s.y))];
      continue;
    }
    const y = s.y1 === undefined ? s.y : s.y + ((x - s.x0) / (s.x1 - s.x0 || 1)) * (s.y1 - s.y);
    if (best === null || h(y) < best) best = h(y);
  }
  return best ?? (near < Infinity ? nearH : 0);
}

const memo = new WeakMap<Level, Mouth[]>();

// every tunnel mouth on the floor, left to right
export function mouths(level: Level): Mouth[] {
  const hit = memo.get(level);
  if (hit) return hit;
  const out: Mouth[] = [];
  if (level.hills) {
    const spans = level.hillSpans?.length ? level.hillSpans : [[0, level.finaleX] as [number, number]];
    const w = TUNNEL.w * TILE;
    const high = (s: Level['surfaces'][number]) => Math.max(level.streetY - s.y, level.streetY - (s.y1 ?? s.y)) / TILE > TUNNEL.flat;
    spans.forEach(([a, b], i) => {
      const ground = level.surfaces
        .filter((s) => !s.side && s.x0 >= a - TILE && s.x1 <= b + TILE && (s.kind === 'roof' || s.kind === 'bank' || s.kind === 'stairs'))
        .sort((p, q) => p.x0 - q.x0);
      const up = ground.filter(high);
      if (!up.length) return;
      //in: the foot of the climb (a later stretch starts with one), on the flat just before it
      if (i > 0 && level.finaleX > 0) {
        const x1 = up[0].x0 - 0.1 * TILE;
        if (x1 - w >= a - TILE) out.push({ x0: x1 - w, x1, way: 'in' });
      }
      //out: the foot of the descent, a tile along the flat run-out after it
      const x0 = up[up.length - 1].x1 + TILE;
      if (x0 + w <= b) out.push({ x0, x1: x0 + w, way: 'out' });
    });
  }
  out.sort((p, q) => p.x0 - q.x0);
  memo.set(level, out);
  return out;
}

// The side street at the very end of a floor's street (zack: "new levels should start with a cross street behind
// the player... instead of the chasing cop car disappearing, it will turn up that side street"). The next floor
// starts where this one ends, so it's just behind you as the next floor begins, and the cruiser turns up it.
// Its middle, px, or null when the floor doesn't end on street.
export const TURN_OFF = { back: 2, half: 1.6 }; // tiles: its middle this far before the floor's end; half its width
export function turnOff(level: Level): number | null {
  const x = level.width - TURN_OFF.back * TILE;
  for (let t = x - TURN_OFF.half * TILE; t <= x + TURN_OFF.half * TILE; t += TILE / 2) if (!isStreetAt(level, Math.min(t, level.width - 1))) return null;
  return x;
}

// the middle of a mouth's opening, px
export const mouthX = (m: Mouth) => m.x0 + ((TUNNEL.open[0] + TUNNEL.open[1]) / 2) * TILE;

// where a vehicle turning into (u 0 -> 1) or out of (u 1 -> 0) a mouth is: z from the back lane deep into the
// tunnel, and how far round it has turned (0 along the street, 1 facing straight into the hill)
export function turnAt(u: number): { z: number; turn: number } {
  const k = Math.min(1, Math.max(0, u));
  const ease = k * k * (3 - 2 * k);
  return { z: STREET_Z.back + (TUNNEL.deep - STREET_Z.back) * ease, turn: Math.min(1, k * 1.6) };
}

// The Heat cruiser's way down the street, behind you (tiles, for the view). It drives where the ground is street
// height, jumps the canals, and goes through the tunnels: up against a climb it pulls into the mouth and is gone,
// and it comes out of the next 'out' mouth once the place it wants to be is past it.
export type CruiserMode = 'street' | 'in' | 'gone' | 'out';
export class CruiserPath {
  mode: CruiserMode = 'street';
  x = 0; // the middle of the car, tiles
  y = 0; // tiles above the street (a canal jump)
  z: number = STREET_Z.back;
  turn = 0; // 0 driving along the street, 1 nose into the hill
  private u = 0; // through a turn in or out
  private mouth: Mouth | null = null;
  private started = false;

  constructor(
    readonly level: Level,
    private readonly half = 1.15, // half the car's length, tiles
  ) {}

  get visible(): boolean {
    return this.mode !== 'gone';
  }

  // where on the street it can be: the car's whole length on street-height ground or over a canal
  private clear(x: number): boolean {
    for (let t = x - this.half; t <= x + this.half + 1e-6; t += 0.25) {
      const g = groundAt(this.level, t * TILE);
      if (g !== null && g > TUNNEL.flat) return false;
    }
    return true;
  }

  // the next mouth along from x (tiles) of a way
  private next(x: number, way: Mouth['way'], ahead: boolean): Mouth | null {
    const ms = mouths(this.level).filter((m) => m.way === way);
    return (ahead ? ms.find((m) => mouthX(m) / TILE >= x - this.half) : [...ms].reverse().find((m) => mouthX(m) / TILE <= x + TUNNEL.early)) ?? null;
  }

  // want: where it would be (the middle of the car, tiles); frames: 60 Hz frames this step
  step(want: number, frames = 1): void {
    if (!this.started) {
      this.started = true;
      this.x = want;
      if (!this.clear(want)) this.mode = 'gone';
    }
    if (this.mode === 'street') {
      //up against the hill: into the tunnel if there's a mouth here, else wait at the foot
      if (want > this.x && !this.clear(want)) {
        let x = this.x;
        while (x + 0.1 <= want && this.clear(x + 0.1)) x += 0.1;
        const m = this.next(x, 'in', true);
        if (m && Math.abs(mouthX(m) / TILE - x) < this.half + TUNNEL.w) {
          this.mouth = m;
          this.mode = 'in';
          this.u = 0;
        }
        this.x = x;
      } else if (want < this.x && !this.clear(want)) {
        //dropped back as far as the foot of the hill it came down: it waits there
        let x = this.x;
        while (x - 0.1 >= want && this.clear(x - 0.1)) x -= 0.1;
        this.x = x;
      } else this.x = want;
    }
    if (this.mode === 'in' && this.mouth) {
      this.u += frames / TUNNEL.turnFrames;
      this.x += (mouthX(this.mouth) / TILE - this.x) * Math.min(1, 0.12 * frames);
      if (this.u >= 1) this.mode = 'gone';
    }
    if (this.mode === 'gone') {
      //it comes out of the last mouth that the place it wants to be has passed, once that's street
      const m = this.next(want, 'out', false);
      if (m && want >= mouthX(m) / TILE - TUNNEL.early && this.clear(Math.max(want, mouthX(m) / TILE))) {
        this.mouth = m;
        this.mode = 'out';
        this.u = 1;
        this.x = mouthX(m) / TILE;
      }
    }
    if (this.mode === 'out' && this.mouth) {
      this.u -= frames / TUNNEL.turnFrames;
      //swinging out of the mouth and along the street, then running up to where it wants to be
      const from = mouthX(this.mouth) / TILE;
      const k = 1 - Math.max(0, this.u);
      this.x = from + (Math.max(from, want) - from) * k;
      if (this.u <= 0) this.mode = 'street';
    }
    const t = this.mode === 'in' || this.mode === 'out' ? turnAt(this.u) : turnAt(this.mode === 'gone' ? 1 : 0);
    this.z = t.z;
    this.turn = t.turn;
    this.y = this.mode === 'street' ? this.jump(this.x) : 0;
  }

  // over a canal it's in the air: an arc from bank to bank, from when its front wheels leave the street until its
  // back wheels are over the far side
  private jump(x: number): number {
    const gap = (t: number) => groundAt(this.level, t * TILE) === null;
    let c: number | null = null;
    for (let t = x - this.half; t <= x + this.half + 1e-6; t += 0.25) if (gap(t)) c = c ?? t;
    if (c === null) return 0;
    let a = c;
    let b = c;
    while (a > c - 30 && gap(a - 0.25)) a -= 0.25;
    while (b < c + 30 && gap(b + 0.25)) b += 0.25;
    const span = b - a + 2 * this.half;
    const u = Math.min(1, Math.max(0, (x - a + this.half) / span));
    //high enough to clear anything standing in the canal (a floating block, a ledge)
    let peak = 0.4 + 0.18 * span;
    for (const s of this.level.surfaces) {
      if (s.side || s.top || s.kind === 'rail' || s.kind === 'overpass' || s.x1 < a * TILE || s.x0 > b * TILE) continue;
      peak = Math.max(peak, (this.level.streetY - Math.min(s.y, s.y1 ?? s.y)) / TILE + 0.3);
    }
    return 4 * u * (1 - u) * Math.min(6, peak);
  }
}
