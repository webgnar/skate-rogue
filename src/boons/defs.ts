// The boon pool: POP and GRIND (the first playable set), then FLOW, COOL, LUCK and STREET. Card fields follow QFS
// survivor_boons (type label, name, effect line, optional small line, max stacks, when filter).
export type BoonType = 'POP' | 'GRIND' | 'FLOW' | 'COOL' | 'LUCK' | 'STREET';

export type BoonId =
  | 'tripleThreat' | 'bigPop' | 'pressureFlip' | 'strongLegs'
  | 'railMagnet' | 'grease' | 'railLaunch' | 'ghostRail'
  | 'newWheels' | 'bombHill' | 'butter' | 'slingshot' | 'firecracker'
  | 'lowProfile' | 'bubblePads'
  | 'stokenMagnet' | 'doubleStoken' | 'hustler'
  | 'roofRider'
  | 'moonShoes' | 'wanted' | 'speedWobbles'
  | 'rocketGrind' | 'skyLine' | 'perpetualMotion'
  | 'ceramicBearings' | 'fiberglassCore' | 'classifiedUrethane';

export interface Held {
  id: BoonId;
  stacks: number;
}

export interface RunView {
  floor: number;
  boons: Held[];
  library?: { types: BoonType[]; curses: boolean; duos: boolean }; // what the meta tree has unlocked; all when left out
}

export interface Boon {
  id: BoonId;
  type: BoonType;
  name: string;
  effect: string;
  note?: string;
  max: number;
  when?: (run: RunView) => boolean;
  cursed?: boolean; // a strong effect with a cost (GDD: Curses), offered from floor 6
  duo?: [BoonId, BoonId]; // fuses two held boons (GDD: Combos)
  gear?: boolean; // a gear boon (a part wears slower): in every library, whatever types the meta tree has opened
}

export const CURSE_COLOR = '#b98cff';
export const DUO_COLOR = '#ff7ad9';
export const CURSES_FROM = 6;

// the colour a card wears: purple for a curse, pink for a duo, else its type's
export function boonColor(b: Boon): string {
  return b.cursed ? CURSE_COLOR : b.duo ? DUO_COLOR : BOON_COLORS[b.type];
}

export const BOON_COLORS: Record<BoonType, string> = { POP: '#ffd23f', GRIND: '#ff8c2b', FLOW: '#3ee0f0', COOL: '#5a8cff', LUCK: '#5fe08a', STREET: '#ff4a5a' };

