// The upper storeys of the title's corner building (city.ts), over the shops: a Chicago brick front after zack's
// photos (2026-11-02): brick piers between the window bays standing proud of the wall with stone caps and bases, a
// stone belt course over the shop signs, teal-framed double-hung windows (blinds, curtains, a lit room, a TV) with
// stone sills, flat stone lintels with keystones on the first floor up and stone arches of alternating voussoirs on
// the top floor, green deco tile panels with a gold emblem between the floors, a fire escape down one end, a window
// unit and a flower box, a cornice on brackets with dentils, and a parapet with a stone panel dated 1924. Grime runs
// down from the sills and darkens the top under the cornice.
//
// Built from boxes merged by material, so the whole front is a handful of draws plus outlines. Units are tiles; the
// wall's face is at z = FACE.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../gen/rng';
import { inkify, toon } from '../render/toon';

export const FACADE = {
  x0: -20,
  x1: 20,
  face: -4, // the wall's face
  belt: 7.35, // the stone belt course over the shop signs (its bottom)
  bays: [-15, -9, -3, 3, 9, 15], // the window bays' middles
  floors: [8.95, 11.95], // the window rows' middles
  winW: 2.1,
  winH: 2.1,
  top: 13.7, // the brick's top, where the cornice starts
};

// a box, its faces mapped in tile units (u along its width or depth, v up), so brick and tile repeat at a fixed size
function box(w: number, h: number, d: number, x: number, y: number, z: number, uvScale = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y + h / 2, z);
  if (uvScale) {
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(nor.getX(i));
      const ny = Math.abs(nor.getY(i));
      const u = ny > 0.5 ? pos.getX(i) : nx > 0.5 ? pos.getZ(i) : pos.getX(i);
      const v = ny > 0.5 ? pos.getZ(i) : pos.getY(i);
      uv.setXY(i, u * uvScale, v * uvScale);
    }
  }
  return g;
}

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// what's behind each window: a room's warm light with the blinds down, curtains half drawn, a dark room with the
// sky in the glass, a lit room, the TV's room (its colour is set every frame)
function windowTexture(kind: 'blinds' | 'curtains' | 'dark' | 'lit' | 'room', rng: Rng): THREE.CanvasTexture {
  return canvas(64, 64, (g) => {
    const warm = g.createLinearGradient(0, 0, 0, 64);
    warm.addColorStop(0, '#ffd890');
    warm.addColorStop(1, '#e89850');
    if (kind === 'dark') {
      const sky = g.createLinearGradient(0, 0, 64, 64);
      sky.addColorStop(0, '#4a3a6a');
      sky.addColorStop(0.5, '#1e1a30');
      sky.addColorStop(1, '#2a2440');
      g.fillStyle = sky;
      g.fillRect(0, 0, 64, 64);
      //the sunset caught in the glass: a slanted streak
      g.fillStyle = 'rgba(255,170,190,0.25)';
      g.beginPath();
      g.moveTo(10, 0);
      g.lineTo(26, 0);
      g.lineTo(0, 30);
      g.lineTo(0, 14);
      g.fill();
    } else if (kind === 'blinds') {
      g.fillStyle = warm;
      g.fillRect(0, 0, 64, 64);
      //the blinds down most of the way, slats catching the light
      const down = 40 + rng() * 20;
      for (let y = 0; y < down; y += 4) {
        g.fillStyle = '#f4ead8';
        g.fillRect(0, y, 64, 3);
        g.fillStyle = '#c8b898';
        g.fillRect(0, y + 3, 64, 1);
      }
    } else if (kind === 'curtains') {
      g.fillStyle = warm;
      g.fillRect(0, 0, 64, 64);
      const col = rng() < 0.5 ? ['#a8303a', '#7a2028'] : ['#2a8a7a', '#1a5a50'];
      for (const side of [0, 1]) {
        for (let i = 0; i < 6; i++) {
          g.fillStyle = col[i % 2];
          const x = side ? 64 - 22 + i * 4 : i * 4;
          g.fillRect(x, 0, 4, 64);
        }
      }
      //a lampshade glowing in the gap
      g.fillStyle = '#fff2c0';
      g.fillRect(28, 38, 9, 6);
    } else if (kind === 'lit') {
      g.fillStyle = warm;
      g.fillRect(0, 0, 64, 64);
      //a shelf and a plant on the sill
      g.fillStyle = '#8a5a3a';
      g.fillRect(6, 22, 26, 3);
      g.fillStyle = '#3a7a3a';
      g.beginPath();
      g.arc(48, 50, 9, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#a85a3a';
      g.fillRect(43, 54, 10, 10);
    } else {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#9a9aa8';
      g.fillRect(0, 44, 64, 20); // a sofa back in the TV's light
    }
  });
}

export interface Facade {
  group: THREE.Group;
  tv: THREE.MeshBasicMaterial; // the TV's window: tinted every frame
  tube: THREE.MeshBasicMaterial; // the window with the tube light on the blink
}

export function buildFacade(rng: Rng, brick: THREE.Texture): Facade {
  const F = FACADE;
  const group = new THREE.Group();
  const stone: THREE.BufferGeometry[] = [];
  const stoneDark: THREE.BufferGeometry[] = [];
  const piers: THREE.BufferGeometry[] = [];
  const teal: THREE.BufferGeometry[] = [];
  const iron: THREE.BufferGeometry[] = [];
  const tile: THREE.BufferGeometry[] = [];
  const reveal: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const z = F.face;

  //the belt course over the shops: a stone band and a thin drip moulding under it
  stone.push(box(F.x1 - F.x0 + 0.4, 0.42, 0.42, 0, F.belt, z + 0.21));
  stone.push(box(F.x1 - F.x0 + 0.2, 0.12, 0.55, 0, F.belt - 0.08, z + 0.27));
  //a sill course under each row of windows, running the whole front
  for (const fy of F.floors) stone.push(box(F.x1 - F.x0, 0.16, 0.22, 0, fy - F.winH / 2 - 0.3, z + 0.11));

  //the piers between the bays: brick standing proud, a stone base on the belt and a stone cap under the cornice,
  //and a stone block at each floor like the photo's
  const pierXs = [F.x0 + 0.6, ...F.bays.slice(0, -1).map((b) => b + 3), F.x1 - 0.6];
  for (const px of pierXs) {
    const w = px === pierXs[0] || px === pierXs[pierXs.length - 1] ? 1.2 : 0.9;
    piers.push(box(w, F.top - F.belt - 0.42, 0.24, px, F.belt + 0.42, z + 0.12, 1));
    stone.push(box(w + 0.16, 0.36, 0.34, px, F.belt + 0.42, z + 0.17)); // base
    stone.push(box(w + 0.2, 0.4, 0.36, px, F.top - 0.4, z + 0.18)); // cap
    for (const fy of F.floors) stoneDark.push(box(0.34, 0.9, 0.3, px, fy - 0.2, z + 0.2)); // the inset stone block
  }

  //the windows
  const kinds: ('blinds' | 'curtains' | 'dark' | 'lit')[] = ['blinds', 'dark', 'curtains', 'lit', 'dark', 'blinds', 'curtains', 'dark', 'lit', 'blinds', 'dark', 'curtains'];
  const texs = new Map<string, THREE.MeshBasicMaterial>();
  const glassFor = (k: string) => {
    let m = texs.get(k);
    if (!m) texs.set(k, (m = new THREE.MeshBasicMaterial({ map: windowTexture(k as 'blinds', rng) })));
    return m;
  };
  const tv = new THREE.MeshBasicMaterial({ map: windowTexture('room', rng) });
  const tube = new THREE.MeshBasicMaterial({ map: windowTexture('room', rng) });
  let n = 0;
  F.floors.forEach((fy, f) => {
    F.bays.forEach((bx, i) => {
      const w = F.winW;
      const h = F.winH;
      const bottom = fy - h / 2;
      //the opening: a dark reveal set into the wall, then the glass a little way back in it
      reveal.push(box(w + 0.1, h + 0.1, 0.1, bx, bottom - 0.05, z + 0.01));
      const isTv = f === 0 && i === 2;
      const isTube = f === 1 && i === 3;
      const mat = isTv ? tv : isTube ? tube : glassFor(kinds[n % kinds.length]);
      n++;
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.1, h - 0.1), mat);
      glass.position.set(bx, fy, z + 0.07);
      group.add(glass);
      //the teal frame: sides, head and sill, the meeting rail across the middle and a glazing bar up the top sash
      const t = 0.12;
      teal.push(box(t, h, 0.1, bx - w / 2 + t / 2, bottom, z + 0.1));
      teal.push(box(t, h, 0.1, bx + w / 2 - t / 2, bottom, z + 0.1));
      teal.push(box(w, t, 0.1, bx, bottom + h - t, z + 0.1));
      teal.push(box(w, t, 0.1, bx, bottom, z + 0.1));
      teal.push(box(w, 0.1, 0.14, bx, fy - 0.05, z + 0.12));
      teal.push(box(0.06, h / 2, 0.1, bx, fy, z + 0.11));
      //the stone sill, proud, with grime streaking down from its ends
      stone.push(box(w + 0.4, 0.16, 0.36, bx, bottom - 0.16, z + 0.18));
      if (f === 0) {
        //first floor up: a flat stone lintel with a keystone
        stone.push(box(w + 0.5, 0.34, 0.26, bx, bottom + h + 0.05, z + 0.13));
        stoneDark.push(box(0.36, 0.5, 0.32, bx, bottom + h, z + 0.16));
      } else {
        //the top floor: a segmental arch of stone voussoirs, light and dark by turns, and a keystone
        const r = (w / 2 + 0.25) / Math.sin(0.9);
        const cy = bottom + h + 0.05 - r * Math.cos(0.9);
        const k = 9;
        for (let s = 0; s < k; s++) {
          const a = -0.9 + (1.8 * (s + 0.5)) / k;
          const v = box(0.3, 0.42, 0.26, 0, -0.21, 0);
          v.rotateZ(-a);
          v.translate(bx + Math.sin(a) * (r + 0.21), cy + Math.cos(a) * (r + 0.21), z + 0.13);
          (s === (k - 1) / 2 ? stoneDark : s % 2 ? stoneDark : stone).push(v);
        }
        //the brick filled in under the arch, over the window head
        piers.push(box(w + 0.2, 0.32, 0.06, bx, bottom + h, z + 0.03, 1));
      }
    });
  });

  //green deco tile panels with a gold emblem between the floors, in each bay
  const tileTex = canvas(128, 64, (g) => {
    g.fillStyle = '#4a8a78';
    g.fillRect(0, 0, 128, 64);
    g.strokeStyle = '#2f6a5a';
    g.lineWidth = 2;
    for (let x = 0; x <= 128; x += 16) g.strokeRect(x, 0, 16, 64);
    for (let y = 0; y <= 64; y += 16) g.strokeRect(0, y, 128, 16);
    g.strokeStyle = '#e8d8b0';
    g.lineWidth = 4;
    g.strokeRect(3, 3, 122, 58);
    //the emblem: a gold sunburst in a diamond
    g.fillStyle = '#d8a83a';
    g.beginPath();
    g.moveTo(64, 10);
    g.lineTo(84, 32);
    g.lineTo(64, 54);
    g.lineTo(44, 32);
    g.closePath();
    g.fill();
    g.strokeStyle = '#8a6420';
    g.lineWidth = 2;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(64, 32);
      g.lineTo(64 + Math.cos(a) * 12, 32 + Math.sin(a) * 12);
      g.stroke();
    }
  });
  const spandrelY = (F.floors[0] + F.winH / 2 + F.floors[1] - F.winH / 2) / 2;
  for (const bx of F.bays) tile.push(box(F.winW + 0.2, 0.62, 0.08, bx, spandrelY - 0.31, z + 0.04));

  //the cornice: a frieze, dentils under a projecting stone shelf on scrolled brackets, a sheet-metal crown, and the
  //parapet over it with a stone panel in the middle dated 1924
  const T = F.top;
  stone.push(box(F.x1 - F.x0 + 0.6, 0.5, 0.3, 0, T, z + 0.15));
  for (let x = F.x0 + 0.2; x < F.x1; x += 0.36) stone.push(box(0.18, 0.18, 0.18, x, T + 0.5, z + 0.36));
  for (let x = F.x0 + 0.6; x <= F.x1; x += 2) {
    const b = box(0.28, 0.6, 0.6, x, T + 0.5, z + 0.3);
    stoneDark.push(b);
  }
  metal.push(box(F.x1 - F.x0 + 1.4, 0.3, 1.1, 0, T + 1.1, z + 0.55));
  metal.push(box(F.x1 - F.x0 + 1.6, 0.14, 1.25, 0, T + 1.4, z + 0.62));
  piers.push(box(F.x1 - F.x0, 1.1, 0.4, 0, T + 1.54, z + 0.2, 1));
  stone.push(box(F.x1 - F.x0 + 0.2, 0.18, 0.5, 0, T + 2.64, z + 0.22));
  stone.push(box(4.2, 1.5, 0.3, 0, T + 1.54, z + 0.42));
  stoneDark.push(box(4.6, 0.25, 0.4, 0, T + 3.04, z + 0.42));
  const date = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 1.0),
    toon({
      transparent: true,
      map: canvas(256, 72, (g) => {
        g.fillStyle = '#6a6458';
        g.font = 'bold 52px "Bangers", "Arial Black", sans-serif';
        g.textAlign = 'center';
        g.fillText('19  24', 128, 56);
        g.strokeStyle = '#6a6458';
        g.lineWidth = 3;
        g.strokeRect(6, 6, 244, 60);
      }),
    }),
  );
  date.position.set(0, T + 2.3, z + 0.58);
  group.add(date);

  //a fire escape over the right bays: a landing at each floor, railings, a ladder between, the drop ladder hung up
  const fx0 = F.bays[4] - 1.6;
  const fx1 = F.bays[5] + 1.6;
  const fw = fx1 - fx0;
  const fcx = (fx0 + fx1) / 2;
  for (const fy of F.floors) {
    const floor = fy - F.winH / 2 - 0.36;
    iron.push(box(fw, 0.08, 1.3, fcx, floor, z + 0.65));
    iron.push(box(fw, 0.06, 0.06, fcx, floor + 1.05, z + 1.28)); // top rail
    iron.push(box(fw, 0.05, 0.05, fcx, floor + 0.5, z + 1.28));
    for (let x = fx0; x <= fx1 + 0.01; x += 0.5) iron.push(box(0.04, 1.05, 0.04, x, floor, z + 1.28));
    for (const ex of [fx0, fx1]) {
      iron.push(box(0.05, 0.05, 1.3, ex, floor + 1.05, z + 0.65));
      iron.push(box(0.05, 1.05, 0.05, ex, floor, z + 0.65));
    }
    //brackets under the landing back to the wall
    for (const bx of [fx0 + 0.3, fx1 - 0.3]) {
      const s = box(0.06, 0.06, 1.6, 0, 0, 0);
      s.rotateX(-0.75);
      s.translate(bx, floor - 0.55, z + 0.6);
      iron.push(s);
    }
  }
  //the stair between the landings, rising across the front
  const lo = F.floors[0] - F.winH / 2 - 0.36;
  const hi = F.floors[1] - F.winH / 2 - 0.36;
  const run = box(0.08, 0.08, Math.hypot(3.4, hi - lo), 0, 0, 0);
  for (const side of [0.85, 1.25]) {
    const sg = run.clone();
    sg.rotateY(Math.PI / 2);
    sg.rotateZ(Math.atan2(hi - lo, 3.4));
    sg.translate(fcx + 0.4, (lo + hi) / 2, z + side);
    iron.push(sg);
  }
  for (let s = 1; s < 9; s++) iron.push(box(0.3, 0.04, 0.4, fcx - 1.3 + s * 0.38, lo + ((hi - lo) * s) / 9, z + 1.05));
  //the drop ladder, hung up under the lower landing
  for (const lx of [fcx - 2.6, fcx - 2.1]) iron.push(box(0.05, 2.2, 0.05, lx, lo - 2.0, z + 1.2));
  for (let r = 0; r < 8; r++) iron.push(box(0.5, 0.04, 0.04, fcx - 2.35, lo - 1.9 + r * 0.27, z + 1.2));

  //a window unit hung out of one window and a flower box under another
  metal.push(box(0.9, 0.55, 0.6, F.bays[1] + 0.3, F.floors[0] - F.winH / 2 + 0.05, z + 0.3));
  reveal.push(box(0.8, 0.4, 0.02, F.bays[1] + 0.3, F.floors[0] - F.winH / 2 + 0.12, z + 0.61)); // its grille
  const box2 = box(F.winW + 0.1, 0.3, 0.35, F.bays[3], F.floors[1] - F.winH / 2 - 0.45, z + 0.3);
  const flowers: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 7; k++) {
    const fl = new THREE.IcosahedronGeometry(0.16 + rng() * 0.06, 0);
    fl.translate(F.bays[3] - 0.9 + k * 0.3, F.floors[1] - F.winH / 2 - 0.1, z + 0.32);
    flowers.push(fl.toNonIndexed());
  }

  //grime: dark streaks running down from the sills and a darkening under the cornice, on one sheet over the wall
  const grime = canvas(512, 128, (g) => {
    const top = g.createLinearGradient(0, 0, 0, 30);
    top.addColorStop(0, 'rgba(20,10,15,0.55)');
    top.addColorStop(1, 'rgba(20,10,15,0)');
    g.fillStyle = top;
    g.fillRect(0, 0, 512, 30);
    for (let i = 0; i < 80; i++) {
      const x = rng() * 512;
      const y = rng() * 100;
      const len = 10 + rng() * 40;
      const s = g.createLinearGradient(0, y, 0, y + len);
      s.addColorStop(0, 'rgba(25,15,20,0.35)');
      s.addColorStop(1, 'rgba(25,15,20,0)');
      g.fillStyle = s;
      g.fillRect(x, y, 1 + rng() * 2.5, len);
    }
  });
  const dirt = new THREE.Mesh(new THREE.PlaneGeometry(F.x1 - F.x0, F.top - F.belt), new THREE.MeshBasicMaterial({ map: grime, transparent: true, depthWrite: false }));
  dirt.position.set(0, (F.top + F.belt) / 2, z + 0.005);
  dirt.renderOrder = 1;
  dirt.userData.inked = true;
  group.add(dirt);

  const pierBrick = brick.clone();
  pierBrick.repeat.set(1 / 6.67, 1 / 3.65);
  pierBrick.needsUpdate = true;
  const mats: [THREE.BufferGeometry[], THREE.Material, boolean][] = [
    [stone, toon({ color: 0xd8d0c0 }), true],
    [stoneDark, toon({ color: 0xb8ae9c }), true],
    [piers, toon({ color: 0xffffff, map: pierBrick }), true],
    [teal, toon({ color: 0x4ab0b0 }), false],
    [iron, toon({ color: 0x23202a }), false],
    [tile, toon({ color: 0xffffff, map: tileTex }), false],
    [reveal, toon({ color: 0x14121c }), false],
    [metal, toon({ color: 0x8a8a96 }), true],
    [[box2], toon({ color: 0x6a3a28 }), true],
    [flowers, toon({ color: 0xe84a6a }), false],
  ];
  for (const [geos, mat, ink] of mats) {
    if (!geos.length) continue;
    const mesh = new THREE.Mesh(mergeGeometries(geos)!, mat);
    if (!ink) mesh.userData.inked = true;
    group.add(mesh);
  }
  inkify(group);
  return { group, tv, tube };
}
