// The night city (fx7): windows that light up, street lamps, headlight beams, and the AI's billboards and Flock
// cameras that turn to watch the skater. Every light here is fake (additive meshes sharing a few materials), so
// night costs a handful of draw calls and no real lights. How lit it all is follows the mood's neon value.
import * as THREE from 'three';
import type { Level } from '../physics/level';
import { STREET_Z } from '../traffic/traffic';
import { TURN_OFF } from '../traffic/tunnel';
import { toX, toY } from './kit';
import { cityTiles } from './textures';
import { inkify, toon } from './toon';
import { FX } from './fx-settings';

export const NIGHT = {
  windowsLit: 0.42, // share of window cells lit
  windowGlow: 1.3, // emissive strength at full night
  lampEvery: 8, // tiles between street lamps
  roofLampEvery: 7,
  camEvery: 3, // a Flock camera on every third lamp
  billboards: 3, // per floor
  watch: 10, // tiles: billboards and cameras turn to the skater inside this
};

// window pixels in each QFS facade tile
const WINDOW_COLORS: Record<number, number[][]> = {
  108: [[0, 0, 0]],
  111: [[0, 0, 0]],
  109: [[125, 125, 125], [102, 102, 102]],
  123: [[41, 41, 41], [34, 34, 34]],
  110: [[71, 136, 178], [28, 70, 97]],
  124: [[71, 136, 178], [28, 70, 97]],
};
const LIGHTS = [
  [255, 206, 130],
  [255, 190, 110],
  [255, 224, 170],
  [170, 210, 255],
  [120, 170, 255], // a TV
];

export const SLOGANS = ['SKATING IS A CRIME', 'STAY IN YOUR LANE', 'REPORT ALL SKATERS', 'COMPLIANCE IS FREEDOM', "WALK. DON'T ROLL.", 'THE AI LOVES YOU'];

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// a 4 x 4 tile mask of lit windows for a facade tile, repeated over a building front
const masks = new Map<string, THREE.Texture>();
function windowMask(t: number, variant: number): THREE.Texture | null {
  const key = `${t}:${variant}`;
  const hit = masks.get(key);
  if (hit) return hit;
  const sheet = cityTiles();
  const colors = WINDOW_COLORS[t];
  if (!sheet || !colors) return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  for (let i = 0; i < 16; i++) g.drawImage(sheet, (t % 15) * 32, Math.floor(t / 15) * 32, 32, 32, (i % 4) * 32, Math.floor(i / 4) * 32, 32, 32);
  const img = g.getImageData(0, 0, 128, 128);
  const r = rng(t * 131 + variant * 977 + 7);
  const cells = Array.from({ length: 16 }, () => (r() < NIGHT.windowsLit ? LIGHTS[Math.floor(r() * LIGHTS.length)] : null));
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const o = (y * 128 + x) * 4;
      const lit = cells[Math.floor(y / 32) * 4 + Math.floor(x / 32)];
      const win = colors.some(([cr, cg, cb]) => img.data[o] === cr && img.data[o + 1] === cg && img.data[o + 2] === cb);
      const [lr, lg, lb] = lit && win ? lit : [0, 0, 0];
      img.data[o] = lr;
      img.data[o + 1] = lg;
      img.data[o + 2] = lb;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  masks.set(key, tex);
  return tex;
}

