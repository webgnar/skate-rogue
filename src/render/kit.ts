// Builds a floor's 3D kit from the physics level: street slabs, canals, buildings under rooftops, ledges, rails,
// parked cars and the city behind. 1 world unit = 1 tile (32 px); y = 0 is the street surface; gameplay is z = 0.
import * as THREE from 'three';
import { TILE } from '../physics/constants';
import type { Level } from '../physics/level';
import { label, type Road } from '../gen/roads';
import { makeRng, randInt } from '../gen/rng';
import { CITY, paintTexture, tileTexture, type TileCell } from './textures';

export const toX = (px: number) => px / TILE;
export const toY = (level: Level, py: number) => (level.streetY - py) / TILE;

const STREET_DEPTH = 6; // the street runs from z = -3.5 (back, sidewalk and wall) to z = 2.5 (front)
const STREET_BACK = -3.5;
// buildings, stairs and banks under the descent run from BLOCK_BACK to BLOCK_FRONT: the front face sits well in
// front of the skater (z = 0.25), so they ride on the roof, not along its front edge
const BLOCK_BACK = -3.1;
const BLOCK_FRONT = 1.5;
const BLOCK_DEPTH = BLOCK_FRONT - BLOCK_BACK;
const BLOCK_Z = (BLOCK_FRONT + BLOCK_BACK) / 2;

function lambert(map: THREE.Texture | null, color = 0xffffff, transparent = false): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ map, color, transparent, alphaTest: transparent ? 0.5 : 0 });
}

// box with a different material on the front face (+z) and top face (+y)
function slab(w: number, h: number, d: number, front: THREE.Material, top: THREE.Material, side: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  return new THREE.Mesh(geo, [side, side, top, side, front, side]);
}

