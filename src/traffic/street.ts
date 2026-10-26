// Street hazards that wait for you (GDD: Traffic and the level tiles `B` and `E`). Logged overnight (2026-10-24):
// - Bus stops, from floor 4: a stop sign on open street. As you come up, a bus in the back lane signals and pulls
//   into the skate lane at the stop, sits a few seconds, then pulls away your way. Its roof is past a plain ollie:
//   ollie and flip up the back, hop on from a car, or wait it out behind it.
// - Car doors, from floor 2: a car parked in the back lane, behind you, has someone inside (zack, 2026-10-26: "cars
//   in the lane behind the player are the ones that should open their car doors"). Come within range and a "!" pops
//   up over it, then its door flies open wide across your lane. Roll into it and you slam; land on its top edge and it
//   pops you like a car hop (the launch). It stays open until you're past. The car itself is behind you: only the
//   door is in your way.
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
  every: 24 * TILE, // a spot for a door car this often along the street
  chance: 0.3, // that it has one
  most: 3, // a floor
  carW: 2 * TILE, // TRAFFIC.carW
  carH: 40, // TRAFFIC.carH
  hinge: 0.62 * 2 * TILE, // the front door's hinge, from the car's back end (it faces your way)
  range: 14 * TILE, // the "!" pops up when the skater is this far behind the car
  warnFrames: 36, // the "!" alone, before the door moves
  swingFrames: 12,
  reach: 0.5 * TILE, // how far the open door stands back from its hinge, as you come at it
  h: 36, // its top edge, px above the street (a car roof is 40)
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

// where a floor's door cars park, back lane, by the car's back end: open street with a clear run up in your lane
// (no parked car, cross street, bus stop or glass), never on an escape
export function doorPlan(level: Level, seed: number, stops: BusStop[] = []): number[] {
  const floor = level.layout.floor;
  if (floor < DOOR.from || level.escape) return [];
  const rng = makeRng(seed * 29 + floor * 2203);
  const out: number[] = [];
  for (let x = level.finaleX + 14 * TILE; x + DOOR.carW < level.exitX - 6 * TILE && out.length < DOOR.most; x += DOOR.every) {
    if (rng() >= DOOR.chance) continue;
    const x0 = x - 4 * TILE; // the run up to the door
    const x1 = x + DOOR.carW + TILE;
    let open = true;
    for (let sx = x0; sx <= x1 && open; sx += TILE / 2) open = isStreetAt(level, sx);
    if (!open) continue;
    if (level.cars.some((c) => c.x1 > x0 && c.x0 < x1)) continue;
    if (level.crossings.some((i) => i.x + CROSS.w + TILE > x0 && i.x - TILE < x1)) continue;
    if (level.glass.some((g) => g.x1 > x0 && g.x0 < x1)) continue;
    if (stops.some((s) => s.x + STOP.busW + STOP.clear > x0 && s.x - STOP.trigger < x1)) continue;
    out.push(x);
  }
  return out;
}

export class CarDoor {
  warn = 0; // frames the "!" has been up
  open = 0; // 0 shut, 1 wide open
  readonly car: Car; // parked in the back lane: scenery, never in your way
  readonly box: Car; // the open door, across your lane

  constructor(x: number, street: number) {
    this.car = { x0: x, x1: x + DOOR.carW, roof: street - DOOR.carH, bottom: street };
    const hinge = x + DOOR.hinge;
    this.box = { x0: hinge - DOOR.reach, x1: hinge + 2, roof: street - DOOR.h, bottom: street };
  }

  // something you can hit or land on once it's half open
  get solid(): boolean {
    return this.open >= 0.5;
  }

  step(skaterX: number): void {
    if (this.warn === 0 && skaterX < this.car.x0 - DOOR.range) return;
    if (this.warn < DOOR.warnFrames) this.warn++;
    else this.open = Math.min(1, this.open + 1 / DOOR.swingFrames);
  }
}
