// The first playable boon set: 6 POP and 6 GRIND boons. Card fields follow QFS survivor_boons
// (type label, name, effect line, optional small line, max stacks, when filter).
export type BoonType = 'POP' | 'GRIND';

export type BoonId =
  | 'tripleThreat' | 'bigPop' | 'floatyFlip' | 'lateFlip' | 'pressureFlip' | 'spareChange'
  | 'railMagnet' | 'grease' | 'railLaunch' | 'exitWax' | 'feebleFrenzy' | 'ghostRail';

export interface Held {
  id: BoonId;
  stacks: number;
}

export interface RunView {
  floor: number;
  boons: Held[];
}

export interface Boon {
  id: BoonId;
  type: BoonType;
  name: string;
  effect: string;
  note?: string;
  max: number;
  when?: (run: RunView) => boolean;
}

export const BOON_COLORS: Record<BoonType, string> = { POP: '#ffd23f', GRIND: '#ff8c2b' };

export const BOONS: Boon[] = [
  { id: 'tripleThreat', type: 'POP', name: 'Triple Threat', effect: '+1 jump', max: 1 },
  { id: 'bigPop', type: 'POP', name: 'Big Pop', effect: 'Ollie 20% higher', max: 3 },
  { id: 'floatyFlip', type: 'POP', name: 'Floaty Flip', effect: 'Half gravity right after a flip trick', max: 1 },
  { id: 'lateFlip', type: 'POP', name: 'Late Flip', effect: 'Flip tricks always go full height', note: 'even on a quick tap', max: 1 },
  { id: 'pressureFlip', type: 'POP', name: 'Pressure Flip', effect: 'Keep holding after an ollie to float', note: '30% less gravity after 0.25 s', max: 1 },
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
