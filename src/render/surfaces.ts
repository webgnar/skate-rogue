// Surface detail for the kit's plain blocks: rooftops, decks, ledges, stairs, banks, kickers, girders. Each kind is
// one small tiling pixel texture, drawn near-white so the material's own colour still tints it (a skin's side colour,
// rain darkening it in scene.ts wetKit). A kind's texture is made once and shared, so a material that only gains a
// map batches exactly as before: no new draws. projectSurfaces maps them in world tiles, so the pattern runs on
// across neighbouring blocks instead of stretching over each one.
import * as THREE from 'three';
import { pixelTexture } from './textures';

const PX = 16; // texture pixels per tile, like the hillside's

type Paint = (g: CanvasRenderingContext2D, W: number, H: number, rnd: () => number) => void;

// a kind: its size in tiles (one repeat) and how it's drawn
const KINDS = {
  //board-formed concrete: stairs, banks, pillars, deck edges
  concrete: {
    size: 2,
    paint: ((g, W, H, rnd) => {
      fill(g, '#ffffff', 0, 0, W, H);
      for (let y = 0; y < H; y += 8) fill(g, '#d4d1da', 0, y, W, 1); // board lines
      fill(g, '#a8a4b0', 0, 0, 1, H); // joint
      for (const [x, y] of [[8, 4], [24, 4], [8, 20], [24, 20]]) fill(g, '#96929e', x, y, 1, 1); // form ties
      speckle(g, W, H, rnd, 26, ['#e2e0e6', '#c6c2cc']);
      crack(g, rnd, W, H, '#bcb8c4');
    }) as Paint,
  },
  //sidewalk slabs: step tops, deck tops, run-outs, kerbs
  pavers: {
    size: 1,
    paint: ((g, W, H, rnd) => {
      fill(g, '#ffffff', 0, 0, W, H);
      fill(g, '#a8a4b0', 0, 0, W, 1);
      fill(g, '#a8a4b0', 0, 0, 1, H);
      fill(g, '#ffffff', 1, 1, W - 1, 1);
      fill(g, '#ecebf0', 1, H - 1, W - 1, 1);
      speckle(g, W, H, rnd, 8, ['#d8d5de', '#f4f2f6']);
    }) as Paint,
  },
  //tar and gravel: the rooftops you skate, the top route's deck
  roof: {
    size: 2,
    paint: ((g, W, H, rnd) => {
      fill(g, '#e6e4ea', 0, 0, W, H);
      speckle(g, W, H, rnd, 160, ['#ffffff', '#c8c4ce', '#aeaab6', '#f6f4f8']);
      fill(g, '#a4a0ac', 0, H / 2, W, 1); // membrane seams
      fill(g, '#a4a0ac', W / 3, 0, 1, H / 2);
      fill(g, '#a4a0ac', (W * 3) / 4, H / 2, 1, H / 2);
    }) as Paint,
  },
  //boards running along the street: the floating ledges' decks
  planks: {
    size: 1,
    paint: ((g, W, H, rnd) => {
      fill(g, '#ffffff', 0, 0, W, H);
      const board = H / 4;
      for (let b = 0; b < 4; b++) {
        const y = b * board;
        fill(g, '#7c6a5c', 0, y, W, 1); // gap
        const end = Math.floor(rnd() * W);
        fill(g, '#8c7a6c', end, y, 1, board); // butt joint
        fill(g, '#9e8c7c', (end + 2) % W, y + 1, 1, 1); // nails
        fill(g, '#9e8c7c', (end + 2) % W, y + board - 1, 1, 1);
        for (let i = 0; i < 3; i++) fill(g, '#dccdbe', Math.floor(rnd() * W), y + 1 + Math.floor(rnd() * (board - 1)), 3 + Math.floor(rnd() * 4), 1); // grain
      }
    }) as Paint,
  },
  //plywood with screws round the edge: the kicker's sides
  plywood: {
    size: 2,
    paint: ((g, W, H, rnd) => {
      fill(g, '#ffffff', 0, 0, W, H);
      for (let i = 0; i < 22; i++) fill(g, rnd() < 0.5 ? '#e2d2bc' : '#f4ead8', Math.floor(rnd() * W), Math.floor(rnd() * H), 4 + Math.floor(rnd() * 8), 1);
      fill(g, '#b09c80', 0, 0, W, 1);
      fill(g, '#b09c80', 0, 0, 1, H);
      for (let x = 4; x < W; x += 8) fill(g, '#5c544a', x, 2, 1, 1);
      for (let y = 4; y < H; y += 8) fill(g, '#5c544a', 2, y, 1, 1);
    }) as Paint,
  },
  //diamond plate: the kicker's face, ramps
  plate: {
    size: 0.5,
    paint: ((g, W, H) => {
      fill(g, '#e8eaee', 0, 0, W, H);
      for (const [x, y] of [[1, 1], [5, 5]]) {
        fill(g, '#ffffff', x, y, 2, 1);
        fill(g, '#b8bcc6', x + 1, y + 1, 2, 1);
      }
    }) as Paint,
  },
  //riveted steel: the L's girders and decks
  steel: {
    size: 1,
    paint: ((g, W, H, rnd) => {
      fill(g, '#f0f0f0', 0, 0, W, H);
      fill(g, '#9c9c9c', 0, 0, 1, H); // plate seam
      fill(g, '#ffffff', 1, 0, 1, H);
      for (let y = 2; y < H; y += 4) {
        fill(g, '#ffffff', 3, y, 1, 1);
        fill(g, '#8a8a8a', 3, y + 1, 1, 1);
      }
      speckle(g, W, H, rnd, 10, ['#d8c4b4', '#e2e2e2']); // rust and wear
    }) as Paint,
  },
  //common brick: building sides
  brick: {
    size: 1,
    paint: ((g, W, H, rnd) => {
      const course = PX / 4;
      fill(g, '#b4acac', 0, 0, W, H); // mortar
      for (let r = 0; r < 4; r++) {
        const off = r % 2 ? PX / 4 : 0;
        for (let x = -off; x < W; x += PX / 2) {
          const tone = ['#ffffff', '#ece2e2', '#ddd2d2', '#f6f0f0'][Math.floor(rnd() * 4)];
          fill(g, tone, x + 1, r * course + 1, PX / 2 - 1, course - 1);
        }
      }
    }) as Paint,
  },
  //asphalt: run-out pads, cross streets, lots
  asphalt: {
    size: 2,
    paint: ((g, W, H, rnd) => {
      fill(g, '#f4f4f6', 0, 0, W, H);
      speckle(g, W, H, rnd, 90, ['#ffffff', '#cac8d2', '#e0dee6']);
      crack(g, rnd, W, H, '#a6a2ae');
    }) as Paint,
  },
  //ripples on the canals
  water: {
    size: 2,
    paint: ((g, W, H, rnd) => {
      fill(g, '#e8eef8', 0, 0, W, H);
      for (let i = 0; i < 14; i++) fill(g, rnd() < 0.6 ? '#ffffff' : '#c8d4e8', Math.floor(rnd() * W), Math.floor(rnd() * H), 3 + Math.floor(rnd() * 5), 1);
    }) as Paint,
  },
  //veined marble: the ruins
  marble: {
    size: 2,
    paint: ((g, W, H, rnd) => {
      fill(g, '#ffffff', 0, 0, W, H);
      for (let v = 0; v < 3; v++) {
        let x = Math.floor(rnd() * W);
        for (let y = 0; y < H; y++) {
          fill(g, '#c4b8a6', ((x % W) + W) % W, y, 1, 1);
          x += Math.floor(rnd() * 3) - 1;
        }
      }
      fill(g, '#e6e0d6', 0, H / 2, W, 1); // block joint
    }) as Paint,
  },
} satisfies Record<string, { size: number; paint: Paint }>;

