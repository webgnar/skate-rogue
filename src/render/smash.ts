// Breaking things: a prop Lou rolls through, lands on, grinds, car-hops or slams into bursts into its pieces, with
// chips and dust from the shared particle pool, a comic word on the big ones and a camera kick scaled by speed.
// Props that don't break (a hydrant) ring and spark instead. Any prop plugs in by name: the material comes from the
// name, the pieces from the models thread's propPieces, or else the prop's own model cut into chunks (shatter), so
// the debris is always the thing you hit: its colours, its shapes. The chips take the prop's colours too, with the
// material's own (glass glints, wood dust, metal sparks) on top. The prop itself is hidden the moment it breaks.
import * as THREE from 'three';
import { warmMesh } from './shader-keep';
import type { Particles } from './particles';
import { FX } from './fx-settings';
import { stuffOf, type Stuff } from '../sim/stuff';

export { stuffOf, type Stuff };

export type SmashHow = 'roll' | 'land' | 'grind' | 'hop' | 'slam' | 'bomb' | 'car';

export interface SmashHit {
  prop: string; // the prop's model name, such as 'Bottle' or 'NewsBoxRed'
  index: number; // which prop on the floor, for hiding it
  x: number; // world units, the prop's base
  y: number;
  z?: number; // depth (street props sit back at the wall); 0 by default
  how: SmashHow;
  speed: number; // the skater's speed over cruising (1 = cruising)
  breakable?: boolean; // false: it rings and sparks but stays
}

export interface Piece {
  geometry: THREE.BufferGeometry;
  offset: THREE.Vector3; // the piece's centre from the prop's base
}

export const SMASH = {
  maxPieces: 24, // live pieces at once (one draw each while they fly)
  pieceLife: 1.1, // seconds
  grav: 18,
  bigFrom: 1.5, // speed over cruising where a roll-through counts as big
  kick: 0.18, // camera shake for a big smash, per unit of speed
  //which hits shake the camera. zack (2026-10-26): no shake for plain smashing, for now; a slam or a car through
  //something still does. Add 'roll', 'land', 'grind', 'hop' or 'bomb' back to bring it back for those
  shakeOn: new Set<SmashHow>(['slam', 'car']),
};

const hex = (c: number) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
const LOOK: Record<Stuff, { chips: number[][]; dust: number[][] | null; sparks: boolean; words: string[]; piece: number }> = {
  glass: { chips: [hex(0xe8fbff), hex(0x9ee8ff), hex(0xffffff)], dust: null, sparks: false, words: ['KRSSH!', 'SMASH!'], piece: 0xbfeeff },
  metal: { chips: [hex(0x8a8f9a), hex(0x5a5e68)], dust: null, sparks: true, words: ['TONK!', 'CLANG!'], piece: 0x7a808c },
  wood: { chips: [hex(0xb07a40), hex(0x8a5a2a), hex(0xd8a868)], dust: [hex(0xc8b090)], sparks: false, words: ['KRAK!', 'CRUNCH!'], piece: 0xa8743c },
  plastic: { chips: [hex(0xff8a2a), hex(0xffffff)], dust: null, sparks: false, words: ['THWAK!', 'BONK!'], piece: 0xff7a2a },
  stone: { chips: [hex(0xa8a098), hex(0x7a7068)], dust: [hex(0xb8b0a8), hex(0x9a9088)], sparks: false, words: ['CRUNCH!', 'KRAK!'], piece: 0x9a9088 },
  paper: { chips: [hex(0xf4f0e0), hex(0xd8d0b8)], dust: null, sparks: false, words: ['FWUMP!'], piece: 0xf0ead8 },
};

// a smash is big (word, kick) when it's hit hard: landed on, slammed, bombed, or rolled through fast
export function isBig(hit: SmashHit): boolean {
  return hit.how === 'land' || hit.how === 'slam' || hit.how === 'bomb' || hit.how === 'hop' || hit.speed >= SMASH.bigFrom;
}

interface Live {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  floor: number;
}