export const BOONS: Boon[] = [
  { id: 'tripleThreat', type: 'POP', name: 'Triple Threat', effect: '+1 jump', max: 1 },
  { id: 'bigPop', type: 'POP', name: 'Big Pop', effect: 'Ollie 20% higher', max: 3 },
  { id: 'pressureFlip', type: 'POP', name: 'Mad Pop', effect: 'Keep holding after an ollie to float', note: '30% less gravity after 0.15 s', max: 1 }, // id kept from its old name, Pressure Flip
  {
    id: 'strongLegs', type: 'POP', name: 'Strong Legs', effect: 'Tap twice as you land to ollie straight out of it',
    note: 'no waiting for your knees', max: 1,
  },
  { id: 'railMagnet', type: 'GRIND', name: 'Rail Magnet', effect: 'Rails catch you from further away', note: '+48 px', max: 2 },
  { id: 'grease', type: 'GRIND', name: 'Ledge Butter', effect: 'Grind 25% faster', note: 'and hit full grind speed instantly', max: 2 }, // id kept from its old name, Grease
  { id: 'railLaunch', type: 'GRIND', name: 'Full Sail', effect: 'Ollies off rails pop higher the faster you grind', max: 1 }, // id kept from its old name, Rail Launch
  {
    id: 'ghostRail', type: 'GRIND', name: 'Ghost Rail', effect: 'Rails keep going 4 tiles past their end',
    note: 'for 2 s after you leave', max: 1,
  },
  { id: 'newWheels', type: 'FLOW', name: 'New Wheels', effect: 'Cruise 20% faster', note: 'and score 20% more', max: 2 },
  { id: 'bombHill', type: 'FLOW', name: 'Bomb Hill', effect: 'Extra speed bleeds off half as fast', max: 1 },
  { id: 'butter', type: 'FLOW', name: 'Butter', effect: 'Land on flat ground with all your air speed', max: 1 },
  {
    id: 'firecracker', type: 'FLOW', name: 'Firecracker', effect: 'Roll into a stair set and you firecracker down it',
    note: 'no slam; ollie out any time', max: 1,
  },
  { id: 'slingshot', type: 'FLOW', name: 'Slingshot', effect: 'Riding off the end of a rail launches you 50% harder', max: 2 },
  { id: 'lowProfile', type: 'COOL', name: 'Low Profile', effect: 'Heat rises 25% slower', max: 3 },
  { id: 'bubblePads', type: 'COOL', name: 'Bubble Pads', effect: 'Your first slam each floor costs nothing', note: 'no speed, no Heat', max: 2 },
  { id: 'stokenMagnet', type: 'LUCK', name: 'Stoken Magnet', effect: 'Pickups fly to you', note: 'from three times as far', max: 1 },
  { id: 'doubleStoken', type: 'LUCK', name: 'Double Stoken', effect: 'Every Stoken counts twice', max: 1 },
  { id: 'hustler', type: 'LUCK', name: 'Hustler', effect: '+1 card on every boon pick', max: 1 },
  { id: 'roofRider', type: 'STREET', name: 'Roof Rider', effect: 'Parked car and bus roofs grind like ledges', max: 1 },
  //gear boons (zack, 2026-11-06): by acts 3-4 a floor wears your gear about twice as hard as in act 1, and it was busted
  //well before the next shop. Each one makes its part wear half as fast. Offered once your gear has had a floor or
  //two to wear (from floor 2's pick on)
  {
    id: 'fiberglassCore', type: 'POP', name: 'Fiberglass Core', effect: 'Your deck wears half as fast', note: 'and every new deck you buy',
    max: 1, when: (r) => r.floor >= 2, gear: true,
  },
  {
    id: 'ceramicBearings', type: 'FLOW', name: 'Ceramic Bearings', effect: 'Your bearings wear half as fast', note: 'and every new set you buy',
    max: 1, when: (r) => r.floor >= 2, gear: true,
  },
  {
    id: 'classifiedUrethane', type: 'FLOW', name: 'Classified Urethane', effect: 'Your wheels wear half as fast', note: 'and every new set you buy',
    max: 1, when: (r) => r.floor >= 2, gear: true,
  },
  //curses: strong, with a cost
  { id: 'moonShoes', type: 'POP', name: 'Moon Shoes', effect: 'Ollie 60% higher', note: 'but grind 30% slower', max: 1, cursed: true },
  { id: 'wanted', type: 'LUCK', name: 'Wanted', effect: 'Double Stoken', note: 'but Heat rises twice as fast', max: 1, cursed: true },
  { id: 'speedWobbles', type: 'FLOW', name: 'Speed Wobbles', effect: 'Cruise 40% faster', note: 'but land too fast and you slam', max: 1, cursed: true },
  //duo boons: two you hold, fused
  {
    id: 'rocketGrind', type: 'GRIND', name: 'Rocket Grind', effect: 'Ollie off a fast grind and you launch straight up',
    note: 'all jumps back at the top', max: 1, duo: ['railLaunch', 'bigPop'],
  },
  { id: 'skyLine', type: 'POP', name: 'Sky Line', effect: 'Every air trick leaves a ghost rail under you', max: 1, duo: ['ghostRail', 'tripleThreat'] },
  { id: 'perpetualMotion', type: 'FLOW', name: 'Perpetual Motion', effect: 'Extra speed never bleeds off', max: 1, duo: ['butter', 'slingshot'] },
];

export function boonById(id: BoonId): Boon {
  return BOONS.find((b) => b.id === id)!;
}

export function stacksOf(boons: Held[], id: BoonId): number {
  return boons.find((b) => b.id === id)?.stacks ?? 0;
}

// add a stack, up to the boon's max
export function addBoon(boons: Held[], id: BoonId): Held[] {
  const max = boonById(id).max;
  const have = stacksOf(boons, id);
  if (have >= max) return boons;
  if (have === 0) return [...boons, { id, stacks: 1 }];
  return boons.map((b) => (b.id === id ? { id, stacks: b.stacks + 1 } : b));
}
