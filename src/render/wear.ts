// How worn gear looks (GDD: Gear and wear), on the skater rig's board and shoes. Wear shows before it costs you:
// from fresh (100) the deck's nose and tail chip and its graphic rubs through to the wood, the trucks dull, rust and
// the hangers grind flat, the wheels go grubby, cone on their inner edge and flat-spot, and the lead shoe scuffs
// where the ollie drags it up the grip, then wears a hole, and the bearings in the wheels' faces rust. The board is board.glb (art/board.py); the shoe scuff
// and hole are decals in each skater's GLB ('WearScuff', 'WearHole'), hidden till worn.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GEAR, type Gear } from '../run/gear';

// art/board.py, in the board's own space (x along the deck, y up, z across)
const INCH = 0.95 / 32;
const WHEEL_R = (27 * INCH) / 25.4; // 54 mm
const WHEEL_W = (32 * INCH) / 25.4;
const BOARD = { tip: 0.475, chipFrom: 0.4, chipDepth: 0.03, rail: (8.25 * INCH) / 2, bolts: 0.27, track: 0.105, axleY: WHEEL_R - 0.12 };
const WOOD = new THREE.Color(0xe2c08d);
const RUST = new THREE.Color(0x7a4526);
const DULL = new THREE.Color(0x6f6a64);
const GRIME = new THREE.Color(0xa08c68);
const SCUFF_FROM = 65; // shoes below this show the ollie scuff
const HOLE_FROM = GEAR.busted + 15; // and below this the hole

// how worn a part looks, 0 fresh to 1 dead
const look = (condition: number) => Math.min(1, Math.max(0, (100 - condition) / 100));

// a steady pseudo-random number in [0, 1) for a place, so the deck's grip and ply edge chip together
function hash(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// each attribute as it came from the model, before any wear
const FRESH = new WeakMap<THREE.BufferAttribute, Float32Array>();
function original(attr: THREE.BufferAttribute): Float32Array {
  let a = FRESH.get(attr);
  if (!a) FRESH.set(attr, (a = (attr.array as Float32Array).slice()));
  return a;
}

// the vertices of one material in a mesh: the whole mesh, or its range in a merged one (skater-rig mergeFlat)
function ranges(mesh: THREE.Mesh, mat: string): [number, number][] {
  if (mesh.userData.mat === mat) return [[0, mesh.geometry.attributes.position.count]];
  const parts = (mesh.geometry.userData.parts ?? []) as { mat: string; start: number; count: number }[];
  return parts.filter((p) => p.mat === mat).map((p) => [p.start, p.start + p.count]);
}

// the chipped tips: nose and tail eaten back, deeper the more the deck is worn, ragged across the width
function chip(pos: THREE.BufferAttribute, fresh: Float32Array, i: number, v: number): void {
  const x = fresh[i * 3];
  const z = fresh[i * 3 + 2];
  const into = (Math.abs(x) - BOARD.chipFrom) / (BOARD.tip - BOARD.chipFrom);
  if (into <= 0) return;
  const bite = BOARD.chipDepth * v * (0.35 + 0.65 * hash(Math.round(z * 120), Math.sign(x)));
  pos.setX(i, Math.sign(x) * (Math.abs(x) - bite * Math.min(1, into) ** 2));
}

// The bearings, in each wheel's outer face round the axle nut (board.py has none): a Swiss-style black shield with
// a red ring and bright races, from zack's refs (2026-10-30). One mesh for all eight faces, coloured per vertex.
const BEARING_R = (11 * INCH) / 25.4; // a 22 mm bearing
const BEARING = [
  { r0: 0.78, r1: 1, color: 0xd8dce2 }, // outer race
  { r0: 0.48, r1: 0.78, color: 0x17171b }, // the black shield
  { r0: 0.58, r1: 0.66, color: 0xe8322a }, // its red ring
  { r0: 0.3, r1: 0.48, color: 0xd8dce2 }, // inner race
];
export function bearingCaps(mat: THREE.Material): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  const c = new THREE.Color();
  for (const x of [-BOARD.bolts, BOARD.bolts]) {
    for (const side of [-1, 1]) {
      BEARING.forEach((ring, i) => {
        const g = new THREE.RingGeometry(ring.r0 * BEARING_R, ring.r1 * BEARING_R, 14).toNonIndexed();
        //facing out from the wheel, just proud of its face (the red ring a hair prouder, over the shield)
        if (side < 0) g.rotateY(Math.PI);
        g.translate(x, BOARD.axleY, side * (BOARD.track + WHEEL_W / 2 + 0.001 + i * 0.0002));
        c.setHex(ring.color);
        g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => [c.r, c.g, c.b]).flat(), 3));
        geos.push(g);
      });
    }
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.name = 'Bearings';
  mesh.userData.mat = 'bearings';
  return mesh;
}

