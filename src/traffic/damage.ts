// Car-hop damage (zack, 2026-10-25): every hop off a roof dents the car, springs and dust burst out of it, and
// enough hops total it. Each kind of vehicle takes a different number of hops. Pure: the floor sim counts the hits,
// the view swaps in the dented, busted and wrecked models (art/cars.py) by stage.
import type { Car } from '../physics/level';
import type { VehicleKind } from './traffic';

// what the hop came off: a parked car (also hit through its open door) by its index on the floor, or a vehicle in
// traffic by its id. A cross street's car mid-turn takes the hop but no damage until it has turned onto your road.
export type CarRef = { parked: number } | { vehicle: number };

export type DamageKind = VehicleKind | 'parked' | 'cruiser' | 'parkedBus';

// hops to total one: a plain car about 6 (zack); the AI's robotaxi is thin plastic, the sheriff SUV and the box
// truck are tougher, a CTA bus takes a dozen
export const CAR_HEALTH: Record<DamageKind, number> = {
  robotaxi: 5,
  oncoming: 6,
  car: 6,
  parked: 6,
  cruiser: 8,
  truck: 9,
  bus: 12,
  parkedBus: 12,
};

export const DAMAGE = {
  bustAt: 0.5, // share of its health gone where a dented car looks busted
  wreckDrift: 0.9, // a wrecked vehicle's speed each frame as it rolls to a stop
};

// 0 clean, 1 dented, 2 busted, 3 wrecked
export type Stage = 0 | 1 | 2 | 3;

export function stageOf(hits: number, health: number): Stage {
  if (hits <= 0) return 0;
  if (hits >= health) return 3;
  return hits >= health * DAMAGE.bustAt ? 2 : 1;
}

// the parked car's kind of damage: a roadblock's bus or cruiser, or a plain parked car
export function parkedKind(car: Car): DamageKind {
  return car.model === 'bus' ? 'parkedBus' : car.model === 'cruiser' ? 'cruiser' : 'parked';
}
