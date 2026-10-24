// The underground spot (GDD: Run structure): a safe DIY skate spot between floors, with no floor of its own. You
// get one of three: lay low (the next floor starts at 0 Heat instead of the Heat you carried out of the last one),
// swap a boon (drop one you hold for a pick of any type), or remove a curse. Then you skate
// the boon street after it. Logged overnight (2026-10-24): Heat now carries between floors at half, so laying low
// is worth something.
import { boonById, type Held } from '../boons/defs';
import { ROADS } from '../gen/roads';

export type UnderChoice = 'low' | 'swap' | 'curse';

export type UnderView =
  | { step: 'menu'; heat: number; canSwap: boolean; curses: number }
  | { step: 'drop'; boons: Held[] }
  | { step: 'lift'; boons: Held[] }; // the cursed boons you hold

// the Heat you take to the next floor: half of what you left with
export function carriedHeat(exitHeat: number): number {
  return Math.round(exitHeat * ROADS.heatCarry);
}

// a floor's starting Heat: its road's own, or what you carried in, whichever is higher
export function startHeat(roadHeat: number, carried: number): number {
  return Math.max(roadHeat, carried);
}

// one stack of a boon off
export function dropBoon(boons: Held[], id: Held['id']): Held[] {
  return boons.flatMap((b) => (b.id !== id ? [b] : b.stacks > 1 ? [{ id, stacks: b.stacks - 1 }] : []));
}

// the cursed boons you hold
export function cursesHeld(boons: Held[]): Held[] {
  return boons.filter((h) => boonById(h.id).cursed);
}

export function underLabel(id: Held['id']): string {
  return boonById(id).name;
}
