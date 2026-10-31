// The hill's street trees (zack, 2026-10-31: "we need some better low poly trees. two types palm and normal"), after
// his two refs: a leafy street tree of alpha-card leaf clusters round a curved, forking trunk, and curved palms with
// ringed trunks and striped, drooping fronds. Every tree is built from the floor's rng, so no two match, from a few
// presets of size and lean (TREES).
//
// The ink look: trunks, branches, the canopy's core and the coconuts are solid and get the usual outline; the leaf
// clusters and fronds are cut-out cards with their ink painted round every leaf, since an inverted hull round a flat
// card is just a black card. The cards' normals point out from the canopy's middle, so the toon bands shade the
// whole crown as one round shape instead of a hundred flat ones.
//
// Draw budget: one atlas, two materials (solid and cut-out) shared by every tree. A tree is two plain meshes, so the
// kit's batchStatic merges all of a floor's trees into two draws (cheaper than an instanced mesh per variant), plus
// their share of the kit's one merged outline. The cut-out material's shader is warmed on the loading screen by a
// stand-in in each kit (treeWarm).
import * as THREE from 'three';
import { pixelTexture } from './textures';
import { toon } from './toon';
import { warmMesh } from './shader-keep';

export type TreeKind = 'palm' | 'leafy';

// size and lean presets (tiles). h: height of the crown, lean: how far the top leans off the base, r: the leafy
// canopy's radius; each tree picks within the ranges
export const TREES = {
  palm: {
    tall: { h: [7.6, 9.4], lean: [0.8, 1.6], fronds: 12 },
    bent: { h: [5.0, 5.8], lean: [1.6, 2.3], fronds: 11 },
    short: { h: [4.0, 5.0], lean: [0.3, 0.9], fronds: 10 },
  },
  leafy: {
    small: { h: [3.4, 4.0], r: [1.2, 1.4], lean: [0, 0.3] },
    round: { h: [4.2, 5.0], r: [1.6, 1.9], lean: [0.1, 0.5] },
    big: { h: [5.6, 6.8], r: [2.0, 2.4], lean: [0.2, 0.6] },
  },
} as const;
export type PalmSize = keyof typeof TREES.palm;
export type LeafySize = keyof typeof TREES.leafy;

// ------------------------------------------------------------------------------------------------------ the atlas

const AW = 256;
const AH = 256;
type Rect = [number, number, number, number]; // px x, y, w, h

const CELL = {
  leaf: (i: number): Rect => [i * 64, 0, 64, 64], // four leaf clusters
  frond: (i: number): Rect => [0, 64 + i * 32, 256, 32], // two fronds, base at the left, tip at the right
  palmBark: [0, 128, 32, 64] as Rect,
  bark: [32, 128, 32, 64] as Rect,
  core: [68, 132, 8, 8] as Rect, // the canopy's solid core
  nut: [84, 132, 8, 8] as Rect,
  stem: [100, 132, 8, 8] as Rect, // frond stems where they meet the crown
  bush: (i: number): Rect => [128 + i * 64, 128, 64, 64], // two sets of pixel leaf chips
  flower: [72, 152, 24, 24] as Rect,
  bushCore: [116, 132, 8, 8] as Rect,
};

const INK = '#1a1424';

