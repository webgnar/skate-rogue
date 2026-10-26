// People on the sidewalk (GDD: a living street): they stand about or stroll along the back of the street, and react
// to the skater coming past. They turn to watch, some hold a phone up and film you, they cheer a landing near them
// and flinch at a slam, duck when you fly in low over them. Purely for show: the sim doesn't know they're there.
//
// Each person is the parts from art/pedestrians.py (peds.glb), recoloured and merged into one skinned mesh on a
// little skeleton built here (hips, legs, arms, head), so a person costs one draw and one outline.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Level } from '../physics/level';
import type { Skater } from '../physics/skater';
import { TILE } from '../physics/constants';
import { CROSS } from '../traffic/cross';
import { STOP } from '../traffic/street';
import { STREET_Z } from '../traffic/traffic';
import { makeRng, randInt, type Rng } from '../gen/rng';
import { model } from './models';
import { propsFor } from './props';
import { toX, toY } from './kit';
import type { BiomeId } from './biomes';
import { inkify } from './toon';
import { sliceDone, sliceEnd, sliceStart } from './slice';
import type { Phone } from './phone-fx';

// art/pedestrians.py's joints
const HIP_Y = 0.95;
const HIP_X = 0.1;
const SHOULDER = { x: 0.26, y: 1.5 };
const NECK_Y = 1.56;
const LANE_Z = STREET_Z.walk; // on the sidewalk, behind the lamps and in front of the street props
const SHOW = 18; // tiles either side of the camera that people are drawn

const TOPS = [0x3a7be8, 0xd94a4a, 0x48b86a, 0xe8c33a, 0xf0f0f0, 0x2a2a34, 0xff8a3a, 0x8a5ad8, 0x3ab8b0, 0xe86aa8];
const PANTS = [0x2a2a34, 0x3a4a6a, 0x5a4a3a, 0x6a6a72, 0x1a2a48, 0xb8a888];
const SKIN = [0xf0c8a8, 0xd8a888, 0xc8946a, 0x9a6a48, 0x6a4430, 0x4a3022];
const HAIR = [0x1a1210, 0x2a1a10, 0x5a3a20, 0xc89a48, 0xe8d8a8, 0x8a2a1a, 0x6a6a6a];
const SHOES = [0xf0f0f0, 0x16161c, 0xd94a4a, 0x3a7be8];
const HEADS = ['PedHeadShort', 'PedHeadLong', 'PedHeadCap'];

// what the locals wear in each world; a world left out dresses like Chicago
interface Dress {
  tops?: number[];
  pants?: number[];
  shoes?: number[];
  heads?: string[];
  skin?: number[];
}
const DRESS: Partial<Record<BiomeId, Dress>> = {
  // tunics and chitons: undyed linen, terracotta, olive, the odd purple; bare legs, sandals, laurels on some
  greece: {
    tops: [0xf0ead8, 0xe8dcc0, 0xc8643a, 0x8a8a4a, 0x6a3a8a, 0xf0ead8],
    pants: SKIN,
    shoes: [0x8a5a2a, 0x6a4020],
    heads: ['PedHeadShort', 'PedHeadLong', 'PedHeadWreath', 'PedHeadWreath'],
  },
  // sea colours: teal, coral, pearl, kelp
  atlantis: {
    tops: [0x2ab8b0, 0xff7a6a, 0xe8f0f0, 0x3a8a6a, 0x5a6ad8, 0x8ad8e8],
    pants: [0x1a4a6a, 0x2a6a6a, 0x3a3a5a],
    shoes: [0xe8f0f0, 0x2ab8b0],
    heads: ['PedHeadShort', 'PedHeadLong', 'PedHeadLong'],
  },
  // gallery-goers: muted coats, a guide in navy here and there
  museum: {
    tops: [0x6a6a72, 0x8a7a6a, 0x1a2a48, 0xc8b898, 0x4a3a3a, 0x2a2a34],
    pants: [0x2a2a34, 0x4a4a52, 0x6a5a4a],
    shoes: [0x16161c, 0x4a3020],
  },
  // flight suits and helmets
  space: {
    tops: [0xf0f0f0, 0xff8a3a, 0xd8d8e0, 0x3a7be8],
    pants: [0xf0f0f0, 0xd8d8e0, 0x6a6a72],
    shoes: [0x6a6a72, 0x16161c],
    heads: ['PedHeadHelmet', 'PedHeadHelmet', 'PedHeadHelmet', 'PedHeadShort'],
  },
  // black techwear with neon trim colours
  hightech: {
    tops: [0x16161c, 0x2a2a34, 0x3affe8, 0xff3ad8, 0xe8ff3a],
    pants: [0x16161c, 0x2a2a34],
    shoes: [0xf0f0f0, 0x3affe8, 0x16161c],
  },
};

