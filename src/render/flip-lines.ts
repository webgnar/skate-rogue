// Comic motion lines for flip tricks: brush arcs that trace where the board's edges swept, like the curved lines a
// comic artist draws round a spinning board. A kickflip or heelflip (the board rolling about its length) draws
// arcs off its rails; a shove-it or 180 (the board spinning flat) draws arcs off its nose and tail; a tre flip
// does both. The arcs are drawn round the board's centre, not left behind in the world, so they read as rotation
// rather than travel. One draw call.
//
// Two looks (?fliplines=, fx-settings.ts):
//   ink     thin black tapered strokes, two per edge, like manga motion arcs
//   swoosh  a crescent smear in the trick's colour with an ink edge
import * as THREE from 'three';

export type FlipLineStyle = 'ink' | 'swoosh' | 'pixels';
export const FLIP_LINE_STYLES: FlipLineStyle[] = ['ink', 'swoosh', 'pixels'];

const WINDOW = 0.2; // seconds of the board's turn an arc covers at full length
const PTS = 24; // points along each arc
const MAX_SAMPLES = 40;
const INK = [0.02, 0.02, 0.03];
// Seen from the side a kickflip's rails just bob up and down, so the arcs are drawn a little turned toward the
// camera: depth leaks into screen right and up, and a roll about the board's length reads as an ellipse.
const LEAN_RIGHT = 0.55;
const LEAN_UP = 0.4;

// an edge the arcs come off, in the deck's own space (x along the board, y up, z across): `base` stays put as the
// board turns about it and `radial` is pushed outward so the arc clears the deck
interface Edge {
  base: THREE.Vector3;
  radial: THREE.Vector3;
  roll: boolean; // a rail (shows on flips) or an end (shows on spins)
}

const EDGES: Edge[] = [
  { base: new THREE.Vector3(0.3, 0, 0), radial: new THREE.Vector3(0, 0.01, 0.13), roll: true }, // front toe rail
  { base: new THREE.Vector3(-0.3, 0, 0), radial: new THREE.Vector3(0, 0.01, -0.13), roll: true }, // back heel rail
  { base: new THREE.Vector3(0, 0, 0), radial: new THREE.Vector3(0.475, 0.04, 0), roll: false }, // nose
  { base: new THREE.Vector3(0, 0, 0), radial: new THREE.Vector3(-0.475, 0.04, 0), roll: false }, // tail
];

// each look's strokes per edge: how far out (x the edge's radial, rails / ends), how long (x WINDOW), how wide
interface Stroke {
  out: [number, number];
  inner?: [number, number]; // a filled smear from here out to `out` (swoosh), instead of a line
  len: number;
  width: number;
  ink: boolean; // black, or the trick's colour
}

const LOOKS: Record<'ink' | 'swoosh', Stroke[]> = {
  ink: [
    { out: [2.2, 1.18], len: 1, width: 0.11, ink: true },
    { out: [2.9, 1.4], len: 0.75, width: 0.07, ink: true },
  ],
  swoosh: [
    { out: [2.4, 1.24], inner: [0.9, 0.62], len: 1.15, width: 0, ink: false },
    { out: [2.4, 1.24], len: 1.15, width: 0.06, ink: true },
  ],
};

const STRIPS = EDGES.length * 2;

export class FlipLines {
  readonly mesh: THREE.Mesh;
  style: FlipLineStyle;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly samples: { t: number; q: THREE.Quaternion }[] = [];
  private clock = 0;
  private roll = 0; // how strongly the board is rolling (flip) and spinning flat (shuv), 0..1, held a moment
  private spin = 0;
  private rgb = [1, 1, 1];
  rate = 0; // how fast the board is turning now, rad/s
  private alive = false;
  private readonly prev = new THREE.Quaternion();
  private hasPrev = false;
  // scratch
  private readonly at = new THREE.Vector3();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly v = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly path: THREE.Vector3[] = Array.from({ length: PTS }, () => new THREE.Vector3());
  private readonly path2: THREE.Vector3[] = Array.from({ length: PTS }, () => new THREE.Vector3());
  private readonly qs: THREE.Quaternion[] = Array.from({ length: PTS }, () => new THREE.Quaternion());

