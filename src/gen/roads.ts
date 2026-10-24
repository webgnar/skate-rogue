// The fork at the end of a floor (GDD: Run structure 1). Signs show where the high road and the low road lead: a
// reward and a danger rating. The road you skate decides what the next floor is and what it pays at its end.
import type { BoonType } from '../boons/defs';
import { makeRng, randInt } from './rng';

export type Road =
  | { kind: 'boon'; boonType: BoonType; danger: number } // a normal floor, ending in a pick of that boon type
  | { kind: 'cash'; danger: number } // a normal floor with a big cash payout
  | { kind: 'hot'; danger: number } // rush hour, Heat starts at 30; pays a pick of 4 and cash
  | { kind: 'stash'; danger: number }; // a short floor ending in a Stoken stash

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
};

// what the first floor of a run is
export const FIRST_ROAD: Road = { kind: 'boon', boonType: 'POP', danger: 1 };

const BOON_TYPES: BoonType[] = ['POP', 'GRIND'];

function roll(rng: () => number, floor: number, not?: Road): Road {
  for (;;) {
    const r = rng();
    let road: Road;
    if (floor >= ROADS.hotFrom && r < 0.2) road = { kind: 'hot', danger: 3 };
    else if (r < 0.4) road = { kind: 'cash', danger: 1 + randInt(rng, 2) };
    else if (r < 0.55) road = { kind: 'stash', danger: 1 };
    else road = { kind: 'boon', boonType: BOON_TYPES[randInt(rng, BOON_TYPES.length)], danger: 1 + randInt(rng, 2) };
    //the two roads always differ
    if (!not || label(road) !== label(not)) return road;
  }
}

// the fork at the end of `floor`, the same for a seed
export function rollFork(seed: number, floor: number): Fork {
  const rng = makeRng(seed * 13 + floor * 6151);
  const high = roll(rng, floor);
  //at least one road is a boon street, so a run keeps building
  const low = high.kind === 'boon' ? roll(rng, floor, high) : { kind: 'boon' as const, boonType: BOON_TYPES[randInt(rng, 2)], danger: 1 + randInt(rng, 2) };
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
  }
}
