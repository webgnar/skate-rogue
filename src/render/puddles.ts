// Rain puddles (fx6; zack: "rain creates puddles"). On a rainy floor they grow over the first ~20 s in low, flat
// places: the street, roofs and the overpass, never on rails, ledges, stairs or banks, and clear of cars and edges.
// One instanced draw for all of them. The water fakes its reflections in its own shader: the sky gradient flipped,
// smeared neon streaks, stretched pools under nearby lights, raindrop ripples, and a wake where the skater rolls
// through. Nothing renders the scene twice.
import * as THREE from 'three';
import type { Level } from '../physics/level';
import { toX, toY } from './kit';

export interface Puddle {
  x: number; // centre, world units
  y: number; // surface height
  z: number; // depth centre
  w: number; // half width along x
  d: number; // half depth along z
  delay: number; // seconds into the floor before it starts to form
  seed: number;
}

export const PUDDLE = {
  grow: 8, // seconds from nothing to full
  lastStart: 12, // the last puddle starts forming by then, so all are full by ~20 s
  every: 9, // about one puddle per this many tiles of flat ground
  margin: 1.2, // tiles kept clear of surface ends, cars and glass
  lights: 4, // light pools reflected at once
};

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// where a floor's puddles go, fixed by the seed
export function puddleSpots(level: Level, seed: number, floor: number): Puddle[] {
  const r = rng(seed * 7919 + floor * 104729);
  const out: Puddle[] = [];
  //flat runs: [x0, x1] in tiles at height y, with the z band they cover
  const runs: { x0: number; x1: number; y: number; z: number; d: number }[] = [];
  let c = Math.round(toX(level.finaleX));
  while (c < level.street.length) {
    if (!level.street[c]) {
      c++;
      continue;
    }
    let end = c;
    while (end + 1 < level.street.length && level.street[end + 1]) end++;
    runs.push({ x0: c, x1: end + 1, y: 0, z: 0.3, d: 1.6 });
    c = end + 1;
  }
  for (const s of level.surfaces) {
    if (s.kind !== 'roof' && s.kind !== 'overpass') continue;
    const y = toY(level, s.y);
    runs.push({ x0: toX(s.x0), x1: toX(s.x1), y, z: s.kind === 'overpass' ? 0.1 : 0, d: s.kind === 'overpass' ? 1 : 1.5 });
  }
  const blocked = (x0: number, x1: number) =>
    level.cars.some((car) => x1 > toX(car.x0) - PUDDLE.margin && x0 < toX(car.x1) + PUDDLE.margin) ||
    level.glass.some((g) => x1 > toX(g.x0) - PUDDLE.margin && x0 < toX(g.x1) + PUDDLE.margin);
  for (const run of runs) {
    const len = run.x1 - run.x0 - 2 * PUDDLE.margin;
    if (len < 2) continue;
    const n = Math.max(r() < len / PUDDLE.every ? 1 : 0, Math.floor(len / PUDDLE.every));
    for (let i = 0; i < n; i++) {
      const w = 0.8 + r() * 1.4;
      if (2 * w > len) continue;
      const x = run.x0 + PUDDLE.margin + w + r() * (len - 2 * w);
      if (blocked(x - w, x + w)) continue;
      if (out.some((p) => p.y === run.y && Math.abs(p.x - x) < p.w + w + 0.5)) continue;
      out.push({ x, y: run.y, z: run.z + (r() - 0.5) * 0.6, w, d: run.d * (0.6 + r() * 0.4), delay: r() * PUDDLE.lastStart, seed: r() * 100 });
    }
  }
  return out;
}

// Chinatown's street is wet whatever the weather (zack's photos): standing water along its flats, already there when
// you arrive. Only for the look: they're not in forSim(), so they don't soak the deck
export function chinatownPuddles(level: Level, seed: number, floor: number): Puddle[] {
  const r = rng(seed * 6271 + floor * 3571);
  const out: Puddle[] = [];
  for (const [a, b] of level.chinatown ?? []) {
    for (const s of level.surfaces) {
      if (s.kind !== 'roof' || s.top || s.sky || s.x1 <= a || s.x0 >= b) continue;
      const [x0, x1] = [toX(Math.max(a, s.x0)) + 0.6, toX(Math.min(b, s.x1)) - 0.6];
      for (let x = x0 + r() * 2; x < x1 - 0.8; x += 2.2 + r() * 2.5) {
        const w = Math.min(0.6 + r() * 1.1, (x1 - x) / 2);
        out.push({ x: x + w, y: toY(level, s.y), z: (r() - 0.5) * 2.4, w, d: 0.5 + r() * 0.7, delay: -PUDDLE.grow, seed: r() * 100 });
        x += 2 * w;
      }
    }
  }
  return out;
}