export function buildKit(level: Level): THREE.Group {
  const kit = new THREE.Group();
  const rng = makeRng(level.layout.seed * 31 + level.layout.floor);
  const cols = level.street.length;
  const sideMat = lambert(null, 0x3a3640);

  //--- the alley far below the descent: you only see it if you fall ---------------------------
  const first = Math.round(toX(level.finaleX));
  if (first > 0) {
    const alley = slab(first, 3, STREET_DEPTH, lambert(null, 0x18121f), lambert(null, 0x221a2c), sideMat);
    alley.position.set(first / 2, -2.5, STREET_BACK + STREET_DEPTH / 2);
    kit.add(alley);
  }

  //--- street slabs and canals -------------------------------------------------------------
  let c = first;
  while (c < cols) {
    const isStreet = level.street[c];
    let end = c;
    while (end + 1 < cols && level.street[end + 1] === isStreet) end++;
    const n = end - c + 1;
    const x = c + n / 2;
    if (isStreet) {
      //front face: QFS's 3-row city street with crumbled corners next to canals
      const front: number[][] = [[], [], []];
      for (let i = 0; i < n; i++) {
        const col = c + i;
        let t = CITY.road(col);
        if (c > 0 && i < 3 && n > 4) t = CITY.cornerLeft[i];
        if (end < cols - 1 && n - 1 - i < 3 && n > 4) t = CITY.cornerRight[2 - (n - 1 - i)];
        front[0].push(t);
        front[1].push(t + 15);
        front[2].push(t + 30);
      }
      const top = paintTexture(n, STREET_DEPTH, (ctx, W, H) => {
        const lane = H * 0.55;
        ctx.fillStyle = '#2a2830'; // asphalt
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#7d7a86'; // sidewalk at the back
        ctx.fillRect(0, 0, W, H * 0.3);
        ctx.fillStyle = '#5d5a66';
        for (let px = 0; px < W; px += 16) ctx.fillRect(px, 0, 1, H * 0.3);
        ctx.fillStyle = '#9a97a3'; // curb
        ctx.fillRect(0, H * 0.3, W, 2);
        ctx.fillStyle = '#d8b84a'; // centre line
        for (let px = (c * 8) % 24; px < W; px += 24) ctx.fillRect(px, lane, 12, 2);
      });
      const mesh = slab(n, 3, STREET_DEPTH, lambert(tileTexture(front)), lambert(top), sideMat);
      mesh.position.set(x, -1.5, STREET_BACK + STREET_DEPTH / 2);
      kit.add(mesh);
    } else {
      //canal: water a bit below the street, QFS's clean water tiles
      const front = [new Array(n).fill(CITY.waterTop), new Array(n).fill(CITY.water), new Array(n).fill(CITY.water)];
      const water = slab(n, 2.4, STREET_DEPTH, lambert(tileTexture(front)), lambert(null, 0x3a5fb0), sideMat);
      water.position.set(x, -1.8, STREET_BACK + STREET_DEPTH / 2);
      kit.add(water);
    }
    c = end + 1;
  }

  //--- the wall along the back of the sidewalk, and buildings behind it ----------------------
  const wallRows = [[], []] as number[][];
  for (let i = 0; i < cols; i++) {
    wallRows[0].push(CITY.brick[(i * 7) % CITY.brick.length]);
    wallRows[1].push(CITY.brick[(i * 5 + 3) % CITY.brick.length]);
  }
  const wall = slab(cols - first, 2, 0.5, lambert(tileTexture(wallRows.map((row) => row.slice(first)))), lambert(null, 0x6b5a55), sideMat);
  wall.position.set(first + (cols - first) / 2, 1, STREET_BACK - 0.25);
  kit.add(wall);

  for (let bx = -8; bx < cols + 20; ) {
    const w = 4 + randInt(rng, 5);
    const h = 5 + randInt(rng, 9);
    const t = CITY.facade[randInt(rng, CITY.facade.length)];
    const b = slab(w, h, 4, lambert(tileTexture(facade(w, h, t)), 0xd8c8e8), lambert(null, 0x2b2638), sideMat);
    b.position.set(bx + w / 2, h / 2 - 0.5, STREET_BACK - 3 - randInt(rng, 3));
    kit.add(b);
    bx += w + randInt(rng, 2);
  }

  //--- one-way surfaces: buildings under rooftops, floating ledges, flat rails -------------------
  const metal = new THREE.MeshLambertMaterial({ color: 0xb8bcc8 });
  const postMat = new THREE.MeshLambertMaterial({ color: 0x55596a });
  const concrete = lambert(null, 0x8c8794);
  const stepTop = lambert(null, 0xb9b4c2);
  //rails up on the roofs stand on the roof, not on the street
  const postH = (px: number, y: number) => (px < level.finaleX ? Math.min(y, 0.75) : y);
  for (const s of level.surfaces) {
    const w = toX(s.x1 - s.x0);
    const x = toX(s.x0) + w / 2;
    const y = toY(level, s.y);
    if (s.kind === 'roof') {
      //a roof at street level is just more street (the descent's last run-out)
      if (y < 0.5) {
        const pad = slab(w, 3, STREET_DEPTH, lambert(null, 0x3a3640), lambert(null, 0x6d6a76), sideMat);
        pad.position.set(x, y - 1.5, STREET_BACK + STREET_DEPTH / 2);
        kit.add(pad);
        continue;
      }
      const t = CITY.facade[randInt(rng, CITY.facade.length)];
      const b = slab(w, y, BLOCK_DEPTH, lambert(tileTexture(facade(Math.round(w), Math.ceil(y), t))), lambert(null, 0x6a6478), sideMat);
      b.position.set(x, y / 2, BLOCK_Z);
      kit.add(b);
    } else if (s.kind === 'overpass') {
      //a concrete deck over the street on pillars behind the lane, with a railing at the back
      const deck = slab(w, 0.45, 2.9, lambert(null, 0x6f6a7a), lambert(null, 0x8d889a), sideMat);
      deck.position.set(x, y - 0.225, 0.05);
      kit.add(deck);
      for (let px = toX(s.x0) + 1; px < toX(s.x1); px += 5) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, y - 0.45, 0.5), concrete);
        pillar.position.set(px, (y - 0.45) / 2, -1.2);
        kit.add(pillar);
      }
      const railing = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), metal);
      railing.position.set(x, y + 0.7, -1.4);
      kit.add(railing);
    } else if (s.kind === 'ledge') {
      const row = new Array(Math.round(w)).fill(CITY.ledge[1]);
      row[0] = CITY.ledge[0];
      row[row.length - 1] = CITY.ledge[2];
      const l = slab(w, 0.35, 2.2, lambert(tileTexture([row])), lambert(null, 0x8a6a50), sideMat);
      l.position.set(x, y - 0.175, -0.4);
      kit.add(l);
    } else if (s.kind === 'stairs') {
      //one block per step, down to the street
      const steps = Math.round(w);
      for (let i = 0; i < steps; i++) {
        const top = toY(level, s.y + ((s.y1! - s.y) * (i + 1)) / steps);
        const step = slab(1, top + 0.5, BLOCK_DEPTH, concrete, stepTop, sideMat);
        step.position.set(toX(s.x0) + i + 0.5, (top - 0.5) / 2, BLOCK_Z);
        kit.add(step);
      }
    } else if (s.kind === 'bank') {
      //a concrete wedge
      const y1 = toY(level, s.y1!);
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.5);
      shape.lineTo(w, -0.5);
      shape.lineTo(w, y1);
      shape.lineTo(0, y);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: BLOCK_DEPTH, bevelEnabled: false });
      const bank = new THREE.Mesh(geo, concrete);
      bank.position.set(toX(s.x0), 0, BLOCK_BACK);
      kit.add(bank);
    } else {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.14), metal);
      bar.position.set(x, y - 0.06, 0);
      kit.add(bar);
      for (let px = toX(s.x0) + 0.3; px < toX(s.x1); px += 2) {
        const h = postH(s.x0, y);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), postMat);
        post.position.set(px, y - h / 2, 0);
        kit.add(post);
      }
    }
  }

  //--- curved rails ---------------------------------------------------------------------------
  for (const rail of level.rails) {
    const pts = rail.xs.map((px, i) => new THREE.Vector3(toX(px), toY(level, rail.ys[i]) - 0.06, 0));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, 0.07, 6), metal);
    kit.add(tube);
    for (const i of [0, Math.floor(pts.length / 2), pts.length - 1]) {
      const p = pts[i];
      if (p.y <= 0.1) continue;
      const h = postH(rail.x0, p.y);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), postMat);
      post.position.set(p.x, p.y - h / 2, 0);
      kit.add(post);
    }
  }

  //--- parked cars ----------------------------------------------------------------------------
  const paints = [0xe8c33a, 0x3a7be8, 0xd94a4a, 0x48b86a, 0xe8e8f0, 0x2a2a34];
  level.cars.forEach((car, i) => {
    kit.add(makeCar(toX(car.x0), toX(car.x1), toY(level, car.bottom), toY(level, car.roof), paints[(i * 7 + level.layout.floor) % paints.length]));
  });

  //--- broken glass ----------------------------------------------------------------------------
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x204050 });
  for (const g of level.glass) {
    for (let px = toX(g.x0); px < toX(g.x1); px += 0.35) {
      const shard = new THREE.Mesh(new THREE.TetrahedronGeometry(0.12), glassMat);
      shard.position.set(px + rng() * 0.2, 0.06, (rng() - 0.5) * 1.5);
      shard.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      kit.add(shard);
    }
  }

  //--- exit: a glowing gate -------------------------------------------------------------------
  const gate = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.12, 8, 32, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x7cf0ff }),
  );
  gate.position.set(toX(level.exitX) + 0.5, 0, 0);
  kit.add(gate);

  //--- the fork: a second gate up on the overpass and signs for both roads ----------------------
  if (level.fork) {
    const fork = level.fork;
    const hy = toY(level, fork.y);
    const high = gate.clone();
    high.material = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    high.scale.setScalar(0.8);
    high.position.set(toX(level.exitX) + 0.5, hy, -0.2);
    kit.add(high);
    //signs a few tiles before the overpass, on a gantry over the street: high road on top, low road under it
    const sx = toX(fork.x0) - 7;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, hy + 3.2, 0.18), postMat);
    post.position.set(sx - 2.1, (hy + 3.2) / 2, -1.3);
    kit.add(post);
    const top = roadSign(fork.high, true);
    top.position.set(sx, hy + 2.2, -1.25);
    const bottom = roadSign(fork.low, false);
    bottom.position.set(sx, hy + 0.65, -1.25);
    kit.add(top, bottom);
  }

  return kit;
}

