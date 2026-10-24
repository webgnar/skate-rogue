// Time of day and weather. Decided by zack (Oct 24 2026): the clock advances through a run, from afternoon to
// golden hour to dusk to neon night by the late acts; rain rolls per floor. All of it is lights, fog, a gradient
// sky and a tinted skyline (neon stays lit at night), plus one draw call of rain streaks, so it costs nothing extra
// on older phones.
import * as THREE from 'three';

export interface Mood {
  skyTop: number;
  skyBottom: number;
  hemiSky: number;
  hemiGround: number;
  hemi: number;
  sun: number; // colour
  sunI: number;
  sunDir: [number, number, number];
  fog: number;
  fogNear: number;
  fogFar: number;
  skyline: number; // tint over the skyline card
  neon: number; // 0..1: how much the skyline's neon ignores the tint
  stars: number; // 0..1
}

export const MOODS: Record<'afternoon' | 'golden' | 'dusk' | 'night', Mood> = {
  afternoon: {
    skyTop: 0x5494f5, skyBottom: 0x8acef2, hemiSky: 0xffe8f0, hemiGround: 0x403050, hemi: 1.1,
    sun: 0xfff0e0, sunI: 2.1, sunDir: [-6, 12, 10], fog: 0x3a2a5c, fogNear: 40, fogFar: 140,
    skyline: 0xffffff, neon: 0, stars: 0,
  },
  golden: {
    skyTop: 0x4a74d0, skyBottom: 0xffb36b, hemiSky: 0xffd8b8, hemiGround: 0x503040, hemi: 1.0,
    sun: 0xffb070, sunI: 2.4, sunDir: [-12, 6, 10], fog: 0x6a4060, fogNear: 40, fogFar: 140,
    skyline: 0xffd2b4, neon: 0.2, stars: 0,
  },
  dusk: {
    skyTop: 0x262a6a, skyBottom: 0xe0607a, hemiSky: 0xc8a0ff, hemiGround: 0x302040, hemi: 0.9,
    sun: 0xff8a70, sunI: 1.5, sunDir: [-14, 3, 8], fog: 0x3a2050, fogNear: 35, fogFar: 125,
    skyline: 0x9a80c0, neon: 0.65, stars: 0.3,
  },
  night: {
    skyTop: 0x05061a, skyBottom: 0x2a1640, hemiSky: 0x7080d0, hemiGround: 0x100818, hemi: 0.8,
    sun: 0xa8b8ff, sunI: 1.1, sunDir: [8, 12, 10], fog: 0x140c24, fogNear: 30, fogFar: 110,
    skyline: 0x44406a, neon: 1, stars: 1,
  },
};

// how far through the day a floor is: afternoon on floor 1, night from floor 13 (act 5) on, and Endless stays night
export function clockFor(floor: number): number {
  return Math.min(1, Math.max(0, (floor - 1) / 12));
}

const KEYS: [number, Mood][] = [
  [0, MOODS.afternoon],
  [0.35, MOODS.golden],
  [0.65, MOODS.dusk],
  [1, MOODS.night],
];