const stand = [0, 1, 2, 3].map((k) => new THREE.BoxGeometry(0.14 + k * 0.03, 0.1 + k * 0.04, 0.12)); // pieces until a prop has its own

export class SmashFx {
  readonly group = new THREE.Group();
  readonly warm = new THREE.Group(); // hidden stand-ins for the loading screen's shader warm-up (goes in the same scene)
  private readonly live: Live[] = [];
  private readonly free: THREE.Mesh[] = [];
  private readonly mats = new Map<string, THREE.MeshToonMaterial>();
  private readonly cut = new Map<string, Piece[]>(); // each prop's shatter, made once

  private shards(prop: string, geo: THREE.BufferGeometry): Piece[] {
    let out = this.cut.get(prop);
    if (!out) this.cut.set(prop, (out = shatter(geo)));
    return out;
  }

  constructor(
    private readonly particles: Particles,
    private readonly fx: {
      word(x: number, y: number, word: string): void;
      shake(amount: number): void;
      hide?(index: number): void;
      pieces?(prop: string): Piece[];
      geometry?(prop: string): THREE.BufferGeometry | null; // the prop's vertex-coloured model, for shatter
    },
  ) {
    //both kinds of piece material, compiled on the loading screen
    this.warm.add(warmMesh(this.material(-1)), warmMesh(this.material(0xffffff)));
  }

  smash(hit: SmashHit): void {
    const stuff = stuffOf(hit.prop);
    const look = LOOK[stuff];
    const big = isBig(hit);
    const dir = hit.how === 'land' || hit.how === 'slam' || hit.how === 'bomb' ? 0 : 1; // flung forward, or out all round
    const p = this.particles;
    const k = Math.min(2, Math.max(0.6, hit.speed));
    if (hit.breakable === false) {
      //it holds: a ring of sparks or chips off the surface, and a little word if it was hit hard
      p.spray(hit.x, hit.y + 0.5, { z: hit.z, n: 10, colors: look.sparks ? [hex(0xffffff), hex(0xffe08a)] : look.chips, life: [0.2, 0.35], size: [0.1, 0.14], speed: [2, 4], angle: [Math.PI * 0.1, Math.PI * 0.9], grav: 14, drag: 1 });
      if (big) this.fx.word(hit.x, hit.y + 1, look.sparks ? 'TONK!' : 'BONK!');
      return;
    }
    this.fx.hide?.(hit.index);
    //the pieces: the model's own break pieces, or its model cut into chunks, or (no model at all) stand-in chunks
    const model = this.fx.geometry?.(hit.prop) ?? null;
    let pieces = recentre(this.fx.pieces?.(hit.prop) ?? []);
    if (!pieces.length && model) pieces = this.shards(hit.prop, model);
    const list: Piece[] = pieces.length ? pieces : stand.map((g, i) => ({ geometry: g, offset: new THREE.Vector3((i - 1.5) * 0.12, 0.2 + i * 0.12, 0) }));
    for (const piece of list) this.fling(piece, hit, look.piece, dir, k);
    //chips in the prop's own colours (and its material's), dust, sparks
    const chips = model ? [...palette(model), ...look.chips.slice(0, 1)] : look.chips;
    p.spray(hit.x, hit.y + 0.4, { z: hit.z, n: Math.round(12 * k), colors: chips, life: [0.4, 0.8], size: [0.08, 0.14], speed: [2, 5 * k], angle: dir ? [0.1, Math.PI * 0.75] : [Math.PI * 0.1, Math.PI * 0.9], grav: 16, drag: 0.8, ink: stuff !== 'glass', floor: hit.y });
    if (stuff === 'glass') p.spray(hit.x, hit.y + 0.4, { z: hit.z, n: 10, colors: look.chips, life: [0.25, 0.45], size: [0.06, 0.09], speed: [3, 6], grav: 10, drag: 1.5, alpha: 0.9 });
    if (look.dust) p.spray(hit.x, hit.y + 0.15, { z: hit.z, n: 5, colors: look.dust, life: [0.5, 0.85], size: [0.4, 0.55], size1: 1, speed: [0.8, 2.2], angle: [0, Math.PI], jitter: 0.2, drag: 3, grav: -0.3, alpha: 0.85, fadeFrom: 0.2, puff: true });
    if (look.sparks) p.spray(hit.x, hit.y + 0.4, { z: hit.z, n: 10, colors: [hex(0xffffff), hex(0xffe08a), hex(0xffb040)], life: [0.2, 0.4], size: [0.1, 0.15], speed: [3, 6], angle: [0.2, Math.PI - 0.2], grav: 14 });
    if (big) {
      this.fx.word(hit.x, hit.y + 1.1, look.words[Math.floor(Math.random() * look.words.length)]);
      if (SMASH.shakeOn.has(hit.how)) this.fx.shake(SMASH.kick * k);
    }
  }

