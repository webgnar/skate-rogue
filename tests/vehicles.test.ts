import { describe, expect, it } from 'vitest';
import { PHYS, TILE } from '../src/physics/constants';
import { validatedFloor } from '../src/gen/validate';
import { FloorSim, NEAR_MISS } from '../src/sim/floor';
import { spawnPlan, TRAFFIC } from '../src/traffic/traffic';
import { FLAT, levelOf } from './helpers';

const idle = { pressed: false, held: false };

describe('buses and box trucks', () => {
  it('join the traffic going your way from floor 4', () => {
    const kinds = (floor: number) =>
      [1, 2, 3, 4, 5, 6].flatMap((seed) => spawnPlan(validatedFloor(seed * 13, floor).level, seed).map((s) => s.kind));
    expect(kinds(3).filter((k) => k === 'bus' || k === 'truck')).toHaveLength(0);
    const deep = kinds(7);
    expect(deep).toContain('bus');
    expect(deep).toContain('truck');
  });

  it("a truck's tailgate kicks you up over the box with a burst of speed, no slam", () => {
    const level = levelOf(FLAT);
    const sim = new FloorSim(level);
    sim.traffic.vehicles.length = 0;
    const x0 = sim.skater.x + 6 * TILE;
    const truck = { id: 1, kind: 'truck' as const, speed: 1.5, cruise: 1.5, lane: 0, leaving: false, x0, x1: x0 + TRAFFIC.truckW, bottom: level.streetY, roof: level.streetY - TRAFFIC.truckH, kicker: TRAFFIC.tailgate };
    sim.traffic.vehicles.push(truck);
    const types: string[] = [];
    let top = Infinity;
    for (let f = 0; f < 150; f++) {
      sim.step(idle);
      types.push(...sim.events.map((e) => e.type));
      top = Math.min(top, sim.skater.y);
    }
    expect(types).toContain('kicker');
    expect(types).not.toContain('slam');
    expect(level.streetY - top).toBeGreaterThan(TRAFFIC.truckH);
    expect(sim.skater.carry).toBeGreaterThan(PHYS.baseSpeed);
  });
});

describe('close calls', () => {
  const over = (clearance: number) => {
    const level = levelOf(FLAT);
    const sim = new FloorSim(level);
    sim.traffic.vehicles.length = 0;
    const sk = sim.skater;
    const x0 = sk.x + 3 * TILE;
    level.cars.push({ x0, x1: x0 + 2 * TILE, roof: level.streetY - 40, bottom: level.streetY });
    //in the air just before the car, at the top of a jump, fast enough to clear it
    Object.assign(sk, { x: x0 - 12, y: level.streetY - 40 - clearance, vsp: -1.2, hsp: 8, mode: 'air', surface: null });
    const types: string[] = [];
    for (let f = 0; f < 40; f++) {
      sim.step(idle);
      types.push(...sim.events.map((e) => e.type));
    }
    level.cars.pop();
    return { types, heat: sim.heat.value };
  };

  it('clearing a car by a few px is a close call; by a lot it is not', () => {
    expect(over(4).types).toContain('near');
    expect(over(NEAR_MISS + 30).types).not.toContain('near');
  });

  it('landing on the roof is a car hop, not a close call', () => {
    const level = levelOf(FLAT);
    const sim = new FloorSim(level);
    sim.traffic.vehicles.length = 0;
    const sk = sim.skater;
    const x0 = sk.x + 3 * TILE;
    level.cars.push({ x0, x1: x0 + 2 * TILE, roof: level.streetY - 40, bottom: level.streetY });
    Object.assign(sk, { x: x0 + 4, y: level.streetY - 46, vsp: 1, hsp: 3.5, mode: 'air', surface: null });
    const types: string[] = [];
    for (let f = 0; f < 60; f++) {
      sim.step(idle);
      types.push(...sim.events.map((e) => e.type));
    }
    expect(types).toContain('hop');
    expect(types).not.toContain('near');
  });
});