// a building front: facade tiles with QFS's roof-line cap drawn over the top row
function facade(w: number, h: number, t: number): TileCell[][] {
  const grid: TileCell[][] = [];
  for (let r = 0; r < h; r++) grid.push(new Array(w).fill(t));
  grid[0] = grid[0].map((_, i) => [t, i === 0 ? CITY.cap[0] : i === w - 1 ? CITY.cap[2] : CITY.cap[1]]);
  return grid;
}

export function makeCar(x0: number, x1: number, bottom: number, roof: number, paint: number): THREE.Group {
  const car = new THREE.Group();
  const w = x1 - x0;
  const h = roof - bottom;
  const body = new THREE.MeshLambertMaterial({ color: paint });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2333 });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, h * 0.55, 1.6), body);
  lower.position.set(0, bottom + 0.15 + h * 0.275, 0);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.45 - 0.15, 1.4), body);
  cabin.position.set(-0.05, bottom + 0.15 + h * 0.55 + (h * 0.45 - 0.15) / 2, 0);
  const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.62, h * 0.3, 1.42), glass);
  win.position.set(-0.05, cabin.position.y, 0);
  car.add(lower, cabin, win);
  const wheelGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.2, 10).rotateX(Math.PI / 2);
  const tire = new THREE.MeshLambertMaterial({ color: 0x111114 });
  for (const wx of [-w / 2 + 0.25, w / 2 - 0.25]) {
    for (const wz of [-0.75, 0.75]) {
      const wheel = new THREE.Mesh(wheelGeo, tire);
      wheel.position.set(wx, bottom + 0.22, wz);
      car.add(wheel);
    }
  }
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tail = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  for (const wz of [-0.55, 0.55]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.25), lamp);
    head.position.set(w / 2 + 0.15, bottom + 0.15 + h * 0.4, wz);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.25), tail);
    back.position.set(-w / 2 - 0.15, bottom + 0.15 + h * 0.4, wz);
    car.add(head, back);
  }
  car.position.x = x0 + w / 2;
  return car;
}

