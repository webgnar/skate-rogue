// Chicago's San Francisco hillside and the foreground in front of the lane (docs/level-design-chicago.md).
//
// The hill (a level with `hills`): every piece of the descent is solid ground. Blocks of street fall away with their
// sidewalks following the slope, public stairways cut down between them, retaining walls drop to the next street,
// cross streets run back into the city at each flat crest, and painted row houses step down the hill behind.
//
// The foreground (every Chicago floor): the near sidewalk with a low wall along it, then two rows of row houses
// below the lane, stepping down toward the camera, so the bottom of the screen is always rooftops and facades
// instead of empty sky. They stay under the line from the camera to the skater's feet, so nothing hides the lane.
//
// Draw budget: the whole lot is four meshes (road, sidewalk, concrete, and the houses off one painted atlas), so
// a floor costs four draws plus its share of the kit's one merged outline.
import * as THREE from 'three';
import { run, sliceDone } from './slice';
import { TOP } from '../gen/top-route';
import { TILE } from '../physics/constants';
import { PIT, SEWER_ROOF, hillGround, inHill, type Level, type Surface } from '../physics/level';
import { makeRng, randInt } from '../gen/rng';
import { pixelTexture } from './textures';
import { surfaceTexture } from './surfaces';
import { TUNNEL, mouths } from '../traffic/tunnel';
import { plantBush, plantTree, treeWarm } from './trees';
import { cables, chinatownAtlas, chinatownGlowMap, chinatownRng, tenement } from './chinatown-art';

const CABLE_Z = -1.15; // the cable car's lane (cable-view.ts CABLE.z)

export const HILLSIDE = {
  bottom: -18, // how far down the ground and the houses' foundations go
  road: [-2.0, 2.5], // z: the road, the skate lane (z = 0.25) down its middle
  backWalk: -3.6, // z: the back sidewalk, from here to the road
  nearWalk: 4.0, // z: the near sidewalk, from the road to here
  curb: 0.12,
  wall: 0.35, // the low wall along the near sidewalk (under the camera's line to the lane at that distance)
  storey: 2, // tiles
  rowA: [4.35, 7.8, 1.1], // the first row of houses in front: z from, z to, roofs this far under the lane
  rowB: [8.4, 14.6, 3.9],
  backRow: [-3.6, -8.6], // houses behind the back sidewalk
  upRow: [-10.5, -15.5, 2.6], // a second row further up the hill, standing this much higher
  crossW: 3.2, // a cross street's width
  crossFar: -28, // how far back it runs, to the back street it meets in a T
  tee: { arm: 8, walk: 0.7, depth: 5 }, // the back street: tiles each way past the cross street, its sidewalk, the houses facing down it
  stepGrade: 0.3, // a block this steep has steps for its back sidewalk
  pole: { z: -3.25, height: 7.5, every: [9, 13], wire: 0.07 }, // power poles along the back sidewalk, tiles
};

// ---------------------------------------------------------------------------------------------- the painted atlas

const PX = 16; // atlas pixels per tile
const AW = 512;
const AH = 256;
const FACADE = { w: 4 * PX, h: 6 * PX }; // three storeys

// the city's houses, from zack's photos: painted-lady Victorians with bay windows, white stucco with red tile roofs,
// cedar shingle, and flat-roofed modern stucco with balconies. Body, trim, accent (door and garage).
type Style = 'victorian' | 'stucco' | 'shingle' | 'modern';
const HOUSES: { style: Style; paint: [string, string, string] }[] = [
  { style: 'victorian', paint: ['#e8c86a', '#fff6e0', '#5a7a9a'] },
  { style: 'victorian', paint: ['#9fd0c0', '#ffffff', '#a04050'] },
  { style: 'victorian', paint: ['#b8a0d8', '#ffffff', '#4a3a6a'] },
  { style: 'victorian', paint: ['#f0a088', '#fff4ea', '#3a5a7a'] },
  { style: 'victorian', paint: ['#8ab8e0', '#ffffff', '#c06030'] },
  { style: 'victorian', paint: ['#f2e6cf', '#7a5a40', '#2a4a3a'] },
  { style: 'victorian', paint: ['#d86a6a', '#fff0e0', '#304050'] },
  { style: 'victorian', paint: ['#b0a08c', '#f4efe6', '#6a3a2a'] },
  { style: 'stucco', paint: ['#f4f0e8', '#2a2228', '#8a5a3a'] },
  { style: 'stucco', paint: ['#f0dcc4', '#fff8ee', '#6a3a2a'] },
  { style: 'stucco', paint: ['#ecc8bc', '#fff6ee', '#3a4a5a'] },
  { style: 'shingle', paint: ['#8a5434', '#f4efe6', '#c87a3a'] },
  { style: 'shingle', paint: ['#6e4a36', '#f4efe6', '#a04030'] },
  { style: 'modern', paint: ['#d8d2c4', '#ffffff', '#5a5a64'] },
  { style: 'modern', paint: ['#c4c8cc', '#f6f6f6', '#3a4a5a'] },
  { style: 'modern', paint: ['#ece6da', '#ffffff', '#7a6a5a'] },
];

type Rect = [number, number, number, number]; // px x, y, w, h in the atlas

const SY = FACADE.h + PX; // the swatch row under the first row of facades
const SWATCH = {
  siding: (i: number): Rect => [i * PX, FACADE.h, PX, PX],
  roof: (i: number): Rect => [[0, 6, 8][i % 3] * PX, SY, 2 * PX, PX],
  trim: [2 * PX + 4, SY + 4, 8, 8] as Rect,
  brick: [3 * PX, SY, 2 * PX, PX] as Rect,
  dark: [5 * PX + 4, SY + 4, 8, 8] as Rect,
  tile: [10 * PX, SY, 2 * PX, PX] as Rect,
  leaf: [12 * PX, SY, PX, PX] as Rect,
  bloom: [13 * PX, SY, PX, PX] as Rect,
  cypress: [14 * PX, SY, PX, PX] as Rect,
  pole: [15 * PX + 4, SY + 2, 8, 12] as Rect,
  grey: [16 * PX + 4, SY + 4, 8, 8] as Rect,
};

const facadeRect = (i: number): Rect => [(i % 8) * FACADE.w, i < 8 ? 0 : 128, FACADE.w, FACADE.h];

let atlas: THREE.Texture | null = null;

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex).multiplyScalar(k);
  return `#${c.getHexString()}`;
}

// a window pane: frame, glass, the sky in it
function pane(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: string): void {
  g.fillStyle = frame;
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = '#2f4468';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#6c8cc0';
  g.fillRect(x + 1, y + 1, 2, Math.min(7, h - 2));
  g.fillRect(x + 3, y + 1, 1, Math.min(4, h - 2));
}

// an arched window or door: its frame, then the glass (or `fill`) inside
function arch(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, frame: string, fill = '#2f4468'): void {
  const r = w / 2;
  g.fillStyle = frame;
  g.fillRect(x - 1, y + r, w + 2, h - r + 1);
  g.beginPath();
  g.arc(x + r, y + r + 0.5, r + 1, Math.PI, 0);
  g.fill();
  g.fillStyle = fill;
  g.fillRect(x, y + r, w, h - r);
  g.beginPath();
  g.arc(x + r, y + r + 0.5, r, Math.PI, 0);
  g.fill();
  if (fill === '#2f4468') {
    g.fillStyle = '#6c8cc0';
    g.fillRect(x + 2, y + r - 1, 2, 6);
  }
}

// a garage door: frame and panels
function garage(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string, planks: boolean): void {
  g.fillStyle = '#1a1424';
  g.fillRect(x - 1, y - 1, w + 2, h + 1);
  g.fillStyle = colour;
  g.fillRect(x, y, w, h);
  g.fillStyle = shade(colour, 0.74);
  if (planks) for (let px = x + 3; px < x + w; px += 4) g.fillRect(px, y, 1, h);
  else for (let py = y + 5; py < y + h; py += 6) g.fillRect(x, py, w, 1);
}

// a front door with its knob and the steps up to it
function door(g: CanvasRenderingContext2D, x: number, y: number, colour: string): void {
  g.fillStyle = '#1a1424';
  g.fillRect(x - 1, y - 1, 14, 25);
  g.fillStyle = colour;
  g.fillRect(x, y, 12, 24);
  g.fillStyle = shade(colour, 1.3);
  g.fillRect(x + 2, y + 3, 8, 7);
  g.fillStyle = '#ffe08a';
  g.fillRect(x + 9, y + 13, 2, 2);
  g.fillStyle = '#9a96a4';
  g.fillRect(x - 3, FACADE.h - 4, 18, 2);
  g.fillRect(x - 5, FACADE.h - 2, 22, 2);
}

