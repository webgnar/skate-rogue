// Chinatown's look (zack, 2026-10-30, from his photos of the Kowloon Walled City: /mnt/project-files/chinatown/refs).
// Over a Chinatown block of hill (Level.chinatown) the painted SF row houses give way to tenements stacked storey on
// storey in faded blue, red, cream and teal, caged windows and air-con boxes all over them, washing out on the
// balconies, shop signs crowding the lower floors, red lanterns, rooftop water tanks and shacks, and cables sagging in
// bundles along the street and across to the towers further up. All of it goes in one mesh on its own pixel atlas, as
// the hillside's own houses do (hillside.ts builds it, with its own ground heights).
import * as THREE from 'three';
import { makeRng, randInt } from '../gen/rng';
import { pixelTexture } from './textures';
import type { Mesher } from './hillside';

const PX = 16; // atlas pixels per tile
const AW = 512;
const AH = 256;
const STOREY = 2; // tiles

type Rect = [number, number, number, number];

// the tenements' paint: body, a darker band, a lighter trim
const PAINTS: [string, string, string][] = [
  ['#7fa9bf', '#5e8499', '#c8dbe4'], // faded blue
  ['#b8503e', '#8e3a2e', '#e0b8a8'], // brick red
  ['#d9cdb0', '#b0a488', '#f2ead6'], // cream
  ['#6fa298', '#507c74', '#bcd8d0'], // teal
  ['#a8a49a', '#84807a', '#d6d2c8'], // grey concrete
  ['#c99a86', '#a47766', '#ecd2c4'], // washed pink
];
const VARIANTS = 3; // window styles per paint: caged, balcony with washing, air-con
const SIGNS_V = 12;
const SIGNS_H = 12;

const FAC = { w: 4 * PX, h: STOREY * PX };
const facade = (paint: number, v: number): Rect => {
  const i = paint * VARIANTS + v;
  return [(i % 8) * FAC.w, Math.floor(i / 8) * FAC.h, FAC.w, FAC.h];
};
const SIGN_Y = 3 * FAC.h; // 96
const signV = (i: number): Rect => [i * PX, SIGN_Y, PX, 3 * PX];
const signH = (i: number): Rect => [(i % 10) * 3 * PX, SIGN_Y + 3 * PX + Math.floor(i / 10) * PX, 3 * PX, PX];
const SW_Y = 12 * PX; // 192: the swatch row
const SWATCH = {
  side: (paint: number): Rect => [paint * PX + 2, SW_Y + 2, PX - 4, PX - 4],
  tar: [6 * PX + 2, SW_Y + 2, PX - 4, PX - 4] as Rect,
  rust: [7 * PX + 2, SW_Y + 2, PX - 4, PX - 4] as Rect,
  tank: [8 * PX, SW_Y, PX, PX] as Rect,
  ac: [9 * PX, SW_Y, PX, PX] as Rect,
  wash: (i: number): Rect => [(10 + (i % 5)) * PX + 2, SW_Y + 2, PX - 4, PX - 4],
  lantern: [15 * PX, SW_Y, PX, PX] as Rect,
  gold: [16 * PX + 3, SW_Y + 3, PX - 6, PX - 6] as Rect,
  dark: [17 * PX + 3, SW_Y + 3, PX - 6, PX - 6] as Rect,
  grime: [18 * PX, SW_Y, 2 * PX, 2 * PX] as Rect,
};
const WASH = ['#e84a4a', '#f2f2ea', '#4a8ae8', '#f2c84a', '#7ac06a'];
const SIGN_COLORS: [string, string][] = [
  ['#c8202a', '#f6d84a'], // red board, gold characters
  ['#f4f0e4', '#c8202a'], // white, red
  ['#f6d84a', '#1a1a1a'], // yellow, black
  ['#1a1a20', '#f6d84a'], // black, gold
  ['#2a5ab8', '#f4f0e4'], // blue, white
  ['#2a8a5a', '#f4f0e4'], // green, white
  ['#f4f0e4', '#1a1a1a'], // white, black
  ['#e86a2a', '#f4f0e4'], // orange, white
];

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `#${((c(16) << 16) | (c(8) << 8) | c(0)).toString(16).padStart(6, '0')}`;
}

