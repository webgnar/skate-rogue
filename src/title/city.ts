// The title scene's sky and Webster's own spot (src/title/title-scene.ts): a dusk sky dome with the sun going down,
// the canvas textures the city uses (clouds, brick), and Webster's piece of sidewalk: the curb, a brick corner
// building with the game's storefronts along its ground floor (the liquor store's neon buzzing), street lamps (one on
// the blink) and street props. The city around it, the street
// grid and the towers, is grid.ts.
//
// Units are the game's tiles (the skater is about 2.5 tall). The street runs along x, the towers stand back along -z.
import * as THREE from 'three';
import { makeRng, type Rng } from '../gen/rng';
import { inkify, toon } from '../render/toon';
import { model } from '../render/models';
import { makeStorefront, storefrontMats, STOREFRONTS, type StorefrontKind } from '../render/storefronts';

export const DUSK = {
  top: 0x1c0f3a, // the sky overhead
  mid: 0x7a2f6a, // halfway down
  low: 0xff8a52, // at the horizon, behind the sun
  sun: 0xffd27a,
  fog: 0x8a4a78, // the haze the far towers fade into
  fogNear: 120,
  fogFar: 1100,
};


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

export function cloudTexture(rng: Rng): THREE.Texture {
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

export interface Street {
  group: THREE.Group;
  update(t: number, dt: number): void;
}

// the corner building's ground floor: the game's storefronts in a row, a bit bigger than in the game (Webster stands
// taller on the title than Lou in a run). Their faces stand out from the building's wall (z -4) by their depth.
export const STORE_ROW: StorefrontKind[] = ['pizza', 'tattoo', 'liquor'];
export const STORE = {
  scale: 1.15,
  rowX: -12.075, // the row's left end: the tattoo shop's door just behind Webster
  face: -4 + 0.95 * 1.15 + 0.02, // the shops' faces (the model's depth, scaled, in front of the wall)
  returnH: 7.3, // the brick returns at the ends of the row, up to the top of the liquor store's sign
  wallH: 12.4,
  windowY: 8.3, // the first row of upstairs windows' middle, over the shops' signs
  bandTop: [6.21, 6.33], // the tops of the pizza place's and the tattoo shop's sign bands, where the cat walks
};

// the street at the bottom: the road in front, the sidewalk Webster stands on, the corner store behind him with its
// pizza place, tattoo shop and liquor store along its ground floor, lamps along the curb (one on the blink), a
// hydrant, a trash can, a news box
export function buildStreet(seed = 3): Street {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const curb = toon({ color: 0x8a8498 });
  //the road, sidewalks and dashes are the city grid's (grid.ts); the street keeps its curb
  const lip = new THREE.Mesh(new THREE.BoxGeometry(46, 0.34, 0.4), curb);
  lip.position.set(0, -0.12, 3.05);
  group.add(lip);

  //the corner building: brick, four storeys, with the game's storefronts along its ground floor (STORE_ROW)
  const brick = brickTexture(rng);
  brick.repeat.set(6, 3.4);
  const store = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.BoxGeometry(40, STORE.wallH, 10), toon({ color: 0xffffff, map: brick }));
  wall.position.set(0, STORE.wallH / 2, -9);
  //upstairs windows: dark, a couple lit, one with a TV flickering blue and one with a tube light on the blink
  const tv: THREE.MeshBasicMaterial[] = [];
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < 6; i++) {
      const lit = rng() < 0.3;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2), new THREE.MeshBasicMaterial({ color: lit ? 0xffc878 : 0x24203a }));
      w.position.set(-15 + i * 6, STORE.windowY + f * 2.6, -3.97);
      if ((f === 0 && i === 2) || (f === 1 && i === 3)) tv.push(w.material);
      store.add(w);
    }
  }
  store.add(wall);
  inkify(wall);
  //the shops along the ground floor (render/storefronts.ts, the street's own): their shop floors only, standing out
  //from the wall by their depth, with brick returns at the ends of the row
  const mats = storefrontMats();
  let sign: THREE.MeshBasicMaterial | null = null; // the liquor store's neon, which buzzes
  const row = new THREE.Group();
  let x = STORE.rowX;
  for (const kind of STORE_ROW) {
    const w = STOREFRONTS[kind].w * STORE.scale;
    const shop = makeStorefront(kind, mats, false);
    if (shop) {
      shop.scale.setScalar(STORE.scale);
      shop.position.set(x + w / 2, 0, STORE.face);
      row.add(shop);
      if (kind === 'liquor') sign = ((shop.getObjectByName('sign') as THREE.Mesh | undefined)?.material as THREE.MeshBasicMaterial) ?? null;
    }
    x += w;
  }
  const returnMat = toon({ color: 0x9a4a3a });
  for (const rx of [STORE.rowX, x]) {
    const ret = new THREE.Mesh(new THREE.BoxGeometry(0.4, STORE.returnH, STORE.face + 4), returnMat);
    ret.position.set(rx + (rx === STORE.rowX ? -0.2 : 0.2), STORE.returnH / 2, (STORE.face - 4) / 2);
    row.add(ret);
  }
  inkify(row, { outline: (m) => !m.userData.noInk });
  store.add(row);
  group.add(store);

  //street lamps along the curb: a pole, an arm, a glowing head and a soft pool of light on the sidewalk
  const pole = toon({ color: 0x2a2836 });
  const lamps: { head: THREE.Mesh; pool: THREE.Mesh; glow: THREE.Sprite; broken: boolean; k: number }[] = [];
  const glowTex = glowTexture();
  for (const [x, broken] of [[-14, false], [5.5, true], [24, false], [-28, false]] as const) {
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
  for (const [name, x, z, ry] of [['Hydrant', -16.5, 2, 0.4], ['TrashCan', 3.6, -1.9, 0], ['NewsBoxRed', 10.5, -2.1, 0], ['NewsBoxBlue', 11.6, -2.1, 0], ['Meter', -19, 2.2, 0]] as const) {
    const m = model(name);
    if (!m) continue;
    m.position.set(x, 0, z);
    m.rotation.y = ry;
    m.scale.setScalar(1.25);
    inkify(m);
    group.add(m);
  }

  let buzz = 0;
  return {
    group,
    update(t: number, dt: number): void {
      //the liquor store's neon buzzes (a shimmer) and drops out for a blink every few seconds
      buzz += dt;
      const p = buzz % 4.3;
      const out = (p > 3.6 && p < 3.7) || (p > 3.82 && p < 3.9);
      sign?.color.setScalar(out ? 0.25 : 0.93 + Math.sin(t * 90) * 0.07);
      //the TV: a cold blue that jumps about with the cuts; the tube light: on, then a stutter every few seconds
      const cut = Math.floor(t * 2.3);
      const v = 0.45 + 0.35 * Math.abs(Math.sin(cut * 12.9898)) + 0.08 * Math.sin(t * 31);
      tv[0]?.color.setRGB(0.35 * v, 0.55 * v, 1.0 * v);
      const q = (t + 1.3) % 3.7;
      const tube = q < 2.9 || (q > 3.05 && q < 3.15) || q > 3.5;
      tv[1]?.color.setHex(tube ? 0xe8f0ff : 0x24203a);
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
