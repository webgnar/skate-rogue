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
  // FLOW
  speedScale: number; // cruising speed (New Wheels)
  scoreScale: number;
  butter: boolean; // landings keep air speed
  kickerScale: number;
  slingshot: number; // rail-end launch multiplier
  // COOL (the floor's Heat and the run's score read these)
  heatRise: number; // multiplier on Heat gained
  bubblePads: number; // slams per floor that cost nothing
  tuckAndRoll: number; // gap saves per floor
  slamStoke: boolean;
  hopCool: number; // extra Heat off per car hop
  decoy: boolean;
  slowHeat: number; // multiplier on Heat from skating slow
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
  speedScale: 1,
  scoreScale: 1,
  butter: false,
  kickerScale: 1,
  slingshot: 1,
  heatRise: 1,
  bubblePads: 0,
  tuckAndRoll: 0,
  slamStoke: false,
  hopCool: 0,
  decoy: false,
  slowHeat: 1,
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
    carryBleedScale: (s('exitWax') > 0 ? 0.25 : 1) * (s('bombHill') > 0 ? 0.5 : 1),
    feebleFrenzy: s('feebleFrenzy') > 0,
    ghostRail: s('ghostRail') > 0,
    speedScale: 1 + 0.2 * s('newWheels'),
    scoreScale: 1 + 0.2 * s('newWheels'),
    butter: s('butter') > 0,
    kickerScale: s('kickerBoost') > 0 ? 1.3 : 1,
    slingshot: 1 + 0.5 * s('slingshot'),
    heatRise: 1 - 0.25 * s('lowProfile'),
    bubblePads: s('bubblePads'),
    tuckAndRoll: s('tuckAndRoll'),
    slamStoke: s('slamStoke') > 0,
    hopCool: 10 * s('sirenSong'),
    decoy: s('decoy') > 0,
    slowHeat: s('ghostMode') > 0 ? 0.5 : 1,
  };
}
