// What each floor twist (src/gen/twists.ts) looks like in the one city: currents as gusts of wind, streaks blowing
// the way it pushes with chalk arrows on the street; a low ceiling as the underside of a concrete overpass with its
// girders and a sodium lamp; crumbling ledges as old-town marble; conveyor rails as glowing chevrons running along
// the bar (cyan forward, orange back). Placeholders the models and effects threads can replace.
import * as THREE from 'three';
import type { Level, Surface } from '../physics/level';
import type { Skater } from '../physics/skater';
import { FX } from './fx-settings';
import { toX, toY } from './kit';
import { inkify } from './toon';

const STREAKS = 28; // per current
const CHEVRON_GAP = 0.8; // world units between conveyor chevrons
const FLOW = 2.2; // units a second the chevrons travel
const GUST = 3; // the wind streaks travel this much faster

interface Mover {
  mesh: THREE.InstancedMesh;
  x0: number;
  x1: number;
  dir: number;
  base: { x: number; y: number; z: number }[];
}

function chevron(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-0.12, -0.12);
  s.lineTo(0, -0.12);
  s.lineTo(0.14, 0);
  s.lineTo(0, 0.12);
  s.lineTo(-0.12, 0.12);
  s.lineTo(0.02, 0);
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

export class TwistView {
  readonly group = new THREE.Group();
  private movers: Mover[] = [];
  private t = 0;
  private ruins: { s: Surface; mesh: THREE.Object3D; y: number; drop: number }[] = [];
  private readonly dummy = new THREE.Object3D();

  set(level: Level): void {
    this.group.clear();
    this.movers = [];
    this.ruins = [];
    for (const s of level.surfaces) if (s.crumble) this.addRuin(level, s);
    for (const c of level.currents ?? []) this.addCurrent(level, c.x0, c.x1, Math.sign(c.push));
    for (const c of level.ceiling ?? []) this.addCeiling(level, c.x0, c.x1, c.y);
    for (const s of level.surfaces) if (s.conveyor) this.addConveyor(toX(s.x0), toX(s.x1), toY(level, s.y), Math.sign(s.conveyor));
  }

  update(dt: number, sk: Skater): void {
    this.t += dt;
    for (const r of this.ruins) {
      const shaking = sk.crumbling.has(r.s);
      if (sk.gone.has(r.s)) r.drop += dt * (2 + r.drop * 6);
      r.mesh.position.y = r.y - r.drop;
      r.mesh.position.x = (r.mesh.userData.x as number) + (shaking ? Math.sin(this.t * 60) * 0.03 : 0);
      r.mesh.visible = r.drop < 12;
    }
    for (const m of this.movers) {
      const span = m.x1 - m.x0;
      m.base.forEach((b, i) => {
        const wind = m.mesh.userData.wind ? GUST : 1;
        const x = m.x0 + ((((b.x - m.x0 + m.dir * FLOW * wind * this.t) % span) + span) % span);
        const bob = m.mesh.userData.wind ? Math.sin(this.t * 4 + i) * 0.12 : 0;
        this.dummy.position.set(x, b.y + bob, b.z);
        this.dummy.rotation.set(0, 0, m.dir < 0 ? Math.PI : 0);
        this.dummy.updateMatrix();
        m.mesh.setMatrixAt(i, this.dummy.matrix);
      });
      m.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private addCurrent(level: Level, px0: number, px1: number, dir: number): void {
    const x0 = toX(px0);
    const x1 = toX(px1);
    const n = FX.tier === 'low' ? STREAKS / 2 : STREAKS;
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.9, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }),
      n,
    );
    mesh.userData.wind = true;
    mesh.frustumCulled = false;
    const base = Array.from({ length: n }, (_, i) => ({ x: x0 + ((i * 0.618) % 1) * (x1 - x0), y: 0.4 + ((i * 0.37) % 1) * 3.6, z: -0.8 + ((i * 0.71) % 1) * 1.6 }));
    this.group.add(mesh);
    this.movers.push({ mesh, x0, x1, dir, base });
    //arrows painted on the street, the way it pushes
    const arrows = new THREE.InstancedMesh(chevron(), new THREE.MeshBasicMaterial({ color: 0xf4f0e6, transparent: true, opacity: 0.45, side: THREE.DoubleSide }), Math.max(1, Math.floor((x1 - x0) / 2)));
    arrows.frustumCulled = false;
    const ab = Array.from({ length: arrows.count }, (_, i) => ({ x: x0 + 1 + i * 2, y: toY(level, level.streetY) + 0.02, z: 0.6 }));
    this.group.add(arrows);
    this.movers.push({ mesh: arrows, x0, x1, dir, base: ab.map((b) => ({ ...b, y: b.y + 0.15 })) });
  }

  private addRuin(level: Level, s: Surface): void {
    const w = toX(s.x1 - s.x0);
    const g = new THREE.Group();
    const marble = new THREE.MeshLambertMaterial({ color: 0xe6dccb });
    const crack = new THREE.MeshBasicMaterial({ color: 0x5a4a3a });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, 3), marble);
    slab.position.set(0, -0.175, 0);
    g.add(slab);
    //a broken column stub hanging under it, and cracks across the top
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 10), marble);
    stub.position.set(-w * 0.2, -0.65, 0);
    g.add(stub);
    for (let i = 1; i < w; i += 1.3) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 1.6), crack);
      c.position.set(-w / 2 + i, 0.005, 0.1);
      c.rotation.y = 0.4;
      g.add(c);
    }
    inkify(g);
    const x = toX(s.x0) + w / 2;
    const y = toY(level, s.y);
    g.position.set(x, y, 0);
    g.userData.x = x;
    this.group.add(g);
    this.ruins.push({ s, mesh: g, y, drop: 0 });
  }

  private addCeiling(level: Level, px0: number, px1: number, py: number): void {
    const w = toX(px1 - px0);
    const y = toY(level, py);
    //the overpass deck: concrete, deep enough to reach past the lane both ways
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.6, 7), new THREE.MeshLambertMaterial({ color: 0x8d889a }));
    slab.position.set(toX(px0) + w / 2, y + 0.3, -1.5);
    inkify(slab);
    this.group.add(slab);
    //a sodium lamp strip and the steel girders across its underside (one instanced mesh)
    const light = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.04, 0.3), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
    light.position.set(toX(px0) + w / 2, y - 0.01, 0.4);
    this.group.add(light);
    const xs: number[] = [];
    for (let x = toX(px0) + 1; x < toX(px1); x += 2) xs.push(x);
    if (!xs.length) return;
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.3, 7), new THREE.MeshLambertMaterial({ color: 0x4a4656 }), xs.length);
    xs.forEach((x, i) => {
      this.dummy.position.set(x, y - 0.12, -1.5);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.updateMatrix();
      beams.setMatrixAt(i, this.dummy.matrix);
    });
    this.group.add(beams);
  }

  private addConveyor(x0: number, x1: number, y: number, dir: number): void {
    const color = dir > 0 ? 0x3ff0ff : 0xff8a2a;
    const n = Math.max(1, Math.floor((x1 - x0) / CHEVRON_GAP));
    const mesh = new THREE.InstancedMesh(chevron(), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }), n);
    mesh.frustumCulled = false;
    const base = Array.from({ length: n }, (_, i) => ({ x: x0 + (i + 0.5) * CHEVRON_GAP, y: y - 0.06, z: 0.09 }));
    this.group.add(mesh);
    this.movers.push({ mesh, x0, x1, dir, base });
  }
}
