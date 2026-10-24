// Turns held boons into the numbers and flags the skater reads. No boon code runs inside the skater.
import { stacksOf, type Held } from './defs';

export interface Mods {
  jumps: number; // extra jumps
  ollieScale: number;
  floatyFlip: boolean;
  lateFlip: boolean;
  pressureFlip: boolean;
  spareChange: number; // bonus jump banked per grind
  railMagnet: number; // px
  grindScale: number;
  grindInstant: boolean;
  railLaunch: number; // share of grind speed added to an ollie off a rail
  carryBleedScale: number;
  feebleFrenzy: boolean;
  ghostRail: boolean;
}

export const NO_MODS: Mods = {
  jumps: 0,
  ollieScale: 1,
  floatyFlip: false,
  lateFlip: false,
  pressureFlip: false,
  spareChange: 0,
  railMagnet: 0,
  grindScale: 1,
  grindInstant: false,
  railLaunch: 0,
  carryBleedScale: 1,
  feebleFrenzy: false,
  ghostRail: false,
};

export function skaterMods(boons: Held[]): Mods {
  const s = (id: Parameters<typeof stacksOf>[1]) => stacksOf(boons, id);
  return {
    jumps: s('tripleThreat'),
    ollieScale: 1 + 0.2 * s('bigPop'),
    floatyFlip: s('floatyFlip') > 0,
    lateFlip: s('lateFlip') > 0,
    pressureFlip: s('pressureFlip') > 0,
    spareChange: 0.25 * s('spareChange'),
    railMagnet: 48 * s('railMagnet'),
    grindScale: 1 + 0.25 * s('grease'),
    grindInstant: s('grease') > 0,
    railLaunch: s('railLaunch') > 0 ? 0.4 : 0,
    carryBleedScale: s('exitWax') > 0 ? 0.25 : 1,
    feebleFrenzy: s('feebleFrenzy') > 0,
    ghostRail: s('ghostRail') > 0,
  };
}
