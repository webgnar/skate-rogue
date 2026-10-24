// Builds a floor's 3D kit from the physics level: street slabs, canals, buildings under rooftops, ledges, rails,
// parked cars and the city behind. 1 world unit = 1 tile (32 px); y = 0 is the street surface; gameplay is z = 0.
import * as THREE from 'three';
import { model } from './models';
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
    const b = slab(w, h, 4, facadeMat(w, h, t, 0xd8c8e8), lambert(null, 0x2b2638), sideMat);
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
      const b = slab(w, y, BLOCK_DEPTH, facadeMat(Math.round(w), Math.ceil(y), t), lambert(null, 0x6a6478), sideMat);
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
    const x0 = toX(car.x0);
    const x1 = toX(car.x1);
    const bottom = toY(level, car.bottom);
    const roof = toY(level, car.roof);
    if (car.model === 'bus') kit.add(makeBus(x0, x1, bottom, roof));
    else if (car.model === 'cruiser') kit.add(makeParkedCruiser(x0, x1, bottom, roof, i));
    else kit.add(makeCar(x0, x1, bottom, roof, paints[(i * 7 + level.layout.floor) % paints.length]));
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

  //--- the L: elevated train tracks over the street on a helicopter escape (you hide under them) ------
  if (level.escape?.covers.length) {
    const steel = new THREE.MeshLambertMaterial({ color: 0x2f3a33 });
    const rust = new THREE.MeshLambertMaterial({ color: 0x5a3a2a });
    const tie = new THREE.MeshLambertMaterial({ color: 0x3a2a20 });
    for (const c of level.escape.covers) {
      const x0 = toX(c.x0);
      const x1 = toX(c.x1);
      const y = toY(level, c.y);
      const w = x1 - x0;
      //deck and the two deep side girders
      const deck = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, 3.2), steel);
      deck.position.set(x0 + w / 2, y + 0.125, 0.2);
      kit.add(deck);
      for (const z of [-1.35, 1.75]) {
        const girder = new THREE.Mesh(new THREE.BoxGeometry(w, 0.7, 0.12), steel);
        girder.position.set(x0 + w / 2, y + 0.3, z);
        kit.add(girder);
        //lattice: X braces along the girder face
        for (let x = x0 + 0.5; x < x1 - 0.4; x += 1) {
          for (const r of [0.6, -0.6]) {
            const brace = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.04), rust);
            brace.position.set(x, y + 0.3, z + (z > 0 ? 0.08 : -0.08));
            brace.rotation.z = r;
            kit.add(brace);
          }
        }
      }
      //ties and running rails on top
      for (let x = x0 + 0.2; x < x1; x += 0.5) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 2.2), tie);
        t.position.set(x, y + 0.3, 0.2);
        kit.add(t);
      }
      for (const z of [-0.3, 0.7]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.08), rust);
        rail.position.set(x0 + w / 2, y + 0.38, z);
        kit.add(rail);
      }
      //columns down to the street, in the back lane so they never touch the skate lane
      for (let x = x0 + 0.6; x < x1; x += 3) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, y, 0.35), steel);
        col.position.set(x, y / 2, -2.4);
        kit.add(col);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 1.1), steel);
        arm.position.set(x, y - 0.1, -1.9);
        kit.add(arm);
      }
    }
  }

  //--- exit: a glowing gate -------------------------------------------------------------------
  const gate = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.12, 8, 32, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x7cf0ff }),
  );
  gate.position.set(toX(level.exitX) + 0.5, 0, 0);
  gate.userData.gate = true; // gate-fx.ts fills the arch
  kit.add(gate);

  //--- the fork: a second gate up on the overpass and signs for both roads ----------------------
  if (level.fork) {
    const fork = level.fork;
    const hy = toY(level, fork.y);
    const high = gate.clone();
    high.material = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    high.userData = { gate: true };
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
// a building front; userData.facade lets the night pass (night.ts) light its windows
function facadeMat(w: number, h: number, t: number, color = 0xffffff): THREE.MeshLambertMaterial {
  const m = lambert(tileTexture(facade(w, h, t)), color);
  m.userData.facade = { w, h, t };
  return m;
}

function facade(w: number, h: number, t: number): TileCell[][] {
  const grid: TileCell[][] = [];
  for (let r = 0; r < h; r++) grid.push(new Array(w).fill(t));
  grid[0] = grid[0].map((_, i) => [t, i === 0 ? CITY.cap[0] : i === w - 1 ? CITY.cap[2] : CITY.cap[1]]);
  return grid;
}

// the Blender hatchbacks (art/cars.py) are 2.3 long and 1.25 to the roof, for a 2 tile hitbox, and are stretched to
// other hitboxes; the cruiser SUV only chases, so it keeps its own size
export type CarModel = 'Sedan' | 'Robotaxi' | 'Cruiser';
const MODEL_LEN = 2.3;
const MODEL_ROOF = 1.25;

// a CTA bus for the roadblock: white with the blue stripe, a dark window band, a route sign
export function makeBus(x0: number, x1: number, bottom: number, roof: number): THREE.Group {
  const bus = new THREE.Group();
  const w = x1 - x0;
  const h = roof - bottom;
  const body3d = model('Bus'); // art/cars.py: 6 long, roof 2.25 up
  if (body3d) {
    body3d.scale.set(w / 6, h / 2.25, 1);
    body3d.position.y = bottom;
    bus.add(body3d);
    bus.position.x = x0 + w / 2;
    return bus;
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.25, 1.9), new THREE.MeshLambertMaterial({ color: 0xeeeef2 }));
  body.position.y = bottom + 0.25 + (h - 0.25) / 2;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.22, 1.92), new THREE.MeshLambertMaterial({ color: 0x1f5fbf }));
  stripe.position.y = bottom + 0.25 + h * 0.3;
  const band = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, h * 0.3, 1.94), new THREE.MeshLambertMaterial({ color: 0x1a2230 }));
  band.position.set(-w * 0.02, bottom + 0.25 + h * 0.62, 0);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 1.2), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
  sign.position.set(w / 2 + 0.03, roof - 0.25, 0);
  bus.add(body, stripe, band, sign);
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.24, 12).rotateX(Math.PI / 2);
  const tire = new THREE.MeshLambertMaterial({ color: 0x111114 });
  for (const wx of [-w / 2 + 0.7, w / 2 - 0.9]) {
    for (const wz of [-0.85, 0.85]) {
      const wheel = new THREE.Mesh(wheelGeo, tire);
      wheel.position.set(wx, bottom + 0.3, wz);
      bus.add(wheel);
    }
  }
  bus.position.x = x0 + w / 2;
  return bus;
}