// a made-up character in a cell: a radical down the left and a stack of strokes beside it, or a boxed one, on a 7 x 7
// grid, the way hanzi read at a glance on a sign across the street
function glyph(g: CanvasRenderingContext2D, x: number, y: number, s: number, rng: () => number): void {
  const u = s / 7;
  const bar = (gx: number, gy: number, w: number, h: number) => g.fillRect(Math.round(x + gx * u), Math.round(y + gy * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)));
  const kind = rng();
  if (kind < 0.45) {
    //a radical: a stroke down with a tick or two, then the right side's strokes
    bar(1, 0.5, 0.8, 6);
    bar(0, 2, 2.4, 0.8);
    if (rng() < 0.5) bar(0, 4.5, 2, 0.8);
    bar(3, 0.5, 4, 0.8);
    bar(3.2, 3, 3.6, 0.8);
    bar(3, 5.7, 4, 0.8);
    bar(4.6, 0.5, 0.8, 6);
  } else if (kind < 0.75) {
    //a roof over a box over legs
    bar(0.5, 0.5, 6, 0.8);
    bar(3.1, 0, 0.8, 1.3);
    bar(1.5, 2.2, 4, 0.8);
    bar(1.5, 2.2, 0.8, 2.5);
    bar(4.7, 2.2, 0.8, 2.5);
    bar(1.5, 4, 4, 0.8);
    bar(1, 5.8, 1.5, 0.8);
    bar(4.5, 5.8, 1.5, 0.8);
  } else {
    //stacked bars through a stroke down the middle
    bar(0.5, 1, 6, 0.8);
    bar(1.2, 3, 4.6, 0.8);
    bar(0.3, 5.4, 6.4, 0.8);
    bar(3.1, 0, 0.8, 6.6);
    if (rng() < 0.5) bar(1, 4.2, 0.8, 1.2);
    if (rng() < 0.5) bar(5.2, 4.2, 0.8, 1.2);
  }
}

function paintFacade(g: CanvasRenderingContext2D, glow: CanvasRenderingContext2D, [x, y, w, h]: Rect, [body, band, trim]: [string, string, string], v: number, rng: () => number): void {
  g.fillStyle = body;
  g.fillRect(x, y, w, h);
  //grime: drips down from each sill, and a darker floor slab along the bottom
  g.fillStyle = shade(body, 0.86);
  for (let k = 0; k < 10; k++) g.fillRect(x + randInt(rng, w), y + randInt(rng, h / 2), 1, 3 + randInt(rng, 8));
  g.fillStyle = band;
  g.fillRect(x, y + h - 3, w, 3);
  //two windows a storey, each with its frame
  for (const wx of [x + 6, x + 36]) {
    const wy = y + 8;
    g.fillStyle = trim;
    g.fillRect(wx - 1, wy - 1, 22, 16);
    const lit = rng() < 0.3; // a lit window now and then, glowing at night
    g.fillStyle = lit ? '#e8d88a' : '#28344a';
    g.fillRect(wx, wy, 20, 14);
    if (lit) {
      glow.fillStyle = '#c8a860';
      glow.fillRect(wx, wy, 20, 14);
    }
    g.fillStyle = shade(trim, 0.8);
    g.fillRect(wx + 9, wy, 2, 14);
    if (v === 0) {
      //caged: rusty bars over it, out from the wall
      g.fillStyle = '#5a4034';
      for (let bx = wx; bx <= wx + 20; bx += 3) g.fillRect(bx, wy - 2, 1, 18);
      g.fillRect(wx - 1, wy - 2, 22, 1);
      g.fillRect(wx - 1, wy + 15, 22, 1);
    } else if (v === 1) {
      //a balcony rail, washing hung over it
      g.fillStyle = '#d8d8d0';
      g.fillRect(wx - 2, wy + 9, 24, 1);
      for (let bx = wx - 2; bx <= wx + 22; bx += 3) g.fillRect(bx, wy + 9, 1, 6);
      for (let k = 0; k < 4; k++) {
        g.fillStyle = WASH[randInt(rng, WASH.length)];
        g.fillRect(wx + randInt(rng, 18), wy + 3, 3, 5 + randInt(rng, 3));
      }
    } else {
      //an air-con box under the sill, dripping
      g.fillStyle = '#e4e2da';
      g.fillRect(wx + 3, wy + 14, 10, 6);
      g.fillStyle = '#9a988e';
      for (let k = 0; k < 3; k++) g.fillRect(wx + 4, wy + 15 + 2 * k, 8, 1);
      g.fillStyle = shade(body, 0.75);
      g.fillRect(wx + 7, wy + 20, 1, 6);
    }
  }
}

