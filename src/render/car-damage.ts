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
import { makeBus, makeCar, makeParkedCruiser, parkedPaint, streetCar, toX, toY, type CarModel } from './kit';
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
  if (car.model === 'jet') return makeJet(x0, x1, bottom, roof, stage);
  return makeCar(x0, x1, bottom, roof, parkedPaint(level, i), parkedModel(level, i), v);
}

// act 4's ceiling (src/gen/escape.ts): one of the AI's fighter jets flying in the line across the sky, nose +x
// (zack, Nov 10 2026: "a fighter jet instead of a helicopter"). A gunmetal fuselage along its box's top (you land
// on its spine or slam into its nose), a pointed nose with the AI's red eye, a dark canopy, swept wings out across
// the lane, twin tail fins, missiles slung under it to fill the box, an afterburner lit at the tail. A stomped one
// noses down, its eye and its burner going dark.
export function makeJet(x0: number, x1: number, bottom: number, roof: number, stage: Stage): THREE.Group {
  const g = new THREE.Group();
  const w = x1 - x0;
  const h = roof - bottom;
  const hurt = stage > 1;
  const hull = new THREE.MeshLambertMaterial({ color: hurt ? 0x3a3e46 : 0x6a7486 });
  const plate = new THREE.MeshLambertMaterial({ color: 0x3a4252 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2440 });
  const stripe = new THREE.MeshLambertMaterial({ color: 0xc02a2a });
  const white = new THREE.MeshLambertMaterial({ color: 0xdfe4ea });
  const eye = new THREE.MeshBasicMaterial({ color: hurt ? 0x401010 : 0xff2a2a });
  const burn = new THREE.MeshBasicMaterial({ color: hurt ? 0x2a1a10 : 0xffa040 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rz = 0, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    g.add(m);
    return m;
  };
  const along = -Math.PI / 2; // a cylinder or cone stands on y: this lays it along x, its top forward
  //the fuselage: a long slim tube, tapering to the tail, high in the box so its back is the deck you land on
  const r = h * 0.17;
  const cy = roof - h * 0.36;
  const tail = x0 + w * 0.08;
  const neck = x1 - w * 0.3;
  add(new THREE.CylinderGeometry(r, r * 0.8, neck - tail, 10), hull, (tail + neck) / 2, cy, 0, along);
  add(new THREE.BoxGeometry((neck - tail) * 0.7, h * 0.05, r * 1.1), plate, (tail + neck) / 2, cy + r * 0.95, 0); // the spine
  //the nose: a long cone forward, the AI's red eye glowing in its tip, a red band behind it
  add(new THREE.ConeGeometry(r, x1 - neck, 10), hull, (neck + x1) / 2, cy, 0, along);
  add(new THREE.SphereGeometry(r * 0.32, 8, 6), eye, x1 - w * 0.07, cy, 0);
  add(new THREE.CylinderGeometry(r * 1.03, r * 1.03, w * 0.03, 10), stripe, neck, cy, 0, along);
  //the bubble canopy, just behind the nose
  const canopy = add(new THREE.SphereGeometry(1, 12, 8), glass, neck - w * 0.08, cy + r * 0.75, 0);
  canopy.scale.set(w * 0.13, r * 0.6, r * 0.62);
  //the intakes either side of the cockpit, under the wing roots
  for (const z of [-1, 1]) add(new THREE.BoxGeometry(w * 0.26, r * 0.9, r * 0.5), plate, neck - w * 0.24, cy - r * 0.35, z * r * 1.05);
  //swept delta wings out across the lane, front and back of the street: the root along the fuselage, the tip back
  const wing = new THREE.Shape();
  wing.moveTo(0, 0);
  wing.lineTo(-w * 0.38, 0);
  wing.lineTo(-w * 0.5, 1.5);
  wing.lineTo(-w * 0.4, 1.5);
  wing.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wing, { depth: 0.06, bevelEnabled: false });
  for (const sz of [-1, 1]) {
    //the shape's y is out along the wing: tipped flat so it runs along z, one each side
    add(wingGeo, hull, neck - w * 0.08, cy - r * 0.3, 0, 0, sz * Math.PI / 2);
    add(new THREE.BoxGeometry(w * 0.1, 0.07, 0.12), stripe, neck - w * 0.08 - w * 0.45, cy - r * 0.3, sz * 1.5); // red tips
    //tailplanes, small, at the back
    add(new THREE.BoxGeometry(w * 0.14, 0.05, 0.75), hull, tail + w * 0.07, cy - r * 0.2, sz * 0.45);
    //twin fins, swept back and canted out, up to the box's roof
    const fin = add(new THREE.BoxGeometry(w * 0.13, h * 0.42, 0.05), plate, tail + w * 0.11, roof - h * 0.22, sz * r * 0.6, 0.45);
    fin.rotation.x = -sz * 0.22;
    add(new THREE.BoxGeometry(w * 0.08, h * 0.05, 0.07), stripe, tail + w * 0.11 - h * 0.21 * Math.sin(0.45), roof - h * 0.03, sz * (r * 0.6 + h * 0.21 * Math.sin(0.22)), 0.45); // red fin tips
    //a missile slung under each wing, down in the box's lower half: white body, red nose
    const len = w * 0.3;
    const mx = neck - w * 0.32;
    const my = bottom + h * 0.25;
    add(new THREE.BoxGeometry(0.05, cy - r * 0.3 - my, 0.05), plate, mx, (cy - r * 0.3 + my) / 2, sz * 0.7); // the pylon
    add(new THREE.CylinderGeometry(0.08, 0.08, len, 8), white, mx, my, sz * 0.7, along);
    add(new THREE.ConeGeometry(0.08, 0.2, 8), stripe, mx + len / 2 + 0.1, my, sz * 0.7, along);
  }
  //the engine nozzle and its afterburner, lit
  add(new THREE.CylinderGeometry(r * 0.75, r * 0.85, w * 0.05, 10), plate, tail - w * 0.02, cy, 0, along);
  const flame = add(new THREE.ConeGeometry(r * 0.6, w * 0.18, 10), burn, tail - w * 0.13, cy, 0, Math.PI / 2); // points back
  flame.name = 'flame';
  if (stage >= 2) g.rotation.z = -0.06 * (stage - 1); // stomped: it noses down
  return g;
}