function paintLeaves(g: CanvasRenderingContext2D, [x0, y0, w, h]: Rect, seed: number): void {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const leaves: [number, number, number, number, number][] = [];
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  for (let k = 0; k < 70; k++) {
    //packed toward the middle, ragged at the edge
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * (w / 2 - 11);
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.9;
    leaves.push([x, y, a + (rnd() - 0.5) * 1.2, 3.2 + rnd() * 1.6, rnd()]);
  }
  //twigs, then every leaf in ink a pixel fatter, then the leaves: ink round each leaf and the cluster's edge
  g.strokeStyle = INK;
  g.lineWidth = 1.5;
  for (let k = 0; k < 5; k++) {
    const a = rnd() * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx, cy + 4);
    g.lineTo(cx + Math.cos(a) * (w / 2 - 18), cy + Math.sin(a) * (h / 2 - 18));
    g.stroke();
  }
  const leaf = (x: number, y: number, a: number, l: number, grow: number) => {
    g.beginPath();
    g.ellipse(x, y, l + grow, l * 0.5 + grow, a, 0, Math.PI * 2);
    g.fill();
  };
  g.fillStyle = INK;
  for (const [x, y, a, l] of leaves) leaf(x, y, a, l, 1.1);
  const greens = ['#b2e47a', '#8ccf5e', '#68b04a', '#4a8e3c'];
  for (const [x, y, a, l, t] of leaves) {
    //lighter toward the top of the cluster, the odd dark leaf in among them
    const up = 1 - (y - y0) / h;
    const i = t < 0.15 ? 3 : Math.min(3, Math.max(0, Math.round((1 - up) * 2.4 + (t - 0.5))));
    g.fillStyle = greens[i];
    leaf(x, y, a, l, 0);
    if (i < 2 && t > 0.6) {
      g.fillStyle = '#c6ee8a';
      leaf(x - Math.cos(a) * 0.8, y - Math.sin(a) * 0.8 - 0.6, a, l * 0.45, 0);
    }
  }
  //a few pink blossoms, as in the ref
  for (let k = 0; k < 5; k++) {
    const [x, y] = leaves[Math.floor(rnd() * leaves.length)];
    g.fillStyle = INK;
    g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4);
    g.fillStyle = '#f2a6c0';
    g.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
}

// a frond along the cell: a midrib with leaflets swept toward the tip, in alternating stripes (the ref's look)
function paintFrond(g: CanvasRenderingContext2D, [x0, y0, w, h]: Rect, stripes: [string, string], ribColour: string): void {
  const cy = y0 + h / 2;
  const span = (t: number) => (h / 2 - 1.5) * (t < 0.25 ? 0.55 + 1.8 * t : 1 - (0.8 * (t - 0.25)) / 0.75);
  const leaflets: [number, number, number, number, number][] = [];
  for (let x = x0 + 12, i = 0; x < x0 + w - 4; x += 6, i++) {
    const t = (x - x0) / w;
    const l = span(t);
    for (const side of [-1, 1]) leaflets.push([x, cy, x + l * 0.9, cy + side * l, i]);
  }
  const strokes = (width: number, colour: (i: number) => string) => {
    g.lineCap = 'round';
    g.lineWidth = width;
    for (const [ax, ay, bx, by, i] of leaflets) {
      g.strokeStyle = colour(i);
      g.beginPath();
      g.moveTo(ax, ay);
      g.quadraticCurveTo((ax + bx) / 2 + 1, (ay + by) / 2 + (by > ay ? -1 : 1), bx, by);
      g.stroke();
    }
  };
  //the rib: a tapering line, in ink then its own colour
  const rib = (width: number, colour: string) => {
    g.fillStyle = colour;
    g.beginPath();
    g.moveTo(x0, cy - width / 2);
    g.lineTo(x0 + w - 2, cy - 0.4);
    g.lineTo(x0 + w - 2, cy + 0.4);
    g.lineTo(x0, cy + width / 2);
    g.fill();
  };
  strokes(3.6, () => INK);
  rib(4.5, INK);
  strokes(1.8, (i) => stripes[Math.floor(i / 2) % 2]);
  rib(2, ribColour);
}

// a bush's leaves after zack's ref: hard-edged pixel chips of green over a dark ink-green, cream four-petal flowers
// with gold middles scattered on top. Integer rects only, so it stays crisp pixel art.
function paintBush(g: CanvasRenderingContext2D, [x0, y0, w, h]: Rect, seed: number): void {
  let s = seed * 7919 + 13;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  const R = w / 2 - 4;
  const inside = (x: number, y: number, r: number) => (x - cx) ** 2 + (y - cy) ** 2 < r * r;
  //chips in rings from the dark rim inward; the edge chips stick out ragged
  const greens = ['#1e4a24', '#2f6e2c', '#3f8f34', '#56ad3c', '#7ccc4a'];
  for (let pass = 0; pass < greens.length; pass++) {
    const n = pass === 0 ? 130 : 110;
    for (let k = 0; k < n; k++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * R * (pass === 0 ? 1.02 : 0.96);
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      //lighter chips favour the top left, where the light comes from
      if (pass >= 3 && (x - cx) + (y - cy) > R * (pass === 4 ? -0.1 : 0.5) * (0.6 + rnd())) continue;
      const [cw, ch] = rnd() < 0.5 ? [4 + Math.floor(rnd() * 3), 2 + Math.floor(rnd() * 2)] : [2 + Math.floor(rnd() * 2), 4 + Math.floor(rnd() * 3)];
      if (!inside(x, y, R + 2)) continue;
      g.fillStyle = greens[pass];
      g.fillRect(x - (cw >> 1), y - (ch >> 1), cw, ch);
    }
  }
}

