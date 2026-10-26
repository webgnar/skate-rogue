// Street props and smashables built in Blender (art/props.py): hydrants, benches, garbage carts, newspaper boxes,
// mailboxes, parking meters, sign poles, cones, bottles, cans, crates, barrels, boxes, planters, café signs, a
// food cart, the AI's kiosks, delivery bots and Flock camera poles. A floor's props merge into one mesh coloured per
// vertex, so they cost one draw call (two with outlines). Each prop keeps its vertex range in that mesh, so a smashed
// one can be hidden (hideProp) while the effects throw its break pieces (propPieces in models.ts).
//
// Where they go: the sim's level.props when it has them (smashables in the skate lane); otherwise scenery along the
// back of the sidewalk, picked here.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { flatGeometry } from './models';
import type { Level } from '../physics/level';
import { makeRng } from '../gen/rng';
import { TILE } from '../physics/constants';
import type { BiomeId } from './biomes';
import { worldAt } from './quarters';

export interface PropPlacement {
  name: string;
  x: number; // world units: middle of the prop along the street
  y: number; // the ground under it
  z: number;
  w: number; // half its width
  h: number; // its height
  breakable: boolean; // false: it rings and sparks instead (solid iron and steel)
  shown: string; // the model drawn: in a world's quarter of the city, that world's smashable (quarters.ts)
  start: number; // its vertices in the merged mesh
  count: number;
}

// what sim placements look like (px, y down, like the rest of Level); z in world units, default the skate lane
interface SimProp {
  name: string;
  x: number;
  y: number;
  z?: number;
}

const UNBREAKABLE = new Set(['Hydrant', 'Mailbox']);

// The other worlds' smashables (art/props.py): each Chicago smashable stands in as the world's small, medium or
// large one, about the same size, so the sim's hit boxes still fit. The AI's things stay what they are: it is
// everywhere. Scenery (hydrants, benches, meters...) is Chicago street furniture: other worlds show their own
// scenery as cards (kit.ts) instead.
const SIZE_OF: Record<string, 0 | 1 | 2> = {
  Bottle: 0, Can: 0,
  Cone: 1, Crate: 1, CardboardBox: 1, Planter: 1, SandwichBoard: 1,
  Barrel: 2, TrashCan: 2, NewsBoxRed: 2, NewsBoxBlue: 2, NewsBoxYellow: 2,
};
const SCENERY_NAMES = new Set(['Hydrant', 'Bench', 'Mailbox', 'Meter', 'SignPole']);
export const WORLD_PROPS: Partial<Record<BiomeId, [string, string, string]>> = {
  clemente: ['SodaCup', 'Pumpkin', 'HayBale'],
  greece: ['OilJug', 'Urn', 'Amphora'],
  atlantis: ['Shell', 'Coral', 'Chest'],
  museum: ['Mug', 'Vase', 'Bust'],
  hightech: ['Battery', 'HoloCube', 'ServerRack'],
  space: ['Crystal', 'FuelCell', 'CrystalCluster'],
  hive: ['Battery', 'HoloCube', 'ServerRack'],
};

// the model a placed prop shows in a world; null = nothing drawn (Chicago scenery elsewhere)
export function restyle(name: string, biome: BiomeId): string | null {
  const set = WORLD_PROPS[biome];
  if (!set) return name;
  if (SCENERY_NAMES.has(name)) return null;
  const size = SIZE_OF[name];
  return size === undefined ? name : set[size];
}

// scenery: name, how often it comes up, and how much sidewalk it takes (tiles)
const SCENERY: [string, number, number][] = [
  ['Hydrant', 3, 0.5],
  ['Bench', 2, 2.1],
  ['TrashCan', 3, 0.8],
  ['News', 2, 2.0], // a row of newspaper boxes
  ['Mailbox', 1, 0.7],
  ['Meter', 2, 0.4],
  ['SignPole', 1, 1.1],
  ['Cone', 1, 0.5],
  ['Planter', 2, 1.0],
  ['SandwichBoard', 1, 0.7],
  ['Crate', 1, 0.7],
  ['FlockPole', 1, 0.5],
];
const NEWS = ['NewsBoxRed', 'NewsBoxBlue', 'NewsBoxYellow'];
const Z = -3.2; // back of the sidewalk: clear of the street lamps (z -2.9) and most of the back traffic lane
const GAP: [number, number] = [3, 7]; // tiles between scenery props

// half-width and height of a prop, from its model (world units)
export function propSize(name: string): { w: number; h: number } {
  const g = flatGeometry(name);
  if (!g) return { w: 0.3, h: 0.5 };
  if (!g.boundingBox) g.computeBoundingBox();
  const b = g.boundingBox!;
  return { w: Math.max(-b.min.x, b.max.x), h: b.max.y };
}

