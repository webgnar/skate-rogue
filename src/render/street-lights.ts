// Street lights (lighting thread, zack Oct 26 2026: "more street light types that turn on and shine wider"). Five
// kinds: the curb post, a tall cobra head whose arm reaches out over the street, Chicago's twin-globe acorn post, a
// wall pack on the building fronts, and cobra arms bolted to the hills' power poles. Each lamp has its own photocell:
// a few come on at golden hour, most at dusk, all of them at night, and the ones on the edge of switching flick on as
// the skater rolls up to them. All the light is fake (additive pools, cones and halos); the whole set is six draw
// calls a floor whatever the count. lightAt() tells the skater's light (skater-light.ts) how lit they are.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FX } from './fx-settings';
import { inkify, toon } from './toon';

export type LampKind = 'post' | 'cobra' | 'acorn' | 'wall' | 'arm';

interface Spec {
  color: number; // the light's colour
  bulbs: [number, number, number][]; // bulb centres from the lamp's foot, street toward +z
  bulb: [number, number, number]; // bulb size
  pool: [number, number, number]; // ground pool: width along the street, depth across it, its centre's z offset
  cone: [number, number]; // cone radius at the ground, and how far down it reaches below the bulb (0: none)
  halo: number; // glow round each bulb
  reach: number; // how much the pool lights the skater (0..1)
}

export const LAMPS: Record<LampKind, Spec> = {
  post: { color: 0xffc87a, bulbs: [[0, 2.92, 0.7]], bulb: [0.2, 0.06, 0.5], pool: [6, 4, 2.0], cone: [1.7, 2.9], halo: 0.9, reach: 0.75 },
  cobra: { color: 0xffa850, bulbs: [[0, 5.18, 2.15]], bulb: [0.3, 0.07, 0.5], pool: [9, 5.4, 2.6], cone: [2.8, 5.2], halo: 1.3, reach: 1 },
  acorn: { color: 0xffe2b0, bulbs: [[-0.5, 3.62, 0], [0.5, 3.62, 0]], bulb: [0.34, 0.44, 0.34], pool: [6.5, 4.6, 0.9], cone: [0, 0], halo: 1.2, reach: 0.65 },
  wall: { color: 0xc4e2ff, bulbs: [[0, 2.5, 0.2]], bulb: [0.3, 0.16, 0.06], pool: [4.6, 2.6, 1.3], cone: [1.4, 2.5], halo: 0.8, reach: 0.3 },
  arm: { color: 0xffb060, bulbs: [[0, -0.12, 2.35]], bulb: [0.3, 0.07, 0.5], pool: [9, 5.4, 2.5], cone: [2.8, 0], halo: 1.3, reach: 1 },
};
// a cobra row now and then is the city's newer white LED heads
const LED = 0xd8e8ff;

export const STREET_LIGHTS = {
  on: [0.1, 0.55], // night values the photocells switch at, spread over the lamps
  approach: 0.28, // lamps this close to switching on flick on as the skater comes up to them...
  reach: 11, // ...this many tiles ahead
  warm: 0.9, // seconds a lamp takes to come up (sodium heads warm up from dim orange)
  rainHaze: 0.7, // rain makes the cones show up this much more
};

