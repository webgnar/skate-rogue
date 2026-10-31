// The sky's set pieces (src/sim/sky.ts SkyPieceSim, src/gen/sky-beats.ts), drawn from the sim each frame: an ad
// blimp moored over the hill, its back the deck you ride; a window washer's rig hung on its ropes, dropping once
// you're on it; a tower crane whose jib slews out of the lane and back round its mast; and the paper billboards
// standing across the gaps, torn away when you burst through. Drawn from zack's refs (shared folder sky/refs/): a
// Goodyear-style silver blimp, a yellow lattice tower crane, a window washer's aluminium cradle, a billboard on a
// catwalk. Each piece is a few merged meshes (one per material), inked.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { at } from '../game/interp';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import type { Sky, SkyPieceSim } from '../sim/sky';
import { groundAt } from '../gen/top-route';
import { toX, toY } from './kit';
import { adTexture, adUv } from './sky-kit';
import { inkify } from './toon';

const T = (px: number) => px / TILE;

// a piece's parts, gathered per material and merged into one mesh each, so a whole crane is a handful of draws
class Parts {
  private readonly by = new Map<THREE.Material, THREE.BufferGeometry[]>();

  // a box w x h x d at (x, y, z), turned rz about z then ry about y
  box(m: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rz = 0, ry = 0): void {
    this.add(m, new THREE.BoxGeometry(w, h, d), x, y, z, rz, ry);
  }

  // a bar from a to b, t thick
  bar(m: THREE.Material, a: [number, number, number], b: [number, number, number], t: number): void {
    const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const g = new THREE.BoxGeometry(t, v.length(), t);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    this.push(m, g);
  }

  add(m: THREE.Material, g: THREE.BufferGeometry, x: number, y: number, z: number, rz = 0, ry = 0): void {
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    this.push(m, g);
  }

  private push(m: THREE.Material, g: THREE.BufferGeometry): void {
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') ng.deleteAttribute(k);
    const list = this.by.get(m) ?? [];
    list.push(ng);
    this.by.set(m, list);
  }

  into(parent: THREE.Object3D): void {
    for (const [m, list] of this.by) {
      const g = mergeGeometries(list);
      if (g) parent.add(new THREE.Mesh(g, m));
    }
    this.by.clear();
  }
}

// a lattice girder along x from x0 to x1: a triangle of chords (bottom two, top one) braced with diagonals
function truss(p: Parts, m: THREE.Material, x0: number, x1: number, y: number, z: number, h: number, d: number, t = 0.06): void {
  const top: [number, number] = [y + h, z];
  const bl: [number, number] = [y, z - d / 2];
  const br: [number, number] = [y, z + d / 2];
  for (const [cy, cz] of [top, bl, br]) p.box(m, x1 - x0, t * 1.6, t * 1.6, (x0 + x1) / 2, cy, cz);
  const step = Math.max(0.5, h * 1.1);
  for (let x = x0, k = 0; x < x1 - 0.01; x += step, k++) {
    const nx = Math.min(x1, x + step);
    const [a, b] = k % 2 ? [x, nx] : [nx, x];
    p.bar(m, [a, bl[0], bl[1]], [b, top[0], top[1]], t);
    p.bar(m, [a, br[0], br[1]], [b, top[0], top[1]], t);
    p.bar(m, [x, y, bl[1]], [x, y, br[1]], t);
  }
}

// a square lattice mast from y0 up to y1, w wide, X-braced each w
function mast(p: Parts, m: THREE.Material, x: number, z: number, y0: number, y1: number, w: number, t = 0.07): void {
  const h = y1 - y0;
  for (const dx of [-w / 2, w / 2]) for (const dz of [-w / 2, w / 2]) p.box(m, t * 1.6, h, t * 1.6, x + dx, y0 + h / 2, z + dz);
  for (let y = y0; y < y1 - 0.01; y += w) {
    const ny = Math.min(y1, y + w);
    p.bar(m, [x - w / 2, y, z + w / 2], [x + w / 2, ny, z + w / 2], t);
    p.bar(m, [x + w / 2, y, z + w / 2], [x - w / 2, ny, z + w / 2], t);
    p.bar(m, [x - w / 2, y, z - w / 2], [x - w / 2, ny, z + w / 2], t);
    p.bar(m, [x + w / 2, y, z + w / 2], [x + w / 2, ny, z - w / 2], t);
  }
}