// one flower, as in the ref: a plus of cream petals round a gold middle, on a 2 px grid, inked a cell round
function paintFlower(g: CanvasRenderingContext2D, [x0, y0, w, h]: Rect): void {
  const px = (x: number, y: number, pw: number, ph: number) => g.fillRect(x0 + w / 2 + x * 2, y0 + h / 2 + y * 2, pw * 2, ph * 2);
  g.fillStyle = INK;
  px(-5, -2, 10, 4);
  px(-2, -5, 4, 10);
  px(-4, -4, 8, 8);
  g.fillStyle = '#f6e8bc';
  px(-4, -1, 8, 2);
  px(-1, -4, 2, 8);
  px(-3, -3, 6, 6);
  g.fillStyle = '#fff8e0';
  px(-4, -1, 1, 1);
  px(-1, -4, 1, 1);
  px(-3, -3, 1, 1);
  g.fillStyle = '#d8a83a';
  px(-1, -1, 2, 2);
}

let atlas: THREE.Texture | null = null;

function treeAtlas(): THREE.Texture {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = AW;
  c.height = AH;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 4; i++) paintLeaves(g, CELL.leaf(i), i + 1);
  paintFrond(g, CELL.frond(0), ['#e6ee5c', '#8cba3a'], '#f4f0a0');
  paintFrond(g, CELL.frond(1), ['#b4d448', '#6a9c30'], '#d8e080');
  //the palm's trunk: rings of old frond bases, dark under each, a light lip over it
  {
    const [x, y, w, h] = CELL.palmBark;
    g.fillStyle = '#9a7048';
    g.fillRect(x, y, w, h);
    for (let ry = y; ry < y + h; ry += 8) {
      g.fillStyle = '#5a3a24';
      g.fillRect(x, ry + 5, w, 3);
      g.fillStyle = '#c09468';
      g.fillRect(x, ry + 4, w, 1);
      g.fillStyle = '#7e5a3a';
      for (let k = 0; k < w; k += 6) g.fillRect(x + k + ((ry / 8) % 2) * 3, ry + 1, 2, 3);
    }
  }
  //the street tree's bark: grey brown with streaks
  {
    const [x, y, w, h] = CELL.bark;
    g.fillStyle = '#76604e';
    g.fillRect(x, y, w, h);
    for (let k = 0; k < 14; k++) {
      g.fillStyle = k % 3 ? '#5a4638' : '#927a64';
      g.fillRect(x + ((k * 7) % w), y + ((k * 13) % h), 1, 6 + (k % 4) * 3);
    }
  }
  const swatch = ([x, y, w, h]: Rect, colour: string) => {
    g.fillStyle = colour;
    g.fillRect(x - 4, y - 4, w + 8, h + 8);
  };
  swatch(CELL.core, '#4e8e3e');
  swatch(CELL.nut, '#6a4a28');
  swatch(CELL.stem, '#8a7a3a');
  swatch(CELL.bushCore, '#2a5e2a');
  paintBush(g, CELL.bush(0), 3);
  paintBush(g, CELL.bush(1), 5);
  paintFlower(g, CELL.flower);
  atlas = pixelTexture(c);
  return atlas;
}

// u, v of a point in a cell (a, b from 0 to 1; b up)
function uvAt([x, y, w, h]: Rect, a: number, b: number): [number, number] {
  return [(x + a * w) / AW, 1 - (y + (1 - b) * h) / AH];
}

let mats: { solid: THREE.MeshToonMaterial; cut: THREE.MeshToonMaterial } | null = null;

