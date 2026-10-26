// Street props (GDD: Smashables, pillar 7 "smash everything"). The sim places every prop on a floor, so one list
// drives the physics, the models thread's merged prop mesh (src/render/props.ts) and the effects thread's breaks:
// a smash event's index is the prop's index here. Scenery stands along the back of the sidewalk and never breaks;
// smashables stand in the skate lane, on the street and on ledges and roofs, and break when you skate through
// them. They are juice, never hazards: nothing here slows or slams you. Placement comes from the floor's seed.
import { TILE } from '../physics/constants';
import { isStreetAt, type Level } from '../physics/level';
import { makeRng, type Rng } from './rng';
import { CROSS } from '../traffic/cross';
import { DOOR } from '../traffic/street';

export interface Prop {
  name: string; // the Blender part in props.glb (art/props.py)
  x: number; // px, the middle of its base
  y: number; // px, its base (y-down, like the skater's feet)
  z: number; // tiles: 0 is the skate lane, negative is further back
  yaw: number;
  breaks: boolean; // a smashable in the lane; scenery doesn't
  loot?: 'cash' | 'stoken'; // hidden inside: a few coins, or a floor's one golden prop's Stoken
  ai?: boolean; // the AI's stuff: smashing it cools Heat a little
}

// the hit box: half-width and height in px
export const PROP_SIZE: Record<string, { w: number; h: number }> = {
  //smashables
  Bottle: { w: 4, h: 12 },
  Can: { w: 4, h: 8 },
  Cone: { w: 8, h: 22 },
  Barrel: { w: 12, h: 30 },
  Crate: { w: 13, h: 26 },
  CardboardBox: { w: 12, h: 20 },
  TrashCan: { w: 12, h: 30 },
  NewsBoxRed: { w: 10, h: 34 },
  NewsBoxBlue: { w: 10, h: 34 },
  NewsBoxYellow: { w: 10, h: 34 },
  Planter: { w: 13, h: 22 },
  SandwichBoard: { w: 10, h: 24 },
  AIKiosk: { w: 13, h: 46 },
  DeliveryBot: { w: 12, h: 22 },
  FlockPole: { w: 6, h: 90 },
  //scenery
  Hydrant: { w: 8, h: 24 },
  Bench: { w: 34, h: 26 },
  Mailbox: { w: 11, h: 36 },
  Meter: { w: 6, h: 40 },
  SignPole: { w: 18, h: 70 },
};

const STREET: [string, number][] = [
  ['Cone', 4], ['Barrel', 2], ['Crate', 2], ['CardboardBox', 3], ['TrashCan', 3], ['NewsBox', 2],
  ['SandwichBoard', 2], ['DeliveryBot', 1], ['AIKiosk', 1], ['FlockPole', 1],
];
const LEDGE: [string, number][] = [['Bottle', 4], ['Can', 3], ['Planter', 2], ['CardboardBox', 2]];
const SCENERY: [string, number][] = [['Hydrant', 3], ['Bench', 2], ['TrashCan', 2], ['Mailbox', 1], ['Meter', 2], ['SignPole', 1]];
const NEWS = ['NewsBoxRed', 'NewsBoxBlue', 'NewsBoxYellow'];
const AI = new Set(['AIKiosk', 'DeliveryBot', 'FlockPole']);
const LOOT = new Set(['Crate', 'NewsBoxRed', 'NewsBoxBlue', 'NewsBoxYellow', 'TrashCan']);

export const PROPS = {
  sceneryZ: -3.2, // back of the sidewalk, clear of the street lamps
  laneZ: [-0.3, 0.4] as [number, number], // smashables stand in the skate lane (clear of the back lane)
  streetGap: [4, 9] as [number, number], // tiles between street smashables
  sceneryGap: [3, 7] as [number, number],
  ledgeMin: 3 * TILE, // ledges and roofs this long get a prop or two
  lootChance: 0.35,
};

function pick(rng: Rng, table: [string, number][]): string {
  const total = table.reduce((a, k) => a + k[1], 0);
  let r = rng() * total;
  for (const [name, n] of table) if ((r -= n) < 0) return name;
  return table[0][0];
}

export function placeProps(level: Level): Prop[] {
  const rng = makeRng(level.layout.seed * 53 + level.layout.floor * 7);
  const props: Prop[] = [];
  const clear = (x0: number, x1: number) => {
    for (let x = x0; x <= x1; x += TILE / 2) if (!isStreetAt(level, x)) return false;
    if (level.cars.some((c) => c.x1 > x0 - TILE && c.x0 < x1 + TILE)) return false;
    //not in a cross street
    if (level.crossings.some((i) => i.x + CROSS.w / 2 + CROSS.street * TILE > x0 && i.x + CROSS.w / 2 - CROSS.street * TILE < x1)) return false;
    //nor where a car door flies open: it has to read
    if ((level.doors ?? []).some((d) => d + DOOR.hinge + TILE > x0 && d + DOOR.hinge - DOOR.reach - 2 * TILE < x1)) return false;
    return !level.glass.some((g) => g.x1 > x0 && g.x0 < x1);
  };
  const add = (name: string, x: number, y: number, z: number, breaks: boolean) => {
    const real = name === 'NewsBox' ? NEWS[Math.floor(rng() * NEWS.length)] : name;
    const p: Prop = { name: real, x, y, z, yaw: real === 'Cone' || real === 'CardboardBox' ? (rng() - 0.5) * 1.2 : 0, breaks };
    if (breaks && AI.has(real)) p.ai = true;
    if (breaks && LOOT.has(real) && rng() < PROPS.lootChance) p.loot = 'cash';
    props.push(p);
  };
  const lane = () => PROPS.laneZ[0] + rng() * (PROPS.laneZ[1] - PROPS.laneZ[0]);
  const gap = ([a, b]: [number, number]) => (a + rng() * (b - a)) * TILE;

  //scenery along the back of the sidewalk
  for (let x = level.finaleX + 2 * TILE + gap(PROPS.sceneryGap); x < level.exitX - 2 * TILE; x += gap(PROPS.sceneryGap)) {
    const name = pick(rng, SCENERY);
    const w = PROP_SIZE[name].w;
    if (clear(x - w, x + w)) add(name, x, level.streetY, PROPS.sceneryZ, false);
  }
  //smashables in the lane on the street, kept off the gate
  for (let x = level.startX + 6 * TILE + gap(PROPS.streetGap); x < level.exitX - 4 * TILE; x += gap(PROPS.streetGap)) {
    const name = pick(rng, STREET);
    const w = PROP_SIZE[name === 'NewsBox' ? NEWS[0] : name].w;
    if (clear(x - w - TILE / 2, x + w + TILE / 2)) add(name, x, level.streetY, lane(), true);
  }
  //bottles, cans and planters on ledges and roofs, away from their ends
  for (const s of level.surfaces) {
    if ((s.kind !== 'ledge' && s.kind !== 'roof') || s.side || s.y1 !== undefined || s.x1 - s.x0 < PROPS.ledgeMin) continue;
    if (s.x0 < level.startX + 4 * TILE) continue;
    const n = 1 + (s.x1 - s.x0 > 8 * TILE ? Math.floor(rng() * 3) : Math.floor(rng() * 2));
    for (let i = 0; i < n; i++) {
      const x = s.x0 + TILE + rng() * (s.x1 - s.x0 - 2 * TILE);
      add(pick(rng, LEDGE), x, s.y, lane(), true);
    }
  }
  //one golden prop a floor holds a Stoken
  const smash = props.filter((p) => p.breaks);
  if (smash.length) smash[Math.floor(rng() * smash.length)].loot = 'stoken';
  return props;
}