// the current floor's props, for the effects
export interface FloorProps {
  mesh: THREE.Mesh | null;
  placements: PropPlacement[];
  biome: BiomeId;
}

// the last floor built. Floors ahead are built before you reach them, so this is usually NOT the floor you're on:
// look a floor's own props up with propsFor(level)
export const props: FloorProps = { mesh: null, placements: [], biome: 'chicago' };
const byLevel = new WeakMap<Level, FloorProps>();

// a floor's props, as buildProps made them for it
export function propsFor(level: Level): FloorProps {
  return byLevel.get(level) ?? { mesh: null, placements: [], biome: 'chicago' };
}

// hide a smashed prop on its floor: its vertices drop far below the street (its outline shares them, so it goes too)
export function hideProp(level: Level, i: number): void {
  const f = propsFor(level);
  const p = f.placements[i];
  const pos = f.mesh?.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
  if (!p || !pos) return;
  for (let v = p.start; v < p.start + p.count; v++) pos.setY(v, -100);
  pos.needsUpdate = true;
  f.mesh!.geometry.computeBoundingSphere();
}

function scenery(level: Level): { name: string; x: number; y: number; z: number }[] {
  const rng = makeRng(level.layout.seed * 53 + level.layout.floor * 7);
  const total = SCENERY.reduce((a, k) => a + k[1], 0);
  const pick = () => {
    let r = rng() * total;
    for (const k of SCENERY) if ((r -= k[1]) < 0) return k;
    return SCENERY[0];
  };
  const street = (x0: number, x1: number) => {
    for (let c = Math.floor(x0); c <= Math.floor(x1); c++) if (!level.street[c]) return false;
    return true;
  };
  const out: { name: string; x: number; y: number; z: number }[] = [];
  let x = Math.round(level.finaleX / TILE) + 2 + rng() * GAP[1];
  while (x < level.street.length - 2) {
    const [name, , width] = pick();
    if (street(x - width / 2 - 0.5, x + width / 2 + 0.5)) {
      if (name === 'News') {
        const n = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) out.push({ name: NEWS[Math.floor(rng() * NEWS.length)], x: x + (i - (n - 1) / 2) * 0.66, y: 0, z: Z });
      } else {
        out.push({ name, x, y: 0, z: Z });
      }
    }
    x += width / 2 + GAP[0] + rng() * (GAP[1] - GAP[0]);
  }
  return out;
}

export function buildProps(level: Level, biome: BiomeId = 'chicago'): THREE.Mesh | null {
  props.mesh = null;
  props.placements = [];
  props.biome = biome;
  byLevel.set(level, { mesh: null, placements: props.placements, biome });
  const sim = (level as Level & { props?: SimProp[] }).props;
  const spots = sim
    ? sim.map((p) => ({ name: p.name, x: p.x / TILE, y: (level.streetY - p.y) / TILE, z: p.z ?? 0 }))
    : scenery(level);
  const geos: THREE.BufferGeometry[] = [];
  const m = new THREE.Matrix4();
  let start = 0;
  for (const s of spots) {
    //the one city: a smashable in a world's quarter is that world's; scenery stays Chicago street furniture
    const shown = biome === 'chicago' ? (SCENERY_NAMES.has(s.name) ? s.name : restyle(s.name, worldAt(level, s.x))) : restyle(s.name, biome);
    const g = shown ? flatGeometry(shown) : null;
    const size = propSize(shown ?? s.name);
    const count = g ? g.getAttribute('position').count : 0;
    props.placements.push({ ...s, ...size, breakable: !UNBREAKABLE.has(s.name), shown: shown ?? s.name, start, count });
    if (!g) continue; // unknown name: it keeps its index, with nothing to draw
    // cones and carts sit a little skew; everything else square to the street
    const yaw = s.name === 'Cone' || s.name === 'TrashCan' ? Math.sin(s.x * 12.9898) * 0.4 : 0;
    m.makeRotationY(yaw).setPosition(s.x, s.y, s.z);
    geos.push(g.clone().applyMatrix4(m));
    start += count;
  }
  if (!geos.length) return null;
  const merged = mergeGeometries(geos);
  for (const g of geos) g.dispose();
  if (!merged) return null;
  const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'props';
  mesh.userData.keep = true; // its own mesh: batchStatic must not merge it away (hideProp needs the vertex ranges)
  props.mesh = mesh;
  byLevel.get(level)!.mesh = mesh;
  return mesh;
}
