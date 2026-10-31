// The sewer route (src/gen/sewer.ts), drawn as a cutaway under the street: the street is a thin roof (kit.ts), and
// under it a brick storm tunnel with a concrete floor, a trickle of runoff along the back and pools of it on the
// floor, rusty pipes on brackets off the back wall, caged work lamps, and the outlet ramp up to the street. The open
// drain and the outlet's hole get hazard paint on the street round them, and the drain's manhole cover lies tipped
// against the back wall beside it. Light falls in through both holes. Plain shared materials, so the floor's batching
// (batch.ts) merges them into a few draws.
import * as THREE from 'three';
import { TILE } from '../physics/constants';
import { SEWER_ROOF, type Level } from '../physics/level';
import { SEWER } from '../gen/sewer';
import { surface } from './surfaces';

const BACK = -2.6; // the tunnel's back wall (the skater rolls at z 0)
const FRONT = 4; // the near sidewalk's front (hillside.ts HILLSIDE.nearWalk)
const STREET_BACK = -3.5;
const ROCK = -9; // how deep the ground under the tunnel is drawn

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
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const cage = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const hazard = new THREE.MeshBasicMaterial({ color: 0xf2c230 });
  const stripe = new THREE.MeshBasicMaterial({ color: 0x1a1414 });
  const cover = new THREE.MeshLambertMaterial({ color: 0x3e3a36 });
  const shaft = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.12, depthWrite: false });
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    g.add(b);
    return b;
  };

  for (const s of level.sewers) {
    const x0 = X(s.x0);
    const x1 = X(s.x1);
    const fy = Y(s.y);
    const ramp = x1 - SEWER.ramp;
    //the ground: under the tunnel, and either side of it under the street's usual 3 tiles
    box(x0 - 0.5, x1 + 0.5, ROCK, fy - 0.3, STREET_BACK, FRONT, ground);
    box(x0 - 6, x0 - 0.5, ROCK, -3, STREET_BACK, FRONT, ground);
    box(x1 + 0.5, x1 + 6, ROCK, -3, STREET_BACK, FRONT, ground);
    //the tunnel's ends and back wall
    box(x0 - 0.5, x0, fy - 0.3, roof, STREET_BACK, FRONT, brick);
    box(x1, x1 + 0.5, fy - 0.3, roof, STREET_BACK, FRONT, brick);
    box(x0, x1, fy, roof, STREET_BACK, BACK, brick);
    //the floor, and the outlet ramp up to the street as a solid wedge
    box(x0, ramp, fy - 0.3, fy, BACK, FRONT, floor);
    const tri = new THREE.Shape([new THREE.Vector2(ramp, fy - 0.3), new THREE.Vector2(x1, fy - 0.3), new THREE.Vector2(x1, 0), new THREE.Vector2(ramp, fy)]);
    const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: FRONT - BACK, bevelEnabled: false }), floor);
    wedge.position.z = BACK;
    g.add(wedge);
    //runoff: a trickle along the back, and pools of it across the floor
    box(x0, ramp, fy - 0.02, fy + 0.03, BACK, BACK + 0.5, water);
    for (const [w0, w1] of s.wet) box(X(w0), X(w1), fy - 0.02, fy + 0.04, BACK, FRONT - 0.6, water);
    //caged work lamps along the back wall
    for (let x = x0 + 2.5; x < ramp - 1; x += 6) {
      box(x - 0.18, x + 0.18, roof - 0.7, roof - 0.4, BACK, BACK + 0.12, cage);
      box(x - 0.12, x + 0.12, roof - 0.66, roof - 0.44, BACK + 0.12, BACK + 0.2, lamp);
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
    //the drain's manhole cover, tipped up against the back curb beside it
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16), cover);
    lid.rotation.x = Math.PI / 2;
    lid.rotation.y = 0.25;
    lid.position.set(X(s.drain[0]) - 0.7, 0.48, -2.1);
    g.add(lid);
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
