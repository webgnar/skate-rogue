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
import type { CurvedRail, Level, Surface } from '../physics/level';
import type { Sky, SkyPieceSim } from '../sim/sky';
import { groundAt } from '../gen/top-route';
import { layerAct, STATION } from '../gen/clouds';
import { piecesOf } from '../gen/sky-line';
import { toX, toY } from './kit';
import { adTexture, adUv } from './sky-kit';
import { inkify } from './toon';
import { disposeGeometries } from './dispose';

const disposed = <T extends THREE.Object3D>(o: T): T => (disposeGeometries(o), o);

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

// tiles past a cloud's ends its puffs may bulge: as far as you can land on it, a truck hanging over (FEEL.wheelbase / 2)
const CLOUD_EDGE = 0.25;

// a cloud you land on, its top along y = 0 from x = 0 to w (tiles): a row of puffs whose tops are the deck, fatter
// darker ones bulging under them (zack's Mario refs: soft, round, comic)
function cloud(p: Parts, top: THREE.Material, under: THREE.Material, w: number, seed: number, thin = false): void {
  const n = Math.max(2, Math.round(w / (thin ? 0.9 : 1.2)));
  //(the puffs stay inside where you can land: the deck plus a truck's overhang, CLOUD_EDGE. Wider and they drew
  //cloud you dropped straight through, zack 2026-10-31: "make sure the collisions on the clouds are legit")
  const inside = (cx: number, half: number) => Math.min(Math.max(cx, half - CLOUD_EDGE), w + CLOUD_EDGE - half);
  for (let i = 0; i < n; i++) {
    const k = (seed * 7 + i * 13) % 5;
    const r = (thin ? 0.45 : 0.75) + k * 0.06;
    const x = inside(((i + 0.5) / n) * w, r * 1.25);
    const s = new THREE.SphereGeometry(r, 12, 8);
    s.scale(1.25, 0.8, 1);
    p.add(top, s, x, -r * 0.8 + 0.04 + (k % 3) * 0.06, 0.1 + (k % 2) * 0.15);
    if (!thin && i % 2 === 0) {
      const b = new THREE.SphereGeometry(r * 1.2, 12, 8);
      b.scale(1.3, 0.75, 1);
      p.add(under, b, inside(x + 0.3, r * 1.2 * 1.3), -r * 1.55, -0.2);
    }
  }
  //and a puff or two up behind, so it reads as a heap, not a slab
  if (!thin) for (const t of [0.3, 0.7]) p.add(top, new THREE.SphereGeometry(0.7 + (seed % 3) * 0.1, 12, 8).scale(1.3, 0.9, 1), w * t, 0.2, -1.0);
}

// Act 5, space (src/gen/clouds.ts HIGH): the cloud layer's pieces drawn as what's up there. Each keeps its deck along
// y = 0 from x = 0 to w (tiles), the same footing as the cloud it stands in for.
interface SpaceMats {
  hull: THREE.Material;
  dark: THREE.Material;
  panel: THREE.Material;
  foil: THREE.Material;
  rust: THREE.Material;
  light: THREE.Material;
  white: THREE.Material;
}

// a space station's deck: a hull plate on a truss, a module or two behind it, nav lights at its ends
function stationDeck(p: Parts, m: SpaceMats, w: number, seed: number): void {
  p.box(m.hull, w, 0.3, 2.2, w / 2, -0.15, -0.3);
  for (let x = 1.5; x < w - 0.5; x += 2) p.box(m.dark, 0.05, 0.31, 2.21, x, -0.15, -0.3); // its panel seams
  truss(p, m.dark, 0.3, w - 0.3, -1.05, -0.3, 0.6, 0.9, 0.05);
  for (const x of [0.15, w - 0.15]) p.box(m.light, 0.22, 0.22, 0.22, x, 0.05, 0.75);
  //modules behind the lane: pressurised cans along it, a radiator fin up off the odd one
  for (let x = 2 + (seed % 3); x < w - 2; x += 6) {
    p.add(m.white, new THREE.CylinderGeometry(0.9, 0.9, 3.2, 14).rotateZ(Math.PI / 2), x, 0.4, -1.9);
    p.box(m.dark, 0.2, 1.9, 1.9, x - 1.6, 0.4, -1.9);
    if ((seed + x) % 2 < 1) p.box(m.panel, 0.08, 2.2, 1.2, x + 0.6, 2.4, -1.9);
  }
}