const lerpHex = (a: number, b: number, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

// the mood at a point in the day, blended between the nearest two
export function moodAt(clock: number): Mood {
  let i = 0;
  while (i < KEYS.length - 2 && clock > KEYS[i + 1][0]) i++;
  const [t0, a] = KEYS[i];
  const [t1, b] = KEYS[i + 1];
  const t = Math.min(1, Math.max(0, (clock - t0) / (t1 - t0)));
  const out = { ...a } as Mood;
  for (const k of Object.keys(a) as (keyof Mood)[]) {
    const va = a[k];
    const vb = b[k];
    if (k === 'sunDir') out.sunDir = a.sunDir.map((v, j) => v + (b.sunDir[j] - v) * t) as Mood['sunDir'];
    else if (['skyTop', 'skyBottom', 'hemiSky', 'hemiGround', 'sun', 'fog', 'skyline'].includes(k)) (out[k] as number) = lerpHex(va as number, vb as number, t);
    else (out[k] as number) = (va as number) + ((vb as number) - (va as number)) * t;
  }
  return out;
}

// rain on a floor: from floor 2, about one floor in four, fixed by the run seed
export function rainsOn(seed: number, floor: number): boolean {
  if (floor < 2) return false;
  const h = Math.sin(seed * 12.9898 + floor * 78.233) * 43758.5453;
  return h - Math.floor(h) < 0.25;
}

// rain turns the mood grey, wet and close
export function rainy(m: Mood): Mood {
  const grey = 0x5a6274;
  return {
    ...m,
    skyTop: lerpHex(m.skyTop, grey, 0.5),
    skyBottom: lerpHex(m.skyBottom, grey, 0.55),
    hemi: m.hemi * 0.85,
    sunI: m.sunI * 0.45,
    fog: lerpHex(m.fog, 0x3a4050, 0.5),
    fogNear: m.fogNear * 0.6,
    fogFar: m.fogFar * 0.75,
    skyline: lerpHex(m.skyline, 0x8890a0, 0.4),
    stars: 0,
  };
}

const skyVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.9999, 1.0); // behind everything
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform float uStars;
  uniform vec2 uRes;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
    // pixel stars on the upper sky, in 4 px cells
    vec2 cell = floor(gl_FragCoord.xy / 4.0);
    float s = step(0.996, hash(cell)) * uStars * smoothstep(0.35, 0.8, vUv.y);
    col = mix(col, vec3(1.0, 0.95, 0.85), s);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const skylineFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 uTint;
  uniform float uNeon;
  varying vec2 vUv;
  void main() {
    vec4 tex = texture2D(map, vUv);
    if (tex.a < 0.3) discard;
    // neon: strongly red or blue against green; it keeps its own colour as the tint darkens the rest
    float neon = smoothstep(0.25, 0.55, max(tex.r, tex.b) - tex.g) * uNeon;
    gl_FragColor = vec4(tex.rgb * mix(uTint, vec3(1.15), neon), 1.0);
    #include <colorspace_fragment>
  }
`;

export function skylineMaterial(map: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      uniform mat3 uvTransform;
      varying vec2 vUv;
      void main() {
        vUv = (uvTransform * vec3(uv, 1.0)).xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: skylineFragment,
    uniforms: {
      map: { value: map },
      uvTransform: { value: map.matrix },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uNeon: { value: 0 },
    },
  });
}

export function skyMesh(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: { uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() }, uStars: { value: 0 }, uRes: { value: new THREE.Vector2() } },
      depthWrite: false,
    }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

const RAIN_N = 160;

// rain: slanted streaks in a box round the camera's view, one draw call
export class Rain {
  readonly mesh: THREE.Mesh;
  private readonly pos: THREE.BufferAttribute;
  private readonly drops: { x: number; y: number; z: number; v: number }[] = [];
  on = false;

  constructor() {
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(RAIN_N * 4 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const index: number[] = [];
    for (let i = 0; i < RAIN_N; i++) {
      const v = i * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
      this.drops.push({ x: Math.random(), y: Math.random(), z: -3 + Math.random() * 13, v: 0.8 + Math.random() * 0.4 });
    }
    geo.setAttribute('position', this.pos);
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xc8d8ff, transparent: true, opacity: 0.45, depthWrite: false, fog: false }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  update(dt: number, camera: THREE.PerspectiveCamera): void {
    this.mesh.visible = this.on;
    if (!this.on) return;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const cam = camera.position;
    for (let i = 0; i < RAIN_N; i++) {
      const d = this.drops[i];
      //fall in screen fractions per second, wrapping round the view, drifting left as if the skater rides into it
      d.y -= 1.6 * d.v * dt;
      d.x -= 0.35 * d.v * dt;
      if (d.y < 0) d.y += 1;
      if (d.x < 0) d.x += 1;
      const depth = cam.z - d.z;
      const hh = tanHalf * depth;
      const hw = hh * camera.aspect;
      const x = cam.x + (d.x * 2 - 1) * hw * 1.1;
      const y = cam.y - depth * 0.18 + (d.y * 2 - 1) * hh * 1.1;
      const len = hh * 0.07;
      const w = hh * 0.0035;
      const v = i * 4;
      //slanted: the top leans right of the bottom
      this.pos.setXYZ(v, x - w, y, d.z);
      this.pos.setXYZ(v + 1, x + w, y, d.z);
      this.pos.setXYZ(v + 2, x + w + len * 0.25, y + len, d.z);
      this.pos.setXYZ(v + 3, x - w + len * 0.25, y + len, d.z);
    }
    this.pos.needsUpdate = true;
  }
}
