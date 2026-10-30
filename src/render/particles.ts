// All the small stuff in one draw call: grind sparks, landing dust and slam debris. A fixed pool of square pixel
// particles (matching QFS's pixel art) drawn as THREE.Points; debris gets an ink rim like the comic burst.
// Grind sparks draw the original Gnar Run's spark sprites instead (public/sprites/fx/particles.png: three 16 px
// frames, gold, white-hot, gold, at 3x), flickering between frames and flipping like the old GameMaker o_grindspark.
// Smash and wreck dust draws its dust puff (the atlas's fourth cell), tinted, turned a random way and swelling.
// They draw in a second layer, `behind`: in the level's pass, so the skater and board always draw over them.
import * as THREE from 'three';
import { ParticlePool } from './particle-pool';
import { FX } from './fx-settings';

const MAX = 256;
const ATLAS_CELLS = 4;
// the atlas cells each kind of sprite cycles through: a metal rail's sparks flash white-hot, a ledge's stay gold;
// a dust puff is one still frame
const CYCLES = [[1, 0, 1, 2], [0, 2], [3]];
const METAL = 0;
const CONCRETE = 1;
const PUFF = 2;
const NO_SPRITE = -1;

// the sprite atlas, loaded once in the browser (tests build Particles under Node, with no images)
function sparkTexture(): THREE.Texture {
  const tex = new THREE.Texture();
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.onload = () => {
      tex.image = img;
      tex.needsUpdate = true;
    };
    img.src = `${import.meta.env.BASE_URL}sprites/fx/particles.png`;
  }
  return tex;
}

