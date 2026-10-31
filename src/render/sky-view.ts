// The sky over the top route (src/sim/sky.ts): the pigeon flocks, inked pigeons sitting on the rooftops and the wire,
// flapping off up as you come over (or into) them, and the airliners crossing the sky low over the rooftops, a contrail behind each,
// more often while you're up (zack: "the upper route has birds flying by and airplanes"). The helicopter is the
// escape's chopper view (src/render/chopper-view.ts) fed the top route's.
import * as THREE from 'three';
import { at } from '../game/interp';
import type { Level, Surface } from '../physics/level';
import type { Sky } from '../sim/sky';
import { toX, toY } from './kit';
import { model } from './models';
import { inkify } from './toon';
import { SkyPiecesView } from './sky-pieces-view';

const BIRDS = 5; // pigeons a flock
// The airliner (art/airliner.py, from the QFS Chicago level's sprite) flies far behind the street, between the
// buildings at the back of it and the skyline backdrop (zack), so the rooftops cross in front of it. That far off it
// is drawn big, 18 tiles nose to tail, to still read way bigger than it used to.
const PLANE_Z = -34; // the buildings stand to about -10, the skyline backdrops from -60 back
const PLANE_UP = { street: 5.5, top: 5.5 }; // tiles above the skater: this far back, just over the rooftops on screen
const PLANE_S = 1.3; // of the model's 14 tiles
const PLANE_EVERY = [9, 18]; // seconds between airliners, down on the street (halved up top)

export class SkyView {
  readonly group = new THREE.Group();
  private readonly flocks: THREE.Group[] = []; // a plain flock's pigeons are poses (empties), drawn by `parts`
  // every plain pigeon's parts as four instanced meshes: one bird was eight draws with its outlines, and a few
  // flocks in view made the sky route the most draws in the game (~130 of ~400 on a small iPhone). The golden
  // pigeon is one bird, drawn as meshes
  private parts: THREE.InstancedMesh[] = [];
  private readonly feather = new THREE.MeshLambertMaterial({ color: 0x7d8799, side: THREE.DoubleSide });
  private readonly pale = new THREE.MeshLambertMaterial({ color: 0xc9d0dc });
  private readonly gold = new THREE.MeshLambertMaterial({ color: 0xffc81e, emissive: 0x6a4a00 });
  private readonly pieces = new SkyPiecesView();
  private readonly body = new THREE.SphereGeometry(0.14, 8, 6);
  private readonly head = new THREE.SphereGeometry(0.09, 8, 6);
  private readonly wing: THREE.BufferGeometry;
  private readonly rightWing: THREE.BufferGeometry;
  private readonly plane: THREE.Group;
  private readonly trail: THREE.Mesh;
  private planeT = 6;
  private planeX = 0;
  private flying = false;
  private alt = PLANE_UP.street;
  private t = 0;

