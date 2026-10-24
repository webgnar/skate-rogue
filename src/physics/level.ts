// A floor as the physics sees it: street columns, one-way surfaces, curved rails and parked cars, in pixels.
import { CHUNK_W, STREET_ROW, cell, type Layout } from '../gen/layout';
import type { Road } from '../gen/roads';
import { TILE } from './constants';

export type SurfaceKind = 'roof' | 'ledge' | 'rail' | 'stairs' | 'bank' | 'overpass';

// a one-way surface you land on from above: x0..x1 at height y, or sloping from y to y1 (stairs, banks)
export interface Surface {
  kind: SurfaceKind;
  x0: number;
  x1: number;
  y: number;
  y1?: number;
  row: number;
}

export function surfaceY(s: Surface, x: number): number {
  if (s.y1 === undefined) return s.y;
  const t = Math.min(1, Math.max(0, (x - s.x0) / (s.x1 - s.x0)));
  return s.y + (s.y1 - s.y) * t;
}

export function surfaceSlope(s: Surface): number {
  return s.y1 === undefined ? 0 : (s.y1 - s.y) / (s.x1 - s.x0);
}

export interface Car {
  x0: number;
  x1: number;
  roof: number; // y of the roof
  bottom: number;
}

export interface Glass {
  x0: number;
  x1: number;
}

// a curved rail, sampled into a polyline with arc length (QFS o_grind_rail)
export class CurvedRail {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly ds: number[] = [];
  readonly length: number;

  constructor(
    readonly x0: number,
    readonly y0: number,
    readonly x1: number,
    readonly y1: number,
    readonly curve: number,
    samples = 48,
  ) {
    //quadratic curve; the control point is the midpoint pushed down by `curve` (+ sags, - arches)
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2 + curve * 2;
    let d = 0;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const u = 1 - t;
      const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
      const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
      if (i > 0) d += Math.hypot(x - this.xs[i - 1], y - this.ys[i - 1]);
      this.xs.push(x);
      this.ys.push(y);
      this.ds.push(d);
    }
    this.length = d;
  }

  // rail height under x (undefined off the rail)
  yAt(x: number): number | undefined {
    if (x < this.xs[0] || x > this.xs[this.xs.length - 1]) return undefined;
    const i = this.segmentAtX(x);
    const t = (x - this.xs[i]) / (this.xs[i + 1] - this.xs[i] || 1);
    return this.ys[i] + (this.ys[i + 1] - this.ys[i]) * t;
  }

  dAtX(x: number): number {
    const i = this.segmentAtX(x);
    const t = (x - this.xs[i]) / (this.xs[i + 1] - this.xs[i] || 1);
    return this.ds[i] + (this.ds[i + 1] - this.ds[i]) * t;
  }

  // point and unit tangent (towards the rail's end, y down) at distance d along the rail
  at(d: number): { x: number; y: number; tx: number; ty: number } {
    const dd = Math.min(Math.max(d, 0), this.length);
    let i = 0;
    while (i < this.ds.length - 2 && this.ds[i + 1] < dd) i++;
    const seg = this.ds[i + 1] - this.ds[i] || 1;
    const t = (dd - this.ds[i]) / seg;
    const dx = this.xs[i + 1] - this.xs[i];
    const dy = this.ys[i + 1] - this.ys[i];
    const len = Math.hypot(dx, dy) || 1;
    return { x: this.xs[i] + dx * t, y: this.ys[i] + dy * t, tx: dx / len, ty: dy / len };
  }

  private segmentAtX(x: number): number {
    let i = 0;
    while (i < this.xs.length - 2 && this.xs[i + 1] < x) i++;
    return i;
  }
}

export type PickupKind = 'cash' | 'stoken';

// cash and Stoken floating along lines: over gaps, along rails, up high on side lines
export interface Pickup {
  x: number;
  y: number;
  kind: PickupKind;
}

// the high road at the end of a floor: an overpass over the street, and where each road leads
export interface ForkSite {
  x0: number;
  x1: number;
  y: number;
  high: Road;
  low: Road;
}

export interface Level {
  layout: Layout;
  width: number;
  streetY: number; // the street surface
  street: boolean[]; // per column
  surfaces: Surface[];
  rails: CurvedRail[];
  cars: Car[];
  glass: Glass[];
  startX: number;
  startY: number;
  finaleX: number; // where the street begins (after a descent); 0 for a street-only floor
  exitX: number;
  pickups: Pickup[];
  fork: ForkSite | null;
  danger: number; // traffic 1 (light) to 3 (rush hour)
}

const CAR_W = 2 * TILE;
const CAR_H = 40;

export function buildLevel(layout: Layout): Level {
  const streetY = STREET_ROW * TILE;
  const street: boolean[] = [];
  for (let c = 0; c < layout.cols; c++) street.push(cell(layout, c, STREET_ROW) === '#');

  //one-way surfaces: runs of the same character on a row
  const surfaces: Surface[] = [];
  const kinds: Record<string, SurfaceKind> = { R: 'roof', '-': 'ledge', '=': 'rail' };
  for (let r = 1; r < STREET_ROW; r++) {
    let c = 0;
    while (c < layout.cols) {
      const ch = cell(layout, c, r);
      const kind = kinds[ch];
      if (!kind) {
        c++;
        continue;
      }
      let end = c;
      while (cell(layout, end + 1, r) === ch) end++;
      const y = kind === 'rail' ? r * TILE + TILE / 2 : r * TILE;
      surfaces.push({ kind, x0: c * TILE, x1: (end + 1) * TILE, y, row: r });
      c = end + 1;
    }
  }

  //curved rails: pair up each piece's r marks, left to right (QFS survivor_spawn)
  const rails: CurvedRail[] = [];
  layout.pieces.forEach((piece, p) => {
    const ends: [number, number][] = [];
    piece.rows.forEach((row, r) => {
      for (let k = 0; k < CHUNK_W; k++) if (row[k] === 'r') ends.push([p * CHUNK_W + k, r + 1]);
    });
    ends.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i + 1 < ends.length; i += 2) {
      const [c0, r0] = ends[i];
      const [c1, r1] = ends[i + 1];
      rails.push(new CurvedRail(c0 * TILE + 16, (r0 + 1) * TILE, c1 * TILE + 16, (r1 + 1) * TILE, piece.railCurve ?? 32));
    }
  });

  //parked cars stand on whatever is below them (the street, in practice)
  const cars: Car[] = [];
  const glass: Glass[] = [];
  for (let r = 1; r < STREET_ROW; r++) {
    for (let c = 0; c < layout.cols; c++) {
      const ch = cell(layout, c, r);
      if (ch === 'c') {
        const bottom = (r + 1) * TILE;
        cars.push({ x0: c * TILE, x1: c * TILE + CAR_W, roof: bottom - CAR_H, bottom });
      } else if (ch === '^') {
        const last = glass[glass.length - 1];
        if (last && last.x1 === c * TILE) last.x1 += TILE;
        else glass.push({ x0: c * TILE, x1: (c + 1) * TILE });
      }
    }
  }

  return {
    layout,
    width: layout.cols * TILE,
    streetY,
    street,
    surfaces,
    rails,
    cars,
    glass,
    startX: 3 * TILE,
    startY: streetY,
    finaleX: 0,
    exitX: (layout.cols - 6) * TILE,
    pickups: [],
    fork: null,
    danger: 2,
  };
}

export function isStreetAt(level: Level, x: number): boolean {
  const c = Math.floor(x / TILE);
  return c >= 0 && c < level.street.length && level.street[c];
}
