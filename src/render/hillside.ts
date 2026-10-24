// Chicago's San Francisco hillside and the foreground in front of the lane (docs/level-design-chicago.md).
//
// The hill (a level with `hills`): every piece of the descent is solid ground. Blocks of street fall away with their
// sidewalks following the slope, public stairways cut down between them, retaining walls drop to the next street,
// cross streets run back into the city at each flat crest, and painted row houses step down the hill behind.
//
// The foreground (every Chicago floor): the near sidewalk with a low wall along it, then two rows of row houses
// below the lane, stepping down toward the camera, so the bottom of the screen is always rooftops and facades
// instead of empty sky. They stay under the line from the camera to the skater's feet, so nothing hides the lane.
//
// Draw budget: the whole lot is four meshes (road, sidewalk, concrete, and the houses off one painted atlas), so
// a floor costs four draws plus its share of the kit's one merged outline.
import * as THREE from 'three';
import { TILE } from '../physics/constants';
import type { Level, Surface } from '../physics/level';
import { makeRng, randInt } from '../gen/rng';
import { pixelTexture } from './textures';

export const HILLSIDE = {
  bottom: -18, // how far down the ground and the houses' foundations go
  road: [-2.0, 2.5], // z: the road, the skate lane (z = 0.25) down its middle
  backWalk: -3.6, // z: the back sidewalk, from here to the road
  nearWalk: 4.0, // z: the near sidewalk, from the road to here
  curb: 0.12,
  wall: 0.35, // the low wall along the near sidewalk (under the camera's line to the lane at that distance)
  storey: 2, // tiles
  rowA: [4.35, 7.8, 1.1], // the first row of houses in front: z from, z to, roofs this far under the lane
  rowB: [8.4, 14.6, 3.9],
  backRow: [-3.6, -8.6], // houses behind the back sidewalk
  upRow: [-10.5, -15.5, 2.6], // a second row further up the hill, standing this much higher
  crossW: 3.2, // a cross street's width
  crossFar: -28, // how far back it runs
};

// ---------------------------------------------------------------------------------------------- the painted atlas

const PX = 16; // atlas pixels per tile
const AW = 512;
const AH = 128;
const FACADE = { w: 4 * PX, h: 6 * PX }; // three storeys

// body, trim, accent (door and garage): San Francisco's painted ladies
const PAINTS: [string, string, string][] = [
  ['#e8c86a', '#fff6e0', '#5a7a9a'],
  ['#9fd0c0', '#ffffff', '#a04050'],
  ['#b8a0d8', '#ffffff', '#4a3a6a'],
  ['#f0a088', '#fff4ea', '#3a5a7a'],
  ['#8ab8e0', '#ffffff', '#c06030'],
  ['#f2e6cf', '#7a5a40', '#2a4a3a'],
  ['#d86a6a', '#fff0e0', '#304050'],
  ['#8fae78', '#f0ead0', '#6a3a2a'],
];

type Rect = [number, number, number, number]; // px x, y, w, h in the atlas

const SWATCH = {
  siding: (i: number): Rect => [i * PX, FACADE.h, PX, PX],
  roof: (i: number): Rect => [[0, 6, 8][i % 3] * PX, FACADE.h + PX, 2 * PX, PX],
  trim: [2 * PX + 4, FACADE.h + PX + 4, 8, 8] as Rect,
  brick: [3 * PX, FACADE.h + PX, 2 * PX, PX] as Rect,
  dark: [5 * PX + 4, FACADE.h + PX + 4, 8, 8] as Rect,
};

const facadeRect = (i: number): Rect => [i * FACADE.w, 0, FACADE.w, FACADE.h];

let atlas: THREE.Texture | null = null;

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `#${c.getHexString()}`;
}

