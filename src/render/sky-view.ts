// The sky over the top route (src/sim/sky.ts): the pigeon flocks, inked chevrons sitting on the rooftops and the wire,
// flapping off up as you come over (or into) them, and the airliners crossing the sky far behind the city, a contrail behind each,
// more often while you're up (zack: "the upper route has birds flying by and airplanes"). The helicopter is the
// escape's chopper view (src/render/chopper-view.ts) fed the top route's.
import * as THREE from 'three';
import type { Level } from '../physics/level';
import type { Sky } from '../sim/sky';
import { toX, toY } from './kit';

const BIRDS = 5; // pigeons a flock
const PLANE_Z = -45; // far behind the street
const PLANE_EVERY = [9, 18]; // seconds between airliners, down on the street (halved up top)

export class SkyView {
  readonly group = new THREE.Group();
  private readonly flocks: THREE.Group[] = [];
  private readonly ink = new THREE.MeshBasicMaterial({ color: 0x1a1a22, side: THREE.DoubleSide });
  private readonly wing: THREE.BufferGeometry;
  private readonly plane: THREE.Group;
  private readonly trail: THREE.Mesh;
  private planeT = 6;
  private planeX = 0;
  private flying = false;
  private t = 0;

  constructor() {
    //one wing: a flat triangle from the body out, flapped about the body's axis
    this.wing = new THREE.BufferGeometry();
    this.wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.12, 0, 0.3, 0.12, 0.02, 0.24], 3));
    //an airliner: fuselage, wings, tail, a pale grey on the sky
    const hull = new THREE.MeshBasicMaterial({ color: 0x6d7484 });
    this.plane = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 4.2, 8).rotateZ(Math.PI / 2), hull);
    const wings = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 4.4), hull);
    wings.position.x = 0.2;
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1, 0.08), hull);
    tail.position.set(-1.9, 0.5, 0);
    this.plane.add(body, wings, tail);
    this.trail = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 0.18).translate(-15 - 2.2, 0, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.plane.add(this.trail);
    this.plane.visible = false;
    this.group.add(this.plane);
  }

  // build the flocks for a floor
  reset(sky: Sky): void {
    for (const f of this.flocks) this.group.remove(f);
    this.flocks.length = 0;
    sky.flocks.forEach((_, i) => {
      const g = new THREE.Group();
      for (let b = 0; b < BIRDS; b++) {
        const bird = new THREE.Group();
        const l = new THREE.Mesh(this.wing, this.ink);
        const r = new THREE.Mesh(this.wing, this.ink);
        r.scale.z = -1;
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), this.ink);
        body.scale.x = 2.2;
        bird.add(l, r, body);
        //scattered in a loose bunch, each its own phase
        const k = (i * 13 + b * 7) % 11;
        bird.position.set((b - 2) * 0.32 + (k % 3) * 0.08, ((k % 5) - 2) * 0.12, 0.2 + (k % 3) * 0.15);
        bird.userData.phase = k * 0.6;
        g.add(bird);
      }
      this.flocks.push(g);
      this.group.add(g);
    });
  }

  update(level: Level, sky: Sky, skaterX: number, skaterY: number, up: boolean, dt: number): void {
    this.t += dt;
    sky.flocks.forEach((f, i) => {
      const g = this.flocks[i];
      if (!g) return;
      g.visible = Math.abs(f.x - skaterX) < 900 && f.y > -2000;
      if (!g.visible) return;
      g.position.set(toX(f.x), toY(level, f.y), 0);
      for (const bird of g.children) {
        const flap = f.state === 'perch' ? -0.15 : Math.sin(this.t * 24 + bird.userData.phase) * 0.9;
        bird.children[0].rotation.x = flap;
        bird.children[1].rotation.x = -flap;
        //sat facing you, then away up when they scatter
        bird.rotation.y = f.state === 'scatter' ? 0 : Math.PI;
      }
    });
    //an airliner now and then, left to right far behind
    if (!this.flying) {
      this.planeT -= dt * (up ? 2 : 1);
      if (this.planeT <= 0) {
        this.flying = true;
        this.planeX = toX(skaterX) - 40;
        this.plane.visible = true;
      }
    } else {
      this.planeX += dt * 6;
      if (this.planeX > toX(skaterX) + 45) {
        this.flying = false;
        this.plane.visible = false;
        this.planeT = PLANE_EVERY[0] + ((Math.floor(this.t * 7) % 10) / 10) * (PLANE_EVERY[1] - PLANE_EVERY[0]);
      }
    }
    if (this.flying) this.plane.position.set(this.planeX, toY(level, skaterY) + 9, PLANE_Z);
  }
}