// photo 1: clapboard, tall sash windows under hoods, a dentil cornice, the garage and the door up its steps
function paintVictorian(g: CanvasRenderingContext2D, x0: number, [body, trim, accent]: [string, string, string], variant: number): void {
  const { w, h } = FACADE;
  g.fillStyle = body;
  g.fillRect(x0, 0, w, h);
  g.fillStyle = shade(body, 0.86);
  for (let y = 2; y < h; y += 3) g.fillRect(x0, y, w, 1);
  g.fillStyle = trim;
  g.fillRect(x0, 0, 3, h);
  g.fillRect(x0 + w - 3, 0, 3, h);
  for (const y of [2 * PX - 2, 4 * PX - 2]) g.fillRect(x0, y, w, 3);
  //the dentils under the cornice
  g.fillRect(x0, 0, w, 3);
  g.fillStyle = shade(trim, 0.6);
  for (let x = x0 + 1; x < x0 + w; x += 3) g.fillRect(x, 3, 2, 2);
  const wins = variant % 3 === 0 ? [8, 26, 44] : [10, 38];
  const ww = variant % 3 === 0 ? 12 : 16;
  for (const sy of [0, 2 * PX]) {
    for (const wx of wins) {
      const x = x0 + wx;
      const y = sy + 8;
      g.fillStyle = trim;
      g.fillRect(x - 2, y - 4, ww + 4, 3);
      pane(g, x, y, ww, 19, trim);
      g.fillStyle = trim;
      g.fillRect(x, y + 9, ww, 2);
    }
  }
  //street level: brick for some (photo 1, left), the garage on one side and the door on the other
  const gy = 4 * PX + 4;
  if (variant % 4 === 1) {
    g.fillStyle = '#8a3e34';
    g.fillRect(x0, 4 * PX + 1, w, h - 4 * PX - 1);
    g.fillStyle = '#5a2620';
    for (let y = 4 * PX + 4; y < h; y += 4) g.fillRect(x0, y, w, 1);
  }
  const left = variant % 2 === 0;
  if (variant % 4 === 1) arch(g, x0 + (left ? 6 : 30), gy - 2, 26, 28, '#1a1424', shade(trim, 0.7));
  else garage(g, x0 + (left ? 6 : 30), gy, 26, 26, shade(trim, 0.92), false);
  door(g, x0 + (left ? 42 : 10), gy, accent);
}

// photo 2: white stucco, arched windows with an iron balcony, a wide mullioned window under a tile hood, a wood
// garage door
function paintStucco(g: CanvasRenderingContext2D, x0: number, [body, trim, accent]: [string, string, string], variant: number): void {
  const { w, h } = FACADE;
  g.fillStyle = body;
  g.fillRect(x0, 0, w, h);
  g.fillStyle = shade(body, 0.93);
  for (let k = 0; k < 80; k++) g.fillRect(x0 + ((k * 29) % (w - 2)), (k * 17) % h, 2, 1);
  const frame = trim === '#2a2228' ? trim : shade(body, 0.55);
  for (const wx of [10, 38]) arch(g, x0 + wx, 6, 16, 22, frame);
  if (variant % 2 === 0) {
    const bx = x0 + 6;
    g.fillStyle = '#1a1424';
    g.fillRect(bx, 27, 24, 1);
    for (let i = 0; i <= 24; i += 3) g.fillRect(bx + i, 27, 1, 5);
    g.fillRect(bx, 31, 24, 1);
  }
  //the middle storey's wide window under a tile hood
  g.fillStyle = '#b0503a';
  g.fillRect(x0 + 5, 36, 54, 4);
  g.fillStyle = '#7a3026';
  for (let x = x0 + 6; x < x0 + 59; x += 3) g.fillRect(x, 38, 1, 2);
  pane(g, x0 + 8, 42, 48, 17, frame);
  g.fillStyle = frame;
  for (const k of [1, 2]) g.fillRect(x0 + 8 + k * 16, 42, 1, 17);
  //street level: an arched garage in wood, an arched door
  const gy = 4 * PX + 4;
  const left = variant % 2 === 1;
  arch(g, x0 + (left ? 6 : 30), gy - 2, 26, 28, '#1a1424', accent);
  g.fillStyle = shade(accent, 0.74);
  for (let x = x0 + (left ? 9 : 33); x < x0 + (left ? 32 : 56); x += 4) g.fillRect(x, gy + 8, 1, 18);
  arch(g, x0 + (left ? 42 : 10), gy, 12, 24, '#1a1424', shade(accent, 0.8));
  g.fillStyle = '#9a96a4';
  g.fillRect(x0 + (left ? 39 : 7), h - 2, 18, 2);
}

// photo 2: cedar shingle with white-trimmed windows and a plank garage door
function paintShingle(g: CanvasRenderingContext2D, x0: number, [body, trim, accent]: [string, string, string], variant: number): void {
  const { w, h } = FACADE;
  g.fillStyle = body;
  g.fillRect(x0, 0, w, h);
  g.fillStyle = shade(body, 0.78);
  for (let y = 0; y < h; y += 3) {
    g.fillRect(x0, y + 2, w, 1);
    for (let x = x0 + (y % 6 ? 1 : 3); x < x0 + w; x += 4) g.fillRect(x, y, 1, 2);
  }
  g.fillStyle = trim;
  g.fillRect(x0, 0, w, 3);
  for (const sy of [0, 2 * PX]) {
    const wins = variant % 2 ? [8, 40] : [20];
    for (const wx of wins) {
      const ww = wins.length === 1 ? 24 : 16;
      g.fillStyle = trim;
      g.fillRect(x0 + wx - 3, sy + 6, ww + 6, 24);
      pane(g, x0 + wx, sy + 9, ww, 18, trim);
      g.fillStyle = trim;
      g.fillRect(x0 + wx, sy + 17, ww, 2);
      if (ww > 16) g.fillRect(x0 + wx + ww / 2, sy + 9, 1, 18);
    }
  }
  const gy = 4 * PX + 4;
  g.fillStyle = trim;
  g.fillRect(x0 + 5, gy - 3, 32, 29);
  garage(g, x0 + 7, gy, 28, 26, accent, true);
  door(g, x0 + 44, gy, shade(trim, 0.9));
}

// photo 3: flat-fronted stucco, white bands between floors, ribbon windows, a wide garage
function paintModern(g: CanvasRenderingContext2D, x0: number, [body, trim, accent]: [string, string, string], variant: number): void {
  const { w, h } = FACADE;
  g.fillStyle = body;
  g.fillRect(x0, 0, w, h);
  g.fillStyle = trim;
  for (const y of [0, 2 * PX - 2, 4 * PX - 2]) g.fillRect(x0, y, w, 3);
  for (const sy of [0, 2 * PX]) {
    pane(g, x0 + 5, sy + 8, 54, 18, trim);
    g.fillStyle = trim;
    for (let x = x0 + 5 + (variant % 2 ? 18 : 13); x < x0 + 59; x += variant % 2 ? 18 : 13) g.fillRect(x, sy + 8, 2, 18);
    g.fillRect(x0 + 5, sy + 15, 54, 1);
  }
  const gy = 4 * PX + 4;
  garage(g, x0 + 5, gy, 34, 26, trim, false);
  door(g, x0 + 46, gy, accent);
}

function houseAtlas(): THREE.Texture {
  if (atlas) return atlas;
  const c = document.createElement('canvas');
  c.width = AW;
  c.height = AH;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  HOUSES.forEach(({ style, paint: p }, i) => {
    const [fx, fy] = facadeRect(i);
    g.save();
    g.translate(0, fy);
    const painter = { victorian: paintVictorian, stucco: paintStucco, shingle: paintShingle, modern: paintModern }[style];
    painter(g, fx, p, i);
    g.restore();
    //this house's plain siding, for its sides and its bay's sides
    const [sx, sy] = SWATCH.siding(i);
    g.fillStyle = p[0];
    g.fillRect(sx, sy, PX, PX);
    g.fillStyle = shade(p[0], style === 'shingle' ? 0.78 : style === 'victorian' ? 0.86 : 0.93);
    if (style === 'victorian') for (let y = sy + 2; y < sy + PX; y += 3) g.fillRect(sx, y, PX, 1);
    else if (style === 'shingle') for (let y = sy; y < sy + PX; y += 3) for (let x = sx + (y % 6 ? 1 : 3); x < sx + PX; x += 4) g.fillRect(x, y, 1, 2);
    else for (let k = 0; k < 6; k++) g.fillRect(sx + ((k * 5) % 14), sy + ((k * 7) % 14), 2, 1);
  });
  //roofs: tar, pale gravel, red membrane, each with specks
  for (const [i, base, speck] of [[0, '#5a5464', '#6c6676'], [1, '#9a948a', '#b0aa9e'], [2, '#8a5a50', '#9e6a5e']] as const) {
    const [rx] = SWATCH.roof(i);
    g.fillStyle = base;
    g.fillRect(rx, SY, 2 * PX, PX);
    g.fillStyle = speck;
    for (let k = 0; k < 40; k++) g.fillRect(rx + ((k * 13) % (2 * PX)), SY + ((k * 7) % PX), 1, 1);
  }
  g.fillStyle = '#f4efe6';
  g.fillRect(2 * PX, SY, PX, PX); // trim
  const [bx, by] = SWATCH.brick;
  g.fillStyle = '#8a3e34';
  g.fillRect(bx, by, 2 * PX, PX);
  g.fillStyle = '#5a2620';
  for (let y = by + 3; y < by + PX; y += 4) g.fillRect(bx, y, 2 * PX, 1);
  g.fillStyle = '#2a2232';
  g.fillRect(5 * PX, SY, PX, PX); // dark: chimney caps, vents
  //barrel tiles: rows of half-rounds
  const [tx0] = SWATCH.tile;
  g.fillStyle = '#b8563c';
  g.fillRect(tx0, SY, 2 * PX, PX);
  g.fillStyle = '#d07050';
  for (let y = SY; y < SY + PX; y += 4) for (let x = tx0 + (y % 8 ? 2 : 0); x < tx0 + 2 * PX; x += 4) g.fillRect(x, y, 2, 3);
  g.fillStyle = '#7a3026';
  for (let y = SY + 3; y < SY + PX; y += 4) g.fillRect(tx0, y, 2 * PX, 1);
  //foliage: street trees and shrubs, bougainvillea, cypress
  for (const [r, base, hi, lo] of [[SWATCH.leaf, '#5a9a4a', '#7ab860', '#3e7438'], [SWATCH.bloom, '#c43a7a', '#e8609a', '#5a9a4a'], [SWATCH.cypress, '#3a6a44', '#4e8456', '#2a4e34']] as const) {
    g.fillStyle = base;
    g.fillRect(r[0], r[1], r[2], r[3]);
    for (let k = 0; k < 24; k++) {
      g.fillStyle = k % 3 ? hi : lo;
      g.fillRect(r[0] + ((k * 7) % 15), r[1] + ((k * 11) % 15), 2, 2);
    }
  }
  //the poles: weathered wood; grey for transformers
  g.fillStyle = '#6a5040';
  g.fillRect(15 * PX, SY, PX, PX);
  g.fillStyle = '#56402f';
  for (let x = 15 * PX + 5; x < 16 * PX; x += 4) g.fillRect(x, SY, 1, PX);
  g.fillStyle = '#9a9aa4';
  g.fillRect(16 * PX, SY, PX, PX);
  atlas = pixelTexture(c);
  return atlas;
}