// a lamp's shape, its foot at the origin and the street toward +z
function frame(kind: LampKind): THREE.BufferGeometry {
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    return g.translate(x, y, z);
  };
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'post') parts.push(box(0.12, 3, 0.12, 0, 1.5, 0), box(0.22, 0.12, 0.9, 0, 3, 0.35));
  if (kind === 'cobra') {
    parts.push(box(0.16, 0.3, 0.16, 0, 0.15, 0), box(0.12, 5.3, 0.12, 0, 2.65, 0));
    parts.push(box(0.09, 0.09, 1.9, 0, 5.32, 0.95), box(0.06, 0.06, 1.0, 0, 4.98, 0.42, -0.62)); // arm and brace
    parts.push(box(0.36, 0.16, 0.74, 0, 5.3, 2.12)); // the head
  }
  if (kind === 'acorn') {
    parts.push(box(0.34, 0.5, 0.34, 0, 0.25, 0), box(0.14, 3.0, 0.14, 0, 1.9, 0), box(1.1, 0.08, 0.08, 0, 3.36, 0));
    for (const x of [-0.5, 0.5]) parts.push(box(0.2, 0.08, 0.2, x, 3.38, 0), box(0.12, 0.1, 0.12, x, 3.92, 0)); // collar and cap
  }
  if (kind === 'wall') parts.push(box(0.12, 0.3, 0.2, 0, 2.62, 0.05), box(0.38, 0.12, 0.3, 0, 2.62, 0.2));
  if (kind === 'arm') parts.push(box(0.08, 0.08, 2.2, 0, 0, 1.15), box(0.36, 0.16, 0.74, 0, 0, 2.32));
  const g = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  for (const p of parts) p.dispose();
  return g;
}