// how formed a puddle is, 0..1, t seconds into the floor
export function puddleGrowth(p: Puddle, t: number): number {
  return Math.min(1, Math.max(0, (t - p.delay) / PUDDLE.grow));
}

const vertex = /* glsl */ `
  attribute float aDelay;
  attribute float aSeed;
  attribute float aWet; // 1: Chinatown's standing water, there whatever the weather
  uniform float uTime;
  uniform float uGrow;
  uniform float uScale;
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vGrowth;
  varying float vSeed;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv * 2.0 - 1.0;
    vSeed = aSeed;
    vGrowth = aWet > 0.5 ? 1.0 : clamp((uTime - aDelay) / uGrow, 0.0, 1.0) * min(uScale, 1.0);
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform float uRain; // 0..1.6
  uniform vec3 uSkyTop;
  uniform vec3 uSkyBottom;
  uniform vec3 uNeon;
  uniform float uNeonAmt;
  uniform vec2 uRes;
  uniform vec4 uLights[${PUDDLE.lights}]; // xyz world, w intensity
  uniform vec3 uLightCol[${PUDDLE.lights}];
  uniform vec3 uWake; // x, z of the skater, strength
  varying vec2 vUv;
  varying vec3 vWorld;
  varying float vGrowth;
  varying float vSeed;
  #include <fog_pars_fragment>
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + vSeed) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    if (vGrowth <= 0.01) discard;
    // a noisy blob that spreads as it fills
    float r = length(vUv) + (noise(vUv * 2.5) - 0.5) * 0.45 + (noise(vUv * 6.0) - 0.5) * 0.12;
    float edge = 0.15 + 0.75 * vGrowth;
    if (r > edge) discard;

    // the sky, flipped: the top of the screen's water shows the sky's horizon colour, near water the zenith
    float sy = gl_FragCoord.y / uRes.y;
    vec3 refl = mix(uSkyTop, uSkyBottom, sy * 0.9) * 0.8;
    // neon from the skyline, smeared into vertical streaks
    float col = floor(vWorld.x * 2.2);
    float streak = step(0.72, hash(vec2(col, 3.0))) * (0.6 + 0.4 * sin(vWorld.z * 3.0 + col));
    refl += uNeon * streak * uNeonAmt * 1.4;
    // pools under nearby lights, stretched toward the camera
    for (int i = 0; i < ${PUDDLE.lights}; i++) {
      vec4 L = uLights[i];
      float dx = vWorld.x - L.x;
      float k = exp(-dx * dx * 3.0) * exp(-max(0.0, L.y - vWorld.y) * 0.08) * L.w;
      refl += uLightCol[i] * k;
    }
    // ripples: rings from drops on a grid, a few per cell per second
    vec2 g = vWorld.xz * 2.5;
    vec2 cell = floor(g);
    float ring = 0.0;
    for (int j = 0; j < 2; j++) {
      vec2 c = cell + vec2(float(j), 0.0);
      float ph = hash(c);
      float t = fract(uTime * (0.6 + 0.6 * ph) * uRain + ph * 7.0);
      vec2 o = c + vec2(hash(c + 9.0), hash(c + 17.0));
      float d = length(g - o);
      ring += smoothstep(0.05, 0.0, abs(d - t * 0.6)) * (1.0 - t);
    }
    refl += vec3(0.5) * ring * min(1.0, uRain);
    // a wake behind the skater: a widening V that breaks up the reflection
    float bx = uWake.x - vWorld.x;
    float v = abs(vWorld.z - uWake.y) - bx * 0.35;
    float wake = uWake.z * step(0.0, bx) * smoothstep(3.0, 0.0, bx) * smoothstep(0.12, 0.0, abs(v));
    refl = mix(refl, vec3(0.9, 0.95, 1.0), wake * 0.6);

    // glossy: the far side catches the sky, the near side shows the dark water
    vec3 water = mix(vec3(0.03, 0.035, 0.06), refl, 0.3 + 0.45 * smoothstep(-1.0, 1.0, vUv.y));
    // ink rim
    if (r > edge - 0.07) water = vec3(0.07, 0.04, 0.09);
    gl_FragColor = vec4(water, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const MAX = 64;
const tmp = new THREE.Matrix4();

export class Puddles {
  readonly mesh: THREE.InstancedMesh;
  private readonly mat: THREE.ShaderMaterial;
  private readonly delay: THREE.InstancedBufferAttribute;
  private readonly seed: THREE.InstancedBufferAttribute;
  private readonly wet: THREE.InstancedBufferAttribute;
  private spots: Puddle[] = [];
  private t = 0;
  private wake = 0;
  scale = 1; // drizzle smaller, downpour bigger

  constructor() {
    const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.delay = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.seed = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.wet = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    geo.setAttribute('aDelay', this.delay);
    geo.setAttribute('aSeed', this.seed);
    geo.setAttribute('aWet', this.wet);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uGrow: { value: PUDDLE.grow },
          uScale: { value: 1 },
          uRain: { value: 1 },
          uSkyTop: { value: new THREE.Color() },
          uSkyBottom: { value: new THREE.Color() },
          uNeon: { value: new THREE.Color(0xff3fb0) },
          uNeonAmt: { value: 0.3 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uLights: { value: Array.from({ length: PUDDLE.lights }, () => new THREE.Vector4()) },
          uLightCol: { value: Array.from({ length: PUDDLE.lights }, () => new THREE.Color()) },
          uWake: { value: new THREE.Vector3() },
        },
      ]),
      fog: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, MAX);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  // a new floor: these puddles, starting dry; none when it isn't raining. `wet` are standing water whatever the
  // weather (chinatownPuddles), drawn after them
  set(spots: Puddle[], rain: number, wet: Puddle[] = []): void {
    this.spots = rain > 0 ? spots.slice(0, MAX) : [];
    const always = wet.slice(0, MAX - this.spots.length);
    this.t = 0;
    this.scale = rain <= 0 ? 0 : rain < 0.8 ? 0.55 : rain > 1.2 ? 1.2 : 1;
    this.mat.uniforms.uScale.value = this.scale;
    this.mat.uniforms.uRain.value = rain;
    this.spots.forEach((p, i) => {
      tmp.makeScale(p.w * Math.max(1, this.scale), 1, p.d * Math.max(1, this.scale)).setPosition(p.x, p.y + 0.012, p.z);
      this.mesh.setMatrixAt(i, tmp);
      this.delay.setX(i, p.delay);
      this.seed.setX(i, p.seed);
      this.wet.setX(i, 0);
    });
    always.forEach((p, k) => {
      const i = this.spots.length + k;
      tmp.makeScale(p.w, 1, p.d).setPosition(p.x, p.y + 0.012, p.z);
      this.mesh.setMatrixAt(i, tmp);
      this.delay.setX(i, p.delay);
      this.seed.setX(i, p.seed);
      this.wet.setX(i, 1);
    });
    this.mesh.count = this.spots.length + always.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.delay.needsUpdate = this.seed.needsUpdate = this.wet.needsUpdate = true;
  }

  setSky(top: number, bottom: number, neon: number): void {
    this.mat.uniforms.uSkyTop.value.setHex(top);
    this.mat.uniforms.uSkyBottom.value.setHex(bottom);
    this.mat.uniforms.uNeonAmt.value = 0.25 + 0.75 * neon;
  }

  // the puddle the skater is in at (x, y), if any (only once it has formed enough to splash)
  // the puddles for the floor sim (src/sim/floor.ts), which wears the deck rolling through them: world units, sized
  // and formed as at() sees them
  forSim(): { x: number; y: number; w: number; delay: number; grow: number; k: number }[] {
    return this.spots.map((p) => ({ x: p.x, y: p.y, w: p.w * Math.max(1, this.scale), delay: p.delay, grow: PUDDLE.grow, k: Math.min(1, this.scale) }));
  }

  at(x: number, y: number): Puddle | null {
    for (const p of this.spots) {
      const g = puddleGrowth(p, this.t) * Math.min(1, this.scale);
      if (g > 0.3 && Math.abs(p.y - y) < 0.2 && Math.abs(x - p.x) < p.w * Math.max(1, this.scale) * (0.15 + 0.75 * g)) return p;
    }
    return null;
  }

  // dt game seconds; lights are world points with a colour and strength; wading: the skater is in a puddle
  update(dt: number, res: THREE.Vector2, lights: { pos: THREE.Vector3; color: THREE.Color; k: number }[], skater: THREE.Vector3, wading: boolean): void {
    this.t += dt;
    const u = this.mat.uniforms;
    u.uTime.value = this.t;
    u.uRes.value.copy(res);
    for (let i = 0; i < PUDDLE.lights; i++) {
      const l = lights[i];
      (u.uLights.value as THREE.Vector4[])[i].set(l?.pos.x ?? 0, l?.pos.y ?? 0, l?.pos.z ?? 0, l ? l.k : 0);
      if (l) (u.uLightCol.value as THREE.Color[])[i].copy(l.color);
    }
    this.wake = wading ? 1 : Math.max(0, this.wake - dt * 1.5);
    u.uWake.value.set(skater.x, skater.z + 0.25, this.wake);
  }
}