// a tiling canvas texture, `w` x `h` tiles at 16 px a tile
function tiling(w: number, h: number, paint: (g: CanvasRenderingContext2D, W: number, H: number) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = w * PX;
  c.height = h * PX;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  paint(g, c.width, c.height);
  const t = pixelTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let mats: Record<Key, THREE.Material> | null = null;

function materials(): NonNullable<typeof mats> {
  if (mats) return mats;
  const [z0, z1] = HILLSIDE.road;
  //asphalt across the road's width, a double yellow down the skate lane, worn patches; 4 tiles long
  const road = tiling(4, 1, (g, W, H) => {
    g.fillStyle = '#3a3742';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#433f4c';
    for (let i = 0; i < 30; i++) g.fillRect((i * 23) % W, (i * 5) % H, 3, 1);
    const lane = Math.round(((0.25 - z0) / (z1 - z0)) * H);
    g.fillStyle = '#e8c040';
    g.fillRect(0, H - lane - 2, W, 1);
    g.fillRect(0, H - lane + 1, W, 1);
    g.fillStyle = '#d8d8de'; // the edge lines
    g.fillRect(0, 1, W, 1);
    g.fillRect(0, H - 2, W, 1);
  });
  mats = {
    road: new THREE.MeshLambertMaterial({ map: road }),
    //sidewalk slabs, 1 x 1 tile, and board-formed concrete (retaining walls, stairways, foundations), 2 x 2 tiles:
    //the kit's shared surface textures (surfaces.ts), so the street's stairs and the hill's look the same
    walk: new THREE.MeshLambertMaterial({ map: surfaceTexture('pavers'), color: 0xa9a4b2 }),
    concrete: new THREE.MeshLambertMaterial({ map: surfaceTexture('concrete'), color: 0x8c8794 }),
    house: new THREE.MeshLambertMaterial({ map: houseAtlas() }),
    //Chinatown's tenements (chinatown-art.ts): their signs, lanterns and lit windows glow at night (chinatownGlow)
    ct: new THREE.MeshLambertMaterial({ map: chinatownAtlas(), emissiveMap: chinatownGlowMap(), emissive: 0xffffff, emissiveIntensity: 0 }),
    wetRoad: new THREE.MeshLambertMaterial({ map: road, color: 0x7c84a0 }),
    wetWalk: new THREE.MeshLambertMaterial({ map: surfaceTexture('pavers'), color: 0x7e7a90 }),
    //the power lines: flat ink, no outline of their own
    wire: new THREE.MeshBasicMaterial({ color: 0x1a1424 }),
  };
  return mats;
}

// ------------------------------------------------------------------------------------------------- geometry

type Key = 'road' | 'walk' | 'concrete' | 'house' | 'wire' | 'ct' | 'wetRoad' | 'wetWalk';
type V3 = [number, number, number];
type UvFn = (p: V3) => [number, number];

// world-space mappings for the tiling textures
const UV = {
  top: (su: number, sv: number, dz = 0): UvFn => (p) => [p[0] / su, (p[2] - dz) / sv],
  front: (su: number, sv: number): UvFn => (p) => [p[0] / su, p[1] / sv],
  side: (su: number, sv: number): UvFn => (p) => [p[2] / su, p[1] / sv],
};

// a face's corners mapped onto an atlas rect (a, b, c, d: bottom-left, bottom-right, top-right, top-left)
function rectUv([x, y, w, h]: Rect, sub: [number, number, number, number] = [0, 0, 1, 1]): [number, number][] {
  const u0 = (x + sub[0] * w) / AW;
  const u1 = (x + sub[2] * w) / AW;
  const v0 = 1 - (y + (1 - sub[1]) * h) / AH;
  const v1 = 1 - (y + (1 - sub[3]) * h) / AH;
  return [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
}

export class Mesher {
  private parts = new Map<Key, { pos: number[]; nor: number[]; uv: number[] }>();
  bushes: [number, number, number, boolean][] = []; // x, base, z, flowering

  // a quad, corners counter-clockwise seen from outside; uvs per corner or a mapping of positions
  quad(key: Key, a: V3, b: V3, c: V3, d: V3, uv: UvFn | [number, number][]): void {
    let part = this.parts.get(key);
    if (!part) this.parts.set(key, (part = { pos: [], nor: [], uv: [] }));
    const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2])).normalize();
    const uvs = typeof uv === 'function' ? [a, b, c, d].map(uv) : uv;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      part.pos.push(...[a, b, c, d][i]);
      part.nor.push(n.x, n.y, n.z);
      part.uv.push(...uvs[i]);
    }
  }

  // a box whose top may slope along x (t0 at x0, t1 at x1); faces left out with null
  box(x0: number, x1: number, bottom: number, t0: number, t1: number, z0: number, z1: number, faces: Partial<Record<'top' | 'front' | 'back' | 'left' | 'right', [Key, UvFn | [number, number][]] | null>>): void {
    const f = faces;
    if (f.top) this.quad(f.top[0], [x0, t0, z1], [x1, t1, z1], [x1, t1, z0], [x0, t0, z0], f.top[1]);
    if (f.front) this.quad(f.front[0], [x0, bottom, z1], [x1, bottom, z1], [x1, t1, z1], [x0, t0, z1], f.front[1]);
    if (f.back) this.quad(f.back[0], [x1, bottom, z0], [x0, bottom, z0], [x0, t0, z0], [x1, t1, z0], f.back[1]);
    if (f.right) this.quad(f.right[0], [x1, bottom, z1], [x1, bottom, z0], [x1, t1, z0], [x1, t1, z1], f.right[1]);
    if (f.left) this.quad(f.left[0], [x0, bottom, z0], [x0, bottom, z1], [x0, t0, z1], [x0, t0, z0], f.left[1]);
  }

  build(group: THREE.Group): void {
    run(this.buildSteps(group));
  }

  // build a mesh at a time, yielding when the frame's slice is spent (slice.ts)
  *buildSteps(group: THREE.Group): Generator<void, void> {
    const m = materials();
    for (const [x, base, z, bloom] of this.bushes) plantBush(group, x, base, z, bloom);
    if (this.bushes.length) group.add(treeWarm());
    for (const [key, part] of this.parts) {
      if (sliceDone()) yield;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(part.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
      const mesh = new THREE.Mesh(geo, m[key].clone());
      mesh.name = `hillside-${key}`;
      if (key === 'wire') mesh.userData.inked = true;
      group.add(mesh);
    }
  }
}

// --------------------------------------------------------------------------------------------- the ground line

interface Ground {
  x0: number; // tiles
  x1: number;
  t0: number; // height at x0, tiles over the street
  t1: number;
  kind: Surface['kind'];
}

const tx = (px: number) => px / TILE;

// the descent's ground, left to right in tiles: roofs, banks and hills (stairs are stepped separately)
function descentGround(level: Level): Ground[] {
  const h = (py: number) => (level.streetY - py) / TILE;
  return hillGround(level).map((s) => ({ x0: tx(s.x0), x1: tx(s.x1), t0: h(s.y), t1: h(s.y1 ?? s.y), kind: s.kind }));
}

// the lane's height at x (tiles): the descent's ground, a gap takes the lower edge, the street is 0
// (`hill`: whether x is on a stretch of hill rather than the street)
export function laneHeight(ground: Ground[], hill: (x: number) => boolean, x: number): number {
  if (!hill(x)) return 0;
  let below = -Infinity;
  let after = Infinity;
  for (const g of ground) {
    if (x >= g.x0 && x <= g.x1) return g.t0 + ((x - g.x0) / (g.x1 - g.x0 || 1)) * (g.t1 - g.t0);
    if (g.x1 < x) below = g.t1;
    else if (g.x0 > x && after === Infinity) after = g.t0;
  }
  if (below === -Infinity) return after === Infinity ? 0 : after;
  return Math.min(below, after === Infinity ? 0 : after);
}

// the lowest the lane gets over [x0, x1]
function lowest(ground: Ground[], hill: (x: number) => boolean, x0: number, x1: number): number {
  return span(ground, hill, x0, x1)[0];
}

// the lowest and highest the lane gets over [x0, x1]
function span(ground: Ground[], hill: (x: number) => boolean, x0: number, x1: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (let x = x0; x <= x1 + 1e-6; x += 0.5) {
    const h = laneHeight(ground, hill, x);
    lo = Math.min(lo, h);
    hi = Math.max(hi, h);
  }
  return [lo, hi];
}

// where a house in front tops out: under the lane, but partway up a slope rather than at its foot, so the rooftops
// step down the hill with it (the camera's line to the lane clears a little rise there)
function frontRoof(ground: Ground[], hill: (x: number) => boolean, x0: number, x1: number): number {
  const [lo, hi] = span(ground, hill, x0, x1);
  return lo + Math.min(0.6, 0.5 * (hi - lo));
}