const MIXED = Object.values(DRESS);

// bones, by index
const ROOT = 0;
const HIPS = 1;
const LEG_L = 2;
const LEG_R = 3;
const ARM_L = 4;
const ARM_R = 5;
const HEAD = 6;

interface Person {
  mesh: THREE.SkinnedMesh;
  bones: THREE.Bone[];
  home: number; // tiles along the street
  x: number;
  walker: boolean; // strolls up and down, or stands
  dir: number; // walking direction, 1 or -1
  filmer: boolean; // gets a phone out when you come past
  phase: number;
  cheer: number; // seconds left
  flinch: number;
  duck: number;
  delay: number; // a beat before reacting, so a crowd doesn't move as one
  snapAt: number; // when this filmer last took a photo (phone-fx.ts flashes it)
}

const pick = <T>(rng: Rng, list: T[]): T => list[randInt(rng, list.length)];

// one person's parts, recoloured from their palette, merged and skinned to a fresh skeleton
function makePerson(rng: Rng, biome: BiomeId): { mesh: THREE.SkinnedMesh; bones: THREE.Bone[] } | null {
  // the city mixes every world into one (zack): most people dress for Chicago, about a third come from the others
  const dress = DRESS[biome] ?? (rng() < 0.35 ? pick(rng, MIXED) : {});
  const skin = pick(rng, dress.skin ?? SKIN);
  const palette: Record<string, number> = {
    pedTop: pick(rng, dress.tops ?? TOPS),
    pedPants: dress.pants === SKIN ? skin : pick(rng, dress.pants ?? PANTS), // bare legs under a tunic
    pedSkin: skin,
    pedHair: pick(rng, HAIR),
    pedShoe: pick(rng, dress.shoes ?? SHOES),
  };
  const parts: [string, number, THREE.Vector3][] = [
    ['PedTorso', HIPS, new THREE.Vector3(0, HIP_Y, 0)],
    ['PedLeg', LEG_L, new THREE.Vector3(-HIP_X, HIP_Y, 0)],
    ['PedLeg', LEG_R, new THREE.Vector3(HIP_X, HIP_Y, 0)],
    ['PedArmL', ARM_L, new THREE.Vector3(-SHOULDER.x, SHOULDER.y, 0)],
    ['PedArmR', ARM_R, new THREE.Vector3(SHOULDER.x, SHOULDER.y, 0)],
    [pick(rng, dress.heads ?? HEADS), HEAD, new THREE.Vector3(0, NECK_Y, 0)],
  ];
  const geos: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  for (const [name, bone, at] of parts) {
    const src = model(name);
    if (!src) return null;
    const geo = src.geometry.index ? src.geometry.toNonIndexed() : src.geometry.clone();
    const mats = [src.material].flat() as THREE.MeshLambertMaterial[];
    const n = geo.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    const groups = geo.groups.length ? geo.groups : [{ start: 0, count: n, materialIndex: 0 }];
    for (const g of groups) {
      const m = mats[g.materialIndex ?? 0];
      const hex = palette[m.name];
      if (hex !== undefined) c.setHex(hex);
      else c.copy(m.color);
      for (let i = g.start; i < g.start + g.count; i++) col.set([c.r, c.g, c.b], i * 3);
    }
    geo.clearGroups();
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.translate(at.x, at.y, at.z);
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4).map((_, i) => (i % 4 === 0 ? bone : 0)), 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Float32Array(n * 4).map((_, i) => (i % 4 === 0 ? 1 : 0)), 4));
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'color', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
    geos.push(geo);
  }
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  if (!merged) return null;

  const bones = Array.from({ length: 7 }, () => new THREE.Bone());
  const at = (b: number, parent: number, x: number, y: number) => {
    bones[b].position.set(x, y, 0);
    bones[parent].add(bones[b]);
  };
  at(HIPS, ROOT, 0, HIP_Y);
  at(LEG_L, ROOT, -HIP_X, HIP_Y);
  at(LEG_R, ROOT, HIP_X, HIP_Y);
  at(ARM_L, HIPS, -SHOULDER.x, SHOULDER.y - HIP_Y);
  at(ARM_R, HIPS, SHOULDER.x, SHOULDER.y - HIP_Y);
  at(HEAD, HIPS, 0, NECK_Y - HIP_Y);
  const mesh = new THREE.SkinnedMesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.add(bones[ROOT]);
  bones[ROOT].updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false; // shown and hidden by distance from the camera instead
  inkify(mesh);
  return { mesh, bones };
}

