// The sky beats (src/gen/sky-beats.ts), drawn as the city's high-up things: rooftop decks with their AC units, a
// billboard with its catwalk rail along the top, a water tower on stilts, scaffold decks on tube frames, and a
// tower crane's boom. Each stands on legs down to the hill behind the lane. Plain shared materials, so the floor's
// batching (batch.ts) merges them into a handful of draws.
import * as THREE from 'three';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import { groundAt } from '../gen/top-route';
import { surface } from './surfaces';

const X = (px: number) => px / TILE;
const LEG_Z = -1.3; // the legs stand behind the lane, as the top route's rooftops' do

const ADS: [string, string, string][] = [
  ['#e83a5a', '#ffe14a', 'GNAR COLA'],
  ['#2a6ad8', '#ffffff', 'DEEP DISH'],
  ['#1a1424', '#5fe8ff', 'SKATE OR CRY'],
  ['#ffb020', '#1a1424', 'CHI 99.1 FM'],
  ['#f2eef8', '#e83a5a', 'GOD IS GNAR'],
];
let ads: THREE.Texture | null = null;
// the billboards' faces: the ads side by side on one canvas, each board shows one (zack wrote the last two)
function adTexture(): THREE.Texture {
  if (ads) return ads;
  const c = document.createElement('canvas');
  c.width = 64 * ADS.length;
  c.height = 48;
  const g = c.getContext('2d')!;
  ADS.forEach(([bg, fg, text], i) => {
    const x = i * 64;
    g.fillStyle = bg;
    g.fillRect(x, 0, 64, 48);
    g.fillStyle = fg;
    g.fillRect(x + 4, 36, 56, 4);
    g.font = 'bold 11px sans-serif';
    g.textAlign = 'center';
    g.fillText(text, x + 32, 26);
    g.fillStyle = '#1a1424';
    g.fillRect(x, 0, 64, 2);
    g.fillRect(x, 46, 64, 2);
  });
  ads = new THREE.CanvasTexture(c);
  ads.magFilter = THREE.NearestFilter;
  ads.colorSpace = THREE.SRGBColorSpace;
  return ads;
}

export function buildSkyBeats(level: Level): THREE.Group {
  const g = new THREE.Group();
  const sky = level.surfaces.filter((s) => s.sky);
  const cranes = level.rails.filter((r) => r.sky);
  if (!sky.length && !cranes.length) return g;
  const Y = (py: number) => (level.streetY - py) / TILE;
  const foot = (px: number) => {
    const gy = groundAt(level, px);
    return gy === undefined ? -8 : Y(gy) - 0.3;
  };
  const steel = new THREE.MeshLambertMaterial({ color: 0x55596a });
  const roof = surface('roof', 0x48424f);
  const parapet = surface('concrete', 0x8c8794);
  const ac = new THREE.MeshLambertMaterial({ color: 0xc8ccd4 });
  const wood = surface('planks', 0x9a6a40);
  const yellow = new THREE.MeshLambertMaterial({ color: 0xe8b020 });
  const board = new THREE.MeshLambertMaterial({ map: adTexture() });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    g.add(b);
    return b;
  };
  const leg = (x: number, top: number, z = LEG_Z, r = 0.11, m: THREE.Material = steel) => {
    const f = foot(x * TILE);
    if (top - f > 0.2) box(r * 2, top - f, r * 2, x, (top + f) / 2, z, m);
  };
  sky.forEach((s, i) => {
    const x0 = X(s.x0);
    const x1 = X(s.x1);
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    const y = Y(s.y);
    if (s.sky === 'roofs') {
      //a roof deck with a parapet along its back, an AC unit or two, on steel legs
      box(w, 0.4, 2.6, cx, y - 0.2, -0.2, roof);
      box(w, 0.5, 0.2, cx, y + 0.25, -1.4, parapet);
      for (let ax = x0 + 1.2; ax < x1 - 1; ax += 3.5) box(1, 0.7, 0.8, ax, y + 0.35, -1.0, ac);
      for (let lx = x0 + 0.6; lx < x1; lx += 3.5) leg(lx, y - 0.4);
    } else if (s.sky === 'billboard') {
      //the board under its catwalk rail, ad side out, on two posts
      const face = box(w, 2.2, 0.15, cx, y - 1.25, -0.6, board);
      const uv = face.geometry.getAttribute('uv') as THREE.BufferAttribute;
      const k = i % ADS.length;
      for (let v = 0; v < uv.count; v++) uv.setX(v, (k + uv.getX(v)) / ADS.length);
      box(w, 0.08, 0.08, cx, y - 0.04, 0, steel); // the rail you grind
      for (let lx = x0 + 0.4; lx < x1; lx += Math.max(1, w - 0.8)) box(0.06, 0.1, 0.6, lx, y - 0.1, -0.3, steel);
      for (const lx of [x0 + w * 0.25, x0 + w * 0.75]) leg(lx, y - 2.35, -0.6, 0.16);
    } else if (s.sky === 'tower') {
      //a wooden water tower: its lid is what you land on, a cone roof over the back of it
      const r = w / 2;
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r, 2, 12), wood);
      tank.position.set(cx, y - 1, -0.6);
      g.add(tank);
      for (const dy of [-0.4, -1.6]) box(w + 0.05, 0.1, 0.2, cx, y + dy, 0.35, steel); // its hoops, seen from the front
      for (const [dx, dz] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, -1.2], [0.6, -1.2]]) leg(cx + dx * r, y - 2, -0.6 + dz + 0.4, 0.09, wood);
    } else if (s.sky === 'scaffold') {
      //planks on a tube frame
      box(w, 0.18, 1.6, cx, y - 0.09, -0.3, wood);
      for (const lx of [x0 + 0.15, x1 - 0.15]) for (const z of [0.3, -0.9]) leg(lx, y - 0.18, z, 0.05);
      box(w, 0.05, 0.05, cx, y + 0.6, -0.9, steel); // the guard rail at the back
    }
  });
  //a tower crane's boom along each crane grind, its mast down to the hill at the high end
  for (const r of cranes) {
    for (let k = 1; k < r.xs.length; k++) {
      const [ax, ay, bx, by] = [X(r.xs[k - 1]), Y(r.ys[k - 1]), X(r.xs[k]), Y(r.ys[k])];
      const len = Math.hypot(bx - ax, by - ay);
      const seg = box(len, 0.4, 0.4, (ax + bx) / 2, (ay + by) / 2 - 0.22, -0.1, yellow);
      seg.rotation.z = Math.atan2(by - ay, bx - ax);
    }
    const mx = X(r.xs[0]) + 0.5;
    const my = Y(r.ys[0]);
    leg(mx, my - 0.4, -0.6, 0.3, yellow);
    box(1.2, 1, 1, mx, my + 0.3, -0.9, yellow); // the cab
    box(2, 0.5, 0.8, mx - 1.4, my - 0.1, -0.6, steel); // the counterweight
  }
  return g;
}
