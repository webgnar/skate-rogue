// Grip tape colours (zack, 2026-10-30: "grip color could be bought at the shop... selling one color at a time
// throughout the world"). The grip faces the camera, so a bright one is what makes the board read on a phone. You
// start on classic black; each shop visit sells one other colour, and a bought colour stays on the board for later runs.
// Pure: the save keeps the id, the rig paints it.
import { makeRng, randInt } from '../gen/rng';

export type GripId = 'cyan' | 'yellow' | 'pink' | 'lime' | 'orange' | 'purple' | 'red' | 'white' | 'black' | 'gold' | 'camo' | 'navy' | 'teal' | 'chrome';

export interface GripDef {
  id: GripId;
  name: string;
  color: number;
}

export const GRIPS: GripDef[] = [
  { id: 'cyan', name: 'Cyan', color: 0x00e5ff },
  { id: 'yellow', name: 'Yellow', color: 0xffd400 },
  { id: 'pink', name: 'Hot Pink', color: 0xff2d87 },
  { id: 'lime', name: 'Lime', color: 0x7dff3a },
  { id: 'orange', name: 'Orange', color: 0xff7a1a },
  { id: 'purple', name: 'Purple', color: 0xb14dff },
  { id: 'red', name: 'Red', color: 0xff3030 },
  { id: 'white', name: 'White', color: 0xf4f4f4 },
  { id: 'black', name: 'Classic Black', color: 0x1c1c20 },
];

// colours the shop never sells: a Skater Rank gives them (src/run/missions.ts rankGrip)
export const RANK_GRIPS: GripDef[] = [
  { id: 'gold', name: 'Gold', color: 0xd9a21b },
  { id: 'camo', name: 'Camo', color: 0x5b6b2f },
  { id: 'navy', name: 'Navy', color: 0x2a3a86 },
  { id: 'teal', name: 'Teal', color: 0x00a497 },
  { id: 'chrome', name: 'Chrome', color: 0xc4ced8 },
];

export const GRIP = {
  start: 'black' as GripId, // zack (2026-10-30): start on black grip, buy the colours
  price: 15,
};

export function isGrip(v: unknown): v is GripId {
  return GRIPS.some((g) => g.id === v) || RANK_GRIPS.some((g) => g.id === v);
}

export function gripDef(id: GripId): GripDef {
  return (GRIPS.find((g) => g.id === id) ?? RANK_GRIPS.find((g) => g.id === id))!;
}

// the one colour a shop visit sells: rolled from the run seed and the visit, never the one already on the board
export function gripFor(seed: number, visit: number, current: GripId): GripId {
  const rng = makeRng(seed * 15485863 + visit * 32452843);
  const others = GRIPS.filter((g) => g.id !== current);
  return others[randInt(rng, others.length)].id;
}
