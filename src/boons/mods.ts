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
  firecracker: boolean; // roll into a stair set and ride it down in a manual, the tail clacking each step
  slamStoke: boolean;
  hopCool: number; // extra Heat off per car hop
  decoy: boolean;
  slowHeat: number; // multiplier on Heat from skating slow
  // LUCK (pickups and the run read these)
  magnet: number; // pickup reach multiplier
  stokenScale: number;
  extraCards: number;
  freeReroll: boolean;
  // STREET
  roofRider: boolean; // parked roofs are grind ledges
  slipFrames: number; // frames tucked behind a car for a Slipstream (0 = none)
  hopScale: number;
  spoofed: boolean; // robotaxis don't brake
  nearScale: number; // close-call window and score
  // curses and duos
  wobbles: boolean; // Speed Wobbles: landing this much over cruising speed slams
  rocketGrind: boolean;
  skyLine: boolean;
  // the skater and deck (src/run/meta.ts)
  airCool: number; // multiplier on Heat cooling while airborne (Keanu)
  wearScale: number; // multiplier on gear wear (Bombhill deck)
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
  firecracker: false,
  slamStoke: false,
  hopCool: 0,
  decoy: false,
  slowHeat: 1,
  magnet: 1,
  stokenScale: 1,
  extraCards: 0,
  freeReroll: false,
  roofRider: false,
  slipFrames: 0,
  hopScale: 1,
  spoofed: false,
  nearScale: 1,
  wobbles: false,
  rocketGrind: false,
  skyLine: false,
  airCool: 1,
  wearScale: 1,
};

export function skaterMods(boons: Held[]): Mods {
  const s = (id: Parameters<typeof stacksOf>[1]) => stacksOf(boons, id);
  return {
    jumps: s('tripleThreat'),
    ollieScale: 1 + 0.2 * s('bigPop') + 0.6 * s('moonShoes'),
    floatyFlip: s('floatyFlip') > 0,
    lateFlip: s('lateFlip') > 0,
    pressureFlip: s('pressureFlip') > 0,
    spareChange: 0.25 * s('spareChange'),
    railMagnet: 48 * s('railMagnet'),
    grindScale: (1 + 0.25 * s('grease')) * (s('moonShoes') ? 0.7 : 1),
    grindInstant: s('grease') > 0,
    railLaunch: s('railLaunch') > 0 ? 0.4 : 0,
    carryBleedScale: s('perpetualMotion') ? 0 : (s('exitWax') > 0 ? 0.25 : 1) * (s('bombHill') > 0 ? 0.5 : 1),
    feebleFrenzy: s('feebleFrenzy') > 0,
    ghostRail: s('ghostRail') > 0,
    speedScale: 1 + 0.2 * s('newWheels') + 0.4 * s('speedWobbles'),
    scoreScale: 1 + 0.2 * s('newWheels'),
    butter: s('butter') > 0,
    kickerScale: s('kickerBoost') > 0 ? 1.3 : 1,
    slingshot: 1 + 0.5 * s('slingshot'),
    heatRise: (1 - 0.25 * s('lowProfile')) * (s('wanted') ? 2 : 1),
    bubblePads: s('bubblePads'),
    tuckAndRoll: s('tuckAndRoll'),
    firecracker: s('firecracker') > 0,
    slamStoke: s('slamStoke') > 0,
    hopCool: 10 * s('sirenSong'),
    decoy: s('decoy') > 0,
    slowHeat: s('ghostMode') > 0 ? 0.5 : 1,
    magnet: s('stokenMagnet') > 0 ? 3 : 1,
    stokenScale: (s('doubleStoken') > 0 ? 2 : 1) * (s('wanted') ? 2 : 1),
    extraCards: s('hustler'),
    freeReroll: s('luckyReroll') > 0,
    roofRider: s('roofRider') > 0,
    slipFrames: [0, 30, 20][s('slipstream')],
    hopScale: 1 + 0.5 * s('hoodPop'),
    spoofed: s('spoofedPlate') > 0,
    nearScale: s('jaywalker') > 0 ? 2 : 1,
    wobbles: s('speedWobbles') > 0,
    rocketGrind: s('rocketGrind') > 0,
    skyLine: s('skyLine') > 0,
    airCool: 1,
    wearScale: 1,
  };
}
