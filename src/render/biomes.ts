// How each act's district looks, laid over the time of day: a colour grade on the sky, fog, light and skyline, and
// a drift of ambient pixels in the air (leaves, dust, bubbles, data, embers). Until each biome has its own tileset
// and kit, this is what tells them apart. Gameplay picks the biome; `?biome=<id>` previews one.
import * as THREE from 'three';
import type { Mood } from './atmosphere';
import { FX } from './fx-settings';

export type BiomeId = 'chicago' | 'clemente' | 'greece' | 'atlantis' | 'museum' | 'hightech' | 'space' | 'hive';

interface Ambient {
  colors: number[];
  rate: number; // per second over the view
  size: [number, number]; // world units
  vy: [number, number]; // rise (+) or fall (-), world units per second
  sway: number; // side to side, world units
  life: [number, number];
}

export interface BiomeLook {
  name: string;
  grade: number; // 0..1: how strongly the colours below replace the time of day's
  skyTop: number;
  skyBottom: number;
  fog: number;
  hemiSky: number;
  hemiGround: number;
  skyline: number;
  neon?: number; // floor for the skyline's neon
  stars?: number; // floor for the stars
  fogScale?: number; // fog distances times this
  gravity: number; // from the GDD table; the sim applies it, this is for reference
  ambient: Ambient | null;
}

export const BIOMES: Record<BiomeId, BiomeLook> = {
  chicago: {
    name: 'Chicago streets', grade: 0, skyTop: 0, skyBottom: 0, fog: 0, hemiSky: 0, hemiGround: 0, skyline: 0xffffff,
    gravity: 1, ambient: null,
  },
  //a park in the sun: greener light off the grass, falling leaves
  clemente: {
    name: 'Clemente Park', grade: 0.35, skyTop: 0x5aa0e8, skyBottom: 0xc8f0d0, fog: 0x3c5a48, hemiSky: 0xf0ffe0,
    hemiGround: 0x3a5a2a, skyline: 0xd8f0d0, gravity: 1,
    ambient: { colors: [0xd88a2a, 0xb05a20, 0x8ab040, 0xe0b040], rate: 10, size: [0.19, 0.29], vy: [-0.9, -0.5], sway: 0.8, life: [3, 5] },
  },
  //white marble and a hot sun: bleached sky, sand fog, gold dust in the air
  greece: {
    name: 'Ancient Greece', grade: 0.45, skyTop: 0x3a8ae0, skyBottom: 0xf8e8c0, fog: 0x8a7050, hemiSky: 0xfff4dc,
    hemiGround: 0x6a5030, skyline: 0xf0dcb0, gravity: 1,
    ambient: { colors: [0xffe0a0, 0xfff4d0], rate: 14, size: [0.10, 0.16], vy: [-0.1, 0.25], sway: 0.4, life: [2.5, 4] },
  },
  //under the sea: teal water for sky, close blue fog, bubbles rising
  atlantis: {
    name: 'Atlantis', grade: 0.75, skyTop: 0x04304a, skyBottom: 0x2aa0b0, fog: 0x0a4a60, hemiSky: 0x80e0ff,
    hemiGround: 0x062030, skyline: 0x5ab8c8, neon: 0.4, fogScale: 0.6, gravity: 0.8,
    ambient: { colors: [0xd0f8ff, 0x90e0f8, 0xffffff], rate: 22, size: [0.11, 0.22], vy: [0.8, 1.6], sway: 0.25, life: [2, 3.5] },
  },
  //indoors: a dim warm hall instead of a sky, dust drifting in the gallery lights
  museum: {
    name: 'Art Museum', grade: 0.85, skyTop: 0x1a1418, skyBottom: 0x4a3a34, fog: 0x2a2024, hemiSky: 0xffe8d0,
    hemiGround: 0x2a2020, skyline: 0x6a5850, fogScale: 0.7, gravity: 1,
    ambient: { colors: [0xfff0d8, 0xe8d8c0], rate: 12, size: [0.08, 0.13], vy: [-0.15, 0.15], sway: 0.3, life: [3, 5] },
  },
  //cold glass and neon: cyan-magenta grade, data pixels streaming up
  hightech: {
    name: 'High-Tech City', grade: 0.5, skyTop: 0x0a0a2a, skyBottom: 0x2a3a7a, fog: 0x101838, hemiSky: 0x80c8ff,
    hemiGround: 0x180830, skyline: 0x7090d0, neon: 0.8, gravity: 1,
    ambient: { colors: [0x4ad8ff, 0xff4fd8, 0xffffff], rate: 16, size: [0.10, 0.16], vy: [1.2, 2.4], sway: 0, life: [1.2, 2] },
  },
  //black sky full of stars, no haze, slow cosmic dust
  space: {
    name: 'Outer Space', grade: 0.9, skyTop: 0x02020a, skyBottom: 0x1a0c34, fog: 0x08061a, hemiSky: 0xc0c8ff,
    hemiGround: 0x0a0818, skyline: 0x403a6a, neon: 0.6, stars: 1, fogScale: 1.6, gravity: 0.6,
    ambient: { colors: [0xb8c0ff, 0xffffff, 0xd8a8ff], rate: 8, size: [0.08, 0.14], vy: [-0.1, 0.1], sway: 0.15, life: [4, 6] },
  },
  //the AI's stronghold: red-amber glow, embers rising
  hive: {
    name: 'The Hive', grade: 0.6, skyTop: 0x1a0408, skyBottom: 0x6a1a10, fog: 0x2a0a0c, hemiSky: 0xffa080,
    hemiGround: 0x200408, skyline: 0x8a3a30, neon: 0.9, gravity: 1,
    ambient: { colors: [0xff8a30, 0xffc060, 0xff4020], rate: 18, size: [0.10, 0.18], vy: [0.6, 1.4], sway: 0.5, life: [1.5, 2.5] },
  },
};

