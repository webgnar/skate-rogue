// Breaking things: a prop Lou rolls through, lands on, grinds, car-hops or slams into bursts into its pieces, with
// chips and dust from the shared particle pool, a comic word on the big ones and a camera kick scaled by speed.
// Props that don't break (a hydrant) ring and spark instead. Any prop plugs in by name: the material comes from the
// name, the pieces from the models thread's propPieces (boxes stand in until a prop has its own).
import * as THREE from 'three';
import type { Particles, Spray } from './particles';
import { FX } from './fx-settings';

export type SmashHow = 'roll' | 'land' | 'grind' | 'hop' | 'slam' | 'bomb';
export type Stuff = 'glass' | 'metal' | 'wood' | 'plastic' | 'stone' | 'paper';

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
};

// what a prop is made of, from its name
const STUFF: [RegExp, Stuff][] = [
  [/cardboard/i, 'paper'], // before wood's 'board'
  [/bottle|window|glass|lamp/i, 'glass'],
  [/hydrant|newsbox|mailbox|meter|sign|pole|can|rail/i, 'metal'],
  [/crate|bench|pallet|board|sandwich/i, 'wood'],
  [/cone|bin|barrel|cooler/i, 'plastic'],
  [/planter|pot|brick|statue|column|bust/i, 'stone'],
  [/paper|box|news|poster/i, 'paper'],
];

export function stuffOf(prop: string): Stuff {
  return STUFF.find(([re]) => re.test(prop))?.[1] ?? 'plastic';
}

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
  private readonly live: Live[] = [];
  private readonly free: THREE.Mesh[] = [];
  private readonly mats = new Map<string, THREE.MeshToonMaterial>();

  constructor(
    private readonly particles: Particles,
    private readonly fx: {
      word(x: number, y: number, word: string): void;
      shake(amount: number): void;
      hide?(index: number): void;
      pieces?(prop: string): Piece[];
    },
  ) {}

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
    //the pieces: the model's own, or stand-in chunks in the stuff's colour
    const pieces = recentre(this.fx.pieces?.(hit.prop) ?? []);
    const list: Piece[] = pieces.length ? pieces : stand.map((g, i) => ({ geometry: g, offset: new THREE.Vector3((i - 1.5) * 0.12, 0.2 + i * 0.12, 0) }));
    for (const piece of list) this.fling(piece, hit, look.piece, dir, k);
    //chips, dust, sparks
    p.spray(hit.x, hit.y + 0.4, { z: hit.z, n: Math.round(12 * k), colors: look.chips, life: [0.4, 0.8], size: [0.08, 0.14], speed: [2, 5 * k], angle: dir ? [0.1, Math.PI * 0.75] : [Math.PI * 0.1, Math.PI * 0.9], grav: 16, drag: 0.8, ink: stuff !== 'glass', floor: hit.y });
    if (stuff === 'glass') p.spray(hit.x, hit.y + 0.4, { z: hit.z, n: 10, colors: look.chips, life: [0.25, 0.45], size: [0.06, 0.09], speed: [3, 6], grav: 10, drag: 1.5, alpha: 0.9 });
    if (look.dust) p.spray(hit.x, hit.y + 0.15, { z: hit.z, n: 8, colors: look.dust, life: [0.5, 0.8], size: [0.18, 0.26], size1: 0.5, speed: [0.6, 1.8], angle: [0, Math.PI], drag: 3, grav: -0.3, alpha: 0.7, fadeFrom: 0 } as Spray);
    if (look.sparks) p.spray(hit.x, hit.y + 0.4, { z: hit.z, n: 10, colors: [hex(0xffffff), hex(0xffe08a), hex(0xffb040)], life: [0.2, 0.4], size: [0.1, 0.15], speed: [3, 6], angle: [0.2, Math.PI - 0.2], grav: 14 });
    if (big) {
      this.fx.word(hit.x, hit.y + 1.1, look.words[Math.floor(Math.random() * look.words.length)]);
      this.fx.shake(SMASH.kick * k);
    }
  }

  private fling(piece: Piece, hit: SmashHit, color: number, dir: number, k: number): void {
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
    this.live.push({ mesh, v, spin, age: 0, floor: hit.y });
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