function paintSign(g: CanvasRenderingContext2D, [x, y, w, h]: Rect, [bg, ink]: [string, string], rng: () => number): void {
  g.fillStyle = shade(bg, 0.6);
  g.fillRect(x, y, w, h);
  g.fillStyle = bg;
  g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = ink;
  const s = Math.min(w, h) - 4;
  if (h > w) for (let gy = y + 2; gy + s <= y + h - 1; gy += s + 1) glyph(g, x + 2, gy, s, rng);
  else for (let gx = x + 2; gx + s <= x + w - 1; gx += s + 1) glyph(g, gx, y + 2, s, rng);
}

let atlas: THREE.Texture | null = null;
let glowMap: THREE.Texture | null = null;

// what glows at night, on the atlas: the signs and lanterns in their own colours, the lit windows warm
export function chinatownGlowMap(): THREE.Texture {
  chinatownAtlas();
  return glowMap!;
}

export function chinatownAtlas(): THREE.Texture {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = AW;
  c.height = AH;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const gc = document.createElement('canvas');
  gc.width = AW;
  gc.height = AH;
  const glow = gc.getContext('2d')!;
  glow.imageSmoothingEnabled = false;
  glow.fillStyle = '#000000';
  glow.fillRect(0, 0, AW, AH);
  const rng = makeRng(8848);
  PAINTS.forEach((p, i) => {
    for (let v = 0; v < VARIANTS; v++) paintFacade(g, glow, facade(i, v), p, v, rng);
    //its plain side wall
    const [sx, sy] = SWATCH.side(i);
    g.fillStyle = shade(p[0], 0.9);
    g.fillRect(sx - 2, sy - 2, PX, PX);
  });
  for (let i = 0; i < SIGNS_V; i++) paintSign(g, signV(i), SIGN_COLORS[i % SIGN_COLORS.length], rng);
  for (let i = 0; i < SIGNS_H; i++) paintSign(g, signH(i), SIGN_COLORS[(i * 3 + 1) % SIGN_COLORS.length], rng);
  const fill = (r: Rect, color: string, pad = 0) => {
    g.fillStyle = color;
    g.fillRect(r[0] - pad, r[1] - pad, r[2] + 2 * pad, r[3] + 2 * pad);
  };
  fill(SWATCH.tar, '#4a4650', 2);
  fill(SWATCH.rust, '#8a5a3e', 2);
  //a water tank's staves, an air-con's grille, a lantern's ribs
  fill(SWATCH.tank, '#9aa0a4');
  g.fillStyle = '#7a8084';
  for (let x = SWATCH.tank[0] + 2; x < SWATCH.tank[0] + PX; x += 4) g.fillRect(x, SW_Y, 1, PX);
  fill(SWATCH.ac, '#e4e2da');
  g.fillStyle = '#9a988e';
  for (let y = SW_Y + 3; y < SW_Y + PX - 2; y += 3) g.fillRect(SWATCH.ac[0] + 2, y, PX - 4, 1);
  WASH.forEach((w, i) => fill(SWATCH.wash(i), w, 2));
  fill(SWATCH.lantern, '#d42a2a');
  g.fillStyle = '#a01818';
  for (let x = SWATCH.lantern[0] + 3; x < SWATCH.lantern[0] + PX; x += 5) g.fillRect(x, SW_Y, 1, PX);
  fill(SWATCH.gold, '#f2c84a', 3);
  fill(SWATCH.dark, '#22202a', 3);
  //stained concrete: the tenements' feet and the rooftop shacks
  fill(SWATCH.grime, '#7a766e');
  for (let k = 0; k < 60; k++) {
    g.fillStyle = k % 2 ? '#6a665e' : '#8a867c';
    g.fillRect(SWATCH.grime[0] + randInt(rng, 2 * PX), SW_Y + randInt(rng, 2 * PX), 1 + randInt(rng, 2), 2 + randInt(rng, 5));
  }
  //the signs' boards and the lanterns glow in their own colours
  const copy = ([x, y, w, h]: Rect) => glow.drawImage(c, x, y, w, h, x, y, w, h);
  copy([0, SIGN_Y, AW, 4 * PX + PX]);
  copy(SWATCH.lantern);
  copy(SWATCH.gold);
  atlas = pixelTexture(c);
  glowMap = pixelTexture(gc);
  return atlas;
}