// gaps in the descent's ground (tiles): crest jumps over a cross street (not the street chases between stretches), the
// physics' pits (level.ts pits())
function gaps(ground: Ground[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 1; i < ground.length; i++) {
    const a = ground[i - 1];
    const b = ground[i];
    if (b.x0 - a.x1 > PIT.gap[0] && b.x0 - a.x1 < PIT.gap[1]) out.push([a.x1, b.x0, Math.min(a.t1, b.t0)]);
  }
  return out;
}

// Chinatown's intersections (src/traffic/hill-cross.ts): their cross streets run on past the camera, as the cars
// on them do, so the near sidewalk, the low wall and the houses in front make way (tiles: x0, x1, height)
function throughStreets(level: Level): [number, number, number][] {
  return (level.hillCross ?? []).map((k) => [tx(k.x) - HILLSIDE.crossW / 2, tx(k.x) + HILLSIDE.crossW / 2, (level.streetY - k.y) / TILE]);
}

// Chinatown's blocks (tiles), where tenements stand instead of the row houses (chinatown-art.ts)
function chinatownSpans(level: Level): [number, number][] {
  return (level.chinatown ?? []).map(([a, b]): [number, number] => [tx(a), tx(b)]);
}
const overlaps = (spans: [number, number][], xa: number, xb: number) => spans.some(([a, b]) => xb > a && xa < b);

