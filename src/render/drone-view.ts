// The drone swarm on its escape: the Blender enforcer drone (art/drone.py) for each drone, swooping down into the
// skate lane and hovering with its red eye on the skater; stomped ones tumble away spinning. Hovering drones hang a
// faint red scan line under them so a head-high one reads at a glance.
import * as THREE from 'three';
import { DRONE, type Swarm } from '../sim/drones';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import { toX, toY } from './kit';
import { model } from './models';
import { inkify } from './toon';

const W = DRONE.w / TILE;
const H = DRONE.h / TILE;

function makeDrone(): { group: THREE.Group; rotors: THREE.Mesh[] } {
  const group = new THREE.Group();
  const rotors: THREE.Mesh[] = [];
  const body = model('Drone');
  if (body) {
    //the Blender drone faces -x, back at the skater, about 0.6 tiles across at this scale
    const inner = new THREE.Group();
    inner.add(body);
    for (let i = 0; i < 4; i++) {
      const r = model(`Rotor${i}`);
      if (r) {
        rotors.push(r);
        inner.add(r);
      }
    }
    inner.scale.setScalar(2.3);
    group.add(inner);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(W, H * 0.8, 0.8), new THREE.MeshLambertMaterial({ color: 0x30303a }));
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.3), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    eye.position.set(-W / 2, -0.05, 0);
    group.add(box, eye);
    for (const [x, z] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 10), new THREE.MeshBasicMaterial({ color: 0x9aa0b0, transparent: true, opacity: 0.5 }));
      r.position.set(x, H / 2, z);
      rotors.push(r);
      group.add(r);
    }
  }
  inkify(group);
  return { group, rotors };
}

export class DroneView {
  readonly group = new THREE.Group();
  private drones: { group: THREE.Group; rotors: THREE.Mesh[]; scan: THREE.Mesh }[] = [];
  private swarm: Swarm | null = null;
  private readonly scanMat = new THREE.MeshBasicMaterial({ color: 0xff3040, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });

  // build the meshes for a floor's swarm (or clear them)
  set(swarm: Swarm | null): void {
    if (swarm === this.swarm) return;
    for (const d of this.drones) this.group.remove(d.group, d.scan);
    this.drones = [];
    this.swarm = swarm;
    if (!swarm) return;
    for (let i = 0; i < swarm.drones.length; i++) {
      const d = makeDrone();
      const scan = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.9, 0.04), this.scanMat);
      this.group.add(d.group, scan);
      this.drones.push({ ...d, scan });
    }
  }

  update(level: Level, swarm: Swarm | null, dt: number): void {
    this.set(swarm);
    if (!swarm) return;
    swarm.drones.forEach((d, i) => {
      const v = this.drones[i];
      const visible = d.state !== 'down' || d.t < 120;
      v.group.visible = visible;
      v.scan.visible = d.state === 'hover';
      if (!visible) return;
      //the box's middle, in front of the skate lane
      const x = toX(d.x) + W / 2;
      const y = toY(level, d.roof) - H / 2;
      v.group.position.set(x, y, 0.2);
      if (d.state === 'dive') v.group.rotation.set(0, 0, 0.5 * (1 - d.t / DRONE.diveFrames)); // nose down in the swoop
      else if (d.state === 'down') v.group.rotation.set(d.t * 0.05, 0, d.t * 0.18);
      else v.group.rotation.set(0, 0, Math.sin(d.roof * 0.5) * 0.04);
      v.scan.position.set(x, y - H / 2 - 0.08, 0.25);
      for (const [j, r] of v.rotors.entries()) r.rotation.y += (j % 3 === 0 ? 1 : -1) * dt * 60;
    });
  }
}
