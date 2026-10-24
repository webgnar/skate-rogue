// All the small stuff in one draw call: grind sparks, landing dust and slam debris. A fixed pool of square pixel
// particles (matching QFS's pixel art) drawn as THREE.Points; debris gets an ink rim like the comic burst.
import * as THREE from 'three';
import { ParticlePool } from './particle-pool';
import { FX } from './fx-settings';

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
// a metal rail: hotter, whiter sparks
const SPARK_HOT = [
  [1, 1, 1],
  [0.85, 0.93, 1],
  [1, 0.96, 0.7],
];

// a concrete ledge: duller orange sparks, with chips of concrete
const SPARK_WARM = [
  [1, 0.7, 0.25],
  [1, 0.55, 0.15],
  [1, 0.85, 0.45],
];

// flip trails by trick: kickflips cyan, heelflips magenta, shuvs yellow, 180s white
export const TRICK_TRAIL: Record<string, number[]> = {
  kickflip: [0.35, 0.95, 1],
  heelflip: [1, 0.4, 0.85],
  shuv1: [1, 0.88, 0.3],
  shuv2: [1, 0.88, 0.3],
  bs180: [0.95, 0.95, 1],
  fs180: [0.95, 0.95, 1],
};

export type GrindStyle = 'metal' | 'concrete';

const WATER = [
  [0.85, 0.92, 1],
  [0.7, 0.82, 0.98],
  [0.95, 0.97, 1],
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
  private splashDebt = 0;
  private flipDebt = 0;

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
  // `style`: a metal rail throws hot white sparks; a concrete ledge throws orange ones and chips of concrete
  grind(x: number, y: number, dir: number, rate: number, dt: number, style: GrindStyle = 'metal'): void {
    this.sparkDebt += rate * dt * (FX.tier === 'low' ? 0.5 : 1);
    const p = this.pool;
    const metal = style === 'metal';
    while (this.sparkDebt >= 1) {
      this.sparkDebt--;
      if (!metal && Math.random() < 0.3) {
        const c = this.spawn(x + rand(-0.08, 0.08), y + rand(0, 0.05), rand(0.05, 0.3), rand(0.35, 0.6), pick(DUST), rand(0.06, 0.1), 0.05, 1, 0.6, true);
        p.vx[c] = dir * rand(-1.8, 0.4);
        p.vy[c] = rand(0.6, 2);
        p.vz[c] = rand(-0.3, 1);
        p.grav[c] = 14;
        p.floor[c] = y - 1.5;
        continue;
      }
      const i = this.spawn(x + rand(-0.05, 0.05), y + rand(0, 0.06), rand(0.05, 0.25), metal ? rand(0.18, 0.42) : rand(0.12, 0.3), pick(metal ? SPARK_HOT : SPARK_WARM), metal ? rand(0.12, 0.2) : rand(0.1, 0.16), 0.03, 1, 0.5, false);
      p.vx[i] = dir * rand(-2.5, 1.5) * (metal ? 1.2 : 0.8);
      p.vy[i] = rand(0.8, 3.6) * (metal ? 1.1 : 0.8);
      p.vz[i] = rand(-0.6, 1.6);
      p.grav[i] = 16;
      p.drag[i] = 1.2;
      p.floor[i] = y - 0.05;
    }
  }

  // the gnar state's sparkle trail: rainbow pixels shed behind the skater
  trail(x: number, y: number, rate: number, dt: number, t: number): void {
    this.trailDebt += rate * dt * (FX.tier === 'low' ? 0.5 : 1);
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

  // spray off the wheels while rolling through water: blue-white drops thrown back and up, more with speed
  wade(x: number, y: number, speed: number, dt: number): void {
    this.splashDebt += (40 + 30 * speed) * dt;
    const p = this.pool;
    while (this.splashDebt >= 1) {
      this.splashDebt--;
      const back = Math.random() < 0.5;
      const i = this.spawn(x + (back ? -0.32 : 0.32) + rand(-0.05, 0.05), y + 0.03, rand(-0.2, 0.5), rand(0.25, 0.5), pick(WATER), rand(0.07, 0.12), 0.03, 0.9, 0.4, false);
      p.vx[i] = rand(-0.4, 0.6) - speed * rand(0.15, 0.35);
      p.vy[i] = rand(1, 2.6) * (0.6 + 0.2 * speed);
      p.vz[i] = rand(-0.8, 1.2);
      p.grav[i] = 14;
      p.floor[i] = y;
    }
  }

  // landing in a puddle: a crown of drops all round
  splash(x: number, y: number, size = 1): void {
    const p = this.pool;
    const n = Math.round(14 + 14 * size);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const i = this.spawn(x + Math.cos(a) * 0.2, y + 0.03, Math.sin(a) * 0.2 + 0.2, rand(0.4, 0.7), pick(WATER), rand(0.08, 0.14), 0.03, 0.95, 0.5, false);
      p.vx[i] = Math.cos(a) * rand(1, 2.5) * size;
      p.vy[i] = rand(2.5, 4.5) * size;
      p.vz[i] = Math.sin(a) * rand(0.8, 2) * size;
      p.grav[i] = 15;
      p.floor[i] = y;
    }
  }

  // a flip's trail: pixels in the trick's colour left hanging where the board spun; `rgb` from TRICK_TRAIL
  flipTrail(x: number, y: number, rgb: number[], dt: number): void {
    this.flipDebt += (FX.tier === 'low' ? 60 : 120) * dt;
    const p = this.pool;
    while (this.flipDebt >= 1) {
      this.flipDebt--;
      const i = this.spawn(x + rand(-0.22, 0.22), y + rand(-0.06, 0.1), rand(0.1, 0.35), rand(0.22, 0.36), rgb, rand(0.13, 0.19), 0.03, 1, 0.25, false);
      p.vx[i] = rand(-0.8, -0.2);
      p.vy[i] = rand(-0.2, 0.3);
      p.drag[i] = 3;
    }
  }

  // a clean landing: a flat ring of white sparkle round the wheels, and a few gold ones popping up
  cleanLanding(x: number, y: number): void {
    const p = this.pool;
    const n = FX.tier === 'low' ? 8 : 14;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const i = this.spawn(x, y + 0.04, 0.2, rand(0.22, 0.3), [1, 1, 1], 0.12, 0.03, 1, 0.3, false);
      p.vx[i] = Math.cos(a) * 3.2;
      p.vz[i] = Math.sin(a) * 1.6;
      p.drag[i] = 5;
    }
    for (let k = 0; k < 4; k++) {
      const i = this.spawn(x + rand(-0.3, 0.3), y + 0.1, 0.3, rand(0.4, 0.55), pick(SPARK), 0.16, 0.05, 1, 0.5, false);
      p.vx[i] = rand(-0.6, 0.6);
      p.vy[i] = rand(1.6, 2.6);
      p.grav[i] = 6;
      p.drag[i] = 1.5;
    }
  }

  // a sketchy landing: the board scuffs down one end first, a lopsided puff kicked out behind
  sketchyLanding(x: number, y: number, dir: number): void {
    const p = this.pool;
    for (let k = 0; k < 10; k++) {
      const i = this.spawn(x - dir * rand(0.2, 0.45), y + rand(0, 0.06), rand(-0.1, 0.4), rand(0.3, 0.55), pick(DUST), rand(0.08, 0.13), rand(0.25, 0.4), 0.8, 0, false);
      p.vx[i] = -dir * rand(1, 3.2);
      p.vy[i] = rand(0.3, 1.4);
      p.drag[i] = 4;
      p.grav[i] = -0.3;
    }
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