  constructor(style: FlipLineStyle) {
    this.style = style;
    const verts = STRIPS * PTS * 2;
    this.pos = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const index: number[] = [];
    for (let s = 0; s < STRIPS; s++) {
      for (let k = 0; k < PTS - 1; k++) {
        const a = (s * PTS + k) * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  // the trick's colour for the swoosh (particles.ts TRICK_TRAIL)
  trick(rgb: number[]): void {
    this.rgb = rgb;
  }

  // `board` is the deck (origin at the middle of its top); `on` while a flip trick is in the air
  update(dt: number, board: THREE.Object3D, camera: THREE.Camera, on: boolean): void {
    if (this.style === 'pixels') {
      this.mesh.visible = false;
      return;
    }
    this.clock += dt;
    board.updateWorldMatrix(true, false);
    board.matrixWorld.decompose(this.at, this.q, this.s);

    // how fast the board turns about its own length (roll) and its own up (spin)
    if (on && this.hasPrev && dt > 0) {
      const d = this.v.set(0, 0, 0);
      const dq = this.prev.clone().invert().multiply(this.q);
      if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
      const angle = 2 * Math.acos(Math.min(1, dq.w));
      const sin = Math.sqrt(Math.max(1e-9, 1 - dq.w * dq.w));
      d.set(dq.x / sin, dq.y / sin, dq.z / sin).multiplyScalar(angle / dt);
      this.roll = Math.max(this.roll, smooth(Math.abs(d.x), 4, 9));
      this.spin = Math.max(this.spin, smooth(Math.abs(d.y), 3, 7));
      this.rate = d.length();
    }
    this.prev.copy(this.q);
    this.hasPrev = true;
    const hold = Math.exp(-dt / 0.25);
    this.roll *= hold;
    this.spin *= hold;

    // at most one sample per 1/240 s, so slow motion and fast screens still keep the whole window
    const last = this.samples[this.samples.length - 1];
    if (on && (!last || this.clock - last.t >= 1 / 240)) {
      this.samples.push({ t: this.clock, q: this.q.clone() });
      if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    }
    while (this.samples.length > 2 && this.samples[1].t < this.clock - WINDOW * 1.3) this.samples.shift();
    const newest = this.samples[this.samples.length - 1];
    if (!newest || this.clock - newest.t > WINDOW * 1.3 || (this.roll < 0.01 && this.spin < 0.01)) {
      if (!on) this.samples.length = 0;
      this.mesh.visible = this.alive = false;
      return;
    }
    this.alive = true;
    this.mesh.visible = true;

    camera.updateMatrixWorld();
    camera.getWorldDirection(this.fwd);
    this.right.setFromMatrixColumn(camera.matrixWorld, 0);
    this.up.setFromMatrixColumn(camera.matrixWorld, 1);
    const scale = this.s.x;
    const look = LOOKS[this.style];

    let strip = 0;
    for (const edge of EDGES) {
      const k = edge.roll ? this.roll : this.spin;
      for (const st of look) {
        if (k < 0.01) {
          this.clear(strip++);
          continue;
        }
        const from = this.clock - WINDOW * st.len;
        const t0 = Math.max(from, this.samples[0].t);
        const t1 = newest.t;
        const out = st.out[edge.roll ? 0 : 1];
        for (let i = 0; i < PTS; i++) this.orient(t0 + ((t1 - t0) * i) / (PTS - 1), this.qs[i]);
        for (let i = 0; i < PTS; i++) this.place(edge, out, this.qs[i], scale, this.path[i]);
        // the arc fades in from its tail, and the whole thing goes as the turn stops
        const grow = Math.min(1, (t1 - t0) / (WINDOW * st.len * 0.6));
        if (st.inner) {
          const inner = st.inner[edge.roll ? 0 : 1];
          for (let i = 0; i < PTS; i++) {
            const u = i / (PTS - 1);
            this.place(edge, out + (inner - out) * Math.pow(u, 0.7), this.qs[i], scale, this.path2[i]);
          }
          this.fill(strip++, k * grow, st);
        } else this.line(strip++, k * grow, st, scale);
      }
    }
    for (; strip < STRIPS; strip++) this.clear(strip);
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
  }

  get active(): boolean {
    return this.alive;
  }

  // the board's facing at time t, slerped between samples
  private orient(t: number, out: THREE.Quaternion): void {
    const s = this.samples;
    let i = 0;
    while (i < s.length - 2 && s[i + 1].t < t) i++;
    const a = s[i];
    const b = s[Math.min(i + 1, s.length - 1)];
    const u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 1;
    out.slerpQuaternions(a.q, b.q, u);
  }

  // where an edge was, round the board's centre now, leaned toward the camera
  private place(edge: Edge, out: number, q: THREE.Quaternion, scale: number, p: THREE.Vector3): void {
    p.copy(edge.radial).multiplyScalar(out).add(edge.base).multiplyScalar(scale).applyQuaternion(q);
    const depth = p.dot(this.fwd);
    p.addScaledVector(this.right, -depth * LEAN_RIGHT).addScaledVector(this.up, -depth * LEAN_UP).add(this.at);
  }

  // a tapered brush line along `path`: a point at the tail, full width near the head
  private line(strip: number, k: number, st: Stroke, scale: number): void {
    const rgb = st.ink ? INK : this.rgb;
    const side = this.v;
    for (let i = 0; i < PTS; i++) {
      const u = i / (PTS - 1);
      const a = this.path[Math.max(0, i - 1)];
      const b = this.path[Math.min(PTS - 1, i + 1)];
      side.subVectors(b, a).cross(this.fwd);
      if (side.lengthSq() < 1e-10) side.copy(this.up);
      side.normalize();
      const w = (st.width * scale * Math.pow(u, 0.8) * Math.min(1, (1 - u) * 6 + 0.35)) / 2;
      const p = this.path[i];
      const alpha = Math.min(1, k * 1.6) * Math.min(1, u * 4);
      this.vert(strip, i, 0, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w, rgb, alpha);
      this.vert(strip, i, 1, p.x - side.x * w, p.y - side.y * w, p.z - side.z * w, rgb, alpha);
    }
  }

  // a filled crescent between path2 (inside) and path (outside), in the trick's colour washed toward white
  private fill(strip: number, k: number, st: Stroke): void {
    const c = this.rgb.map((x) => 0.45 * x + 0.55);
    const rgb = st.ink ? INK : c;
    for (let i = 0; i < PTS; i++) {
      const u = i / (PTS - 1);
      const a = k * 0.92 * Math.min(1, u * 1.6);
      const p = this.path[i];
      const q = this.path2[i];
      this.vert(strip, i, 0, p.x, p.y, p.z, rgb, a);
      this.vert(strip, i, 1, q.x, q.y, q.z, rgb, a);
    }
  }

  private clear(strip: number): void {
    const from = strip * PTS * 2;
    this.col.fill(0, from * 4, (from + PTS * 2) * 4);
    this.pos.fill(0, from * 3, (from + PTS * 2) * 3);
  }

  private vert(strip: number, i: number, side: number, x: number, y: number, z: number, rgb: number[], a: number): void {
    const n = (strip * PTS + i) * 2 + side;
    this.pos[n * 3] = x;
    this.pos[n * 3 + 1] = y;
    this.pos[n * 3 + 2] = z;
    this.col[n * 4] = rgb[0];
    this.col[n * 4 + 1] = rgb[1];
    this.col[n * 4 + 2] = rgb[2];
    this.col[n * 4 + 3] = a;
  }
}

function smooth(x: number, lo: number, hi: number): number {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}
