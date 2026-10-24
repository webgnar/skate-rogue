// Street props built in Blender (art/props.py): hydrants, benches, garbage carts, newspaper boxes, mailboxes,
// parking meters, sign poles and the odd cone, along the back of the sidewalk. Scenery only: nothing collides.
// A floor's props merge into one mesh coloured per vertex, so they cost one draw call (two with outlines).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flatGeometry } from './models';
import type { Level } from '../physics/level';
import { makeRng } from '../gen/rng';
import { TILE } from '../physics/constants';

// name, how often it comes up, and how much sidewalk it takes (tiles)
const KINDS: [string, number, number][] = [
  ['Hydrant', 3, 0.5],
  ['Bench', 2, 2.1],
  ['TrashCan', 3, 0.8],
  ['News', 2, 2.0], // a row of newspaper boxes
  ['Mailbox', 1, 0.7],
  ['Meter', 2, 0.4],
  ['SignPole', 1, 1.1],
  ['Cone', 1, 0.5],
];
const NEWS = ['NewsBoxRed', 'NewsBoxBlue', 'NewsBoxYellow'];
const Z = -3.2; // back of the sidewalk: clear of the street lamps (z -2.9) and most of the back traffic lane
const GAP: [number, number] = [3, 7]; // tiles between props

export function buildProps(level: Level): THREE.Mesh | null {
  const rng = makeRng(level.layout.seed * 53 + level.layout.floor * 7);
  const total = KINDS.reduce((a, k) => a + k[1], 0);
  const pick = () => {
    let r = rng() * total;
    for (const k of KINDS) if ((r -= k[1]) < 0) return k;
    return KINDS[0];
  };
  const street = (x0: number, x1: number) => {
    for (let c = Math.floor(x0); c <= Math.floor(x1); c++) if (!level.street[c]) return false;
    return true;
  };
  const geos: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  const place = (name: string, x: number, z: number, yaw = 0) => {
    const g = flatGeometry(name);
    if (!g) return;
    m.makeRotationY(yaw).setPosition(x, 0, z);
    geos.push(g.clone().applyMatrix4(m));
  };
  let x = Math.round(level.finaleX / TILE) + 2 + rng() * GAP[1];
  while (x < level.street.length - 2) {
    const [name, , width] = pick();
    if (street(x - width / 2 - 0.5, x + width / 2 + 0.5)) {
      if (name === 'News') {
        const n = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) place(NEWS[Math.floor(rng() * NEWS.length)], x + (i - (n - 1) / 2) * 0.66, Z);
      } else {
        place(name, x, Z, name === 'Cone' ? (rng() - 0.5) * 1.2 : name === 'TrashCan' ? (rng() - 0.5) * 0.3 : 0);
      }
    }
    x += width / 2 + GAP[0] + rng() * (GAP[1] - GAP[0]);
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'props';
  return mesh;
}
