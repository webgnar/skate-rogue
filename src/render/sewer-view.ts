// The sewer route's moving pieces (src/sim/sewer.ts), drawn: rat packs scurrying at you down the floor, the flood
// surge's wall of water (with a foam crest) coming down the tunnel behind you, subway trains crossing under the tunnel
// out of the city and back into it, and the sewer alligator, its jaws opening as you come up on it. Greybox shapes,
// inked like the rest of the street.
import * as THREE from 'three';
import { at } from '../game/interp';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import { SEWER_SIM, type SewerSim } from '../sim/sewer';
import { SEWER } from '../gen/sewer';
import { inkify } from './toon';

const TRAIN_LEN = 9; // tiles of train, along the line
const TRAIN_FAR = -40; // where the line comes out of the city (z)
const TRAIN_NEAR = 14; // and where it goes back into it, past the camera

export class SewerView {
  readonly group = new THREE.Group();
  private rats: { mesh: THREE.Group; rat: { x: number; alive: boolean } }[] = [];
  private surges: { mesh: THREE.Group; t: SewerSim['tunnels'][number] }[] = [];
  private trains: { mesh: THREE.Group; light: THREE.Mesh; t: SewerSim['tunnels'][number] }[] = [];
  private gators: { mesh: THREE.Group; jaw: THREE.Object3D; t: SewerSim['tunnels'][number] }[] = [];
  private time = 0;
  private readonly fur = new THREE.MeshLambertMaterial({ color: 0x6a6470 });
  private readonly tail = new THREE.MeshLambertMaterial({ color: 0xe8a0a8 });
  private readonly eye = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
  private readonly water = new THREE.MeshLambertMaterial({ color: 0x3f8f7c, emissive: 0x0c2a22, transparent: true, opacity: 0.82 });
  private readonly foam = new THREE.MeshLambertMaterial({ color: 0xeaf8f2 });
  private readonly car = new THREE.MeshLambertMaterial({ color: 0xa8b0bc });
  private readonly stripe = new THREE.MeshLambertMaterial({ color: 0x2a6ad8 });
  private readonly window = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  private readonly beam = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.35, depthWrite: false });
  private readonly scales = new THREE.MeshLambertMaterial({ color: 0x3f7a3a });
  private readonly belly = new THREE.MeshLambertMaterial({ color: 0xc8c890 });
  private readonly teeth = new THREE.MeshLambertMaterial({ color: 0xffffff });

  // build the pieces for a floor
  reset(level: Level, sim: SewerSim): void {
    this.group.clear();
    this.rats = [];
    this.surges = [];
    this.trains = [];
    this.gators = [];
    const Y = (py: number) => (level.streetY - py) / TILE;
    for (const t of sim.tunnels) {
      const fy = Y(t.s.y);
      for (const rat of t.pack?.rats ?? []) {
        const m = this.rat();
        m.position.set(rat.x / TILE, fy, 0.4 + (rat.x % 3) * 0.5);
        this.group.add(m);
        this.rats.push({ mesh: m, rat });
      }
      if (t.surge) {
        const m = new THREE.Group();
        const h = SEWER_SIM.surgeH / TILE;
        const body = new THREE.Mesh(new THREE.BoxGeometry(1, h, 6.2), this.water);
        body.position.set(-0.5, h / 2, 0.7);
        const crest = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.55, h * 0.55, 6.2, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2), this.foam);
        crest.position.set(-0.1, h, 0.7);
        m.add(body, crest);
        m.position.y = fy;
        m.visible = false;
        this.group.add(m);
        this.surges.push({ mesh: m, t });
      }
      const p = t.s.piece;
      if (p?.kind === 'subway' && t.train) {
        const m = new THREE.Group();
        const w = (p.x1 - p.x0) / TILE + 0.2;
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, 2.8, TRAIN_LEN), this.car);
        body.position.y = -1.4;
        const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.35, TRAIN_LEN + 0.02), this.stripe);
        band.position.y = -1.9;
        m.add(body, band);
        for (let z = -TRAIN_LEN / 2 + 0.8; z < TRAIN_LEN / 2 - 0.5; z += 1.4) {
          for (const x of [-w / 2 - 0.01, w / 2 + 0.01]) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), this.window);
            win.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;
            win.position.set(x, -1.0, z);
            m.add(win);
          }
        }
        inkify(m);
        //the headlight down the line, before a train comes
        const light = new THREE.Mesh(new THREE.ConeGeometry(1.2, 14, 16, 1, true).rotateX(-Math.PI / 2), this.beam);
        light.position.set((p.x0 + p.x1) / 2 / TILE, fy - 1.6, TRAIN_FAR + 7);
        light.visible = false;
        m.position.set((p.x0 + p.x1) / 2 / TILE, fy - 3 / TILE, TRAIN_FAR);
        this.group.add(m, light);
        this.trains.push({ mesh: m, light, t });
      }
      if (t.s.gator && t.gator) {
        const [g0, g1] = t.s.gator;
        const m = new THREE.Group();
        const len = (g1 - g0) / TILE;
        const body = new THREE.Mesh(new THREE.BoxGeometry(len * 0.6, 0.32, 0.6), this.scales);
        body.position.set(len * 0.45, 0.16, 0);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, len * 0.4, 6).rotateZ(-Math.PI / 2), this.scales);
        tail.position.set(len * 0.95, 0.12, 0);
        const head = new THREE.Mesh(new THREE.BoxGeometry(len * 0.3, 0.16, 0.42), this.scales);
        head.position.set(len * 0.03, 0.1, 0);
        const jaw = new THREE.Group();
        const top = new THREE.Mesh(new THREE.BoxGeometry(len * 0.3, 0.14, 0.4), this.scales);
        top.position.set(-len * 0.15, 0.07, 0);
        const fangs = new THREE.Mesh(new THREE.BoxGeometry(len * 0.26, 0.06, 0.36), this.teeth);
        fangs.position.set(-len * 0.15, -0.02, 0);
        jaw.add(top, fangs);
        jaw.position.set(len * 0.18, 0.18, 0);
        const under = new THREE.Mesh(new THREE.BoxGeometry(len * 0.6, 0.06, 0.5), this.belly);
        under.position.set(len * 0.45, 0.02, 0);
        for (const z of [-0.18, 0.18]) {
          const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), this.eye);
          e.position.set(len * 0.12, 0.3, z);
          m.add(e);
        }
        m.add(body, tail, head, jaw, under);
        inkify(m);
        m.position.set(g0 / TILE, fy, 0.2);
        this.group.add(m);
        this.gators.push({ mesh: m, jaw, t });
      }
    }
  }

  private rat(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.fur);
    body.scale.set(1.5, 0.8, 0.8);
    body.position.y = 0.13;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6).rotateZ(Math.PI / 2), this.fur);
    head.position.set(-0.28, 0.13, 0);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.4, 4).rotateZ(Math.PI / 2.4), this.tail);
    tail.position.set(0.36, 0.1, 0);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 4, 3), this.eye);
    e.position.set(-0.26, 0.18, 0.06);
    g.add(body, head, tail, e);
    inkify(g);
    return g;
  }

  update(dt: number): void {
    this.time += dt;
    for (const r of this.rats) {
      r.mesh.visible = r.rat.alive;
      if (!r.rat.alive) continue;
      r.mesh.position.x = at(r.rat, 'x') / TILE;
      r.mesh.rotation.z = Math.sin(this.time * 30 + r.rat.x) * 0.12;
    }
    for (const s of this.surges) {
      const sg = s.t.surge!;
      s.mesh.visible = sg.on && !sg.done;
      if (!s.mesh.visible) continue;
      //the wall of water from the gate to its front, the crest churning
      const front = at(sg, 'front') / TILE;
      const from = s.t.s.x0 / TILE;
      s.mesh.position.x = front;
      const body = s.mesh.children[0];
      body.scale.x = Math.max(0.1, front - from);
      body.position.x = -body.scale.x / 2;
      s.mesh.children[1].rotation.x = this.time * 6;
    }
    for (const tr of this.trains) {
      const t = tr.t.train!;
      const k = at(t, 't', 10);
      const run = k < SEWER_SIM.trainFrames;
      tr.mesh.visible = run;
      if (run) tr.mesh.position.z = TRAIN_FAR + (TRAIN_NEAR - TRAIN_FAR) * (k / SEWER_SIM.trainFrames) + TRAIN_LEN / 2 - 4;
      tr.light.visible = !run && SEWER.subwayPeriod - k < SEWER_SIM.trainWarn;
    }
    for (const gt of this.gators) {
      const g = gt.t.gator!;
      gt.jaw.rotation.z = -g.open * 0.7 + (g.open > 0.9 ? Math.sin(this.time * 14) * 0.15 : 0);
    }
  }
}
