// The street's storefronts (art/storefronts.py, from zack's photos of New York fronts, 2026-11-02): a pizza place, a
// tattoo shop and a liquor store, the same kind of prop as the skate shop's GNAR SUPPLY (shop-front.ts). They stand
// at the back of the sidewalk along the city's streets, in place of a stretch of the wall there (kit.ts), every so
// often on a plain stretch: not at a cross street, a landmark, a building or ledge on the street, a canal or the gate.
// Each is one vertex-coloured mesh plus a glowing one (the lit windows, the oven, the bulbs), so a floor's
// storefronts batch into a couple of draws; the signs are painted on canvases here (our own names, no real shop's).
import * as THREE from 'three';
import { DEPTH, depthStep } from './depth';
import { flatSplit, hasModel } from './models';
import { TILE } from '../physics/constants';
import { inHill, type Level } from '../physics/level';
import { makeRng, randInt } from '../gen/rng';

export type StorefrontKind = 'pizza' | 'tattoo' | 'liquor';

// a painted plane on the model: its middle (x, y up, z toward the camera from the front face) and size, in tiles;
// tilt leans its top back (the A-frame board)
interface Plate {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  tilt?: number;
  paint: (g: CanvasRenderingContext2D, W: number, H: number) => void;
  see?: boolean; // see-through where it isn't painted (lettering on the awning)
}

export interface StorefrontDef {
  model: string; // the object in storefronts.glb
  name: string; // what the sign says: change it here
  w: number; // the front's width (tiles); a whole number of tiles either side of the middle, so the wall cuts clean
  plates: Plate[];
}

// the materials in storefronts.glb that light up rather than take light
const GLOW = new Set(['lqLit', 'pzFire', 'sfBulb', 'ttRing', 'lqShelf']);

// fonts the signs use (main.ts loads them): Bangers is the HUD's comic lettering, Pacifico a sign painter's script
const BLOCK = '"Bangers", "Arial Black", Impact, sans-serif';
const SCRIPT = '"Pacifico", "Brush Script MT", "Snell Roundhand", cursive';

// fit text to a width: the font size that makes it `w` wide (at most `max`)
function fit(g: CanvasRenderingContext2D, text: string, font: string, w: number, max: number): number {
  g.font = `${max}px ${font}`;
  const m = g.measureText(text).width;
  return m > w ? Math.floor((max * w) / m) : max;
}

// neon lettering: a wide soft glow in the tube's colour, then the tube, then its white-hot core
function neon(g: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, stroke = 0): void {
  g.save();
  g.shadowColor = color;
  g.fillStyle = color;
  for (const blur of [40, 18]) {
    g.shadowBlur = blur;
    g.fillText(text, x, y);
  }
  g.shadowBlur = 6;
  g.fillStyle = '#fff6ee';
  g.globalAlpha = 0.85;
  if (stroke) {
    g.lineWidth = stroke;
    g.strokeStyle = '#fff6ee';
    g.strokeText(text, x, y);
  } else g.fillText(text, x, y);
  g.restore();
}

