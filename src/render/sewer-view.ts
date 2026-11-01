// The sewer route's moving pieces (src/sim/sewer.ts), drawn: rat packs scurrying at you down the floor, the flood
// surge's curling wave (faceted, its lip hanging over you) coming down the tunnel behind you, subway trains crossing under the tunnel
// out of the city and back into it, and the sewer alligator, its jaws opening as you come up on it. Greybox shapes,
// inked like the rest of the street.
import * as THREE from 'three';
import { at } from '../game/interp';
import { TILE } from '../physics/constants';
import { SEWER_ROOF, type Level } from '../physics/level';
import { SEWER_SIM, type SewerSim } from '../sim/sewer';
import { SEWER } from '../gen/sewer';
import { inkify } from './toon';

const TRAIN_LEN = 9; // tiles of train, along the line
const TRAIN_FAR = -40; // where the line comes out of the city (z)
const TRAIN_NEAR = 14; // and where it goes back into it, past the camera
const WAVE_DEPTH = 5; // the flood wave across the tunnel
const WAVE_Z = 0.2; // its middle (the skate lane's about 0.4..1.9)

export class SewerView {
  readonly group = new THREE.Group();
  private rats: { mesh: THREE.Group; rat: { x: number; alive: boolean } }[] = [];
  private surges: { mesh: THREE.Group; body: THREE.Mesh; wave: THREE.Group; foam: THREE.Mesh; t: SewerSim['tunnels'][number] }[] = [];
  private trains: { mesh: THREE.Group; light: THREE.Mesh; t: SewerSim['tunnels'][number] }[] = [];
  private gators: { mesh: THREE.Group; jaw: THREE.Object3D; t: SewerSim['tunnels'][number] }[] = [];
  private time = 0;
  private readonly fur = new THREE.MeshLambertMaterial({ color: 0x6a5e58 });
  private readonly tail = new THREE.MeshLambertMaterial({ color: 0xe8a0a8 });
  private readonly eye = new THREE.MeshBasicMaterial({ color: 0xff3a3a });
  //(the wave low-poly like zack's ref: deep to light blue facets, white lines down their seams)
  private readonly water = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  private readonly seams = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  private readonly foam = new THREE.MeshLambertMaterial({ color: 0xeaf8ff });
  private readonly car = new THREE.MeshLambertMaterial({ color: 0xa8b0bc });
  private readonly stripe = new THREE.MeshLambertMaterial({ color: 0x2a6ad8 });
  private readonly window = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  private readonly beam = new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.35, depthWrite: false });
  //(the gator low-poly and faceted, bright green, like zack's ref)
  private readonly scales = new THREE.MeshLambertMaterial({ color: 0x3fb03a, flatShading: true });
  private readonly ridge = new THREE.MeshLambertMaterial({ color: 0x2a7a26, flatShading: true });
  private readonly nose = new THREE.MeshLambertMaterial({ color: 0xe88a90 });
  private readonly mouth = new THREE.MeshBasicMaterial({ color: 0x5a1018 });
  private readonly gEye = new THREE.MeshBasicMaterial({ color: 0xffd23a });
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
        //the wave fills the tunnel up to just under its roof
        const roof = t.s.top ?? level.streetY + SEWER_ROOF;
        const h = Math.max(SEWER_SIM.surgeH, (t.s.y - roof) * 0.9) / TILE;
        const m = new THREE.Group();
        const wave = this.wave(h, t.s.x0);
        const body = new THREE.Mesh(this.slab(0.22 * h, WAVE_DEPTH - 0.2, t.s.x0 + 1), this.water);
        body.position.z = WAVE_Z;
        const foam = this.spray(h, t.s.x0);
        m.add(body, wave, foam);
        inkify(m);
        m.position.y = fy;
        m.visible = false;
        this.group.add(m);
        this.surges.push({ mesh: m, body, wave, foam, t });
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
        //a faceted body (low-segment, squashed spheres), its tail tapering off behind and a ridge of scutes down its back
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 7, 5), this.scales);
        body.scale.set(len * 0.5, 0.28, 0.5);
        body.position.set(len * 0.5, 0.2, 0);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, len * 0.55, 5).rotateZ(-Math.PI / 2), this.scales);
        tail.position.set(len * 0.98, 0.14, 0);
        tail.rotation.y = 0.25;
        const head = new THREE.Mesh(new THREE.BoxGeometry(len * 0.3, 0.14, 0.36), this.scales);
        head.position.set(len * 0.08, 0.1, 0);
        for (let k = 0; k < 6; k++) {
          const sc = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), this.ridge);
          sc.position.set(len * (0.3 + k * 0.13), 0.36 - k * 0.02, 0);
          m.add(sc);
        }
        //four splayed legs
        for (const lx of [0.28, 0.72]) {
          for (const z of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.12), this.scales);
            leg.position.set(len * lx, 0.08, z * 0.3);
            leg.rotation.x = z * 0.5;
            m.add(leg);
          }
        }
        //the top jaw hinges up, teeth along it, a red mouth inside
        const jaw = new THREE.Group();
        const top = new THREE.Mesh(new THREE.BoxGeometry(len * 0.34, 0.12, 0.34), this.scales);
        top.position.set(-len * 0.17, 0.06, 0);
        const fangs = new THREE.Mesh(new THREE.BoxGeometry(len * 0.3, 0.06, 0.3), this.teeth);
        fangs.position.set(-len * 0.17, -0.02, 0);
        jaw.add(top, fangs);
        jaw.position.set(len * 0.22, 0.17, 0);
        const inside = new THREE.Mesh(new THREE.BoxGeometry(len * 0.26, 0.02, 0.26), this.mouth);
        inside.position.set(len * 0.08, 0.175, 0);
        const under = new THREE.Mesh(new THREE.BoxGeometry(len * 0.6, 0.06, 0.5), this.belly);
        under.position.set(len * 0.45, 0.02, 0);
        for (const z of [-0.14, 0.14]) {
          const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), this.gEye);
          e.position.set(len * 0.2, 0.3, z);
          m.add(e);
        }
        m.add(body, tail, head, jaw, inside, under);
        inkify(m);
        m.scale.set(1, 1.4, 1.4);
        m.position.set(g0 / TILE, fy, 0.2);
        this.group.add(m);
        this.gators.push({ mesh: m, jaw, t });
      }
    }
  }

  // the flood's wave, side on (zack's ref): a curl of faceted ribbons from the long back slope over the crest to a lip
  // hanging out ahead of its front, the barrel open under it. Its front, on the floor, at x 0; h tall (tiles)
  private wave(h: number, seed: number): THREE.Group {
    //the curl's outer edge (the back, over the crest, out to the lip) and its inner one (the face, up the barrel and
    //under the lip), point for point, in heights; the ribbons run between them
    const outer = [[-3.4, 0], [-2.2, 0.3], [-1.3, 0.62], [-0.6, 0.88], [-0.05, 1], [0.4, 0.94], [0.68, 0.76], [0.8, 0.5]];
    const inner = [[0, 0], [-0.28, 0.14], [-0.44, 0.36], [-0.4, 0.6], [-0.18, 0.74], [0.1, 0.74], [0.38, 0.64], [0.8, 0.5]];
    const bands = 4;
    const grid: number[][][] = [];
    for (let k = 0; k <= bands; k++) {
      grid.push(outer.map(([ox, oy], i) => {
        const [ix, iy] = inner[i];
        return [(ox + (ix - ox) * (k / bands)) * h, (oy + (iy - oy) * (k / bands)) * h];
      }));
    }
    const g = new THREE.Group();
    const curl = new THREE.Mesh(this.ribbons(grid, WAVE_DEPTH, seed), this.water);
    curl.position.z = WAVE_Z;
    //white lines down the facets' seams: the ribbons' edges, not every one
    const seams = new THREE.LineSegments(new THREE.EdgesGeometry(curl.geometry, 12), this.seams);
    seams.userData.ink = true;
    curl.add(seams);
    g.add(curl);
    return g;
  }

  // ribbons through a grid of points (rows across the curl, columns along it), swept across the tunnel (depth wide,
  // its near side facing you), every corner nudged so each triangle catches the light its own way; coloured deep
  // blue down the back and at the foot, lighter up the face and out on the lip
  private ribbons(grid: number[][][], depth: number, seed: number): THREE.BufferGeometry {
    let r = (seed | 0) % 2147483647 || 1;
    const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
    const rows = grid.length;
    const cols = grid[0].length;
    const h = Math.max(...grid.flat().map((p) => p[1])) || 1;
    const front = (k: number, i: number, side: 1 | -1) => {
      const [x, y] = grid[k][i];
      const n = (rand() - 0.5) * 0.18 * h;
      //(the far side's shape lags the near one a little, so the wave peels across the tunnel)
      return [x + (side < 0 ? -0.25 * h : 0) + n * 0.6, y + n * 0.4, side * depth / 2 + (rand() - 0.5) * 0.5];
    };
    const near = grid.map((row, k) => row.map((_, i) => front(k, i, 1)));
    const far = grid.map((row, k) => row.map((_, i) => front(k, i, -1)));
    const pos: number[] = [];
    const col: number[] = [];
    const deep = new THREE.Color(0x0a2f8a);
    const light = new THREE.Color(0x4fc4f2);
    const c = new THREE.Color();
    const tri = (a: number[], b: number[], d: number[], shade: number) => {
      pos.push(...a, ...b, ...d);
      c.copy(deep).lerp(light, Math.min(1, Math.max(0, shade + (rand() - 0.5) * 0.22)));
      for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b);
    };
    const quad = (a: number[], b: number[], d: number[], e: number[], shade: number) => {
      tri(a, b, d, shade);
      tri(a, d, e, shade - 0.06);
    };
    //the near face: its ribbons
    for (let k = 0; k < rows - 1; k++) {
      for (let i = 0; i < cols - 1; i++) {
        const lift = (near[k][i][1] + near[k + 1][i + 1][1]) / 2 / h;
        quad(near[k][i], near[k + 1][i], near[k + 1][i + 1], near[k][i + 1], 0.15 + lift * 0.45 + (k / rows) * 0.35);
      }
    }
    //the outer and inner skins, across the tunnel to the far side
    for (const k of [0, rows - 1]) {
      for (let i = 0; i < cols - 1; i++) {
        const [a, b, d, e] = [near[k][i], near[k][i + 1], far[k][i + 1], far[k][i]];
        const lift = (a[1] + b[1]) / 2 / h;
        if (k === 0) quad(a, e, d, b, 0.1 + lift * 0.45);
        else quad(a, b, d, e, 0.45 + lift * 0.5);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    //(its corners unshared, so every triangle's normal is its own: flat shaded)
    geo.computeVertexNormals();
    return geo;
  }

  // the water behind the wave: a faceted slab h tall, one tile long (scaled out to the gate), depth across, ending at x 0
  private slab(h: number, depth: number, seed: number): THREE.BufferGeometry {
    const along = [-1, -0.75, -0.5, -0.25, 0];
    return this.ribbons([along.map((x) => [x, h]), along.map((x) => [x, 0])], depth, seed);
  }

  // spray off the lip: white shards in one mesh, across the tunnel
  private spray(h: number, seed: number): THREE.Mesh {
    let r = (seed | 0) % 2147483647 || 7;
    const rand = () => (r = (r * 48271) % 2147483647) / 2147483647;
    const parts: THREE.BufferGeometry[] = [];
    for (let k = 0; k < 16; k++) {
      const p = new THREE.TetrahedronGeometry(h * (0.025 + rand() * 0.04));
      p.rotateX(rand() * 6).rotateY(rand() * 6);
      p.translate(h * (0.45 + rand() * 0.45), h * (0.55 + rand() * 0.45), WAVE_Z + (rand() - 0.5) * WAVE_DEPTH);
      parts.push(p);
    }
    const pos: number[] = [];
    for (const p of parts) pos.push(...(p.getAttribute('position').array as Float32Array));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, this.foam);
  }

  // a hunched sewer rat (zack's ref): a humped grey body, a pointed snout with a pink nose and an open mouth, round
  // ears, little legs and a long pink tail
  private rat(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), this.fur);
    body.scale.set(1.5, 0.95, 0.85);
    body.position.set(0.04, 0.16, 0);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 7).rotateZ(Math.PI / 2), this.fur);
    head.position.set(-0.3, 0.13, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), this.nose);
    nose.position.set(-0.44, 0.12, 0);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.07), this.mouth);
    jaw.position.set(-0.36, 0.07, 0);
    jaw.rotation.z = 0.35;
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, 0.55, 4).rotateZ(Math.PI / 2.3), this.tail);
    tail.position.set(0.44, 0.08, 0);
    g.add(body, head, nose, jaw, tail);
    for (const z of [-0.06, 0.06]) {
      const ear = new THREE.Mesh(new THREE.CircleGeometry(0.05, 6), this.tail);
      ear.position.set(-0.2, 0.25, z);
      ear.rotation.y = z < 0 ? -0.6 : 0.6;
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 4, 3), this.eye);
      e.position.set(-0.3, 0.19, z);
      g.add(ear, e);
    }
    for (const lx of [-0.14, 0.16]) {
      for (const z of [-0.08, 0.08]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.04), this.tail);
        leg.position.set(lx, 0.04, z);
        g.add(leg);
      }
    }
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
      //the wave at its front, the water behind it back to the gate; the lip heaves and the spray churns off it
      const front = at(sg, 'front') / TILE;
      const from = s.t.s.x0 / TILE;
      s.mesh.position.x = front;
      s.body.scale.x = Math.max(0.1, front - from);
      s.wave.scale.set(1 + Math.sin(this.time * 5) * 0.03, 1 + Math.sin(this.time * 3.3) * 0.04, 1);
      s.foam.position.y = Math.sin(this.time * 9) * 0.08;
      s.foam.rotation.x = Math.sin(this.time * 4) * 0.04;
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