function paintFacade(g: CanvasRenderingContext2D, x0: number, [body, trim, accent]: [string, string, string], variant: number): void {
  const { w, h } = FACADE;
  g.fillStyle = body;
  g.fillRect(x0, 0, w, h);
  //clapboard siding
  g.fillStyle = shade(body, 0.86);
  for (let y = 2; y < h; y += 3) g.fillRect(x0, y, w, 1);
  //corner boards and the band between storeys
  g.fillStyle = trim;
  g.fillRect(x0, 0, 3, h);
  g.fillRect(x0 + w - 3, 0, 3, h);
  for (const y of [2 * PX - 2, 4 * PX - 2]) g.fillRect(x0, y, w, 3);
  //upper storeys: tall sash windows with hoods
  const wins = variant % 3 === 0 ? [8, 26, 44] : [10, 38];
  const ww = variant % 3 === 0 ? 12 : 16;
  for (const sy of [0, 2 * PX]) {
    for (const wx of wins) {
      const x = x0 + wx;
      const y = sy + 7;
      g.fillStyle = trim;
      g.fillRect(x - 2, y - 4, ww + 4, 3); // hood
      g.fillRect(x - 1, y - 1, ww + 2, 22);
      g.fillStyle = '#1a1424';
      g.fillRect(x, y, ww, 20);
      g.fillStyle = '#2f4468';
      g.fillRect(x + 1, y + 1, ww - 2, 18);
      g.fillStyle = '#6c8cc0'; // the sky in the glass
      g.fillRect(x + 2, y + 2, 2, 7);
      g.fillRect(x + 4, y + 2, 1, 4);
      g.fillStyle = trim;
      g.fillRect(x, y + 9, ww, 2); // the sash
    }
  }
  //street level: garage door on one side, the front door up two steps on the other
  const gy = 4 * PX + 4;
  const left = variant % 2 === 0;
  const gx = x0 + (left ? 6 : 30);
  g.fillStyle = '#1a1424';
  g.fillRect(gx - 1, gy - 1, 28, 27);
  g.fillStyle = shade(trim, 0.92);
  g.fillRect(gx, gy, 26, 26);
  g.fillStyle = shade(trim, 0.72);
  for (let y = gy + 5; y < gy + 26; y += 6) g.fillRect(gx, y, 26, 1);
  const dx = x0 + (left ? 42 : 10);
  g.fillStyle = '#1a1424';
  g.fillRect(dx - 1, gy - 1, 14, 25);
  g.fillStyle = accent;
  g.fillRect(dx, gy, 12, 24);
  g.fillStyle = shade(accent, 1.3);
  g.fillRect(dx + 2, gy + 3, 8, 7);
  g.fillStyle = '#ffe08a';
  g.fillRect(dx + 9, gy + 13, 2, 2);
  g.fillStyle = '#9a96a4'; // steps
  g.fillRect(dx - 3, h - 4, 18, 2);
  g.fillRect(dx - 5, h - 2, 22, 2);
}

function houseAtlas(): THREE.Texture {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = AW;
  c.height = AH;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  PAINTS.forEach((p, i) => {
    paintFacade(g, i * FACADE.w, p, i);
    //this house's plain siding, for its sides and its bay's sides
    const [sx, sy] = SWATCH.siding(i);
    g.fillStyle = p[0];
    g.fillRect(sx, sy, PX, PX);
    g.fillStyle = shade(p[0], 0.86);
    for (let y = sy + 2; y < sy + PX; y += 3) g.fillRect(sx, y, PX, 1);
  });
  //roofs: tar, pale gravel, red membrane, each with specks
  const ry = FACADE.h + PX;
  for (const [i, base, speck] of [[0, '#5a5464', '#6c6676'], [1, '#9a948a', '#b0aa9e'], [2, '#8a5a50', '#9e6a5e']] as const) {
    const [rx] = SWATCH.roof(i);
    g.fillStyle = base;
    g.fillRect(rx, ry, 2 * PX, PX);
    g.fillStyle = speck;
    for (let k = 0; k < 40; k++) g.fillRect(rx + ((k * 13) % (2 * PX)), ry + ((k * 7) % PX), 1, 1);
  }
  g.fillStyle = '#f4efe6';
  g.fillRect(2 * PX, ry, PX, PX); // trim
  const [bx, by] = SWATCH.brick;
  g.fillStyle = '#8a3e34';
  g.fillRect(bx, by, 2 * PX, PX);
  g.fillStyle = '#5a2620';
  for (let y = by + 3; y < by + PX; y += 4) g.fillRect(bx, y, 2 * PX, 1);
  g.fillStyle = '#2a2232';
  g.fillRect(5 * PX, ry, PX, PX); // dark: chimney caps, vents
  atlas = pixelTexture(c);
  return atlas;
}

