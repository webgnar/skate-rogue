// The roadblock's parked cruisers: their light bars throw red and blue pools on the street, swapping slowly from
// one side to the other (never a hard strobe; held steady with reduce-flashing). Two instanced draws for all of
// them, brighter at night.
import * as THREE from 'three';
import { beamMaterial } from './night';
import { FX } from './fx-settings';

export const SIREN = {
  sweep: 0.9, // red-blue swaps per second, like the chasing cruiser's light (heat-light.ts)
  size: 4.5, // pool across, tiles
  day: 0.55, // strength by day (1 at night)
  steady: 0.6, // each colour's share when flashing is reduced
};

export interface Siren {
  x: number; // the light bar, world units
  y: number; // the ground under it
  z: number;
  color: 'red' | 'blue';
}

const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export class SirenFx {
  readonly group = new THREE.Group();
  private red: THREE.InstancedMesh | null = null;
  private blue: THREE.InstancedMesh | null = null;
  private readonly redMat = beamMaterial(0xff2a2a);
  private readonly blueMat = beamMaterial(0x2a6bff);
  private night = 0;
  private t = 0;

  constructor() {
    this.redMat.uniforms.uPool.value = 1;
    this.blueMat.uniforms.uPool.value = 1;
  }

  // the cruisers in a fresh kit carry their light bars in userData.sirens
  build(kit: THREE.Object3D): void {
    this.group.clear();
    this.red?.dispose();
    this.blue?.dispose();
    this.red = this.blue = null;
    const all: Siren[] = [];
    kit.traverse((o) => {
      if (o.userData.sirens) all.push(...(o.userData.sirens as Siren[]));
    });
    const make = (list: Siren[], mat: THREE.ShaderMaterial) => {
      if (!list.length) return null;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      const mx = new THREE.Matrix4();
      list.forEach((s, i) => m.setMatrixAt(i, mx.compose(new THREE.Vector3(s.x, s.y + 0.04, s.z + 0.8), new THREE.Quaternion(), new THREE.Vector3(SIREN.size, 1, SIREN.size * 0.7))));
      m.frustumCulled = false;
      m.renderOrder = 3;
      this.group.add(m);
      return m;
    };
    this.red = make(all.filter((s) => s.color === 'red'), this.redMat);
    this.blue = make(all.filter((s) => s.color === 'blue'), this.blueMat);
  }

  setNight(amount: number): void {
    this.night = amount;
  }

  // the share of the light each colour has now: 0..1, summing to about 1
  static mix(t: number, steady: boolean): [number, number] {
    if (steady) return [SIREN.steady, SIREN.steady];
    const r = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * SIREN.sweep);
    return [r, 1 - r];
  }

  update(dt: number): void {
    this.t += dt;
    const k = SIREN.day + (1 - SIREN.day) * this.night;
    const [r, b] = SirenFx.mix(this.t, FX.reduceFlashing);
    this.redMat.uniforms.uAmt.value = r * k * 1.4;
    this.blueMat.uniforms.uAmt.value = b * k * 1.4;
  }
}