// which body a parked car is (a bus and a cruiser aside): the Prius or one of the blender bot's cars
function parkedModel(level: Level, i: number): CarModel {
  return streetCar(i * 3 + level.layout.floor);
}

// a group's meshes as plain geometry (position, normal, colour) in the group's parent's space: glowing parts apart
function flatten(group: THREE.Object3D): { unlit: THREE.BufferGeometry[]; lit: THREE.BufferGeometry[] } {
  group.updateMatrixWorld(true);
  const out = { unlit: [] as THREE.BufferGeometry[], lit: [] as THREE.BufferGeometry[] };
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const src = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const mats = [o.material].flat() as THREE.MeshBasicMaterial[];
    //one material for the whole mesh covers all its groups (a BoxGeometry has a group per face: the cruiser's light bar)
    const groups = src.groups.length && mats.length > 1 ? src.groups : [{ start: 0, count: src.getAttribute('position').count, materialIndex: 0 }];
    for (const g of groups) {
      const mat = mats[g.materialIndex ?? 0] ?? mats[0];
      if (!mat?.color) continue;
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
  if (level.cars[i].model !== 'jet') damagedLook(mesh, level.cars[i].model === 'bus' ? 'Bus' : level.cars[i].model === 'cruiser' ? 'Cruiser' : parkedModel(level, i), stage, i);
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

// a damaged car's look beyond its model: where its smoke rises from
export function damagedLook(mesh: THREE.Group, _model: string, stage: Stage, _seed: number): void {
  //no squash, no lean: a damaged car keeps its shape, and its damage is all in its surface (zack, 2026-11-05: "i dont
  //like damaged. changes the shape of the car"; art/car_damage.py)
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
    p.dust(x, roof, 1.4, true);
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
    p.dust(x - 0.8, street, 1.6, true);
    p.dust(x + 0.8, street, 1.6, true);
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