// a box truck driving your way with its tailgate down: the cab in front, the box behind, and the tailgate a ramp
// from the box floor to the street behind it (it kicks you up onto the box)
export function makeTruck(x0: number, x1: number, bottom: number, roof: number, paint: number, gate: number): THREE.Group {
  const truck = new THREE.Group();
  const w = x1 - x0;
  const h = roof - bottom;
  const floorY = bottom + 0.45;
  const cabW = 1.1;
  const boxW = w - cabW;
  //the tailgate: a diamond-plate ramp down to the street, its lip a hazard-striped edge (its length is the level's)
  const len = Math.hypot(gate, floorY - bottom);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 1.6), new THREE.MeshLambertMaterial({ color: 0xb8bcc4 }));
  ramp.position.set(-w / 2 - gate / 2, bottom + (floorY - bottom) / 2, 0);
  ramp.rotation.z = Math.atan2(floorY - bottom, gate);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.6), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
  lip.position.set(-w / 2 - gate + 0.04, bottom + 0.04, 0);
  truck.add(ramp, lip);
  const body3d = model('BoxTruck', paint); // art/cars.py: 4 long, box floor 0.45 and roof 2 up
  if (body3d) {
    body3d.scale.set(w / 4, h / 2, 1);
    body3d.position.y = bottom;
    truck.add(body3d);
    truck.position.x = x0 + w / 2;
    return truck;
  }
  const boxMat = new THREE.MeshLambertMaterial({ color: paint });
  const box = new THREE.Mesh(new THREE.BoxGeometry(boxW, h - 0.45, 1.9), boxMat);
  box.position.set(-w / 2 + boxW / 2, floorY + (h - 0.45) / 2, 0);
  //the open back: dark inside, framed
  const inside = new THREE.Mesh(new THREE.BoxGeometry(0.04, h - 0.6, 1.7), new THREE.MeshLambertMaterial({ color: 0x15151c }));
  inside.position.set(-w / 2 - 0.01, floorY + (h - 0.45) / 2, 0);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(cabW - 0.1, h * 0.62, 1.8), new THREE.MeshLambertMaterial({ color: 0x2a3a5a }));
  cab.position.set(w / 2 - cabW / 2 + 0.05, bottom + 0.3 + h * 0.31, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(0.5, h * 0.2, 1.82), new THREE.MeshLambertMaterial({ color: 0x1c2333 }));
  glass.position.set(w / 2 - 0.35, bottom + 0.3 + h * 0.5, 0);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, 1.7), new THREE.MeshLambertMaterial({ color: 0x222228 }));
  chassis.position.y = bottom + 0.35;
  truck.add(box, inside, cab, glass, chassis);
  const wheelGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.24, 12).rotateX(Math.PI / 2);
  const tire = new THREE.MeshLambertMaterial({ color: 0x111114 });
  for (const wx of [-w / 2 + 0.6, w / 2 - 0.6]) {
    for (const wz of [-0.85, 0.85]) {
      const wheel = new THREE.Mesh(wheelGeo, tire);
      wheel.position.set(wx, bottom + 0.28, wz);
      truck.add(wheel);
    }
  }
  const lamp = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wz of [-0.6, 0.6]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.25), lamp);
    head.position.set(w / 2 + 0.03, bottom + 0.55, wz);
    truck.add(head);
  }
  truck.position.x = x0 + w / 2;
  return truck;
}

