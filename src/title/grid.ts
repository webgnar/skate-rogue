// The title scene's city grid (src/title/title-scene.ts; zack 2026-11-02: "do a second pass on the buildings. build a
// ground. with streets"). Blocks between streets and avenues, each with its sidewalk and one to four buildings on it,
// tallest downtown (back along -z) and low and old by Webster's street. Four kinds of building, each its own facade
// sheet: lit office grids, glass curtain walls, old brick and stone, concrete ribbons; each tinted its own tone, with
// setback crowns, lobbies, water tanks, roof boxes and masts with red beacons. Under them the ground: asphalt, the
// lane dashes and crosswalks at every corner, street lights down every street, and traffic, headlights one way and
// tail lights the other. Clouds drift past the tower tops.
//
// Everything is merged per material, so the whole city is a couple of dozen draws. Units are tiles; Webster stands at
// the origin on the sidewalk of the street at z = 12 (the hero street), facing +z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRng, type Rng } from '../gen/rng';
import { toon } from '../render/toon';
import { cloudTexture } from './city';

export const GRID = {
  pitch: 52, // street centre to street centre
  street: 12, // a street's width, kerb to kerb
  hero: 18, // Webster's street, wider
  heroZ: 12, // its centre
  walk: 3, // the sidewalk round each block
  storey: 3.6,
  downtown: new THREE.Vector3(0, 0, -230), // the tallest towers stand round here
};

// the streets along x (their z) and the avenues along z (their x), with widths
const STREETS_Z = Array.from({ length: 14 }, (_, i) => GRID.heroZ + GRID.pitch * (i - 11)); // -560 .. 116
const AVENUES_X = Array.from({ length: 16 }, (_, i) => -GRID.pitch / 2 + GRID.pitch * (i - 7)); // -390 .. 390
const widthZ = (z: number) => (z === GRID.heroZ ? GRID.hero : GRID.street);
const SPAN = { x0: -420, x1: 420, z0: -600, z1: 150 };

// The facade sheets: one canvas each, windows a cell, and how many tiles a cell is across and up
interface Style {
  map: THREE.Texture;
  glow: THREE.Texture;
  cellW: number; // tiles a window cell is across
  cellH: number; // and up (a storey)
  cols: number;
  rows: number;
  tints: number[];
}