// a tiling canvas texture, `w` x `h` tiles at 16 px a tile
function tiling(w: number, h: number, paint: (g: CanvasRenderingContext2D, W: number, H: number) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = w * PX;
  c.height = h * PX;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  paint(g, c.width, c.height);
  const t = pixelTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let mats: Record<'road' | 'walk' | 'concrete' | 'house', THREE.MeshLambertMaterial> | null = null;

function materials(): NonNullable<typeof mats> {
  if (mats) return mats;
  const [z0, z1] = HILLSIDE.road;
  //asphalt across the road's width, a double yellow down the skate lane, worn patches; 4 tiles long
  const road = tiling(4, 1, (g, W, H) => {
    g.fillStyle = '#3a3742';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#433f4c';
    for (let i = 0; i < 30; i++) g.fillRect((i * 23) % W, (i * 5) % H, 3, 1);
    const lane = Math.round(((0.25 - z0) / (z1 - z0)) * H);
    g.fillStyle = '#e8c040';
    g.fillRect(0, H - lane - 2, W, 1);
    g.fillRect(0, H - lane + 1, W, 1);
    g.fillStyle = '#d8d8de'; // the edge lines
    g.fillRect(0, 1, W, 1);
    g.fillRect(0, H - 2, W, 1);
  });
  const walk = tiling(1, 1, (g, W, H) => {
    g.fillStyle = '#a9a4b2';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#8e8998';
    g.fillRect(0, 0, W, 1);
    g.fillRect(0, 0, 1, H);
    g.fillStyle = '#b4afbd';
    g.fillRect(5, 6, 2, 1);
    g.fillRect(10, 11, 1, 1);
  });
  //board-formed concrete: retaining walls, stairways, foundations; 2 x 2 tiles
  const concrete = tiling(2, 2, (g, W, H) => {
    g.fillStyle = '#8c8794';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#7c7784';
    for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 1);
    g.fillStyle = '#6a6574';
    g.fillRect(W / 2, 0, 1, H);
    g.fillRect(0, 0, 1, H);
  });
  mats = {
    road: new THREE.MeshLambertMaterial({ map: road }),
    walk: new THREE.MeshLambertMaterial({ map: walk }),
    concrete: new THREE.MeshLambertMaterial({ map: concrete }),
    house: new THREE.MeshLambertMaterial({ map: houseAtlas() }),
  };
  return mats;
}

// ------------------------------------------------------------------------------------------------- geometry

type Key = 'road' | 'walk' | 'concrete' | 'house';
type V3 = [number, number, number];
type UvFn = (p: V3) => [number, number];

// world-space mappings for the tiling textures
const UV = {
  top: (su: number, sv: number, dz = 0): UvFn => (p) => [p[0] / su, (p[2] - dz) / sv],
  front: (su: number, sv: number): UvFn => (p) => [p[0] / su, p[1] / sv],
  side: (su: number, sv: number): UvFn => (p) => [p[2] / su, p[1] / sv],
};

// a face's corners mapped onto an atlas rect (a, b, c, d: bottom-left, bottom-right, top-right, top-left)
function rectUv([x, y, w, h]: Rect, sub: [number, number, number, number] = [0, 0, 1, 1]): [number, number][] {
  const u0 = (x + sub[0] * w) / AW;
  const u1 = (x + sub[2] * w) / AW;
  const v0 = 1 - (y + (1 - sub[1]) * h) / AH;
  const v1 = 1 - (y + (1 - sub[3]) * h) / AH;
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
}

export class Mesher {
  private parts = new Map<Key, { pos: number[]; nor: number[]; uv: number[] }>();