// the far backdrop behind each district: QFS's own per-world layers (survivor_skins), as cards far behind the
// street that drift slowly with the camera. Tinted by the mood like Chicago's skyline; strong reds and blues keep
// their colour at night. Greece has only its sky.
export interface BackdropLayer {
  file: string; // in public/tex
  px: [number, number]; // image size
  scale: number; // world units per pixel
  z: number;
  lift: number; // world units its bottom sits above Chicago's skyline's
  parallax: number; // share of the camera's movement it follows (1: fixed to the camera)
}

const CHICAGO_SKYLINE: BackdropLayer = { file: 'chicago_skyline.png', px: [726, 400], scale: 1 / 6, z: -70, lift: 0, parallax: 0.85 };

export const BACKDROPS: Record<BiomeId, BackdropLayer[]> = {
  chicago: [CHICAGO_SKYLINE],
  clemente: [{ file: 'bkgd_clemente.png', px: [900, 158], scale: 1 / 6, z: -60, lift: 0, parallax: 0.8 }],
  greece: [],
  atlantis: [
    { file: 'bkgd_atlantis_dragon.png', px: [1400, 382], scale: 1 / 8, z: -75, lift: 12, parallax: 0.9 },
    { file: 'bkgd_atlantis_wave.png', px: [96, 64], scale: 1 / 3, z: -62, lift: 0, parallax: 0.8 },
  ],
  museum: [
    { file: 'bkgd_museum_city.png', px: [700, 260], scale: 1 / 5, z: -72, lift: 0, parallax: 0.88 },
    { file: 'bkgd_museum_sculptures.png', px: [1100, 400], scale: 1 / 7, z: -60, lift: 0, parallax: 0.8 },
  ],
  hightech: [{ file: 'bkgd_hightech.png', px: [726, 400], scale: 1 / 6, z: -70, lift: 0, parallax: 0.85 }],
  space: [
    { file: 'bkgd_space_stars.png', px: [726, 400], scale: 1 / 6, z: -78, lift: 0, parallax: 0.95 },
    { file: 'bkgd_space_planets.png', px: [300, 26], scale: 1 / 2, z: -74, lift: 28, parallax: 0.92 },
  ],
  hive: [CHICAGO_SKYLINE],
};

export const BACKDROP_SPAN = (726 / 6) * 8; // world units each card covers, as Chicago's always has