// a cruiser parked across the street: the AI's black-and-white, its light bar on
function makeParkedCruiser(x0: number, x1: number, bottom: number, roof: number, i: number): THREE.Group {
  const car = makeCar(x0, x1, bottom, roof, 0x1c1c24, 'Cruiser');
  const top = new THREE.Box3().setFromObject(car).max.y;
  const flip = i % 2 === 0;
  for (const [dz, color] of [[-0.3, flip ? 0xff2a2a : 0x2a6bff], [0.3, flip ? 0x2a6bff : 0xff2a2a]] as const) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.11, 0.58), new THREE.MeshBasicMaterial({ color }));
    light.position.set(-0.05, top + 0.055, dz);
    car.add(light);
  }
  return car;
}

export function makeCar(x0: number, x1: number, bottom: number, roof: number, paint: number, kind: CarModel = 'Sedan'): THREE.Group {
  const car = new THREE.Group();
  const w = x1 - x0;
  const h = roof - bottom;
  const body3d = model(kind, paint);
  if (body3d) {
    if (kind !== 'Cruiser') body3d.scale.set((w + 0.3) / MODEL_LEN, h / MODEL_ROOF, 1);
    body3d.position.y = bottom;
    car.add(body3d);
    car.position.x = x0 + w / 2;
    return car;
  }
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

const ROAD_COLORS: Record<Road['kind'], string> = { boon: '#ffd23f', cash: '#5fe08a', hot: '#ff4a3a', stash: '#b98cff', shop: '#4ad8ff', spot: '#9cf05a', escape: '#ff4a3a' };

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