// ease a bone's rotation toward (x, y, z)
function ease(b: THREE.Bone, x: number, y: number, z: number, k: number): void {
  b.rotation.x += (x - b.rotation.x) * k;
  b.rotation.y += (y - b.rotation.y) * k;
  b.rotation.z += (z - b.rotation.z) * k;
}

export class PedView {
  readonly group = new THREE.Group();
  private people: Person[] = [];
  private level: Level | null = null;
  private wasAir = 0; // seconds the skater has been in the air
  private lastMode = '';
  private t = 0;
  private readonly phoneList: Phone[] = [];
  private readonly hand = new THREE.Vector3();

  // stand people along the floor's street sidewalk: not in the cross streets, the canals, at bus stops or on props
  private biome: BiomeId = 'chicago';

  private job: Generator<void, void> | null = null; // the floor's people still being made, a few a frame

  // a new floor's people are made over its first frames, nearest the start first, 2 ms a frame (making them all
  // at once held up the frame a new floor took over)
  private populate(level: Level, biome: BiomeId): void {
    for (const p of this.people) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    this.people = [];
    this.level = level;
    this.biome = biome;
    this.job = this.populateSteps(level, biome);
  }

  private *populateSteps(level: Level, biome: BiomeId): Generator<void, void> {
    const rng = makeRng(level.width * 7 + level.layout.floor * 131 + level.props.length);
    const cols = level.width / TILE;
    const gaps = level.crossings.map((c) => toX(c.x + CROSS.w / 2)).map((cx) => [cx - CROSS.street - 0.6, cx + CROSS.street + 0.6]);
    const stops = level.busStops.map((s) => [toX(s.x) - 0.5, toX(s.x + STOP.busW) + 2.5]);
    const esc = level.escape ? [[toX(level.escape.x0) - 2, toX(level.escape.x1) + 2]] : [];
    const blocked = (x: number) =>
      [...gaps, ...stops, ...esc].some(([a, b]) => x > a && x < b) ||
      !level.street[Math.floor(x)] ||
      !level.street[Math.min(cols - 1, Math.floor(x) + 1)] ||
      propsFor(level).placements.some((p) => Math.abs(p.x - x) < 0.9 && p.z < -1.5);
    const end = level.fork ? toX(level.fork.x0) - 3 : cols - 4; // clear of the fork's doors
    for (let x = toX(level.finaleX) + 4 + rng() * 4; x < end; x += 3 + rng() * 6) {
      if (blocked(x)) continue;
      if (sliceDone()) yield;
      const made = makePerson(rng, biome);
      if (!made) return; // peds.glb didn't load: an empty sidewalk
      const walker = rng() < 0.4;
      const person: Person = {
        ...made,
        home: x,
        x,
        walker,
        dir: rng() < 0.5 ? 1 : -1,
        filmer: rng() < 0.35,
        phase: rng() * 10,
        cheer: 0,
        flinch: 0,
        duck: 0,
        delay: rng() * 0.35,
        snapAt: -Infinity,
      };
      person.mesh.position.set(x, 0, LANE_Z + (rng() - 0.5) * 0.16);
      this.group.add(person.mesh);
      this.people.push(person);
      if (rng() < 0.3) x += 0.8; // sometimes a pair, chatting
    }
  }