  constructor() {
    //one wing: a flat triangle from the body out, flapped about the body's axis
    this.wing = new THREE.BufferGeometry();
    this.wing.setAttribute('position', new THREE.Float32BufferAttribute([0.12, 0, 0, -0.2, 0, 0.05, -0.05, 0.02, 0.5], 3));
    //the right wing for the instanced flocks: the left one mirrored across the body (z), wound the other way round
    //as a mirrored mesh draws (instances don't flip their winding the way a mirrored mesh does)
    this.rightWing = new THREE.BufferGeometry();
    this.rightWing.setAttribute('position', new THREE.Float32BufferAttribute([0.12, 0, 0, -0.05, 0.02, -0.5, -0.2, 0, -0.05], 3));
    //an airliner: fuselage, wings, tail, a pale grey on the sky
    this.plane = new THREE.Group();
    const jet = model('Airliner');
    if (jet) {
      this.plane.add(jet);
    } else {
      //the model didn't load: a plain one in the same proportions
      const hull = new THREE.MeshLambertMaterial({ color: 0xe2e2e2 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.5, 14, 8).rotateZ(Math.PI / 2), hull);
      const wings = new THREE.Mesh(new THREE.BoxGeometry(3, 0.14, 13), hull);
      wings.position.x = -0.5;
      const tail = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 0.1), new THREE.MeshLambertMaterial({ color: 0x004d83 }));
      tail.position.set(-5.8, 1.5, 0);
      this.plane.add(body, wings, tail);
    }
    this.plane.rotation.y = Math.PI; // nose the way it flies, left
    this.plane.rotation.x = 0.3; // banked a little toward the camera, so the wings show
    this.plane.scale.setScalar(PLANE_S);
    inkify(this.plane);
    this.trail = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 0.5).translate(-40 - 7, 0.4, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.plane.add(this.trail);
    this.plane.visible = false;
    this.group.add(this.plane, this.pieces.group);
    this.makeParts(4 * BIRDS); // made now, so the loading screen compiles their shaders
  }

  // build the flocks for a floor
  reset(sky: Sky): void {
    for (const f of this.flocks) if (f.parent) this.group.remove(f);
    this.flocks.length = 0;
    this.pieces.reset(sky);
    sky.flocks.forEach((f, i) => {
      const g = new THREE.Group();
      //the golden pigeon: one bird, bigger, all gold
      const gold = f.site.gold;
      g.scale.setScalar(gold ? 1.9 : 1.3);
      for (let b = 0; b < (gold ? 1 : BIRDS); b++) {
        //a pigeon: slate body, pale head, wings folded on its back until it takes off
        const bird = new THREE.Group();
        const part = (geo: THREE.BufferGeometry, mat: THREE.Material) => (gold ? new THREE.Mesh(geo, mat) : new THREE.Object3D());
        const l = part(this.wing, this.gold);
        const r = part(this.wing, this.gold);
        if (gold) r.scale.z = -1; // the instanced flocks' right wing is mirrored in its geometry (rightWing)
        l.position.y = r.position.y = 0.1;
        const body = part(this.body, this.gold);
        body.scale.set(1.6, 1, 1);
        body.position.y = 0.12;
        const head = part(this.head, this.pale);
        head.position.set(0.2, 0.26, 0);
        bird.add(l, r, body, head);
        //sat in a loose row, each its own phase
        const k = (i * 13 + b * 7) % 11;
        bird.position.set(gold ? 0 : (b - 2) * 0.42 + (k % 3) * 0.1, 0, 0.3 + (k % 3) * 0.2);
        bird.userData.phase = k * 0.6;
        g.add(bird);
      }
      this.flocks.push(g);
      if (!gold) return;
      inkify(g);
      this.group.add(g);
    });
    const n = sky.flocks.filter((f) => !f.site.gold).length * BIRDS;
    if (n > this.parts[0].instanceMatrix.count) this.makeParts(n);
    for (const m of this.parts) this.setCount(m, 0);
  }

  // the instanced parts, room for n pigeons (made again only when a floor has more)
  private makeParts(n: number): void {
    for (const m of this.parts) {
      this.group.remove(m);
      m.dispose();
    }
    this.parts = (
      [
        [this.wing, this.feather],
        [this.rightWing, this.feather],
        [this.body, this.feather],
        [this.head, this.pale],
      ] as const
    ).map(([geo, mat]) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.frustumCulled = false;
      inkify(m);
      this.setCount(m, 0);
      this.group.add(m);
      return m;
    });
  }

  // draw the first n instances, and their outlines (inkify's hull shares the instances)
  private setCount(m: THREE.InstancedMesh, n: number): void {
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    for (const h of m.children) if (h instanceof THREE.InstancedMesh) h.count = n;
  }

  update(level: Level, sky: Sky, skaterX: number, skaterY: number, up: boolean, dt: number, gone?: ReadonlySet<Surface>): void {
    this.t += dt;
    this.pieces.update(level, skaterX, gone);
    let n = 0;
    sky.flocks.forEach((f, i) => {
      const g = this.flocks[i];
      if (!g) return;
      g.visible = Math.abs(f.x - skaterX) < 900 && f.y > -2000;
      if (!g.visible) return;
      g.position.set(toX(at(f, 'x')), toY(level, at(f, 'y')), 0);
      for (const bird of g.children) {
        //folded along the back when sat; flapping hard up and away when they go
        const flap = f.state === 'perch' ? -1.3 : Math.sin(this.t * 24 + bird.userData.phase) * 0.9;
        bird.children[0].rotation.x = flap;
        bird.children[1].rotation.x = -flap;
        bird.position.y = f.state === 'perch' ? 0 : Math.sin(this.t * 6 + bird.userData.phase) * 0.15;
        //sat facing you, then away up when they scatter
        bird.rotation.y = f.state === 'scatter' ? 0 : Math.PI;
      }
      if (f.site.gold) return;
      g.updateMatrixWorld(true);
      for (const bird of g.children) {
        bird.children.forEach((part, j) => this.parts[j].setMatrixAt(n, part.matrixWorld));
        n++;
      }
    });
    for (const m of this.parts) this.setCount(m, n);
    //an airliner now and then, left to right far behind
    if (!this.flying) {
      this.planeT -= dt * (up ? 2 : 1);
      if (this.planeT <= 0) {
        this.flying = true;
        this.planeX = toX(skaterX) + 80; // off the side of the frame, which is wide that far back
        this.plane.visible = true;
      }
    } else {
      //coming the other way, so it crosses the frame in a few seconds
      this.planeX -= dt * 16;
      if (this.planeX < toX(skaterX) - 80) {
        this.flying = false;
        this.plane.visible = false;
        this.planeT = PLANE_EVERY[0] + ((Math.floor(this.t * 7) % 10) / 10) * (PLANE_EVERY[1] - PLANE_EVERY[0]);
      }
    }
    //ease between the heights as you go up and come down, so it doesn't jump
    this.alt += ((up ? PLANE_UP.top : PLANE_UP.street) - this.alt) * Math.min(1, dt * 1.5);
    if (this.flying) this.plane.position.set(this.planeX, toY(level, skaterY) + this.alt, PLANE_Z);
  }

  // a sky billboard burst through
  bust(i: number): void {
    this.pieces.bust(i);
  }
}
