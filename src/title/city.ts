// The title scene's city (src/title/title-scene.ts): a dusk sky dome with the sun going down, skyscrapers standing in
// rows back from the street, their windows lit (a few flickering), clouds drifting past the tops of the towers, and
// down at the bottom the street Webster stands on: asphalt, a sidewalk, a brick corner store with a buzzing neon sign
// and street lamps, one of them on the blink. All built in code: one draw for every tower, one for every window glow.
//
// Units are the game's tiles (the skater is about 2.5 tall). The street runs along x, the towers stand back along -z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng, type Rng } from '../gen/rng';
import { inkify, toon } from '../render/toon';
import { model } from '../render/models';

export const DUSK = {
  top: 0x1c0f3a, // the sky overhead
  mid: 0x7a2f6a, // halfway down
  low: 0xff8a52, // at the horizon, behind the sun
  sun: 0xffd27a,
  fog: 0x8a4a78, // the haze the far towers fade into
  fogNear: 120,
  fogFar: 1100,
};

const STOREY = 3.6; // a floor's height, tiles
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// the sky: a dome shaded by height (world up, so it stays right as the camera tips down), the sun low over -z with a
// soft glow round it
export function skyDome(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(DUSK.top) },
      uMid: { value: new THREE.Color(DUSK.mid) },
      uLow: { value: new THREE.Color(DUSK.low) },
      uSun: { value: new THREE.Color(DUSK.sun) },
      uSunDir: { value: new THREE.Vector3(0.25, 0.06, -1).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uLow, uSun, uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.12 ? mix(uMid, uTop, smoothstep(0.12, 0.7, h)) : mix(uLow, uMid, smoothstep(-0.05, 0.12, h));
        float s = max(0.0, dot(d, normalize(uSunDir)));
        col += uSun * (pow(s, 600.0) * 2.0 + pow(s, 24.0) * 0.45 + pow(s, 4.0) * 0.12);
        col = mix(col, uLow * 0.6, smoothstep(0.0, -0.3, h)); // under the horizon: the haze over the far city
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  return mesh;
}

// a sheet of windows: dark glass in a frame, some lit warm or cold, as the colour map; the lit ones again in the
// emissive map so they glow through the dusk
function windowSheet(rng: Rng): { map: THREE.Texture; glow: THREE.Texture } {
  const cols = 16;
  const rows = 32;
  const cell = 16;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = cols * cell;
    c.height = rows * cell;
    return c;
  };
  const a = make();
  const b = make();
  const ca = a.getContext('2d')!;
  const cb = b.getContext('2d')!;
  ca.fillStyle = '#5a5470';
  ca.fillRect(0, 0, a.width, a.height);
  cb.fillStyle = '#000';
  cb.fillRect(0, 0, b.width, b.height);
  const lit = ['#ffd890', '#ffe7b0', '#ffc070', '#bfe8ff', '#ff9ad8'];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cell + 3;
      const py = y * cell + 3;
      const on = rng() < 0.3;
      ca.fillStyle = on ? lit[Math.floor(rng() * lit.length)] : rng() < 0.5 ? '#232036' : '#2e2a44';
      ca.fillRect(px, py, cell - 6, cell - 5);
      if (on) {
        cb.fillStyle = ca.fillStyle;
        cb.fillRect(px, py, cell - 6, cell - 5);
      }
    }
  }
  const tex = (c: HTMLCanvasElement) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.anisotropy = 4;
    return t;
  };
  return { map: tex(a), glow: tex(b) };
}

// a tower as a box whose UVs count windows (4 tiles a window across, a storey up), so one sheet tiles every tower
function towerBox(w: number, h: number, d: number, x: number, z: number, off: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) + w / 2;
    const pz = pos.getZ(i) + d / 2;
    const py = pos.getY(i) + h / 2;
    const across = Math.abs(nor.getX(i)) > 0.5 ? pz : px;
    //the roof and underside read the corner of the sheet that's plain wall
    if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, 0.01, 0.01);
    else uv.setXY(i, off + across / 4 / 16, off * 3 + py / STOREY / 32);
  }
  g.translate(x, h / 2, z);
  return g;
}

export interface City {
  group: THREE.Group;
  update(t: number, dt: number): void;
}

