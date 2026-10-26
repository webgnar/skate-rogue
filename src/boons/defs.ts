// The boon pool: POP and GRIND (the first playable set), then FLOW, COOL, LUCK and STREET. Card fields follow QFS
// survivor_boons (type label, name, effect line, optional small line, max stacks, when filter).
export type BoonType = 'POP' | 'GRIND' | 'FLOW' | 'COOL' | 'LUCK' | 'STREET';

export type BoonId =
  | 'tripleThreat' | 'bigPop' | 'floatyFlip' | 'lateFlip' | 'pressureFlip' | 'spareChange' | 'strongLegs'
  | 'railMagnet' | 'grease' | 'railLaunch' | 'exitWax' | 'feebleFrenzy' | 'ghostRail'
  | 'newWheels' | 'bombHill' | 'butter' | 'kickerBoost' | 'slingshot' | 'firecracker'
  | 'lowProfile' | 'bubblePads' | 'tuckAndRoll' | 'slamStoke' | 'sirenSong' | 'decoy' | 'ghostMode'
  | 'stokenMagnet' | 'doubleStoken' | 'hustler' | 'luckyReroll'
  | 'roofRider' | 'slipstream' | 'hoodPop' | 'spoofedPlate' | 'jaywalker'
  | 'moonShoes' | 'wanted' | 'speedWobbles'
  | 'rocketGrind' | 'skyLine' | 'perpetualMotion';

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
  { id: 'floatyFlip', type: 'POP', name: 'Floaty Flip', effect: 'Half gravity right after a flip trick', max: 1 },
  { id: 'lateFlip', type: 'POP', name: 'Late Flip', effect: 'Flip tricks always go full height', note: 'even on a quick tap', max: 1 },
  { id: 'pressureFlip', type: 'POP', name: 'Pressure Flip', effect: 'Keep holding after an ollie to float', note: '30% less gravity after 0.25 s', max: 1 },
  {
    id: 'strongLegs', type: 'POP', name: 'Strong Legs', effect: 'Tap twice as you land to ollie straight out of it',
    note: 'no waiting for your knees', max: 1,
  },
  { id: 'spareChange', type: 'POP', name: 'Spare Change', effect: 'Every grind banks 1/4 of a bonus jump', note: 'lost when you land', max: 3 },
  { id: 'railMagnet', type: 'GRIND', name: 'Rail Magnet', effect: 'Rails catch you from further away', note: '+48 px', max: 2 },
  { id: 'grease', type: 'GRIND', name: 'Grease', effect: 'Grind 25% faster', note: 'and hit full grind speed instantly', max: 2 },
  { id: 'railLaunch', type: 'GRIND', name: 'Rail Launch', effect: 'Ollies off rails pop higher the faster you grind', max: 1 },
  { id: 'exitWax', type: 'GRIND', name: 'Exit Wax', effect: 'Speed from rails lasts 4x longer', max: 1 },
  { id: 'feebleFrenzy', type: 'GRIND', name: 'Feeble Frenzy', effect: '+10% grind speed every 0.5 s on one rail', max: 1 },
  {
    id: 'ghostRail', type: 'GRIND', name: 'Ghost Rail', effect: 'Rails keep going 4 tiles past their end',
    note: 'for 2 s after you leave', max: 1,
  },
  { id: 'newWheels', type: 'FLOW', name: 'New Wheels', effect: 'Cruise 20% faster', note: 'and score 20% more', max: 2 },
  { id: 'bombHill', type: 'FLOW', name: 'Bomb Hill', effect: 'Extra speed bleeds off half as fast', max: 1 },
  { id: 'butter', type: 'FLOW', name: 'Butter', effect: 'Land on flat ground with all your air speed', max: 1 },
  {
    id: 'kickerBoost', type: 'FLOW', name: 'Kicker Boost', effect: 'Kickers launch 30% harder', note: 'and bomb harder',
    max: 1, when: (r) => r.floor >= 3, // box trucks come in on floor 4
  },
  {
    id: 'firecracker', type: 'FLOW', name: 'Firecracker', effect: 'Roll into a stair set and you firecracker down it',
    note: 'no slam; ollie out any time', max: 1,
  },
  { id: 'slingshot', type: 'FLOW', name: 'Slingshot', effect: 'Riding off the end of a rail launches you 50% harder', max: 2 },
  { id: 'lowProfile', type: 'COOL', name: 'Low Profile', effect: 'Heat rises 25% slower', max: 3 },
  { id: 'bubblePads', type: 'COOL', name: 'Bubble Pads', effect: 'Your first slam each floor costs nothing', note: 'no speed, no Heat', max: 2 },
  { id: 'tuckAndRoll', type: 'COOL', name: 'Tuck and Roll', effect: 'Fall in a gap and bounce back out', note: 'once per floor, for a slam', max: 1 },
  { id: 'slamStoke', type: 'COOL', name: 'Slam Stoke', effect: 'Slams fill your stoke instead of draining it', note: 'and keep your combo', max: 1 },
  { id: 'sirenSong', type: 'COOL', name: 'Siren Song', effect: 'Car hops take 10 more Heat off', max: 2 },
  { id: 'decoy', type: 'COOL', name: 'Decoy', effect: 'The first time Heat hits 75 on a floor, it drops to 35', max: 1 },
  { id: 'stokenMagnet', type: 'LUCK', name: 'Stoken Magnet', effect: 'Pickups fly to you', note: 'from three times as far', max: 1 },
  { id: 'doubleStoken', type: 'LUCK', name: 'Double Stoken', effect: 'Every Stoken counts twice', max: 1 },
  { id: 'hustler', type: 'LUCK', name: 'Hustler', effect: '+1 card on every boon pick', max: 1 },
  { id: 'luckyReroll', type: 'LUCK', name: 'Lucky Reroll', effect: 'Your first reroll on each pick is free', max: 1 },
  { id: 'roofRider', type: 'STREET', name: 'Roof Rider', effect: 'Parked car and bus roofs grind like ledges', max: 1 },
  { id: 'slipstream', type: 'STREET', name: 'Slipstream', effect: 'Draft right behind a car to slingshot past it', note: 'half a second; quicker with 2', max: 2 },
  { id: 'hoodPop', type: 'STREET', name: 'Hood Pop', effect: 'Car hops bounce 50% higher', max: 2 },
  {
    id: 'spoofedPlate', type: 'STREET', name: 'Spoofed Plate', effect: "Robotaxis don't brake for you", note: 'easier to hop from behind',
    max: 1,
  },
  { id: 'jaywalker', type: 'STREET', name: 'Jaywalker', effect: 'Close calls count from twice as far', note: 'and score double', max: 1 },
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
  { id: 'ghostMode', type: 'COOL', name: 'Ghost Mode', effect: 'Half the Heat from skating slow', note: 'the Flock cameras lose you', max: 1 },
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