const ROAD_COLORS: Record<Road['kind'], string> = { boon: '#ffd23f', cash: '#5fe08a', hot: '#ff4a3a', stash: '#b98cff' };

// a street sign for one road: arrow, where it leads, and its danger in car icons
function roadSign(road: Road, high: boolean): THREE.Mesh {
  const W = 256;
  const H = 96;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d')!;
  g.fillStyle = high ? '#1f6b3a' : '#20406e';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 4;
  g.strokeRect(4, 4, W - 8, H - 8);
  g.fillStyle = '#ffffff';
  g.font = 'bold 18px Arial Black, Arial, sans-serif';
  g.textBaseline = 'top';
  g.fillText(high ? '\u25B2 HIGH ROAD' : '\u25B6 LOW ROAD', 14, 12);
  g.font = '12px Arial, sans-serif';
  g.fillText(high ? 'ollie + flip up' : 'keep rolling', 150, 16);
  g.fillStyle = road.kind === 'boon' ? (road.boonType === 'GRIND' ? '#ff8c2b' : '#ffd23f') : ROAD_COLORS[road.kind];
  g.font = 'bold 26px Arial Black, Arial, sans-serif';
  g.fillText(label(road), 14, 38);
  //danger: car icons
  for (let i = 0; i < 3; i++) {
    g.fillStyle = i < road.danger ? '#ff5a5a' : 'rgba(255,255,255,0.25)';
    const x = 14 + i * 30;
    g.fillRect(x, 72, 24, 9);
    g.fillRect(x + 5, 67, 14, 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return new THREE.Mesh(new THREE.PlaneGeometry(4, 1.5), new THREE.MeshBasicMaterial({ map: tex }));
}