  // other effects' pieces (the springs and panels of a car hop, car-damage.ts): flung up and out from (x, y, z),
  // out to either side by their offsets, landing on `floor`; color -1 for vertex-coloured pieces
  burst(list: Piece[], x: number, y: number, z: number, floor: number, color: number, k = 1): void {
    const at = { x, y, z } as SmashHit;
    for (const piece of list) this.fling(piece, at, color, 0, k, floor);
  }

  private fling(piece: Piece, hit: SmashHit, color: number, dir: number, k: number, floor = hit.y): void {
    if (this.live.length >= (FX.tier === 'low' ? SMASH.maxPieces / 2 : SMASH.maxPieces)) this.retire(this.live[0]);
    const mesh = this.free.pop() ?? new THREE.Mesh();
    mesh.geometry = piece.geometry;
    mesh.material = this.material(piece.geometry.getAttribute('color') ? -1 : color);
    mesh.position.set(hit.x + piece.offset.x, hit.y + piece.offset.y, (hit.z ?? 0) + piece.offset.z);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.setScalar(1);
    mesh.visible = true;
    this.group.add(mesh);
    const out = piece.offset.x >= 0 ? 1 : -1;
    const v = new THREE.Vector3(
      dir ? THREE.MathUtils.randFloat(1, 4) * k : out * THREE.MathUtils.randFloat(0.5, 2.5),
      THREE.MathUtils.randFloat(2.5, 5) * Math.min(1.5, k),
      THREE.MathUtils.randFloat(0.5, 2.5), // out toward the street
    );
    const spin = new THREE.Vector3(THREE.MathUtils.randFloatSpread(14), THREE.MathUtils.randFloatSpread(14), THREE.MathUtils.randFloatSpread(14));
    this.live.push({ mesh, v, spin, age: 0, floor });
  }

  // one shared toon material per colour; -1 for the models' vertex-coloured pieces
  private material(color: number): THREE.MeshToonMaterial {
    const key = String(color);
    let m = this.mats.get(key);
    if (!m) {
      m = color < 0 ? new THREE.MeshToonMaterial({ vertexColors: true }) : new THREE.MeshToonMaterial({ color });
      this.mats.set(key, m);
    }
    return m;
  }

  private retire(l: Live): void {
    this.group.remove(l.mesh);
    this.free.push(l.mesh);
    this.live.splice(this.live.indexOf(l), 1);
  }

  // dt in game seconds: pieces tumble, bounce once or twice and shrink away
  update(dt: number): void {
    for (const l of [...this.live]) {
      l.age += dt;
      if (l.age >= SMASH.pieceLife) {
        this.retire(l);
        continue;
      }
      l.v.y -= SMASH.grav * dt;
      l.mesh.position.addScaledVector(l.v, dt);
      if (l.mesh.position.y < l.floor + 0.05 && l.v.y < 0) {
        l.mesh.position.y = l.floor + 0.05;
        l.v.y *= -0.35;
        l.v.x *= 0.6;
        l.spin.multiplyScalar(0.6);
      }
      l.mesh.rotation.x += l.spin.x * dt;
      l.mesh.rotation.y += l.spin.y * dt;
      l.mesh.rotation.z += l.spin.z * dt;
      const fade = 1 - Math.max(0, (l.age - SMASH.pieceLife * 0.7) / (SMASH.pieceLife * 0.3));
      l.mesh.scale.setScalar(Math.max(0.01, fade));
    }
  }

