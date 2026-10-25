// Car-hop damage on screen (src/traffic/damage.ts): the dented, busted and wrecked models (art/car_damage.py) swap
// in as a car takes hops, springs and dust burst out of it on every hop, and a wreck goes up in a cloud of springs,
// panels and a wheel, then sits scrapped out of the lane.
//
// Parked cars are part of the street kit. They merge into one vertex-coloured mesh (and one for their lamps, which
// glow), so a floor's parked cars cost a couple of draw calls; each keeps its vertex range there, so a dented one
// can be hidden and drawn on its own as its damaged model. Moving traffic is drawn per vehicle (traffic-view.ts),
// which rebuilds a vehicle's mesh when its stage changes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Level } from '../physics/level';
import type { Stage } from '../traffic/damage';
import { makeBus, makeCar, makeParkedCruiser, parkedPaint, toX, toY } from './kit';
import { hasModel } from './models';
import { inkify } from './toon';
import type { Particles } from './particles';
import type { SmashFx } from './smash';
import { FX } from './fx-settings';

// the model name suffix for each stage
export const STAGE_MODEL = ['', '_dent', '_bust', '_wreck'] as const;

export const CAR_FX = {
  springs: [0, 3, 4, 10], // springs that burst out per hop, by the stage it leaves the car at
  backZ: -2.3, // a wreck ends up shoved into the back lane
  slideSecs: 0.45,
  shake: [0, 0.05, 0.09, 0.3],
};

//--- parked cars, merged ------------------------------------------------------------------------------------------

interface Range {
  start: number;
  count: number;
}

interface Parked {
  unlit: THREE.Mesh | null;
  lit: THREE.Mesh | null;
  ranges: { unlit: Range; lit: Range }[];
  shown: Map<number, { mesh: THREE.Group; stage: Stage; slide: number }>; // damaged cars, drawn on their own
}

// one parked car as its code-built group, at a damage stage
function parkedGroup(level: Level, i: number, stage: Stage): THREE.Group {
  const car = level.cars[i];
  const x0 = toX(car.x0);
  const x1 = toX(car.x1);
  const bottom = toY(level, car.bottom);
  const roof = toY(level, car.roof);
  const v = STAGE_MODEL[stage];
  if (car.model === 'bus') return makeBus(x0, x1, bottom, roof, v);
  if (car.model === 'cruiser') return makeParkedCruiser(x0, x1, bottom, roof, i, v);
  return makeCar(x0, x1, bottom, roof, parkedPaint(level, i), 'Sedan', v);
}

// a group's meshes as plain geometry (position, normal, colour) in the group's parent's space: glowing parts apart
function flatten(group: THREE.Object3D): { unlit: THREE.BufferGeometry[]; lit: THREE.BufferGeometry[] } {
  group.updateMatrixWorld(true);
  const out = { unlit: [] as THREE.BufferGeometry[], lit: [] as THREE.BufferGeometry[] };
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const mats = [o.material].flat() as THREE.MeshBasicMaterial[];
    const groups = src.groups.length ? src.groups : [{ start: 0, count: src.getAttribute('position').count, materialIndex: 0 }];
    for (const g of groups) {
      const mat = mats[g.materialIndex ?? 0];
      const pos = src.getAttribute('position');
      const nor = src.getAttribute('normal');
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute((pos.array as Float32Array).slice(g.start * 3, (g.start + g.count) * 3), 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute((nor.array as Float32Array).slice(g.start * 3, (g.start + g.count) * 3), 3));
      const col = new Float32Array(g.count * 3);
      for (let k = 0; k < g.count; k++) col.set([mat.color.r, mat.color.g, mat.color.b], k * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.applyMatrix4(o.matrixWorld);
      (mat instanceof THREE.MeshBasicMaterial ? out.lit : out.unlit).push(geo);
    }
    if (src !== o.geometry) src.dispose();
  });
  return out;
}

// the floor's parked cars for the kit: every car merged, each with its vertex range (see the top)
export function buildParkedCars(level: Level): THREE.Group {
  const root = new THREE.Group();
  root.name = 'parkedCars';
  const state: Parked = { unlit: null, lit: null, ranges: [], shown: new Map() };
  const all = { unlit: [] as THREE.BufferGeometry[], lit: [] as THREE.BufferGeometry[] };
  const at = { unlit: 0, lit: 0 };
  level.cars.forEach((_, i) => {
    const g = parkedGroup(level, i, 0);
    //a roadblock cruiser's light bar lights the street (siren-fx.ts reads it from the kit)
    if (g.userData.sirens) {
      const marker = new THREE.Object3D();
      marker.userData.sirens = g.userData.sirens;
      root.add(marker);
    }
    const f = flatten(g);
    const range = { unlit: { start: at.unlit, count: 0 }, lit: { start: at.lit, count: 0 } };
    for (const k of ['unlit', 'lit'] as const) {
      for (const geo of f[k]) {
        range[k].count += geo.getAttribute('position').count;
        all[k].push(geo);
      }
      at[k] += range[k].count;
    }
    state.ranges.push(range);
  });
  for (const k of ['unlit', 'lit'] as const) {
    if (!all[k].length) continue;
    const merged = mergeGeometries(all[k]);
    for (const g of all[k]) g.dispose();
    if (!merged) continue;
    const mat = k === 'lit' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.userData.keep = true; // its own mesh: batchStatic must not merge it away (the vertex ranges)
    state[k] = mesh;
    root.add(mesh);
  }
  root.userData.parked = state;
  return root;
}