// the paint a slide shreds off the deck's underside, as it looks now (worn, it's rubbed through to the wood), in
// sRGB for the particles: a few samples of the deck's own colour, plus the plies that show where it's chipped
const PLY_PAINT = [0xe2c08d, 0xe8b830].map((h) => new THREE.Color(h).getRGB(new THREE.Color(), THREE.SRGBColorSpace));
export function deckPaint(board: THREE.Object3D): number[][] {
  const out: number[][] = [];
  const c = new THREE.Color();
  board.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const col = mesh.geometry.attributes.color as THREE.BufferAttribute | undefined;
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    for (const [a, b] of ranges(mesh, 'deck')) {
      const step = Math.max(1, Math.floor((b - a) / 24));
      for (let i = a; i < b; i += step) {
        if (pos.getY(i) > -0.005) continue; // the underside only, not the grip side
        if (col) c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.LinearSRGBColorSpace);
        else c.copy((mesh.material as THREE.MeshToonMaterial).color);
        c.getRGB(c, THREE.SRGBColorSpace);
        out.push([c.r, c.g, c.b]);
      }
    }
  });
  return [...out, ...PLY_PAINT.map((p) => [p.r, p.g, p.b])];
}

// how far the deck's paint has rubbed through to the wood at a place on its underside, 0 to 1: at the tips and along
// the rails first (tail drags and boardslides), ragged
function rubbed(x: number, z: number, deck: number): number {
  const rub = Math.max((Math.abs(x) - 0.36) / 0.115, (Math.abs(z) - BOARD.rail * 0.8) / (BOARD.rail * 0.2)) + hash(Math.round(x * 300), Math.round(z * 300)) * 0.6 - 0.3;
  return Math.min(1, Math.max(0, rub)) * Math.min(1, deck * 1.6);
}