export function isBiome(id: string | null): id is BiomeId {
  return id !== null && id in BIOMES;
}

const mix = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

// the time of day, graded toward a biome
export function biomeMood(m: Mood, id: BiomeId): Mood {
  const b = BIOMES[id];
  if (b.grade <= 0) return m;
  const t = b.grade;
  return {
    ...m,
    skyTop: mix(m.skyTop, b.skyTop, t),
    skyBottom: mix(m.skyBottom, b.skyBottom, t),
    fog: mix(m.fog, b.fog, t),
    hemiSky: mix(m.hemiSky, b.hemiSky, t),
    hemiGround: mix(m.hemiGround, b.hemiGround, t),
    skyline: mix(m.skyline, b.skyline, t),
    neon: Math.max(m.neon, b.neon ?? 0),
    stars: Math.max(m.stars, b.stars ?? 0),
    fogNear: m.fogNear * (b.fogScale ?? 1),
    fogFar: m.fogFar * (b.fogScale ?? 1),
  };
}

const MAX = 96;

// the biome's drift of pixels through the air round the camera: one small point cloud, one draw call
export class Ambience {
  readonly points: THREE.Points;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly col = new Float32Array(MAX * 3);
  private readonly size = new Float32Array(MAX);
  private readonly alpha = new Float32Array(MAX);
  private readonly vy = new Float32Array(MAX);
  private readonly phase = new Float32Array(MAX);
  private readonly age = new Float32Array(MAX);
  private readonly life = new Float32Array(MAX);
  private look: Ambient | null = null;
  private debt = 0;
  private next = 0;
  private t = 0;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aAlpha;
        uniform float uScale;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.02) discard;
          gl_FragColor = vec4(vColor, vAlpha);
          #include <colorspace_fragment>
        }
      `,
      uniforms: { uScale: { value: 500 } },
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  set(id: BiomeId): void {
    this.look = BIOMES[id].ambient;
    this.alpha.fill(0);
    this.points.visible = this.look !== null;
  }

  // dt in seconds; spawns in the view round the camera; pointScale from the view, like the particles
  update(dt: number, camera: THREE.PerspectiveCamera, pointScale: number): void {
    const a = this.look;
    if (!a) return;
    this.t += dt;
    (this.points.material as THREE.ShaderMaterial).uniforms.uScale.value = pointScale;
    this.debt += a.rate * dt * (FX.tier === 'low' ? 0.5 : 1);
    const hh = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    while (this.debt >= 1) {
      this.debt--;
      const i = this.next;
      this.next = (this.next + 1) % MAX;
      const z = THREE.MathUtils.randFloat(-3, 3);
      const d = camera.position.z - z;
      const h = hh * d;
      const w = h * camera.aspect;
      this.pos[i * 3] = camera.position.x + THREE.MathUtils.randFloat(-w, w * 1.4);
      this.pos[i * 3 + 1] = camera.position.y + THREE.MathUtils.randFloat(-h, h);
      this.pos[i * 3 + 2] = z;
      const c = new THREE.Color(a.colors[Math.floor(Math.random() * a.colors.length)]);
      this.col.set([c.r, c.g, c.b], i * 3);
      this.size[i] = THREE.MathUtils.randFloat(...a.size);
      this.vy[i] = THREE.MathUtils.randFloat(...a.vy);
      this.phase[i] = Math.random() * Math.PI * 2;
      this.age[i] = 0;
      this.life[i] = THREE.MathUtils.randFloat(...a.life);
    }
    for (let i = 0; i < MAX; i++) {
      if (this.age[i] >= this.life[i]) {
        this.alpha[i] = 0;
        continue;
      }
      this.age[i] += dt;
      const k = this.age[i] / this.life[i];
      this.pos[i * 3] += Math.cos(this.t * 1.3 + this.phase[i]) * a.sway * dt;
      this.pos[i * 3 + 1] += this.vy[i] * dt;
      this.alpha[i] = Math.min(1, k * 5, (1 - k) * 4) * 0.85;
    }
    const g = this.points.geometry;
    for (const n of ['position', 'aColor', 'aSize', 'aAlpha']) g.getAttribute(n).needsUpdate = true;
  }
}