// the lamps' light: soft additive shapes coloured per lamp (instance colour = the lamp's colour x how lit it is)
function lightMaterial(shape: 'pool' | 'cone' | 'halo'): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    defines: { [`SHAPE_${shape.toUpperCase()}`]: '' },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        vUv = uv;
        vCol = instanceColor;
        #ifdef SHAPE_HALO
          // a glow that always faces the camera
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          mv.xy += position.xy * length(instanceMatrix[0].xyz);
          gl_Position = projectionMatrix * mv;
        #else
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uHaze;
      varying vec2 vUv;
      varying vec3 vCol;
      void main() {
        #ifdef SHAPE_POOL
          // an oval pool with a hotter middle
          float d = length(vUv - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 1.2) * 0.75 + pow(max(0.0, 1.0 - d * 1.8), 2.0) * 0.5;
        #elif defined(SHAPE_CONE)
          float a = pow(vUv.y, 1.8) * 0.2 * uHaze;
        #else
          float d = length(vUv - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 2.4) * 0.9;
        #endif
        gl_FragColor = vec4(vCol * a, 1.0);
        #include <colorspace_fragment>
      }
    `,
    uniforms: { uHaze: { value: 1 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const poolMat = lightMaterial('pool');
const coneMat = lightMaterial('cone');
const haloMat = lightMaterial('halo');
const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const coneGeo = new THREE.ConeGeometry(1, 1, 16, 1, true).translate(0, -0.5, 0); // tip at the origin, 1 down
const haloGeo = new THREE.PlaneGeometry(1, 1);
const bulbGeo = new THREE.SphereGeometry(0.5, 10, 6);
const frames = new Map<LampKind, THREE.BufferGeometry>();

// where a lamp stands: x along the street, y its foot (for an arm, where it bolts to the pole), z across; slope is
// the ground's rise per tile under its pool
export interface LampSpot {
  kind: LampKind;
  x: number;
  y: number;
  z: number;
  ground?: number; // the ground's height under the pool, when it isn't the lamp's foot
  slope?: number;
  led?: boolean;
}

interface Lamp extends LampSpot {
  color: THREE.Color;
  th: number; // the night value its photocell switches on at
  on: boolean;
  k: number; // how lit, 0..1
  warm: number; // seconds since it switched on
  bulbs: number; // its first bulb's instance
  cone?: number; // its cone's instance
}

export class StreetLights {
  readonly group = new THREE.Group();
  private lamps: Lamp[] = [];
  private night = 0;
  private dim = 0; // daylight washes the light out
  private bulbs: THREE.InstancedMesh | null = null;
  private pools: THREE.InstancedMesh | null = null;
  private cones: THREE.InstancedMesh | null = null;
  private halos: THREE.InstancedMesh | null = null;
  private readonly frameMat = toon({ color: 0x2c2a34 });
  private readonly bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  private readonly c = new THREE.Color();
  private readonly col = new THREE.Color();
  private readonly ember = new THREE.Color(0xff5020);
  private readonly glass = new THREE.Color(0x4a4852);
  private dirty = true;

  build(spots: LampSpot[], rng: () => number): void {
    for (const o of [...this.group.children]) {
      this.group.remove(o);
      if (o instanceof THREE.Mesh && o.userData.own) o.geometry.dispose();
    }
    this.bulbs = this.pools = this.cones = this.halos = null;
    const [lo, hi] = STREET_LIGHTS.on;
    let b = 0;
    this.lamps = spots.map((s) => {
      const l: Lamp = { ...s, color: new THREE.Color(s.led ? LED : LAMPS[s.kind].color), th: lo + rng() * (hi - lo), on: false, k: 0, warm: 99, bulbs: b };
      b += LAMPS[s.kind].bulbs.length;
      return l;
    });
    if (!this.lamps.length) return;

    //the lamps' frames, merged into one mesh (and its outline)
    const m = new THREE.Matrix4();
    const geos = this.lamps.map((l) => {
      let f = frames.get(l.kind);
      if (!f) frames.set(l.kind, (f = frame(l.kind)));
      return f.clone().applyMatrix4(m.makeTranslation(l.x, l.y, l.z));
    });
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    const frameMesh = new THREE.Mesh(merged, this.frameMat);
    frameMesh.userData.own = true;
    inkify(frameMesh, { toon: false });
    this.group.add(frameMesh);

    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number) => {
      const im = new THREE.InstancedMesh(geo, mat, n);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      this.group.add(im);
      return im;
    };
    this.bulbs = inst(bulbGeo, this.bulbMat, b);
    this.halos = inst(haloGeo, haloMat, b);
    this.pools = inst(poolGeo, poolMat, this.lamps.length);
    const coned = this.lamps.filter((l) => LAMPS[l.kind].cone[0] > 0);
    this.cones = inst(coneGeo, coneMat, Math.max(1, coned.length));
    for (const im of [this.halos, this.pools, this.cones]) im.renderOrder = 3;

    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const sc = new THREE.Vector3();
    let ci = 0;
    for (const l of this.lamps) {
      const s = LAMPS[l.kind];
      s.bulbs.forEach(([bx, by, bz], i) => {
        p.set(l.x + bx, l.y + by, l.z + bz);
        this.bulbs!.setMatrixAt(l.bulbs + i, m.compose(p, q.identity(), sc.set(...s.bulb)));
        this.halos!.setMatrixAt(l.bulbs + i, m.compose(p, q, sc.setScalar(s.halo)));
      });
      //the pool on the ground, tipped to the slope it lies on
      const g = l.ground ?? l.y;
      const slope = l.slope ?? 0;
      e.set(0, 0, Math.atan(slope));
      p.set(l.x, g + 0.04 + Math.abs(slope) * 0.3, l.z + s.pool[2]);
      this.pools.setMatrixAt(this.lamps.indexOf(l), m.compose(p, q.setFromEuler(e), sc.set(s.pool[0], 1, s.pool[1])));
      if (s.cone[0] > 0) {
        const [bx, by, bz] = s.bulbs[0];
        const tip = p.set(l.x + bx, l.y + by - 0.05, l.z + bz).clone();
        const drop = Math.max(1, tip.y - g);
        //the cone leans from the bulb to the pool's middle
        const lean = Math.atan2(l.z + s.pool[2] - tip.z, drop);
        e.set(lean, 0, 0);
        this.cones.setMatrixAt(ci++, m.compose(tip, q.setFromEuler(e), sc.set(s.cone[0], drop, s.cone[0] * 0.8)));
        l.cone = ci - 1;
      }
    }
    for (const im of [this.bulbs, this.halos, this.pools, this.cones]) im.instanceMatrix.needsUpdate = true;
    this.cones.count = coned.length;
    this.switchAll();
    this.dirty = true;
    this.paint();
  }

  // night 0..1 (the mood's neon value) and rain 0..1.6
  setNight(night: number, rain = 0): void {
    this.night = night;
    this.dim = THREE.MathUtils.smoothstep(night, 0.04, 0.5);
    coneMat.uniforms.uHaze.value = 1 + Math.min(1, rain) * STREET_LIGHTS.rainHaze;
    coneMat.visible = FX.tier === 'high' || rain > 0; // low tier: cones only where the rain shows them
    this.switchAll();
    this.dirty = true;
    this.paint();
  }

  // lamps past their photocell's value are on; the rest wait (or flick on as the skater comes, update())
  private switchAll(): void {
    for (const l of this.lamps) {
      const on = this.night >= l.th;
      if (on && !l.on) {
        l.on = true;
        l.warm = 99; // already lit when the floor comes on screen
        l.k = 1;
      } else if (!on && l.on && this.night < l.th - STREET_LIGHTS.approach) {
        l.on = false;
        l.k = 0;
      }
    }
  }

  // skater x in tiles
  update(dt: number, skaterX: number): void {
    const S = STREET_LIGHTS;
    for (const l of this.lamps) {
      //on the edge of dark: the lamps just ahead switch on, one after another
      if (!l.on && this.night > 0.06 && l.th - this.night < S.approach && l.x - skaterX < S.reach && l.x > skaterX - 4) {
        l.on = true;
        l.warm = 0;
      }
      if (!l.on || l.warm > S.warm) continue;
      l.warm += dt;
      const t = Math.min(1, l.warm / S.warm);
      //a stutter as the tube strikes, then it warms up (a smooth fade with reduce flashing)
      const strike = !FX.reduceFlashing && l.warm < 0.28 ? (Math.sin(l.warm * 70 + l.x) > 0.2 ? 0.7 : 0.08) : 0;
      l.k = Math.max(strike, t * t * (3 - 2 * t));
      this.dirty = true;
    }
    this.paint();
  }

  private paint(): void {
    if (!this.dirty || !this.bulbs) return;
    this.dirty = false;
    const S = STREET_LIGHTS;
    for (const l of this.lamps) {
      const k = l.k * this.dim;
      //sodium heads come up from a dim orange
      const warmth = l.kind === 'cobra' || l.kind === 'arm' ? Math.min(1, l.warm / S.warm) : 1;
      const col = this.col.copy(l.color);
      if (warmth < 1 && !l.led) col.lerp(this.ember, 1 - warmth);
      const n = LAMPS[l.kind].bulbs.length;
      for (let i = 0; i < n; i++) {
        this.halos!.setColorAt(l.bulbs + i, this.c.copy(col).multiplyScalar(k));
        this.bulbs.setColorAt(l.bulbs + i, this.c.copy(this.glass).lerp(col, Math.min(1, k * 1.2)).multiplyScalar(1 + k * 0.4));
      }
      this.pools!.setColorAt(this.lamps.indexOf(l), this.c.copy(col).multiplyScalar(k));
      if (l.cone !== undefined) this.cones!.setColorAt(l.cone, this.c.copy(col).multiplyScalar(k));
    }
    for (const im of [this.bulbs, this.halos!, this.pools!, this.cones!]) im.instanceColor!.needsUpdate = true;
  }

  // how much lamplight falls on a point (tiles; the skate lane's z), 0..~1.5, and its colour in `out`
  lightAt(x: number, y: number, out: THREE.Color): number {
    let sum = 0;
    out.setRGB(0, 0, 0);
    for (const l of this.lamps) {
      if (l.k <= 0) continue;
      const s = LAMPS[l.kind];
      const half = s.pool[0] * 0.5;
      const dx = Math.abs(x - l.x);
      if (dx > half) continue;
      const top = l.y + s.bulbs[0][1];
      const ground = l.ground ?? l.y;
      if (y > top + 0.3 || y < ground - 2) continue;
      const f = (1 - (dx / half) ** 2) * l.k * this.dim * s.reach;
      sum += f;
      out.r += l.color.r * f;
      out.g += l.color.g * f;
      out.b += l.color.b * f;
    }
    if (sum > 0) out.multiplyScalar(1 / sum);
    return sum;
  }
}

