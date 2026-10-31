// A floor as the physics sees it: street columns, one-way surfaces, curved rails and parked cars, in pixels.
import type { FlockSite } from '../sim/sky';
import type { Prop } from '../gen/props';
import type { Intersection } from '../traffic/cross';
import type { BusStop } from '../traffic/street';
import { CHUNK_W, STREET_ROW, cell, type Layout } from '../gen/layout';
import type { Road } from '../gen/roads';
import { PHYS, TILE } from './constants';
import type { Material } from './feel';

export type SurfaceKind = 'roof' | 'ledge' | 'rail' | 'stairs' | 'bank' | 'overpass';

// a one-way surface you land on from above: x0..x1 at height y, or sloping from y to y1 (stairs, banks)
export interface Surface {
  kind: SurfaceKind;
  x0: number;
  x1: number;
  y: number;
  y1?: number;
  row: number;
  material?: Material; // what it grinds like; left out, it goes by kind (see surfaceMaterial)
  manual?: boolean; // a manual pad (buildLevel): you ride it in a manual
  side?: boolean; // part of a floor's side line (src/gen/sidelines.ts)
  crumble?: boolean; // Greece's ruins: it falls a moment after you land on it
  crumbleFrames?: number; // and how long that moment is, if not PHYS.crumbleFrames (a thin cloud, src/gen/clouds.ts)
  conveyor?: number; // High-Tech conveyor rails: px/frame the rail adds to your grind (negative runs back)
  el?: boolean; // the L's running rails (src/traffic/el.ts): drawn with the track, not as a bar on posts
  hill?: boolean; // a street running downhill (act 1's San Francisco hills): a bank that falls away, drawn as road
  kicker?: boolean; // a kicker ramp on the street (the L's, src/traffic/el.ts): drawn as a steel launch ramp
  tow?: number; // a cable car climb (src/gen/hills.ts): px/frame the cable pulls you up it, whatever the slope
  sky?: string; // a sky beat (src/gen/sky-beats.ts): roofs, billboard, tower or scaffold, drawn by src/render/sky-kit.ts
  top?: boolean; // part of the top route (src/gen/top-route.ts): a rooftop up where the helicopter sees you
  sewer?: boolean; // the sewer route's floor and outlet ramp (src/gen/sewer.ts), drawn by src/render/sewer-kit.ts
}

// bars are steel; ledges, roofs, stairs, banks and the overpass are concrete
export function surfaceMaterial(s: Surface): Material {
  return s.material ?? (s.kind === 'rail' ? 'metal' : 'concrete');
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
  model?: 'cruiser' | 'bus'; // parked roadblock vehicles; plain parked cars leave it out
  kicker?: number; // a box truck's dropped tailgate: this far behind x0 it launches you (px)
  skitch?: boolean; // a Chinatown cab (src/traffic/cab.ts): roll into its back bumper and you hang on, skitching
  ledge?: Surface; // an L train's car (src/traffic/el.ts): a one-way platform: its roof is a grind that moves with it, and it never hits you
}

export interface Glass {
  x0: number;
  x1: number;
}

// a rail through these points (px), as one grind: the top route's power line down a whole stretch of hill
export function polyRail(points: [number, number][]): CurvedRail {
  const [a, b] = [points[0], points[points.length - 1]];
  const r = new CurvedRail(a[0], a[1], b[0], b[1], 0, 1);
  r.xs.length = r.ys.length = r.ds.length = 0;
  let d = 0;
  points.forEach(([x, y], i) => {
    if (i > 0) d += Math.hypot(x - points[i - 1][0], y - points[i - 1][1]);
    r.xs.push(x);
    r.ys.push(y);
    r.ds.push(d);
  });
  (r as { length: number }).length = d;
  return r;
}

