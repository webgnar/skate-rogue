// What the Heat looks like past the light bar: the cruiser's pillar searchlight hunting for the skater, and the
// drone's scan beam sweeping the street. Both are additive fakes (no real lights), brighter at night. They sweep
// smoothly and lock on as Heat climbs; nothing flashes.
import * as THREE from 'three';
import { beamMaterial } from './night';

export const HEAT_BEAMS = {
  searchFrom: 45, // Heat where the searchlight comes on
  searchLock: 85, // ...and where it holds on the skater
  searchWander: 2.2, // tiles either side of the skater it hunts at low Heat
  searchRadius: 0.16, // beam radius at the target, per tile of distance
  dayStrength: 0.45, // how strong the beams are in daylight (1 at night)
  scanSweep: 1.6, // drone scan sweeps per second, there and back
  scanWidth: 3.2, // tiles the scan covers either side of straight down
};

const coneGeo = new THREE.ConeGeometry(1, 1, 16, 1, true).translate(0, -0.5, 0).rotateZ(Math.PI / 2); // tip at the origin, along +x
const poolGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const fanGeo = (() => {
  //a thin flat wedge: tip at the origin, opening downwards, 1 deep and 0.12 wide
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.06, -1, 0, 0.06, -1, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 0, 0, 1, 0], 2));
  return g;
})();

export class HeatBeams {
  readonly group = new THREE.Group();
  private readonly searchMat = beamMaterial(0xf4f8ff);
  private readonly searchPoolMat = beamMaterial(0xf4f8ff);
  private readonly scanMat = beamMaterial(0xff3040);
  private readonly scanPoolMat = beamMaterial(0xff3040);
  private readonly search = new THREE.Mesh(coneGeo, this.searchMat);
  private readonly searchPool = new THREE.Mesh(poolGeo, this.searchPoolMat);
  private readonly scan = new THREE.Mesh(fanGeo, this.scanMat);
  private readonly scanPool = new THREE.Mesh(poolGeo, this.scanPoolMat);
  private night = 0;
  private t = 0;
  private aimX = 0;

  constructor() {
    this.searchPoolMat.uniforms.uPool.value = 1;
    this.scanPoolMat.uniforms.uPool.value = 1;
    for (const m of [this.search, this.searchPool, this.scan, this.scanPool]) {
      m.frustumCulled = false;
      m.renderOrder = 3;
      m.visible = false;
    }
    this.group.add(this.search, this.searchPool, this.scan, this.scanPool);
  }

  // night 0..1 from the mood
  setNight(amount: number): void {
    this.night = amount;
  }

  private get strength(): number {
    return HEAT_BEAMS.dayStrength + (1 - HEAT_BEAMS.dayStrength) * this.night;
  }

  // the cruiser's searchlight from `from` (world units) at a skater standing at (x, ground); heat 0..100
  searchlight(from: THREE.Vector3 | null, x: number, ground: number, heat: number, caught: boolean, dt: number): void {
    this.t += dt;
    const k = caught ? 1 : from ? THREE.MathUtils.smoothstep(heat, HEAT_BEAMS.searchFrom, HEAT_BEAMS.searchFrom + 15) : 0;
    this.search.visible = this.searchPool.visible = k > 0.01;
    if (!this.search.visible || !from) return;
    //hunting: it wanders round the skater, closing in until it holds on them
    const lock = caught ? 1 : THREE.MathUtils.smoothstep(heat, HEAT_BEAMS.searchFrom, HEAT_BEAMS.searchLock);
    const wander = (1 - lock) * HEAT_BEAMS.searchWander * (Math.sin(this.t * 1.3) * 0.7 + Math.sin(this.t * 2.9) * 0.3);
    const want = x + wander;
    this.aimX += (want - this.aimX) * Math.min(1, dt * 4);
    if (Math.abs(this.aimX - want) > 6) this.aimX = want;
    const dx = this.aimX - from.x;
    const dy = ground + 0.6 - from.y;
    const dist = Math.hypot(dx, dy);
    this.search.position.copy(from);
    this.search.rotation.set(0, 0, Math.atan2(dy, dx));
    const r = dist * HEAT_BEAMS.searchRadius;
    this.search.scale.set(dist, r, r);
    this.searchPool.position.set(this.aimX, ground + 0.03, from.z);
    this.searchPool.scale.set(r * 1.8, 1, r * 1.1);
    this.searchMat.uniforms.uAmt.value = k * this.strength * 1.6;
    this.searchPoolMat.uniforms.uAmt.value = k * this.strength * (0.8 + 0.6 * lock);
  }

  // the drone's scan beam from its eye `from`, sweeping the street below it
  droneScan(from: THREE.Vector3 | null, ground: number): void {
    this.scan.visible = this.scanPool.visible = from !== null;
    if (!from) return;
    const depth = Math.max(0.5, from.y - ground);
    const sweep = Math.sin(this.t * Math.PI * HEAT_BEAMS.scanSweep);
    const angle = Math.atan2(sweep * HEAT_BEAMS.scanWidth, depth);
    const reach = Math.hypot(depth, sweep * HEAT_BEAMS.scanWidth);
    this.scan.position.copy(from);
    this.scan.rotation.set(0, 0, angle);
    this.scan.scale.set(reach * 1.5, reach, 1);
    this.scanPool.position.set(from.x + sweep * HEAT_BEAMS.scanWidth, ground + 0.03, from.z);
    this.scanPool.scale.set(0.45, 1, 0.9);
    this.scanMat.uniforms.uAmt.value = this.strength * 2.2;
    this.scanPoolMat.uniforms.uAmt.value = this.strength * 1.4;
  }
}
