// Moving traffic in the skate lane (GDD: Traffic). The director spawns vehicles from the floor seed when the
// skater passes trigger points, so a slower skater sees the same street. Vehicles pull out of the skate lane
// before canals, parked cars and glass, so they never sit where the street can't hold them.
import { makeRng, randInt } from '../gen/rng';
import { PHYS, TILE } from '../physics/constants';
import { isStreetAt, type Car, type Level } from '../physics/level';

export type VehicleKind = 'robotaxi' | 'oncoming';

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
  const density = Math.min(0.67, 0.3 + 0.06 * (floor - 1));
  const plan: Spawn[] = [];
  for (let p = 1; p < pieces - 2; p++) {
    if (rng() >= density) continue;
    const oncoming = floor >= 3 && rng() < 0.4;
    const [lo, hi] = TRAFFIC.robotaxiSpeed;
    plan.push({
      at: level.finaleX + p * 16 * TILE + randInt(rng, 8) * TILE,
      kind: oncoming ? 'oncoming' : 'robotaxi',
      speed: oncoming ? TRAFFIC.oncomingSpeed : PHYS.baseSpeed * (lo + (hi - lo) * rng()),
    });
  }
  return plan;
}

export class Traffic {
  vehicles: Vehicle[] = [];
  private next = 0;
  private ids = 0;

  constructor(
    private readonly level: Level,
    private readonly plan: Spawn[],
  ) {}

  private blockedAt(x0: number, x1: number): boolean {
    for (let x = x0; x <= x1; x += TILE / 2) if (!isStreetAt(this.level, x)) return true;
    if (this.level.cars.some((c) => c.x1 > x0 && c.x0 < x1)) return true;
    if (this.level.glass.some((g) => g.x1 > x0 && g.x0 < x1)) return true;
    return false;
  }

  private spawn(s: Spawn): void {
    const x0 = s.at + (s.kind === 'oncoming' ? TRAFFIC.aheadOncoming : TRAFFIC.aheadRobotaxi);
    if (x0 + TRAFFIC.carW > this.level.exitX || this.blockedAt(x0 - TILE, x0 + TRAFFIC.carW + TILE)) return;
    const bottom = this.level.streetY;
    this.vehicles.push({
      id: this.ids++, kind: s.kind, speed: s.speed, cruise: s.speed, lane: 0, leaving: false,
      x0, x1: x0 + TRAFFIC.carW, bottom, roof: bottom - TRAFFIC.carH,
    });
  }

  step(skaterX: number): void {
    while (this.next < this.plan.length && skaterX >= this.plan[this.next].at) this.spawn(this.plan[this.next++]);

    for (const v of this.vehicles) {
      if (v.kind === 'robotaxi' && !v.leaving) {
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
}