export function wearBoard(board: THREE.Object3D, g: Gear): void {
  const deck = look(g.deck);
  const trucks = look(g.trucks);
  const wheels = look(g.wheels);
  const bearings = look(g.bearings);
  board.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.mat === 'bearings') {
      //grimy, then rusting out from the shield's edge in blotches as the water gets in
      const col = mesh.geometry.attributes.color as THREE.BufferAttribute;
      const tint = original(col);
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const c = new THREE.Color();
      for (let i = 0; i < col.count; i++) {
        const blot = hash(Math.round(pos.getX(i) * 400), Math.round(pos.getY(i) * 400));
        c.setRGB(tint[i * 3], tint[i * 3 + 1], tint[i * 3 + 2]).lerp(DULL, Math.min(1, bearings * 1.5) * 0.5);
        c.lerp(RUST, Math.max(0, bearings * 1.6 - 0.6) * (0.4 + 0.6 * blot));
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
      return;
    }
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const fresh = original(pos);
    if (mesh.userData.mat === 'deckArt') {
      //the graphic chips with the deck under it, and rubs off where its paint does (its vertex alpha)
      const col = mesh.geometry.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i, fresh[i * 3], fresh[i * 3 + 1], fresh[i * 3 + 2]);
        chip(pos, fresh, i, deck);
        col.setW(i, 1 - rubbed(fresh[i * 3], fresh[i * 3 + 2], deck));
      }
      pos.needsUpdate = col.needsUpdate = true;
      return;
    }
    const col = mesh.geometry.attributes.color as THREE.BufferAttribute | undefined;
    const tint = col ? original(col) : null;
    const c = new THREE.Color();
    const isWheel = mesh.userData.mat === 'wheel';
    if (isWheel) {
      wearWheels(pos, fresh, wheels);
      const mat = mesh.material as THREE.MeshToonMaterial;
      mat.color.setRGB(1, 1, 1).lerp(GRIME, wheels * 0.8);
    } else {
      // the deck, its ply edge and grip: chip the tips (nothing else reaches out past the trucks)
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i, fresh[i * 3], fresh[i * 3 + 1], fresh[i * 3 + 2]);
        chip(pos, fresh, i, deck);
      }
    }
    if (col && tint) {
      for (let i = 0; i < col.count; i++) col.setXYZ(i, tint[i * 3], tint[i * 3 + 1], tint[i * 3 + 2]);
      // the graphic rubs through to the wood at the tips and along the rails (tail drags and boardslides)
      for (const [a, b] of ranges(mesh, 'deck')) {
        for (let i = a; i < b; i++) {
          const k = rubbed(fresh[i * 3], fresh[i * 3 + 2], deck);
          c.setRGB(tint[i * 3], tint[i * 3 + 1], tint[i * 3 + 2]).lerp(WOOD, k);
          col.setXYZ(i, c.r, c.g, c.b);
        }
      }
      // trucks: dull first, then rust in blotches; the hangers' undersides grind flat
      for (const name of ['metal', 'steel', 'bolt']) {
        for (const [a, b] of ranges(mesh, name)) {
          let low = Infinity;
          for (let i = a; i < b; i++) low = Math.min(low, fresh[i * 3 + 1]);
          for (let i = a; i < b; i++) {
            c.setRGB(tint[i * 3], tint[i * 3 + 1], tint[i * 3 + 2]).lerp(DULL, Math.min(1, trucks * 1.5) * 0.6);
            const blot = hash(Math.round(fresh[i * 3] * 90), Math.round(fresh[i * 3 + 2] * 90));
            c.lerp(RUST, Math.max(0, trucks * 1.6 - 0.6) * (0.3 + 0.7 * blot));
            col.setXYZ(i, c.r, c.g, c.b);
            if (name === 'metal' && fresh[i * 3 + 1] < low + 0.006) pos.setY(i, fresh[i * 3 + 1] + 0.005 * trucks);
          }
        }
      }
      col.needsUpdate = true;
    }
    pos.needsUpdate = true;
  });
}

// coned (worn down on the inner edge, from carving) and flat-spotted (from powerslides) wheels
function wearWheels(pos: THREE.BufferAttribute, fresh: Float32Array, v: number): void {
  for (let i = 0; i < pos.count; i++) {
    const x = fresh[i * 3];
    const y0 = fresh[i * 3 + 1];
    const z = fresh[i * 3 + 2];
    const ax = Math.sign(x) * BOARD.bolts;
    const dx = x - ax;
    let dy = y0 - BOARD.axleY;
    // 0 at the outer face, 1 at the inner face
    const inner = 1 - Math.min(1, Math.max(0, (Math.abs(z) - (BOARD.track - WHEEL_W / 2)) / WHEEL_W));
    const shrink = 1 - 0.16 * v * inner;
    dy *= shrink;
    const flat = -WHEEL_R * (1 - 0.1 * v);
    if (dy < flat) dy = flat;
    pos.setXYZ(i, ax + dx * shrink, BOARD.axleY + dy, z);
  }
}

// the lead shoe: a scuff where the ollie drags it up the grip, then a hole through to the sock
export function wearShoes(model: THREE.Object3D, condition: number): void {
  model.traverse((o) => {
    if (o.userData.mat === 'WearScuff') o.visible = condition < SCUFF_FROM;
    if (o.userData.mat === 'WearHole') o.visible = condition < HOLE_FROM;
  });
}

// the bar across the grip by the back truck (art/board.py 'gripbar'): bare maple, or near-black on a grip too light
// for the wood to stand out against (white, yellow, lime, cyan, orange)
const BAR_WOOD = 0xe2c08d;
const BAR_DARK = 0x1c1c20;
export function gripBarColor(grip: number): number {
  const lum = (hex: number) => {
    const c = new THREE.Color(hex); // linear, so these make a WCAG contrast ratio
    return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  };
  const [a, b] = [lum(grip), lum(BAR_WOOD)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) < 1.8 ? BAR_DARK : BAR_WOOD;
}

