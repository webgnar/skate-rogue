// Supply pickups (GDD: Gear and wear, zack 2026-11-06): a single fresh part floating along the route, shown as that
// part's own model spinning in the air. They only turn up for gear you've let go: a part's chance builds the longer
// it has sat busted (at or under GEAR.busted), and is none while it's in good shape. The clock lives on the run (the
// game carries it floor to floor with the gear) and goes back to 0 when the part is replaced. Pure: FloorSim steps it.
import { GEAR, GEAR_PARTS, type Gear, type GearPart } from '../run/gear';
import type { Pickup } from '../physics/level';
import { TILE } from '../physics/constants';

export const SUPPLY = {
  fullAfter: 60, // seconds busted before a part's chance is at its full
  perSecond: 1 / 50, // the full chance, rolled once a second: about one a floor (a floor is ~50 s)
  ahead: [12, 26] as [number, number], // tiles ahead of the skater it shows up, so you see it coming
  reach: 30, // px: grab it within this of the skater's middle
  missBehind: 4 * TILE, // px behind the skater: past it, it's gone
};

export interface Supply {
  part: GearPart;
  x: number;
  y: number; // px, where it floats
}

export function noBustedTime(): Gear {
  return { deck: 0, shoes: 0, trucks: 0, wheels: 0, bearings: 0 };
}

// the part most overdue a supply: the one busted longest (null if none is busted)
export function overdue(gear: Gear, busted: Gear): GearPart | null {
  let best: GearPart | null = null;
  for (const p of GEAR_PARTS) if (gear[p] <= GEAR.busted && busted[p] > 0 && (!best || busted[p] > busted[best])) best = p;
  return best;
}

// this second's chance of a supply for a part busted this long
export function supplyChance(bustedSec: number): number {
  return Math.min(1, Math.max(0, bustedSec / SUPPLY.fullAfter)) * SUPPLY.perSecond;
}

// where it floats: on the highest coin ahead still to grab (the harder line), or nowhere for now
export function supplySpot(pickups: readonly Pickup[], taken: readonly boolean[], x: number): { x: number; y: number } | null {
  let best: Pickup | null = null;
  pickups.forEach((p, i) => {
    if (taken[i] || p.x < x + SUPPLY.ahead[0] * TILE || p.x > x + SUPPLY.ahead[1] * TILE) return;
    if (!best || p.y < best.y) best = p;
  });
  return best ? { x: (best as Pickup).x, y: (best as Pickup).y } : null;
}