// shared by every tree, so the kit's batch merges them
function materials(): NonNullable<typeof mats> {
  if (mats) return mats;
  const map = treeAtlas();
  mats = {
    solid: toon({ map }),
    cut: toon({ map, alphaTest: 0.5, side: THREE.DoubleSide }),
  };
  mats.solid.name = 'treeSolid';
  mats.cut.name = 'treeCut';
  return mats;
}

// a stand-in drawing with the cut-out material, so the loading screen compiles its shader even on a floor without
// trees (kept out of the kit's batch)
export function treeWarm(): THREE.Mesh {
  const m = warmMesh(materials().cut);
  m.userData.keep = true;
  m.userData.inked = true;
  return m;
}

// ------------------------------------------------------------------------------------------------ the geometry

type V = THREE.Vector3;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

class Geo {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];

  tri(p: V[], n: V[], uv: [number, number][]): void {
    for (let i = 0; i < 3; i++) {
      this.pos.push(p[i].x, p[i].y, p[i].z);
      this.nor.push(n[i].x, n[i].y, n[i].z);
      this.uv.push(...uv[i]);
    }
  }

  // corners counter-clockwise from outside: a, b, c, d
  quad(p: V[], n: V[], uv: [number, number][]): void {
    this.tri([p[0], p[1], p[2]], [n[0], n[1], n[2]], [uv[0], uv[1], uv[2]]);
    this.tri([p[0], p[2], p[3]], [n[0], n[2], n[3]], [uv[0], uv[2], uv[3]]);
  }

  geometry(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    return geo;
  }
}

const SIDES = 6;

// a tapered tube through points, radius r0 at the first and r1 at the last, the cell wrapped round it once a
// `repeat` tiles of length
function tube(g: Geo, pts: V[], r0: number, r1: number, cell: Rect, repeat: number, flare = 0): void {
  const rings: V[][] = [];
  const norms: V[][] = [];
  let side = v3(1, 0, 0);
  pts.forEach((p, i) => {
    const t = pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)]).normalize();
    side = side.clone().sub(t.clone().multiplyScalar(side.dot(t))).normalize();
    const fwd = t.clone().cross(side).normalize();
    const u = i / (pts.length - 1);
    const r = (r0 + (r1 - r0) * u) * (1 + flare * Math.max(0, 1 - u * 6) ** 2);
    const ring: V[] = [];
    const nr: V[] = [];
    for (let k = 0; k < SIDES; k++) {
      const a = (k / SIDES) * Math.PI * 2;
      const n = side.clone().multiplyScalar(Math.cos(a)).add(fwd.clone().multiplyScalar(Math.sin(a)));
      ring.push(p.clone().add(n.clone().multiplyScalar(r)));
      nr.push(n);
    }
    rings.push(ring);
    norms.push(nr);
  });
  for (let i = 0; i + 1 < pts.length; i++) {
    //each segment maps onto the cell from its foot (the atlas can't wrap), as much of it as the segment is long
    const bot = 0;
    const top = Math.min(1, pts[i].distanceTo(pts[i + 1]) / repeat);
    for (let k = 0; k < SIDES; k++) {
      const k1 = (k + 1) % SIDES;
      const [u0, u1] = [k / SIDES, (k + 1) / SIDES];
      g.quad(
        [rings[i][k], rings[i][k1], rings[i + 1][k1], rings[i + 1][k]],
        [norms[i][k], norms[i][k1], norms[i + 1][k1], norms[i + 1][k]],
        [uvAt(cell, u0, bot), uvAt(cell, u1, bot), uvAt(cell, u1, top), uvAt(cell, u0, top)],
      );
    }
  }
}

// points along a quadratic curve from a to c, bowed toward b
function curve(a: V, b: V, c: V, n: number): V[] {
  const out: V[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(a.clone().multiplyScalar((1 - t) ** 2).add(b.clone().multiplyScalar(2 * (1 - t) * t)).add(c.clone().multiplyScalar(t * t)));
  }
  return out;
}

