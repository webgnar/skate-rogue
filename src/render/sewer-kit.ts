// The sewer route (src/gen/sewer.ts), drawn as a cutaway under the street: the street is a thin roof (kit.ts), and
// under it a brick storm tunnel with a concrete floor, a trickle of runoff along the back and streams of it on the
// floor (pale chevrons show the current running your way), rusty pipes on brackets off the back wall, caged work
// lamps, graffiti, and the outlet ramp up to the street. Each way in is a construction spot on the street: hazard paint,
// cones and a striped barricade, the steel trench plate dragged aside, a dirt pile and a little excavator, and at the
// foot of a hill a plank ramp down into the dig. A kick-out is a concrete quarterpipe against the wall under a grate in
// the street; the full pipe's bowl is a round chamber; the subway crossing is a gap onto the tracks running off into
// the city; the surge's storm gate stands at the tunnel's start; the tunnel to the gate comes up at an UNDERGROUND
// sign. Light falls in through the holes and grates. The moving pieces (rats, the surge's water, trains, the
// alligator) are src/render/sewer-view.ts. Plain shared materials, so the floor's batching (batch.ts) merges them.
import * as THREE from 'three';
import { TILE } from '../physics/constants';
import { inHill, pitAt, SEWER_ROOF, type Level, type Sewer } from '../physics/level';
import { SEWER } from '../gen/sewer';
import { makeRng } from '../gen/rng';
import { surface } from './surfaces';

const BACK = -2.6; // the tunnel's back wall (the skater rolls at z 0)
const FRONT = 4; // the near sidewalk's front (hillside.ts HILLSIDE.nearWalk)
const STREET_BACK = -3.5;
const ROCK = -9; // how deep the ground under the tunnel is drawn
const DEEP_ROCK = -18; // and under the deep (as far down as the hill's ground goes: hillside.ts HILLSIDE.bottom)
const SUBWAY_BACK = -40; // the subway line runs off this far into the city

let tagTex: THREE.CanvasTexture | null = null;
// a sheet of graffiti tags: bubble letters and throw-ups in a few colours, cut into panels along the wall
function tags(): THREE.CanvasTexture {
  if (tagTex) return tagTex;
  const W = 512;
  const H = 128;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  const words = ['GNAR', 'DWN', 'RATZ', 'SK8', 'FLOW', 'LOU', 'DIY'];
  const colors = ['#ff4fa3', '#3fe0ff', '#ffd23f', '#7cff6b', '#ff7a1a', '#c08cff'];
  words.forEach((w, i) => {
    const x = (i * W) / words.length + 6;
    g.font = `bold ${38 + (i % 3) * 8}px Arial Black, Arial, sans-serif`;
    g.lineWidth = 8;
    g.strokeStyle = '#141018';
    g.fillStyle = colors[i % colors.length];
    g.save();
    g.translate(x, 86 - (i % 2) * 18);
    g.rotate(-0.08 + (i % 3) * 0.06);
    g.strokeText(w, 0, 0);
    g.fillText(w, 0, 0);
    g.restore();
  });
  tagTex = new THREE.CanvasTexture(c);
  tagTex.colorSpace = THREE.SRGBColorSpace;
  return tagTex;
}

let glowTex: THREE.CanvasTexture | null = null;
// a soft round glow, white in the middle, fading out (tinted by the material)
function glowDisc(): THREE.CanvasTexture {
  if (glowTex) return glowTex;
  const N = 64;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, N, N);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

let beamTex: THREE.CanvasTexture | null = null;
// a shaft of light falling in from the street: bright at the top, soft at the sides, fading out toward the floor
function beam(): THREE.CanvasTexture {
  if (beamTex) return beamTex;
  const [W, H] = [64, 128];
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const down = g.createLinearGradient(0, 0, 0, H);
  down.addColorStop(0, 'rgba(255,255,255,1)');
  down.addColorStop(1, 'rgba(255,255,255,0.05)');
  g.fillStyle = down;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'destination-in';
  const side = g.createLinearGradient(0, 0, W, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(0.3, 'rgba(0,0,0,1)');
  side.addColorStop(0.7, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = side;
  g.fillRect(0, 0, W, H);
  beamTex = new THREE.CanvasTexture(c);
  return beamTex;
}

let latticeTex: THREE.CanvasTexture | null = null;
// a pool of light through a manhole grate, seen from below: a glowing disc cut into diamonds (zack's ref)
function lattice(): THREE.CanvasTexture {
  if (latticeTex) return latticeTex;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(N / 2, N / 2, 4, N / 2, N / 2, N / 2);
  grad.addColorStop(0, 'rgba(255,246,210,1)');
  grad.addColorStop(0.7, 'rgba(255,230,160,0.8)');
  grad.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.strokeStyle = 'rgba(0,0,0,1)';
  g.lineWidth = 5;
  for (let k = -N; k < 2 * N; k += 16) {
    g.beginPath();
    g.moveTo(k, 0);
    g.lineTo(k + N, N);
    g.moveTo(k + N, 0);
    g.lineTo(k, N);
    g.stroke();
  }
  latticeTex = new THREE.CanvasTexture(c);
  latticeTex.colorSpace = THREE.SRGBColorSpace;
  return latticeTex;
}

// a sign painted on a board: big words over small ones
function board(big: string, small: string, bg: string, fg: string): THREE.Mesh {
  const W = 256;
  const H = 96;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = fg;
  g.lineWidth = 5;
  g.strokeRect(5, 5, W - 10, H - 10);
  g.fillStyle = fg;
  g.textBaseline = 'top';
  g.font = 'bold 34px Arial Black, Arial, sans-serif';
  g.fillText(big, 16, 14);
  g.font = 'bold 16px Arial, sans-serif';
  g.fillText(small, 18, 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: tex }));
}

