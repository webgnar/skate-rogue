// The phones the filmers on the sidewalk (peds.ts) hold up: a small cold screen glow that reads at night, and a
// little photo flash when you land a big air in front of one. The flash is a small spot at the phone, never the
// screen, and it's held off with reduce-flashing. Two instanced draws for everyone.
import * as THREE from 'three';
import { beamMaterial } from './night';
import { FX } from './fx-settings';

export const PHONE = {
  glow: 0.55, // screen glow across, tiles
  day: 0.3, // its strength by day (1 at night)
  flash: 1.8, // photo flash across at its peak, tiles
  flashSecs: 0.16, // how long a flash takes to fade
  max: 24, // phones drawn at once
};

export interface Phone {
  x: number;
  y: number;
  z: number;
  since: number; // seconds since this phone snapped a photo (Infinity: never)
}

const geo = new THREE.PlaneGeometry(1, 1); // faces the camera

// how bright a phone's flash is, 0..1, `since` seconds after it went off
export function flashAt(since: number, reduce: boolean): number {
  if (reduce || since < 0 || since >= PHONE.flashSecs) return 0;
  return 1 - since / PHONE.flashSecs;
}

export class PhoneFx {
  readonly group = new THREE.Group();
  private readonly glowMat = beamMaterial(0xcfe6ff);
  private readonly flashMat = beamMaterial(0xffffff);
  private readonly glow = new THREE.InstancedMesh(geo, this.glowMat, PHONE.max);
  private readonly flash = new THREE.InstancedMesh(geo, this.flashMat, PHONE.max);
  private readonly mx = new THREE.Matrix4();
  private readonly at = new THREE.Vector3();
  private readonly size = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private night = 0;

  constructor() {
    for (const m of [this.glow, this.flash]) {
      m.material.uniforms.uPool.value = 1;
      m.frustumCulled = false;
      m.renderOrder = 3;
      m.count = 0;
      this.group.add(m);
    }
    this.flashMat.uniforms.uAmt.value = 2.2;
  }

  setNight(amount: number): void {
    this.night = amount;
  }

  update(phones: Phone[]): void {
    const n = Math.min(phones.length, PHONE.max);
    this.glowMat.uniforms.uAmt.value = (PHONE.day + (1 - PHONE.day) * this.night) * 1.6;
    let f = 0;
    for (let i = 0; i < n; i++) {
      const p = phones[i];
      this.at.set(p.x, p.y, p.z);
      this.glow.setMatrixAt(i, this.mx.compose(this.at, this.q, this.size.setScalar(PHONE.glow)));
      const k = flashAt(p.since, FX.reduceFlashing);
      if (k > 0) this.flash.setMatrixAt(f++, this.mx.compose(this.at, this.q, this.size.setScalar(PHONE.flash * (0.5 + 0.5 * k))));
    }
    this.glow.count = n;
    this.flash.count = f;
    this.glow.instanceMatrix.needsUpdate = true;
    this.flash.instanceMatrix.needsUpdate = true;
    //the flash fades by shrinking; its brightness rides the youngest one
    const youngest = phones.reduce((m, p) => Math.min(m, p.since), Infinity);
    this.flashMat.uniforms.uAmt.value = 2.2 * Math.max(0.3, flashAt(youngest, FX.reduceFlashing));
  }
}