// a low-poly lump (an icosahedron, its corners nudged), solid, in one colour
function lump(g: Geo, c: V, r: V, cell: Rect, rng: () => number, detail = 0): void {
  const ico = new THREE.IcosahedronGeometry(1, detail);
  const p = ico.getAttribute('position');
  const jitter = new Map<string, V>();
  const at = (i: number) => {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let j = jitter.get(key);
    if (!j) jitter.set(key, (j = v3(p.getX(i), p.getY(i), p.getZ(i)).multiplyScalar(0.85 + rng() * 0.3)));
    return v3(c.x + j.x * r.x, c.y + j.y * r.y, c.z + j.z * r.z);
  };
  const uv = uvAt(cell, 0.5, 0.5);
  for (let i = 0; i < p.count; i += 3) {
    const t = [at(i), at(i + 1), at(i + 2)];
    const n = t[1].clone().sub(t[0]).cross(t[2].clone().sub(t[0])).normalize();
    g.tri(t, [n, n, n], [uv, uv, uv]);
  }
  ico.dispose();
}

// a card of leaves centred on p, facing roughly `face`, `s` across, its normals pointing out from the crown's
// middle `mid` (squashed by `r` so the crown shades as an ellipsoid)
function card(g: Geo, p: V, face: V, s: number, roll: number, cell: Rect, mid: V, r: V, flip: boolean): void {
  const f = face.clone().normalize();
  const helper = Math.abs(f.y) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0);
  const right = helper.clone().cross(f).normalize();
  const up = f.clone().cross(right).normalize();
  const [cr, sr] = [Math.cos(roll), Math.sin(roll)];
  const a = right.clone().multiplyScalar(cr).add(up.clone().multiplyScalar(sr)).multiplyScalar(s / 2);
  const b = up.clone().multiplyScalar(cr).sub(right.clone().multiplyScalar(sr)).multiplyScalar(s / 2);
  const corners = [p.clone().sub(a).sub(b), p.clone().add(a).sub(b), p.clone().add(a).add(b), p.clone().sub(a).add(b)];
  const normal = (q: V) => {
    const d = q.clone().sub(mid);
    return v3(d.x / (r.x * r.x), d.y / (r.y * r.y) + 0.25, d.z / (r.z * r.z)).normalize();
  };
  const uv: [number, number][] = flip ? [uvAt(cell, 1, 0), uvAt(cell, 0, 0), uvAt(cell, 0, 1), uvAt(cell, 1, 1)] : [uvAt(cell, 0, 0), uvAt(cell, 1, 0), uvAt(cell, 1, 1), uvAt(cell, 0, 1)];
  g.quad(corners, corners.map(normal), uv);
}

const pick = (rng: () => number, [a, b]: readonly [number, number]) => a + rng() * (b - a);

