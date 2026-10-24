// The fork at the end of a floor (GDD: Run structure 1). Signs show where the high road and the low road lead: a
// reward and a danger rating. The road you skate decides what the next floor is and what it pays at its end.
import type { BoonType } from '../boons/defs';
import { makeRng, randInt } from './rng';
import { ESCAPE_NAMES, escapeKind } from './escape';

export type Road =
  | { kind: 'boon'; boonType: BoonType; danger: number } // a normal floor, ending in a pick of that boon type
  | { kind: 'cash'; danger: number } // a normal floor with a big cash payout
  | { kind: 'hot'; danger: number } // rush hour, Heat starts at 30; pays a pick of 4 and cash
  | { kind: 'stash'; danger: number } // a short floor ending in a Stoken stash
  | { kind: 'shop'; boonType: BoonType; danger: number } // the skate shop (no floor), then a boon street
  | { kind: 'spot'; boonType: BoonType; danger: number } // the underground spot (no floor), then a boon street
  | { kind: 'escape'; act: number; danger: number }; // an act's escape set piece (no fork, no road choice)

export interface Fork {
  high: Road;
  low: Road;
}

export const ROADS = {
  hotHeat: 30,
  cashPayout: (floor: number) => 40 + 10 * floor,
  hotCash: (floor: number) => 20 + 5 * floor,
  stashStoken: (floor: number) => 5 + floor,
  hotFrom: 2, // hot streets appear from this floor's fork on
  shopFrom: 2, // the shop can turn up from this floor's fork on
  shopEvery: 3, // and always does at the end of every third floor
  shopChance: 0.12,
  spotFrom: 3, // the underground spot can turn up from this floor's fork on
  spotChance: 0.15,
  heatCarry: 0.5, // the share of your Heat that follows you to the next floor
};

// the floor a road leads to: the shop and the spot have none, so their road is the boon street after them
export function floorRoad(road: Road): Road {
  return road.kind === 'shop' || road.kind === 'spot' ? { kind: 'boon', boonType: road.boonType, danger: road.danger } : road;
}

// what the first floor of a run is
export const FIRST_ROAD: Road = { kind: 'boon', boonType: 'POP', danger: 1 };

const BOON_TYPES: BoonType[] = ['POP', 'GRIND', 'FLOW', 'COOL', 'LUCK', 'STREET'];

function roll(rng: () => number, floor: number, types: BoonType[], not?: Road): Road {
  for (;;) {
    const r = rng();
    let road: Road;
    if (floor >= ROADS.hotFrom && r < 0.2) road = { kind: 'hot', danger: 3 };
    else if (r < 0.4) road = { kind: 'cash', danger: 1 + randInt(rng, 2) };
    else if (r < 0.55) road = { kind: 'stash', danger: 1 };
    else road = { kind: 'boon', boonType: types[randInt(rng, types.length)], danger: 1 + randInt(rng, 2) };
    //the two roads always differ
    if (!not || label(road) !== label(not)) return road;
  }
}

// the fork at the end of `floor`, the same for a seed; boon streets only lead to the `types` in your boon library
export function rollFork(seed: number, floor: number, types: BoonType[] = BOON_TYPES): Fork {
  const rng = makeRng(seed * 13 + floor * 6151);
  const pick = (): BoonType => types[randInt(rng, types.length)];
  const boonStreet = (): Road => ({ kind: 'boon', boonType: pick(), danger: 1 + randInt(rng, 2) });
  //the shop: always every third floor, sometimes from floor 2; the other road is a boon street
  if (floor >= ROADS.shopFrom && (floor % ROADS.shopEvery === 0 || rng() < ROADS.shopChance)) {
    const shop: Road = { kind: 'shop', boonType: pick(), danger: 1 + randInt(rng, 2) };
    const other = boonStreet();
    return rng() < 0.5 ? { high: shop, low: other } : { high: other, low: shop };
  }
  //the underground spot, beside a boon street
  if (floor >= ROADS.spotFrom && rng() < ROADS.spotChance) {
    const spot: Road = { kind: 'spot', boonType: pick(), danger: 1 };
    const other = boonStreet();
    return rng() < 0.5 ? { high: spot, low: other } : { high: other, low: spot };
  }
  const high = roll(rng, floor, types);
  //at least one road is a boon street, so a run keeps building
  const low = high.kind === 'boon' ? roll(rng, floor, types, high) : boonStreet();
  return { high, low };
}

export function label(road: Road): string {
  switch (road.kind) {
    case 'boon':
      return `${road.boonType} BOON`;
    case 'cash':
      return 'CASH';
    case 'hot':
      return 'HOT STREET';
    case 'stash':
      return 'STOKEN STASH';
    case 'shop':
      return 'SKATE SHOP';
    case 'spot':
      return 'UNDERGROUND SPOT';
    case 'escape':
      return ESCAPE_NAMES[escapeKind(road.act)];
  }
}
