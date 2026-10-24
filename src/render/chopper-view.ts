// The helicopter on its escape: a dark AI chopper high over the street and its spotlight, a cone of light down to a
// pool on the asphalt. The light warms to white-hot and the pool pulses when it has the skater; it can't reach
// under the L tracks, so the pool vanishes there.
import * as THREE from 'three';
import { CHOPPER, type Chopper } from '../sim/chopper';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import { toX, toY } from './kit';

const HIGH = 5.6; // tiles over the street: in the top of the frame, over the L tracks

export class ChopperView {
  readonly group = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly rotor: THREE.Mesh;
  private readonly cone: THREE.Mesh;
  private readonly pool: THREE.Mesh;
  private readonly coneMat: THREE.MeshBasicMaterial;
  private readonly poolMat: THREE.MeshBasicMaterial;
  private t = 0;

  constructor() {
    const dark = new THREE.MeshLambertMaterial({ color: 0x1d1f28 });
    const hull = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), dark);
    hull.scale.set(1.5, 0.75, 0.8);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.18), dark);
    tail.position.set(-1.8, 0.15, 0);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.6, 0.08), dark);
    fin.position.set(-2.8, 0.4, 0);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    eye.position.set(0.95, 0.05, 0);
    const skid = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.06), dark);
    skid.position.set(0, -0.62, 0.45);
    const skid2 = skid.clone();
    skid2.position.z = -0.45;
    this.rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.03, 24),
      new THREE.MeshBasicMaterial({ color: 0x9aa0b0, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    this.rotor.position.y = 0.65;
    this.body.add(hull, tail, fin, eye, skid, skid2, this.rotor);
    this.body.position.set(0, HIGH, -1);

    const r = CHOPPER.radius / TILE;
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    //apex at the chopper, the open base on the street
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(r, HIGH - 0.6, 24, 1, true).translate(0, -(HIGH - 0.6) / 2, 0), this.coneMat);
    this.cone.position.set(0, HIGH - 0.6, -0.5);
    this.poolMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
    this.pool = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), this.poolMat);
    this.pool.scale.z = 1.4;
    this.pool.position.y = 0.03;
    this.group.add(this.body, this.cone, this.pool);
    this.group.visible = false;
  }

  update(level: Level, ch: Chopper | null, dt: number): void {
    this.group.visible = ch !== null;
    if (!ch) return;
    this.t += dt;
    const x = toX(ch.x);
    const street = toY(level, level.streetY);
    this.group.position.set(x, street, 0);
    //banks the way it flies, and the rotor spins
    this.body.rotation.z = -Math.max(-0.3, Math.min(0.3, ch.v * 0.05));
    this.body.position.y = HIGH + Math.sin(this.t * 2.1) * 0.12;
    this.rotor.rotation.y += dt * 40;
    const hot = ch.lit ? 0.5 + 0.5 * Math.sin(this.t * 18) : 0;
    this.coneMat.opacity = 0.22 + 0.16 * (ch.lit ? 1 : 0);
    this.coneMat.color.setHex(ch.lit ? 0xfff8e0 : 0xffe9a0);
    this.poolMat.opacity = 0.5 + 0.35 * hot;
    //no pool where the L tracks are overhead
    this.pool.visible = !ch.covers.some((c) => ch.x >= c.x0 && ch.x <= c.x1);
  }
}