function uv([x, y, w, h]: Rect, sub: [number, number, number, number] = [0, 0, 1, 1]): [number, number][] {
  const u0 = (x + sub[0] * w) / AW;
  const u1 = (x + sub[2] * w) / AW;
  const v0 = 1 - (y + (1 - sub[1]) * h) / AH;
  const v1 = 1 - (y + (1 - sub[3]) * h) / AH;
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
}

type V3 = [number, number, number];

// a solid box on the atlas, every face the same rect
function block(m: Mesher, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, r: Rect, back = false): void {
  const f: ['ct', [number, number][]] = ['ct', uv(r)];
  m.box(x0, x1, y0, y1, y1, z0, z1, { top: f, front: f, left: f, right: f, ...(back ? { back: f } : {}) });
}

// a flat panel facing the camera
function panel(m: Mesher, x0: number, x1: number, y0: number, y1: number, z: number, r: Rect, sub?: [number, number, number, number]): void {
  m.quad('ct', [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], uv(r, sub));
}

export interface Tenement {
  x0: number;
  x1: number;
  base: number; // tiles: its ground floor's height
  foot: number; // its foundation's foot
  z0: number; // back
  z1: number; // its face, toward the camera
  storeys: number;
  shops: boolean; // shop signs and lanterns on its lower floors (the row along the street)
}

// a tenement: storeys of facade on its face (each storey a paint and window style of its own now and then, the way
// the Walled City's blocks were built onto), air-con boxes and washing poles out from the face, rooftop clutter
export function tenement(m: Mesher, rng: () => number, o: Tenement): void {
  const paint = randInt(rng, PAINTS.length);
  const top = o.base + o.storeys * STOREY;
  const w = o.x1 - o.x0;
  //its feet: stained concrete down the hill
  if (o.base > o.foot) block(m, o.x0, o.x1, o.foot, o.base, o.z0, o.z1, SWATCH.grime);
  //the side walls and the roof
  const side = uv(SWATCH.side(paint));
  m.box(o.x0, o.x1, o.base, top, top, o.z0, o.z1, { top: ['ct', uv(SWATCH.tar)], left: ['ct', side], right: ['ct', side] });
  //the face, storey by storey, the facade repeated along it every 4 tiles
  let p = paint;
  for (let s = 0; s < o.storeys; s++) {
    if (rng() < 0.25) p = randInt(rng, PAINTS.length);
    const v = randInt(rng, VARIANTS);
    const y0 = o.base + s * STOREY;
    //some storeys stick out over the one below: an add-on built on
    const out = s > 0 && rng() < 0.3 ? 0.25 + rng() * 0.3 : 0;
    for (let x = o.x0; x < o.x1 - 0.01; x += 4) {
      const x1 = Math.min(o.x1, x + 4);
      panel(m, x, x1, y0, y0 + STOREY, o.z1 + out, facade(p, v), [0, 0, (x1 - x) / 4, 1]);
    }
    if (out) {
      const sideP = uv(SWATCH.side(p));
      m.box(o.x0, o.x1, y0, y0 + STOREY, y0 + STOREY, o.z1, o.z1 + out, { left: ['ct', sideP], right: ['ct', sideP] });
      m.quad('ct', [o.x0, y0, o.z1], [o.x1, y0, o.z1], [o.x1, y0, o.z1 + out], [o.x0, y0, o.z1 + out], uv(SWATCH.dark));
    }
    //air-con boxes out from the wall
    const z = o.z1 + out;
    for (let x = o.x0 + 0.4; x < o.x1 - 0.8; x += 1.4 + rng() * 1.6) {
      if (rng() < 0.45) block(m, x, x + 0.6, y0 + 0.25, y0 + 0.65, z, z + 0.35, SWATCH.ac);
    }
    //washing on a pole out from a window
    if (rng() < 0.3) {
      const wx = o.x0 + rng() * (w - 1.6);
      const wy = y0 + 1.3;
      block(m, wx, wx + 1.6, wy, wy + 0.05, z, z + 0.6, SWATCH.rust);
      for (let k = 0; k < 3; k++) panel(m, wx + 0.1 + k * 0.5, wx + 0.45 + k * 0.5, wy - 0.5 - rng() * 0.3, wy, z + 0.5, SWATCH.wash(randInt(rng, WASH.length)));
    }
  }
  //on the roof: a water tank, a shack, an antenna
  if (rng() < 0.6) {
    const tx = o.x0 + 0.3 + rng() * Math.max(0, w - 1.5);
    block(m, tx, tx + 0.9, top + 0.5, top + 1.5, o.z0 + 0.5, o.z0 + 1.4, SWATCH.tank);
    for (const lx of [tx + 0.1, tx + 0.7]) block(m, lx, lx + 0.1, top, top + 0.5, o.z0 + 0.8, o.z0 + 0.9, SWATCH.rust);
  }
  if (rng() < 0.5) {
    const sx = o.x0 + rng() * Math.max(0, w - 1.8);
    block(m, sx, sx + 1.8, top, top + 1.1, o.z0 + 0.2, Math.min(o.z1 - 0.2, o.z0 + 2), SWATCH.grime);
    block(m, sx - 0.1, sx + 1.9, top + 1.1, top + 1.18, o.z0 + 0.1, Math.min(o.z1 - 0.1, o.z0 + 2.1), SWATCH.rust);
  }
  //(not on the rooftops in front, where it would stand across the lane)
  if (rng() < 0.5 && o.z1 < 0) block(m, o.x1 - 0.6, o.x1 - 0.52, top, top + 2 + rng() * 1.5, o.z1 - 0.8, o.z1 - 0.72, SWATCH.dark);
  //the street row: shop signs crowding the first two floors, out over the sidewalk, and red lanterns
  if (o.shops) {
    for (let x = o.x0 + 0.2; x < o.x1 - 0.6; ) {
      const z = o.z1 + 0.3 + rng() * 0.9;
      if (rng() < 0.5) {
        const y0 = o.base + 1.2 + rng() * 2.2;
        panel(m, x, x + 0.8, y0, y0 + 2.4, z, signV(randInt(rng, SIGNS_V)));
        block(m, x + 0.35, x + 0.45, y0 + 2.4, y0 + 2.5, o.z1, z, SWATCH.rust);
        x += 0.9 + rng() * 0.8;
      } else {
        const y0 = o.base + 2 + rng() * 2;
        panel(m, x, x + 2.4, y0, y0 + 0.8, z, signH(randInt(rng, SIGNS_H)));
        block(m, x + 1.15, x + 1.25, y0 + 0.8, y0 + 0.9, o.z1, z, SWATCH.rust);
        x += 2.5 + rng() * 0.8;
      }
    }
    for (let x = o.x0 + 0.6; x < o.x1 - 0.4; x += 1.8 + rng() * 2) if (rng() < 0.5) lantern(m, x, o.base + 2.6 + rng() * 0.4, o.z1 + 0.5);
  }
}