// paint the grip tape (src/board/grips.ts), and its bar to stand out from it: their vertices in a merged board, or
// their own materials. The colour goes into the fresh copy too, so wear redraws over the new grip
export function paintGrip(board: THREE.Object3D, color: number): void {
  const paints: [string, THREE.Color][] = [
    ['grip', new THREE.Color(color)],
    ['gripbar', new THREE.Color(gripBarColor(color))],
  ];
  board.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const col = mesh.geometry.attributes.color as THREE.BufferAttribute | undefined;
    for (const [mat, c] of paints) {
      if (mesh.userData.mat === mat || (mat === 'grip' && !col && mesh.userData.grip)) {
        (mesh.material as THREE.MeshToonMaterial).color.copy(c);
        return;
      }
    }
    if (!col) return;
    const fresh = original(col);
    for (const [mat, c] of paints) {
      for (const [a, b] of ranges(mesh, mat)) {
        for (let i = a; i < b; i++) {
          fresh.set([c.r, c.g, c.b], i * 3);
          col.setXYZ(i, c.r, c.g, c.b);
        }
      }
    }
    col.needsUpdate = true;
  });
}

// the deck's paint (src/board/deck-art.ts base): the underside's vertices, into the fresh copy too so wear redraws
// over it
export function paintDeckBase(board: THREE.Object3D, color: number): void {
  const c = new THREE.Color(color);
  board.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const col = mesh.geometry.attributes.color as THREE.BufferAttribute | undefined;
    if (!col) {
      if (mesh.userData.mat === 'deck') (mesh.material as THREE.MeshToonMaterial).color.copy(c);
      return;
    }
    if (mesh.userData.mat === 'deckArt') return;
    const fresh = original(col);
    for (const [a, b] of ranges(mesh, 'deck')) {
      for (let i = a; i < b; i++) {
        fresh.set([c.r, c.g, c.b], i * 3);
        col.setXYZ(i, c.r, c.g, c.b);
      }
    }
    col.needsUpdate = true;
  });
}

// The deck graphic (src/render/deck-graphic.ts): a copy of the deck's underside a hair below it, mapped along and
// across, so the texture's shapes lie on the paint. Its vertex alpha is where the wear has rubbed the graphic off
// (with the material's alphaTest). `mat` takes the texture; null if the board has no deck.
export function deckDecal(board: THREE.Object3D, mat: THREE.Material): THREE.Mesh | null {
  const found: { mesh: THREE.Mesh; range: [number, number] }[] = [];
  board.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const r = ranges(mesh, 'deck')[0];
    if (r) found.push({ mesh, range: r });
  });
  if (!found.length) return null;
  const from = found[0].mesh;
  const [a, b] = found[0].range;
  const geo = from.geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const tris: number[] = [];
  if (geo.index) {
    const idx = geo.index;
    for (let t = 0; t + 2 < idx.count; t += 3) {
      const v = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      if (v.every((i) => i >= a && i < b)) tris.push(...v);
    }
  } else {
    for (let i = a; i + 2 < b; i += 3) tris.push(i, i + 1, i + 2);
  }
  const n = tris.length;
  const p = new Float32Array(n * 3);
  const nn = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const col = new Float32Array(n * 4).fill(1);
  const lift = 0.0015; // proud of the paint, outward
  //the deck's own width and length (each deck has its own outline, art/board.py), so the picture fills it
  let rail = 0;
  let tip = 0;
  for (const v of tris) {
    rail = Math.max(rail, Math.abs(pos.getZ(v)));
    tip = Math.max(tip, Math.abs(pos.getX(v)));
  }
  tris.forEach((v, j) => {
    const [nx, ny, nz] = [nor.getX(v), nor.getY(v), nor.getZ(v)];
    const [x, y, z] = [pos.getX(v), pos.getY(v), pos.getZ(v)];
    p.set([x + nx * lift, y + ny * lift, z + nz * lift], j * 3);
    nn.set([nx, ny, nz], j * 3);
    //the picture's nose (its top) at +x; seen from below, across runs the way it reads
    uv.set([0.5 - z / (2 * (rail || BOARD.rail)), 0.5 + x / (2 * (tip || BOARD.tip))], j * 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const decal = new THREE.Mesh(g, mat);
  decal.name = 'DeckArt';
  decal.userData.mat = 'deckArt';
  decal.userData.inked = true; // no hull of its own: the deck's outlines it
  decal.frustumCulled = false;
  decal.position.copy(from.position);
  decal.quaternion.copy(from.quaternion);
  decal.scale.copy(from.scale);
  from.parent!.add(decal);
  return decal;
}