let blimpSkin: THREE.Texture | null = null;
// the blimp's side: a silver envelope with panel seams, its name in big dark letters along the middle
function blimpTexture(): THREE.Texture {
  if (blimpSkin) return blimpSkin;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#dfe3ea');
  grad.addColorStop(0.55, '#b9bfca');
  grad.addColorStop(1, '#7d8494');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = 'rgba(40,40,60,0.35)';
  g.lineWidth = 2;
  for (let x = 0; x < 512; x += 32) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 128);
    g.stroke();
  }
  g.fillStyle = '#1b2a6a';
  g.fillRect(0, 86, 512, 6);
  g.fillStyle = '#ffd21a';
  g.fillRect(0, 92, 512, 4);
  g.font = 'bold 52px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = '#ffd21a';
  g.strokeText('GNAR RUN', 256, 56);
  g.fillStyle = '#1b2a6a';
  g.fillText('GNAR RUN', 256, 56);
  blimpSkin = new THREE.CanvasTexture(c);
  blimpSkin.colorSpace = THREE.SRGBColorSpace;
  blimpSkin.anisotropy = 4;
  return blimpSkin;
}

export class SkyPiecesView {
  readonly group = new THREE.Group();
  private pieces: { sim: SkyPieceSim; g: THREE.Group; moving: THREE.Object3D; ropes: THREE.Object3D[] }[] = [];
  private busts: THREE.Object3D[] = [];
  private readonly steel = new THREE.MeshLambertMaterial({ color: 0x55596a });
  private readonly alu = new THREE.MeshLambertMaterial({ color: 0xc4c9d2 });
  private readonly yellow = new THREE.MeshLambertMaterial({ color: 0xf0b418 });
  private readonly concrete = new THREE.MeshLambertMaterial({ color: 0x9a968e });
  private readonly navy = new THREE.MeshLambertMaterial({ color: 0x1b2a6a });
  private readonly gold = new THREE.MeshLambertMaterial({ color: 0xffd21a });
  private readonly orange = new THREE.MeshLambertMaterial({ color: 0xe8541e });
  private readonly glass = new THREE.MeshLambertMaterial({ color: 0x2a3550, emissive: 0x0a1428 });
  private readonly white = new THREE.MeshLambertMaterial({ color: 0xf2eef0 });
  private readonly rope = new THREE.MeshBasicMaterial({ color: 0x1a1424 });
  private readonly skin = new THREE.MeshLambertMaterial({ map: blimpTexture() });
  private readonly paper = new THREE.MeshLambertMaterial({ map: adTexture(), side: THREE.DoubleSide });