// a soft additive beam: brightest at its source (the cone's tip), fading down
export function beamMaterial(color: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        #ifdef USE_INSTANCING
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uAmt;
      uniform float uPool; // 1: a round pool on the ground, 0: a cone
      varying vec2 vUv;
      void main() {
        float a = uPool > 0.5 ? pow(max(0.0, 1.0 - length(vUv - 0.5) * 2.0), 1.6) * 0.55 : pow(vUv.y, 1.8) * 0.3;
        gl_FragColor = vec4(uColor * a * uAmt, 1.0);
        #include <colorspace_fragment>
      }
    `,
    uniforms: { uColor: { value: new THREE.Color(color) }, uAmt: { value: 0 }, uPool: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

const lampCone = beamMaterial(0xffc87a);
const lampPool = beamMaterial(0xffc87a);
lampPool.uniforms.uPool.value = 1;
const headCone = beamMaterial(0xfff2c8);
const headPool = beamMaterial(0xfff2c8);
headPool.uniforms.uPool.value = 1;
const tailGlow = beamMaterial(0xff2a3a);
tailGlow.uniforms.uPool.value = 1;
const BEAMS = [lampCone, lampPool, headCone, headPool, tailGlow];
const tailGeo = new THREE.PlaneGeometry(1.8, 0.34);

const coneGeo = new THREE.ConeGeometry(1.1, 2.6, 16, 1, true).translate(0, -1.3, 0); // tip at the origin
const poolGeo = new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2);
const headConeGeo = new THREE.ConeGeometry(1.1, 5, 12, 1, true).translate(0, -2.5, 0).rotateZ(Math.PI / 2); // along +x
const headPoolGeo = new THREE.PlaneGeometry(5, 2.2).rotateX(-Math.PI / 2).translate(3, 0, 0);

// headlight beams for a car whose front is +x, wheels on y = 0
export function headlights(len: number): THREE.Group {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(headConeGeo, headCone);
  cone.position.set(len / 2, 0.45, 0.3);
  cone.scale.set(1, 0.35, 0.6);
  const pool = new THREE.Mesh(headPoolGeo, headPool);
  pool.position.set(len / 2, 0.02, 0.3);
  //tail lights smear red behind the car
  const tail = new THREE.Mesh(tailGeo, tailGlow);
  tail.position.set(-len / 2 - 0.5, 0.55, 0.35);
  g.add(cone, pool, tail);
  return g;
}

// shop signs in neon: one atlas of words, every sign on a floor merged into one mesh
const NEON_WORDS: [string, string][] = [
  ['BAR', '#ff4fa8'],
  ['PIZZA', '#ffb340'],
  ['OPEN', '#4ad8ff'],
  ['LIQUOR', '#7dff8a'],
  ['TATTOO', '#c07cff'],
  ['24H', '#ff5050'],
  ['NOODLES', '#ffe14a'],
  ['ARCADE', '#4affd8'],
];
let neonAtlas: THREE.Texture | null = null;
function neonTexture(): THREE.Texture {
  if (neonAtlas) return neonAtlas;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 512, 512);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 40px Arial Black, Arial, sans-serif';
  NEON_WORDS.forEach(([word, color], i) => {
    const y = i * 64 + 32;
    g.shadowColor = color;
    g.shadowBlur = 14;
    g.strokeStyle = color;
    g.lineWidth = 5;
    g.strokeText(word, 256, y);
    g.shadowBlur = 0;
    g.fillStyle = '#fff';
    g.fillText(word, 256, y);
  });
  neonAtlas = new THREE.CanvasTexture(c);
  neonAtlas.colorSpace = THREE.SRGBColorSpace;
  return neonAtlas;
}

function billboardTexture(text: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#1a1036');
  grad.addColorStop(1, '#3a0f4a');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 128);
  //the AI's eye
  g.fillStyle = '#ff2a4a';
  g.beginPath();
  g.arc(36, 64, 18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(36, 64, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8f4ff';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const words = text.split(' ');
  const half = Math.ceil(words.length / 2);
  g.font = 'italic 900 26px "Arial Black", "Helvetica Neue", sans-serif';
  g.fillText(words.slice(0, half).join(' '), 64, 46, 184);
  g.fillText(words.slice(half).join(' '), 64, 82, 184);
  //scanlines
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 0; y < 128; y += 4) g.fillRect(0, y, 256, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Watcher {
  obj: THREE.Object3D; // turns to face the skater
  x: number;
  base: number; // resting yaw
  screen?: THREE.MeshBasicMaterial;
}

export class NightCity {
  readonly group = new THREE.Group();
  private windowMats: THREE.MeshToonMaterial[] = [];
  private watchers: Watcher[] = [];
  private amount = 0;
  private t = 0;
  private readonly poleMat = toon({ color: 0x2c2a34 });
  private readonly headMat = toon({ color: 0x3a3844, emissive: 0x000000 });
  private readonly camMat = toon({ color: 0xd8dbe2 });
  private readonly eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2030 });
  private readonly neonMat = new THREE.MeshBasicMaterial({ map: neonTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  private neon: THREE.Mesh | null = null;
  private neonFlicker: { sign: number; t: number }[] = [];

  // lamps, cameras and billboards for a floor, and the window masks on its kit
  build(level: Level, kit: THREE.Object3D, seed: number, floor: number): void {
    for (const c of [...this.group.children]) this.group.remove(c);
    this.watchers = [];
    const r = rng(seed * 4241 + floor * 613);

    //windows
    this.windowMats = [];
    kit.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      for (const m of [o.material].flat()) {
        const f = m.userData?.facade as { w: number; h: number; t: number } | undefined;
        if (!f || !(m instanceof THREE.MeshToonMaterial)) continue;
        const mask = windowMask(f.t, Math.floor(r() * 3));
        if (!mask) continue;
        const tex = mask.clone();
        tex.repeat.set(f.w / 4, f.h / 4);
        tex.offset.set(Math.floor(r() * 4) / 4, Math.floor(r() * 4) / 4);
        tex.needsUpdate = true;
        m.emissiveMap = tex;
        m.emissive.setRGB(1, 1, 1);
        m.emissiveIntensity = this.amount * NIGHT.windowGlow;
        m.needsUpdate = true;
        this.windowMats.push(m);
      }
    });

    //lamp spots: along the back of the sidewalk, and the back of wide roofs
    const lamps: { x: number; y: number; z: number }[] = [];
    let c = Math.round(toX(level.finaleX));
    for (let x = c + 3; x < level.street.length - TURN_OFF.back - TURN_OFF.half - 0.5; x += NIGHT.lampEvery) if (level.street[Math.floor(x)]) lamps.push({ x, y: 0, z: STREET_Z.lamp });
    for (const s of level.surfaces) {
      if (s.kind !== 'roof') continue;
      const y = toY(level, s.y);
      if (y < 0.5) continue;
      for (let x = toX(s.x0) + 2; x < toX(s.x1) - 1.5; x += NIGHT.roofLampEvery) lamps.push({ x, y, z: -2.6 });
    }
    const n = lamps.length;
    if (n) {
      const pole = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 3, 0.12).translate(0, 1.5, 0), this.poleMat, n);
      const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.12, 0.9).translate(0, 3, 0.35), this.headMat, n);
      const cone = new THREE.InstancedMesh(coneGeo, lampCone, n);
      const pool = new THREE.InstancedMesh(poolGeo, lampPool, n);
      const m = new THREE.Matrix4();
      lamps.forEach((l, i) => {
        m.makeTranslation(l.x, l.y, l.z);
        pole.setMatrixAt(i, m);
        head.setMatrixAt(i, m);
        m.makeTranslation(l.x, l.y + 2.94, l.z + 0.7);
        cone.setMatrixAt(i, m);
        m.makeTranslation(l.x, l.y + 0.03, l.z + 1.6);
        pool.setMatrixAt(i, m);
      });
      for (const im of [cone, pool]) {
        im.frustumCulled = false;
        im.renderOrder = 3;
      }
      inkify(pole, { toon: false });
      inkify(head, { toon: false });
      this.group.add(pole, head, cone, pool);
      //Flock cameras on some poles: a white box with a red eye, turning to follow the skater
      lamps.forEach((l, i) => {
        if (i % NIGHT.camEvery !== 1) return;
        const cam = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.2), this.camMat);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), this.eyeMat);
        eye.position.set(0.18, -0.02, 0);
        cam.add(body, eye);
        cam.position.set(l.x, l.y + 2.55, l.z + 0.12);
        inkify(cam);
        this.group.add(cam);
        this.watchers.push({ obj: cam, x: l.x, base: Math.PI / 2 });
      });
    }

    //the AI's billboards on posts behind the street and on roofs
    const spots = lamps.filter((_, i) => i % NIGHT.camEvery === 0).sort(() => r() - 0.5).slice(0, NIGHT.billboards);
    for (const s of spots) {
      const b = new THREE.Group();
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16).translate(0, 1.1, 0), this.poleMat);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.75, 0.16), this.poleMat);
      frame.position.y = 3;
      const screen = new THREE.MeshBasicMaterial({ map: billboardTexture(SLOGANS[Math.floor(r() * SLOGANS.length)]) });
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.55), screen);
      face.position.set(0, 3, 0.09);
      const turn = new THREE.Group();
      turn.add(frame, face);
      b.add(post, turn);
      b.position.set(s.x + 3.5, s.y, s.z - 0.3);
      inkify(b);
      this.group.add(b);
      this.watchers.push({ obj: turn, x: s.x + 3.5, base: 0, screen });
    }

    //neon shop signs on the walls between the street lamps
    this.neon = null;
    this.neonFlicker = [];
    const signs = lamps.filter((l) => l.y === 0 && r() < 0.6);
    if (signs.length) {
      const pos: number[] = [];
      const uv: number[] = [];
      const col: number[] = [];
      const idx: number[] = [];
      signs.forEach((l, k) => {
        const word = Math.floor(r() * NEON_WORDS.length);
        const w = 0.7 + NEON_WORDS[word][0].length * 0.5;
        const h = 1;
        const x = l.x + NIGHT.lampEvery / 2 + (r() - 0.5) * 2;
        const y = 3.4 + r() * 1.2; // above the wall and the street props
        const z = l.z - 0.32;
        pos.push(x - w / 2, y - h / 2, z, x + w / 2, y - h / 2, z, x + w / 2, y + h / 2, z, x - w / 2, y + h / 2, z);
        //the word's row in the atlas, trimmed to its width
        const v0 = 1 - (word + 1) / NEON_WORDS.length;
        const v1 = 1 - word / NEON_WORDS.length;
        const u = Math.min(0.5, w / 9);
        uv.push(0.5 - u, v0, 0.5 + u, v0, 0.5 + u, v1, 0.5 - u, v1);
        col.push(...Array(12).fill(1));
        idx.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setIndex(idx);
      this.neon = new THREE.Mesh(geo, this.neonMat);
      this.neon.renderOrder = 3;
      this.group.add(this.neon);
      //a sign or two with a tired tube
      for (let k = 0; k < signs.length; k += 3) this.neonFlicker.push({ sign: k, t: r() * 5 });
    }
  }

  // night 0..1 (from the mood)
  setNight(amount: number): void {
    this.amount = amount;
    for (const m of this.windowMats) m.emissiveIntensity = amount * NIGHT.windowGlow;
    //lamps and headlights come on from golden hour, not in the afternoon
    const beams = THREE.MathUtils.smoothstep(amount, 0.15, 0.6);
    for (const b of BEAMS) {
      b.uniforms.uAmt.value = beams;
      //low tier keeps the pools on the ground and drops the big additive cones
      b.visible = beams > 0.02 && (FX.tier === 'high' || (b !== lampCone && b !== headCone));
    }
    this.headMat.emissive.setRGB(amount, amount * 0.8, amount * 0.5);
    this.neonMat.color.setScalar(beams);
    this.neonMat.visible = beams > 0.02;
  }

  // skater x in world units; heat 0..100 brightens the billboards
  update(dt: number, skaterX: number, heat: number): void {
    this.t += dt;
    //a tired neon tube: now and then it dims for a moment and comes back (never with reduce flashing)
    if (this.neon && !FX.reduceFlashing) {
      const c = this.neon.geometry.getAttribute('color') as THREE.BufferAttribute;
      for (const f of this.neonFlicker) {
        f.t += dt;
        const cycle = f.t % 6;
        const k = cycle > 5.4 && cycle < 5.75 ? 0.35 : 1;
        for (let v = 0; v < 4; v++) c.setXYZ(f.sign * 4 + v, k, k, k);
      }
      c.needsUpdate = true;
    }
    for (const w of this.watchers) {
      const dx = skaterX - w.x;
      const near = Math.abs(dx) < NIGHT.watch;
      //cameras face along +x by default: yaw them toward the skater; billboards swing a little either way
      const want = w.screen ? (near ? THREE.MathUtils.clamp(dx * 0.06, -0.55, 0.55) : 0) : near ? (dx < 0 ? Math.PI * 0.85 : Math.PI * 0.15) - Math.PI / 2 : 0;
      w.obj.rotation.y += (want - w.obj.rotation.y) * Math.min(1, dt * 4);
      if (w.screen) {
        const pulse = FX.reduceFlashing ? 1 : 0.8 + 0.2 * Math.sin(this.t * 10);
        const k = 0.75 + 0.25 * this.amount + (heat / 100) * 0.5 * pulse;
        w.screen.color.setRGB(k, k, k);
      }
    }
  }
}