// a row of tenements from x0 to x1 (tiles), skipping the cut ranges: their x ranges
function tenementRow(m: Mesher, rng: () => number, x0: number, x1: number, z0: number, z1: number, base: (xa: number, xb: number) => number, foot: (xa: number, xb: number) => number, cut: (xa: number, xb: number) => boolean, storeys: [number, number], shops: boolean): [number, number][] {
  const out: [number, number][] = [];
  for (let x = x0; x < x1; ) {
    const w = Math.min(x1 - x, 2.5 + randInt(rng, 5) * 0.5);
    if (w < 1.5) break;
    if (cut(x, x + w)) {
      x += 0.5;
      continue;
    }
    const b = base(x, x + w);
    tenement(m, rng, { x0: x, x1: x + w, base: b, foot: Math.min(b, foot(x, x + w)), z0, z1, storeys: storeys[0] + randInt(rng, storeys[1] - storeys[0] + 1), shops });
    out.push([x, x + w]);
    x += w;
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ the shapes

// a prism on a trapezoid footprint standing out from z (a three-sided bay): x0..x1 against the wall, its front
// inset by e at each end and d out; faces given their atlas rects
function trap(m: Mesher, x0: number, x1: number, e: number, z: number, d: number, yb: number, yt: number, face: { front: [number, number][]; side: [number, number][]; cap: [number, number][] }): void {
  const p0: [number, number] = [x0, z];
  const p1: [number, number] = [x0 + e, z + d];
  const p2: [number, number] = [x1 - e, z + d];
  const p3: [number, number] = [x1, z];
  const at = ([x, zz]: [number, number], y: number): V3 => [x, y, zz];
  m.quad('house', at(p0, yb), at(p1, yb), at(p1, yt), at(p0, yt), face.side);
  m.quad('house', at(p1, yb), at(p2, yb), at(p2, yt), at(p1, yt), face.front);
  m.quad('house', at(p2, yb), at(p3, yb), at(p3, yt), at(p2, yt), face.side);
  m.quad('house', at(p1, yt), at(p2, yt), at(p3, yt), at(p0, yt), face.cap);
  m.quad('house', at(p0, yb), at(p3, yb), at(p2, yb), at(p1, yb), face.cap);
}

// an octagonal prism: poles and their transformers, and stacked up, a shrub
function oct(m: Mesher, cx: number, cz: number, r: number, yb: number, yt: number, uv: [number, number][], rt = r): void {
  const at = (i: number, rr: number, y: number): V3 => {
    const th = (i * Math.PI) / 4 + Math.PI / 8;
    return [cx + rr * Math.cos(th), y, cz - rr * Math.sin(th)];
  };
  const top: V3 = [cx, yt, cz];
  const bot: V3 = [cx, yb, cz];
  for (let i = 0; i < 8; i++) {
    m.quad('house', at(i, r, yb), at(i + 1, r, yb), at(i + 1, rt, yt), at(i, rt, yt), uv);
    m.quad('house', top, at(i, rt, yt), at(i + 1, rt, yt), at(i + 1, rt, yt), uv);
    m.quad('house', bot, at(i + 1, r, yb), at(i, r, yb), at(i, r, yb), uv);
  }
}

// a bush by a door (zack's pixel-leaf ref): planted when the mesh is built (trees.ts bush), flowering or plain
function shrub(m: Mesher, x: number, z: number, base: number, bloom: boolean): void {
  m.bushes.push([x, base, z, bloom]);
}

// ------------------------------------------------------------------------------------------------ the houses

interface HouseOpts {
  x0: number;
  x1: number;
  street: number; // the facade's street level (its garage door stands on it)
  bottom: number; // the foundation's foot
  z0: number;
  z1: number;
  paint: number; // which of HOUSES
  bay: boolean;
  chimney: boolean;
  hip: boolean; // stucco gets a hipped tile roof (rows behind the lane); in front, only a tile eave under the lane
}

function house(m: Mesher, o: HouseOpts): void {
  const style = HOUSES[o.paint].style;
  const top = o.street + 3 * HILLSIDE.storey;
  const side = rectUv(SWATCH.siding(o.paint));
  const trim = rectUv(SWATCH.trim);
  const tile = rectUv(SWATCH.tile);
  const concrete: UvFn = UV.front(2, 2);
  const f = facadeRect(o.paint);
  const w = o.x1 - o.x0;
  //the facade, and its foundation down the hill
  m.quad('house', [o.x0, o.street, o.z1], [o.x1, o.street, o.z1], [o.x1, top, o.z1], [o.x0, top, o.z1], rectUv(f));
  if (o.street > o.bottom) m.box(o.x0, o.x1, o.bottom, o.street, o.street, o.z0, o.z1, { front: ['concrete', concrete], left: ['concrete', UV.side(2, 2)], right: ['concrete', UV.side(2, 2)] });
  //sides and roof
  m.box(o.x0, o.x1, o.street, top, top, o.z0, o.z1, { top: ['house', rectUv(SWATCH.roof(o.paint))], left: ['house', side], right: ['house', side] });
  //the roofline: a hipped tile roof or a tile eave on stucco, a thin parapet on modern, a cornice on the rest
  if (style === 'stucco' && o.hip) {
    const ov = 0.25;
    const rh = 1.0;
    const zm = (o.z0 + o.z1) / 2;
    const r = Math.min(1.2, w / 2 - 0.2);
    const [a0, a1, b0, b1] = [o.x0 - ov, o.x1 + ov, o.z0 - ov, o.z1 + ov];
    const y = top;
    m.quad('house', [a0, y, b1], [a1, y, b1], [o.x1 - r, y + rh, zm], [o.x0 + r, y + rh, zm], tile);
    m.quad('house', [a1, y, b0], [a0, y, b0], [o.x0 + r, y + rh, zm], [o.x1 - r, y + rh, zm], tile);
    m.quad('house', [a0, y, b0], [a0, y, b1], [o.x0 + r, y + rh, zm], [o.x0 + r, y + rh, zm], tile);
    m.quad('house', [a1, y, b1], [a1, y, b0], [o.x1 - r, y + rh, zm], [o.x1 - r, y + rh, zm], tile);
    m.quad('house', [a0, y, b0], [a1, y, b0], [a1, y, b1], [a0, y, b1], trim); // the eaves' underside
  } else if (style === 'stucco') {
    m.quad('house', [o.x0 - 0.1, top - 0.35, o.z1 + 0.4], [o.x1 + 0.1, top - 0.35, o.z1 + 0.4], [o.x1 + 0.1, top + 0.05, o.z1 - 0.3], [o.x0 - 0.1, top + 0.05, o.z1 - 0.3], tile);
    m.quad('house', [o.x0 - 0.1, top - 0.35, o.z1 - 0.3], [o.x1 + 0.1, top - 0.35, o.z1 - 0.3], [o.x1 + 0.1, top - 0.35, o.z1 + 0.4], [o.x0 - 0.1, top - 0.35, o.z1 + 0.4], trim);
  } else if (style === 'modern') {
    m.box(o.x0 - 0.03, o.x1 + 0.03, top - 0.06, top + 0.14, top + 0.14, o.z1 - 0.1, o.z1 + 0.06, { top: ['house', trim], front: ['house', trim], left: ['house', trim], right: ['house', trim] });
  } else {
    m.box(o.x0 - 0.06, o.x1 + 0.06, top - 0.12, top + 0.22, top + 0.22, o.z1 - 0.05, o.z1 + 0.22, { top: ['house', trim], front: ['house', trim], left: ['house', trim], right: ['house', trim] });
  }
  //out over the street on the upper storeys: a bay window, or on modern a balcony
  if (o.bay) {
    const bw = Math.min(2.2, w * 0.6);
    const bx = o.x0 + (w - bw) * (o.paint % 2 ? 0.2 : 0.8);
    const y0 = o.street + HILLSIDE.storey + 0.15;
    const y1 = top - 0.3;
    const s0 = (bx - o.x0) / w;
    const s1 = (bx + bw - o.x0) / w;
    const v0 = (y0 - o.street) / (top - o.street);
    const v1 = (y1 - o.street) / (top - o.street);
    if (style === 'modern') {
      //a balcony on the middle storey: its slab and a solid white rail
      const y = o.street + HILLSIDE.storey;
      m.box(bx - 0.3, bx + bw + 0.3, y - 0.12, y, y, o.z1, o.z1 + 0.6, { top: ['house', trim], front: ['house', trim], left: ['house', trim], right: ['house', trim] });
      m.quad('house', [bx - 0.3, y - 0.12, o.z1], [bx + bw + 0.3, y - 0.12, o.z1], [bx + bw + 0.3, y - 0.12, o.z1 + 0.6], [bx - 0.3, y - 0.12, o.z1 + 0.6], trim);
      m.box(bx - 0.3, bx + bw + 0.3, y, y + 0.45, y + 0.45, o.z1 + 0.54, o.z1 + 0.6, { top: ['house', trim], front: ['house', trim], back: ['house', trim], left: ['house', trim], right: ['house', trim] });
    } else if (style === 'victorian') {
      //photo 1: the three-sided bay, two storeys tall, its windows wrapping round, a cap over it
      const e = 0.3;
      const d = 0.45;
      const front = rectUv(f, [s0 + 0.08, v0, s1 - 0.08, v1]);
      const sideWin = rectUv(f, [s0, v0, s0 + 0.12, v1]);
      trap(m, bx, bx + bw, e, o.z1, d, y0, y1, { front, side: sideWin, cap: trim });
      trap(m, bx - 0.08, bx + bw + 0.08, e, o.z1, d + 0.1, y1, y1 + 0.18, { front: trim, side: trim, cap: trim });
    } else {
      //a square bay; stucco's wears a little tile roof
      m.quad('house', [bx, y0, o.z1 + 0.42], [bx + bw, y0, o.z1 + 0.42], [bx + bw, y1, o.z1 + 0.42], [bx, y1, o.z1 + 0.42], rectUv(f, [s0, v0, s1, v1]));
      m.box(bx, bx + bw, y0, y1, y1, o.z1, o.z1 + 0.42, { top: ['house', trim], left: ['house', side], right: ['house', side] });
      m.quad('house', [bx, y0, o.z1], [bx + bw, y0, o.z1], [bx + bw, y0, o.z1 + 0.42], [bx, y0, o.z1 + 0.42], trim);
      if (style === 'stucco') m.quad('house', [bx - 0.1, y1, o.z1 + 0.55], [bx + bw + 0.1, y1, o.z1 + 0.55], [bx + bw + 0.1, y1 + 0.3, o.z1], [bx - 0.1, y1 + 0.3, o.z1], tile);
    }
  }
  //a roof hatch or an air unit up top, now and then
  if (o.chimney && o.paint % 2 && !(style === 'stucco' && o.hip)) {
    const ux = o.x1 - 1.3;
    const uz = o.z0 + 0.6;
    m.box(ux, ux + 0.8, top, top + 0.35, top + 0.35, uz, uz + 0.6, { top: ['house', rectUv(SWATCH.dark)], front: ['house', trim], left: ['house', trim], right: ['house', trim] });
  }
  if (o.chimney) {
    const cx = o.x0 + 0.5;
    const cz = (o.z0 + o.z1) / 2;
    const ch = style === 'stucco' && o.hip ? 1.3 : 0.6;
    const brick = rectUv(SWATCH.brick);
    m.box(cx, cx + 0.45, top, top + ch, top + ch, cz - 0.25, cz + 0.25, { top: ['house', rectUv(SWATCH.dark)], front: ['house', brick], back: ['house', brick], left: ['house', brick], right: ['house', brick] });
  }
}

type RowArgs = [m: Mesher, rng: () => number, x0: number, x1: number, z0: number, z1: number, street: (xa: number, xb: number) => number, foot: (xa: number, xb: number) => number, cut: (xa: number, xb: number) => boolean, extras: { bay: number; chimney: number; hip: boolean; shrub: number }];

// a row of houses from x0 to x1 (tiles), each stood at `street(xa, xb)`, skipping the cut ranges; a shrub by some
// doors. A house at a time, yielding when the frame's slice is spent (slice.ts)
function* houseRowSteps(...[m, rng, x0, x1, z0, z1, street, foot, cut, extras]: RowArgs): Generator<void, void> {
  for (let x = x0; x < x1; ) {
    if (sliceDone()) yield;
    const w = 3 + randInt(rng, 3) * 0.75;
    if (cut(x, x + w)) {
      x += 0.5;
      continue;
    }
    const s = street(x, x + w);
    const paint = randInt(rng, HOUSES.length);
    house(m, { x0: x, x1: x + w, street: s, bottom: Math.min(s, foot(x, x + w)), z0, z1, paint, bay: rng() < extras.bay, chimney: rng() < extras.chimney, hip: extras.hip });
    if (rng() < extras.shrub) shrub(m, x + (paint % 2 ? w - 0.6 : 0.6), z1 + 0.35, s, rng() < 0.4);
    x += w;
  }
}

// ------------------------------------------------------------------------------------------------ the hill

// whether x (tiles) is on a stretch of hill
const onHill = (level: Level) => (x: number) => inHill(level, x * TILE);

// each stretch of hill, tiles: the opening descent (from off the left of the screen) and the later ones
function hillStretches(level: Level): [number, number][] {
  return [[-8, tx(level.finaleX)], ...(level.hillSpans ?? []).slice(1).map(([a, b]): [number, number] => [tx(a), tx(b)])];
}

// the descent as solid hill: road, sidewalks and stairways on ground that goes all the way down, row houses behind,
// cross streets back into the city at the crests and under the crest jumps, power lines and trees along the back
export function buildHill(level: Level, group: THREE.Group): void {
  run(buildHillSteps(level, group));
}

// the deep (src/gen/sewer.ts) in cutaway under the hill: the hill's ground that goes all the way down (to
// HILLSIDE.bottom) across the tunnel's depth stops at the deep's roof over it, so the deep shows through
// (sewer-kit.ts draws it)
function deepCutaway(level: Level, m: Mesher): void {
  const Y = (py: number) => (level.streetY - py) / TILE;
  const cuts = (level.sewers ?? []).flatMap((s): [number, number, number][] => {
    if (s.top === undefined) return [];
    const at = s.topAt ?? s.x0;
    return [...(s.top0 !== undefined && at > s.x0 ? [[tx(s.x0), tx(at), Y(s.top0)] as [number, number, number]] : []), [tx(at), tx(s.x1), Y(s.top)]];
  });
  if (!cuts.length) return;
  const raw = m.box.bind(m);
  m.box = (x0, x1, bottom, t0, t1, z0, z1, faces) => {
    if (bottom > HILLSIDE.bottom + 0.01 || z1 <= HILLSIDE.backWalk || z0 >= HILLSIDE.nearWalk || !cuts.some(([a, b]) => x1 > a && x0 < b)) return raw(x0, x1, bottom, t0, t1, z0, z1, faces);
    const t = (x: number) => (x1 > x0 ? t0 + ((t1 - t0) * (x - x0)) / (x1 - x0) : t0);
    let a = x0;
    for (const [c0, c1, top] of cuts) {
      if (c1 <= a || c0 >= x1) continue;
      const [b0, b1] = [Math.max(a, c0), Math.min(x1, c1)];
      if (b0 > a) raw(a, b0, bottom, t(a), t(b0), z0, z1, faces);
      if (Math.max(t(b0), t(b1)) > top) raw(b0, b1, top, Math.max(t(b0), top), Math.max(t(b1), top), z0, z1, faces);
      a = b1;
    }
    if (a < x1) raw(a, x1, bottom, t(a), t(x1), z0, z1, faces);
  };
}

// buildHill a piece at a time, yielding when the frame's slice is spent (slice.ts)
export function* buildHillSteps(level: Level, group: THREE.Group): Generator<void, void> {
  const m = new Mesher();
  const ground = descentGround(level);
  const hill = onHill(level);
  const B = HILLSIDE.bottom;
  //the sewer route's deep runs under the hill (src/gen/sewer.ts): ground over it only goes down to its roof
  deepCutaway(level, m);
  const [rz0, rz1] = HILLSIDE.road;
  const back = HILLSIDE.backWalk;
  const near = HILLSIDE.nearWalk;
  const c = HILLSIDE.curb;
  const cs = UV.side(2, 2);
  const cf = UV.front(2, 2);
  const walkFaces: Parameters<Mesher['box']>[7] = { top: ['walk', UV.top(1, 1)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] };
  const walkFacesDry = walkFaces;
  //the street section across one piece of ground: sidewalk, road, sidewalk, retaining walls at its ends. On the
  //steep blocks the back sidewalk is a flight of steps, the way San Francisco's are (photo 3)
  //Chinatown's street is always wet (zack's photos): darker, bluer road and paving
  const chinaSpans = chinatownSpans(level);
  const section = (x0: number, x1: number, t0: number, t1: number) => {
    const wet = overlaps(chinaSpans, x0, x1);
    const walkFaces: Parameters<Mesher['box']>[7] = wet ? { ...walkFacesDry, top: ['wetWalk', UV.top(1, 1)] } : walkFacesDry;
    m.box(x0, x1, B, t0, t1, rz0, rz1, { top: [wet ? 'wetRoad' : 'road', UV.top(4, rz1 - rz0, rz0)], left: ['concrete', cs], right: ['concrete', cs] });
    const steep = Math.abs(t1 - t0) / (x1 - x0) >= HILLSIDE.stepGrade;
    if (steep) {
      const n = Math.max(1, Math.round((x1 - x0) / 0.5));
      for (let k = 0; k < n; k++) {
        const t = Math.max(t0 + ((t1 - t0) * k) / n, t0 + ((t1 - t0) * (k + 1)) / n) + c;
        m.box(x0 + ((x1 - x0) * k) / n, x0 + ((x1 - x0) * (k + 1)) / n, B, t, t, back, rz0, walkFaces);
      }
    } else m.box(x0, x1, B, t0 + c, t1 + c, back, rz0, walkFaces);
    m.box(x0, x1, B, t0 + c, t1 + c, rz1, near, walkFaces);
  };
  const crossings: [number, number, number][] = []; // x0, x1, height: cross streets at the crests
  ground.forEach((g, i) => {
    if (g.kind === 'stairs') {
      //a public stairway the width of the street, one block per step
      const steps = Math.round(g.x1 - g.x0);
      for (let k = 0; k < steps; k++) {
        const t = g.t0 + ((g.t1 - g.t0) * (k + 1)) / steps;
        m.box(g.x0 + k, g.x0 + k + 1, B, t, t, back, near, walkFaces);
      }
      return;
    }
    section(g.x0, g.x1, g.t0, g.t1);
    //a flat crest between two blocks is an intersection: its cross street runs back up into the city
    const prev = ground[i - 1];
    if (g.kind === 'roof' && prev && prev.kind !== 'roof' && g.x1 - g.x0 >= 5 && g.t0 > 0.5) {
      const cx = (g.x0 + g.x1) / 2;
      crossings.push([cx - HILLSIDE.crossW / 2, cx + HILLSIDE.crossW / 2, g.t0]);
    }
  });
  //Chinatown's cab corners: the side street the cab turns off into, just before the kicker (src/traffic/cab.ts)
  for (const r of level.cabs ?? []) {
    const cx = tx(r.turnX) + 0.5;
    crossings.push([cx - HILLSIDE.crossW / 2, cx + HILLSIDE.crossW / 2, (level.streetY - r.y) / TILE]);
  }
  //where each cross street ends it meets a back street in a T (zack, 2026-10-25: "cross traffic streets, should form
  //T's in the background to suggest a continuation of where they go"): the back street running off both ways behind
  //the rows, its far sidewalk, and a row of houses along it facing down the cross street
  const rngT = makeRng(level.layout.seed * 61 + level.layout.floor * 13);
  const tee = function* (x0: number, x1: number, t: number): Generator<void, void> {
    const T = HILLSIDE.tee;
    const [a, b] = [x0 - T.arm, x1 + T.arm];
    const z1 = HILLSIDE.crossFar;
    const z0 = z1 - HILLSIDE.crossW;
    m.box(a, b, B, t, t, z0, z1, { top: ['road', (p) => [p[0] / 4, (p[2] - z0) / (z1 - z0)]], left: ['concrete', cs], right: ['concrete', cs] });
    //its near sidewalk, broken by the cross street's mouth, and the far one
    for (const [w0, w1] of [[a, x0 - 0.7], [x1 + 0.7, b]]) m.box(w0, w1, B, t + c, t + c, z1, z1 + T.walk, { top: ['walk', UV.top(1, 1)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
    m.box(a, b, B, t + c, t + c, z0 - T.walk, z0, { top: ['walk', UV.top(1, 1)], front: ['concrete', cf] });
    yield* houseRowSteps(m, rngT, a, b, z0 - T.walk - T.depth, z0 - T.walk, () => t + c, () => t - 0.5, () => false, { bay: 0.7, chimney: 0.3, hip: true, shrub: 0.4 });
  };
  //the cross streets: flat roads back into the city with their kerbs, and crosswalk lines over the hill's road
  const paint = rectUv(SWATCH.trim);
  for (const [x0, x1, t] of crossings) {
    m.box(x0, x1, B, t, t, HILLSIDE.crossFar, back, { top: ['road', (p) => [p[2] / 4, (p[0] - x0) / (x1 - x0)]], left: ['concrete', cs], right: ['concrete', cs] });
    for (const [a, b] of [[x0 - 0.7, x0], [x1, x1 + 0.7]]) m.box(a, b, B, t + c, t + c, HILLSIDE.crossFar, back, { top: ['walk', UV.top(1, 1)] });
    for (const lx of [x0 - 0.75, x0 - 0.05, x1 + 0.05, x1 + 0.75]) m.quad('house', [lx - 0.06, t + 0.01, rz1], [lx + 0.06, t + 0.01, rz1], [lx + 0.06, t + 0.01, rz0], [lx - 0.06, t + 0.01, rz0], paint);
    yield* tee(x0, x1, t);
  }
  //Chinatown's run on toward the camera, over the houses in front, on a retaining wall down to the foundations
  for (const [x0, x1, t] of throughStreets(level)) {
    m.box(x0, x1, B, t, t, rz1, HILLSIDE.rowB[1], { top: ['road', (p) => [p[2] / 4, (p[0] - x0) / (x1 - x0)]], left: ['concrete', cs], right: ['concrete', cs], front: ['concrete', UV.front(2, 2)] });
  }
  //the cable car's slot up each climb, between its two running rails (cable-view.ts runs the car on it)
  const steel = rectUv(SWATCH.grey);
  const slot = rectUv(SWATCH.dark);
  for (const s of level.surfaces) {
    if (!s.tow) continue;
    const [x0, x1] = [tx(s.x0), tx(s.x1)];
    const [t0, t1] = [(level.streetY - s.y) / TILE + 0.012, (level.streetY - (s.y1 ?? s.y)) / TILE + 0.012];
    for (const [z, w, uv] of [[CABLE_Z - 0.55, 0.07, steel], [CABLE_Z, 0.05, slot], [CABLE_Z + 0.55, 0.07, steel]] as const) {
      m.quad('house', [x0, t0, z + w], [x1, t1, z + w], [x1, t1, z - w], [x0, t0, z - w], uv);
    }
  }
  //power lines strung low over the lane to grind (hills.ts): a heavier wire from a pole's long arm at each end
  const wood = rectUv(SWATCH.pole);
  const lineZ = 0.25;
  for (const r of level.rails) {
    if (!r.wire) continue;
    const pts = r.xs.map((x, i): V3 => [tx(x), (level.streetY - r.ys[i]) / TILE, lineZ]);
    const hw = 0.06;
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      m.quad('wire', [a[0], a[1] - hw, lineZ + 0.02], [b[0], b[1] - hw, lineZ + 0.02], [b[0], b[1] + hw, lineZ + 0.02], [a[0], a[1] + hw, lineZ + 0.02], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
    //(the top route's line runs a whole stretch: a pole every few tiles along it)
    const at = r.top ? pts.filter((p, i) => i === 0 || i === pts.length - 1 || Math.floor(p[0] / TOP.pole) !== Math.floor(pts[i - 1][0] / TOP.pole)) : [pts[0], pts[pts.length - 1]];
    for (const p of at) {
      const foot = laneHeight(ground, hill, p[0]) + c;
      const pz = HILLSIDE.road[0] + 0.15;
      oct(m, p[0], pz, 0.1, foot, p[1] + 0.7, wood, 0.08);
      m.box(p[0] - 0.06, p[0] + 0.06, p[1] + 0.02, p[1] + 0.14, p[1] + 0.14, pz - 0.2, lineZ + 0.2, { top: ['house', wood], front: ['house', wood], left: ['house', wood], right: ['house', wood] });
    }
  }
  //under each crest jump, the cross street it clears, running from the city behind to the camera
  const holes = gaps(ground);
  //(the sewer's shaft, src/gen/sewer.ts: a pit whose cross street is dug up over the lane, straight down to the deep)
  const shafts = (level.sewers ?? []).filter((s) => s.entry === 'shaft' && s.top !== undefined);
  for (const [x0, x1, t] of holes) {
    const low = t - PIT.depth; // the pit's bottom, where you bail
    const road = { top: ['road', (p: V3) => [p[2] / 4, (p[0] - x0) / (x1 - x0)]] } as Parameters<Mesher['box']>[7];
    const shaft = shafts.find((s) => Math.abs(tx(s.drain[0]) - x0) < 0.5);
    if (shaft) {
      const [h0, h1] = [HILLSIDE.backWalk, HILLSIDE.nearWalk];
      const top = (level.streetY - shaft.top!) / TILE;
      m.box(x0, x1, B, low, low, HILLSIDE.crossFar, h0, road);
      m.box(x0, x1, B, low, low, h1, HILLSIDE.rowB[1], road);
      //the hole's back, the cross street's dirt and its kerb's edge, down to the deep's roof
      m.box(x0, x1, top, low, low, h0 - 0.2, h0, { front: ['concrete', cf] });
    } else m.box(x0, x1, B, low, low, HILLSIDE.crossFar, HILLSIDE.rowB[1], road);
    yield* tee(x0, x1, low);
  }
  const cut = (xa: number, xb: number) => [...crossings, ...holes].some(([a, b]) => xb > a - 0.1 && xa < b + 0.1);
  //the tunnels' mouths at the feet of the hill (src/traffic/tunnel.ts): the back row of houses makes way for them
  const portals = mouths(level).map((p): [number, number] => [tx(p.x0), tx(p.x1)]);
  for (const [x0, x1] of portals) portal(m, x0, x1, laneHeight(ground, hill, (x0 + x1) / 2));
  const atPortal = (xa: number, xb: number) => portals.some(([a, b]) => xb > a - 0.3 && xa < b + 0.3);
  //row houses stepping down the hill behind the back sidewalk, and a row further up it
  const rng = makeRng(level.layout.seed * 53 + level.layout.floor * 7);
  const trng = makeRng(level.layout.seed * 71 + level.layout.floor * 13); // the trees' own shapes
  group.add(treeWarm());
  const lane = (x: number) => laneHeight(ground, hill, x);
  //each stretch of hill, tiles: the opening descent from off the left of the screen
  const stretches = hillStretches(level);
  const [bz0, bz1] = HILLSIDE.backRow;
  const [uz1, uz0, up] = HILLSIDE.upRow;
  const china = chinatownSpans(level);
  const inChina = (a: number, b: number) => overlaps(china, a, b);
  for (const [s0, s1] of stretches) {
    yield* houseRowSteps(m, rng, s0, s1 + 1, bz1, bz0, (a, b) => lane((a + b) / 2) + c, (a, b) => lowest(ground, hill, a, b) - 0.5, (a, b) => cut(a, b) || atPortal(a, b) || inChina(a, b), { bay: 0.75, chimney: 0, hip: true, shrub: 0.3 });
    yield* houseRowSteps(m, rng, s0, s1 + 1, uz0, uz1, (a, b) => lane((a + b) / 2) + up, () => B, (a, b) => cut(a, b) || inChina(a, b), { bay: 0.6, chimney: 0.3, hip: true, shrub: 0 });
    //tall palms and big shade trees between the rows, standing over the back row's roofs now and then (trees.ts)
    for (let x = s0 + 4 + rng() * 10; x < s1 - 2; x += 14 + rng() * 16) {
      if (inChina(x - 1, x + 1)) continue;
      const k = rng(); // (the hill's rng, drawn as it was for the old cypresses, so the houses don't move)
      plantTree(group, trng, k < 0.6 ? 'palm' : 'leafy', k < 0.6 ? 'tall' : 'big', x, lane(x) + up * 0.5, (bz1 + uz0) / 2);
    }
  }
  //Chinatown: tenements along the street with their shops, taller ones crowding up the hill behind, cables strung
  //in bundles along the street and from the street's blocks up to the ones behind
  const crng = chinatownRng(level.layout.seed, level.layout.floor);
  for (const [a, b] of china) {
    if (sliceDone()) yield;
    const street = tenementRow(m, crng, a, b, bz1, bz0, (xa, xb) => lane((xa + xb) / 2) + c, (xa, xb) => lowest(ground, hill, xa, xb) - 0.5, (xa, xb) => cut(xa, xb) || atPortal(xa, xb), [2, 4], true);
    tenementRow(m, crng, a - 2, b + 2, uz0, uz1, (xa, xb) => lane((xa + xb) / 2) + up, () => B, cut, [4, 7], false);
    for (let i = 1; i < street.length; i++) {
      const [x0] = street[i - 1];
      const [, x1] = street[i];
      const h0 = lane(x0) + c;
      const h1 = lane(x1) + c;
      for (const [dy, z] of [[4.4, bz0 + 0.25], [5.6, bz0 + 0.5], [7.2, bz0 + 0.15]] as const) cables(m, [x0, h0 + dy, z], [x1, h1 + dy, z], 0.5, 2 + randInt(crng, 3), crng);
      if (crng() < 0.5) {
        const x = (x0 + x1) / 2;
        cables(m, [x, lane(x) + c + 6, bz0], [x + (crng() - 0.5) * 3, lane(x) + up + 9, uz1], 1.2, 3, crng);
      }
    }
  }
  //power poles along the back sidewalk with their wires sagging between them (photo 3), street trees between poles
  const P = HILLSIDE.pole;
  const poles: [number, number][] = [];
  const along = stretches.flatMap(([s0, s1]) => {
    const xs: number[] = [];
    for (let x = Math.max(s0, ground.length ? ground[0].x0 : 0) + 2; x < s1 - 2; x += P.every[0] + rng() * (P.every[1] - P.every[0])) xs.push(x);
    return xs;
  });
  const topLine = level.rails.filter((r) => r.top).map((r) => [tx(r.x0), tx(r.x1)]);
  for (const x of along) {
    if (holes.some(([a, b]) => x > a - 0.5 && x < b + 0.5)) continue;
    if (atPortal(x - 1, x + 1)) continue; // clear of the tunnel's mouth, where the cruiser swings out
    if (topLine.some(([a, b]) => x > a - 1 && x < b + 1)) continue; // the top route's line hangs there instead
    if (inChina(x - 1, x + 1)) continue; // Chinatown strings its cables off the tenements
    const top = lane(x) + c + P.height;
    poles.push([x, top]);
    const pole = rectUv(SWATCH.pole);
    oct(m, x, P.z, 0.11, B, top, pole, 0.08);
    m.box(x - 0.07, x + 0.07, top - 0.5, top - 0.36, top - 0.36, P.z - 0.7, P.z + 0.7, { top: ['house', pole], front: ['house', pole], back: ['house', pole], left: ['house', pole], right: ['house', pole] });
    m.box(x - 0.06, x + 0.06, top - 1.2, top - 1.08, top - 1.08, P.z - 0.45, P.z + 0.45, { top: ['house', pole], front: ['house', pole], left: ['house', pole], right: ['house', pole] });
    if (rng() < 0.35) oct(m, x + 0.3, P.z, 0.2, top - 2.4, top - 1.6, rectUv(SWATCH.grey));
  }
  const sag = (a: V3, b: V3, drop: number) => {
    const n = 8;
    for (let k = 0; k < n; k++) {
      const p = (i: number): V3 => {
        const u = i / n;
        return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - drop * 4 * u * (1 - u), a[2]];
      };
      const [p0, p1] = [p(k), p(k + 1)];
      const hw = P.wire / 2;
      m.quad('wire', [p0[0], p0[1] - hw, p0[2]], [p1[0], p1[1] - hw, p1[2]], [p1[0], p1[1] + hw, p1[2]], [p0[0], p0[1] + hw, p0[2]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    }
  };
  const sameStretch = (xa: number, xb: number) => stretches.some(([s0, s1]) => xa >= s0 && xb <= s1);
  for (let i = 1; i < poles.length; i++) {
    const [xa, ta] = poles[i - 1];
    const [xb, tb] = poles[i];
    if (!sameStretch(xa, xb)) continue;
    for (const dz of [-0.55, 0, 0.55]) sag([xa, ta - 0.32, P.z + dz], [xb, tb - 0.32, P.z + dz], 0.35 + Math.abs(dz) * 0.3);
    for (const dz of [-0.35, 0.35]) sag([xa, ta - 1.04, P.z + dz], [xb, tb - 1.04, P.z + dz], 0.55);
  }
  for (let i = 1; i < poles.length; i++) {
    const [xa] = poles[i - 1];
    const [xb] = poles[i];
    const x = (xa + xb) / 2 + (rng() - 0.5) * 2;
    if (xb - xa > 7 && xb - xa < 20 && rng() < 0.55 && !cut(x - 1.2, x + 1.2) && !atPortal(x - 1.2, x + 1.2) && !inChina(x - 1.2, x + 1.2)) {
      //street palms and leafy street trees, under the wires (trees.ts)
      const k = rng(); // (drawn as it was for the old trees' height, so the rest of the hill doesn't move)
      const [kind, size] = k < 0.4 ? (['palm', trng() < 0.5 ? 'short' : 'bent'] as const) : (['leafy', k < 0.75 ? 'round' : 'small'] as const);
      plantTree(group, trng, kind, size, x, lane(x) + c, P.z + 0.3);
    }
  }
  //where the night city bolts street lights onto the poles (street-lights.ts): under the wires, over the road
  group.userData.poleLamps = poles.map(([x, top]) => ({ x, y: top - 1.9, z: P.z, ground: lane(x), slope: (lane(x + 1) - lane(x - 1)) / 2 }));
  yield* m.buildSteps(group);
}

// a tunnel's mouth from x0 to x1 (tiles) at the back of the road, the ground there `base` high: a board-formed
// concrete headwall with an arched opening into the dark, lamps along the inside, the hill's garden on top and a
// driveway across the sidewalk for the traffic swinging in and out (the cruiser comes out of here behind you)
function portal(m: Mesher, x0: number, x1: number, base: number): void {
  const F = TUNNEL.face;
  const back = HILLSIDE.upRow[0]; // the row further up the hill stands behind it
  const H = base + TUNNEL.height;
  const [ox0, ox1] = [x0 + TUNNEL.open[0], x0 + TUNNEL.open[1]];
  const r = (ox1 - ox0) / 2;
  const cx = (ox0 + ox1) / 2;
  const spring = base + TUNNEL.height - r - 0.5;
  const deep = TUNNEL.deep - 1;
  const cf = UV.front(2, 2);
  const cs = UV.side(2, 2);
  const dark = rectUv(SWATCH.dark);
  const trim = rectUv(SWATCH.trim);
  const B = HILLSIDE.bottom;
  //the piers either side of the opening, the mass of the hill behind them and its sides
  m.box(x0, ox0, B, H, H, back, F, { front: ['concrete', cf], left: ['concrete', cs] });
  m.box(ox1, x1, B, H, H, back, F, { front: ['concrete', cf], right: ['concrete', cs] });
  //over the opening, down to the arch
  const N = 12;
  const arc = (k: number): [number, number] => [cx - r * Math.cos((Math.PI * k) / N), spring + r * Math.sin((Math.PI * k) / N)];
  for (let k = 0; k < N; k++) {
    const [ax, ay] = arc(k);
    const [bx, by] = arc(k + 1);
    m.quad('concrete', [ax, ay, F], [bx, by, F], [bx, H, F], [ax, H, F], cf);
    //the ring of voussoirs round the arch, standing proud of the face
    const out = (x: number, y: number, d: number): V3 => [cx + (x - cx) * (1 + d / r), spring + (y - spring) * (1 + d / r), F + 0.03];
    m.quad('house', out(ax, ay, 0), out(bx, by, 0), out(bx, by, 0.22), out(ax, ay, 0.22), trim);
    //the barrel vault inside
    m.quad('house', [bx, by, F], [ax, ay, F], [ax, ay, deep], [bx, by, deep], dark);
  }
  m.quad('house', [ox0 - 0.03, base, F + 0.03], [ox0 + 0.19, base, F + 0.03], [ox0 + 0.19, spring, F + 0.03], [ox0 - 0.03, spring, F + 0.03], trim);
  m.quad('house', [ox1 - 0.19, base, F + 0.03], [ox1 + 0.03, base, F + 0.03], [ox1 + 0.03, spring, F + 0.03], [ox1 - 0.19, spring, F + 0.03], trim);
  //inside: the walls up to the vault, the far dark, the roadway, a lamp every couple of tiles along each wall
  m.quad('house', [ox0, base, deep], [ox0, base, F], [ox0, spring, F], [ox0, spring, deep], dark);
  m.quad('house', [ox1, base, F], [ox1, base, deep], [ox1, spring, deep], [ox1, spring, F], dark);
  m.quad('house', [ox0, base, deep], [ox1, base, deep], [ox1, spring + r, deep], [ox0, spring + r, deep], dark);
  m.quad('road', [ox0, base + 0.004, F], [ox1, base + 0.004, F], [ox1, base + 0.004, deep], [ox0, base + 0.004, deep], UV.top(4, 1));
  for (let z = F - 0.8; z > deep + 0.5; z -= 1.8) {
    m.quad('house', [ox0 + 0.01, spring - 0.1, z + 0.35], [ox0 + 0.01, spring - 0.1, z - 0.35], [ox0 + 0.01, spring + 0.08, z - 0.35], [ox0 + 0.01, spring + 0.08, z + 0.35], trim);
    m.quad('house', [ox1 - 0.01, spring - 0.1, z - 0.35], [ox1 - 0.01, spring - 0.1, z + 0.35], [ox1 - 0.01, spring + 0.08, z + 0.35], [ox1 - 0.01, spring + 0.08, z - 0.35], trim);
  }
  //the headwall's coping, and the hill's garden on top with a shrub or two
  m.box(x0 - 0.12, x1 + 0.12, H - 0.05, H + 0.18, H + 0.18, F - 0.25, F + 0.12, { top: ['concrete', UV.top(2, 2)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
  m.quad('house', [x0, H, F - 0.25], [x1, H, F - 0.25], [x1, H, back], [x0, H, back], rectUv(SWATCH.leaf));
  shrub(m, x0 + 0.5, F - 0.7, H, true);
  shrub(m, x1 - 0.6, F - 1.4, H, false);
  //the driveway across the back sidewalk
  const walk = base + HILLSIDE.curb + 0.006;
  m.quad('road', [ox0 - 0.4, walk, HILLSIDE.road[0]], [ox1 + 0.4, walk, HILLSIDE.road[0]], [ox1 + 0.4, walk, F], [ox0 - 0.4, walk, F], UV.top(4, 1));
}

// ------------------------------------------------------------------------------------------- the foreground

// the near side for a whole floor (descent and street): the near sidewalk and its low wall, then two rows of houses
// below the lane stepping down toward the camera
export function buildForeground(level: Level, group: THREE.Group): void {
  run(buildForegroundSteps(level, group));
}

// buildForeground a piece at a time, yielding when the frame's slice is spent (slice.ts)
export function* buildForegroundSteps(level: Level, group: THREE.Group): Generator<void, void> {
  const m = new Mesher();
  const ground = level.hills ? descentGround(level) : [];
  const finale = tx(level.finaleX);
  const cols = level.street.length;
  const B = HILLSIDE.bottom;
  const near = HILLSIDE.nearWalk;
  const c = HILLSIDE.curb;
  const cs = UV.side(2, 2);
  const cf = UV.front(2, 2);
  const holes = gaps(ground);
  //where there's no ground in front: canals on the street, the crest jumps' cross streets on the hill
  const through = throughStreets(level);
  //and the sewer route's cutaway: the near sidewalk is a thin roof over it and no houses stand in front of it
  //(split where the deep's roof comes down: over it the sidewalk goes down to that)
  const roofs: [number, number, number][] = (level.sewers ?? []).flatMap((w): [number, number, number][] => {
    const thin = -SEWER_ROOF / TILE;
    if (w.top === undefined) return [[tx(w.x0) - 0.5, tx(w.x1) + 0.5, thin]];
    const at = tx(w.topAt ?? w.x0);
    const deepAt = (py: number) => (level.streetY - py) / TILE;
    return [...(at > tx(w.x0) ? [[tx(w.x0) - 0.5, at, w.top0 !== undefined ? deepAt(w.top0) : thin] as [number, number, number]] : []), [at, tx(w.x1) + 0.5, deepAt(w.top)]];
  });
  const sewers = roofs.map(([a, b]): [number, number] => [a, b]);
  const deepRoof = (x0: number, x1: number) => roofs.find(([a, b]) => x0 >= a - 0.01 && x1 <= b + 0.01)?.[2];
  const open = (x0: number, x1: number) => [...holes, ...through, ...sewers].some(([a, b]) => x1 > a - 0.1 && x0 < b + 0.1);
  //the street's near sidewalk and the low wall (the hill's sidewalk is part of buildHill; its wall is here)
  let x = level.hills ? Math.floor(finale) : Math.max(0, Math.floor(finale));
  while (x < cols) {
    if (!level.street[x]) {
      x++;
      continue;
    }
    let e = x;
    while (e + 1 < cols && level.street[e + 1]) e++;
    //(split round the sewers, where it's only as thick as the street over the tunnel)
    let a = x;
    for (const [w0, w1] of sewers.filter(([w0, w1]) => w1 > x && w0 < e + 1)) {
      if (w0 > a) m.box(a, w0, B, c, c, HILLSIDE.road[1], near, { top: ['walk', UV.top(1, 1)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
      const [b0, b1] = [Math.max(a, w0), Math.min(e + 1, w1)];
      m.box(b0, b1, Math.min(c - 0.1, deepRoof(b0, b1) ?? -SEWER_ROOF / TILE), c, c, HILLSIDE.road[1], near, { top: ['walk', UV.top(1, 1)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
      a = b1;
    }
    if (a < e + 1) m.box(a, e + 1, B, c, c, HILLSIDE.road[1], near, { top: ['walk', UV.top(1, 1)], front: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
    x = e + 1;
  }
  //the low wall: along the hill's sidewalk (following it) and the street's
  const wz0 = near - 0.22;
  const wall = (x0: number, x1: number, t0: number, t1: number) =>
    m.box(x0, x1, Math.min(t0, t1) - 0.3, t0 + c + HILLSIDE.wall, t1 + c + HILLSIDE.wall, wz0, near + 0.02, { top: ['concrete', UV.top(2, 2)], front: ['concrete', cf], back: ['concrete', cf], left: ['concrete', cs], right: ['concrete', cs] });
  for (const g of ground) {
    if (g.kind === 'stairs') {
      const steps = Math.round(g.x1 - g.x0);
      for (let k = 0; k < steps; k++) {
        const t = g.t0 + ((g.t1 - g.t0) * (k + 1)) / steps;
        wall(g.x0 + k, g.x0 + k + 1, t, t);
      }
    } else {
      //broken where a Chinatown cross street runs through
      let a = g.x0;
      for (const [c0, c1] of through.filter(([c0, c1]) => c1 > g.x0 && c0 < g.x1).sort((p, q) => p[0] - q[0])) {
        if (c0 > a) wall(a, c0, g.t0 + ((g.t1 - g.t0) * (a - g.x0)) / (g.x1 - g.x0), g.t0 + ((g.t1 - g.t0) * (c0 - g.x0)) / (g.x1 - g.x0));
        a = Math.max(a, c1);
      }
      if (a < g.x1) wall(a, g.x1, g.t0 + ((g.t1 - g.t0) * (a - g.x0)) / (g.x1 - g.x0), g.t1);
    }
  }
  for (let s = Math.max(0, Math.floor(finale)); s < cols; ) {
    if (!level.street[s]) {
      s++;
      continue;
    }
    let e = s;
    while (e + 1 < cols && level.street[e + 1]) e++;
    wall(s, e + 1, 0, 0);
    s = e + 1;
  }
  //two rows of houses below the lane, each roofline stepping down with the lowest lane over it
  const rng = makeRng(level.layout.seed * 67 + level.layout.floor * 13);
  const hill = onHill(level);
  const low = (a: number, b: number) => frontRoof(ground, hill, a, b);
  const [az0, az1, adrop] = HILLSIDE.rowA;
  const [bz0, bz1, bdrop] = HILLSIDE.rowB;
  const storeys = 3 * HILLSIDE.storey;
  const china = chinatownSpans(level);
  const notChina = (a: number, b: number) => open(a, b) || overlaps(china, a, b);
  yield* houseRowSteps(m, rng, -10, cols + 24, az0, az1, (a, b) => low(a, b) - adrop - storeys, () => B, notChina, { bay: 0.7, chimney: 0.35, hip: false, shrub: 0.25 });
  yield* houseRowSteps(m, rng, -10, cols + 24, bz0, bz1, (a, b) => low(a, b) - bdrop - storeys, () => B, notChina, { bay: 0.6, chimney: 0.3, hip: false, shrub: 0.2 });
  //Chinatown's rooftops below the lane, their water tanks and shacks
  const crng = chinatownRng(level.layout.seed + 1, level.layout.floor);
  for (const [a, b] of china) {
    tenementRow(m, crng, a, b, az0, az1, (xa, xb) => low(xa, xb) - adrop - 3 * HILLSIDE.storey, () => B, open, [3, 3], false);
    tenementRow(m, crng, a, b, bz0, bz1, (xa, xb) => low(xa, xb) - bdrop - 3 * HILLSIDE.storey, () => B, open, [3, 3], false);
  }
  yield* m.buildSteps(group);
}