export type SurfaceKind = keyof typeof KINDS;

function fill(g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number): void {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

function speckle(g: CanvasRenderingContext2D, W: number, H: number, rnd: () => number, n: number, colors: string[]): void {
  for (let i = 0; i < n; i++) fill(g, colors[i % colors.length], Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1);
}

function crack(g: CanvasRenderingContext2D, rnd: () => number, W: number, H: number, c: string): void {
  let x = Math.floor(rnd() * W);
  let y = Math.floor(rnd() * H);
  for (let i = 0; i < 9; i++) {
    fill(g, c, ((x % W) + W) % W, ((y % H) + H) % H, 1, 1);
    x += 1;
    y += Math.floor(rnd() * 3) - 1;
  }
}

const textures = new Map<SurfaceKind, THREE.Texture>();

// a kind's shared tiling texture (made on first use; the same seed every time, so it never shimmers between floors)
export function surfaceTexture(kind: SurfaceKind): THREE.Texture {
  let t = textures.get(kind);
  if (t) return t;
  const { size, paint } = KINDS[kind];
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(8, Math.round(size * PX));
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  let s = [...kind].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  paint(g, c.width, c.height, rnd);
  t = pixelTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  textures.set(kind, t);
  return t;
}

// a Lambert material with a kind's detail, tinted `color`; projectSurfaces maps it
export function surface(kind: SurfaceKind, color: THREE.ColorRepresentation = 0xffffff): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ map: surfaceTexture(kind), color });
  m.userData.surface = kind;
  return m;
}

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();

// give every face drawn with a surface() material world-tile UVs, projected by which way the face points (tops
// along x and z, fronts along x and y, sides along z and y). Only those faces' UVs change: a box's facade front
// keeps its own. Call once the meshes are placed, with the group they're placed in.
export function projectSurfaces(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const done = new Set<THREE.BufferGeometry>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || o instanceof THREE.SkinnedMesh) return;
    const geo = o.geometry as THREE.BufferGeometry;
    const mats = [o.material].flat() as THREE.Material[];
    if (done.has(geo) || !mats.some((m) => m.userData.surface)) return;
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute | undefined;
    if (!pos || !nor || !uv) return;
    done.add(geo);
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const ranges: [number, number, string][] = geo.groups.length
      ? geo.groups.map((g) => [g.start, g.start + g.count, mats[g.materialIndex ?? 0]?.userData.surface])
      : [[0, geo.index ? geo.index.count : pos.count, mats[0].userData.surface]];
    for (const [a, b, kind] of ranges) {
      if (!kind) continue;
      const size = KINDS[kind as SurfaceKind].size;
      for (let k = a; k < Math.min(b, geo.index ? geo.index.count : pos.count); k++) {
        const i = geo.index ? geo.index.getX(k) : k;
        _p.fromBufferAttribute(pos, i).applyMatrix4(m);
        _n.fromBufferAttribute(nor, i).applyMatrix3(nm);
        const [ax, ay, az] = [Math.abs(_n.x), Math.abs(_n.y), Math.abs(_n.z)];
        if (ay >= ax && ay >= az) uv.setXY(i, _p.x / size, _p.z / size);
        else if (az >= ax) uv.setXY(i, _p.x / size, _p.y / size);
        else uv.setXY(i, _p.z / size, _p.y / size);
      }
    }
    uv.needsUpdate = true;
  });
}