  clear(): void {
    for (const l of [...this.live]) this.retire(l);
  }

  // the world moved (the next floor took over): move the pieces with it
  shift(dx: number, dy: number): void {
    for (const l of this.live) {
      l.mesh.position.x += dx;
      l.mesh.position.y += dy;
      l.floor += dy;
    }
  }
}

// pieces sit round the prop's own middle across the ground: if an export left them offset (where the prop stood in
// the Blender file), pull them back over the base
function recentre(pieces: Piece[]): Piece[] {
  if (!pieces.length) return pieces;
  const mid = new THREE.Vector3();
  for (const p of pieces) mid.add(p.offset);
  mid.divideScalar(pieces.length);
  if (Math.abs(mid.x) < 0.5 && Math.abs(mid.z) < 0.5) return pieces;
  return pieces.map((p) => ({ geometry: p.geometry, offset: p.offset.clone().sub(new THREE.Vector3(mid.x, 0, mid.z)) }));
}

// a model cut into chunks for debris: its triangles binned by where they sit round its middle (around it, and low or
// high), each bin a piece centred on itself. Vertex colours (and so the prop's look) ride along
export function shatter(geo: THREE.BufferGeometry, around = 4, levels = 2): Piece[] {
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('color');
  const idx = geo.index;
  const tri = idx ? idx.count / 3 : pos.count / 3;
  const vert = (t: number, k: number) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const mid = box.getCenter(new THREE.Vector3());
  const lo = box.min.y;
  const hi = Math.max(box.max.y - lo, 1e-6);
  const bins: number[][] = Array.from({ length: around * levels }, () => []);
  const c = new THREE.Vector3();
  for (let t = 0; t < tri; t++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(new THREE.Vector3().fromBufferAttribute(pos, vert(t, k)));
    c.divideScalar(3);
    const a = (Math.atan2(c.z - mid.z, c.x - mid.x) + Math.PI) / (Math.PI * 2);
    const ring = Math.min(around - 1, Math.floor(a * around));
    const level = Math.min(levels - 1, Math.floor(((c.y - lo) / hi) * levels));
    bins[level * around + ring].push(t);
  }
  const out: Piece[] = [];
  for (const list of bins) {
    if (!list.length) continue;
    const p = new Float32Array(list.length * 9);
    const q = col ? new Float32Array(list.length * 9) : null;
    list.forEach((t, j) => {
      for (let k = 0; k < 3; k++) {
        const v = vert(t, k);
        p.set([pos.getX(v), pos.getY(v), pos.getZ(v)], (j * 3 + k) * 3);
        if (q && col) q.set([col.getX(v), col.getY(v), col.getZ(v)], (j * 3 + k) * 3);
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    if (q) g.setAttribute('color', new THREE.BufferAttribute(q, 3));
    g.computeBoundingBox();
    const centre = g.boundingBox!.getCenter(new THREE.Vector3());
    g.translate(-centre.x, -centre.y, -centre.z);
    g.computeVertexNormals();
    //offsets from the base under the prop's middle, the way propPieces gives them
    out.push({ geometry: g, offset: new THREE.Vector3(centre.x - mid.x, centre.y - lo, centre.z - mid.z) });
  }
  return out;
}

// a model's main colours (by how much of it they cover), for its chips: up to 3, as 0..1 sRGB like the chip colours
// (the model's vertex colours are linear)
export function palette(geo: THREE.BufferGeometry, most = 3): number[][] {
  const col = geo.getAttribute('color');
  if (!col) return [];
  const counts = new Map<string, { n: number; rgb: number[] }>();
  for (let i = 0; i < col.count; i++) {
    const rgb = [col.getX(i), col.getY(i), col.getZ(i)];
    const key = rgb.map((v) => Math.round(v * 20)).join(',');
    const e = counts.get(key);
    if (e) e.n++;
    else counts.set(key, { n: 1, rgb });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, most).map((e) => hex(new THREE.Color().setRGB(e.rgb[0], e.rgb[1], e.rgb[2]).getHex()));
}