function hideRange(mesh: THREE.Mesh | null, r: Range): void {
  if (!mesh || !r.count) return;
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  for (let v = r.start; v < r.start + r.count; v++) pos.setY(v, -100);
  pos.needsUpdate = true;
}

// parked car i in this kit shows its damage stage: hidden from the merged mesh, drawn on its own. Returns its mesh.
export function damageParked(kit: THREE.Object3D | null, level: Level, i: number, stage: Stage): THREE.Group | null {
  const root = kit?.getObjectByName('parkedCars');
  const state = root?.userData.parked as Parked | undefined;
  if (!root || !state || !state.ranges[i]) return null;
  const was = state.shown.get(i);
  if (was?.stage === stage) return was.mesh;
  if (was) {
    root.remove(was.mesh);
  } else {
    hideRange(state.unlit, state.ranges[i].unlit);
    hideRange(state.lit, state.ranges[i].lit);
  }
  const mesh = parkedGroup(level, i, stage);
  damagedLook(mesh, level.cars[i].model === 'bus' ? 'Bus' : level.cars[i].model === 'cruiser' ? 'Cruiser' : 'Sedan', stage, i);
  inkify(mesh);
  root.add(mesh);
  state.shown.set(i, { mesh, stage, slide: stage === 3 ? 0 : -1 });
  return mesh;
}

// the damaged parked cars in this kit, for their smoke
export function parkedDamage(kit: THREE.Object3D | null): { key: string; mesh: THREE.Group; stage: Stage }[] {
  const state = kit?.getObjectByName('parkedCars')?.userData.parked as Parked | undefined;
  return state ? [...state.shown].map(([i, s]) => ({ key: `p${i}`, mesh: s.mesh, stage: s.stage })) : [];
}

// a damaged car sits off true on its broken springs (a flat tyre when busted); a wreck with no model of its own
// (the code-built fallbacks) is squashed flat instead
export function damagedLook(mesh: THREE.Group, model: string, stage: Stage, seed: number): void {
  if (stage === 3 && !hasModel(model + STAGE_MODEL[3])) mesh.scale.y = 0.55;
  const lean = [0, 0.015, 0.035, 0.04][stage];
  mesh.rotation.z = seed % 2 ? lean : -lean;
  //where it smokes from, over the hood (local, before any turn)
  const box = new THREE.Box3().setFromObject(mesh);
  mesh.userData.smoke = new THREE.Vector3((box.max.x - box.min.x) * (stage === 3 ? 0 : 0.3), box.max.y - 0.25, 0.3);
}

// wrecked parked cars shove back out of the lane; dt in seconds
export function slideParked(kit: THREE.Object3D | null, dt: number): void {
  const state = kit?.getObjectByName('parkedCars')?.userData.parked as Parked | undefined;
  if (!state) return;
  for (const s of state.shown.values()) {
    if (s.slide < 0 || s.slide >= 1) continue;
    s.slide = Math.min(1, s.slide + dt / CAR_FX.slideSecs);
    const k = 1 - (1 - s.slide) ** 3;
    s.mesh.position.z = CAR_FX.backZ * k;
    //a little hop as it's knocked back, then it settles
    s.mesh.position.y = Math.sin(s.slide * Math.PI) * 0.35;
    s.mesh.rotation.y = 0.25 * k;
  }
}

//--- the burst --------------------------------------------------------------------------------------------------

const STEEL = new THREE.Color(0xe2e6ec);
let springGeo: THREE.BufferGeometry | null = null;

// a coil spring, vertex-coloured steel, about 0.56 long
function spring(): THREE.BufferGeometry {
  if (springGeo) return springGeo;
  const pts: THREE.Vector3[] = [];
  const turns = 4.5;
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * turns * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 0.13, (i / 36) * 0.56 - 0.28, Math.sin(a) * 0.13));
  }
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 54, 0.034, 4).toNonIndexed();
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) col.set([STEEL.r, STEEL.g, STEEL.b], k * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  springGeo = g;
  return g;
}