function sheet(rng: Rng, kind: 0 | 1 | 2 | 3): Style {
  const cols = 16;
  const rows = 32;
  const cw = 16;
  const ch = 16;
  const make = () => {
    const c = document.createElement('canvas');
    c.width = cols * cw;
    c.height = rows * ch;
    return c;
  };
  const a = make();
  const b = make();
  const g = a.getContext('2d')!;
  const e = b.getContext('2d')!;
  e.fillStyle = '#000';
  e.fillRect(0, 0, b.width, b.height);
  const warm = ['#ffd890', '#ffe7b0', '#ffc070', '#ffb060'];
  const cold = ['#bfe8ff', '#d8f0ff', '#ff9ad8', '#c8b8ff'];
  const lit = (x: number, y: number, w: number, h: number, colors: string[]) => {
    const c = colors[Math.floor(rng() * colors.length)];
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
    e.fillStyle = c;
    e.fillRect(x, y, w, h);
  };
  //whole floors lit together, as offices are, with the odd one dark
  const floorOn = Array.from({ length: rows }, () => rng() < 0.35);
  if (kind === 0) {
    //office grid: a light frame, dark windows, a third lit
    g.fillStyle = '#6a6480';
    g.fillRect(0, 0, a.width, a.height);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const on = rng() < (floorOn[y] ? 0.7 : 0.12);
        if (on) lit(x * cw + 3, y * ch + 3, cw - 6, ch - 5, rng() < 0.7 ? warm : cold);
        else {
          g.fillStyle = rng() < 0.5 ? '#232036' : '#2c2842';
          g.fillRect(x * cw + 3, y * ch + 3, cw - 6, ch - 5);
        }
      }
  } else if (kind === 1) {
    //glass curtain wall: the sky in it, darker at the top of each floor, thin mullions, some floors lit through
    for (let y = 0; y < rows; y++) {
      const grad = g.createLinearGradient(0, y * ch, 0, y * ch + ch);
      grad.addColorStop(0, '#2a3a5a');
      grad.addColorStop(1, '#5a6a9a');
      g.fillStyle = grad;
      g.fillRect(0, y * ch, a.width, ch);
      if (floorOn[y]) for (let x = 0; x < cols; x++) if (rng() < 0.8) lit(x * cw + 1, y * ch + 4, cw - 2, ch - 7, rng() < 0.5 ? cold : warm);
      g.fillStyle = '#1a2032';
      g.fillRect(0, y * ch + ch - 2, a.width, 2);
    }
    g.fillStyle = 'rgba(20,24,40,0.8)';
    for (let x = 0; x < cols; x++) g.fillRect(x * cw, 0, 1, a.height);
    //a sunset sheen down one side
    const sheen = g.createLinearGradient(0, 0, a.width, 0);
    sheen.addColorStop(0, 'rgba(255,150,120,0.25)');
    sheen.addColorStop(0.5, 'rgba(255,150,120,0)');
    g.fillStyle = sheen;
    g.fillRect(0, 0, a.width, a.height);
  } else if (kind === 2) {
    //old brick and stone: a warm wall, tall narrow windows with stone sills, a cornice band every few floors
    g.fillStyle = '#7a4a3a';
    g.fillRect(0, 0, a.width, a.height);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(${40 + rng() * 60},${20 + rng() * 30},${15 + rng() * 20},0.25)`;
      g.fillRect(Math.floor(rng() * a.width), Math.floor(rng() * a.height), 3, 1);
    }
    for (let y = 0; y < rows; y++) {
      if (y % 6 === 0) {
        g.fillStyle = '#b8a890';
        g.fillRect(0, y * ch, a.width, 2);
      }
      for (let x = 0; x < cols; x++) {
        if (rng() < 0.18) lit(x * cw + 5, y * ch + 3, cw - 10, ch - 5, warm);
        else {
          g.fillStyle = '#1e1622';
          g.fillRect(x * cw + 5, y * ch + 3, cw - 10, ch - 5);
        }
        g.fillStyle = '#c8b8a0';
        g.fillRect(x * cw + 4, y * ch + ch - 2, cw - 8, 1);
      }
    }
  } else {
    //concrete ribbons: pale piers between dark vertical glass strips
    g.fillStyle = '#8a8494';
    g.fillRect(0, 0, a.width, a.height);
    for (let x = 0; x < cols; x++) {
      g.fillStyle = '#262236';
      g.fillRect(x * cw + 4, 0, cw - 8, a.height);
      for (let y = 0; y < rows; y++) {
        if (rng() < (floorOn[y] ? 0.55 : 0.08)) lit(x * cw + 4, y * ch + 2, cw - 8, ch - 4, rng() < 0.5 ? warm : cold);
        g.fillStyle = '#7a7484';
        g.fillRect(x * cw + 4, y * ch + ch - 2, cw - 8, 2);
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
  const sizes = [
    { cellW: 4, cellH: GRID.storey, tints: [0xffffff, 0xe0d8f0, 0xf0e0d8, 0xd8e0f0] },
    { cellW: 3, cellH: GRID.storey, tints: [0xffffff, 0xd0e8ff, 0xffd8e8, 0xc8f0e8] },
    { cellW: 3.2, cellH: 3.2, tints: [0xffffff, 0xe8c8b0, 0xd8b8b8, 0xc8b8a8] },
    { cellW: 3.6, cellH: GRID.storey, tints: [0xffffff, 0xe8e0d0, 0xd0d8e0, 0xe0d0e0] },
  ][kind];
  return { map: tex(a), glow: tex(b), cols, rows, ...sizes };
}

// a box whose UVs count window cells, so one sheet tiles every building of its kind; the roof and underside get
// the sheet's corner. Tinted with a vertex colour.
function facadeBox(st: Style, w: number, h: number, d: number, x: number, y: number, z: number, off: number, tint: THREE.Color): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i) + w / 2;
    const pz = pos.getZ(i) + d / 2;
    const py = pos.getY(i) + h / 2 + y;
    const across = Math.abs(nor.getX(i)) > 0.5 ? pz : px;
    if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, 0.001, 0.001);
    else uv.setXY(i, off + across / st.cellW / st.cols, off * 7 + py / st.cellH / st.rows);
    //the roof a little darker than the walls
    const k = Math.abs(nor.getY(i)) > 0.5 ? 0.55 : 1;
    col.set([tint.r * k, tint.g * k, tint.b * k], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.translate(x, y + h / 2, z);
  return g;
}

// a plain box in one colour (vertex coloured), for the merged meshes
function box(w: number, h: number, d: number, x: number, y: number, z: number, color: number | THREE.Color, ry = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y + h / 2, z);
  return paint(g, color);
}

function paint(g: THREE.BufferGeometry, color: number | THREE.Color): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  //merging needs the same attributes everywhere: plain parts get UVs at the sheet's corner too
  if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g.index ? g.toNonIndexed() : g;
}

export interface City {
  group: THREE.Group;
  update(t: number, dt: number): void;
}

interface Lot {
  x: number;
  z: number;
  w: number;
  d: number;
}

export function buildCity(seed = 7): City {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  const styles = ([0, 1, 2, 3] as const).map((k) => sheet(rng, k));
  const facades: THREE.BufferGeometry[][] = [[], [], [], []];
  const plain: THREE.BufferGeometry[] = []; // roofs' clutter, lobbies, the ground's sidewalks and kerbs
  const tops: { x: number; y: number; z: number; w: number; d: number; tall: boolean }[] = [];
  const flickSpots: { x: number; y: number; z: number; face: number }[] = [];

  // the ground: asphalt under everything
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(SPAN.x1 - SPAN.x0 + 400, SPAN.z1 - SPAN.z0 + 400).rotateX(-Math.PI / 2), toon({ color: 0x2a2734 }));
  ground.position.set(0, -0.32, (SPAN.z0 + SPAN.z1) / 2);
  group.add(ground);

  const building = (lot: Lot, h: number, kind: 0 | 1 | 2 | 3) => {
    const st = styles[kind];
    const tint = new THREE.Color(st.tints[Math.floor(rng() * st.tints.length)]).multiplyScalar(0.85 + rng() * 0.15);
    const off = Math.floor(rng() * 16) / 16;
    //a lobby: a taller, darker ground floor, set in under the tower (the glass and concrete ones)
    let base = 0;
    if ((kind === 1 || kind === 3) && h > 40) {
      plain.push(box(lot.w * 0.92, 6, lot.d * 0.92, lot.x, 0, lot.z, 0x1c1a26));
      base = 6;
    }
    facades[kind].push(facadeBox(st, lot.w, h - base, lot.d, lot.x, base, lot.z, off, tint));
    let top = h;
    let tw = lot.w;
    let td = lot.d;
    //setbacks: the tall ones step in once or twice toward the top
    for (let s = 0; s < 2 && top > 110 && rng() < 0.75; s++) {
      tw *= 0.72;
      td *= 0.72;
      const sh = 14 + rng() * 26;
      facades[kind].push(facadeBox(st, tw, sh, td, lot.x, top, lot.z, off, tint));
      top += sh;
    }
    tops.push({ x: lot.x, y: top, z: lot.z, w: tw, d: td, tall: top > 140 });
    //on the roof: a parapet, and boxes or a water tank on the low and middling ones
    plain.push(box(tw + 0.6, 1, td + 0.6, lot.x, top, lot.z, 0x3a3448));
    if (top < 120) {
      if (kind === 2 || rng() < 0.3) {
        //a wooden water tank on legs with a cone hat
        const tx = lot.x + (rng() - 0.5) * tw * 0.5;
        const tz = lot.z + (rng() - 0.5) * td * 0.5;
        for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) plain.push(box(0.3, 3, 0.3, tx + lx * 1.4, top, tz + lz * 1.4, 0x2a2430));
        plain.push(paint(new THREE.CylinderGeometry(2.2, 2.2, 4, 10).translate(tx, top + 5, tz), 0x6a4a34));
        plain.push(paint(new THREE.ConeGeometry(2.5, 1.6, 10).translate(tx, top + 7.8, tz), 0x3a2a24));
      }
      for (let i = 0; i < 3; i++) if (rng() < 0.6) plain.push(box(2 + rng() * 3, 1.5 + rng(), 2 + rng() * 2, lot.x + (rng() - 0.5) * tw * 0.7, top + 1, lot.z + (rng() - 0.5) * td * 0.7, 0x5a5468));
    }
    //some windows that flicker, on the faces toward the camera
    if (lot.z > -200 && Math.abs(lot.x) < 140 && rng() < 0.6) {
      for (let i = 0; i < 3; i++) flickSpots.push({ x: lot.x + (rng() - 0.5) * (lot.w - 3), y: base + 4 + Math.floor(rng() * ((h - base - 6) / st.cellH)) * st.cellH + st.cellH / 2, z: lot.z + lot.d / 2 + 0.06, face: 0 });
    }
  };

  // the blocks, between the streets
  const zs = [...STREETS_Z].sort((a, b) => a - b);
  for (let j = 0; j < zs.length - 1; j++) {
    const z0 = zs[j] + widthZ(zs[j]) / 2;
    const z1 = zs[j + 1] - widthZ(zs[j + 1]) / 2;
    for (let i = 0; i < AVENUES_X.length - 1; i++) {
      const x0 = AVENUES_X[i] + GRID.street / 2;
      const x1 = AVENUES_X[i + 1] - GRID.street / 2;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      //the block's sidewalk, a kerb high
      plain.push(box(x1 - x0, 0.32, z1 - z0, cx, -0.32, cz, 0x6a6478));
      const lot: Lot = { x: cx, z: cz, w: x1 - x0 - GRID.walk * 2, d: z1 - z0 - GRID.walk * 2 };
      const front = zs[j] === GRID.heroZ; // the blocks across Webster's street (behind the camera at the end)
      const hero = zs[j + 1] === GRID.heroZ; // Webster's own block row
      if (front && Math.abs(cx) < 30) {
        parkingLot(plain, lot, rng); // across from Webster: a parking lot, open sky over the camera's way down
        continue;
      }
      //how tall: highest downtown, low and old near Webster's street
      const d = Math.hypot(cx - GRID.downtown.x, cz - GRID.downtown.z);
      const near = Math.abs(cz - GRID.heroZ) < 70 && Math.abs(cx) < 120;
      const peak = near ? 30 + rng() * 40 : 40 + 300 * Math.exp(-d / 260) * (0.45 + rng() * 0.75);
      const kind = (near ? (rng() < 0.6 ? 2 : 0) : peak > 150 ? (rng() < 0.5 ? 1 : rng() < 0.5 ? 3 : 0) : ([0, 1, 2, 3] as const)[Math.floor(rng() * 4)]) as 0 | 1 | 2 | 3;
      if (hero && Math.abs(cx) < 30) {
        //Webster's block: the corner store (city.ts) along the front, a tower right behind it
        building({ x: cx, z: z0 + GRID.walk + 7, w: lot.w, d: 14 }, 70 + rng() * 40, 0);
        continue;
      }
      //one to four buildings on the block
      const split = peak > 160 ? (rng() < 0.6 ? 1 : 2) : 1 + Math.floor(rng() * 4);
      if (split === 1) building(lot, peak, kind);
      else if (split === 2) {
        const half = lot.w / 2;
        building({ x: lot.x - half / 2, z: lot.z, w: half - 1, d: lot.d }, peak, kind);
        building({ x: lot.x + half / 2, z: lot.z, w: half - 1, d: lot.d * (0.6 + rng() * 0.4) }, peak * (0.4 + rng() * 0.5), ([0, 1, 2, 3] as const)[Math.floor(rng() * 4)]);
      } else {
        const q = [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, split);
        for (const [sx, sz] of q) {
          const w = lot.w / 2 - 1;
          const dd = lot.d / 2 - 1;
          building({ x: lot.x + (sx * lot.w) / 4, z: lot.z + (sz * lot.d) / 4, w, d: dd }, peak * (0.35 + rng() * 0.7), ([0, 1, 2, 3] as const)[Math.floor(rng() * 4)]);
        }
      }
    }
  }

  // the facades, a mesh a kind; the plain parts one mesh
  styles.forEach((st, k) => {
    if (!facades[k].length) return;
    group.add(new THREE.Mesh(mergeGeometries(facades[k])!, toon({ color: 0xffffff, map: st.map, emissive: 0xffffff, emissiveMap: st.glow, emissiveIntensity: 0.9, vertexColors: true })));
  });
  group.add(new THREE.Mesh(mergeGeometries(plain)!, toon({ color: 0xffffff, vertexColors: true })));

  // the street markings: lane dashes, and zebra crosswalks at every corner
  const marks: THREE.BufferGeometry[] = [];
  const dash = (x: number, z: number, w: number, d: number) => marks.push(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, -0.3, z));
  for (const z of STREETS_Z) {
    for (let x = SPAN.x0; x < SPAN.x1; x += 7) {
      if (AVENUES_X.some((ax) => Math.abs(ax - x) < GRID.street / 2 + 3)) continue;
      dash(x, z, 3.4, 0.28);
    }
  }
  for (const x of AVENUES_X) {
    for (let z = SPAN.z0; z < SPAN.z1; z += 7) {
      if (STREETS_Z.some((sz) => Math.abs(sz - z) < widthZ(sz) / 2 + 3)) continue;
      dash(x, z, 0.28, 3.4);
    }
  }
  const yellow = new THREE.Mesh(mergeGeometries(marks)!, new THREE.MeshBasicMaterial({ color: 0xc8a840 }));
  const zebra: THREE.BufferGeometry[] = [];
  for (const z of STREETS_Z) {
    for (const x of AVENUES_X) {
      const wz = widthZ(z);
      //across the avenue, each side of the street; across the street, each side of the avenue
      for (const side of [-1, 1]) {
        for (let k = -GRID.street / 2 + 1; k < GRID.street / 2; k += 1.6) zebra.push(new THREE.PlaneGeometry(0.8, 2.4).rotateX(-Math.PI / 2).translate(x + k, -0.29, z + side * (wz / 2 + 1.6)));
        for (let k = -wz / 2 + 1; k < wz / 2; k += 1.6) zebra.push(new THREE.PlaneGeometry(2.4, 0.8).rotateX(-Math.PI / 2).translate(x + side * (GRID.street / 2 + 1.6), -0.29, z + k));
      }
    }
  }
  const white = new THREE.Mesh(mergeGeometries(zebra)!, new THREE.MeshBasicMaterial({ color: 0xd8d4e0 }));
  group.add(yellow, white);

  // street lights down both sides of every street: a warm dot on a pole, from up high a grid of lights
  const lampSpots: THREE.Vector3[] = [];
  for (const z of STREETS_Z) for (let x = SPAN.x0; x < SPAN.x1; x += 18) for (const s of [-1, 1]) if (!(z === GRID.heroZ && Math.abs(x) < 50)) lampSpots.push(new THREE.Vector3(x + s * 4, 7, z + s * (widthZ(z) / 2 + 0.8)));
  for (const x of AVENUES_X) for (let z = SPAN.z0; z < SPAN.z1; z += 18) for (const s of [-1, 1]) lampSpots.push(new THREE.Vector3(x + s * (GRID.street / 2 + 0.8), 7, z + s * 4));
  const lamps = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.7, 0), new THREE.MeshBasicMaterial({ color: 0xffd890 }), lampSpots.length);
  const poles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 7, 0.25).translate(0, -3.5, 0), toon({ color: 0x2a2836 }), lampSpots.length);
  const m4 = new THREE.Matrix4();
  lampSpots.forEach((p, i) => {
    m4.makeTranslation(p.x, p.y, p.z);
    lamps.setMatrixAt(i, m4);
    poles.setMatrixAt(i, m4);
  });
  group.add(lamps, poles);

  const traffic = buildTraffic(rng);
  group.add(traffic.group);

  // masts with red aircraft beacons on the tall ones, blinking slowly, out of step
  const beacons: THREE.Mesh[] = [];
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff3030, fog: false });
  const mast: THREE.BufferGeometry[] = [];
  for (const t of tops) {
    if (!t.tall || rng() < 0.35) continue;
    const mh = 10 + rng() * 14;
    mast.push(paint(new THREE.CylinderGeometry(0.35, 0.6, mh, 5).translate(t.x, t.y + mh / 2, t.z), 0x3a3448));
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.1, 6, 4), beaconMat);
    b.position.set(t.x, t.y + mh + 0.6, t.z);
    b.userData.phase = rng() * 3;
    group.add(b);
    beacons.push(b);
  }
  if (mast.length) group.add(new THREE.Mesh(mergeGeometries(mast)!, toon({ color: 0xffffff, vertexColors: true })));

  // windows that flicker: a lit window's glow on the face of a near building, going out and coming back on
  const flick = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), Math.max(1, Math.min(60, flickSpots.length)));
  const flickers: { k: number; rate: number; color: THREE.Color }[] = [];
  for (let i = 0; i < flick.count; i++) {
    const s = flickSpots[Math.floor(rng() * flickSpots.length)] ?? { x: 0, y: -50, z: 0 };
    m4.makeTranslation(s.x, s.y, s.z);
    flick.setMatrixAt(i, m4);
    const color = new THREE.Color([0xffd890, 0xbfe8ff, 0xff9ad8, 0xffc070][i % 4]);
    flickers.push({ k: rng() * 10, rate: 0.6 + rng() * 2.5, color });
    flick.setColorAt(i, color);
  }
  group.add(flick);

  // clouds drifting past the tops of the towers: soft puffs on camera-facing cards, pink underneath from the sun
  const cloudTex = cloudTexture(rng);
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < 16; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, color: new THREE.Color().setHSL(0.92 + rng() * 0.06, 0.45, 0.82 + rng() * 0.1), transparent: true, opacity: 0.7, depthWrite: false, fog: true });
    const s = new THREE.Sprite(mat);
    const w = 70 + rng() * 120;
    s.scale.set(w, w * 0.42, 1);
    s.position.set(-300 + rng() * 600, 150 + rng() * 120, -320 + rng() * 360);
    s.userData.speed = 2 + rng() * 5;
    clouds.push(s);
    group.add(s);
  }

  const off = new THREE.Color(0x1a1828);
  return {
    group,
    update(t: number, dt: number): void {
      for (const b of beacons) b.visible = (t + b.userData.phase) % 2.4 < 1.2;
      flickers.forEach((f, i) => {
        f.k += dt * f.rate;
        //mostly on, now and then a stutter: off, on, off
        const p = f.k % 6;
        const on = p > 0.5 || (p > 0.12 && p < 0.22) || (p > 0.32 && p < 0.38);
        flick.setColorAt(i, on ? f.color : off);
      });
      if (flick.instanceColor) flick.instanceColor.needsUpdate = true;
      for (const s of clouds) {
        s.position.x += s.userData.speed * dt;
        if (s.position.x > 360) s.position.x = -360;
      }
      traffic.update(t, dt);
    },
  };
}

// the lot across the street from Webster: painted bays, a few parked cars, a chain-link edge
function parkingLot(plain: THREE.BufferGeometry[], lot: Lot, rng: Rng): void {
  plain.push(box(lot.w + GRID.walk * 2 - 0.2, 0.05, lot.d + GRID.walk * 2 - 0.2, lot.x, 0, lot.z, 0x34303e));
  for (let i = -4; i <= 4; i++) plain.push(box(0.2, 0.02, 5, lot.x + i * 3.2, 0.05, lot.z + 6, 0xc8c4d0));
  for (let i = -4; i <= 4; i++) plain.push(box(0.2, 0.02, 5, lot.x + i * 3.2, 0.05, lot.z - 6, 0xc8c4d0));
  for (let i = 0; i < 7; i++) {
    const x = lot.x + (Math.floor(rng() * 8) - 4) * 3.2 + 1.6;
    const z = lot.z + (rng() < 0.5 ? 6 : -6);
    const c = new THREE.Color().setHSL(rng(), 0.4, 0.35);
    plain.push(box(1.8, 1.1, 4.2, x, 0.3, z, c));
    plain.push(box(1.6, 0.8, 2.2, x, 1.4, z - 0.2, c.clone().multiplyScalar(0.7)));
  }
  //the fence along the back, posts and a rail
  for (let x = lot.x - lot.w / 2; x <= lot.x + lot.w / 2; x += 4) plain.push(box(0.15, 2.4, 0.15, x, 0, lot.z + lot.d / 2 + 2, 0x5a5868));
  plain.push(box(lot.w, 0.12, 0.12, lot.x, 2.3, lot.z + lot.d / 2 + 2, 0x5a5868));
}

// cars on every street but Webster's: bodies, headlights in front and tail lights behind, three instanced draws
function buildTraffic(rng: Rng): { group: THREE.Group; update(t: number, dt: number): void } {
  const group = new THREE.Group();
  interface Car {
    along: 'x' | 'z';
    line: number; // the street's z (or the avenue's x)
    lane: number; // offset from its centre
    dir: number;
    s: number; // where along
    v: number;
  }
  const cars: Car[] = [];
  for (const z of STREETS_Z) {
    if (z === GRID.heroZ) continue; // Webster's street is quiet: nothing between him and the camera
    for (let i = 0; i < 6; i++) {
      const dir = rng() < 0.5 ? 1 : -1;
      cars.push({ along: 'x', line: z, lane: dir * 2.6, dir, s: SPAN.x0 + rng() * (SPAN.x1 - SPAN.x0), v: 10 + rng() * 8 });
    }
  }
  for (const x of AVENUES_X) {
    for (let i = 0; i < 6; i++) {
      const dir = rng() < 0.5 ? 1 : -1;
      cars.push({ along: 'z', line: x, lane: -dir * 2.6, dir, s: SPAN.z0 + rng() * (SPAN.z1 - SPAN.z0), v: 10 + rng() * 8 });
    }
  }
  const body = new THREE.InstancedMesh(new THREE.BoxGeometry(4.2, 1.4, 1.9).translate(0, 0.9, 0), toon({ color: 0xffffff }), cars.length);
  const head = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.35, 1.6).translate(2.15, 0.9, 0), new THREE.MeshBasicMaterial({ color: 0xfff4d0 }), cars.length);
  const tail = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.35, 1.6).translate(-2.15, 0.9, 0), new THREE.MeshBasicMaterial({ color: 0xff2a2a }), cars.length);
  const paints = [0x2a2a34, 0xd8d4e0, 0x8a2a2a, 0x2a4a7a, 0xe8c83a, 0x3a6a4a, 0x6a6a72];
  cars.forEach((_, i) => body.setColorAt(i, new THREE.Color(paints[Math.floor(rng() * paints.length)])));
  group.add(body, head, tail);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const up = new THREE.Vector3(0, 1, 0);
  return {
    group,
    update(_t: number, dt: number): void {
      cars.forEach((c, i) => {
        const [lo, hi] = c.along === 'x' ? [SPAN.x0, SPAN.x1] : [SPAN.z0, SPAN.z1];
        c.s += c.dir * c.v * dt;
        if (c.s > hi) c.s = lo;
        if (c.s < lo) c.s = hi;
        if (c.along === 'x') {
          p.set(c.s, -0.3, c.line + c.lane);
          q.setFromAxisAngle(up, c.dir > 0 ? 0 : Math.PI);
        } else {
          p.set(c.line + c.lane, -0.3, c.s);
          q.setFromAxisAngle(up, c.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
        }
        m.compose(p, q, one);
        body.setMatrixAt(i, m);
        head.setMatrixAt(i, m);
        tail.setMatrixAt(i, m);
      });
      body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = tail.instanceMatrix.needsUpdate = true;
    },
  };
}
