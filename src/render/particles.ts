// All the small stuff in one draw call: grind sparks, landing dust and slam debris. A fixed pool of square pixel
// particles (matching QFS's pixel art) drawn as THREE.Points; debris gets an ink rim like the comic burst.
import * as THREE from 'three';
import { ParticlePool } from './particle-pool';

const MAX = 256;

const vertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aInk;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vInk;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vInk = aInk;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vInk;
  void main() {
    if (vAlpha < 0.01) discard;
    vec2 e = abs(gl_PointCoord - 0.5);
    vec3 col = vColor;
    if (vInk > 0.5 && max(e.x, e.y) > 0.3) col = vec3(0.06, 0.03, 0.08);
    gl_FragColor = vec4(col, vAlpha);
  }
`;

const SPARK = [
  [1, 1, 0.9],
  [1, 0.93, 0.45],
  [1, 0.72, 0.2],
  [1, 0.5, 0.15],
];
const DUST = [
  [0.78, 0.74, 0.7],
  [0.66, 0.62, 0.6],
  [0.86, 0.82, 0.76],
];
const DEBRIS = [
  [0.55, 0.53, 0.56],
  [0.38, 0.36, 0.4],
  [0.78, 0.2, 0.17], // deck chips
  [0.95, 0.94, 0.9],
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export class Particles {
  readonly points: THREE.Points;
  private readonly pool = new ParticlePool(MAX);
  private readonly alpha0 = new Float32Array(MAX);
  private readonly fadeFrom = new Float32Array(MAX); // life fraction where fading starts
  private readonly pos: THREE.BufferAttribute;
  private readonly col: THREE.BufferAttribute;
  private readonly size: THREE.BufferAttribute;
  private readonly alpha: THREE.BufferAttribute;
  private readonly ink: THREE.BufferAttribute;
  private readonly mat: THREE.ShaderMaterial;
  private sparkDebt = 0;
  private trailDebt = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    const attr = (n: number) => new THREE.BufferAttribute(new Float32Array(MAX * n), n).setUsage(THREE.DynamicDrawUsage);
    this.pos = attr(3);
    this.col = attr(3);
    this.size = attr(1);
    this.alpha = attr(1);
    this.ink = attr(1);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aColor', this.col);
    geo.setAttribute('aSize', this.size);
    geo.setAttribute('aAlpha', this.alpha);
    geo.setAttribute('aInk', this.ink);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uScale: { value: 500 } },
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  private spawn(x: number, y: number, z: number, life: number, rgb: number[], size0: number, size1: number, alpha: number, fadeFrom: number, ink: boolean): number {
    const p = this.pool;
    const i = p.alloc();
    p.px[i] = x;
    p.py[i] = y;
    p.pz[i] = z;
    p.life[i] = life;
    p.size0[i] = size0;
    p.size1[i] = size1;
    [p.r[i], p.g[i], p.b[i]] = rgb;
    this.alpha0[i] = alpha;
    this.fadeFrom[i] = fadeFrom;
    this.ink.setX(i, ink ? 1 : 0);
    this.ink.needsUpdate = true;
    return i;
  }

  // a frame of grind sparks from the contact point (x, y); `rate` is sparks per second, `dir` the way they ride
  grind(x: number, y: number, dir: number, rate: number, dt: number): void {
    this.sparkDebt += rate * dt;
    const p = this.pool;
    while (this.sparkDebt >= 1) {
      this.sparkDebt--;
      const i = this.spawn(x + rand(-0.05, 0.05), y + rand(0, 0.06), rand(0.05, 0.25), rand(0.18, 0.42), pick(SPARK), rand(0.12, 0.2), 0.03, 1, 0.5, false);
      p.vx[i] = dir * rand(-2.5, 1.5);
      p.vy[i] = rand(0.8, 3.6);
      p.vz[i] = rand(-0.6, 1.6);
      p.grav[i] = 16;
      p.drag[i] = 1.2;
      p.floor[i] = y - 0.05;
    }
  }

  // the gnar state's sparkle trail: rainbow pixels shed behind the skater
  trail(x: number, y: number, rate: number, dt: number, t: number): void {
    this.trailDebt += rate * dt;
    const p = this.pool;
    const c = new THREE.Color();
    while (this.trailDebt >= 1) {
      this.trailDebt--;
      c.setHSL((t * 0.35 + Math.random() * 0.15) % 1, 1, 0.65);
      const i = this.spawn(x + rand(-0.3, 0.3), y + rand(-0.7, 0.7), rand(0, 0.4), rand(0.35, 0.6), [c.r, c.g, c.b], rand(0.1, 0.16), 0.02, 1, 0.3, false);
      p.vx[i] = rand(-1.5, -0.3);
      p.vy[i] = rand(-0.3, 0.6);
      p.drag[i] = 2;
    }
  }

  // a shower as the board locks onto a rail or ledge
  grindStart(x: number, y: number, dir: number): void {
    this.sparkDebt += 14;
    this.grind(x, y, dir, 0, 0);
  }

  // a dust puff where the board touches down; size 1 for a normal landing
  dust(x: number, y: number, size = 1): void {
    const p = this.pool;
    const n = Math.round(6 + 8 * size);
    for (let k = 0; k < n; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const i = this.spawn(x + side * rand(0.1, 0.4), y + rand(0, 0.08), rand(-0.2, 0.4), rand(0.35, 0.7), pick(DUST), rand(0.1, 0.16) * size, rand(0.3, 0.5) * size, 0.75, 0, false);
      p.vx[i] = side * rand(0.8, 3) * size;
      p.vy[i] = rand(0.2, 1.1) * size;
      p.vz[i] = rand(-0.5, 0.8);
      p.drag[i] = 4;
      p.grav[i] = -0.4;
    }
  }

  // a slam: chunks fly up and forward, bounce once on the ground, plus a big dust cloud
  debris(x: number, y: number, dir: number): void {
    const p = this.pool;
    for (let k = 0; k < 18; k++) {
      const i = this.spawn(x + rand(-0.3, 0.3), y + rand(0.05, 0.3), rand(-0.1, 0.5), rand(0.7, 1.1), pick(DEBRIS), rand(0.1, 0.2), rand(0.08, 0.14), 1, 0.75, true);
      p.vx[i] = dir * rand(-1.5, 5);
      p.vy[i] = rand(2.5, 7);
      p.vz[i] = rand(-1, 2.5);
      p.grav[i] = 18;
      p.drag[i] = 0.6;
      p.floor[i] = y;
    }
    for (let k = 0; k < 14; k++) {
      const i = this.spawn(x + rand(-0.6, 0.6), y + rand(0, 0.4), rand(-0.3, 0.4), rand(0.6, 1), pick(SPARK.slice(0, 2)), 0.12, 0.03, 1, 0.4, false);
      p.vx[i] = rand(-6, 6);
      p.vy[i] = rand(1, 6);
      p.vz[i] = rand(-1, 2);
      p.grav[i] = 12;
      p.drag[i] = 2.5;
    }
    this.dust(x, y, 1.8);
  }

  // `scale` is pixels per world unit at distance 1: drawing-buffer height / (2 tan(fov / 2))
  update(dt: number, scale: number): void {
    this.mat.uniforms.uScale.value = scale;
    const p = this.pool;
    p.step(dt);
    for (let i = 0; i < MAX; i++) {
      if (!p.alive(i)) {
        this.alpha.setX(i, 0);
        this.size.setX(i, 0);
        continue;
      }
      const t = p.t(i);
      this.pos.setXYZ(i, p.px[i], p.py[i], p.pz[i]);
      this.col.setXYZ(i, p.r[i], p.g[i], p.b[i]);
      this.size.setX(i, p.size0[i] + (p.size1[i] - p.size0[i]) * t);
      const f = this.fadeFrom[i];
      this.alpha.setX(i, this.alpha0[i] * (t <= f ? 1 : 1 - (t - f) / (1 - f)));
    }
    this.pos.needsUpdate = this.col.needsUpdate = this.size.needsUpdate = this.alpha.needsUpdate = true;
  }

  clear(): void {
    this.pool.life.fill(0);
  }
}