  update(level: Level, sk: Skater, dt: number, camX: number, biome: BiomeId = 'chicago'): void {
    if (level !== this.level || biome !== this.biome) this.populate(level, biome);
    if (this.job) {
      sliceStart(2);
      try {
        while (this.job && !sliceDone()) if (this.job.next().done) this.job = null;
      } finally {
        sliceEnd();
      }
    }
    this.t += dt;
    const street = toY(level, level.streetY);
    this.group.position.y = street;
    const skX = toX(sk.x);
    const high = toY(level, sk.y) - street; // the skater's height over the street
    //a landing from a decent air, or a slam, sets off the people near it
    if (sk.mode === 'air') this.wasAir += dt;
    const landed = this.lastMode === 'air' && sk.mode !== 'air' && sk.mode !== 'bail' && this.wasAir > 0.45;
    const slammed = sk.mode === 'bail' && this.lastMode !== 'bail';
    if (sk.mode !== 'air') this.wasAir = 0;
    this.lastMode = sk.mode;
    const k = 1 - Math.exp(-dt * 9);
    this.phoneList.length = 0;
    for (const p of this.people) {
      const dx = skX - p.x;
      p.mesh.visible = Math.abs(p.x - camX) < SHOW;
      if (!p.mesh.visible) continue;
      const near = high < 7 && Math.abs(dx) < 6;
      if (landed && near) p.cheer = 1.5 + p.delay;
      if (landed && near && p.filmer) p.snapAt = this.t + p.delay * 0.5;
      if (slammed && near) p.flinch = 1.3 + p.delay;
      p.cheer = Math.max(0, p.cheer - dt);
      p.flinch = Math.max(0, p.flinch - dt);
      //flying in low overhead: duck (a filmer keeps filming)
      if (sk.mode === 'air' && high > 0.8 && high < 4.5 && Math.abs(dx) < 1.8 && !p.filmer) p.duck = 0.55 + p.delay * 0.5;
      p.duck = Math.max(0, p.duck - dt);
      const watching = high < 7 && dx > -9 && dx < 5; // you coming up the street, or just gone past
      const [root, hips, legL, legR, armL, armR, head] = p.bones;
      //turn toward the skater (the lane is in front of them, toward the camera)
      const look = Math.max(-1.2, Math.min(1.2, Math.atan2(dx, -LANE_Z)));
      const strolling = p.walker && !watching && p.cheer === 0 && p.flinch === 0 && p.duck === 0;
      if (strolling) {
        p.x += p.dir * dt * 0.9;
        if (Math.abs(p.x - p.home) > 1.6) p.dir = Math.sign(p.home - p.x);
        p.mesh.position.x = p.x;
      }
      p.phase += dt * (strolling ? 7 : 1.6);
      const swing = Math.sin(p.phase);
      let face = strolling ? (p.dir * Math.PI) / 2 : watching ? look * (p.filmer ? 0.9 : 0.45) : 0;
      let headY = watching ? look * 0.5 : 0;
      let lx = 0.04, lz = -0.08, rx = 0.04, rz = 0.08; // arms: rotation about x (forward), z (out to the side)
      let legSwing = 0, hipsX = 0, bounce = 0;
      if (strolling) {
        legSwing = swing * 0.5;
        lx = -swing * 0.35;
        rx = swing * 0.35;
      }
      if (p.filmer && watching) {
        rx = -1.45; // phone up at eye height, aimed at you
        rz = -0.25;
        headY = 0;
      }
      if (p.cheer > 0) {
        const up = Math.abs(Math.sin(this.t * 11 + p.phase));
        lx = 0;
        lz = -2.7 + up * 0.3;
        if (!p.filmer) {
          rx = 0;
          rz = 2.7 - up * 0.3;
        }
        bounce = up * 0.07;
      }
      if (p.flinch > 0) {
        //hands to the head, leaning back
        lx = rx = -2.3;
        lz = 0.35;
        rz = -0.35;
        hipsX = -0.18;
        face = look * 0.6;
      }
      if (p.duck > 0) {
        //folded forward, arms wrapped over the head
        lx = rx = -2.75;
        lz = 0.5;
        rz = -0.5;
        hipsX = 0.65;
        bounce = -0.06;
        face = 0;
        headY = 0;
      }
      ease(root as THREE.Bone, 0, face, 0, k);
      ease(hips, hipsX, 0, strolling ? 0 : Math.sin(this.t * 0.9 + p.phase) * 0.03, k);
      hips.position.y = HIP_Y + bounce;
      ease(legL, legSwing, 0, 0, k);
      ease(legR, -legSwing, 0, 0, k);
      ease(armL, lx, 0, lz, k);
      ease(armR, rx, 0, rz, k);
      ease(head, 0, headY, 0, k);
      if (p.filmer && watching && p.flinch === 0) {
        //the phone in the right hand (art/pedestrians.py), a touch toward the camera so the hand doesn't hide it
        armR.updateWorldMatrix(true, false);
        armR.localToWorld(this.hand.set(0, -0.66, 0.08));
        this.phoneList.push({ x: this.hand.x, y: this.hand.y, z: this.hand.z + 0.12, since: this.t - p.snapAt });
      }
    }
  }

  // the phones held up this frame, in world space
  phones(): Phone[] {
    return this.phoneList;
  }
}
