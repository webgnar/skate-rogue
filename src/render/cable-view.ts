// The cable cars up the later stretches of hill (src/gen/hills.ts buildClimb). One waits at the foot of each climb;
// when you roll onto the cable slot it takes you up, running just ahead of you in the next lane so it reads as the
// car towing you, and it stops at the top. A San Francisco car: maroon below, cream above, open ends with poles,
// a clerestory roof. The model is art/street.py's CableCar (from zack's photo of car 60), its colours baked into
// the vertices so it stays one draw plus its outline; the code-built car below is the fallback.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { surfaceY, type Level, type Surface } from '../physics/level';
import { TILE } from '../physics/constants';
import { inkify } from './toon';
import { toX, toY } from './kit';
import { flatGeometry } from './models';

export const CABLE = {
  len: 4.2, // tiles
  z: -1.15, // the next lane back from the skate lane
  lead: 1.4, // tiles its back runs ahead of you while it tows
};

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  g.translate(x, y, z);
  const c = new THREE.Color(color);
  const n = g.getAttribute('position').count;
  g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3));
  return g;
}

// the car, its floor's middle at the origin, its length along x
function cableCarGeometry(): THREE.BufferGeometry {
  const L = CABLE.len;
  const parts: THREE.BufferGeometry[] = [
    box(L, 0.55, 1.3, 0, 0.45, 0, 0x8a2a2a), // the maroon lower body
    box(L * 0.62, 0.7, 1.32, 0, 1.08, 0, 0xf0e2c0), // the cream saloon in the middle
    box(L * 0.6, 0.42, 1.34, 0, 1.12, 0, 0x2a3040), // its windows
    box(L + 0.1, 0.12, 1.4, 0, 1.52, 0, 0x5a3a2a), // the roof
    box(L * 0.55, 0.22, 0.9, 0, 1.69, 0, 0x5a3a2a), // the clerestory
    box(L, 0.08, 1.33, 0, 0.74, 0, 0xd8b048), // the gold stripe
    box(0.3, 0.18, 1.2, -L / 2 + 0.05, 0.1, 0, 0x2a2228), // the running boards' ends and the wheels' trucks
    box(0.3, 0.18, 1.2, L / 2 - 0.05, 0.1, 0, 0x2a2228),
  ];
  //the open ends: grab poles at the corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.06, 0.8, 0.06, sx * (L / 2 - 0.25), 1.1, sz * 0.6, 0xd8b048));
  const g = mergeGeometries(parts)!;
  for (const p of parts) p.dispose();
  return g;
}

export class CableView {
  readonly group = new THREE.Group();
  private cars: { s: Surface; mesh: THREE.Mesh; d: number }[] = [];

  set(level: Level): void {
    for (const c of this.cars) c.mesh.geometry.dispose();
    this.group.clear();
    this.cars = [];
    const geo = flatGeometry('CableCar') ?? cableCarGeometry();
    for (const s of level.surfaces) {
      if (!s.tow) continue;
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
      mesh.rotation.z = Math.atan2(toY(level, s.y1 ?? s.y) - toY(level, s.y), toX(s.x1 - s.x0));
      inkify(mesh);
      this.group.add(mesh);
      this.cars.push({ s, mesh, d: 0 });
    }
    this.sync(level, -Infinity);
  }

  // place each car: waiting at the foot, up the slot just ahead of the skater, or stopped at the top
  sync(level: Level, skaterX: number): void {
    for (const c of this.cars) {
      const { s } = c;
      const run = s.x1 - s.x0;
      const want = Math.max(0, Math.min(run - CABLE.len * TILE, skaterX - s.x0 + CABLE.lead * TILE));
      c.d = Math.max(c.d, want); // it never rolls back down
      const x = s.x0 + c.d + (CABLE.len * TILE) / 2;
      c.mesh.position.set(toX(x), toY(level, surfaceY(s, x)), CABLE.z);
    }
  }
}