// a solar panel wing: a thin blue grid on a spar (a wisp's footing: a short deck)
function solarPanel(p: Parts, m: SpaceMats, w: number): void {
  p.box(m.panel, w, 0.1, 1.8, w / 2, -0.05, -0.3);
  for (let x = 1; x < w; x += 1) p.box(m.dark, 0.04, 0.11, 1.81, x, -0.05, -0.3);
  p.box(m.dark, w, 0.11, 0.04, w / 2, -0.05, -0.3);
  p.box(m.foil, w + 0.3, 0.14, 0.14, w / 2, -0.18, -1.3); // the spar it hangs off, behind
}

// a sheet of junk that breaks off once you've stood on it (a thin cloud's): bent rusty plates, a snapped strut
function junkPlate(p: Parts, m: SpaceMats, w: number, seed: number): void {
  const n = Math.max(2, Math.round(w / 2));
  for (let i = 0; i < n; i++) {
    const pw = w / n;
    const tilt = (((seed + i * 5) % 5) - 2) * 0.03;
    p.box(i % 2 ? m.rust : m.dark, pw + 0.05, 0.16, 1.6 - (i % 3) * 0.2, pw * (i + 0.5), -0.08, -0.3, tilt);
  }
  p.bar(m.hull, [w * 0.3, -0.2, -0.6], [w * 0.55, -1.3, -0.9], 0.08);
}

// a piece of debris, drifting (a drifting cloud's): a flat-topped hunk of rock round a torn hull plate
function debris(p: Parts, m: SpaceMats, w: number, seed: number): void {
  p.box(m.hull, w, 0.22, 1.8, w / 2, -0.11, -0.3);
  for (let i = 0; i < Math.max(2, Math.round(w / 2.5)); i++) {
    const r = 0.8 + ((seed + i * 3) % 4) * 0.18;
    const rock = new THREE.IcosahedronGeometry(r, 0);
    rock.scale(1.2, 0.9, 1);
    p.add(m.rust, rock, Math.min(w - r, Math.max(r, (i + 0.5) * 2.5)), -r * 0.85, -0.5);
  }
  p.bar(m.dark, [w * 0.7, 0, -0.9], [w * 0.95, 1.4, -1.4], 0.1);
}

// a satellite (a balloon's): its gold-foiled body the deck, solar wings out behind, a dish
function satellite(p: Parts, m: SpaceMats, w: number): void {
  p.box(m.foil, w, 0.9, 1.4, w / 2, -0.45, -0.2);
  p.box(m.dark, w + 0.1, 0.1, 1.5, w / 2, -0.02, -0.2);
  p.box(m.dark, 0.12, 0.12, 4, w / 2, -0.45, -2.6);
  for (const z of [-2.2, -3.8]) p.box(m.panel, w * 1.6, 0.08, 1.4, w / 2, -0.45, z);
  const dish = new THREE.SphereGeometry(0.9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3).rotateX(Math.PI);
  p.add(m.white, dish, w / 2, -0.9 - 0.9 * 0.5, 0.1);
  p.box(m.light, 0.16, 0.16, 0.16, w - 0.1, 0.08, 0.5);
}

let balloonSkin: THREE.Texture | null = null;
// a hot air balloon's envelope: bright gores, red and gold and white
function balloonTexture(): THREE.Texture {
  if (balloonSkin) return balloonSkin;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  const cols = ['#e83a5a', '#ffd21a', '#f2eef8', '#2a6ad8'];
  for (let i = 0; i < 16; i++) {
    g.fillStyle = cols[i % cols.length];
    g.fillRect(i * 16, 0, 16, 64);
  }
  g.fillStyle = 'rgba(26,20,36,0.5)';
  for (let i = 0; i < 16; i++) g.fillRect(i * 16, 0, 1.5, 64);
  balloonSkin = new THREE.CanvasTexture(c);
  balloonSkin.colorSpace = THREE.SRGBColorSpace;
  return balloonSkin;
}