  // a quad, corners counter-clockwise seen from outside; uvs per corner or a mapping of positions
  quad(key: Key, a: V3, b: V3, c: V3, d: V3, uv: UvFn | [number, number][]): void {
    let part = this.parts.get(key);
    if (!part) this.parts.set(key, (part = { pos: [], nor: [], uv: [] }));
    const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2])).normalize();
    const uvs = typeof uv === 'function' ? [a, b, c, d].map(uv) : uv;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      part.pos.push(...[a, b, c, d][i]);
      part.nor.push(n.x, n.y, n.z);
      part.uv.push(...uvs[i]);
    }
  }

  // a box whose top may slope along x (t0 at x0, t1 at x1); faces left out with null
  box(x0: number, x1: number, bottom: number, t0: number, t1: number, z0: number, z1: number, faces: Partial<Record<'top' | 'front' | 'back' | 'left' | 'right', [Key, UvFn | [number, number][]] | null>>): void {
    const f = faces;
    if (f.top) this.quad(f.top[0], [x0, t0, z1], [x1, t1, z1], [x1, t1, z0], [x0, t0, z0], f.top[1]);
    if (f.front) this.quad(f.front[0], [x0, bottom, z1], [x1, bottom, z1], [x1, t1, z1], [x0, t0, z1], f.front[1]);
    if (f.back) this.quad(f.back[0], [x1, bottom, z0], [x0, bottom, z0], [x0, t0, z0], [x1, t1, z0], f.back[1]);
    if (f.right) this.quad(f.right[0], [x1, bottom, z1], [x1, bottom, z0], [x1, t1, z0], [x1, t1, z1], f.right[1]);
    if (f.left) this.quad(f.left[0], [x0, bottom, z0], [x0, bottom, z1], [x0, t0, z1], [x0, t0, z0], f.left[1]);
  }

  build(group: THREE.Group): void {
    const m = materials();
    for (const [key, part] of this.parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(part.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
      const mesh = new THREE.Mesh(geo, m[key].clone());
      mesh.name = `hillside-${key}`;
      group.add(mesh);
    }
  }
}

// --------------------------------------------------------------------------------------------- the ground line

interface Ground {
  x0: number; // tiles
  x1: number;
  t0: number; // height at x0, tiles over the street
  t1: number;
  kind: Surface['kind'];
}

const tx = (px: number) => px / TILE;

// the descent's ground, left to right in tiles: roofs, banks and hills (stairs are stepped separately)
function descentGround(level: Level): Ground[] {
  const h = (py: number) => (level.streetY - py) / TILE;
  return level.surfaces
    .filter((s) => s.x0 < level.finaleX && !s.side && (s.kind === 'roof' || s.kind === 'bank' || s.kind === 'stairs'))
    .map((s) => ({ x0: tx(s.x0), x1: tx(s.x1), t0: h(s.y), t1: h(s.y1 ?? s.y), kind: s.kind }))
    .sort((a, b) => a.x0 - b.x0);
}

// the lane's height at x (tiles): the descent's ground, a gap takes the lower edge, the street is 0
export function laneHeight(ground: Ground[], finale: number, x: number): number {
  if (x >= finale) return 0;
  let below = -Infinity;
  let after = Infinity;
  for (const g of ground) {
    if (x >= g.x0 && x <= g.x1) return g.t0 + ((x - g.x0) / (g.x1 - g.x0 || 1)) * (g.t1 - g.t0);
    if (g.x1 < x) below = g.t1;
    else if (g.x0 > x && after === Infinity) after = g.t0;
  }
  if (below === -Infinity) return after === Infinity ? 0 : after;
  return Math.min(below, after === Infinity ? 0 : after);
}

// the lowest the lane gets over [x0, x1]
function lowest(ground: Ground[], finale: number, x0: number, x1: number): number {
  return span(ground, finale, x0, x1)[0];
}

// the lowest and highest the lane gets over [x0, x1]
function span(ground: Ground[], finale: number, x0: number, x1: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let x = x0; x <= x1 + 1e-6; x += 0.5) {
    const h = laneHeight(ground, finale, x);
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  return [lo, hi];
}

// where a house in front tops out: under the lane, but partway up a slope rather than at its foot, so the rooftops
// step down the hill with it (the camera's line to the lane clears a little rise there)
function frontRoof(ground: Ground[], finale: number, x0: number, x1: number): number {
  const [lo, hi] = span(ground, finale, x0, x1);
  return lo + Math.min(0.6, 0.5 * (hi - lo));
}

