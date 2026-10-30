// Gear wear (GDD: Gear and wear). Your deck, shoes, trucks, wheels and bearings wear out with use over a run: the
// deck from ollies, the shoes from flip tricks (the flick scuffs the grip side), the trucks from grinding, the wheels
// from going fast and rough ground, and the bearings from grit and water (zack, 2026-10-30: bearings are what make
// you fast and puddles wreck them; wheels are what get you over glass, grass and puddles). Fresh gear is 100. Worn below half, a part starts to hold you back, worse the closer it gets to 0;
// the shop sells new ones. Pure: the floor sim wears it, the run keeps it between floors.
export type GearPart = 'deck' | 'shoes' | 'trucks' | 'wheels' | 'bearings';
export type Gear = Record<GearPart, number>;

export const GEAR_PARTS: GearPart[] = ['deck', 'shoes', 'trucks', 'wheels', 'bearings'];

export const GEAR = {
  // wear per use, out of 100. Tuned (2026-10-30, zack) so that by the first skate shop, after act 1's three floors
  // and its escape, about 2.5 parts are worn past half for the bot: the wheels and deck well past, the shoes
  // about half the time, the trucks only for a skater who grinds a lot (the bot grinds little). About 3x the wear
  // before (0.35, 1.2, 0.42, 0.46, 0.38), when no part was near half worn by then. tests/balance.test.ts holds it
  ollie: 0.4, // deck, per ollie: the pop is the small part of what a deck takes
  // deck, per landing (zack, 2026-10-30: impact from gravity wears the deck the most, worst landing against your
  // momentum so you lose speed): per px/frame of impact over a kiss (FEEL.soft), plus per px/frame of speed lost
  land: 0.25,
  landLost: 0.55,
  puddleDeck: 2, // deck, per puddle: the water soaks into the wood (zack, 2026-10-26; kept 2026-10-30)
  puddle: 12, // bearings, per puddle rolled through: water washes the grease out and rusts the races (zack, 2026-10-30)
  rollSec: 0.3, // bearings, per second rolling on the ground: dirt works into them
  smashGrit: 1.0, // bearings, per dusty or glassy prop smashed and per stretch of broken glass rolled over
  glass: 8, // wheels, per stretch of broken glass rolled over: it chunks the urethane
  flip: 1.25, // shoes, per flip trick
  grindSec: 1.4, // trucks, per second on a rail or ledge
  fastSec: 1.0, // wheels, per second going faster than fastOver x cruising speed
  fastOver: 1.25,
  wornFrom: 50, // below this a part starts to cost you
  busted: 15, // the HUD flashes it from here
  // the most each part costs you, at 0
  // ollie pop, flip pop, grind speed, cruising speed (bearings the most, wheels a little; they multiply)
  max: { deck: 0.3, shoes: 0.3, trucks: 0.3, wheels: 0.07, bearings: 0.2 } as Gear,
  roughFrom: 50, // wheels under this can't roll over broken glass: it stops them dead, a slam
  puddleDrag: { fresh: 0.06, dead: 0.45 }, // speed a puddle takes off you, fresh wheels to dead ones
  price: { deck: 25, shoes: 15, trucks: 20, wheels: 15, bearings: 15 } as Gear,
  names: { deck: 'Deck', shoes: 'Shoes', trucks: 'Trucks', wheels: 'Wheels', bearings: 'Bearings' } as Record<GearPart, string>,
  wornBy: { deck: 'hard landings', shoes: 'flip tricks', trucks: 'grinding', wheels: 'speed and rough ground', bearings: 'puddles, dirt and smashing' } as Record<GearPart, string>,
};

export function freshGear(): Gear {
  return { deck: 100, shoes: 100, trucks: 100, wheels: 100, bearings: 100 };
}

// how much a part holds you back: 0 down to half worn, then up to 1 at 0
export function wornness(condition: number): number {
  return Math.min(1, Math.max(0, (GEAR.wornFrom - condition) / GEAR.wornFrom));
}

// the multipliers the skater reads
export interface GearScale {
  ollie: number;
  trick: number;
  grind: number;
  speed: number;
  grip: number; // the wheels on rough ground: 1 fresh, 0 dead (glass, puddles)
}

export const NO_WEAR: GearScale = { ollie: 1, trick: 1, grind: 1, speed: 1, grip: 1 };

export function gearScale(g: Gear): GearScale {
  return {
    ollie: 1 - GEAR.max.deck * wornness(g.deck),
    trick: 1 - GEAR.max.shoes * wornness(g.shoes),
    grind: 1 - GEAR.max.trucks * wornness(g.trucks),
    speed: (1 - GEAR.max.bearings * wornness(g.bearings)) * (1 - GEAR.max.wheels * wornness(g.wheels)),
    grip: g.wheels / 100,
  };
}

// which wear line a part just crossed, for a callout: 'worn' at half, 'busted' near 0
export function crossed(before: number, after: number): 'worn' | 'busted' | null {
  if (before > GEAR.busted && after <= GEAR.busted) return 'busted';
  if (before > GEAR.wornFrom && after <= GEAR.wornFrom) return 'worn';
  return null;
}

// the shop: a new part, if you can pay for it and the old one has any wear on it
export function replace(g: Gear, cash: number, part: GearPart): { gear: Gear; cash: number } | null {
  if (g[part] >= 100 || cash < GEAR.price[part]) return null;
  return { gear: { ...g, [part]: 100 }, cash: cash - GEAR.price[part] };
}