const RAINBOW = [0xe8322a, 0xff8a1e, 0xffd21a, 0x3cc85a, 0x2a6ad8, 0x8a4ae0];

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
  g.strokeText('SKATE ESCAPE', 256, 56);
  g.fillStyle = '#1b2a6a';
  g.fillText('SKATE ESCAPE', 256, 56);
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
  private readonly girder = new THREE.MeshLambertMaterial({ color: 0xc8402a }); // red oxide primer, as the staircase's
  private readonly glass = new THREE.MeshLambertMaterial({ color: 0x2a3550, emissive: 0x0a1428 });
  private readonly white = new THREE.MeshLambertMaterial({ color: 0xf2eef0 });
  private readonly rope = new THREE.MeshBasicMaterial({ color: 0x1a1424 });
  private readonly skin = new THREE.MeshLambertMaterial({ map: blimpTexture() });
  private readonly paper = new THREE.MeshLambertMaterial({ map: adTexture(), side: THREE.DoubleSide });
  private readonly puff = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x5a5866 });
  private readonly puffUnder = new THREE.MeshLambertMaterial({ color: 0xc8d4f4, emissive: 0x2a3050 });
  private readonly bands = RAINBOW.map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.25) }));
  private readonly wicker = new THREE.MeshLambertMaterial({ color: 0x9a6a40 });
  private readonly envelope = new THREE.MeshLambertMaterial({ map: balloonTexture() });
  // act 5's (space): station hull, its dark trusses, solar cells, gold foil, rust, nav lights
  private readonly space: SpaceMats = {
    hull: new THREE.MeshLambertMaterial({ color: 0xc4c8d4, emissive: 0x20222c }),
    dark: new THREE.MeshLambertMaterial({ color: 0x3a3e4c }),
    panel: new THREE.MeshLambertMaterial({ color: 0x2a50c8, emissive: 0x0a1848 }),
    foil: new THREE.MeshLambertMaterial({ color: 0xe0b030, emissive: 0x3a2808 }),
    rust: new THREE.MeshLambertMaterial({ color: 0x7a5440 }),
    light: new THREE.MeshBasicMaterial({ color: 0xff4a5a }),
    white: new THREE.MeshLambertMaterial({ color: 0xf0f0f4, emissive: 0x2a2a34 }),
  };
  private readonly ringBands = [0xc4c8d4, 0x3a3e4c, 0x2a50c8, 0x3a3e4c].map((c) => new THREE.MeshLambertMaterial({ color: c, emissive: new THREE.Color(c).multiplyScalar(0.2) }));
  private readonly shuttle = new THREE.MeshLambertMaterial({ color: 0xf2f2f6, emissive: 0x24242c });
  private readonly tiles = new THREE.MeshLambertMaterial({ color: 0x1a1a22 });
  // the cloud layer's still clouds (src/gen/clouds.ts), and the thin ones, which break up once you've stood on them
  private clouds: THREE.Group | null = null;
  private thin: { s: Surface; g: THREE.Object3D }[] = [];

  reset(sky: Sky): void {
    //the last floor's pieces are freed, not just taken out (dispose.ts)
    for (const p of this.pieces) this.group.remove(disposed(p.g));
    if (this.clouds) this.group.remove(disposed(this.clouds));
    this.clouds = null;
    this.thin = [];
    for (const b of this.busts) this.group.remove(disposed(b));
    this.pieces = [];
    this.busts = [];
    const level = sky.level;
    const Y = (py: number) => toY(level, py);
    const foot = (px: number) => Y(groundAt(level, px) ?? level.streetY);
    const space = layerAct(level.layout.floor) === 5;
    const sm = this.space;
    for (const sim of sky.pieces) {
      const s = sim.site;
      const g = new THREE.Group();
      const moving = new THREE.Group();
      g.add(moving);
      const ropes: THREE.Object3D[] = [];
      const w = T(s.x1 - s.x0);
      const p = new Parts();
      if (space && s.kind === 'cloud') {
        debris(p, sm, w, Math.round(s.x0));
        p.into(moving);
      } else if (space && s.kind === 'balloon') {
        satellite(p, sm, w);
        p.into(moving);
      } else if (space && s.kind === 'blimp') {
        //a shuttle drifting nose first (the blimp's mechanics): its back the deck, black heat tiles underneath, its
        //delta wing out behind the lane and its tail fin up at the back
        const r = 1.3;
        p.add(this.shuttle, new THREE.CapsuleGeometry(r, w, 6, 18).rotateZ(Math.PI / 2), w / 2, -r, 0);
        p.box(this.tiles, w + r, 0.5, 2.2, w / 2 + r * 0.3, -2 * r + 0.15, 0);
        p.add(this.tiles, new THREE.ConeGeometry(r * 0.98, 1.6, 18).rotateZ(-Math.PI / 2), w + r + 0.5, -r, 0);
        p.box(this.shuttle, w * 0.55, 0.18, 5.5, w * 0.42, -r * 1.4, -3.2);
        p.box(this.tiles, w * 0.55, 0.06, 5.5, w * 0.42, -r * 1.4 - 0.12, -3.2);
        p.box(this.shuttle, 2.2, 2.6, 0.18, 0.4, 0.9, -0.6);
        p.box(this.space.light, 0.4, 0.4, 0.4, -r + 0.2, -r, 0.6); // the engine glow
        for (const ex of [-0.5, 0.5]) p.add(this.tiles, new THREE.CylinderGeometry(0.35, 0.55, 0.8, 10).rotateZ(Math.PI / 2), -r - 0.2, -r + ex, 0);
        p.box(this.glass, 1.4, 0.4, 2.0, w + 0.2, -0.45, 0); // the cockpit windows
        p.into(moving);
      } else if (space && s.kind === 'rig') {
        //a capsule (the rig's mechanics: it drops away under you once you land): its deck on top of a white pod,
        //a heat shield under it
        p.box(sm.hull, w, 0.18, 1.4, w / 2, -0.09, -0.3);
        p.add(sm.white, new THREE.CylinderGeometry(w * 0.32, w * 0.48, 1.6, 16), w / 2, -1.0, -0.3);
        p.add(this.tiles, new THREE.CylinderGeometry(w * 0.5, w * 0.5, 0.25, 16), w / 2, -1.9, -0.3);
        p.box(sm.light, 0.2, 0.2, 0.2, 0.15, 0.05, 0.4);
        p.into(moving);
      } else if (s.kind === 'cloud') {
        cloud(p, this.puff, this.puffUnder, w, Math.round(s.x0));
        p.into(moving);
      } else if (s.kind === 'beam') {
        //a red steel I-beam on a crane's cable (zack, 2026-10-31: "Grindable I-beams", "slowly swinging"): its top
        //flange is the grind; a hook block over its middle, two slings, the cable up out of the top of the frame. It all
        //swings together (update)
        p.box(this.girder, w, 0.07, 0.7, w / 2, -0.035, -0.1); // the top flange
        p.box(this.girder, w, 0.4, 0.08, w / 2, -0.27, -0.1); // the web
        p.box(this.girder, w, 0.07, 0.7, w / 2, -0.5, -0.1); // the bottom flange
        for (let k = 0.6; k < w - 0.3; k += 1.2) p.box(this.girder, 0.04, 0.36, 0.3, k, -0.27, 0.1); // stiffeners
        p.box(this.orange, 0.35, 0.5, 0.35, w / 2, 2.4, -0.45); // the hook block
        for (const lx of [w * 0.15, w * 0.85]) p.bar(this.steel, [lx, 0, -0.3], [w / 2, 2.2, -0.45], 0.03);
        p.box(this.steel, 0.05, 30, 0.05, w / 2, 17.6, -0.45); // the cable
        p.into(moving);
      } else if (s.kind === 'balloon') {
        //a hot air balloon: its wicker basket is the deck, the striped envelope over it on its ropes
        p.box(this.wicker, w, 0.9, 1.4, w / 2, -0.45, -0.2);
        p.box(this.steel, w + 0.1, 0.1, 1.5, w / 2, -0.02, -0.2);
        const env = new THREE.SphereGeometry(2.3, 20, 14);
        env.scale(1, 1.15, 1);
        p.add(this.envelope, env, w / 2, 4.6, -0.6);
        p.add(this.envelope, new THREE.ConeGeometry(1.2, 1.4, 16).rotateX(Math.PI), w / 2, 2.0, -0.6);
        for (const rx of [0.15, w - 0.15]) p.bar(this.rope, [rx, 0, -0.2], [w / 2 + (rx < w / 2 ? -0.9 : 0.9), 1.6, -0.6], 0.04);
        p.box(this.orange, 0.4, 0.3, 0.4, w / 2, 1.2, -0.6); // the burner
        p.into(moving);
      } else if (s.kind === 'blimp') {
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
        //(in space, act 5: a station's robot arm, on a node of the station instead of a mast up from the city)
        if (space) {
          m.add(sm.white, new THREE.CylinderGeometry(1.2, 1.2, 3, 16).rotateX(Math.PI / 2), mx, -2.2, -2.4);
          m.box(sm.dark, 0.9, 1.6, 0.9, mx, -1.3, -1.2);
          m.box(sm.panel, 0.1, 3, 6, mx, -2.2, -6);
        } else mast(m, this.yellow, mx, -1.2, bottom - top - 0.2, -0.75, 1.1);
        m.into(g);
        const pivot = new THREE.Group();
        pivot.position.set(mx, 0, -1.2);
        //(in the pivot's frame: the lane is z = 1.2, the jib runs along x from -mx to w - mx)
        const z = 1.2;
        const j0 = -mx;
        const j1 = w - mx;
        const arm = space ? sm.white : this.yellow;
        truss(p, arm, 0.6, j1, -0.58, z, 0.55, 0.5); // its top chord is what you grind
        if (space) {
          p.box(sm.dark, 1.1, 1.1, 1.1, 0, -0.55, z); // the arm's shoulder joint
          p.box(sm.dark, 0.8, 0.8, 0.8, j1, -0.55, z); // and its hand, at the far end
          p.box(sm.light, 0.2, 0.2, 0.2, j1 + 0.4, -0.3, z);
        } else {
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
        }
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
    //the cloud layer's clouds and rainbows: still, so merged into a few meshes; the thin clouds each their own, to
    //break up
    const cl = new Parts();
    const group = new THREE.Group();
    for (const s of level.surfaces) {
      if (s.sky !== 'cloud' && s.sky !== 'wisp' && s.sky !== 'thin' && s.sky !== 'landing') continue;
      const w = T(s.x1 - s.x0);
      if (s.sky === 'thin') {
        const tp = new Parts();
        if (space) junkPlate(tp, sm, w, Math.round(s.x0));
        else cloud(tp, this.puffUnder, this.puffUnder, w, Math.round(s.x0), true);
        const tg = new THREE.Group();
        tp.into(tg);
        tg.position.set(toX(s.x0), Y(s.y), 0);
        group.add(tg);
        this.thin.push({ s, g: tg });
        continue;
      }
      const c = new Parts();
      if (space && s.sky === 'wisp') solarPanel(c, sm, w);
      else if (space) stationDeck(c, sm, w, Math.round(s.x0));
      else cloud(c, this.puff, this.puffUnder, w, Math.round(s.x0), s.sky === 'wisp');
      const cg = new THREE.Group();
      c.into(cg);
      cg.position.set(toX(s.x0), Y(s.y), 0);
      group.add(cg);
    }
    //a rainbow: six bands stacked under the rail you grind (red on top), a cloud at each foot
    for (const r of level.rails) {
      if (r.sky !== 'rainbow') continue;
      for (let i = 1; i < r.xs.length; i++) {
        const [ax, ay, bx, by] = [toX(r.xs[i - 1]), Y(r.ys[i - 1]), toX(r.xs[i]), Y(r.ys[i])];
        const len = Math.hypot(bx - ax, by - ay) + 0.04;
        const ang = Math.atan2(by - ay, bx - ax);
        //(in space, a ring of station hull: its bands grey and solar blue)
        (space ? this.ringBands : this.bands).forEach((m, k) => {
          const off = -0.11 - k * 0.2;
          cl.box(m, len, 0.2, 0.7, (ax + bx) / 2 - Math.sin(ang) * off, (ay + by) / 2 + Math.cos(ang) * off, 0, ang);
        });
      }
      for (const k of [0, r.xs.length - 1]) {
        const c = new Parts();
        if (space) c.box(sm.dark, 1.6, 1.2, 1.4, 1.2, 0.2, -0.3); // a docking node at each foot
        else cloud(c, this.puff, this.puffUnder, 2.4, k + Math.round(r.xs[0]), true);
        const cg = new THREE.Group();
        c.into(cg);
        cg.position.set(toX(r.xs[k]) - 1.2, Y(r.ys[k]) - 0.9, 0.3);
        group.add(cg);
      }
    }
    this.cloudLine(level, cl, group);
    if (space) this.stationLine(level, cl);
    cl.into(group);
    inkify(group);
    //act 4, above the clouds: a sea of cloud a few tiles under the line, the whole floor long, so the city's a long way
    //down through the gaps in it (behind the lane, and lower in front of it, so it never covers the line you ride)
    if (layerAct(level.layout.floor) === 4) group.add(this.cloudSea(level));
    this.clouds = group;
    this.group.add(group);
  }

  // act 3's cloud line (src/gen/clouds.ts CLOUD_LINE, LAUNCH): rainbow hubbas, chrome S-rails, red S I-beams on crane
  // cables, the launch quarterpipes and their big rails down
  private cloudLine(level: Level, cl: Parts, group: THREE.Group): void {
    const Y = (py: number) => toY(level, py);
    //each segment of a rail's line, in tiles: its middle, length and angle
    const segs = (r: CurvedRail) => {
      const out: { mx: number; my: number; len: number; ang: number; ax: number; ay: number }[] = [];
      for (let i = 1; i < r.xs.length; i++) {
        const [ax, ay, bx, by] = [toX(r.xs[i - 1]), Y(r.ys[i - 1]), toX(r.xs[i]), Y(r.ys[i])];
        out.push({ mx: (ax + bx) / 2, my: (ay + by) / 2, len: Math.hypot(bx - ax, by - ay) + 0.03, ang: Math.atan2(by - ay, bx - ax), ax, ay });
      }
      return out;
    };
    //(the rail's line is its top: things hang under it by `off` tiles, square to it)
    const under = (sg: { mx: number; my: number; ang: number }, off: number): [number, number] => [sg.mx + Math.sin(sg.ang) * off, sg.my - Math.cos(sg.ang) * off];
    //cables from points along a rail up out of the top of the frame, to the crane or the blimp holding it
    const cables = (r: CurvedRail, n: number, up = 9) => {
      for (let k = 0; k < n; k++) {
        const p = r.at((r.length * (k + 0.5)) / n);
        const [x, y] = [toX(p.x), Y(p.y)];
        cl.bar(this.rope, [x, y, 0], [x + 0.3, y + up, 0], 0.04);
        cl.box(this.steel, 0.24, 0.16, 0.24, x, y + 0.08, 0);
      }
    };
    for (const r of level.rails) {
      if (r.sky === 'hubba' && layerAct(level.layout.floor) === 5) {
        //act 5's: a hull ledge down off a module's roof, a hazard-striped steel coping along it, a docking node at its foot
        for (const sg of segs(r)) {
          cl.box(this.space.dark, sg.len, 0.9, 1.1, ...under(sg, 0.5), 0, sg.ang);
          cl.box(this.gold, sg.len, 0.08, 1.14, ...under(sg, 0.04), 0, sg.ang);
        }
        const [hx, hy] = [toX(r.xs[0]), Y(r.ys[0])];
        //(the module whose roof it runs off: a pressurised can under the deck before it)
        cl.add(this.space.white, new THREE.CylinderGeometry(1.4, 1.4, 6, 16).rotateZ(Math.PI / 2), hx - 3.2, hy - 1.7, -0.6);
        cl.box(this.space.dark, 0.3, 3, 3, hx - 0.15, hy - 1.7, -0.6);
        const e = segs(r).at(-1)!;
        cl.box(this.space.dark, 1.6, 1.2, 1.4, toX(r.xs.at(-1)!) - 0.6, e.ay - 1.2, -0.3);
      } else if (r.sky === 'hubba') {
        //a hubba ledge in rainbow: six bands stacked under its top edge (red on top), a white coping along it
        for (const sg of segs(r)) {
          this.bands.forEach((m, k) => cl.box(m, sg.len, 0.17, 1.1, ...under(sg, 0.06 + 0.085 + k * 0.17), 0, sg.ang));
          cl.box(this.white, sg.len, 0.06, 1.14, ...under(sg, 0.03), 0, sg.ang);
        }
        //its foot: a puff of cloud it stands in
        const e = segs(r).at(-1)!;
        const c = new Parts();
        cloud(c, this.puff, this.puffUnder, 2.2, Math.round(r.xs[0]), true);
        const cg = new THREE.Group();
        c.into(cg);
        cg.position.set(toX(r.xs.at(-1)!) - 1.6, e.ay - 1.2, 0.4);
        group.add(cg);
      } else if (r.sky === 'srail') {
        //a chrome round rail on cables
        for (const sg of segs(r)) {
          cl.box(this.alu, sg.len, 0.13, 0.13, ...under(sg, 0.065), 0, sg.ang);
          cl.box(this.steel, sg.len, 0.04, 0.05, ...under(sg, 0.15), 0, sg.ang);
        }
        cables(r, 3);
      } else if (r.sky === 'sbeam') {
        //a red I-beam: its top flange (what you grind), the web, the bottom flange, on two crane cables
        for (const sg of segs(r)) {
          cl.box(this.girder, sg.len, 0.07, 0.55, ...under(sg, 0.035), 0, sg.ang);
          cl.box(this.girder, sg.len, 0.34, 0.12, ...under(sg, 0.24), 0, sg.ang);
          cl.box(this.girder, sg.len, 0.07, 0.55, ...under(sg, 0.44), 0, sg.ang);
        }
        cables(r, 2);
      } else if (r.sky === 'downrail') {
        //the big rail down off a launch: a fat steel tube on posts hung from cables, a yellow stripe down it
        for (const sg of segs(r)) {
          cl.box(this.alu, sg.len, 0.2, 0.2, ...under(sg, 0.1), 0, sg.ang);
          cl.box(this.yellow, sg.len, 0.05, 0.21, ...under(sg, 0.18), 0, sg.ang);
        }
        cables(r, 4, 6);
      }
    }
    for (const s of level.surfaces) {
      if (s.sky !== 'qp') continue;
      //a quarterpipe on a cloud: its transition a quarter circle from the foot up to vertical at the lip, a steel
      //coping on the lip, the deck behind it, and its frame down into the cloud
      const [x0, yb, x1, yt] = [toX(s.x0), Y(s.y), toX(s.x1), Y(s.y1 ?? s.y)];
      const R = Math.min(x1 - x0, yt - yb);
      const n = 10;
      let [px, py] = [x0, yb];
      for (let k = 1; k <= n; k++) {
        const f = ((Math.PI / 2) * k) / n;
        const [qx, qy] = [x0 + R * Math.sin(f), yt - R * Math.cos(f)];
        const len = Math.hypot(qx - px, qy - py) + 0.02;
        const ang = Math.atan2(qy - py, qx - px);
        cl.box(this.white, len, 0.12, 1.4, (px + qx) / 2 + Math.sin(ang) * 0.06, (py + qy) / 2 - Math.cos(ang) * 0.06, 0, ang);
        //(its side: a slat down to the foot's height)
        cl.box(this.navy, len * 0.9, Math.max(0.05, (qy + py) / 2 - yb), 0.06, (px + qx) / 2, (yb + (qy + py) / 2) / 2, 0.7);
        [px, py] = [qx, qy];
      }
      cl.box(this.alu, 0.16, 0.16, 1.5, x1 + 0.04, yt + 0.02, 0); // the coping
      cl.box(this.navy, 0.9, 0.12, 1.4, x1 + 0.5, yt - 0.06, 0); // the deck
      cl.box(this.navy, 0.12, yt - yb, 1.3, x1 + 0.9, (yt + yb) / 2, 0); // its back
      const c = new Parts();
      cloud(c, this.puff, this.puffUnder, 3.4, Math.round(s.x0), true);
      const cg = new THREE.Group();
      c.into(cg);
      cg.position.set(x0 - 0.2, yb - 0.6, 0.5);
      group.add(cg);
    }
  }

  // act 5's station line (src/gen/clouds.ts STATION): stair sets of hull plate with yellow nosing on every step and a
  // handrail over them on posts down to the noses, flat rails and ledges along the decks, and the rails out across
  // open space between two modules, a strut of truss under each
  private stationLine(level: Level, cl: Parts): void {
    const Y = (py: number) => toY(level, py);
    const sm = this.space;
    for (const s of level.surfaces) {
      if (s.sky !== 'stairs') continue;
      const [x0, x1, top, foot] = [toX(s.x0), toX(s.x1), Y(s.y), Y(s.y1 ?? s.y)];
      const n = Math.max(3, Math.round((x1 - x0) / 1.1));
      const sw = (x1 - x0) / n;
      const rise = (top - foot) / n;
      for (let i = 0; i < n; i++) {
        //each step a slab under its tread (the flight floats free, a gangway of hull plate), its tread on the line
        //through the noses
        const tread = top - (i + 0.5) * rise;
        const h = rise + 0.35;
        const cx = x0 + (i + 0.5) * sw;
        cl.box(sm.hull, sw + 0.02, h, 2.2, cx, tread - h / 2, -0.3);
        cl.box(this.gold, 0.18, 0.05, 2.22, x0 + i * sw + 0.09, tread + 0.01, -0.3); // its nosing
        cl.box(sm.dark, 0.04, h, 2.23, x0 + i * sw, tread - h / 2, -0.3); // the seam between steps
      }
      //its stringers under the flight, front and back, and a strut down off each to a node
      for (const z of [0.6, -1.2]) cl.bar(sm.dark, [x0, top - 0.6, z], [x1, foot - 0.6, z], 0.16);
      cl.bar(sm.dark, [(x0 + x1) / 2, (top + foot) / 2 - 0.6, -0.3], [(x0 + x1) / 2 + 0.6, (top + foot) / 2 - 2.6, -0.9], 0.12);
      cl.box(sm.light, 0.2, 0.2, 0.2, x0 + 0.1, top - 0.6, 0.7);
    }
    //a rail's posts down to what's under it, every few tiles and at each end
    const posts = (r: CurvedRail, down: (x: number) => number, every = 3) => {
      const len = r.length;
      const n = Math.max(1, Math.round(len / TILE / every));
      for (let k = 0; k <= n; k++) {
        const p = r.at(Math.min(len - 2, Math.max(2, (len * k) / n)));
        const [x, y] = [toX(p.x), Y(p.y)];
        const g = down(p.x);
        if (y - g > 0.05) cl.box(sm.dark, 0.09, y - g, 0.09, x, (y + g) / 2, 0);
      }
    };
    //the station's ground under a point: the highest deck, step or landing under it
    const under = (px: number, py: number) => {
      let best = -Infinity;
      for (const s of level.surfaces) {
        if (!s.sky || px < s.x0 || px > s.x1) continue;
        const sy = s.y1 !== undefined ? s.y + ((s.y1 - s.y) * (px - s.x0)) / (s.x1 - s.x0) : s.y;
        if (sy < py) continue;
        best = Math.max(best, Y(sy));
      }
      return best;
    };
    for (const r of level.rails) {
      if (r.sky !== 'handrail' && r.sky !== 'deckrail' && r.sky !== 'ledge' && r.sky !== 'gaprail') continue;
      for (let i = 1; i < r.xs.length; i++) {
        const [ax, ay, bx, by] = [toX(r.xs[i - 1]), Y(r.ys[i - 1]), toX(r.xs[i]), Y(r.ys[i])];
        const len = Math.hypot(bx - ax, by - ay) + 0.03;
        const ang = Math.atan2(by - ay, bx - ax);
        const [mx, my] = [(ax + bx) / 2, (ay + by) / 2];
        if (r.sky === 'ledge') {
          //a hull ledge: a block from the deck up, a steel coping along its top edge
          const h = STATION.ledgeH / TILE;
          cl.box(sm.dark, len, h, 1.2, mx, my - h / 2, -0.1);
          cl.box(this.gold, len, 0.06, 1.24, mx, my - 0.03, -0.1);
          cl.box(this.alu, len, 0.08, 0.08, mx, my - 0.04, 0.5);
          continue;
        }
        //a round steel rail, safety yellow
        cl.box(this.gold, len, 0.12, 0.12, mx + Math.sin(ang) * 0.06, my - Math.cos(ang) * 0.06, 0, ang);
      }
      if (r.sky === 'ledge') continue;
      const ok = (x: number) => under(x, r.yAt(x) ?? r.ys[0]);
      if (r.sky === 'gaprail') {
        //across open space: posts only where there's a deck under it, a strut of truss under the span
        posts(r, (x) => {
          const g = ok(x);
          return g === -Infinity ? Y(r.yAt(x) ?? r.ys[0]) : g;
        }, 2);
        truss(cl, sm.dark, toX(r.xs[0]), toX(r.xs.at(-1)!), Y(r.ys[0]) - 1.1, 0, 0.5, 0.5, 0.05);
      } else posts(r, (x) => Math.max(ok(x), Y(r.yAt(x) ?? r.ys[0]) - 1.2), r.sky === 'handrail' ? 2.5 : 3);
    }
  }

  // the sea of cloud under act 4's line (see reset): big soft heaps every few tiles, merged into two meshes
  private cloudSea(level: Level): THREE.Object3D {
    const line = piecesOf(level, 0, level.width).filter((p) => p.cloud);
    const sea = new Parts();
    const Y = (py: number) => toY(level, py);
    if (!line.length) return new THREE.Group();
    for (let x = line[0].x0, k = 0; x < line[line.length - 1].x1; x += 4 * TILE, k++) {
      //(under the nearest piece of the line)
      const near = line.reduce((a, p) => (Math.abs((p.x0 + p.x1) / 2 - x) < Math.abs((a.x0 + a.x1) / 2 - x) ? p : a));
      const top = Y(near.y0) - 6;
      const r = 2.4 + ((k * 7) % 5) * 0.35;
      sea.add(this.puff, new THREE.SphereGeometry(r, 10, 6).scale(1.6, 0.7, 1.2), toX(x), top - r * 0.5, -5 - (k % 3) * 1.5);
      sea.add(this.puffUnder, new THREE.SphereGeometry(r * 1.3, 10, 6).scale(1.6, 0.6, 1.2), toX(x) + 2, top - r * 1.4, -8);
      if (k % 2 === 0) sea.add(this.puff, new THREE.SphereGeometry(r * 0.9, 10, 6).scale(1.7, 0.6, 1), toX(x) + 1, top - 3.5, 3);
    }
    const g = new THREE.Group();
    sea.into(g);
    return g;
  }

  update(level: Level, skaterX: number, gone?: ReadonlySet<Surface>): void {
    //a thin cloud you've stood on breaks up: it puffs out and is gone
    for (const t of this.thin) {
      const g = gone?.has(t.s) ?? false;
      if (!g) {
        t.g.visible = true;
        t.g.scale.setScalar(1);
      } else if (t.g.visible) {
        const k = t.g.scale.x * 1.06;
        t.g.scale.set(k, k * 0.8, k);
        if (k > 1.5) t.g.visible = false;
      }
    }
    for (const { sim, g, moving, ropes } of this.pieces) {
      g.visible = Math.abs(sim.site.x0 - skaterX) < 1400 || Math.abs(sim.site.x1 - skaterX) < 1400;
      if (!g.visible) continue;
      const dy = toY(level, at(sim, 'y')) - toY(level, sim.site.y);
      moving.position.y = dy;
      moving.position.x = at(sim, 'x') / TILE;
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