export function buildSewers(level: Level): THREE.Group {
  const g = new THREE.Group();
  if (!level.sewers?.length) return g;
  const X = (px: number) => px / TILE;
  const Y = (py: number) => (level.streetY - py) / TILE;
  const roof = -SEWER_ROOF / TILE;
  const brick = surface('brick', 0x4a4038);
  const floor = surface('concrete', 0x6a665c);
  const ground = surface('concrete', 0x2a2420);
  const pipeMat = new THREE.MeshLambertMaterial({ color: 0x6f7a5a });
  const bracket = new THREE.MeshLambertMaterial({ color: 0x3a3430 });
  const water = new THREE.MeshLambertMaterial({ color: 0x3f6e52, emissive: 0x0c2a16, transparent: true, opacity: 0.88 });
  const chevron = new THREE.MeshBasicMaterial({ color: 0xbff5e6, transparent: true, opacity: 0.55, depthWrite: false });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const cage = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const hazard = new THREE.MeshBasicMaterial({ color: 0xf2c230 });
  const stripe = new THREE.MeshBasicMaterial({ color: 0x1a1414 });
  const shaft = new THREE.MeshBasicMaterial({ map: beam(), color: 0xfff0c8, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  const cone = new THREE.MeshLambertMaterial({ color: 0xff6a1a });
  const white = new THREE.MeshLambertMaterial({ color: 0xf2f0ea });
  const plate = surface('plate', 0x7a7e86);
  const dirt = new THREE.MeshLambertMaterial({ color: 0x6a4a30 });
  const yellow = new THREE.MeshLambertMaterial({ color: 0xf2b21a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c1a1e });
  const plank = surface('plywood', 0xc89a5a);
  const steel = new THREE.MeshLambertMaterial({ color: 0x9aa4b4 });
  const rail = new THREE.MeshLambertMaterial({ color: 0xb8bcc8 });
  const tile = surface('concrete', 0x8a9a96);
  const tagMat = new THREE.MeshBasicMaterial({ map: tags(), transparent: true, depthWrite: false });
  //(from zack's refs, 2026-10-31: red-orange brick arches with iron ribs, grates glowing from the street above, toxic
  //green ooze out of pipe mouths, orange-and-white barrels and ROAD CLOSED / DETOUR boards at the digs, and Lower
  //Wacker's pillared underground street at the gate)
  const archBrick = surface('brick', 0x8a4a32);
  const archDark = new THREE.MeshBasicMaterial({ color: 0x0c0a0c });
  const iron = new THREE.MeshLambertMaterial({ color: 0x2c2826 });
  const ooze = new THREE.MeshBasicMaterial({ color: 0x7cff4a });
  const oozeGlow = new THREE.MeshBasicMaterial({ map: glowDisc(), color: 0x7cff4a, transparent: true, opacity: 0.45, depthWrite: false });
  const grateGlow = new THREE.MeshBasicMaterial({ map: lattice(), transparent: true, opacity: 0.85, depthWrite: false });
  const barrel = new THREE.MeshLambertMaterial({ color: 0xff6a1a });
  const fence = new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const pillar = surface('concrete', 0x9a948a);
  const redLight = new THREE.MeshBasicMaterial({ color: 0xff3030 });
  const ceilLight = new THREE.MeshBasicMaterial({ color: 0xfff4d0 });
  const stone = surface('concrete', 0x5a6a70);
  const mainMat = new THREE.MeshLambertMaterial({ color: 0x2a4a8a });
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    g.add(b);
    return b;
  };
  // a soft shaft of light from the street (y top) down to the floor (y bottom), as two crossed planes, wider at its foot
  const light = (a: number, b: number, bottom: number, top: number, w = 1.2) => {
    for (const rot of [0, Math.PI / 2]) {
      const geo = new THREE.PlaneGeometry(1, top - bottom);
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) pos.setX(k, pos.getX(k) * (pos.getY(k) > 0 ? b - a : (b - a) * 1.5));
      const m = new THREE.Mesh(geo, shaft);
      m.position.set((a + b) / 2, (top + bottom) / 2, 0);
      m.rotation.y = rot;
      if (rot) m.scale.x = w / (b - a);
      g.add(m);
    }
  };
  // a solid wedge under a slope from (a, ya) to (b, yb), down to `base`, across z0..z1
  const wedge = (a: number, ya: number, b: number, yb: number, base: number, z0: number, z1: number, m: THREE.Material) => {
    const shape = new THREE.Shape([new THREE.Vector2(a, base), new THREE.Vector2(b, base), new THREE.Vector2(b, yb), new THREE.Vector2(a, ya)]);
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false }), m);
    mesh.position.z = z0;
    g.add(mesh);
    return mesh;
  };

  const all = level.sewers;
  all.forEach((s, i) => {
    const rng = makeRng(level.layout.seed * 31 + i * 977 + 7);
    const x0 = X(s.x0);
    const x1 = X(s.x1);
    const fy = Y(s.y);
    //(the route's rooms run on into each other: ends only where one stops)
    const before = all.some((o) => o !== s && o.x1 === s.x0);
    const after = all.some((o) => o !== s && o.x0 === s.x1);
    const ramp = s.outlet[1] > s.outlet[0] ? x1 - SEWER.ramp : x1;
    //the deep's roof: under the street at first in the drop's room, then down under the hills and canals
    const at = s.top !== undefined ? X(s.topAt ?? s.x0) : x1;
    const low = s.top !== undefined ? Y(s.top) : roof;
    const high = s.top0 !== undefined ? Y(s.top0) : roof; // (over a drop deeper in the deep: the last room's roof)
    const roofAt = (x: number) => (x >= at ? low : high);
    const p = s.piece;
    const bowl = p?.kind === 'bowl' ? p : null;
    const sub = p?.kind === 'subway' ? p : null;
    const deep = bowl ? fy - bowl.depth / TILE : fy;
    const rock = s.deep ? DEEP_ROCK : ROCK;
    const wall = s.deep ? archBrick : brick;
    //the ground: under the tunnel (split round the subway's gap), and either side of it under the street's usual 3 tiles
    const gaps: [number, number][] = sub ? [[X(sub.x0), X(sub.x1)]] : [];
    let gx = before ? x0 : x0 - 0.5;
    for (const [a, b] of gaps) {
      box(gx, a, rock, deep - 0.3, STREET_BACK, FRONT, ground);
      gx = b;
    }
    //(not under a climb up from deeper: the bank's own wedge is the ground there, all the way down)
    const gEnd = after ? x1 : x1 + 0.5;
    if (s.climb) {
      const [c0, c1] = [X(s.climb[0]), X(s.climb[1])];
      if (c0 > gx) box(gx, c0, rock, deep - 0.3, STREET_BACK, FRONT, ground);
      box(c0, c1, s.deep ? DEEP_ROCK : ROCK - 6, Math.min(fy, ...all.filter((o) => o.x1 === s.x0).map((o) => Y(o.y))) - 0.3, STREET_BACK, FRONT, ground);
      gx = Math.max(gx, c1);
    }
    if (gEnd > gx) box(gx, gEnd, rock, deep - 0.3, STREET_BACK, FRONT, ground);
    if (!before) box(x0 - 6, x0 - 0.5, ROCK, -3, STREET_BACK, FRONT, ground);
    if (!after) box(x1 + 0.5, x1 + 6, ROCK, -3, STREET_BACK, FRONT, ground);
    //the tunnel's ends and back wall
    if (!before) box(x0 - 0.5, x0, deep - 0.3, roof, STREET_BACK, FRONT, brick);
    if (!after) box(x1, x1 + 0.5, fy - 0.3, roof, STREET_BACK, FRONT, brick);
    const wallFoot = s.climbFrom !== undefined ? Math.min(deep, Y(s.climbFrom)) : deep; // (down the climb's foot too)
    if (at > x0) box(x0, Math.min(at, x1), wallFoot, high, STREET_BACK, BACK, wall);
    if (at < x1) {
      box(at, x1, deep, low, STREET_BACK, BACK, wall);
      //the deep's roof: the ground between it and the street (or the canal) over it (under the hill, the hill's own
      //ground comes down to it: hillside.ts), a brick lintel where it comes down
      for (let x = Math.floor(at); x < x1; ) {
        const hilled = inHill(level, (x + 0.5) * TILE);
        let e = x + 1;
        while (e < x1 && inHill(level, (e + 0.5) * TILE) === hilled) e++;
        if (!hilled) box(Math.max(x, at), Math.min(e, x1), low, -3, STREET_BACK, FRONT - 0.01, ground);
        x = e;
      }
      box(at, x1, low - 0.25, low, BACK, FRONT - 0.02, archBrick);
      if (at > x0 || !before) box(at - 0.3, at, low - 0.25, high, STREET_BACK, FRONT - 0.02, archBrick);
    }
    //(and where the next room's roof is higher, the lintel goes back up to it)
    const next = all.find((o) => o.x0 === s.x1);
    const nextRoof = next ? (next.top !== undefined && (next.topAt ?? next.x0) <= next.x0 ? Y(next.top) : next.top0 !== undefined ? Y(next.top0) : roof) : roof;
    if (s.top !== undefined && next && nextRoof > low + 0.01) box(x1, x1 + 0.3, low - 0.25, nextRoof, STREET_BACK, FRONT - 0.02, archBrick);
    //the drop into the deep: the shallow tunnel's runoff falls off the edge in a sheet, foaming at the foot
    if (s.entry === 'drop') {
      const up = all.find((o) => o.x1 === s.x0);
      if (up) {
        const uy = Y(up.y);
        box(x0 - 0.3, x0, fy, uy - 0.3, STREET_BACK, FRONT, archBrick); // (the drop's face, brick)
        box(x0, x0 + 0.18, fy, uy, BACK, FRONT - 0.8, water);
        for (let k = 0; k < 5; k++) {
          const foam = new THREE.Mesh(new THREE.SphereGeometry(0.35 + rng() * 0.25, 8, 6), white);
          foam.position.set(x0 + 0.2 + rng() * 0.8, fy + 0.1, BACK + 0.4 + k * ((FRONT - BACK - 1.4) / 4));
          foam.scale.y = 0.45;
          g.add(foam);
        }
      }
    }
    //the floor, as the physics has it: flat runs as slabs, slopes (the bowl's sides, kick-outs, ramps) as wedges
    const inStairs = (f: { x0: number; x1: number }) => (s.stairs ?? []).some((t) => f.x0 >= t.x0 && f.x1 <= t.x1);
    for (const f of level.surfaces) {
      if (!f.sewer || f.x0 < s.x0 - 1 || f.x1 > s.x1 + 1 || inStairs(f)) continue;
      const [a, b] = [X(f.x0), X(f.x1)];
      const [ya, yb] = [Y(f.y), Y(f.y1 ?? f.y)];
      if (f.launch) {
        //a kick-out: a concrete quarterpipe up against the wall, a steel coping on its lip, chevrons on the wall over it
        const pts: THREE.Vector2[] = [new THREE.Vector2(a, fy - 0.3), new THREE.Vector2(b + 0.15, fy - 0.3), new THREE.Vector2(b + 0.15, yb)];
        for (let k = 8; k >= 0; k--) {
          const t = k / 8;
          pts.push(new THREE.Vector2(a + (b - a) * (1 - Math.cos((t * Math.PI) / 2)) ** 0.9, fy + (yb - fy) * (1 - Math.sin(((1 - t) * Math.PI) / 2))));
        }
        const qp = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: FRONT - BACK - 0.6, bevelEnabled: false }), tile);
        qp.position.z = BACK;
        g.add(qp);
        const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, FRONT - BACK - 0.6, 8).rotateX(Math.PI / 2), steel);
        lip.position.set(b + 0.05, yb, (BACK + FRONT - 0.6) / 2);
        g.add(lip);
        for (let k = 0; k < 3; k++) {
          const c = box(b - 0.1, b + 0.5, yb + 0.5 + k * 0.5, yb + 0.62 + k * 0.5, BACK + 0.02, BACK + 0.05, hazard);
          c.rotation.z = 0.5;
        }
      } else if (f.y1 !== undefined && Y(f.y) >= -0.01 && f.x0 === s.drain[0]) {
        //the plank ramp down into the dig off the foot of the hill: boards on a frame, the dig's dirt under it
        const len = Math.hypot(b - a, yb - ya);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 2.2), plank);
        deck.position.set((a + b) / 2, (ya + yb) / 2 - 0.06, -0.3);
        deck.rotation.z = Math.atan2(yb - ya, b - a);
        g.add(deck);
        for (const t of [0.3, 0.7]) box(a + (b - a) * t - 0.06, a + (b - a) * t + 0.06, fy, ya + (yb - ya) * t - 0.1, -1.3, -1.1, bracket);
      } else if (f.y1 !== undefined) {
        wedge(a, ya, b, yb, Math.min(ya, yb, fy) - 0.3, BACK, FRONT, f.x1 === s.x1 || f.x0 === s.climb?.[0] ? floor : tile);
      } else if (f.kind === 'ledge') {
        //a walkway along the deep's back wall, over its channel: a stone shelf on corbels, a kerb along its edge
        box(a, b, ya - 0.3, ya, BACK, 0.7, stone);
        box(a, b, ya - 0.05, ya + 0.04, 0.6, 0.72, pillar);
        for (let x = a + 0.6; x < b - 0.3; x += 1.6) wedge(x - 0.2, ya - 0.3, x + 0.2, ya - 0.3, ya - 1, BACK, 0.3, stone);
      } else box(a, b, ya - 0.3, ya, BACK, FRONT, bowl && f.y > s.y ? tile : floor);
    }
    //runoff: a trickle along the back, and streams of it across the floor with chevrons running your way
    box(x0, ramp, fy - 0.02, fy + 0.03, BACK, BACK + 0.5, water);
    for (const [w0, w1] of s.wet) {
      box(X(w0), X(w1), fy - 0.02, fy + 0.04, BACK, FRONT - 0.6, water);
      for (let x = X(w0) + 0.4; x < X(w1) - 0.4; x += 0.9) {
        for (const z of [-1.4, 0.4, 2.0]) {
          const v = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.08), chevron);
          v.rotation.x = -Math.PI / 2;
          const w = v.clone();
          v.rotation.z = 0.6;
          w.rotation.z = -0.6;
          v.position.set(x, fy + 0.05, z - 0.1);
          w.position.set(x, fy + 0.05, z + 0.1);
          g.add(v, w);
        }
      }
    }
    //brick arches down the back wall, the tunnel running off into the dark through each, and iron ribs between them
    //(zack's brick sewer refs); a toxic green pipe mouth now and then, oozing into the runoff
    const lower = bowl || sub ? (x: number) => (bowl && x > X(bowl.x0) - 1.6 && x < X(bowl.x1) + 1.6) || (sub && x > X(sub.x0) - 1.6 && x < X(sub.x1) + 1.6) : () => false;
    const archR = Math.min(1.5, (low - fy) * 0.42);
    for (let x = x0 + 5.5; x < ramp - 2; x += 9) {
      if (lower(x)) continue;
      const ring = new THREE.Mesh(new THREE.RingGeometry(archR, archR + 0.35, 14, 1, 0, Math.PI), archBrick);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(archR, 14, 0, Math.PI), archDark);
      for (const m of [ring, hole]) m.position.set(x, fy + archR * 0.9, BACK + 0.02);
      hole.position.z = BACK + 0.015;
      box(x - archR, x + archR, fy, fy + archR * 0.9, BACK + 0.01, BACK + 0.015, archDark);
      for (const sx of [-1, 1]) box(x + sx * (archR + 0.175) - 0.175, x + sx * (archR + 0.175) + 0.175, fy, fy + archR * 0.9, BACK, BACK + 0.04, archBrick);
      g.add(ring, hole);
    }
    for (let x = x0 + 1; x < ramp; x += 3) {
      if (lower(x)) continue;
      box(x - 0.08, x + 0.08, fy, roofAt(x), BACK, BACK + 0.1, iron);
      box(x - 0.14, x + 0.14, roofAt(x) - 0.18, roofAt(x), BACK, 0.6, iron);
    }
    for (let x = x0 + 9.5; x < ramp - 2; x += 13) {
      if (lower(x) || rng() < 0.35) continue;
      const py = fy + 0.9 + rng() * 0.6;
      const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 14).rotateX(Math.PI / 2), pipeMat);
      mouth.position.set(x, py, BACK + 0.25);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.32, 14), archDark);
      inner.position.set(x, py, BACK + 0.51);
      const lipOoze = new THREE.Mesh(new THREE.CircleGeometry(0.32, 14, Math.PI, Math.PI), ooze);
      lipOoze.position.set(x, py, BACK + 0.52);
      lipOoze.scale.y = 0.35;
      g.add(mouth, inner, lipOoze);
      box(x - 0.12, x + 0.12, fy + 0.02, py - 0.05, BACK + 0.45, BACK + 0.55, ooze);
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.8, 12), ooze);
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.y = 0.7;
      puddle.position.set(x, fy + 0.05, BACK + 0.8);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), oozeGlow);
      glow.position.set(x, py - 0.2, BACK + 0.06);
      g.add(puddle, glow);
    }
    //caged work lamps along the back wall, and graffiti between them
    for (let x = x0 + 2.5; x < ramp - 1; x += 6) {
      const r = roofAt(x);
      box(x - 0.18, x + 0.18, r - 0.7, r - 0.4, BACK, BACK + 0.12, cage);
      box(x - 0.12, x + 0.12, r - 0.66, r - 0.44, BACK + 0.12, BACK + 0.2, lamp);
      if (rng() < 0.7) {
        const tag = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), tagMat.clone());
        const m = tag.material as THREE.MeshBasicMaterial;
        m.map = tags().clone();
        m.map.needsUpdate = true;
        m.map.repeat.set(2 / 7, 1);
        m.map.offset.set(Math.floor(rng() * 6) / 7, 0);
        tag.position.set(x + 3, fy + 1.1 + rng() * 0.8, BACK + 0.03);
        g.add(tag);
      }
    }
    //light falling in through the holes, and hazard paint round them on the street
    for (const [h0, h1] of [s.drain, s.outlet]) {
      if (h1 <= h0) continue;
      const [a, b] = [X(h0), X(h1)];
      light(a + 0.1, b - 0.1, fy, roof);
      for (const [p0, p1] of [[a - 0.35, a], [b, b + 0.35]]) {
        box(p0, p1, 0, 0.02, STREET_BACK + 1.2, FRONT, hazard);
        for (let z = STREET_BACK + 1.4; z < FRONT - 0.2; z += 0.6) box(p0, p1, 0.02, 0.03, z, z + 0.25, stripe);
      }
    }
    if (s.entry === 'dig' || s.entry === 'ramp') construction(s);
    if (s.entry === 'dig') dig(s, fy);
    if (s.entry === 'shaft') shaftDig(s, fy, low);
    for (const t of s.stairs ?? []) stairs(t, fy);
    //a green slime fall now and then, from a broken pipe in the roof down the back wall into a glowing pool
    if (rng() < 0.6) {
      const x = x0 + 6 + rng() * Math.max(1, ramp - x0 - 12);
      const busy = (s.stairs ?? []).some((t) => x > X(t.x0) - 1 && x < X(t.x1) + 1) || lower(x);
      if (!busy) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 10), pipeMat);
        pipe.position.set(x, roofAt(x) - 0.2, BACK + 0.4);
        box(x - 0.13, x + 0.13, fy, roofAt(x) - 0.4, BACK + 0.3, BACK + 0.5, ooze);
        const pool = new THREE.Mesh(new THREE.CircleGeometry(0.9, 14), ooze);
        pool.rotation.x = -Math.PI / 2;
        pool.scale.y = 0.6;
        pool.position.set(x, fy + 0.05, BACK + 0.9);
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, roofAt(x) - fy + 1), oozeGlow);
        glow.position.set(x, (fy + roofAt(x)) / 2, BACK + 0.06);
        g.add(pipe, pool, glow);
      }
    }
    //kick-outs' grates: a frame in the street with bars across, light falling through
    for (const k of s.kicks ?? []) {
      const [a, b] = [X(k.grate[0]), X(k.grate[1])];
      box(a, a + 0.12, roof, 0.01, STREET_BACK + 1, FRONT, dark);
      box(b - 0.12, b, roof, 0.01, STREET_BACK + 1, FRONT, dark);
      for (let x = a + 0.3; x < b - 0.2; x += 0.32) box(x - 0.04, x + 0.04, -0.06, 0.01, STREET_BACK + 1, FRONT, dark);
      for (const z of [STREET_BACK + 1, -0.5, 1.5, FRONT - 0.1]) box(a, b, -0.08, 0.01, z - 0.05, z + 0.05, dark);
      light(a + 0.2, b - 0.2, fy, roof, 1.6);
      //(and the grate's light lies on the quarterpipe's floor in diamonds, like a manhole seen from below)
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(b - a + 0.6, 3.2), grateGlow);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set((a + b) / 2 - 1.2, fy + 0.06, 0);
      g.add(pool);
      const under = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 3), grateGlow);
      under.rotation.x = Math.PI / 2;
      under.position.set((a + b) / 2, roof - 0.01, 0);
      g.add(under);
    }
    //the full pipe: a round chamber, its ring of tiles on the back wall
    if (bowl) {
      const [a, b] = [X(bowl.x0), X(bowl.x1)];
      const r = (b - a) / 2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 40, 1, Math.PI, Math.PI), tile);
      //(the bottom half of a circle, squashed so it runs from the street's underside down to the bowl's bottom)
      ring.position.set((a + b) / 2, fy + 0.3, BACK + 0.04);
      ring.scale.y = (fy + 0.3 - deep) / r;
      g.add(ring);
      const sign = board('FULL PIPE', 'carve it', '#2c3a3a', '#bff5e6');
      sign.scale.setScalar(0.6);
      sign.position.set(a - 0.8, roofAt(a) - 1.2, BACK + 0.05);
      g.add(sign);
    }
    //the subway crossing: the gap onto the tracks, the line running off into the city, a third rail and a signal
    if (sub) {
      const [a, b] = [X(sub.x0), X(sub.x1)];
      const bed = fy - 3.2;
      box(a, b, ROCK, bed, SUBWAY_BACK, FRONT, ground);
      box(a - 0.3, a, bed, fy - 0.3, SUBWAY_BACK, BACK, brick);
      box(b, b + 0.3, bed, fy - 0.3, SUBWAY_BACK, BACK, brick);
      box(a, b, fy + 0.5, roofAt(a), SUBWAY_BACK, BACK - 0.01, dark); // the line's tunnel mouth over the gap, back into the dark
      for (const x of [a + (b - a) * 0.3, a + (b - a) * 0.7]) box(x - 0.05, x + 0.05, bed, bed + 0.12, SUBWAY_BACK, FRONT, rail);
      box(a + (b - a) * 0.88 - 0.06, a + (b - a) * 0.88 + 0.06, bed, bed + 0.18, SUBWAY_BACK, FRONT, yellow);
      box(b + 0.35, b + 0.5, fy, fy + 1.4, BACK + 0.2, BACK + 0.35, dark);
      const sign = board('MIND THE GAP', 'trains cross here', '#7a1e1e', '#ffffff');
      sign.scale.setScalar(0.55);
      sign.position.set(a - 1, roofAt(a) - 1.1, BACK + 0.05);
      g.add(sign);
    }
    //the surge's storm gate, at the tunnel's start: a ribbed steel gate in the end wall, hazard bars on it
    if (p?.kind === 'surge') {
      const r = roofAt(x0);
      if (!before) {
        box(x0, x0 + 0.25, fy, r - 0.3, BACK, FRONT - 0.8, steel);
        for (let y = fy + 0.4; y < r - 0.5; y += 0.6) box(x0 + 0.25, x0 + 0.32, y, y + 0.12, BACK, FRONT - 0.8, dark);
      } else {
        //(along the route, the gate's in the back wall: a round steel flood door, its wheel and hazard bars)
        const door = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.2, 20).rotateX(Math.PI / 2), steel);
        door.position.set(x0 + 1.6, fy + 1.4, BACK + 0.1);
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 16), dark);
        wheel.position.set(x0 + 1.6, fy + 1.4, BACK + 0.25);
        g.add(door, wheel);
        for (const dy of [-0.8, 0.8]) box(x0 + 0.6, x0 + 2.6, fy + 1.4 + dy - 0.06, fy + 1.4 + dy + 0.06, BACK + 0.2, BACK + 0.24, hazard);
      }
      const sign = board('FLOOD GATE', 'keep moving', '#3a3a10', '#f2c230');
      sign.scale.setScalar(0.55);
      sign.position.set(x0 + 3.2, r - 1.1, BACK + 0.05);
      g.add(sign);
    }
    //the tunnel to the gate comes up into the underground spot
    if (s.gate) {
      //Lower Wacker (zack's ref): the last stretch opens into a pillared underground street, concrete columns with
      //steel bracing, strip lights under the deck and red signals off in the gloom
      for (let x = ramp - 9; x < x1 - 1; x += 4) {
        if (x < x0 + 1 || lower(x)) continue;
        const base = x < ramp ? fy : fy + ((x - ramp) / SEWER.ramp) * (0 - fy);
        box(x - 0.28, x + 0.28, base, roof, BACK + 0.02, BACK + 0.58, pillar);
        box(x - 0.34, x + 0.34, base, base + 0.35, BACK + 0.02, BACK + 0.64, pillar);
        const brace = box(x - 0.05, x + 0.05, fy, roof, BACK + 0.08, BACK + 0.12, iron);
        brace.rotation.z = 0.5;
        box(x + 1.6, x + 2.4, roof - 0.08, roof - 0.02, -1.4, 0.4, ceilLight);
        if (rng() < 0.6) box(x + 1, x + 1.12, fy + 1.2, fy + 1.4, BACK + 0.05, BACK + 0.1, redLight);
      }
      const sign = board('UNDERGROUND', 'DIY spot ▶', '#141018', '#ff4fa3');
      sign.scale.setScalar(0.7);
      sign.position.set(ramp - 1.5, roof - 1.1, BACK + 0.05);
      g.add(sign);
    }
  });

  // a stair set (zack's ledges ref): brick-topped steps up, a concrete landing, steps down with a steel handrail over
  // them, and a low hubba wall along the back with little lights set in it
  function stairs(t: { x0: number; up: number; top: number; x1: number; h: number }, fy: number): void {
    const [a, u, tp, b] = [X(t.x0), X(t.up), X(t.top), X(t.x1)];
    const h = t.h / TILE;
    const z0 = BACK + 0.6;
    const flight = (from: number, to: number, y0: number, y1: number) => {
      const n = Math.max(3, Math.round(Math.abs(to - from) * 2));
      for (let k = 0; k < n; k++) {
        const xa = from + ((to - from) * k) / n;
        const xb = from + ((to - from) * (k + 1)) / n;
        const y = y0 + ((y1 - y0) * (y1 > y0 ? k + 1 : k)) / n;
        box(Math.min(xa, xb), Math.max(xa, xb), fy - 0.3, y, z0, FRONT - 0.4, stone);
        box(Math.min(xa, xb), Math.max(xa, xb), y - 0.06, y + 0.02, z0, FRONT - 0.4, archBrick);
      }
    };
    if (u > a) flight(a, u, fy, fy + h);
    box(u, tp, fy - 0.3, fy + h, z0, FRONT - 0.4, stone);
    box(u, tp, fy + h - 0.06, fy + h + 0.02, z0, FRONT - 0.4, archBrick);
    flight(b, tp, fy, fy + h);
    //the hubba wall along the back: up the steps, flat over the landing, down the far steps, its lights in a row
    const wall = 0.55;
    if (u > a) wedge(a, fy + wall, u, fy + h + wall, fy - 0.3, BACK, z0, stone);
    box(u, tp, fy - 0.3, fy + h + wall, BACK, z0, stone);
    wedge(tp, fy + h + wall, b, fy + wall, fy - 0.3, BACK, z0, stone);
    for (let x = a + 0.4; x < b - 0.2; x += 0.6) {
      const y = x < u ? fy + ((x - a) / (u - a)) * h : x < tp ? fy + h : fy + h - ((x - tp) / (b - tp)) * h;
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), lamp);
      dot.position.set(x, y + wall * 0.45, z0 + 0.01);
      g.add(dot);
    }
    //the handrail: a steel tube down the far steps on posts
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 8), steel);
    const [ra, rb] = [tp - 0.5, b + 0.5];
    const [ya, yb] = [fy + h + SEWER.railH / TILE, fy + SEWER.railH / TILE];
    rail.scale.y = Math.hypot(rb - ra, yb - ya);
    rail.position.set((ra + rb) / 2, (ya + yb) / 2, 0);
    rail.rotation.z = Math.atan2(yb - ya, rb - ra) - Math.PI / 2;
    g.add(rail);
    for (const k of [0.15, 0.5, 0.85]) {
      const x = ra + (rb - ra) * k;
      const top = ya + (yb - ya) * k;
      const foot = x < tp ? fy + h : x > b ? fy : fy + h - ((x - tp) / (b - tp)) * h;
      box(x - 0.035, x + 0.035, foot, top, -0.035, 0.035, steel);
    }
  }

  // the dig at a construction spot's way in, seen in the cutaway: timber shoring boards down its walls, cross braces,
  // a ladder down the back and a fat blue water main running through it (zack's construction refs)
  function dig(s: Sewer, fy: number): void {
    const [a, b] = [X(s.drain[0]), X(s.drain[1])];
    for (const x of [a, b]) for (let z = BACK; z < BACK + 1.2; z += 0.4) box(x - 0.06, x + 0.06, fy, 0, z, z + 0.32, plank);
    for (let y = fy + 0.8; y < -0.3; y += 1.1) {
      const brace = box(a, b, y, y + 0.12, BACK + 0.2, BACK + 0.32, plank);
      brace.rotation.z = (y * 7) % 2 > 1 ? 0.18 : -0.18;
    }
    //the ladder, leaning on the back of the hole
    const lx = b - 0.5;
    for (const dx of [-0.22, 0.22]) box(lx + dx - 0.04, lx + dx + 0.04, fy, 0.6, BACK + 0.15, BACK + 0.25, yellow);
    for (let y = fy + 0.3; y < 0.5; y += 0.35) box(lx - 0.22, lx + 0.22, y, y + 0.05, BACK + 0.17, BACK + 0.23, yellow);
    //the water main, through the back of the dig
    const main = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, b - a + 1.2, 12).rotateZ(Math.PI / 2), mainMat);
    main.position.set((a + b) / 2, fy + 1.1, BACK + 0.5);
    g.add(main);
    for (const x of [a - 0.1, b + 0.1]) {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12).rotateZ(Math.PI / 2), dark);
      flange.position.set(x, fy + 1.1, BACK + 0.5);
      g.add(flange);
    }
  }

  // the shaft down from a pit on the hill (src/gen/sewer.ts): the cross street dug up, timber shoring down the hole's
  // sides to the deep's roof, a ladder down it to the floor, a work lamp hung in it, barrels and DETOUR at its lip
  function shaftDig(s: Sewer, fy: number, top: number): void {
    const pit = pitAt(level, (s.drain[0] + s.drain[1]) / 2);
    if (!pit) return;
    const [a, b] = [X(s.drain[0]), X(s.drain[1])];
    const lip = Y(pit.floor);
    for (const x of [a + 0.08, b - 0.08]) for (let z = BACK - 0.8; z < FRONT - 0.4; z += 1.4) box(x - 0.08, x + 0.08, top, lip, z, z + 0.28, plank);
    for (let y = top + 0.6; y < lip - 0.3; y += 1.3) {
      const brace = box(a + 0.1, b - 0.1, y, y + 0.14, BACK - 0.7, BACK - 0.55, plank);
      brace.rotation.z = Math.round(y * 3) % 2 ? 0.22 : -0.22;
    }
    //a brick collar where it comes through the deep's roof
    box(a - 0.3, a, top - 0.3, top + 0.4, STREET_BACK, FRONT - 0.02, archBrick);
    box(b, b + 0.3, top - 0.3, top + 0.4, STREET_BACK, FRONT - 0.02, archBrick);
    const lx = a + 0.5;
    for (const dx of [-0.22, 0.22]) box(lx + dx - 0.04, lx + dx + 0.04, fy, lip + 0.6, BACK - 0.6, BACK - 0.5, yellow);
    for (let y = fy + 0.3; y < lip + 0.5; y += 0.35) box(lx - 0.22, lx + 0.22, y, y + 0.05, BACK - 0.58, BACK - 0.52, yellow);
    light(a + 0.2, b - 0.2, top, lip, 1.4);
    for (const x of [a - 0.7, b + 0.8]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.9, 12), barrel);
      bar.position.set(x, lip + 0.45, -2.2);
      g.add(bar);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.325, 0.1, 12), white);
      band.position.set(x, lip + 0.55, -2.2);
      g.add(band);
    }
    const detour = board('DETOUR ▼', 'sewer this way', '#ff7a1a', '#141018');
    detour.scale.setScalar(0.42);
    detour.position.set(a - 0.6, lip + 1.5, -2.3);
    g.add(detour);
  }

  // a construction spot on the street at a sewer's way in: cones, a striped barricade behind the hole, the trench plate
  // dragged aside, a dirt pile and a little excavator at the back of the street
  function construction(s: Sewer): void {
    const [a, b] = [X(s.drain[0]), X(s.drain[1])];
    for (const x of [a - 0.6, b + 0.6]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 10), cone);
      c.position.set(x, 0.275, 1.6);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.135, 0.08, 10), white);
      band.position.set(x, 0.3, 1.6);
      g.add(c, band);
    }
    //the barricade: two legs and a striped board
    for (const x of [a + 0.2, b - 0.2]) box(x - 0.05, x + 0.05, 0, 0.8, -1.95, -1.85, white);
    for (let x = a + 0.1; x < b - 0.1; x += 0.4) box(x, Math.min(b - 0.1, x + 0.2), 0.55, 0.78, -1.95, -1.9, x % 0.8 < 0.4 ? cone : white);
    //orange-and-white barrels and a run of orange mesh fence behind the dig, ROAD CLOSED and a DETOUR arrow on posts
    for (const x of [a - 1.4, b + 1.5]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.9, 12), barrel);
      bar.position.set(x, 0.45, 2.4);
      g.add(bar);
      for (const y of [0.3, 0.6]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.325, 0.1, 12), white);
        band.position.set(x, y, 2.4);
        g.add(band);
      }
      box(x - 0.42, x + 0.42, 0, 0.06, 2.0, 2.8, dark);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(b - a + 3, 0.9), fence);
    mesh.position.set((a + b) / 2, 0.45, -2.3);
    g.add(mesh);
    const closed = board('ROAD CLOSED', 'construction ahead', '#ffffff', '#141018');
    closed.scale.setScalar(0.42);
    closed.position.set(a - 0.4, 1.35, -2.0);
    const detour = board('DETOUR ▼', 'sewer this way', '#ff7a1a', '#141018');
    detour.scale.setScalar(0.42);
    detour.position.set(a - 0.4, 1.8, -2.0);
    g.add(closed, detour);
    box(a - 0.44, a - 0.36, 0, 1.6, -2.06, -2.02, dark);
    //the trench plate, dragged off the hole and leaning on the back curb
    const p = box(b + 0.4, b + 2.2, 0.02, 0.08, -2.9, -1.9, plate);
    p.rotation.z = 0.12;
    //the dirt dug out of the hole
    const pile = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.9, 8), dirt);
    pile.position.set(a - 1.6, 0.45, -2.7);
    pile.scale.z = 0.5;
    g.add(pile);
    //a little excavator: tracks, cab and arm reaching over the hole (behind the lane)
    const ex = b + 3;
    box(ex - 1, ex + 1, 0, 0.35, -3.3, -2.6, dark);
    box(ex - 0.8, ex + 0.6, 0.35, 1.3, -3.25, -2.65, yellow);
    box(ex - 0.6, ex + 0.2, 1.3, 1.8, -3.2, -2.7, yellow);
    const boom = box(ex - 2.2, ex - 0.4, 1.3, 1.5, -3.0, -2.8, yellow);
    boom.rotation.z = -0.5;
    const stick = box(ex - 2.9, ex - 2.3, 0.4, 1.0, -3.0, -2.8, yellow);
    stick.rotation.z = 0.3;
  }

  //pipes on brackets off the back wall (a concrete one's a cement ledge out of the wall, from zack's ledge ref)
  for (const r of level.rails) {
    if (!r.sewer) continue;
    if (r.material === 'concrete') {
      for (let k = 1; k < r.xs.length; k++) {
        const [a, b] = [X(r.xs[k - 1]), X(r.xs[k])];
        const [ya, yb] = [Y(r.ys[k - 1]), Y(r.ys[k])];
        wedge(a, ya, b, yb, Math.min(ya, yb) - 0.35, BACK, 0.45, pillar);
        wedge(a, ya + 0.02, b, yb + 0.02, Math.min(ya, yb) - 0.05, 0.35, 0.5, steel); // (a steel nose along its edge)
      }
      continue;
    }
    const pts = r.xs.map((px, i) => new THREE.Vector3(X(px), Y(r.ys[i]) - 0.12, 0));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.13, 8), pipeMat);
    g.add(tube);
    const y = Y(r.ys[0]) - 0.12;
    for (let x = X(r.x0) + 0.3; x < X(r.x1); x += 2) box(x - 0.06, x + 0.06, y - 0.05, y + 0.05, BACK, 0, bracket);
    //and its ends bend back into the wall
    for (const x of [X(r.x0), X(r.x1)]) box(x - 0.13, x + 0.13, y - 0.13, y + 0.13, BACK, 0, pipeMat);
  }
  return g;
}
