// Cross traffic (GDD: Traffic): at intersections, cars cut across the skate lane from the back lanes to the front.
// Logged overnight (2026-10-24): from floor 5, a floor gets an intersection or two on open street. Each has a
// traffic light and a car that starts across when the skater comes within range, timed from the floor seed so it
// sometimes blocks the lane as you arrive (ollie it, or land on its roof for a car hop), sometimes is just clearing,
// and sometimes you beat it across. The light turns red for the cross street's car the moment it pulls off, and the
// car shows in the back lane for over a second first, so it's always readable. Then it keeps cycling. Pure.
import { makeRng } from '../gen/rng';
import { PHYS, TILE } from '../physics/constants';
import { isStreetAt, type Car, type Level } from '../physics/level';

export const CROSS = {
  from: 5, // floors with cross traffic
  w: 1.6 * TILE, // the car seen nose-on: its width along the street
  h: 40,
  laneZ: 0.9, // tiles either side of the skate lane's middle that count as in the lane
  startZ: -9, // tiles: up the cross street it comes from
  endZ: 4, // and the front lane it goes to
  speedZ: 0.06, // tiles per frame across
  period: 260, // frames between cars once it starts cycling: 217 across, then a gap on green
  clear: 4 * TILE, // open street needed either side
  every: 40 * TILE, // at most one intersection per this much street
  street: 1.6, // tiles: half the cross street's width, either side of the car's middle
};

// frames from pulling off to reaching the skate lane
export const ARRIVE = (-CROSS.laneZ - CROSS.startZ) / CROSS.speedZ;

export interface Intersection {
  x: number; // the car's left edge
  trigger: number; // starts across when the skater passes this x
}

export class CrossCar {
  z: number = CROSS.startZ;
  t = -1; // frames since it pulled off; -1 waiting
  readonly box: Car;

  constructor(
    readonly at: Intersection,
    streetY: number,
  ) {
    this.box = { x0: at.x, x1: at.x + CROSS.w, roof: streetY - CROSS.h, bottom: streetY };
  }

  get inLane(): boolean {
    return Math.abs(this.z) < CROSS.laneZ;
  }

  // will it be in the lane `frames` from now?
  inLaneIn(frames: number): boolean {
    if (this.t < 0) return false;
    const z = this.zAt(this.t + frames);
    return Math.abs(z) < CROSS.laneZ;
  }

  zAt(t: number): number {
    const k = t % CROSS.period;
    return Math.min(CROSS.endZ, CROSS.startZ + k * CROSS.speedZ);
  }

  // red for the skater's street while a car is crossing or about to
  get red(): boolean {
    return this.t >= 0 && this.z < CROSS.endZ;
  }

  step(skaterX: number): void {
    if (this.t < 0) {
      if (skaterX >= this.at.trigger) this.t = 0;
      else return;
    } else this.t++;
    this.z = this.zAt(this.t);
  }
}

// where a floor's intersections go: open flat street, away from canals, parked cars, glass and the gate
export function crossPlan(level: Level, seed: number): Intersection[] {
  const floor = level.layout.floor;
  if (floor < CROSS.from || level.escape) return [];
  const rng = makeRng(seed * 17 + floor * 7919);
  const open = (x0: number, x1: number) => {
    for (let x = x0; x <= x1; x += TILE / 2) if (!isStreetAt(level, x)) return false;
    if (level.cars.some((c) => c.x1 > x0 && c.x0 < x1)) return false;
    return !level.glass.some((g) => g.x1 > x0 && g.x0 < x1);
  };
  const out: Intersection[] = [];
  let x = level.finaleX + 12 * TILE + Math.floor(rng() * 16) * TILE;
  while (x < level.exitX - 12 * TILE) {
    if (open(x - CROSS.clear, x + CROSS.w + CROSS.clear)) {
      //when the skater (at cruising speed) gets here relative to the car reaching the lane: -15 = just ahead of
      //it, 0-30 = it's in the lane, past 35 = it's clearing
      const k = -15 + Math.floor(rng() * 55);
      out.push({ x, trigger: x - PHYS.baseSpeed * (ARRIVE + k) });
      x += CROSS.every + Math.floor(rng() * 16) * TILE;
    } else x += 2 * TILE;
  }
  return out;
}
