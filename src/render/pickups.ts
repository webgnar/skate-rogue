// Cash coins and Stoken gems floating along the floor's lines. Coins spin; collected ones pop and vanish.
import * as THREE from 'three';
import { inkify } from './toon';
import type { Level } from '../physics/level';
import { laneZ, toX, toY } from './kit';
import { flatGeometry } from './models';

const POP_SECS = 0.18;

export class PickupView {
  readonly group = new THREE.Group();
  private coins: THREE.InstancedMesh | null = null;
  private gems: THREE.InstancedMesh | null = null;
  private slots: { mesh: THREE.InstancedMesh; i: number; x: number; y: number; z: number; popT: number; gone: boolean }[] = [];
  private t = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly v = new THREE.Vector3();
  private readonly s = new THREE.Vector3();

  setLevel(level: Level): void {
    for (const mesh of [this.coins, this.gems]) {
      if (!mesh) continue;
      this.group.remove(mesh);
      mesh.dispose();
    }
    this.slots = [];
    const cash = level.pickups.filter((p) => p.kind === 'cash').length;
    const stoken = level.pickups.length - cash;
    //art/pickups.py: a coin with a rim and a raised $, a brilliant-cut gem; colours baked into the vertices
    const coin = flatGeometry('Coin');
    const gem = flatGeometry('Stoken');
    this.coins = new THREE.InstancedMesh(
      coin ?? new THREE.CylinderGeometry(0.2, 0.2, 0.06, 12).rotateX(Math.PI / 2),
      new THREE.MeshLambertMaterial(coin ? { vertexColors: true, emissive: 0x3a2800 } : { color: 0xffcf3a, emissive: 0x6a4a00 }),
      Math.max(1, cash),
    );
    this.gems = new THREE.InstancedMesh(
      gem ?? new THREE.OctahedronGeometry(0.32),
      new THREE.MeshLambertMaterial(gem ? { vertexColors: true, emissive: 0x2a1460 } : { color: 0xb98cff, emissive: 0x4a2a9a }),
      Math.max(1, stoken),
    );
    this.coins.count = cash;
    this.gems.count = stoken;
    let c = 0;
    let g = 0;
    for (const p of level.pickups) {
      const mesh = p.kind === 'cash' ? this.coins : this.gems;
      const i = p.kind === 'cash' ? c++ : g++;
      this.slots.push({ mesh, i, x: toX(p.x), y: toY(level, p.y), z: 0.25 + laneZ(p), popT: 0, gone: false });
    }
    inkify(this.coins);
    inkify(this.gems);
    this.group.add(this.coins, this.gems);
    this.update(0);
  }

  take(index: number): void {
    const slot = this.slots[index];
    if (slot) slot.popT = POP_SECS;
  }

  update(dt: number): void {
    this.t += dt;
    for (const s of this.slots) {
      if (s.gone) continue;
      let scale = 1;
      let lift = 0;
      if (s.popT > 0) {
        s.popT -= dt;
        const k = 1 - Math.max(0, s.popT) / POP_SECS;
        scale = 1 + k * 0.8;
        lift = k * 0.5;
        if (s.popT <= 0) {
          s.gone = true;
          scale = 0;
        }
      }
      const spin = this.t * 4 + s.x * 0.7;
      this.e.set(0, spin, s.mesh === this.gems ? 0.3 : 0);
      this.q.setFromEuler(this.e);
      this.v.set(s.x, s.y + lift + Math.sin(this.t * 3 + s.x) * 0.05, s.z);
      this.s.setScalar(scale);
      this.m.compose(this.v, this.q, this.s);
      s.mesh.setMatrixAt(s.i, this.m);
    }
    if (this.coins) this.coins.instanceMatrix.needsUpdate = true;
    if (this.gems) this.gems.instanceMatrix.needsUpdate = true;
  }
}
