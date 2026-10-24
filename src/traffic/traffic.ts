// Moving traffic in the skate lane (GDD: Traffic). The director spawns vehicles from the floor seed when the
// skater passes trigger points, so a slower skater sees the same street. Vehicles pull out of the skate lane
// before canals, parked cars and glass, so they never sit where the street can't hold them.
import { makeRng, randInt } from '../gen/rng';
import { PHYS, TILE } from '../physics/constants';
import { isStreetAt, type Car, type Level } from '../physics/level';
import { CrossCar, type Intersection } from './cross';

// robotaxis, buses and box trucks drive your way (slower than you); oncoming cars come at you
export type VehicleKind = 'robotaxi' | 'oncoming' | 'bus' | 'truck';

export interface Vehicle extends Car {
  id: number;
  kind: VehicleKind;
  speed: number; // px/frame, signed (+ = the skater's direction)
  cruise: number;
  lane: number; // 0 = the skate lane, 1 = pulled out to the back lane (no contact)
  leaving: boolean;
}

export interface Spawn {
  at: number; // spawns when the skater passes this x
  kind: VehicleKind;
  speed: number;
}

export const TRAFFIC = {
  carW: 2 * TILE,
  carH: 40,
  // a CTA bus: a long roof past a plain ollie (ollie and flip up the back, or hop on off a car), slow
  busW: 6 * TILE,
  busH: 72,
  busSpeed: 0.3,
  // a box truck with its tailgate down: the tailgate kicks you up onto the box
  truckW: 4 * TILE,
  truckH: 64,
  tailgate: TILE,
  bigFrom: 4, // buses and trucks join the traffic from this floor
  bigShare: 0.3, // of the vehicles going your way
  robotaxiSpeed: [0.35, 0.5], // share of base speed
  oncomingSpeed: -4,
  brakeRange: 3 * TILE, // robotaxis brake when the skater is this close behind
  brakeSpeed: 0.3,
  aheadRobotaxi: 16 * TILE, // where vehicles appear, ahead of the trigger point
  aheadOncoming: 30 * TILE,
  laneFrames: 20, // frames to pull out of the lane
  clearance: 2 * TILE, // pull out this far before a canal or a parked car
};

// floor 1-2 robotaxis only, oncoming from floor 3; density grows to 1 vehicle per 1.5 pieces by floor 8
export function spawnPlan(level: Level, seed: number): Spawn[] {
  const floor = level.layout.floor;
  const rng = makeRng(seed * 31 + floor * 31337);
  const pieces = level.layout.pieces.length;
  //danger 1-3 (the road's sign) scales it; rush hour also brings oncoming cars early
  const density = Math.min(0.67, 0.3 + 0.06 * (floor - 1)) * [0.7, 1, 1.5][(level.danger ?? 2) - 1];
  const plan: Spawn[] = [];
  for (let p = 1; p < pieces - 2; p++) {
    if (rng() >= density) continue;
    const oncoming = (floor >= 3 || level.danger >= 3) && rng() < 0.4;
    const [lo, hi] = TRAFFIC.robotaxiSpeed;
    const at = level.finaleX + p * 16 * TILE + randInt(rng, 8) * TILE;
    if (oncoming) {
      plan.push({ at, kind: 'oncoming', speed: TRAFFIC.oncomingSpeed });
      continue;
    }
    const big = floor >= TRAFFIC.bigFrom && rng() < TRAFFIC.bigShare;
    const kind: VehicleKind = big ? (rng() < 0.5 ? 'bus' : 'truck') : 'robotaxi';
    const speed = kind === 'bus' ? PHYS.baseSpeed * TRAFFIC.busSpeed : PHYS.baseSpeed * (lo + (hi - lo) * rng());
    plan.push({ at, kind, speed });
  }
  return plan;
}

// a vehicle's length and roof height, px
export function vehicleSize(kind: VehicleKind): [number, number] {
  if (kind === 'bus') return [TRAFFIC.busW, TRAFFIC.busH];
  if (kind === 'truck') return [TRAFFIC.truckW, TRAFFIC.truckH];
  return [TRAFFIC.carW, TRAFFIC.carH];
}

export class Traffic {
  vehicles: Vehicle[] = [];
  noBrake = false; // Spoofed Plate: robotaxis don't brake for the skater
  readonly cross: CrossCar[]; // cars crossing at intersections
  private next = 0;
  private ids = 0;

  constructor(
    private readonly level: Level,
    private readonly plan: Spawn[],
    intersections: Intersection[] = [],
  ) {
    this.cross = intersections.map((i) => new CrossCar(i, level.streetY));
  }

  private blockedAt(x0: number, x1: number): boolean {
    for (let x = x0; x <= x1; x += TILE / 2) if (!isStreetAt(this.level, x)) return true;
    if (this.level.cars.some((c) => c.x1 > x0 && c.x0 < x1)) return true;
    if (this.level.glass.some((g) => g.x1 > x0 && g.x0 < x1)) return true;
    return false;
  }

  private spawn(s: Spawn): void {
    const x0 = s.at + (s.kind === 'oncoming' ? TRAFFIC.aheadOncoming : TRAFFIC.aheadRobotaxi);
    const [w, h] = vehicleSize(s.kind);
    //a truck needs street for its tailgate behind it too
    const back = s.kind === 'truck' ? TRAFFIC.tailgate : 0;
    if (x0 + w > this.level.exitX || this.blockedAt(x0 - TILE - back, x0 + w + TILE)) return;
    const bottom = this.level.streetY;
    this.vehicles.push({
      id: this.ids++, kind: s.kind, speed: s.speed, cruise: s.speed, lane: 0, leaving: false,
      x0, x1: x0 + w, bottom, roof: bottom - h,
      ...(s.kind === 'truck' ? { kicker: TRAFFIC.tailgate } : {}),
    });
  }

  step(skaterX: number): void {
    for (const c of this.cross) c.step(skaterX);
    while (this.next < this.plan.length && skaterX >= this.plan[this.next].at) this.spawn(this.plan[this.next++]);

    for (const v of this.vehicles) {
      if (v.speed > 0 && !v.leaving && !(this.noBrake && v.kind === 'robotaxi')) {
        //brake hard when the skater rolls up behind
        const gap = v.x0 - skaterX;
        const target = gap > 0 && gap < TRAFFIC.brakeRange ? PHYS.baseSpeed * TRAFFIC.brakeSpeed : v.cruise;
        v.speed += (target - v.speed) * 0.15;
      }
      v.x0 += v.speed;
      v.x1 += v.speed;
      //pull out of the lane before anything the street can't carry
      if (!v.leaving) {
        const ahead = v.speed >= 0 ? [v.x1, v.x1 + TRAFFIC.clearance] : [v.x0 - TRAFFIC.clearance, v.x0];
        if (this.blockedAt(ahead[0], ahead[1])) v.leaving = true;
      }
      if (v.leaving) v.lane = Math.min(1, v.lane + 1 / TRAFFIC.laneFrames);
    }
    //drop vehicles far behind the skater or gone from the lane long ago
    this.vehicles = this.vehicles.filter((v) => v.x1 > skaterX - 40 * TILE && v.x0 < skaterX + 60 * TILE);
  }

  // vehicles the skater can touch
  get inLane(): Vehicle[] {
    return this.vehicles.filter((v) => !v.leaving);
  }

  // cross traffic in the skate lane right now
  get crossing(): Car[] {
    return this.cross.filter((c) => c.inLane).map((c) => c.box);
  }
}