  reset(sky: Sky): void {
    for (const p of this.pieces) this.group.remove(p.g);
    for (const b of this.busts) this.group.remove(b);
    this.pieces = [];
    this.busts = [];
    const level = sky.level;
    const Y = (py: number) => toY(level, py);
    const foot = (px: number) => Y(groundAt(level, px) ?? level.streetY);
    for (const sim of sky.pieces) {
      const s = sim.site;
      const g = new THREE.Group();
      const moving = new THREE.Group();
      g.add(moving);
      const ropes: THREE.Object3D[] = [];
      const w = T(s.x1 - s.x0);
      const p = new Parts();
      if (s.kind === 'blimp') {
        //the envelope (zack's Goodyear ref): a long silver capsule whose top is the deck, its name along the side,
        //a cross of navy fins at the tail, the cabin slung under its middle
        const r = 1.9;
        const env = new THREE.CapsuleGeometry(r, w, 8, 24).rotateZ(Math.PI / 2);
        //the side wrap: u along it, v round it
        const pos = env.getAttribute('position') as THREE.BufferAttribute;
        const uv = env.getAttribute('uv') as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (w + 2 * r) + 0.5, 0.5 + Math.atan2(pos.getZ(i), -pos.getY(i)) / Math.PI / 1.2);
        p.add(this.skin, env, w / 2, -r, 0);
        p.add(this.navy, new THREE.SphereGeometry(0.5, 10, 8), w + r - 0.25, -r, 0); // the nose cap
        for (const [rx, h, d] of [[0, 2.2, 0.16], [Math.PI / 2, 2.2, 0.16]] as const) {
          const fin = new THREE.BoxGeometry(2.6, h * 2 + 0.4, d).rotateX(rx);
          p.add(this.navy, fin, -r * 0.55, -r, 0);
          const edge = new THREE.BoxGeometry(0.2, h * 2 + 0.4, d + 0.04).rotateX(rx);
          p.add(this.gold, edge, -r * 0.55 - 1.3, -r, 0);
        }
        //the cabin, its windows, and the struts up into the envelope
        p.box(this.alu, 3.4, 0.9, 1.1, w / 2 + 1, -2 * r - 0.3, 0);
        p.box(this.glass, 2.8, 0.35, 1.14, w / 2 + 1, -2 * r - 0.2, 0);
        for (const sx of [-1.2, 1.2]) p.bar(this.steel, [w / 2 + 1 + sx, -2 * r + 0.15, 0], [w / 2 + 1 + sx * 1.6, -2 * r + 0.7, 0], 0.06);
        p.into(moving);
        //moored: a line down to the hill
        const fx = s.x0 + 2 * TILE;
        const top = Y(s.y) - 2 * r;
        const bottom = foot(fx);
        if (top > bottom) {
          const line = new THREE.Mesh(new THREE.BoxGeometry(0.05, top - bottom, 0.05), this.rope);
          line.position.set(2, -2 * r - (top - bottom) / 2, -0.4);
          moving.add(line);
        }
      } else if (s.kind === 'rig') {
        //a window washer's cradle (zack's gondola refs): an aluminium deck, a mesh-backed guard rail behind and a
        //low one in front, orange stirrup frames at each end where the ropes tie on, a bucket and a toolbox aboard
        p.box(this.alu, w, 0.18, 1.3, w / 2, -0.09, -0.35);
        p.box(this.steel, w, 0.08, 0.05, w / 2, -0.22, 0.3);
        p.box(this.alu, w, 0.06, 0.06, w / 2, 1.05, -0.98);
        p.box(this.alu, w, 0.05, 0.05, w / 2, 0.55, -0.98);
        p.box(this.alu, w, 0.05, 0.05, w / 2, 0.45, 0.28);
        for (let x = 0.5; x < w - 0.3; x += 1) p.box(this.alu, 0.05, 1.05, 0.05, x, 0.52, -0.98);
        for (const rx of [0.12, w - 0.12]) {
          p.box(this.orange, 0.14, 1.5, 0.14, rx, 0.65, -0.98);
          p.box(this.orange, 0.14, 0.6, 0.14, rx, 0.25, 0.28);
          p.box(this.orange, 0.14, 0.14, 1.4, rx, 1.35, -0.35);
          p.box(this.orange, 0.14, 0.14, 1.3, rx, -0.1, -0.35);
        }
        p.box(this.orange, 0.5, 0.35, 0.3, w * 0.3, 0.17, -0.7);
        p.add(this.white, new THREE.CylinderGeometry(0.2, 0.16, 0.36, 10), w * 0.7, 0.18, -0.7);
        p.into(moving);
        //the davit up on the roof edge it hangs from: outrigger beams over the edge, the ropes down from their tips
        const d = new Parts();
        d.box(this.steel, w + 0.6, 0.25, 0.25, w / 2, 7, -0.35);
        for (const rx of [0.12, w - 0.12]) d.box(this.steel, 0.25, 0.25, 2.6, rx, 7, -1.6);
        d.into(g);
        for (const rx of [0.12, w - 0.12]) {
          const rope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1, 0.04), this.rope);
          rope.position.set(rx, 0, -0.35);
          g.add(rope);
          ropes.push(rope);
        }
      } else {
        //a tower crane (zack's refs): a yellow lattice mast up from the hill, the slewing unit and operator's cab on
        //top, a lattice jib out along the lane with its trolley and hook, a counter-jib behind with its concrete
        //weights, and the apex tower with pendant ties out to both
        const mx = T(s.mast! - s.x0);
        const top = Y(s.y);
        const bottom = foot(s.mast!);
        const m = new Parts();
        mast(m, this.yellow, mx, -1.2, bottom - top - 0.2, -0.75, 1.1);
        m.into(g);
        const pivot = new THREE.Group();
        pivot.position.set(mx, 0, -1.2);
        //(in the pivot's frame: the lane is z = 1.2, the jib runs along x from -mx to w - mx)
        const z = 1.2;
        const j0 = -mx;
        const j1 = w - mx;
        truss(p, this.yellow, 0.6, j1, -0.58, z, 0.55, 0.5); // its top chord is what you grind
        truss(p, this.yellow, j0, -0.6, -0.3, z, 0.4, 0.6);
        p.box(this.yellow, 1.3, 0.55, 1.3, 0, -0.55, z); // slewing unit
        p.box(this.yellow, 0.9, 0.9, 0.9, 0.3, -1.2, z + 0.75); // the cab, hung off the side
        p.box(this.glass, 0.6, 0.5, 0.05, 0.3, -1.1, z + 1.21);
        for (let k = 0; k < 3; k++) p.box(this.concrete, 0.4, 0.9, 0.7, j0 + 0.3 + k * 0.42, -0.95, z);
        mast(p, this.yellow, 0, z, -0.3, 2.2, 0.5, 0.05);
        p.bar(this.steel, [0, 2.2, z], [j1 * 0.7, 0.15, z], 0.04);
        p.bar(this.steel, [0, 2.2, z], [j0 + 0.2, 0.1, z], 0.04);
        //the trolley partway out, its hook hanging
        const tx = j1 * 0.62;
        p.box(this.steel, 0.5, 0.18, 0.6, tx, -0.55, z);
        p.box(this.rope, 0.03, 1.6, 0.03, tx, -1.4, z);
        p.box(this.orange, 0.3, 0.35, 0.2, tx, -2.3, z);
        p.into(pivot);
        g.add(pivot);
        g.userData.pivot = pivot;
      }
      g.position.set(toX(s.x0), Y(s.y), 0);
      inkify(g);
      this.pieces.push({ sim, g, moving, ropes });
      this.group.add(g);
    }
    //the paper billboards: a printed sheet across the lane in a steel frame on two poles, a lamp over it, turned so
    //you see its face
    sky.busts.forEach((b, i) => {
      const h = T(b.y1 - b.y0);
      const sheet = new THREE.Group();
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3, h * 0.8), this.paper);
      adUv(face, (i + 2) % 5);
      face.position.y = h * 0.1;
      face.userData.paper = true;
      sheet.add(face);
      const f = new Parts();
      for (const x of [-1.5, 1.5]) f.box(this.steel, 0.12, h, 0.12, x, 0, 0);
      f.box(this.steel, 3.1, 0.1, 0.12, 0, h / 2, 0);
      f.box(this.steel, 0.06, 0.06, 0.6, -0.8, h / 2 + 0.05, 0.3);
      f.box(this.alu, 0.35, 0.18, 0.3, -0.8, h / 2 + 0.05, 0.6);
      f.into(sheet);
      sheet.rotation.y = -1.0;
      sheet.position.set(toX(b.x), Y((b.y0 + b.y1) / 2), 0);
      inkify(sheet);
      this.busts.push(sheet);
      this.group.add(sheet);
    });
  }

  update(level: Level, skaterX: number): void {
    for (const { sim, g, moving, ropes } of this.pieces) {
      g.visible = Math.abs(sim.site.x0 - skaterX) < 1400 || Math.abs(sim.site.x1 - skaterX) < 1400;
      if (!g.visible) continue;
      const dy = toY(level, at(sim, 'y')) - toY(level, sim.site.y);
      moving.position.y = dy;
      if (sim.site.kind === 'swing') (g.userData.pivot as THREE.Object3D).rotation.y = at(sim, 'angle');
      //the ropes from the davit down to the cradle, wherever it's dropped to
      for (const r of ropes) {
        const len = 7 - dy - 1.35;
        r.scale.y = len;
        r.position.y = 7 - len / 2;
      }
    }
  }

  // a billboard burst through: the sheet is torn away, the frame stays
  bust(i: number): void {
    const b = this.busts[i];
    if (b) for (const c of b.children) if (c.userData.paper) c.visible = false;
  }
}
