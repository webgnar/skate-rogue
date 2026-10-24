// Meta progression (GDD: Meta progression): Stoken from runs buys unlocks that stay. Three branches: the deck shop
// (skaters and decks), the boon library (packs of boon types, curses, duos) and spots (the daily run). Unlocks are
// mostly more variety, not more power: each skater and deck is a small trade, never a straight upgrade.
import type { BoonType } from '../boons/defs';
import type { Mods } from '../boons/mods';
import type { SkaterId } from '../render/skater-rig';

export type DeckId = 'popsicle' | 'cruiser' | 'slab' | 'bombhill';
export type PackId = 'FLOW' | 'COOL' | 'LUCK' | 'STREET' | 'curses' | 'duos';
export type UnlockId = SkaterId | DeckId | PackId | 'daily';
export type Branch = 'skater' | 'deck' | 'library' | 'spot';

export interface Unlock {
  id: UnlockId;
  branch: Branch;
  name: string;
  line: string; // what it does, one short line
  cost: number; // Stoken; 0 is open from the start
}

export const UNLOCKS: Unlock[] = [
  { id: 'lou-gnar', branch: 'skater', name: 'Lou Gnar', line: 'The baseline. First pick: POP', cost: 0 },
  { id: 'webster', branch: 'skater', name: 'Webster', line: 'Grinds 15% faster. First pick: GRIND', cost: 30 },
  { id: 'roxy', branch: 'skater', name: 'Roxy', line: 'Car-hops bounce 20% higher. First pick: STREET', cost: 40 },
  { id: 'keanu', branch: 'skater', name: 'Keanu', line: 'Heat cools 15% faster in the air. First pick: COOL', cost: 50 },
  { id: 'goldie', branch: 'skater', name: 'Goldie', line: '+25% cash from everything. First pick: LUCK', cost: 60 },
  { id: 'popsicle', branch: 'deck', name: 'Popsicle', line: 'The stock deck: 3 slots', cost: 0 },
  { id: 'cruiser', branch: 'deck', name: 'Cruiser', line: '+10% speed, ollies 5% lower', cost: 25 },
  { id: 'bombhill', branch: 'deck', name: 'Bombhill', line: '+15% speed, gear wears 30% faster', cost: 35 },
  { id: 'slab', branch: 'deck', name: 'Slab', line: '4 slots, ollies 8% lower', cost: 45 },
  { id: 'FLOW', branch: 'library', name: 'FLOW pack', line: 'Speed boons join the pool', cost: 15 },
  { id: 'COOL', branch: 'library', name: 'COOL pack', line: 'Heat boons join the pool', cost: 20 },
  { id: 'STREET', branch: 'library', name: 'STREET pack', line: 'Traffic boons join the pool', cost: 25 },
  { id: 'LUCK', branch: 'library', name: 'LUCK pack', line: 'Pickup and cash boons join the pool', cost: 25 },
  { id: 'curses', branch: 'library', name: 'Curses', line: 'Strong boons with a cost, from floor 6', cost: 35 },
  { id: 'duos', branch: 'library', name: 'Duos', line: 'Hold both halves to fuse them', cost: 40 },
  { id: 'daily', branch: 'spot', name: 'Daily run', line: 'One seed a day, the same for everyone', cost: 20 },
];

export const BRANCH_NAMES: Record<Branch, string> = { skater: 'SKATERS', deck: 'DECKS', library: 'BOON LIBRARY', spot: 'SPOTS' };

// what a run starts with: always POP and GRIND (12 boons), plus the packs bought
export const START_TYPES: BoonType[] = ['POP', 'GRIND'];
const PACK_TYPES: (BoonType & PackId)[] = ['FLOW', 'COOL', 'LUCK', 'STREET'];

export function unlockDef(id: UnlockId): Unlock {
  return UNLOCKS.find((u) => u.id === id)!;
}

export const isUnlockId = (s: unknown): s is UnlockId => UNLOCKS.some((u) => u.id === s);
export const isSkaterId = (s: unknown): s is SkaterId => UNLOCKS.some((u) => u.branch === 'skater' && u.id === s);
export const isDeck = (s: unknown): s is DeckId => UNLOCKS.some((u) => u.branch === 'deck' && u.id === s);

export function has(unlocked: readonly UnlockId[], id: UnlockId): boolean {
  return unlockDef(id).cost === 0 || unlocked.includes(id);
}

// the boon pool a run can draw from
export interface Library {
  types: BoonType[];
  curses: boolean;
  duos: boolean;
}

export const FULL_LIBRARY: Library = { types: [...START_TYPES, ...PACK_TYPES], curses: true, duos: true };

export function libraryOf(unlocked: readonly UnlockId[]): Library {
  return {
    types: [...START_TYPES, ...PACK_TYPES.filter((t) => has(unlocked, t))],
    curses: has(unlocked, 'curses'),
    duos: has(unlocked, 'duos'),
  };
}

// buy an unlock from the bank: null when it's owned already or you can't afford it
export function buy(unlocked: readonly UnlockId[], stoken: number, id: UnlockId): { unlocked: UnlockId[]; stoken: number } | null {
  const cost = unlockDef(id).cost;
  if (has(unlocked, id) || stoken < cost) return null;
  return { unlocked: [...unlocked, id], stoken: stoken - cost };
}

// the skater and deck you ride
export interface Loadout {
  skater: SkaterId;
  deck: DeckId;
}

export const STOCK: Loadout = { skater: 'lou-gnar', deck: 'popsicle' };

export const LEAN: Record<SkaterId, BoonType> = { 'lou-gnar': 'POP', webster: 'GRIND', roxy: 'STREET', keanu: 'COOL', goldie: 'LUCK' };

// the first boon street of a run is your skater's type, if that type is in your library
export function firstPick(loadout: Loadout, library: Library): BoonType {
  const lean = LEAN[loadout.skater];
  return library.types.includes(lean) ? lean : 'POP';
}

export const DECK_SLOTS: Record<DeckId, number> = { popsicle: 3, cruiser: 3, bombhill: 3, slab: 4 };

// the skater's passive and the deck's stats on top of the boons' mods
export function withLoadout(mods: Mods, l: Loadout): Mods {
  const m = { ...mods };
  if (l.skater === 'webster') m.grindScale *= 1.15;
  if (l.skater === 'roxy') m.hopScale *= 1.2;
  if (l.skater === 'keanu') m.airCool *= 1.15;
  if (l.deck === 'cruiser') {
    m.speedScale *= 1.1;
    m.ollieScale *= 0.95;
  }
  if (l.deck === 'bombhill') {
    m.speedScale *= 1.15;
    m.wearScale *= 1.3;
  }
  if (l.deck === 'slab') m.ollieScale *= 0.92;
  return m;
}

// Goldie's cut, on every cash source
export const cashScale = (l: Loadout): number => (l.skater === 'goldie' ? 1.25 : 1);

// the daily run's seed: the UTC date, so every phone gets the same streets that day
export function dailySeed(now = new Date()): number {
  const day = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();
  return (Math.imul(day, 2654435761) >>> 0) % 999983 || 1;
}

export const dayKey = (now = new Date()): string => now.toISOString().slice(0, 10);