// which way a tree leans: mostly along the street (across the screen), a little toward the road
function leanDir(rng: () => number): V {
  const a = (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.9;
  return v3(Math.cos(a), 0, Math.abs(Math.sin(a)) * 0.6 + 0.15).normalize();
}

// a palm, its foot at the origin
export function palm(rng: () => number, size: PalmSize): { solid: THREE.BufferGeometry; cut: THREE.BufferGeometry } {
  const P = TREES.palm[size];
  const h = pick(rng, P.h);
  const lean = leanDir(rng).multiplyScalar(pick(rng, P.lean));
  const solid = new Geo();
  const cut = new Geo();
  //the trunk bows: out at the foot, then curving back up (the ref's lazy S)
  const top = v3(lean.x, h, lean.z);
  const bow = v3(lean.x * 0.15, h * 0.55, lean.z * 0.15);
  const pts = curve(v3(0, -0.3, 0), bow, top, 10);
  tube(solid, pts, 0.2, 0.13, CELL.palmBark, 0.75, 0.6);
  //the crown: frond stems in a knob, coconuts under it
  lump(solid, top.clone().add(v3(0, 0.05, 0)), v3(0.26, 0.22, 0.26), CELL.stem, rng);
  for (let i = 0; i < 3; i++) {
    const a = rng() * Math.PI * 2;
    lump(solid, top.clone().add(v3(Math.cos(a) * 0.17, -0.18 - rng() * 0.08, Math.sin(a) * 0.17)), v3(0.11, 0.12, 0.11), CELL.nut, rng);
  }
  //the fronds: up out of the crown and drooping under their weight, each folded down its rib
  const n = P.fronds;
  const tilt = lean.clone().normalize();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.5;
    const dir = v3(Math.cos(a), 0, Math.sin(a));
    //fronds on the side the palm leans toward reach further and droop less
    const out = 1 + dir.dot(tilt) * 0.15;
    //a ring of fronds arching out and over, and every other one under them hanging lower (the ref's shaggy crown)
    const low = i % 2 === 1;
    const len = (h > 6.5 ? 2.9 : 2.4) * out * (0.85 + rng() * 0.3) * (low ? 0.9 : 1);
    const rise = low ? -0.1 + rng() * 0.3 : 0.55 + rng() * 0.5;
    const droop = low ? 0.55 + rng() * 0.3 : 1.0 + rng() * 0.4;
    const w = 0.55 * (len / 2.6);
    const across = v3(-dir.z, 0, dir.x);
    const cell = CELL.frond(rng() < 0.3 ? 1 : 0);
    const segs = 5;
    const spine: V[] = [];
    for (let j = 0; j <= segs; j++) {
      const s = j / segs;
      spine.push(top.clone().add(dir.clone().multiplyScalar(len * s)).add(v3(0, len * (rise * s - droop * s * s), 0)));
    }
    const fold = 0.14;
    for (let j = 0; j < segs; j++) {
      const [p0, p1] = [spine[j], spine[j + 1]];
      const [s0, s1] = [j / segs, (j + 1) / segs];
      const edge = (p: V, side: number) => p.clone().add(across.clone().multiplyScalar(side * w)).add(v3(0, -fold, 0));
      const nUp = v3(dir.x * 0.4, 1, dir.z * 0.4).normalize();
      for (const side of [-1, 1]) {
        const q = side < 0 ? [edge(p0, -1), edge(p1, -1), p1, p0] : [p0, p1, edge(p1, 1), edge(p0, 1)];
        const vv = side < 0 ? [0, 0, 0.5, 0.5] : [0.5, 0.5, 1, 1];
        cut.quad(q, [nUp, nUp, nUp, nUp], [uvAt(cell, s0, vv[0]), uvAt(cell, s1, vv[1]), uvAt(cell, s1, vv[2]), uvAt(cell, s0, vv[3])]);
      }
    }
  }
  return { solid: solid.geometry(), cut: cut.geometry() };
}

// a leafy street tree, its foot at the origin: a trunk forking into branches, each holding up a lobe of leaf
// clusters, so the crown is broad and ragged with sky through it (the ref) instead of a ball
export function leafy(rng: () => number, size: LeafySize): { solid: THREE.BufferGeometry; cut: THREE.BufferGeometry } {
  const L = TREES.leafy[size];
  const h = pick(rng, L.h);
  const R = pick(rng, L.r);
  const lean = leanDir(rng).multiplyScalar(pick(rng, L.lean));
  const solid = new Geo();
  const cut = new Geo();
  const ry = Math.min(R * 0.72, h * 0.36);
  const mid = v3(lean.x, h - ry, lean.z);
  const r = v3(R, ry, R * 0.75);
  //the trunk, bending a little, forking low in the crown
  const fork = v3(lean.x * 0.5, Math.max(1.2, mid.y - ry * 1.05), lean.z * 0.5);
  tube(solid, curve(v3(0, -0.3, 0), v3(lean.x * 0.05, fork.y * 0.5, 0), fork, 4), 0.13 + R * 0.03, 0.1, CELL.bark, 1.2, 0.5);
  //the lobes: one up the middle, the rest out round it
  const lobes: { c: V; r: number }[] = [{ c: mid.clone().add(v3(0, ry * 0.35, 0)), r: R * 0.55 }];
  const n = size === 'small' ? 3 : size === 'round' ? 4 : 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.6;
    lobes.push({ c: mid.clone().add(v3(Math.cos(a) * R * 0.55, (rng() - 0.6) * ry * 0.5, Math.sin(a) * R * 0.4)), r: R * (0.42 + rng() * 0.12) });
  }
  let card0 = 0;
  for (const { c, r: lr } of lobes) {
    //a branch up into it, and a small solid core so the lobe reads as a mass through its gaps
    const bend = fork.clone().lerp(c, 0.5).add(v3(0, -0.2, 0));
    tube(solid, curve(fork, bend, c.clone().add(v3(0, -lr * 0.3, 0)), 3), 0.07, 0.03, CELL.bark, 1.2);
    lump(solid, c, v3(lr * 0.45, lr * 0.38, lr * 0.42), CELL.core, rng);
    //leaf clusters over its top and sides
    const cards = Math.round(5 + lr * 5);
    for (let i = 0; i < cards; i++) {
      const y = 1 - ((i + 0.5) / cards) * 1.5;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const a = (card0 + i) * 2.39996 + rng() * 0.5;
      const dir = v3(Math.cos(a) * ring, y, Math.sin(a) * ring);
      const k = 0.55 + rng() * 0.35;
      const p = c.clone().add(v3(dir.x * lr * k, dir.y * lr * 0.8 * k, dir.z * lr * k));
      const face = dir.clone().add(v3((rng() - 0.5) * 0.9, (rng() - 0.5) * 0.9, (rng() - 0.5) * 0.9));
      card(cut, p, face, lr * (1.05 + rng() * 0.35), rng() * Math.PI * 2, CELL.leaf((card0 + i) % 4), mid, r, rng() < 0.5);
    }
    card0 += cards;
  }
  return { solid: solid.geometry(), cut: cut.geometry() };
}