// gaps in the descent's ground (tiles): crest jumps over a cross street
function gaps(ground: Ground[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 1; i < ground.length; i++) {
    const a = ground[i - 1];
    const b = ground[i];
    if (b.x0 - a.x1 > 0.5) out.push([a.x1, b.x0, Math.min(a.t1, b.t0)]);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the houses

interface HouseOpts {
  x0: number;
  x1: number;
  street: number; // the facade's street level (its garage door stands on it)
  bottom: number; // the foundation's foot
  z0: number;
  z1: number;
  facing: 1 | -1; // +1: the front faces the camera (+z); -1 is never used, kept for clarity
  paint: number;
  bay: boolean;
  chimney: boolean;
}

function house(m: Mesher, o: HouseOpts): void {
  const top = o.street + 3 * HILLSIDE.storey;
  const side = rectUv(SWATCH.siding(o.paint));
  const concrete: UvFn = UV.front(2, 2);
  //the facade, and its foundation down the hill
  m.quad('house', [o.x0, o.street, o.z1], [o.x1, o.street, o.z1], [o.x1, top, o.z1], [o.x0, top, o.z1], rectUv(facadeRect(o.paint)));
  if (o.street > o.bottom) m.box(o.x0, o.x1, o.bottom, o.street, o.street, o.z0, o.z1, { front: ['concrete', concrete], left: ['concrete', UV.side(2, 2)], right: ['concrete', UV.side(2, 2)] });
  //sides and roof
  m.box(o.x0, o.x1, o.street, top, top, o.z0, o.z1, { top: ['house', rectUv(SWATCH.roof(o.paint))], left: ['house', side], right: ['house', side] });
  //the cornice along the top of the front
  const trim = rectUv(SWATCH.trim);
  m.box(o.x0 - 0.06, o.x1 + 0.06, top - 0.12, top + 0.22, top + 0.22, o.z1 - 0.05, o.z1 + 0.22, { top: ['house', trim], front: ['house', trim], left: ['house', trim], right: ['house', trim] });
  //a bay window out over the street on the upper storeys
  if (o.bay) {
    const w = o.x1 - o.x0;
    const bw = Math.min(2, w * 0.55);
    const bx = o.x0 + (w - bw) * (o.paint % 2 ? 0.25 : 0.75);
    const y0 = o.street + HILLSIDE.storey + 0.15;
    const y1 = top - 0.3;
    const f = facadeRect(o.paint);
    const s0 = (bx - o.x0) / w;
    const s1 = (bx + bw - o.x0) / w;
    m.quad('house', [bx, y0, o.z1 + 0.42], [bx + bw, y0, o.z1 + 0.42], [bx + bw, y1, o.z1 + 0.42], [bx, y1, o.z1 + 0.42], rectUv(f, [s0, (y0 - o.street) / (top - o.street), s1, (y1 - o.street) / (top - o.street)]));
    m.box(bx, bx + bw, y0, y1, y1, o.z1, o.z1 + 0.42, { top: ['house', trim], left: ['house', side], right: ['house', side] });
    m.quad('house', [bx, y0, o.z1], [bx + bw, y0, o.z1], [bx + bw, y0, o.z1 + 0.42], [bx, y0, o.z1 + 0.42], trim); // its underside
  }
  //a roof hatch or an air unit up top, now and then
  if (o.chimney && o.paint % 2) {
    const ux = o.x1 - 1.3;
    const uz = o.z0 + 0.6;
    const trim2 = rectUv(SWATCH.trim);
    m.box(ux, ux + 0.8, top, top + 0.35, top + 0.35, uz, uz + 0.6, { top: ['house', rectUv(SWATCH.dark)], front: ['house', trim2], left: ['house', trim2], right: ['house', trim2] });
  }
  if (o.chimney) {
    const cx = o.x0 + 0.5;
    const cz = (o.z0 + o.z1) / 2;
    const brick = rectUv(SWATCH.brick);
    m.box(cx, cx + 0.45, top, top + 0.6, top + 0.6, cz - 0.25, cz + 0.25, { top: ['house', rectUv(SWATCH.dark)], front: ['house', brick], back: ['house', brick], left: ['house', brick], right: ['house', brick] });
  }
}

// a row of houses from x0 to x1 (tiles), each stood at `street(xa, xb)`, skipping the cut ranges
function houseRow(m: Mesher, rng: () => number, x0: number, x1: number, z0: number, z1: number, street: (xa: number, xb: number) => number, foot: (xa: number, xb: number) => number, cut: (xa: number, xb: number) => boolean, extras: { bay: number; chimney: number }): void {
  for (let x = x0; x < x1; ) {
    const w = 3 + randInt(rng, 3) * 0.75;
    if (cut(x, x + w)) {
      x += 0.5;
      continue;
    }
    const s = street(x, x + w);
    house(m, { x0: x, x1: x + w, street: s, bottom: Math.min(s, foot(x, x + w)), z0, z1, facing: 1, paint: randInt(rng, PAINTS.length), bay: rng() < extras.bay, chimney: rng() < extras.chimney });
    x += w;
  }
}

// ------------------------------------------------------------------------------------------------ the hill

// the descent as solid hill: road, sidewalks and stairways on ground that goes all the way down, row houses behind,
// cross streets back into the city at the crests and under the crest jumps
export function buildHill(level: Level, group: THREE.Group): void {
  const m = new Mesher();
  const ground = descentGround(level);
  const finale = tx(level.finaleX);
  const B = HILLSIDE.bottom;
  const [rz0, rz1] = HILLSIDE.road;
  const back = HILLSIDE.backWalk;
  const near = HILLSIDE.nearWalk;
  const c = HILLSIDE.curb;
  const cs = UV.side(2, 2);
  const cf = UV.front(2, 2);
  //the street section across one piece of ground: sidewalk, road, sidewalk, retaining walls at its ends
  const section = (x0: number, x1: number, t0: number, t1: number) => {
    m.box(x0, x1, B, t0, t1, rz0, rz1, { top: ['road', UV.top(4, rz1 - rz0, rz0)], left: ['concrete', cs], right: ['concrete', cs] });
    m.box(x0, x1, B, t0 + c, t1 + c, back, rz0, { top: ['walk', UV.top(1, 1)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
    m.box(x0, x1, B, t0 + c, t1 + c, rz1, near, { top: ['walk', UV.top(1, 1)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
  };
  const crossings: [number, number, number][] = []; // x0, x1, height: cross streets at the crests
  ground.forEach((g, i) => {
    if (g.kind === 'stairs') {
      //a public stairway the width of the street, one block per step
      const steps = Math.round(g.x1 - g.x0);
      for (let k = 0; k < steps; k++) {
        const t = g.t0 + ((g.t1 - g.t0) * (k + 1)) / steps;
        m.box(g.x0 + k, g.x0 + k + 1, B, t, t, back, near, { top: ['walk', UV.top(1, 1)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
      }
      return;
    }
    section(g.x0, g.x1, g.t0, g.t1);
    //a flat crest between two blocks is an intersection: its cross street runs back up into the city
    const prev = ground[i - 1];
    if (g.kind === 'roof' && prev && prev.kind !== 'roof' && g.x1 - g.x0 >= 5 && g.t0 > 0.5) {
      const cx = (g.x0 + g.x1) / 2;
      crossings.push([cx - HILLSIDE.crossW / 2, cx + HILLSIDE.crossW / 2, g.t0]);
    }
  });
  //the cross streets: flat roads back into the city with their kerbs
  for (const [x0, x1, t] of crossings) {
    m.box(x0, x1, B, t, t, HILLSIDE.crossFar, back, { top: ['road', (p) => [p[2] / 4, (p[0] - x0) / (x1 - x0)]], left: ['concrete', cs], right: ['concrete', cs] });
    for (const [a, b] of [[x0 - 0.7, x0], [x1, x1 + 0.7]]) m.box(a, b, B, t + c, t + c, HILLSIDE.crossFar, back, { top: ['walk', UV.top(1, 1)] });
  }
  //under each crest jump, the cross street it clears, running from the city behind to the camera
  const holes = gaps(ground);
  for (const [x0, x1, t] of holes) {
    const low = t - 3.5;
    m.box(x0, x1, B, low, low, HILLSIDE.crossFar, HILLSIDE.rowB[1], { top: ['road', (p) => [p[2] / 4, (p[0] - x0) / (x1 - x0)]] });
  }
  const cut = (xa: number, xb: number) => [...crossings, ...holes].some(([a, b]) => xb > a - 0.1 && xa < b + 0.1);
  //row houses stepping down the hill behind the back sidewalk, and a row further up it
  const rng = makeRng(level.layout.seed * 53 + level.layout.floor * 7);
  const end = finale + 1;
  const lane = (x: number) => laneHeight(ground, finale, x);
  const [bz0, bz1] = HILLSIDE.backRow;
  houseRow(m, rng, -8, end, bz1, bz0, (a, b) => lane((a + b) / 2) + c, (a, b) => lowest(ground, finale, a, b) - 0.5, cut, { bay: 0.75, chimney: 0 });
  const [uz1, uz0, up] = HILLSIDE.upRow;
  houseRow(m, rng, -8, end, uz0, uz1, (a, b) => lane((a + b) / 2) + up, () => B, cut, { bay: 0.6, chimney: 0.3 });
  m.build(group);
}

// ------------------------------------------------------------------------------------------- the foreground

// the near side for a whole floor (descent and street): the near sidewalk and its low wall, then two rows of houses
// below the lane stepping down toward the camera
export function buildForeground(level: Level, group: THREE.Group): void {
  const m = new Mesher();
  const ground = level.hills ? descentGround(level) : [];
  const finale = tx(level.finaleX);
  const cols = level.street.length;
  const B = HILLSIDE.bottom;
  const near = HILLSIDE.nearWalk;
  const c = HILLSIDE.curb;
  const cs = UV.side(2, 2);
  const cf = UV.front(2, 2);
  const holes = gaps(ground);
  //where there's no ground in front: canals on the street, the crest jumps' cross streets on the hill
  const open = (x0: number, x1: number) => holes.some(([a, b]) => x1 > a - 0.1 && x0 < b + 0.1);
  //the street's near sidewalk and the low wall (the hill's sidewalk is part of buildHill; its wall is here)
  let x = level.hills ? Math.floor(finale) : Math.max(0, Math.floor(finale));
  while (x < cols) {
    if (!level.street[x]) {
      x++;
      continue;
    }
    let e = x;
    while (e + 1 < cols && level.street[e + 1]) e++;
    m.box(x, e + 1, B, c, c, HILLSIDE.road[1], near, { top: ['walk', UV.top(1, 1)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
    x = e + 1;
  }
  //the low wall: along the hill's sidewalk (following it) and the street's
  const wz0 = near - 0.22;
  const wall = (x0: number, x1: number, t0: number, t1: number) =>
    m.box(x0, x1, Math.min(t0, t1) - 0.3, t0 + c + HILLSIDE.wall, t1 + c + HILLSIDE.wall, wz0, near + 0.02, { top: ['concrete', UV.top(2, 2)], front: ['concrete', cf], back: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
  for (const g of ground) {
    if (g.kind === 'stairs') {
      const steps = Math.round(g.x1 - g.x0);
      for (let k = 0; k < steps; k++) {
        const t = g.t0 + ((g.t1 - g.t0) * (k + 1)) / steps;
        wall(g.x0 + k, g.x0 + k + 1, t, t);
      }
    } else wall(g.x0, g.x1, g.t0, g.t1);
  }
  for (let s = Math.max(0, Math.floor(finale)); s < cols; ) {
    if (!level.street[s]) {
      s++;
      continue;
    }
    let e = s;
    while (e + 1 < cols && level.street[e + 1]) e++;
    wall(s, e + 1, 0, 0);
    s = e + 1;
  }
  //two rows of houses below the lane, each roofline stepping down with the lowest lane over it
  const rng = makeRng(level.layout.seed * 67 + level.layout.floor * 13);
  const low = (a: number, b: number) => frontRoof(ground, finale, a, b);
  const [az0, az1, adrop] = HILLSIDE.rowA;
  const [bz0, bz1, bdrop] = HILLSIDE.rowB;
  const storeys = 3 * HILLSIDE.storey;
  houseRow(m, rng, -10, cols + 24, az0, az1, (a, b) => low(a, b) - adrop - storeys, () => B, open, { bay: 0.7, chimney: 0.35 });
  houseRow(m, rng, -10, cols + 24, bz0, bz1, (a, b) => low(a, b) - bdrop - storeys, () => B, open, { bay: 0.6, chimney: 0.3 });
  m.build(group);
}