// The towers: rows standing back from the street, getting taller toward the middle, and a far wall of them out to
// the haze. The street's own block is a four-storey brick corner store, built separately (street()).
export function buildCity(seed = 7): City {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const sheet = windowSheet(rng);
  const geos: THREE.BufferGeometry[] = [];
  const tops: { x: number; y: number; z: number; w: number; d: number }[] = [];
  const add = (x: number, z: number, w: number, d: number, h: number) => {
    geos.push(towerBox(w, h, d, x, z, Math.floor(rng() * 16) / 16));
    tops.push({ x, y: h, z, w, d });
    //a setback crown on the tall ones: a narrower box on top, and a spire on the tallest
    if (h > 120 && rng() < 0.7) {
      const ch = 10 + rng() * 20;
      geos.push(towerBox(w * 0.65, ch, d * 0.65, x, z, 0.5).translate(0, h, 0));
      tops.push({ x, y: h + ch, z, w: w * 0.65, d: d * 0.65 });
    }
  };
  //the near rows either side of the street canyon, then the rows behind the store, then the far wall
  for (const side of [-1, 1]) {
    for (let z = 4; z > -260; z -= 26 + rng() * 8) {
      const x = side * (26 + rng() * 6);
      const h = lerp(70, 210, rng()) * (z < -60 ? 1.15 : 0.9);
      add(x, z, 18 + rng() * 6, 20 + rng() * 4, h);
    }
  }
  for (let i = 0; i < 6; i++) add(-30 + i * 12 + rng() * 4, -70 - rng() * 30, 12 + rng() * 6, 14, 80 + rng() * 170);
  for (let i = 0; i < 26; i++) {
    const x = -380 + i * 30 + rng() * 10;
    add(x, -320 - rng() * 220, 22 + rng() * 14, 22 + rng() * 10, 90 + rng() * 260);
  }
  const towers = new THREE.Mesh(
    mergeGeometries(geos)!,
    toon({ color: 0xffffff, map: sheet.map, emissive: 0xffffff, emissiveMap: sheet.glow, emissiveIntensity: 0.85 }),
  );
  group.add(towers);

  //antennas and red aircraft lights on some roofs: the lights blink slowly, out of step
  const beacons: THREE.Mesh[] = [];
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3030, fog: false });
  const mast = new THREE.MeshLambertMaterial({ color: 0x3a3448 });
  for (const t of tops) {
    if (t.y < 140 || rng() < 0.4) continue;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 14, 5), mast);
    m.position.set(t.x, t.y + 7, t.z);
    group.add(m);
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 4), beaconMat);
    b.position.set(t.x, t.y + 14.5, t.z);
    b.userData.phase = rng() * 3;
    group.add(b);
    beacons.push(b);
  }

  //windows that flicker: a lit window's glow, put back on the face of a near tower, going out and coming back on
  const flick = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4, 2.2), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), 48);
  const flickers: { k: number; rate: number; color: THREE.Color }[] = [];
  const m4 = new THREE.Matrix4();
  const near = tops.filter((t) => t.z > -120 && Math.abs(t.x) < 60);
  for (let i = 0; i < flick.count; i++) {
    const t = near[Math.floor(rng() * near.length)];
    const x = t.x + (rng() - 0.5) * (t.w - 4);
    const y = 6 + Math.floor(rng() * (t.y / STOREY - 3)) * STOREY + 1.6;
    m4.makeTranslation(x, y, t.z + t.d / 2 + 0.08);
    flick.setMatrixAt(i, m4);
    const color = new THREE.Color([0xffd890, 0xbfe8ff, 0xff9ad8, 0xffc070][i % 4]);
    flickers.push({ k: rng() * 10, rate: 0.6 + rng() * 2.5, color });
    flick.setColorAt(i, color);
  }
  group.add(flick);

  //clouds drifting past the tops of the towers: soft puffs on camera-facing cards, a pink underside from the sun
  const cloudTex = cloudTexture(rng);
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color().setHSL(0.92 + rng() * 0.06, 0.45, 0.82 + rng() * 0.1), transparent: true, opacity: 0.7, depthWrite: false, fog: true });
    const s = new THREE.Sprite(mat);
    const w = 70 + rng() * 120;
    s.scale.set(w, w * 0.42, 1);
    s.position.set(-300 + rng() * 600, 130 + rng() * 120, -280 + rng() * 330);
    s.userData.speed = 2 + rng() * 5;
    clouds.push(s);
    group.add(s);
  }

  return {
    group,
    update(t: number, dt: number): void {
      for (const b of beacons) b.visible = (t + b.userData.phase) % 2.4 < 1.2;
      const c = new THREE.Color();
      flickers.forEach((f, i) => {
        f.k += dt * f.rate;
        //mostly on, now and then a stutter: off, on, off
        const p = f.k % 6;
        const on = p > 0.5 || (p > 0.12 && p < 0.22) || (p > 0.32 && p < 0.38);
        flick.setColorAt(i, on ? f.color : c.setHex(0x1a1828));
      });
      if (flick.instanceColor) flick.instanceColor.needsUpdate = true;
      for (const s of clouds) {
        s.position.x += s.userData.speed * dt;
        if (s.position.x > 340) s.position.x = -340;
      }
    },
  };
}

