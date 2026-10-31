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
import { SEWER_ROOF, type Level, type Sewer } from '../physics/level';
import { SEWER } from '../gen/sewer';
import { makeRng } from '../gen/rng';
import { surface } from './surfaces';

const BACK = -2.6; // the tunnel's back wall (the skater rolls at z 0)
const FRONT = 4; // the near sidewalk's front (hillside.ts HILLSIDE.nearWalk)
const STREET_BACK = -3.5;
const ROCK = -9; // how deep the ground under the tunnel is drawn
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
  const water = new THREE.MeshLambertMaterial({ color: 0x4a8a7a, emissive: 0x10302a, transparent: true, opacity: 0.85 });
  const chevron = new THREE.MeshBasicMaterial({ color: 0xbff5e6, transparent: true, opacity: 0.55, depthWrite: false });
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const cage = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const hazard = new THREE.MeshBasicMaterial({ color: 0xf2c230 });
  const stripe = new THREE.MeshBasicMaterial({ color: 0x1a1414 });
  const shaft = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.12, depthWrite: false });
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
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    g.add(b);
    return b;
  };
  // a solid wedge under a slope from (a, ya) to (b, yb), down to `base`, across z0..z1
  const wedge = (a: number, ya: number, b: number, yb: number, base: number, z0: number, z1: number, m: THREE.Material) => {
    const shape = new THREE.Shape([new THREE.Vector2(a, base), new THREE.Vector2(b, base), new THREE.Vector2(b, yb), new THREE.Vector2(a, ya)]);
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false }), m);
    mesh.position.z = z0;
    g.add(mesh);
    return mesh;
  };

  level.sewers.forEach((s, i) => {
    const rng = makeRng(level.layout.seed * 31 + i * 977 + 7);
    const x0 = X(s.x0);
    const x1 = X(s.x1);
    const fy = Y(s.y);
    const ramp = x1 - SEWER.ramp;
    const p = s.piece;
    const bowl = p?.kind === 'bowl' ? p : null;
    const sub = p?.kind === 'subway' ? p : null;
    const deep = bowl ? fy - bowl.depth / TILE : fy;
    //the ground: under the tunnel (split round the subway's gap), and either side of it under the street's usual 3 tiles
    const gaps: [number, number][] = sub ? [[X(sub.x0), X(sub.x1)]] : [];
    let gx = x0 - 0.5;
    for (const [a, b] of gaps) {
      box(gx, a, ROCK, deep - 0.3, STREET_BACK, FRONT, ground);
      gx = b;
    }
    box(gx, x1 + 0.5, ROCK, deep - 0.3, STREET_BACK, FRONT, ground);
    box(x0 - 6, x0 - 0.5, ROCK, -3, STREET_BACK, FRONT, ground);
    box(x1 + 0.5, x1 + 6, ROCK, -3, STREET_BACK, FRONT, ground);
    //the tunnel's ends and back wall
    box(x0 - 0.5, x0, deep - 0.3, roof, STREET_BACK, FRONT, brick);
    box(x1, x1 + 0.5, fy - 0.3, roof, STREET_BACK, FRONT, brick);
    box(x0, x1, deep, roof, STREET_BACK, BACK, brick);
    //the floor, as the physics has it: flat runs as slabs, slopes (the bowl's sides, kick-outs, ramps) as wedges
    for (const f of level.surfaces) {
      if (!f.sewer || f.x0 < s.x0 - 1 || f.x1 > s.x1 + 1) continue;
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
        wedge(a, ya, b, yb, Math.min(ya, yb, fy) - 0.3, BACK, FRONT, f.x1 === s.x1 ? floor : tile);
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
    const archR = Math.min(1.5, (roof - fy) * 0.42);
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
      box(x - 0.08, x + 0.08, fy, roof, BACK, BACK + 0.1, iron);
      box(x - 0.14, x + 0.14, roof - 0.18, roof, BACK, 0.6, iron);
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
      box(x - 0.18, x + 0.18, roof - 0.7, roof - 0.4, BACK, BACK + 0.12, cage);
      box(x - 0.12, x + 0.12, roof - 0.66, roof - 0.44, BACK + 0.12, BACK + 0.2, lamp);
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
      const [a, b] = [X(h0), X(h1)];
      box(a + 0.1, b - 0.1, fy, roof, -0.6, 0.6, shaft);
      for (const [p0, p1] of [[a - 0.35, a], [b, b + 0.35]]) {
        box(p0, p1, 0, 0.02, STREET_BACK + 1.2, FRONT, hazard);
        for (let z = STREET_BACK + 1.4; z < FRONT - 0.2; z += 0.6) box(p0, p1, 0.02, 0.03, z, z + 0.25, stripe);
      }
    }
    construction(s);
    //kick-outs' grates: a frame in the street with bars across, light falling through
    for (const k of s.kicks ?? []) {
      const [a, b] = [X(k.grate[0]), X(k.grate[1])];
      box(a, a + 0.12, roof, 0.01, STREET_BACK + 1, FRONT, dark);
      box(b - 0.12, b, roof, 0.01, STREET_BACK + 1, FRONT, dark);
      for (let x = a + 0.3; x < b - 0.2; x += 0.32) box(x - 0.04, x + 0.04, -0.06, 0.01, STREET_BACK + 1, FRONT, dark);
      for (const z of [STREET_BACK + 1, -0.5, 1.5, FRONT - 0.1]) box(a, b, -0.08, 0.01, z - 0.05, z + 0.05, dark);
      box(a + 0.2, b - 0.2, fy, roof, -0.8, 0.8, shaft);
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
      sign.position.set(a - 0.8, roof - 1.2, BACK + 0.05);
      g.add(sign);
    }
    //the subway crossing: the gap onto the tracks, the line running off into the city, a third rail and a signal
    if (sub) {
      const [a, b] = [X(sub.x0), X(sub.x1)];
      const bed = fy - 3.2;
      box(a, b, ROCK, bed, SUBWAY_BACK, FRONT, ground);
      box(a - 0.3, a, bed, fy - 0.3, SUBWAY_BACK, BACK, brick);
      box(b, b + 0.3, bed, fy - 0.3, SUBWAY_BACK, BACK, brick);
      box(a, b, fy + 0.5, roof, SUBWAY_BACK, BACK - 0.01, dark); // the line's tunnel mouth over the gap, back into the dark
      for (const x of [a + (b - a) * 0.3, a + (b - a) * 0.7]) box(x - 0.05, x + 0.05, bed, bed + 0.12, SUBWAY_BACK, FRONT, rail);
      box(a + (b - a) * 0.88 - 0.06, a + (b - a) * 0.88 + 0.06, bed, bed + 0.18, SUBWAY_BACK, FRONT, yellow);
      box(b + 0.35, b + 0.5, fy, fy + 1.4, BACK + 0.2, BACK + 0.35, dark);
      const sign = board('MIND THE GAP', 'trains cross here', '#7a1e1e', '#ffffff');
      sign.scale.setScalar(0.55);
      sign.position.set(a - 1, roof - 1.1, BACK + 0.05);
      g.add(sign);
    }
    //the surge's storm gate, at the tunnel's start: a ribbed steel gate in the end wall, hazard bars on it
    if (p?.kind === 'surge') {
      box(x0, x0 + 0.25, fy, roof - 0.3, BACK, FRONT - 0.8, steel);
      for (let y = fy + 0.4; y < roof - 0.5; y += 0.6) box(x0 + 0.25, x0 + 0.32, y, y + 0.12, BACK, FRONT - 0.8, dark);
      const sign = board('FLOOD GATE', 'keep moving', '#3a3a10', '#f2c230');
      sign.scale.setScalar(0.55);
      sign.position.set(x0 + 2, roof - 1.1, BACK + 0.05);
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

  //pipes on brackets off the back wall
  for (const r of level.rails) {
    if (!r.sewer) continue;
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