const panels = [0, 1, 2, 3].map((k) => new THREE.BoxGeometry(0.34 + k * 0.06, 0.04, 0.22 + k * 0.05));
const wheel = new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10).rotateX(Math.PI / 2);
const DUST = [[0.62, 0.58, 0.52], [0.5, 0.47, 0.43], [0.72, 0.68, 0.6]];
const SMOKE = [[0.55, 0.55, 0.57], [0.42, 0.42, 0.45]];
const SOOT = [[0.18, 0.17, 0.18], [0.28, 0.26, 0.27]];
const at = new THREE.Vector3();
const SEAT = [[0.3, 0.26, 0.24], [0.85, 0.78, 0.62]]; // seat stuffing

export class CarHopFx {
  private jolts: { mesh: THREE.Object3D; t: number; base: number }[] = [];

  constructor(
    private readonly particles: Particles,
    private readonly pieces: SmashFx,
    private readonly fx: { word(x: number, y: number, word: string): void; shake(amount: number): void },
  ) {}

  // a hop off a car at (x, roof) in world units, its street at `street`; `stage` is what the hop left it at
  hop(x: number, roof: number, street: number, z: number, stage: Stage, paint: number): void {
    const p = this.particles;
    const low = FX.tier === 'low';
    //springs pop out of the roof and the seats under it
    const n = Math.round(CAR_FX.springs[stage] * (low ? 0.5 : 1));
    if (n) this.pieces.burst(Array.from({ length: n }, (_, i) => ({ geometry: spring(), offset: new THREE.Vector3((i - (n - 1) / 2) * 0.2, 0.05, 0.3) })), x, roof, z, street, -1, 1.5);
    //dust bursts out of it, puffing out round the roof and down the sides
    p.spray(x, roof, { z: z + 0.4, n: stage === 3 ? 34 : 20, colors: DUST, life: [0.6, 1.1], size: [0.26, 0.4], size1: 0.85, speed: [1.2, 3.6], angle: [-Math.PI * 0.1, Math.PI * 1.1], drag: 3, grav: -0.4, alpha: 0.9, fadeFrom: 0, radius: 0.35 });
    p.dust(x, roof, 1.4);
    p.spray(x, roof, { z: z + 0.4, n: stage >= 2 ? 8 : 4, colors: SEAT, life: [0.4, 0.7], size: [0.06, 0.1], speed: [2, 4], angle: [Math.PI * 0.2, Math.PI * 0.8], grav: 12, drag: 1, ink: true, floor: street });
    this.fx.shake(CAR_FX.shake[stage]);
    if (stage < 3) {
      if (stage === 2) this.fx.word(x, roof + 0.9, Math.random() < 0.5 ? 'KRUNCH!' : 'SPROING!');
      return;
    }
    //totaled: panels and a wheel go flying, a big dust cloud, sparks off the street
    this.pieces.burst(panels.map((g, i) => ({ geometry: g, offset: new THREE.Vector3((i - 1.5) * 0.4, 0.1 + i * 0.05, 0.2) })), x, roof, z, street, paint, 1.4);
    this.pieces.burst([{ geometry: wheel, offset: new THREE.Vector3(0.6, -0.4, 0.4) }], x, roof, z, street, 0x111114, 1.2);
    p.debris(x, street, 1);
    p.dust(x - 0.8, street, 1.6);
    p.dust(x + 0.8, street, 1.6);
    this.fx.word(x, roof + 1.1, 'TOTALED!');
  }

  // the car takes the hop: its body squashes down on its springs and wobbles back up
  jolt(mesh: THREE.Object3D | null | undefined): void {
    if (!mesh) return;
    const was = this.jolts.find((j) => j.mesh === mesh);
    if (was) was.t = 0;
    else this.jolts.push({ mesh, t: 0, base: mesh.scale.y });
  }

  // dt in game seconds; `damaged` are the dented cars on screen: busted ones smoke from the hood, wrecks smoulder
  update(dt: number, damaged: { key: string; mesh: THREE.Object3D; stage: Stage }[]): void {
    for (const j of [...this.jolts]) {
      j.t += dt;
      const k = Math.exp(-j.t * 7) * Math.cos(j.t * 28);
      j.mesh.scale.y = j.base * (1 - 0.14 * k);
      if (j.t > 0.6) {
        j.mesh.scale.y = j.base;
        this.jolts.splice(this.jolts.indexOf(j), 1);
      }
    }
    for (const d of damaged) {
      if (d.stage < 2 || !d.mesh.parent) continue;
      const off = d.mesh.userData.smoke as THREE.Vector3 | undefined;
      at.copy(off ?? at.set(0, 1, 0)).applyMatrix4(d.mesh.matrixWorld);
      const wreck = d.stage === 3;
      this.particles.stream(`car-${d.key}`, at.x, at.y, wreck ? 7 : 5, dt, { z: at.z, n: 1, colors: wreck ? SOOT : SMOKE, life: [0.9, 1.5], size: [0.14, 0.22], size1: 0.7, speed: [0.3, 0.8], angle: [Math.PI * 0.35, Math.PI * 0.65], drag: 0.6, grav: -1.4, alpha: 0.55, fadeFrom: 0 });
    }
  }
}