function cloudTexture(rng: Rng): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 112;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    const x = 40 + rng() * 176;
    const y = 50 + rng() * 26;
    const r = 18 + rng() * 26;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  //the underside tinted toward the sunset
  g.globalCompositeOperation = 'source-atop';
  const under = g.createLinearGradient(0, 40, 0, 112);
  under.addColorStop(0, 'rgba(255,200,220,0)');
  under.addColorStop(1, 'rgba(255,120,150,0.7)');
  g.fillStyle = under;
  g.fillRect(0, 0, 256, 112);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a brick texture for the corner store: every brick its own tone, grime down at the bottom
function brickTexture(rng: Rng): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#3a2a2a';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    const shift = (y / 16) % 2 ? 16 : 0;
    for (let x = -32; x < 256; x += 32) {
      const l = 30 + rng() * 14;
      g.fillStyle = `hsl(${8 + rng() * 10}, ${38 + rng() * 15}%, ${l}%)`;
      g.fillRect(x + shift + 1, y + 1, 30, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

// a neon sign's word on a canvas, glowing
function neonTexture(word: string, color: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.font = 'bold 88px "Bangers", "Arial Black", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(word, 256, 68);
  g.shadowBlur = 0;
  g.fillStyle = '#fff';
  g.globalAlpha = 0.65;
  g.fillText(word, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Street {
  group: THREE.Group;
  update(t: number, dt: number): void;
}

// the street at the bottom: the road in front, the sidewalk Webster stands on, the corner store behind him with its
// neon sign, lamps along the curb (one on the blink), a hydrant, a trash can, a news box
export function buildStreet(seed = 3): Street {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const asphalt = toon({ color: 0x2a2734 });
  const walk = toon({ color: 0x6a6478 });
  const curb = toon({ color: 0x8a8498 });
  const road = new THREE.Mesh(new THREE.BoxGeometry(400, 0.2, 40), asphalt);
  road.position.set(0, -0.35, 22);
  const side = new THREE.Mesh(new THREE.BoxGeometry(400, 0.3, 7), walk);
  side.position.set(0, -0.15, -0.5);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(400, 0.34, 0.4), curb);
  lip.position.set(0, -0.12, 3);
  //the dashes down the middle of the road
  const dashes: THREE.BufferGeometry[] = [];
  for (let x = -200; x < 200; x += 6) dashes.push(new THREE.PlaneGeometry(3, 0.25).rotateX(-Math.PI / 2).translate(x, -0.24, 12));
  const lines = new THREE.Mesh(mergeGeometries(dashes)!, new THREE.MeshBasicMaterial({ color: 0xd8b84a }));
  //the far sidewalk, across the road, with the people on it
  const far = new THREE.Mesh(new THREE.BoxGeometry(400, 0.3, 6), walk);
  far.position.set(0, -0.15, 30);
  group.add(road, side, lip, lines);

  //the corner store: brick, four storeys, a shop window and door at the bottom, an awning
  const brick = brickTexture(rng);
  brick.repeat.set(6, 3);
  const store = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(40, 11, 10), toon({ color: 0xffffff, map: brick }));
  wall.position.set(0, 5.5, -9);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  glass.position.set(-6, 2.3, -3.98);
  const glass2 = glass.clone();
  glass2.position.x = 8;
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2, 3.6), toon({ color: 0x1a1824 }));
  door.position.set(2, 1.8, -3.97);
  const awning = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 2.4), toon({ color: 0x2a8a6a }));
  awning.position.set(1, 4.6, -2.9);
  awning.rotation.x = 0.25;
  //upstairs windows: dark, a couple lit
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < 6; i++) {
      const lit = rng() < 0.3;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2), new THREE.MeshBasicMaterial({ color: lit ? 0xffc878 : 0x24203a }));
      w.position.set(-15 + i * 6, 7.2 + f * 2.6, -3.97);
      store.add(w);
    }
  }
  store.add(wall, glass, glass2, door, awning);
  inkify(wall);
  inkify(awning);
  group.add(store);

  //the neon over the window: buzzing, now and then dropping out
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: neonTexture('LIQUOR', '#ff3fb4'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  neon.position.set(-6, 5.6, -3.9);
  const neon2 = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.75), new THREE.MeshBasicMaterial({ map: neonTexture('OPEN 24', '#3ff0ff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  neon2.position.set(8, 5.5, -3.9);
  group.add(neon, neon2);

  //street lamps along the curb: a pole, an arm, a glowing head and a soft pool of light on the sidewalk
  const pole = toon({ color: 0x2a2836 });
  const lamps: { head: THREE.Mesh; pool: THREE.Mesh; glow: THREE.Sprite; broken: boolean; k: number }[] = [];
  const glowTex = glowTexture();
  for (const [x, broken] of [[-9.5, false], [5.5, true], [24, false], [-28, false]] as const) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 6), pole);
    p.position.set(x, 3.6, 2.5);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.6), pole);
    arm.position.set(x, 7.3, 1.8);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.25, 0.9), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
    head.position.set(x, 7.15, 1.2);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd890, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(5, 5, 1);
    glow.position.copy(head.position);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xffc070, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.position.set(x, 0.02, 1.2);
    inkify(p);
    group.add(p, arm, head, glow, pool);
    lamps.push({ head, pool, glow, broken, k: rng() * 5 });
  }

  //street furniture from the game's props
  for (const [name, x, z, ry] of [['Hydrant', -3.4, 2, 0.4], ['TrashCan', 3.6, -2.4, 0], ['NewsBoxRed', 10.5, -2.4, 0], ['NewsBoxBlue', 11.6, -2.4, 0], ['Meter', -11, 2.2, 0]] as const) {
    const m = model(name);
    if (!m) continue;
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    m.scale.setScalar(1.25);
    inkify(m);
    group.add(m);
  }
  group.add(far);

  let buzz = 0;
  return {
    group,
    update(t: number, dt: number): void {
      //the sign buzzes (a shimmer) and drops out for a blink every few seconds
      buzz += dt;
      const p = buzz % 4.3;
      const out = (p > 3.6 && p < 3.7) || (p > 3.82 && p < 3.9);
      (neon.material as THREE.MeshBasicMaterial).opacity = out ? 0.08 : 0.9 + Math.sin(t * 90) * 0.1;
      (neon2.material as THREE.MeshBasicMaterial).opacity = 0.85 + Math.sin(t * 70 + 1) * 0.1;
      for (const l of lamps) {
        let on = 1;
        if (l.broken) {
          l.k += dt;
          const q = l.k % 3.1;
          on = q < 1.4 ? 1 : q < 1.5 ? 0 : q < 1.58 ? 1 : q < 1.9 ? 0 : q < 1.96 ? 0.6 : q < 2.2 ? 0 : 1;
        }
        (l.head.material as THREE.MeshBasicMaterial).color.setHex(on ? 0xfff0c0 : 0x3a3830);
        l.glow.visible = on > 0;
        l.glow.material.opacity = on;
        (l.pool.material as THREE.MeshBasicMaterial).opacity = 0.45 * on;
      }
    },
  };
}

let glowTex: THREE.Texture | null = null;
// a soft round glow, for lamps, drone eyes and the like
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