// a swallow in flight, the old-school tattoo bird, facing right (flip for left), about `s` px across
function swallow(g: CanvasRenderingContext2D, x: number, y: number, s: number, flip: boolean, body: string, belly: string): void {
  g.save();
  g.translate(x, y);
  g.scale((flip ? -1 : 1) * s / 100, s / 100);
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(50, -8); // the beak
  g.quadraticCurveTo(30, -22, 8, -10);
  g.lineTo(-10, -48); // the top wing
  g.quadraticCurveTo(-4, -18, -18, -6);
  g.lineTo(-52, -22); // the forked tail
  g.lineTo(-34, 0);
  g.lineTo(-56, 18);
  g.lineTo(-16, 8);
  g.quadraticCurveTo(-2, 30, 16, 46); // the low wing
  g.quadraticCurveTo(14, 18, 24, 6);
  g.quadraticCurveTo(40, 4, 50, -8);
  g.fill();
  g.fillStyle = belly;
  g.beginPath();
  g.ellipse(18, -2, 16, 7, -0.2, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

export const STOREFRONTS: Record<StorefrontKind, StorefrontDef> = {
  pizza: {
    model: 'PizzaShop',
    name: "Mama Lou's",
    w: 7,
    plates: [
      {
        // the white sign box over the front: the name in green script, PIZZA in red block letters
        x: 0, y: 4.66, z: 0.405, w: 5.8, h: 1.04,
        paint: (g, W, H) => {
          g.fillStyle = '#f4efe4';
          g.fillRect(0, 0, W, H);
          g.strokeStyle = '#c9302a';
          g.lineWidth = 6;
          g.strokeRect(14, 14, W - 28, H - 28);
          g.textBaseline = 'middle';
          const name = STOREFRONTS.pizza.name;
          const ns = fit(g, name, SCRIPT, W * 0.42, 120);
          g.font = `${ns}px ${SCRIPT}`;
          g.fillStyle = '#0f5a50';
          g.fillText(name, 44, H / 2 + 4);
          g.fillStyle = '#1e8a7c';
          g.fillText(name, 40, H / 2);
          const ps = fit(g, 'PIZZA', BLOCK, W * 0.44, 170);
          g.font = `${ps}px ${BLOCK}`;
          const pw = g.measureText('PIZZA').width;
          g.fillStyle = '#7d1814';
          g.fillText('PIZZA', W - 48 - pw + 5, H / 2 + 9);
          g.fillStyle = '#d23a2c';
          g.fillText('PIZZA', W - 48 - pw, H / 2 + 4);
        },
      },
    ],
  },
  tattoo: {
    model: 'TattooShop',
    name: 'IRON HALO',
    w: 7,
    plates: [
      {
        // the oxblood sign board: the name small in cream, TATTOO big in gold circus letters, a swallow either end
        x: 0, y: 4.76, z: 0.305, w: 5.76, h: 1.16,
        paint: (g, W, H) => {
          g.fillStyle = '#6e1a1e';
          g.fillRect(0, 0, W, H);
          g.strokeStyle = '#d6a445';
          g.lineWidth = 4;
          g.strokeRect(12, 12, W - 24, H - 24);
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.font = `44px ${BLOCK}`;
          g.fillStyle = '#efe3c8';
          g.fillText(STOREFRONTS.tattoo.name.split('').join(' '), W / 2, H * 0.2);
          const ts = fit(g, 'TATTOO', BLOCK, W * 0.62, 150);
          g.font = `${ts}px ${BLOCK}`;
          g.lineJoin = 'round';
          g.lineWidth = 14;
          g.strokeStyle = '#120c0d';
          g.strokeText('TATTOO', W / 2 + 6, H * 0.62 + 6);
          g.fillStyle = '#120c0d';
          g.fillText('TATTOO', W / 2 + 6, H * 0.62 + 6);
          g.lineWidth = 8;
          g.strokeText('TATTOO', W / 2, H * 0.62);
          const grad = g.createLinearGradient(0, H * 0.4, 0, H * 0.85);
          grad.addColorStop(0, '#ffe08a');
          grad.addColorStop(0.55, '#d6a445');
          grad.addColorStop(1, '#a8701f');
          g.fillStyle = grad;
          g.fillText('TATTOO', W / 2, H * 0.62);
          swallow(g, W * 0.09, H * 0.56, 120, false, '#2f6fd0', '#d8392b');
          swallow(g, W * 0.91, H * 0.56, 120, true, '#2f6fd0', '#d8392b');
        },
      },
      {
        // the OPEN sign hung in the right-hand window
        x: 1.925, y: 2.65, z: -0.295, w: 1.45, h: 0.6,
        paint: (g, W, H) => {
          g.fillStyle = '#0d0b10';
          g.fillRect(0, 0, W, H);
          g.save();
          g.strokeStyle = '#46d0ff';
          g.shadowColor = '#46d0ff';
          g.shadowBlur = 16;
          g.lineWidth = 7;
          g.beginPath();
          g.roundRect(18, 16, W - 36, H - 32, 30);
          g.stroke();
          g.restore();
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.font = `${Math.round(H * 0.56)}px ${BLOCK}`;
          neon(g, 'OPEN', W / 2, H / 2 + 4, '#ff3b4a');
        },
      },
      {
        // the A-frame chalkboard on the sidewalk, leaning back
        x: -2.4, y: 0.575, z: 0.432, w: 0.56, h: 0.98, tilt: Math.atan2(0.13, 1.15),
        paint: (g, W, H) => {
          g.fillStyle = '#262b28';
          g.fillRect(0, 0, W, H);
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = '#f2efe6';
          g.font = `${Math.round(W * 0.2)}px ${BLOCK}`;
          g.fillText('WALK-INS', W / 2, H * 0.2);
          g.fillText('WELCOME', W / 2, H * 0.33);
          g.strokeStyle = '#f2efe6';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(W * 0.2, H * 0.41);
          g.lineTo(W * 0.8, H * 0.41);
          g.stroke();
          //a chalk heart with a banner, and the hours under it
          g.fillStyle = '#ff7a8a';
          g.beginPath();
          const cx = W / 2;
          const cy = H * 0.6;
          const r = W * 0.13;
          g.arc(cx - r * 0.7, cy - r * 0.3, r * 0.75, Math.PI, 0);
          g.arc(cx + r * 0.7, cy - r * 0.3, r * 0.75, Math.PI, 0);
          g.lineTo(cx, cy + r * 1.3);
          g.closePath();
          g.fill();
          g.fillStyle = '#f2efe6';
          g.font = `${Math.round(W * 0.12)}px ${BLOCK}`;
          g.fillText('NOON - LATE', W / 2, H * 0.83);
        },
      },
    ],
  },
  liquor: {
    model: 'LiquorStore',
    name: 'Night Owl',
    w: 8,
    plates: [
      {
        // the black box sign: the name in green neon script, LIQUORS in red neon block letters
        x: 0, y: 5.15, z: 0.505, w: 7.5, h: 1.4,
        paint: (g, W, H) => {
          g.fillStyle = '#121114';
          g.fillRect(0, 0, W, H);
          g.textBaseline = 'middle';
          const name = STOREFRONTS.liquor.name;
          const ns = fit(g, name, SCRIPT, W * 0.3, 96);
          g.font = `${ns}px ${SCRIPT}`;
          neon(g, name, 34, H / 2 + 2, '#3df08a');
          const ls = fit(g, 'LIQUORS', BLOCK, W * 0.58, 150);
          g.font = `${ls}px ${BLOCK}`;
          const lw = g.measureText('LIQUORS').width;
          neon(g, 'LIQUORS', W - 34 - lw, H / 2 + 6, '#ff2d3a');
        },
      },
      {
        // white lettering along the awning's valance
        x: 0, y: 3.76, z: 0.735, w: 5.4, h: 0.3, see: true,
        paint: (g, W, H) => {
          g.clearRect(0, 0, W, H);
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.font = `${Math.round(H * 0.78)}px ${BLOCK}`;
          g.fillStyle = '#f6f0e2';
          g.fillText('WINES  ·  LIQUORS  ·  COLD BEER', W / 2, H / 2 + 2);
        },
      },
    ],
  },
};

const KINDS = Object.keys(STOREFRONTS) as StorefrontKind[];

// how they're spread along a floor
export const STOREFRONT_SPREAD = {
  first: [3, 9], // tiles from the start of the street to the first one
  gap: [1, 12], // tiles of plain wall between one and the next (none: side by side, as shops are)
  gate: 16, // none this close before the floor's gate (the shop's front and the gate's own dressing stand there)
};

export interface StorefrontSpot {
  kind: StorefrontKind;
  x: number; // its middle, in tiles
}

// where a floor's storefronts stand: along the street from `first` (where the descent comes down to it), on
// stretches clear of `blocked` (tile spans: cross streets, landmarks, the shop's front), never behind a building,
// stairs, a bank or a floating ledge (it would hide the sign), over a canal or on the hill; a kind never twice in a row
export function storefrontSpots(level: Level, first: number, blocked: [number, number][]): StorefrontSpot[] {
  const rng = makeRng(level.layout.seed * 53 + level.layout.floor * 7 + 1);
  const cols = level.street.length;
  const end = level.exitX / TILE - STOREFRONT_SPREAD.gate;
  const busy: [number, number][] = [
    ...blocked,
    ...level.surfaces.filter((s) => s.kind !== 'rail' && !s.sky && !s.sewer).map((s) => [s.x0 / TILE, s.x1 / TILE] as [number, number]),
  ];
  const clear = (x0: number, x1: number) => {
    if (busy.some(([a, b]) => x1 > a - 1 && x0 < b + 1)) return false;
    for (let c = Math.floor(x0); c < Math.ceil(x1); c++) {
      if (c < 0 || c >= cols || !level.street[c] || inHill(level, (c + 0.5) * TILE)) return false;
    }
    return true;
  };
  const out: StorefrontSpot[] = [];
  let last: StorefrontKind | null = null;
  const [f0, f1] = STOREFRONT_SPREAD.first;
  let x = first + f0 + randInt(rng, f1 - f0 + 1);
  while (x < end) {
    const options = KINDS.filter((k) => k !== last);
    const kind = options[randInt(rng, options.length)];
    const w = STOREFRONTS[kind].w;
    //its edges on whole tiles, so the wall cuts clean either side
    const mid = Math.round(x + w / 2 - (w % 2) / 2) + (w % 2) / 2;
    if (mid + w / 2 <= end && clear(mid - w / 2, mid + w / 2)) {
      out.push({ kind, x: mid });
      last = kind;
      const [g0, g1] = STOREFRONT_SPREAD.gap;
      x = mid + w / 2 + g0 + randInt(rng, g1 - g0 + 1);
    } else x += 2;
  }
  return out;
}

// the tile span a storefront takes along the wall
export function storefrontSpan(s: StorefrontSpot): [number, number] {
  const w = STOREFRONTS[s.kind].w;
  return [s.x - w / 2, s.x + w / 2];
}

// the painted signs: one canvas each, painted once (and again once the fonts are in, if they weren't yet)
const canvases = new Map<Plate, HTMLCanvasElement>();
const repaint = new Set<() => void>();
let fontsAsked = false;
function plateCanvas(p: Plate): HTMLCanvasElement {
  let c = canvases.get(p);
  if (c) return c;
  c = document.createElement('canvas');
  const px = 1024 / Math.max(p.w, p.h * 1.5);
  c.width = Math.round(p.w * px);
  c.height = Math.round(p.h * px);
  const canvas = c;
  const paint = () => {
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, canvas.width, canvas.height);
    p.paint(g, canvas.width, canvas.height);
  };
  paint();
  canvases.set(p, c);
  if (document.fonts && !fontsAsked) {
    fontsAsked = true;
    const want = [`100px ${BLOCK}`, `100px ${SCRIPT}`];
    if (!want.every((f) => document.fonts.check(f))) {
      Promise.all(want.map((f) => document.fonts.load(f))).then(() => repaint.forEach((r) => r()), () => {});
    }
  }
  repaint.add(paint);
  return c;
}

// a floor's materials: the fronts' lit and glowing vertex colours, shared by every storefront on it (so they batch)
export interface StorefrontMats {
  body: THREE.MeshLambertMaterial;
  glow: THREE.MeshBasicMaterial;
}
export function storefrontMats(): StorefrontMats {
  return { body: new THREE.MeshLambertMaterial({ vertexColors: true }), glow: depthStep(new THREE.MeshBasicMaterial({ vertexColors: true }), DEPTH.mark) }; // (lit trim, flush with the body: depth.ts)
}

// one storefront, its origin on the ground at the middle of its face; null if the model isn't loaded. `upstairs`
// false leaves off the storey over the shop (the title's street stands the shops under its own building). Its meshes
// are its own (a floor's kit disposes what it holds), the signs' canvases are shared
export function makeStorefront(kind: StorefrontKind, mats: StorefrontMats, upstairs = true): THREE.Group | null {
  const def = STOREFRONTS[kind];
  if (!hasModel(def.model)) return null;
  const group = new THREE.Group();
  group.name = `storefront:${kind}`;
  for (const name of upstairs ? [def.model, `${def.model}Up`] : [def.model]) {
    const parts = flatSplit(name, GLOW);
    if (!parts) continue;
    group.add(new THREE.Mesh(parts.lit.clone(), mats.body));
    if (parts.glow) {
      const glow = new THREE.Mesh(parts.glow.clone(), mats.glow);
      glow.userData.noInk = true;
      group.add(glow);
    }
  }
  for (const p of def.plates) {
    const tex = new THREE.CanvasTexture(plateCanvas(p));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    //the canvas may be repainted once the fonts are in: the texture follows, while its floor's kit is about
    const follow = () => (tex.needsUpdate = true);
    repaint.add(follow);
    tex.addEventListener('dispose', () => repaint.delete(follow));
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: !!p.see, depthWrite: !p.see });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat);
    sign.name = 'sign';
    sign.position.set(p.x, p.y, p.z);
    if (p.tilt) sign.rotation.x = -p.tilt;
    sign.userData.noInk = true;
    sign.userData.keep = true; // its own texture: not worth batching, and the ink must skip it
    group.add(sign);
  }
  return group;
}
