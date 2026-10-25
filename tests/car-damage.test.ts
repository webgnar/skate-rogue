import { describe, expect, it } from 'vitest';
import { FloorSim, type FloorEvent } from '../src/sim/floor';
import { CAR_HEALTH, stageOf } from '../src/traffic/damage';
import { SCORE } from '../src/run/score';
import { levelOf, FLAT } from './helpers';
import type { Car } from '../src/physics/level';
import type { Vehicle } from '../src/traffic/traffic';

const CARS = [
  '................', '................', '................', '................', '................',
  '................', '................', '................', '.......c........', '################',
];

type Dent = Extract<FloorEvent, { type: 'dent' }>;

// drop the skater onto the first parked car's roof until it hops; returns the dent event
function hop(sim: FloorSim, car: Car = sim.level.cars[0]): Dent | null {
  const sk = sim.skater;
  sk.x = (car.x0 + car.x1) / 2;
  sk.y = car.roof - 12;
  sk.mode = 'air';
  sk.vsp = 3;
  sk.hsp = 0;
  for (let f = 0; f < 30; f++) {
    sim.step({ pressed: false, held: false });
    const d = sim.events.find((e) => e.type === 'dent') as Dent | undefined;
    if (d) return d;
    if (sim.events.some((e) => e.type === 'hop')) return null;
  }
  return null;
}

describe('car-hop damage', () => {
  it('stages: dented from the first hop, busted from half, wrecked at zero', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((h) => stageOf(h, 6))).toEqual([0, 1, 1, 2, 2, 2, 3]);
    expect(stageOf(5, CAR_HEALTH.robotaxi)).toBe(3);
    expect(stageOf(11, CAR_HEALTH.bus)).toBe(2);
  });

  it('vehicles take different numbers of hops', () => {
    expect(CAR_HEALTH.parked).toBe(6);
    expect(new Set(Object.values(CAR_HEALTH)).size).toBeGreaterThan(3);
    expect(CAR_HEALTH.bus).toBeGreaterThan(CAR_HEALTH.truck);
    expect(CAR_HEALTH.truck).toBeGreaterThan(CAR_HEALTH.car);
  });

  it('six hops total a parked car, which then stops being solid', () => {
    const sim = new FloorSim(levelOf(CARS));
    const car = sim.level.cars[0];
    const dents: Dent[] = [];
    for (let i = 0; i < 6; i++) {
      const d = hop(sim);
      expect(d).not.toBeNull();
      dents.push(d!);
    }
    expect(dents.map((d) => d.hits)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(dents.map((d) => d.stage)).toEqual([1, 1, 2, 2, 2, 3]);
    expect(dents[0].car).toEqual({ parked: 0 });
    expect(dents[0].kind).toBe('parked');
    //the wreck: no roof to hop off, and riding into it is no slam
    expect(sim.skater.wrecked.has(car)).toBe(true);
    expect(hop(sim)).toBeNull();
    expect(sim.skater.y).toBeGreaterThan(car.roof);
  });

  it('a robotaxi in traffic totals in five and rolls out of the lane', () => {
    const sim = new FloorSim(levelOf(FLAT));
    const y = sim.level.streetY;
    const x0 = sim.skater.x + 200;
    const v: Vehicle = { id: 99, kind: 'robotaxi', speed: 1, cruise: 1, lane: 0, leaving: false, x0, x1: x0 + 64, bottom: y, roof: y - 40 };
    sim.traffic.vehicles.push(v);
    const dents = Array.from({ length: 5 }, () => hop(sim, v));
    expect(dents.map((d) => d?.stage)).toEqual([1, 1, 2, 2, 3]);
    expect(dents[4]!.car).toEqual({ vehicle: 99 });
    expect(v.wrecked).toBe(true);
    for (let f = 0; f < 40; f++) sim.step({ pressed: false, held: false });
    expect(v.lane).toBe(1);
    expect(Math.abs(v.speed)).toBeLessThan(0.1);
  });

  it('a wreck scores on top of the hop', () => {
    expect(SCORE.wreck).toBeGreaterThan(0);
  });
});