// a red paper lantern on its cord, gold caps
export function lantern(m: Mesher, x: number, y: number, z: number): void {
  block(m, x - 0.2, x + 0.2, y - 0.45, y, z - 0.2, z + 0.2, SWATCH.lantern, true);
  block(m, x - 0.12, x + 0.12, y, y + 0.08, z - 0.12, z + 0.12, SWATCH.gold);
  block(m, x - 0.12, x + 0.12, y - 0.53, y - 0.45, z - 0.12, z + 0.12, SWATCH.gold);
}

// a sagging bundle of cables from a to b, `n` strands
export function cables(m: Mesher, a: V3, b: V3, drop: number, n: number, rng: () => number): void {
  for (let s = 0; s < n; s++) {
    const off: V3 = [0, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4];
    const d = drop * (0.7 + rng() * 0.6);
    const seg = 8;
    const hw = 0.03;
    for (let k = 0; k < seg; k++) {
      const pt = (i: number): V3 => {
        const u = i / seg;
        return [a[0] + (b[0] - a[0]) * u + off[0], a[1] + (b[1] - a[1]) * u - d * 4 * u * (1 - u) + off[1], a[2] + (b[2] - a[2]) * u + off[2]];
      };
      const [p0, p1] = [pt(k), pt(k + 1)];
      m.quad('wire', [p0[0], p0[1] - hw, p0[2]], [p1[0], p1[1] - hw, p1[2]], [p1[0], p1[1] + hw, p1[2]], [p0[0], p0[1] + hw, p0[2]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  }
}

// a deterministic stream for a block's art
export const chinatownRng = (seed: number, floor: number) => makeRng(seed * 71 + floor * 389);

// how much Chinatown's signs, lanterns and windows glow at the mood's neon (0 day, 1 night)
export const chinatownGlow = (neon: number) => 0.05 + 1.6 * neon;