// a bush, its foot at the origin: a squat solid core under leaf cards all round it (the ref's ball of leaves)
export function bush(rng: () => number, flowers: boolean): { solid: THREE.BufferGeometry; cut: THREE.BufferGeometry } {
  const solid = new Geo();
  const cut = new Geo();
  const R = 0.42 + rng() * 0.12;
  const ry = R * (0.8 + rng() * 0.15);
  const mid = v3(0, ry * 0.9, 0);
  const r = v3(R, ry, R * 0.9);
  lump(solid, mid, r.clone().multiplyScalar(0.62), CELL.bushCore, rng, 1);
  const cards = 12;
  for (let i = 0; i < cards; i++) {
    const y = 1 - ((i + 0.5) / cards) * 1.5;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996 + rng() * 0.5;
    const dir = v3(Math.cos(a) * ring, y, Math.sin(a) * ring);
    const p = v3(dir.x * r.x * 0.68, mid.y + dir.y * r.y * 0.68, dir.z * r.z * 0.68);
    card(cut, p, dir.clone().add(v3((rng() - 0.5) * 0.6, 0, (rng() - 0.5) * 0.6)), R * 1.15, rng() * Math.PI * 2, CELL.bush(i % 2), mid, r, rng() < 0.5);
  }
  //flowers on top of the leaves, over the front and top where they show
  if (flowers) {
    const n = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.1 + 0.8 * (i + rng() * 0.6) / n);
      const y = 0.9 - rng() * 1.2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const dir = v3(Math.cos(a) * ring, y, Math.sin(a) * ring);
      const p = v3(dir.x * r.x * 0.98, mid.y + dir.y * r.y * 0.98, dir.z * r.z * 0.98);
      card(cut, p, dir, R * 0.42, rng() * 0.6, CELL.flower, mid, r, false);
    }
  }
  return { solid: solid.geometry(), cut: cut.geometry() };
}

// a bush stood at (x, base, z), tiles, shaped by where it stands
export function plantBush(group: THREE.Group, x: number, base: number, z: number, flowers: boolean): void {
  let s = Math.abs(Math.floor(x * 97 + z * 31 + base * 13)) % 2147483646 + 1;
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  add(group, bush(rng, flowers), x, base, z);
}

// a tree stood at (x, base, z), tiles: two meshes into `group`, for the kit's batch to merge
export function plantTree(group: THREE.Group, rng: () => number, kind: TreeKind, size: PalmSize | LeafySize, x: number, base: number, z: number): void {
  add(group, kind === 'palm' ? palm(rng, size as PalmSize) : leafy(rng, size as LeafySize), x, base, z);
}

function add(group: THREE.Group, geo: { solid: THREE.BufferGeometry; cut: THREE.BufferGeometry }, x: number, base: number, z: number): void {
  const m = materials();
  for (const [g, mat, name] of [[geo.solid, m.solid, 'tree-solid'], [geo.cut, m.cut, 'tree-leaves']] as const) {
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = name;
    mesh.position.set(x, base, z);
    //the cut-out cards carry their own ink: no toon swap, no outline
    if (mat === m.cut) mesh.userData.inked = true;
    group.add(mesh);
  }
}
