// Street hazards that wait for you (GDD: Traffic and the level tiles `B` and `E`). Logged overnight (2026-10-24):
// - Bus stops, from floor 4: a stop sign on open street. As you come up, a bus in the back lane signals and pulls
//   into the skate lane at the stop, sits a few seconds, then pulls away your way. Its roof is past a plain ollie:
//   ollie and flip up the back, hop on from a car, or wait it out behind it.
// - Car doors, from floor 2: some parked cars have someone inside. Come within range and the driver's door swings
//   open on your side, a low panel behind the car. Roll into it and you slam; land on its top edge and it pops you
//   like a car hop (the launch). It stays open until you're past.
// Pure: positions come from the floor seed, timing from the skater's x.
import { makeRng } from '../gen/rng';
import { TILE } from '../physics/constants';
import { isStreetAt, type Car, type Level } from '../physics/level';
import { CROSS } from './cross';

export const STOP = {
  from: 4,
  chance: 0.7, // a floor from 4 has a bus stop this often (at most one)
  busW: 6 * TILE, // TRAFFIC.busW
  clear: 2 * TILE, // open street either side of the bus
  trigger: 18 * TILE, // the bus starts pulling in when the skater is this far behind the stop (it's in the lane about 8 tiles ahead)
  pullFrames: 90, // from the back lane into the skate lane, slowing to a stop
  pullFrom: 4 * TILE, // how far back along the street it starts pulling in
  dwell: 300, // frames at the stop
};

export const DOOR = {
  from: 2,
  chance: 0.5, // of plain parked cars
  range: 9 * TILE, // it swings open when the skater is this far behind the car
  swingFrames: 12,
  reach: 0.75 * TILE, // how far the open door stands out behind the car
  h: 30, // its top edge, px above the street (a car roof is 40)
};

export interface BusStop {
  x: number; // where the bus's back stops
  trigger: number;
}

// where a floor's bus stop goes: open street clear of canals, parked cars, glass and cross streets
export function stopPlan(level: Level, seed: number): BusStop[] {
  const floor = level.layout.floor;
  if (floor < STOP.from || level.escape) return [];
  const rng = makeRng(seed * 23 + floor * 4421);
  if (rng() >= STOP.chance) return [];
  const open = (x0: number, x1: number) => {
    for (let x = x0; x <= x1; x += TILE / 2) if (!isStreetAt(level, x)) return false;
    if (level.cars.some((c) => c.x1 > x0 && c.x0 < x1)) return false;
    if (level.crossings.some((i) => i.x + CROSS.w + TILE > x0 && i.x - TILE < x1)) return false;
    return !level.glass.some((g) => g.x1 > x0 && g.x0 < x1);
  };
    const first = level.finaleX + 14 * TILE;
  const last = level.exitX - 4 * TILE - STOP.busW;
  if (last <= first) return [];
  //from a random point on, wrapping round once
  const start = first + Math.floor(rng() * (last - first) / TILE) * TILE;
  for (let k = 0; k <= last - first; k += TILE) {
    const x = first + ((start - first + k) % (last - first + TILE));
    //it pulls in from the back lane, so only the stop itself needs clear street
    if (open(x - STOP.clear, x + STOP.busW + STOP.clear)) return [{ x, trigger: x - STOP.trigger }];
  }
  return [];
}

// which parked cars have a door that opens: plain cars only (not roadblocks), never on an escape
export function doorPlan(level: Level, seed: number): number[] {
  const floor = level.layout.floor;
  if (floor < DOOR.from || level.escape) return [];
  const rng = makeRng(seed * 29 + floor * 2203);
  return level.cars.flatMap((c, i) => (!c.model && rng() < DOOR.chance ? [i] : []));
}

export class CarDoor {
  open = 0; // 0 shut, 1 wide open
  readonly box: Car;

  constructor(readonly car: Car) {
    this.box = { x0: car.x0 - DOOR.reach, x1: car.x0 + 2, roof: car.bottom - DOOR.h, bottom: car.bottom };
  }

  // something you can hit or land on once it's half open
  get solid(): boolean {
    return this.open >= 0.5;
  }

  step(skaterX: number): void {
    if (this.open > 0 || skaterX >= this.car.x0 - DOOR.range) this.open = Math.min(1, this.open + 1 / DOOR.swingFrames);
  }
}