// a curved rail, sampled into a polyline with arc length (QFS o_grind_rail)
export class CurvedRail {
  readonly xs: number[] = [];
  readonly ys: number[] = [];
  readonly ds: number[] = [];
  readonly length: number;
  material: Material = 'metal'; // handrails and curved rails are steel
  wire = false; // a power line strung low over a block of hill (src/gen/hills.ts): drawn as a wire, not a tube
  top = false; // the top route's power line (src/gen/top-route.ts)
  sewer = false; // a pipe in the sewer (src/gen/sewer.ts)
  sky?: string; // a sky beat's grind (src/gen/sky-beats.ts): a crane's boom

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

export type PickupKind = 'cash' | 'stoken' | 'spin'; // spin: a spin token (src/gen/spin-tokens.ts)

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

// an act's escape set piece (GDD: How a run ends): which one, and where its scripted part is
export interface EscapeSite {
  kind: EscapeKind;
  act: number;
  x0: number; // the set piece starts here
  x1: number;
  chopperFrom?: number; // the helicopter joins the chase here
  covers: { x0: number; x1: number; y: number }[]; // L tracks overhead: the spotlight can't see under them
  chaseFrom?: number; // act 3's chaser joins here (src/sim/chaser.ts)
  drones?: { x: number; h: number }[]; // the drone swarm: where each drone hovers, and its roof above the street
}

export type EscapeKind = 'roadblock' | 'chopper' | 'chase' | 'drones' | 'finale';

export interface Level {
  layout: Layout;
  width: number;
  streetY: number; // the street surface
  street: boolean[]; // per column
  surfaces: Surface[];
  rails: CurvedRail[];
  cars: Car[];
  glass: Glass[];
  grass?: Glass[]; // strips of grass across the street (src/gen/grass.ts): worn wheels bog down on them
  startX: number;
  startY: number;
  finaleX: number; // where the street begins (after a descent); 0 for a street-only floor
  exitX: number;
  pickups: Pickup[];
  fork: ForkSite | null;
  danger: number; // traffic 1 (light) to 3 (rush hour)
  escape?: EscapeSite; // an escape floor
  props: Prop[]; // street props, scenery and smashables (src/gen/props.ts)
  crossings: Intersection[]; // cross streets with cross traffic (src/traffic/cross.ts)
  gravity?: number; // the district's gravity, a share of QFS's (BIOME_GRAVITY in src/physics/feel.ts); left out = 1
  busStops: BusStop[]; // where a bus pulls in (src/traffic/street.ts)
  doors: number[]; // cars parked in the back lane (their back end's x) whose door flies open across your lane as you come up
  bounty?: { x: number }; // a wanted poster's bounty (src/run/bounty.ts)
  tutorial?: { x: number; text: string }[]; // the tutorial floor's prompts (src/gen/tutorial.ts)
  currents?: { x0: number; x1: number; push: number }[]; // Atlantis: the water pushes you in the air (src/gen/twists.ts)
  ceiling?: { x0: number; x1: number; y: number }[]; // the Art Museum's low ceilings: their undersides
  el?: { x0: number; x1: number; y: number; under: number; trigger: number }[]; // the L over the street (src/traffic/el.ts)
  hills?: boolean; // the descent is a hillside you skate down (src/gen/hills.ts), not floating rooftops
  // every stretch of hill, px: the opening descent [0, finaleX] and the later ones between the street chases
  // (a cable car up from the street, then down again); left out = just the opening descent
  hillSpans?: [number, number][];
  flocks?: FlockSite[]; // pigeons on the top route (src/sim/sky.ts)
  chinatown?: [number, number][]; // Chinatown's blocks of hill, px (src/gen/hills.ts)
  hillCross?: { x: number; y: number }[]; // their intersections with cross traffic: the cross street's middle, the ground (src/traffic/hill-cross.ts)
  cabs?: CabRun[]; // their cab flats (src/traffic/cab.ts)
  sewers?: Sewer[]; // the sewer route under the street chases (src/gen/sewer.ts)
  skyMovers?: SkyMover[]; // the sky's moving set pieces (src/gen/sky-beats.ts, stepped by src/sim/sky.ts)
  busts?: SkyBust[]; // paper billboards across the lane up in the sky: skate through one and it bursts
}

// a sky set piece that moves (zack, 2026-10-31: "along with the set pieces"), px. x0..x1 and y are its deck as
// built: a blimp's back bobs on the air, a window washer's rig drops under you once you land on it (down to
// `floor`), a tower crane's jib swings out of the lane and back
export interface SkyMover {
  kind: 'blimp' | 'rig' | 'swing' | 'cloud' | 'balloon' | 'beam'; // cloud, balloon: up in the cloud layer (src/gen/clouds.ts)
  x0: number;
  x1: number;
  y: number;
  floor?: number; // rig: the lowest its deck sinks to
  phase?: number; // swing, beam: frames into its swing at the start of the floor
  mast?: number; // swing: the mast's x, what the jib slews round
}

// a paper billboard standing across the lane between two sky decks: top (y0) to bottom (y1), px
export interface SkyBust {
  x: number;
  y0: number;
  y1: number;
}

// a stretch of the sewer route, px: an open drain in the street drops you in, a tunnel runs under the street, and a
// storm outlet ramps you back up through a hole further on. y is the tunnel's floor; the street's underside is its roof
export interface Sewer {
  x0: number; // the tunnel's start (just before the drain)
  x1: number; // its end (the top of the outlet ramp)
  y: number;
  drain: [number, number]; // the open drain's hole in the street
  outlet: [number, number]; // the outlet's hole in the street, over the top of its ramp
  wet: [number, number][]; // stretches of runoff on the floor: rolling through one soaks the deck
}

// the sewer under x, if there is one
export function sewerAt(level: Level, x: number): Sewer | undefined {
  return level.sewers?.find((s) => x >= s.x0 && x < s.x1);
}

// the lowest your feet can go up at x in the sewer (a y), when you're down in it: the street's underside overhead,
// except under its holes. undefined up on the street, or with nothing overhead
export function sewerRoof(level: Level, x: number, y: number): number | undefined {
  const s = sewerAt(level, x);
  if (!s || x >= s.drain[0] && x < s.drain[1] || x >= s.outlet[0]) return undefined;
  const roof = level.streetY + SEWER_ROOF + PHYS.height;
  return y >= roof - 1 ? roof : undefined;
}
export const SEWER_ROOF = 12; // px: the street's thickness over the tunnel

// a Chinatown cab flat: where the cab waits rolling (its back), the ground's height, where it turns off and lets go
// (its front), and the kicker's lip just past that
export interface CabRun {
  x: number;
  y: number;
  turnX: number;
  lip: { x: number; y: number };
}

// on a stretch of hill (or the opening descent), not the street
export function inHill(level: Level, x: number): boolean {
  if (x < level.finaleX) return true;
  return (level.hillSpans ?? []).some(([a, b]) => x >= a && x < b);
}

// a pit on the hill: a crest jump's gap over a cross street (src/gen/hills.ts), as hillside.ts draws it. Its far
// side is a solid wall up to the lip (zack, 2026-10-28: come up short and you hit it, bail, and drop straight down);
// the cross street's road is its bottom, PIT.depth tiles under the lower lip
export interface Pit {
  x0: number; // px: the near lip's edge
  x1: number; // the far wall
  far: Surface; // the ground over the far wall
  lip: number; // y of the far lip
  floor: number; // y of the cross street down in it
}

export const PIT = {
  depth: 3.5, // tiles under the lower lip
  gap: [0.5, 8], // tiles: wider than this is a gap, narrower than this is the street chase between stretches of hill
  catch: 8, // px: the board comes up this little short of the far lip and you get up onto it anyway (like rolling onto a kerb)
} as const;

// the hill's ground, left to right: roofs, banks and stairways (not side lines, kickers or anything in the air)
export function hillGround(level: Level): Surface[] {
  return level.surfaces
    .filter((s) => inHill(level, s.x0) && !s.side && !s.kicker && !s.sky && !s.top && (s.kind === 'roof' || s.kind === 'bank' || s.kind === 'stairs'))
    .sort((a, b) => a.x0 - b.x0);
}

const PITS = new WeakMap<Level, { n: number; pits: Pit[] }>();

// every pit on the floor, left to right
export function pits(level: Level): Pit[] {
  const hit = PITS.get(level);
  if (hit && hit.n === level.surfaces.length) return hit.pits;
  const ground = hillGround(level);
  const out: Pit[] = [];
  for (let i = 1; i < ground.length; i++) {
    const [a, b] = [ground[i - 1], ground[i]];
    const w = (b.x0 - a.x1) / TILE;
    if (w <= PIT.gap[0] || w >= PIT.gap[1]) continue;
    out.push({ x0: a.x1, x1: b.x0, far: b, lip: b.y, floor: Math.max(a.y1 ?? a.y, b.y) + PIT.depth * TILE });
  }
  PITS.set(level, { n: level.surfaces.length, pits: out });
  return out;
}

// the pit x is over, if any
export function pitAt(level: Level, x: number): Pit | undefined {
  return pits(level).find((p) => x >= p.x0 && x <= p.x1);
}

const CAR_W = 2 * TILE;
const CAR_H = 40;
export const MANUAL_PAD_MAX = 3 * TILE; // the longest ledge that counts as a manual pad

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

  //manual pads: a short ledge with water under it is ridden in a manual, not just landed on
  for (const s of surfaces) {
    const mid = Math.floor((s.x0 + s.x1) / 2 / TILE);
    if (s.kind === 'ledge' && s.x1 - s.x0 <= MANUAL_PAD_MAX && !street[mid]) s.manual = true;
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
    props: [],
    crossings: [],
    busStops: [],
    doors: [],
  };
}

export function isStreetAt(level: Level, x: number): boolean {
  const c = Math.floor(x / TILE);
  return c >= 0 && c < level.street.length && level.street[c];
}

// the push of the current at x, if any
export function currentAt(level: Level, x: number): number {
  const cs = level.currents;
  if (!cs) return 0;
  for (const c of cs) if (x >= c.x0 && x < c.x1) return c.push;
  return 0;
}

// the lowest your feet can go up at x under a ceiling (a y), if there is one
export function ceilingAt(level: Level, x: number): number | undefined {
  const cs = level.ceiling;
  if (!cs) return undefined;
  for (const c of cs) if (x >= c.x0 && x < c.x1) return c.y + PHYS.height;
  return undefined;
}