const vertex = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aInk;
  attribute vec3 aColor;
  attribute float aSprite;
  attribute float aFlip;
  attribute float aLayer;
  uniform float uScale;
  uniform float uLayer;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vInk;
  varying float vSprite;
  varying float vFlip;
  void main() {
    vColor = aColor;
    vAlpha = aAlpha;
    vInk = aInk;
    vSprite = aSprite;
    vFlip = aFlip;
    if (abs(aLayer - uLayer) > 0.5) {
      // drawn by the other layer's Points
      gl_PointSize = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uSparks;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vInk;
  varying float vSprite;
  varying float vFlip;
  void main() {
    if (vAlpha < 0.01) discard;
    if (vSprite > -0.5) {
      // a spark sprite frame: one of 8 orientations (quarter turns, then a mirror), crisp pixels, tinted
      vec2 uv = gl_PointCoord - 0.5;
      float o = vFlip;
      if (mod(o, 2.0) > 0.5) uv = vec2(-uv.y, uv.x);
      if (mod(floor(o / 2.0), 2.0) > 0.5) uv = -uv;
      if (o > 3.5) uv.x = -uv.x;
      uv += 0.5;
      vec4 s = texture2D(uSparks, vec2((vSprite + uv.x) / ${ATLAS_CELLS}.0, 1.0 - uv.y));
      if (s.a < 0.5) discard;
      gl_FragColor = vec4(s.rgb * vColor, vAlpha);
      return;
    }
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

// a concrete ledge: the gold sprite frames, warmed toward orange, with chips of concrete
const SPARK_TINT = [
  [1, 0.9, 0.8],
  [1, 0.8, 0.62],
  [1, 1, 1],
];

// flip trails by trick: kickflips cyan, heelflips magenta, shuvs yellow, 180s white
export const TRICK_TRAIL: Record<string, number[]> = {
  kickflip: [0.35, 0.95, 1],
  heelflip: [1, 0.4, 0.85],
  shuv1: [1, 0.88, 0.3],
  shuv2: [1, 0.88, 0.3],
  bs180: [0.95, 0.95, 1],
  fs180: [0.95, 0.95, 1],
  bsFlip: [0.35, 0.95, 1],
  fsFlip: [0.35, 0.95, 1],
  bsHeel: [1, 0.4, 0.85],
  fsHeel: [1, 0.4, 0.85],
};

export type GrindStyle = 'metal' | 'concrete';

export interface Spray {
  n: number;
  colors: number[][];
  life: [number, number]; // seconds
  size: [number, number]; // starting size in world units
  size1?: number; // end size
  speed: [number, number];
  angle?: [number, number]; // radians, 0 = forward (+x), PI / 2 = up
  ring?: boolean; // even angles instead of random
  radius?: number; // start this far out
  flat?: boolean; // a ring lying on the ground rather than standing up
  jitter?: number;
  grav?: number;
  drag?: number;
  alpha?: number;
  fadeFrom?: number;
  ink?: boolean;
  floor?: number;
  z?: number; // depth to spawn at (0: the skater's lane)
  puff?: boolean; // draw the dust-puff sprite (tinted by `colors`) instead of square pixels
}

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
  readonly points: THREE.Points; // over everything (the effects pass, src/render/scene.ts)
  readonly behind: THREE.Points; // the same pool's grind sparks, in the level's pass: under the skater and board
  private readonly pool = new ParticlePool(MAX);
  private readonly alpha0 = new Float32Array(MAX);
  private readonly fadeFrom = new Float32Array(MAX); // life fraction where fading starts
  private readonly pos: THREE.BufferAttribute;
  private readonly col: THREE.BufferAttribute;
  private readonly size: THREE.BufferAttribute;
  private readonly alpha: THREE.BufferAttribute;
  private readonly ink: THREE.BufferAttribute;
  private readonly sprite: THREE.BufferAttribute;
  private readonly flip: THREE.BufferAttribute;
  private readonly layer: THREE.BufferAttribute;
  private readonly cycle = new Float32Array(MAX).fill(NO_SPRITE); // a CYCLES index, or NO_SPRITE for a pixel
  private readonly frame0 = new Float32Array(MAX); // where in its cycle this spark starts
  private readonly fps = new Float32Array(MAX); // how fast it flickers
  private readonly mat: THREE.ShaderMaterial;
  private sparkDebt = 0;
  private flareDebt = 0;
  private trailDebt = 0;
  private splashDebt = 0;
  private flipDebt = 0;
  private readonly streams = new Map<string, number>();

  constructor() {
    const geo = new THREE.BufferGeometry();
    const attr = (n: number) => new THREE.BufferAttribute(new Float32Array(MAX * n), n).setUsage(THREE.DynamicDrawUsage);
    this.pos = attr(3);
    this.col = attr(3);
    this.size = attr(1);
    this.alpha = attr(1);
    this.ink = attr(1);
    this.sprite = attr(1);
    this.flip = attr(1);
    this.layer = attr(1);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('aColor', this.col);
    geo.setAttribute('aSize', this.size);
    geo.setAttribute('aAlpha', this.alpha);
    geo.setAttribute('aInk', this.ink);
    geo.setAttribute('aSprite', this.sprite);
    geo.setAttribute('aFlip', this.flip);
    geo.setAttribute('aLayer', this.layer);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uScale: { value: 500 }, uSparks: { value: sparkTexture() }, uLayer: { value: 0 } },
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    const under = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { uScale: this.mat.uniforms.uScale, uSparks: this.mat.uniforms.uSparks, uLayer: { value: 1 } },
      transparent: true,
      depthWrite: false,
    });
    this.behind = new THREE.Points(geo, under);
    this.behind.frustumCulled = false;
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
    this.cycle[i] = NO_SPRITE;
    this.layer.setX(i, 0);
    this.layer.needsUpdate = true;
    return i;
  }

  // a frame of grind sparks from the contact point (x, y); `rate` is sparks per second, `dir` the way they ride
  // `style`: a metal rail throws hot white sparks; a concrete ledge throws orange ones and chips of concrete
  grind(x: number, y: number, dir: number, rate: number, dt: number, style: GrindStyle = 'metal'): void {
    this.sparkDebt += rate * dt * (FX.tier === 'low' ? 0.5 : 1);
    const p = this.pool;
    const metal = style === 'metal';
    //a big spark flashing right where the truck bites, a new one turned a new way every few frames
    this.flareDebt += (rate > 0 ? 24 : 0) * dt;
    while (this.flareDebt >= 1) {
      this.flareDebt--;
      const f = this.spawn(x, y + 0.03, 0.3, 0.07, metal ? [1, 1, 1] : pick(SPARK_TINT), metal ? rand(0.7, 0.9) : rand(0.55, 0.7), 0.35, 1, 0.6, false);
      this.sparkSprite(f, style);
      this.under(f);
    }
    while (this.sparkDebt >= 1) {
      this.sparkDebt--;
      if (!metal && Math.random() < 0.3) {
        const c = this.spawn(x + rand(-0.08, 0.08), y + rand(0, 0.05), rand(0.05, 0.3), rand(0.35, 0.6), pick(DUST), rand(0.06, 0.1), 0.05, 1, 0.6, true);
        p.vx[c] = dir * rand(-1.8, 0.4);
        p.vy[c] = rand(0.6, 2);
        p.vz[c] = rand(-0.3, 1);
        p.grav[c] = 14;
        p.floor[c] = y - 1.5;
        this.under(c);
        continue;
      }
      // most are spark sprites; a metal rail also spits tiny white-hot pixels between them
      const ember = metal && Math.random() < 0.3;
      const i = ember
        ? this.spawn(x + rand(-0.05, 0.05), y + rand(0, 0.06), rand(0.05, 0.25), rand(0.12, 0.3), pick(SPARK_HOT), rand(0.07, 0.11), 0.02, 1, 0.5, false)
        : this.spawn(x + rand(-0.05, 0.05), y + rand(0, 0.06), rand(0.05, 0.25), metal ? rand(0.2, 0.42) : rand(0.16, 0.32), metal ? [1, 1, 1] : pick(SPARK_TINT), metal ? rand(0.45, 0.65) : rand(0.38, 0.52), 0.12, 1, 0.55, false);
      if (!ember) this.sparkSprite(i, style);
      this.under(i);
      p.vx[i] = dir * rand(-2.5, 1.5) * (metal ? 1.2 : 0.8);
      p.vy[i] = rand(0.8, 3.6) * (metal ? 1.1 : 0.8);
      p.vz[i] = rand(-0.6, 1.6);
      p.grav[i] = 16;
      p.drag[i] = 1.2;
      p.floor[i] = y - 0.05;
    }
  }

  // draw particle `i` in the `behind` layer, under the skater and board
  private under(i: number): void {
    this.layer.setX(i, 1);
  }

  // draw particle `i` as a flickering spark sprite
  private sparkSprite(i: number, style: GrindStyle): void {
    this.cycle[i] = style === 'metal' ? METAL : CONCRETE;
    this.frame0[i] = Math.floor(Math.random() * 8);
    this.fps[i] = rand(14, 26);
  }

  // draw particle `i` as a dust puff, turned a random way
  private puff(i: number): void {
    this.cycle[i] = PUFF;
    this.frame0[i] = Math.floor(Math.random() * 8);
    this.fps[i] = 0;
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

  // a gear part wore past half (worn) or is nearly done (busted): a puff from that part, bigger when busted.
  // Deck splinters, a shoe scuff, sparks off the trucks, rubber crumbs from the wheels. (x, y) is the skater's feet.
  gearWear(part: 'deck' | 'shoes' | 'trucks' | 'wheels', busted: boolean, x: number, y: number): void {
    const k = busted ? 1.8 : 1;
    const look: Record<typeof part, Spray> = {
      deck: { n: 8, colors: [[0.78, 0.55, 0.3], [0.62, 0.42, 0.22], [0.9, 0.75, 0.5]], life: [0.4, 0.7], size: [0.07, 0.11], speed: [1.5, 3.5], angle: [0.3, Math.PI - 0.3], grav: 14, drag: 1, ink: true, floor: y },
      shoes: { n: 6, colors: [[0.85, 0.82, 0.78], [0.6, 0.58, 0.55]], life: [0.3, 0.5], size: [0.12, 0.18], size1: 0.3, speed: [0.5, 1.5], angle: [0.2, Math.PI * 0.6], drag: 4, grav: -0.3, alpha: 0.7, fadeFrom: 0 },
      trucks: { n: 8, colors: [[1, 1, 1], [1, 0.88, 0.54], [1, 0.69, 0.25]], life: [0.15, 0.3], size: [0.08, 0.12], speed: [2.5, 5], angle: [0.2, Math.PI - 0.2], grav: 14 },
      wheels: { n: 8, colors: [[0.95, 0.9, 0.75], [0.3, 0.28, 0.3]], life: [0.35, 0.6], size: [0.06, 0.09], speed: [1, 2.5], angle: [Math.PI * 0.55, Math.PI * 0.95], grav: 12, drag: 1.5, ink: true, floor: y },
    };
    const o = look[part];
    const at = part === 'shoes' ? y + 0.35 : y + 0.08;
    this.spray(x, at, { ...o, n: Math.round(o.n * k), speed: [o.speed[0], o.speed[1] * (busted ? 1.3 : 1)] });
  }

  // a general spray for one-off looks (boons, board mods): `n` pixels from (x, y) in world units
  spray(x: number, y: number, o: Spray): void {
    this.emit(x, y, o, Math.max(1, Math.round(o.n * (FX.tier === 'low' ? 0.6 : 1))));
  }

  private emit(x: number, y: number, o: Spray, n: number): void {
    const p = this.pool;
    const [a0, a1] = o.angle ?? [0, Math.PI * 2];
    for (let k = 0; k < n; k++) {
      const a = o.ring ? a0 + ((k + 0.5) / n) * (a1 - a0) : rand(a0, a1);
      const r = o.radius ?? 0;
      const i = this.spawn(x + Math.cos(a) * r + rand(-1, 1) * (o.jitter ?? 0), y + Math.sin(a) * r * (o.flat ? 0.3 : 1) + rand(-1, 1) * (o.jitter ?? 0), (o.z ?? 0) + rand(-0.1, 0.4), rand(...o.life), pick(o.colors), rand(...o.size), o.size1 ?? 0.03, o.alpha ?? 1, o.fadeFrom ?? 0.4, o.ink ?? false);
      const v = rand(...o.speed);
      p.vx[i] = Math.cos(a) * v;
      p.vy[i] = Math.sin(a) * v * (o.flat ? 0.3 : 1);
      p.vz[i] = o.flat ? Math.sin(a) * v * 0.6 : rand(-0.3, 0.3);
      p.grav[i] = o.grav ?? 0;
      p.drag[i] = o.drag ?? 1;
      if (o.floor !== undefined) p.floor[i] = o.floor;
      if (o.puff) this.puff(i);
    }
  }

  // a spray kept up over time: `rate` pixels a second, with its own running count per `key`
  stream(key: string, x: number, y: number, rate: number, dt: number, o: Spray): void {
    let debt = (this.streams.get(key) ?? 0) + rate * dt * (FX.tier === 'low' ? 0.5 : 1);
    if (debt >= 1) {
      const n = Math.floor(debt);
      debt -= n;
      this.emit(x, y, o, n);
    }
    this.streams.set(key, debt);
  }

  // a dust puff where the board touches down; size 1 for a normal landing. `puff`: a cloud of the dust-puff sprite,
  // bigger and fewer, for something breaking (a car hop or wreck, src/render/car-damage.ts)
  dust(x: number, y: number, size = 1, puff = false): void {
    if (puff) {
      this.spray(x, y + 0.1, { n: Math.round(3 + 3 * size), colors: DUST, life: [0.5, 0.85], size: [0.4 * size, 0.6 * size], size1: 1.1 * size, speed: [0.8 * size, 2.6 * size], angle: [0, Math.PI], jitter: 0.25, drag: 4, grav: -0.4, alpha: 0.85, fadeFrom: 0.2, puff: true });
      return;
    }
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
      if (this.cycle[i] === NO_SPRITE) {
        this.sprite.setX(i, NO_SPRITE);
        continue;
      }
      //flicker to the next frame, turned a new way each time
      const frames = CYCLES[this.cycle[i]];
      const k = this.frame0[i] + Math.floor(p.age[i] * this.fps[i]);
      this.sprite.setX(i, frames[k % frames.length]);
      this.flip.setX(i, (k * 3) % 8);
    }
    this.pos.needsUpdate = this.col.needsUpdate = this.size.needsUpdate = this.alpha.needsUpdate = true;
    this.sprite.needsUpdate = this.flip.needsUpdate = true;
  }

  clear(): void {
    this.pool.life.fill(0);
  }

  // the world moved under the particles (a floor handed over to the next, src/game/game.ts): move them with it
  shift(dx: number, dy: number): void {
    const p = this.pool;
    for (let i = 0; i < p.size; i++) {
      if (!p.life[i]) continue;
      p.px[i] += dx;
      p.py[i] += dy;
      p.floor[i] += dy;
    }
  }
}
