// What a smashable prop is made of, from its name: the effects pick its chips and dust by it (src/render/smash.ts),
// and the sim wears your bearings with the dust and shards (zack, 2026-10-30).
export type Stuff = 'glass' | 'metal' | 'wood' | 'plastic' | 'stone' | 'paper';

// what a prop is made of, from its name
const STUFF: [RegExp, Stuff][] = [
  //the other worlds' smashables (props.ts WORLD_PROPS): pottery and marble chip like stone, crystal like glass
  [/crystal/i, 'glass'],
  [/jug|urn|amphora|vase|mug|bust|shell|coral/i, 'stone'],
  [/chest|haybale/i, 'wood'],
  [/battery|holocube|serverrack|fuelcell/i, 'metal'],
  [/cardboard/i, 'paper'], // before wood's 'board'
  [/bottle|window|glass|lamp/i, 'glass'],
  [/hydrant|newsbox|mailbox|meter|sign|pole|can|rail/i, 'metal'],
  [/crate|bench|pallet|board|sandwich/i, 'wood'],
  [/cone|bin|barrel|cooler/i, 'plastic'],
  [/planter|pot|brick|statue|column|bust/i, 'stone'],
  [/paper|box|news|poster/i, 'paper'],
];

export function stuffOf(prop: string): Stuff {
  return STUFF.find(([re]) => re.test(prop))?.[1] ?? 'plastic';
}

// a smash that throws dust or glass shards into your bearings
export function gritty(prop: string): boolean {
  const s = stuffOf(prop);
  return s === 'wood' || s === 'stone' || s === 'glass';
}
