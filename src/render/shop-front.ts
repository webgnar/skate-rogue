// The skate shop's storefront, GNAR SUPPLY (art/skateshop.py, from zack's photo of a real shop): it stands at the
// back of the sidewalk behind the gate of the floor whose road leads to the shop, so the shop menu opens in front of
// it. One vertex-coloured mesh and its ink, plus the hand-lettered sign painted on a canvas. Built once, moved from
// floor to floor; the kit leaves a piece of its back wall loose where it stands (shopWall), and that is hidden.
import * as THREE from 'three';
import { flatGeometry, hasModel } from './models';
import { inkify } from './toon';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import type { Road } from '../gen/roads';

export const SHOP_FRONT = {
  name: 'GNAR SUPPLY',
  w: 9, // the model's width (tiles)
  ahead: -2.5, // its middle this far past the gate: behind it, so it's in view as Lou skates up (and the gate stands before its right-hand window)
  z: -3.5, // its face, at the back of the sidewalk (kit.ts STREET_BACK)
  wall: 4.8, // half the width of back wall the kit leaves loose for it
  sign: { x: 0, y: 4.75, w: 7.6, h: 1.14, z: 0.265 }, // the sign board's face (art/skateshop.py), from the model's origin
};

// where a floor's shop would stand, in tiles: its middle, on the street at the gate. Only floors that can end at the
// shop: an escape (the road picked before it may be the shop's) and a floor with the shop at its fork
export function shopSpot(level: Level): number | null {
  const fork = level.fork;
  const shopFork = !!fork && [fork.high, fork.low, fork.sewer].some((r) => r?.kind === 'shop');
  if (!level.escape && !shopFork) return null;
  return level.exitX / TILE + 0.5 + SHOP_FRONT.ahead;
}

// whether this floor's gate leads to the shop: the road it leads on to (an escape goes on by the road picked before
// it; a floor that ends an act leads to its escape first)
export function gateLeadsToShop(level: Level, next: Road | null): boolean {
  return next?.kind === 'shop' && shopSpot(level) !== null;
}

// the sign: hand lettered in white on black (Bangers, the HUD's comic lettering), each letter a little off its
// neighbours, with a red brush swoosh under. Redrawn once the font is in, if it wasn't yet
const FONT = '"Bangers", "Arial Black", Impact, sans-serif';
function signTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 160;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  paintSign(canvas);
  const want = `120px ${FONT}`;
  if (document.fonts && !document.fonts.check(want)) {
    document.fonts.load(want).then(() => {
      paintSign(canvas);
      tex.needsUpdate = true;
    }, () => {});
  }
  return tex;
}

function paintSign(canvas: HTMLCanvasElement): void {
  const W = canvas.width;
  const H = canvas.height;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#121214';
  g.fillRect(0, 0, W, H);
  const text = SHOP_FRONT.name;
  const size = 128;
  g.font = `${size}px ${FONT}`;
  g.textBaseline = 'middle';
  const gap = 10;
  const widths = [...text].map((c) => (c === ' ' ? size * 0.32 : g.measureText(c).width));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
  let x = (W - total) / 2;
  //a seeded wobble, so the sign is the same every time
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const w = widths[i];
    if (c !== ' ') {
      g.save();
      g.translate(x + w / 2, H / 2 - 8 + rnd() * 5);
      g.rotate(rnd() * 0.07);
      g.scale(1 + rnd() * 0.05, 1 + rnd() * 0.07);
      //a brushy edge: the letter in grey a hair larger, then white
      g.fillStyle = '#cfcac0';
      g.fillText(c, -w / 2 + 2, 2);
      g.fillStyle = '#f6f2e8';
      g.fillText(c, -w / 2, 0);
      g.restore();
    }
    x += w + gap;
  }
  //a hand-drawn underline swoosh in red
  g.strokeStyle = '#d8392b';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(W * 0.2, H - 26);
  g.quadraticCurveTo(W * 0.5, H - 14, W * 0.8, H - 28);
  g.stroke();
}

export class ShopFront {
  readonly group = new THREE.Group();
  private built = false;

  constructor() {
    this.group.visible = false;
    this.group.name = 'shopFront';
  }

  private build(): boolean {
    if (this.built) return true;
    if (!hasModel('SkateShop')) return false;
    const geo = flatGeometry('SkateShop');
    if (!geo) return false;
    this.built = true;
    const front = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    const { x, y, w, h, z } = SHOP_FRONT.sign;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture() }));
    sign.position.set(x, y, z);
    this.group.add(front, sign);
    inkify(this.group, { outline: (m) => m === front });
    return true;
  }

  // stand it on `kit` (this floor's, at the world's origin) at x tiles, hiding the wall the kit left loose there;
  // null takes it away
  place(kit: THREE.Group | null, x: number | null): void {
    if (x === null || !kit || !this.build()) {
      this.detach();
      return;
    }
    kit.add(this.group);
    this.group.position.set(x, 0, SHOP_FRONT.z);
    this.group.visible = true;
    kit.traverse((o) => {
      if (o.userData.shopWall) o.visible = false;
    });
  }

  // off the kit it stands on, before that kit is thrown away (its geometry is the model's, kept)
  detach(): void {
    this.group.removeFromParent();
    this.group.visible = false;
  }
}
