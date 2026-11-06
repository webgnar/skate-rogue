// Turns held boons into the numbers and flags the skater reads. No boon code runs inside the skater.
import { stacksOf, type Held } from './defs';

export interface Mods {
  jumps: number; // extra jumps
  ollieScale: number;
  pressureFlip: boolean;
  strongLegs: boolean; // a second press during the landing's impact ollies anyway
  railMagnet: number; // px
  grindScale: number;
  grindInstant: boolean;
  railLaunch: number; // share of grind speed added to an ollie off a rail
  carryBleedScale: number;
  ghostRail: boolean;
  // FLOW
  speedScale: number; // cruising speed (New Wheels)
  scoreScale: number;
  butter: boolean; // landings keep air speed
  slingshot: number; // rail-end launch multiplier
  // COOL (the floor's Heat and the run's score read these)
  heatRise: number; // multiplier on Heat gained
  bubblePads: number; // slams per floor that cost nothing
  firecracker: boolean; // roll into a stair set and ride it down in a manual, the tail clacking each step
  // LUCK (pickups and the run read these)
  magnet: number; // pickup reach multiplier
  stokenScale: number;
  extraCards: number;
  // STREET
  roofRider: boolean; // parked roofs are grind ledges
  hopScale: number; // car-hop bounce (a skater's, src/run/meta.ts)
  // curses and duos
  wobbles: boolean; // Speed Wobbles: landing this much over cruising speed slams
  rocketGrind: boolean;
  skyLine: boolean;
  // the skater and deck (src/run/meta.ts)
  airCool: number; // multiplier on Heat cooling while airborne (Keanu)
  wearScale: number; // multiplier on gear wear (Bombhill deck)
  partWear: { deck: number; wheels: number; bearings: number }; // per-part wear multipliers (the gear boons)
}

// Fiberglass Core, Classified Urethane, Ceramic Bearings: their part wears this much as fast
export const GEAR_BOON_WEAR = 0.5;

export const NO_MODS: Mods = {
  jumps: 0,
  ollieScale: 1,
  pressureFlip: false,
  strongLegs: false,
  railMagnet: 0,
  grindScale: 1,
  grindInstant: false,
  railLaunch: 0,
  carryBleedScale: 1,
  ghostRail: false,
  speedScale: 1,
  scoreScale: 1,
  butter: false,
  slingshot: 1,
  heatRise: 1,
  bubblePads: 0,
  firecracker: false,
  magnet: 1,
  stokenScale: 1,
  extraCards: 0,
  roofRider: false,
  hopScale: 1,
  wobbles: false,
  rocketGrind: false,
  skyLine: false,
  airCool: 1,
  wearScale: 1,
  partWear: { deck: 1, wheels: 1, bearings: 1 },
};

export function skaterMods(boons: Held[]): Mods {
  const s = (id: Parameters<typeof stacksOf>[1]) => stacksOf(boons, id);
  return {
    jumps: s('tripleThreat'),
    ollieScale: 1 + 0.2 * s('bigPop') + 0.6 * s('moonShoes'),
    pressureFlip: s('pressureFlip') > 0,
    strongLegs: s('strongLegs') > 0,
    railMagnet: 48 * s('railMagnet'),
    grindScale: (1 + 0.25 * s('grease')) * (s('moonShoes') ? 0.7 : 1),
    grindInstant: s('grease') > 0,
    railLaunch: s('railLaunch') > 0 ? 0.4 : 0,
    carryBleedScale: s('perpetualMotion') ? 0 : s('bombHill') > 0 ? 0.5 : 1,
    ghostRail: s('ghostRail') > 0,
    speedScale: 1 + 0.2 * s('newWheels') + 0.4 * s('speedWobbles'),
    scoreScale: 1 + 0.2 * s('newWheels'),
    butter: s('butter') > 0,
    slingshot: 1 + 0.5 * s('slingshot'),
    heatRise: (1 - 0.25 * s('lowProfile')) * (s('wanted') ? 2 : 1),
    bubblePads: s('bubblePads'),
    firecracker: s('firecracker') > 0,
    magnet: s('stokenMagnet') > 0 ? 3 : 1,
    stokenScale: (s('doubleStoken') > 0 ? 2 : 1) * (s('wanted') ? 2 : 1),
    extraCards: s('hustler'),
    roofRider: s('roofRider') > 0,
    hopScale: 1,
    wobbles: s('speedWobbles') > 0,
    rocketGrind: s('rocketGrind') > 0,
    skyLine: s('skyLine') > 0,
    airCool: 1,
    wearScale: 1,
    partWear: {
      deck: s('fiberglassCore') ? GEAR_BOON_WEAR : 1,
      wheels: s('classifiedUrethane') ? GEAR_BOON_WEAR : 1,
      bearings: s('ceramicBearings') ? GEAR_BOON_WEAR : 1,
    },
  };
}
